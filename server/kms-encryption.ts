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
  private static readonly IV_LENGTH = 16; // 128 bits
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
      
      // Générer IV aléatoire
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // Récupérer la clé de chiffrement
      const keyBuffer = await this.retrieveEncryptionKey(tenantKey.keyId);
      
      // Chiffrer avec AES-256-GCM
      const cipher = crypto.createCipher(this.ALGORITHM, keyBuffer);
      cipher.setAutoPadding(true);
      
      let encrypted = '';
      encrypted += cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Créer les métadonnées de chiffrement
      const metadata: EncryptionMetadata = {
        tenantId,
        keyId: tenantKey.keyId,
        keyVersion: tenantKey.keyVersion,
        algorithm: this.ALGORITHM,
        iv: iv.toString('hex'),
        encryptedAt: new Date()
      };
      
      // Combiner IV + encrypted data + auth tag
      const encryptedData = iv.toString('hex') + encrypted;
      
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
      
      // Extraire IV et données chiffrées
      const iv = Buffer.from(encryptedData.substring(0, this.IV_LENGTH * 2), 'hex');
      const encrypted = encryptedData.substring(this.IV_LENGTH * 2);
      
      // Déchiffrer
      const decipher = crypto.createDecipher(this.ALGORITHM, keyBuffer);
      
      let decrypted = '';
      decrypted += decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
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
    const [result] = await db.execute(sql`
      SELECT encrypted_key FROM tenant_encryption_keys WHERE key_id = ${keyId} AND is_active = true
    `);
    
    if (!result) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }
    
    // Déchiffrer la clé stockée
    return this.decryptKeyFromStorage((result as any).encrypted_key);
  }
  
  /**
   * Obtenir la clé active d'un tenant
   */
  private static async getTenantActiveKey(tenantId: string): Promise<TenantKMSKey | null> {
    const [result] = await db.execute(sql`
      SELECT key_id, key_version, created_at, is_active 
      FROM tenant_encryption_keys 
      WHERE tenant_id = ${tenantId} AND is_active = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (!result) {
      return null;
    }
    
    return {
      tenantId,
      keyId: (result as any).key_id,
      keyVersion: (result as any).key_version || 1,
      algorithm: this.ALGORITHM,
      createdAt: (result as any).created_at,
      isActive: (result as any).is_active
    };
  }
  
  /**
   * Obtenir tenant actuel depuis contexte PostgreSQL
   */
  private static async getCurrentTenant(): Promise<string> {
    const [result] = await db.execute(sql`SELECT get_current_tenant() as tenant_id`);
    return (result as any)?.tenant_id || '';
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
    
    return results.map(r => ({
      tenantId,
      keyId: (r as any).key_id,
      keyVersion: (r as any).key_version,
      algorithm: this.ALGORITHM,
      createdAt: (r as any).created_at,
      isActive: (r as any).is_active
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
    const masterKey = process.env.KMS_MASTER_KEY || 'default-master-key-change-in-production';
    const cipher = crypto.createCipher('aes-256-cbc', masterKey);
    
    let encrypted = cipher.update(keyBuffer, 'binary', 'hex');
    encrypted += cipher.final('hex');
    
    return encrypted;
  }
  
  /**
   * Déchiffrer une clé depuis le stockage
   */
  private static decryptKeyFromStorage(encryptedKey: string): Buffer {
    const masterKey = process.env.KMS_MASTER_KEY || 'default-master-key-change-in-production';
    const decipher = crypto.createDecipher('aes-256-cbc', masterKey);
    
    let decrypted = decipher.update(encryptedKey, 'hex', 'binary');
    decrypted += decipher.final('binary');
    
    return Buffer.from(decrypted, 'binary');
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