// =================================================================
// KMS ENCRYPTION + CRYPTO-SHRED PAR TENANT 
// =================================================================
// Objectif 4: Chiffrement des données sensibles avec clés dédiées par tenant
// Support crypto-shredding pour suppression sécurisée des données

import crypto from 'crypto';
import { db } from "./db";
import { sql } from "drizzle-orm";

// Interface pour les clés KMS
interface TenantKMSKey {
  tenantId: string;
  keyId: string;
  keyVersion: number;
  algorithm: string;
  createdAt: Date;
  rotatedAt?: Date;
  isActive: boolean;
}

// Interface pour les métadonnées de chiffrement
interface EncryptionMetadata {
  tenantId: string;
  keyId: string;
  keyVersion: number;
  algorithm: string;
  iv: string; // Initialization Vector
  encryptedAt: Date;
}

// Types de données sensibles à chiffrer
export enum SensitiveDataType {
  MAINTENANCE_CASE = 'maintenance_case',
  DIAGNOSTIC_SESSION = 'diagnostic_session', 
  USER_DATA = 'user_data',
  AUDIT_LOG = 'audit_log',
  FEDERATED_MODEL = 'federated_model'
}

export class KMSEncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 12; // 96 bits (GCM standard)
  private static readonly TAG_LENGTH = 16; // 128 bits

  /**
   * Générer une nouvelle clé de chiffrement pour un tenant
   */
  static async generateTenantKey(tenantId: string): Promise<TenantKMSKey> {
    const keyId = `kms-${tenantId}-${Date.now()}`;
    const keyBuffer = crypto.randomBytes(this.KEY_LENGTH);
    
    // Stocker la clé dans une table PostgreSQL sécurisée
    await this.storeEncryptionKey(tenantId, keyId, keyBuffer);
    
    const tenantKey: TenantKMSKey = {
      tenantId,
      keyId,
      keyVersion: 1,
      algorithm: this.ALGORITHM,
      createdAt: new Date(),
      isActive: true
    };
    
    // Logger la création de clé (sans exposer la clé elle-même)
    console.log(`🔐 KMS Key generated for tenant ${tenantId}: ${keyId}`);
    
    return tenantKey;
  }
  
  /**
   * Chiffrer des données sensibles avec la clé du tenant
   */
  static async encryptSensitiveData(
    tenantId: string,
    data: string | Buffer,
    dataType: SensitiveDataType
  ): Promise<{
    encryptedData: string;
    metadata: EncryptionMetadata;
  }> {
    try {
      // Récupérer la clé active du tenant
      const tenantKey = await this.getTenantActiveKey(tenantId);
      if (!tenantKey) {
        throw new Error(`No active KMS key found for tenant: ${tenantId}`);
      }
      
      // Générer IV aléatoire (12 bytes pour GCM)
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // Récupérer la clé de chiffrement
      const keyBuffer = await this.retrieveEncryptionKey(tenantKey.keyId);
      
      // AAD étendue pour sécurité renforcée
      const aadData = JSON.stringify({
        tenantId,
        keyId: tenantKey.keyId,
        keyVersion: tenantKey.keyVersion,
        dataType,
        purpose: 'data_encryption'
      });
      
      // Chiffrer avec AES-256-GCM moderne (binary-safe)
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
      cipher.setAAD(Buffer.from(aadData));
      
      // Traitement binary-safe des données
      const inputBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      const encryptedBuffer = Buffer.concat([
        cipher.update(inputBuffer),
        cipher.final()
      ]);
      
      // Récupérer le tag d'authentification GCM
      const authTag = cipher.getAuthTag();
      
      // Créer les métadonnées de chiffrement
      const metadata: EncryptionMetadata = {
        tenantId,
        keyId: tenantKey.keyId,
        keyVersion: tenantKey.keyVersion,
        algorithm: this.ALGORITHM,
        iv: iv.toString('hex'),
        encryptedAt: new Date()
      };
      
      // Structure JSON sécurisée (binary-safe)
      const encryptedPayload = {
        iv: iv.toString('base64'),
        data: encryptedBuffer.toString('base64'),
        tag: authTag.toString('base64'),
        aad: aadData,
        algorithm: this.ALGORITHM
      };
      
      const encryptedData = JSON.stringify(encryptedPayload);
      
      // Audit log pour traçabilité (sans exposer les données)
      await this.logEncryptionActivity(tenantId, dataType, 'ENCRYPT', metadata.keyId);
      
      return {
        encryptedData,
        metadata
      };
      
    } catch (error) {
      console.error(`KMS Encryption failed for tenant ${tenantId}:`, error);
      throw new Error('Encryption failed - check KMS configuration');
    }
  }
  
  /**
   * Déchiffrer des données avec la clé du tenant
   */
  static async decryptSensitiveData(
    encryptedData: string,
    metadata: EncryptionMetadata
  ): Promise<string> {
    try {
      // Vérifier que le tenant correspond
      const currentTenant = await this.getCurrentTenant();
      if (currentTenant !== metadata.tenantId) {
        throw new Error(`Access denied: data belongs to tenant ${metadata.tenantId}`);
      }
      
      // Récupérer la clé de chiffrement
      const keyBuffer = await this.retrieveEncryptionKey(metadata.keyId);
      
      // Parser la structure JSON sécurisée
      const encryptedPayload = JSON.parse(encryptedData);
      const iv = Buffer.from(encryptedPayload.iv, 'base64');
      const ciphertext = Buffer.from(encryptedPayload.data, 'base64');
      const authTag = Buffer.from(encryptedPayload.tag, 'base64');
      const aadData = encryptedPayload.aad;
      
      // Déchiffrer avec vérification d'authenticité GCM
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
      decipher.setAAD(Buffer.from(aadData));
      decipher.setAuthTag(authTag);
      
      // Déchiffrement binary-safe
      const decryptedBuffer = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
      
      const decrypted = decryptedBuffer.toString('utf8');
      
      // Audit log
      await this.logEncryptionActivity(
        metadata.tenantId,
        SensitiveDataType.USER_DATA,
        'DECRYPT', 
        metadata.keyId
      );
      
      return decrypted;
      
    } catch (error) {
      console.error('KMS Decryption failed:', error);
      throw new Error('Decryption failed - check access permissions');
    }
  }
  
  /**
   * Rotation des clés de chiffrement (crypto-agility)
   */
  static async rotateTenantKey(tenantId: string): Promise<TenantKMSKey> {
    try {
      // Désactiver l'ancienne clé
      await this.deactivateTenantKeys(tenantId);
      
      // Générer nouvelle clé
      const newKey = await this.generateTenantKey(tenantId);
      
      console.log(`🔄 KMS Key rotated for tenant ${tenantId}: ${newKey.keyId}`);
      
      // Audit log pour rotation
      await this.logEncryptionActivity(tenantId, SensitiveDataType.USER_DATA, 'KEY_ROTATION', newKey.keyId);
      
      return newKey;
    } catch (error) {
      console.error(`Key rotation failed for tenant ${tenantId}:`, error);
      throw new Error('Key rotation failed');
    }
  }
  
  /**
   * Crypto-shredding : suppression sécurisée des données par destruction de clé
   */
  static async cryptoShredTenantData(tenantId: string, reason: string = 'GDPR_DELETION'): Promise<{
    destroyedKeys: number;
    affectedDataTypes: SensitiveDataType[];
    shreddedAt: Date;
  }> {
    try {
      console.log(`🗑️ Initiating crypto-shred for tenant: ${tenantId}`);
      
      // Récupérer toutes les clés du tenant
      const tenantKeys = await this.getAllTenantKeys(tenantId);
      
      // Identifier les types de données affectés
      const affectedDataTypes = await this.identifyAffectedDataTypes(tenantId);
      
      // Destruction irréversible des clés de chiffrement
      let destroyedKeys = 0;
      for (const key of tenantKeys) {
        await this.destroyEncryptionKey(key.keyId);
        destroyedKeys++;
      }
      
      // Marquer les données comme crypto-shredded dans les métadonnées
      await this.markDataAsCryptoShredded(tenantId);
      
      // Audit log critique pour traçabilité GDPR
      await this.logEncryptionActivity(tenantId, SensitiveDataType.USER_DATA, 'CRYPTO_SHRED', `${destroyedKeys}_keys_destroyed`);
      
      const shreddedAt = new Date();
      
      console.log(`✅ Crypto-shred completed for tenant ${tenantId}: ${destroyedKeys} keys destroyed`);
      
      return {
        destroyedKeys,
        affectedDataTypes,
        shreddedAt
      };
    } catch (error) {
      console.error(`Crypto-shred failed for tenant ${tenantId}:`, error);
      throw new Error('Crypto-shredding failed - contact administrator');
    }
  }
  
  // ============================
  // MÉTHODES PRIVÉES
  // ============================
  
  /**
   * Stocker une clé de chiffrement en base (PostgreSQL sécurisé)
   */
  private static async storeEncryptionKey(tenantId: string, keyId: string, keyBuffer: Buffer): Promise<void> {
    // En production, utiliser un HSM ou service KMS externe
    // Ici, version simplifiée avec PostgreSQL chiffré
    const encryptedKey = this.encryptKeyForStorage(keyBuffer);
    
    await db.execute(sql`
      INSERT INTO tenant_encryption_keys (tenant_id, key_id, encrypted_key, created_at, is_active)
      VALUES (${tenantId}, ${keyId}, ${encryptedKey}, NOW(), true)
    `);
  }
  
  /**
   * Récupérer une clé de chiffrement
   */
  private static async retrieveEncryptionKey(keyId: string): Promise<Buffer> {
    const results = await db.execute(sql`
      SELECT encrypted_key FROM tenant_encryption_keys WHERE key_id = ${keyId} AND is_active = true
    `);
    
    if (results.rows.length === 0) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }
    
    // Déchiffrer la clé stockée
    return this.decryptKeyFromStorage(results.rows[0].encrypted_key as string);
  }
  
  /**
   * Obtenir la clé active d'un tenant
   */
  private static async getTenantActiveKey(tenantId: string): Promise<TenantKMSKey | null> {
    const results = await db.execute(sql`
      SELECT key_id, key_version, created_at, is_active 
      FROM tenant_encryption_keys 
      WHERE tenant_id = ${tenantId} AND is_active = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (results.rows.length === 0) {
      return null;
    }
    
    const row = results.rows[0];
    return {
      tenantId,
      keyId: row.key_id as string,
      keyVersion: (row.key_version as number) || 1,
      algorithm: this.ALGORITHM,
      createdAt: row.created_at as Date,
      isActive: row.is_active as boolean
    };
  }
  
  /**
   * Obtenir tenant actuel depuis contexte PostgreSQL
   */
  private static async getCurrentTenant(): Promise<string> {
    const results = await db.execute(sql`SELECT get_current_tenant() as tenant_id`);
    return results.rows.length > 0 ? (results.rows[0].tenant_id as string) || '' : '';
  }
  
  /**
   * Désactiver toutes les clés d'un tenant
   */
  private static async deactivateTenantKeys(tenantId: string): Promise<void> {
    await db.execute(sql`
      UPDATE tenant_encryption_keys 
      SET is_active = false, rotated_at = NOW() 
      WHERE tenant_id = ${tenantId} AND is_active = true
    `);
  }
  
  /**
   * Récupérer toutes les clés d'un tenant
   */
  private static async getAllTenantKeys(tenantId: string): Promise<TenantKMSKey[]> {
    const results = await db.execute(sql`
      SELECT key_id, key_version, created_at, is_active 
      FROM tenant_encryption_keys 
      WHERE tenant_id = ${tenantId}
    `);
    
    return results.rows.map(r => ({
      tenantId,
      keyId: r.key_id as string,
      keyVersion: r.key_version as number,
      algorithm: this.ALGORITHM,
      createdAt: r.created_at as Date,
      isActive: r.is_active as boolean
    }));
  }
  
  /**
   * Identifier les types de données affectés par crypto-shred
   */
  private static async identifyAffectedDataTypes(tenantId: string): Promise<SensitiveDataType[]> {
    // En production, scanner toutes les tables pour identifier données chiffrées
    return [
      SensitiveDataType.MAINTENANCE_CASE,
      SensitiveDataType.DIAGNOSTIC_SESSION,
      SensitiveDataType.USER_DATA,
      SensitiveDataType.AUDIT_LOG
    ];
  }
  
  /**
   * Destruction irréversible d'une clé
   */
  private static async destroyEncryptionKey(keyId: string): Promise<void> {
    // Écraser la clé avec des données aléatoires plusieurs fois
    const randomData = crypto.randomBytes(this.KEY_LENGTH).toString('hex');
    
    await db.execute(sql`
      UPDATE tenant_encryption_keys 
      SET encrypted_key = ${randomData}, is_active = false, destroyed_at = NOW()
      WHERE key_id = ${keyId}
    `);
    
    // Seconde passe d'écrasement
    const randomData2 = crypto.randomBytes(this.KEY_LENGTH).toString('hex');
    await db.execute(sql`
      UPDATE tenant_encryption_keys 
      SET encrypted_key = ${randomData2}
      WHERE key_id = ${keyId}
    `);
  }
  
  /**
   * Marquer données comme crypto-shredded
   */
  private static async markDataAsCryptoShredded(tenantId: string): Promise<void> {
    // Marquer les tables avec données chiffrées
    await db.execute(sql`
      UPDATE maintenance_cases 
      SET crypto_shredded = true, crypto_shredded_at = NOW()
      WHERE tenant_id = ${tenantId}
    `);
    
    await db.execute(sql`
      UPDATE diagnostic_sessions 
      SET crypto_shredded = true, crypto_shredded_at = NOW()
      WHERE tenant_id = ${tenantId}
    `);
  }
  
  /**
   * Chiffrer une clé pour stockage (master key)
   */
  private static encryptKeyForStorage(keyBuffer: Buffer): string {
    const masterKey = process.env.KMS_MASTER_KEY;
    if (!masterKey || masterKey.length < 32) {
      throw new Error('KMS_MASTER_KEY environment variable must be set and at least 32 characters');
    }
    
    // Dériver KEK sécurisé avec HKDF
    const salt = crypto.randomBytes(32);
    const kek = Buffer.from(crypto.hkdfSync('sha256', Buffer.from(masterKey), salt, Buffer.from('smart-gmao-kms'), 32));
    
    const iv = crypto.randomBytes(12); // GCM standard
    const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
    
    let encrypted = cipher.update(keyBuffer, undefined, 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    // Structure sécurisée : salt + IV + encrypted + authTag
    encrypted = salt.toString('hex') + iv.toString('hex') + encrypted + authTag.toString('hex');
    
    return encrypted;
  }
  
  /**
   * Déchiffrer une clé depuis le stockage
   */
  private static decryptKeyFromStorage(encryptedKey: string): Buffer {
    const masterKey = process.env.KMS_MASTER_KEY;
    if (!masterKey || masterKey.length < 32) {
      throw new Error('KMS_MASTER_KEY environment variable must be set and at least 32 characters');
    }
    
    // Extraire salt, IV, données et authTag
    const salt = Buffer.from(encryptedKey.substring(0, 64), 'hex'); // 32 bytes salt
    const iv = Buffer.from(encryptedKey.substring(64, 88), 'hex'); // 12 bytes IV
    const authTagStart = encryptedKey.length - 32;
    const ciphertext = encryptedKey.substring(88, authTagStart);
    const authTag = Buffer.from(encryptedKey.substring(authTagStart), 'hex');
    
    // Redériver KEK avec même sel
    const kek = Buffer.from(crypto.hkdfSync('sha256', Buffer.from(masterKey), salt, Buffer.from('smart-gmao-kms'), 32));
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, 'hex');
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }
  
  /**
   * Logger l'activité de chiffrement
   */
  private static async logEncryptionActivity(
    tenantId: string, 
    dataType: SensitiveDataType, 
    action: string, 
    keyId: string
  ): Promise<void> {
    try {
      // Insérer dans audit_logs avec informations de chiffrement
      await db.execute(sql`
        INSERT INTO audit_logs (tenant_id, action, resource_type, resource_id, success, details, timestamp)
        VALUES (
          ${tenantId}, 
          ${action}, 
          'encryption', 
          ${keyId}, 
          true, 
          ${JSON.stringify({ dataType, algorithm: this.ALGORITHM })},
          NOW()
        )
      `);
    } catch (error) {
      console.error('Failed to log encryption activity:', error);
      // Ne pas bloquer l'opération de chiffrement pour un problème de log
    }
  }
}

// Helper functions pour utilisation facile
export async function encryptTenantData(tenantId: string, data: string, type: SensitiveDataType) {
  return KMSEncryptionService.encryptSensitiveData(tenantId, data, type);
}

export async function decryptTenantData(encryptedData: string, metadata: EncryptionMetadata) {
  return KMSEncryptionService.decryptSensitiveData(encryptedData, metadata);
}

export async function initializeTenantEncryption(tenantId: string) {
  return KMSEncryptionService.generateTenantKey(tenantId);
}

export async function performCryptoShred(tenantId: string, reason?: string) {
  return KMSEncryptionService.cryptoShredTenantData(tenantId, reason);
}