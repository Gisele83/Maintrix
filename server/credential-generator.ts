/**
 * 🔐 GÉNÉRATEUR D'IDENTIFIANTS PAR DÉFAUT SÉCURISÉ
 * Système multi-niveaux pour super-admin → tenants → utilisateurs
 */

import crypto from "crypto";

export interface DefaultCredentials {
  username: string;
  password: string;
  mustChangePassword: boolean;
  expiresAt?: Date;
}

export interface SuperAdminUserCredentials extends DefaultCredentials {
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'owner' | 'admin' | 'maintainer' | 'technician' | 'viewer';
  isDefaultCredentials: boolean;
  passwordExpiresAt: Date;
  defaultCredentialsGeneratedBy: number;
  defaultCredentialsGeneratedAt: Date;
}

/**
 * Classe utilitaire pour générer des identifiants sécurisés par défaut
 */
export class CredentialGenerator {

  /**
   * Générer un nom d'utilisateur unique basé sur l'email et tenant
   */
  private static generateUsername(email: string, tenantPrefix?: string): string {
    const emailPart = email.split('@')[0].toLowerCase();
    // Nettoyer les caractères spéciaux
    const cleanEmail = emailPart.replace(/[^a-z0-9]/g, '');
    
    if (tenantPrefix) {
      const cleanTenant = tenantPrefix.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 6);
      return `${cleanTenant}_${cleanEmail}`.substring(0, 20);
    }
    
    return cleanEmail.substring(0, 15);
  }

  /**
   * Générer un mot de passe sécurisé temporaire
   */
  private static generateSecurePassword(): string {
    // Caractères autorisés (éviter ambiguïtés : 0,O,1,l,I)
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const numbers = '23456789';
    const special = '@#$%&*';
    
    let password = '';
    
    // Assurer au moins un caractère de chaque type
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Compléter avec des caractères aléatoires
    const allChars = lowercase + uppercase + numbers + special;
    for (let i = 4; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Mélanger les caractères
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * 🔐 SUPER-ADMIN SEULEMENT: Générer identifiants par défaut pour utilisateurs
   * SÉCURITÉ CRITIQUE: Seul le super-administrateur peut créer des comptes utilisateurs
   */
  static generateUserCredentialsForSuperAdmin(
    email: string,
    firstName: string,
    lastName: string,
    tenantId: string,
    role: 'owner' | 'admin' | 'maintainer' | 'technician' | 'viewer' = 'technician',
    superAdminId: number
  ): SuperAdminUserCredentials {
    const username = this.generateUsername(email);
    const password = this.generateSecurePassword();
    
    // Expiration forcée après 7 jours si pas changé
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    return {
      tenantId,
      username,
      password,
      email,
      firstName,
      lastName,
      role,
      mustChangePassword: true,
      isDefaultCredentials: true,
      passwordExpiresAt: expiresAt,
      defaultCredentialsGeneratedBy: superAdminId,
      defaultCredentialsGeneratedAt: new Date()
    };
  }

  /**
   * 🚫 FONCTIONNALITÉ SUPPRIMÉE: Génération par admin tenant
   * NOUVELLE SÉCURITÉ: Seul le super-admin peut créer des comptes utilisateurs
   * Les admins tenant ne peuvent plus générer d'identifiants par défaut
   */
  static generateTenantUserCredentials(): never {
    throw new Error("SECURITY_RESTRICTION: Only super-admin can generate user credentials. Tenant admins cannot create user accounts.");
  }

  /**
   * 🔄 Générer nouveau mot de passe temporaire (récupération)
   */
  static generateTemporaryPassword(): string {
    return this.generateSecurePassword();
  }

  /**
   * ✅ Valider la force d'un nouveau mot de passe utilisateur
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
    score: number; // 0-100
  } {
    const errors: string[] = [];
    let score = 0;
    
    // Longueur minimum
    if (password.length < 8) {
      errors.push("Le mot de passe doit contenir au moins 8 caractères");
    } else {
      score += 20;
    }
    
    // Caractères obligatoires
    if (!/[a-z]/.test(password)) {
      errors.push("Le mot de passe doit contenir au moins une minuscule");
    } else {
      score += 20;
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push("Le mot de passe doit contenir au moins une majuscule");
    } else {
      score += 20;
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push("Le mot de passe doit contenir au moins un chiffre");
    } else {
      score += 20;
    }
    
    if (!/[@#$%&*!?]/.test(password)) {
      errors.push("Le mot de passe doit contenir au moins un caractère spécial (@#$%&*!?)");
    } else {
      score += 20;
    }
    
    // Bonus pour longueur
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    
    return {
      isValid: errors.length === 0,
      errors,
      score
    };
  }

  /**
   * 🔐 Hasher un mot de passe avec bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    const bcrypt = require('bcrypt');
    return await bcrypt.hash(password, 12);
  }

  /**
   * 🔍 Vérifier un mot de passe hasher
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(password, hash);
  }
}

/**
 * 📧 Interface pour notifications d'identifiants
 */
export interface CredentialNotification {
  recipientEmail: string;
  recipientName?: string;
  username: string;
  temporaryPassword: string;
  loginUrl: string;
  expiresAt: Date;
  tenantName: string;
  isFirstLogin: boolean;
  securityInstructions: string[];
}

/**
 * Créer une notification d'identifiants pour envoi par email
 */
export function createCredentialNotification(
  credentials: SuperAdminUserCredentials,
  tenantName: string,
  loginUrl: string
): CredentialNotification {
  return {
    recipientEmail: credentials.email,
    recipientName: `${credentials.firstName} ${credentials.lastName}`,
    username: credentials.username,
    temporaryPassword: credentials.password,
    loginUrl,
    expiresAt: credentials.passwordExpiresAt,
    tenantName,
    isFirstLogin: true,
    securityInstructions: [
      "Connectez-vous immédiatement et changez votre mot de passe",
      "Ne partagez jamais vos identifiants",
      "Utilisez un mot de passe unique et fort",
      "Activez l'authentification à deux facteurs si disponible"
    ]
  };
}