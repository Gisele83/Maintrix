/**
 * 🔐 SYSTÈME MFA COMPLET POUR ADMINISTRATEURS
 * 
 * Implémentation complète de l'authentification multi-facteurs :
 * - TOTP (Google Authenticator, Authy)
 * - Backup codes de récupération
 * - Validation et setup automatique
 * - Enforcement pour rôles Admin/Owner
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { db } from './db';
import { userProfiles } from '../shared/schema';
import { eq } from 'drizzle-orm';

export interface MFASecret {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MFASetupResult {
  success: boolean;
  qrCode?: string;
  backupCodes?: string[];
  message: string;
}

export interface MFAVerificationResult {
  success: boolean;
  message: string;
  backupCodeUsed?: boolean;
}

/**
 * Service principal de gestion MFA
 */
export class MFAService {

  /**
   * Génère un secret TOTP pour un utilisateur
   */
  static async generateMFASecret(userId: number, userEmail: string): Promise<MFASecret> {
    const secret = speakeasy.generateSecret({
      name: `Maintrix (${userEmail})`,
      issuer: 'Maintrix',
      length: 32
    });

    // Générer les codes de backup
    const backupCodes = MFAService.generateBackupCodes();

    // Générer le QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32!,
      qrCode,
      backupCodes
    };
  }

  /**
   * Configure MFA pour un utilisateur
   */
  static async setupMFA(
    userId: number, 
    secret: string, 
    token: string, 
    backupCodes: string[]
  ): Promise<MFASetupResult> {
    try {
      // Vérifier le token TOTP
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2
      });

      if (!verified) {
        return {
          success: false,
          message: 'Code TOTP invalide. Vérifiez votre application d\'authentification.'
        };
      }

      // Chiffrer les backup codes
      const encryptedBackupCodes = MFAService.encryptBackupCodes(backupCodes);

      // Sauvegarder en base de données
      await db
        .update(userProfiles)
        .set({
          mfaSecret: secret,
          mfaEnabled: true,
          mfaBackupCodes: JSON.stringify(encryptedBackupCodes),
          updatedAt: new Date()
        })
        .where(eq(userProfiles.id, userId));

      console.log(`🔐 MFA SETUP SUCCESS: User ${userId} has enabled MFA`);

      return {
        success: true,
        message: 'MFA configuré avec succès',
        backupCodes
      };

    } catch (error) {
      console.error('Erreur setup MFA:', error);
      return {
        success: false,
        message: 'Erreur lors de la configuration MFA'
      };
    }
  }

  /**
   * Vérifie un code TOTP ou backup code
   */
  static async verifyMFA(
    userId: number, 
    token: string, 
    isBackupCode: boolean = false
  ): Promise<MFAVerificationResult> {
    try {
      const [user] = await db
        .select({
          mfaSecret: userProfiles.mfaSecret,
          mfaEnabled: userProfiles.mfaEnabled,
          mfaBackupCodes: userProfiles.mfaBackupCodes
        })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId));

      if (!user?.mfaEnabled || !user.mfaSecret) {
        return {
          success: false,
          message: 'MFA non configuré pour cet utilisateur'
        };
      }

      if (isBackupCode) {
        // Vérifier backup code
        return await MFAService.verifyBackupCode(userId, token, user.mfaBackupCodes);
      } else {
        // Vérifier TOTP
        const verified = speakeasy.totp.verify({
          secret: user.mfaSecret,
          encoding: 'base32',
          token,
          window: 2
        });

        if (verified) {
          console.log(`🔐 MFA VERIFY SUCCESS: User ${userId} authenticated with TOTP`);
          return {
            success: true,
            message: 'Code MFA valide'
          };
        } else {
          console.log(`🔐 MFA VERIFY FAILED: User ${userId} provided invalid TOTP`);
          return {
            success: false,
            message: 'Code MFA invalide'
          };
        }
      }

    } catch (error) {
      console.error('Erreur vérification MFA:', error);
      return {
        success: false,
        message: 'Erreur lors de la vérification MFA'
      };
    }
  }

  /**
   * Vérifie et consomme un backup code
   */
  private static async verifyBackupCode(
    userId: number, 
    backupCode: string, 
    encryptedBackupCodes: string | null
  ): Promise<MFAVerificationResult> {
    if (!encryptedBackupCodes) {
      return {
        success: false,
        message: 'Aucun code de récupération disponible'
      };
    }

    try {
      const backupCodes = MFAService.decryptBackupCodes(encryptedBackupCodes);
      const codeIndex = backupCodes.findIndex(code => code === backupCode);

      if (codeIndex === -1) {
        return {
          success: false,
          message: 'Code de récupération invalide'
        };
      }

      // Retirer le code utilisé de la liste
      backupCodes.splice(codeIndex, 1);
      const updatedEncryptedCodes = MFAService.encryptBackupCodes(backupCodes);

      // Mettre à jour en base
      await db
        .update(userProfiles)
        .set({
          mfaBackupCodes: JSON.stringify(updatedEncryptedCodes),
          updatedAt: new Date()
        })
        .where(eq(userProfiles.id, userId));

      console.log(`🔐 MFA BACKUP CODE USED: User ${userId} used backup code (${backupCodes.length} remaining)`);

      return {
        success: true,
        message: `Code de récupération valide (${backupCodes.length} codes restants)`,
        backupCodeUsed: true
      };

    } catch (error) {
      console.error('Erreur vérification backup code:', error);
      return {
        success: false,
        message: 'Erreur lors de la vérification du code de récupération'
      };
    }
  }

  /**
   * Génère des codes de backup aléaoires
   */
  static generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      // Générer un code de 8 caractères alphanumériques
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Chiffre les backup codes pour stockage sécurisé
   */
  private static getMfaKey(): string {
    const key = process.env.MFA_ENCRYPTION_KEY;
    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        console.error('⚠️  SECURITY: MFA_ENCRYPTION_KEY is not set in production! Backup code encryption is insecure.');
      }
      return 'default-development-key-change-in-production';
    }
    return key;
  }

  private static encryptBackupCodes(codes: string[]): string[] {
    const key = MFAService.getMfaKey();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cipher_fn = (crypto as any).createCipher as Function;
    return codes.map(code => {
      const cipher = cipher_fn('aes-256-cbc', key);
      let encrypted = cipher.update(code, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    });
  }

  /**
   * Déchiffre les backup codes
   */
  private static decryptBackupCodes(encryptedCodes: string): string[] {
    const key = MFAService.getMfaKey();
    const codes = JSON.parse(encryptedCodes);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const decipher_fn = (crypto as any).createDecipher as Function;
    return codes.map((encryptedCode: string) => {
      const decipher = decipher_fn('aes-256-cbc', key);
      let decrypted = decipher.update(encryptedCode, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    });
  }

  /**
   * Vérifie si MFA est requis pour un utilisateur
   */
  static async isMFARequired(userId: number): Promise<boolean> {
    try {
      const [user] = await db
        .select({
          role: userProfiles.role,
          tenantId: userProfiles.tenantId
        })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId));

      if (!user) return false;

      // MFA obligatoire pour Admin et Owner
      return ['admin', 'owner'].includes(user.role || '');

    } catch (error) {
      console.error('Erreur vérification MFA requis:', error);
      return false;
    }
  }

  /**
   * Vérifie si un utilisateur a MFA configuré
   */
  static async isMFAEnabled(userId: number): Promise<boolean> {
    try {
      const [user] = await db
        .select({ mfaEnabled: userProfiles.mfaEnabled })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId));

      return user?.mfaEnabled || false;

    } catch (error) {
      console.error('Erreur vérification MFA enabled:', error);
      return false;
    }
  }

  /**
   * Génère de nouveaux backup codes
   */
  static async regenerateBackupCodes(userId: number): Promise<string[]> {
    try {
      const newBackupCodes = MFAService.generateBackupCodes();
      const encryptedCodes = MFAService.encryptBackupCodes(newBackupCodes);

      await db
        .update(userProfiles)
        .set({
          mfaBackupCodes: JSON.stringify(encryptedCodes),
          updatedAt: new Date()
        })
        .where(eq(userProfiles.id, userId));

      console.log(`🔐 MFA BACKUP CODES REGENERATED: User ${userId}`);
      return newBackupCodes;

    } catch (error) {
      console.error('Erreur régénération backup codes:', error);
      throw error;
    }
  }

  /**
   * Désactive MFA pour un utilisateur
   */
  static async disableMFA(userId: number): Promise<boolean> {
    try {
      await db
        .update(userProfiles)
        .set({
          mfaSecret: null,
          mfaEnabled: false,
          mfaBackupCodes: null,
          updatedAt: new Date()
        })
        .where(eq(userProfiles.id, userId));

      console.log(`🔐 MFA DISABLED: User ${userId} has disabled MFA`);
      return true;

    } catch (error) {
      console.error('Erreur désactivation MFA:', error);
      return false;
    }
  }
}