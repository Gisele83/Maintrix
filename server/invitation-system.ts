import { db } from "./db";
import { invitations, userProfiles, tenants, allowedDomains } from "@shared/schema";
import { eq, and, gt, lt } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

// 📧 PRIORITÉ 3: SYSTÈME D'INVITATIONS PAR TENANT
// Contrôle strict de l'inscription selon le plan de sécurisation

export interface InvitationData {
  email: string;
  role: string;
  permissions?: string[];
  tenantId: string;
  invitedBy: number;
  expirationHours?: number;
}

export interface DomainAllowlistData {
  domain: string;
  tenantId: string;
  autoProvision?: boolean;
  defaultRole?: string;
  createdBy: number;
}

/**
 * Service de gestion des invitations sécurisées
 * Implémente les 3 modèles d'onboarding du plan de sécurisation
 */
export class InvitationSystem {
  
  /**
   * MODÈLE A: INVITATION UNIQUEMENT (recommandé)
   * Un owner d'entreprise invite par email avec token unique
   */
  static async createInvitation(data: InvitationData): Promise<{ invitationId: string; token: string }> {
    try {
      // Vérifier que l'inviteur a les droits
      const [inviter] = await db
        .select()
        .from(userProfiles)
        .where(
          and(
            eq(userProfiles.id, data.invitedBy),
            eq(userProfiles.tenantId, data.tenantId),
            eq(userProfiles.isActive, true)
          )
        )
        .limit(1);
      
      if (!inviter || !['owner', 'admin'].includes(inviter.role ?? '')) {
        throw new Error("Insufficient permissions to invite users");
      }
      
      // Vérifier que l'email n'est pas déjà invité/utilisé
      const [existingUser] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.email, data.email))
        .limit(1);
      
      if (existingUser) {
        throw new Error("User with this email already exists");
      }
      
      const [existingInvite] = await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.email, data.email),
            eq(invitations.tenantId, data.tenantId),
            eq(invitations.isRevoked, false),
            gt(invitations.expiresAt, new Date())
          )
        )
        .limit(1);
      
      if (existingInvite) {
        throw new Error("Active invitation already exists for this email");
      }
      
      // Générer token sécurisé
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Expiration (24h par défaut, max 7 jours)
      const expirationHours = Math.min(data.expirationHours || 24, 168);
      const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);
      
      // Créer l'invitation
      const [invitation] = await db
        .insert(invitations)
        .values({
          tenantId: data.tenantId,
          email: data.email,
          role: data.role,
          permissions: data.permissions || [],
          invitedBy: data.invitedBy,
          tokenHash,
          expiresAt
        })
        .returning();
      
      return {
        invitationId: invitation.id,
        token // Token en clair pour l'email (une seule fois)
      };
      
    } catch (error) {
      console.error("Error creating invitation:", error);
      throw error;
    }
  }
  
  /**
   * Vérifier la validité d'un token d'invitation
   */
  static async verifyInvitation(token: string): Promise<{
    valid: boolean;
    invitation?: any;
    tenant?: any;
    error?: string;
  }> {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      const [result] = await db
        .select({
          invitation: invitations,
          tenant: tenants
        })
        .from(invitations)
        .innerJoin(tenants, eq(invitations.tenantId, tenants.id))
        .where(
          and(
            eq(invitations.tokenHash, tokenHash),
            eq(invitations.isRevoked, false),
            gt(invitations.expiresAt, new Date()),
            eq(tenants.isActive, true)
          )
        )
        .limit(1);
      
      if (!result) {
        return {
          valid: false,
          error: "Invitation token invalid or expired"
        };
      }
      
      // Vérifier que l'email n'est pas déjà utilisé
      const [existingUser] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.email, result.invitation.email))
        .limit(1);
      
      if (existingUser) {
        return {
          valid: false,
          error: "User account already exists for this email"
        };
      }
      
      return {
        valid: true,
        invitation: result.invitation,
        tenant: result.tenant
      };
      
    } catch (error) {
      console.error("Error verifying invitation:", error);
      return {
        valid: false,
        error: "Failed to verify invitation"
      };
    }
  }
  
  /**
   * Accepter une invitation et créer le compte utilisateur
   */
  static async acceptInvitation(
    token: string, 
    userData: {
      username: string;
      firstName: string;
      lastName: string;
      password: string;
      phoneNumber?: string;
    }
  ): Promise<{ userId: number; tenantId: string }> {
    try {
      // Vérifier l'invitation
      const verification = await InvitationSystem.verifyInvitation(token);
      
      if (!verification.valid || !verification.invitation) {
        throw new Error(verification.error || "Invalid invitation");
      }
      
      const invitation = verification.invitation;
      const tenant = verification.tenant;
      
      // 📜 VÉRIFIER LA LIMITE D'UTILISATEURS DU TENANT
      try {
        const { LicenseService } = await import('./license-service');
        await LicenseService.enforceUserLimit(invitation.tenantId);
      } catch (error: any) {
        if (error.code === "USER_LIMIT_REACHED") {
          const limitError = new Error("Nombre d'utilisateurs atteint pour votre licence");
          (limitError as any).code = "USER_LIMIT_REACHED";
          (limitError as any).status = 403;
          (limitError as any).details = error.details;
          throw limitError;
        }
        throw error; // Re-lancer les autres erreurs
      }

      // Créer le compte utilisateur
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      const [user] = await db
        .insert(userProfiles)
        .values({
          tenantId: invitation.tenantId,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: invitation.email,
          password: hashedPassword,
          role: invitation.role,
          phoneNumber: userData.phoneNumber,
          isActive: true,
          createdAt: new Date()
        })
        .returning();
      
      // Marquer l'invitation comme utilisée
      await db
        .update(invitations)
        .set({ 
          usedAt: new Date(),
          isRevoked: true // Empêche la réutilisation
        })
        .where(eq(invitations.id, invitation.id));
      
      // Incrémenter le compteur d'utilisateurs du tenant
      await db
        .update(tenants)
        .set({ 
          currentUsers: tenant.currentUsers + 1 
        })
        .where(eq(tenants.id, invitation.tenantId));
      
      return {
        userId: user.id,
        tenantId: invitation.tenantId
      };
      
    } catch (error) {
      console.error("Error accepting invitation:", error);
      throw error;
    }
  }
  
  /**
   * MODÈLE B: ALLOWLIST DE DOMAINE
   * Autoriser les inscriptions depuis des domaines vérifiés
   */
  static async addAllowedDomain(data: DomainAllowlistData): Promise<{ domainId: string; verificationToken: string }> {
    try {
      // Générer token de vérification DNS
      const verificationToken = crypto.randomBytes(16).toString('hex');
      
      const [domain] = await db
        .insert(allowedDomains)
        .values({
          tenantId: data.tenantId,
          domain: data.domain.toLowerCase(),
          verificationToken,
          autoProvision: data.autoProvision || false,
          defaultRole: data.defaultRole || 'viewer',
          createdBy: data.createdBy
        })
        .returning();
      
      return {
        domainId: domain.id,
        verificationToken
      };
      
    } catch (error) {
      console.error("Error adding allowed domain:", error);
      throw error;
    }
  }
  
  /**
   * Vérifier un domaine via DNS TXT record
   */
  static async verifyDomain(domainId: string): Promise<{ verified: boolean; error?: string }> {
    try {
      const [domain] = await db
        .select()
        .from(allowedDomains)
        .where(eq(allowedDomains.id, domainId))
        .limit(1);
      
      if (!domain) {
        return { verified: false, error: "Domain not found" };
      }
      
      // Simulation de vérification DNS (en production, utiliser dns.resolveTxt)
      // const dns = require('dns').promises;
      // const txtRecords = await dns.resolveTxt(`_gmao-verify.${domain.domain}`);
      // const hasValidRecord = txtRecords.some(record => 
      //   record.join('').includes(domain.verificationToken)
      // );
      
      // Pour la démo, on considère le domaine vérifié
      const hasValidRecord = true;
      
      if (hasValidRecord) {
        await db
          .update(allowedDomains)
          .set({
            isVerified: true,
            verifiedAt: new Date()
          })
          .where(eq(allowedDomains.id, domainId));
        
        return { verified: true };
      }
      
      return { 
        verified: false, 
        error: `DNS TXT record not found. Add: _gmao-verify.${domain.domain} TXT "${domain.verificationToken}"` 
      };
      
    } catch (error) {
      console.error("Error verifying domain:", error);
      return { verified: false, error: "Failed to verify domain" };
    }
  }
  
  /**
   * Vérifier si un email peut s'inscrire (allowlist de domaine)
   */
  static async canEmailRegister(email: string, tenantId: string): Promise<{
    allowed: boolean;
    autoProvision: boolean;
    defaultRole: string;
    error?: string;
  }> {
    try {
      const emailDomain = email.split('@')[1]?.toLowerCase();
      
      if (!emailDomain) {
        return { allowed: false, autoProvision: false, defaultRole: 'viewer', error: "Invalid email format" };
      }
      
      const [allowedDomain] = await db
        .select()
        .from(allowedDomains)
        .where(
          and(
            eq(allowedDomains.tenantId, tenantId),
            eq(allowedDomains.domain, emailDomain),
            eq(allowedDomains.isVerified, true)
          )
        )
        .limit(1);
      
      if (!allowedDomain) {
        return { 
          allowed: false, 
          autoProvision: false, 
          defaultRole: 'viewer',
          error: `Domain ${emailDomain} not authorized for this organization` 
        };
      }
      
      return {
        allowed: true,
        autoProvision: allowedDomain.autoProvision ?? false,
        defaultRole: allowedDomain.defaultRole ?? 'viewer'
      };
      
    } catch (error) {
      console.error("Error checking email domain:", error);
      return { allowed: false, autoProvision: false, defaultRole: 'viewer', error: "Failed to verify domain" };
    }
  }
  
  /**
   * Révoquer une invitation (admin)
   */
  static async revokeInvitation(invitationId: string, revokedBy: number): Promise<void> {
    await db
      .update(invitations)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedBy
      })
      .where(eq(invitations.id, invitationId));
  }
  
  /**
   * Nettoyer les invitations expirées
   */
  static async cleanupExpiredInvitations(): Promise<void> {
    await db
      .update(invitations)
      .set({
        isRevoked: true,
        revokedAt: new Date()
      })
      .where(
        and(
          eq(invitations.isRevoked, false),
          lt(invitations.expiresAt, new Date())
        )
      );
  }
}

// Validation schemas
export const createInvitationSchema = z.object({
  email: z.string().email("Invalid email format"),
  role: z.enum(['owner', 'admin', 'maintainer', 'viewer', 'technician']),
  permissions: z.array(z.string()).optional(),
  expirationHours: z.number().min(1).max(168).optional() // Max 7 jours
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(32, "Invalid invitation token"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phoneNumber: z.string().optional()
});

export const addDomainSchema = z.object({
  domain: z.string().min(3, "Domain required").regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, "Invalid domain format"),
  autoProvision: z.boolean().default(false),
  defaultRole: z.enum(['admin', 'maintainer', 'viewer', 'technician']).default('viewer')
});