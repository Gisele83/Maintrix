import { Router, Request, Response } from "express";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { 
  InvitationSystem, 
  createInvitationSchema, 
  acceptInvitationSchema, 
  addDomainSchema 
} from "./invitation-system";
import { userSessions, userProfiles, invitations } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { CredentialGenerator } from "./credential-generator";
import { sendTenantCredentials } from "./email-service";
import { z } from "zod";

/**
 * 🔒 ROUTES D'AUTHENTIFICATION ENTERPRISE SÉCURISÉE
 * Implémente les priorités 1-3 du plan de sécurisation
 */

const router = Router();

// 📧 PRIORITÉ 3: GESTION DES INVITATIONS

/**
 * Créer une invitation (Admin/Owner uniquement)
 */
router.post('/invitations/create', 
  EnterpriseAuthMiddleware.requireAuthentication,
  EnterpriseAuthMiddleware.rateLimitByTenant('/api/enterprise-auth/invitations/create', {
    requests: 10,
    windowMs: 60 * 60 * 1000, // 1 heure
    blockDurationMs: 15 * 60 * 1000 // 15 minutes
  }),
  async (req: any, res: Response) => {
    try {
      // Validation des données
      const validatedData = createInvitationSchema.parse(req.body);
      
      // Créer l'invitation
      const { invitationId, token } = await InvitationSystem.createInvitation({
        ...validatedData,
        tenantId: req.tenantId,
        invitedBy: req.user.id
      });
      
      // Dans un vrai système, on enverrait l'email ici
      // await emailService.sendInvitation(validatedData.email, token, req.tenantData);
      
      res.status(201).json({
        success: true,
        invitationId,
        message: `Invitation sent to ${validatedData.email}`,
        // En production, ne pas retourner le token !
        invitationLink: `${process.env.FRONTEND_URL}/auth/accept-invitation?token=${token}`
      });
      
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      res.status(400).json({
        error: "INVITATION_CREATION_FAILED",
        message: error.message || "Failed to create invitation"
      });
    }
  }
);

// 📝 SCHÉMA D'INSCRIPTION PUBLIQUE
const registerSchema = z.object({
  username: z.string().min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères"),
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  department: z.string().optional(),
  role: z.string().default("technician"),
});

/**
 * 🆕 INSCRIPTION PUBLIQUE (sans invitation)
 */
router.post('/register',
  EnterpriseAuthMiddleware.rateLimitByTenant('/api/enterprise-auth/register', {
    requests: 10,
    windowMs: 60 * 60 * 1000, // 1 heure
    blockDurationMs: 15 * 60 * 1000 // 15 minutes
  }),
  async (req: Request, res: Response) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      // Vérifier si l'email existe déjà
      const [existingUser] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.email, validatedData.email));

      if (existingUser) {
        return res.status(400).json({
          error: "EMAIL_ALREADY_EXISTS",
          message: "Un utilisateur avec cet email existe déjà"
        });
      }

      // Vérifier si le nom d'utilisateur existe déjà
      const [existingUsername] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.username, validatedData.username));

      if (existingUsername) {
        return res.status(400).json({
          error: "USERNAME_ALREADY_EXISTS",
          message: "Ce nom d'utilisateur est déjà pris"
        });
      }

      // Hacher le mot de passe
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);

      // Créer l'utilisateur
      const [newUser] = await db
        .insert(userProfiles)
        .values({
          username: validatedData.username,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          email: validatedData.email,
          password: hashedPassword,
          role: validatedData.role,
          department: validatedData.department,
          tenantId: 'default-tenant', // Assigner au tenant par défaut
          isDefaultCredentials: false,
          mustChangePassword: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning({
          id: userProfiles.id,
          username: userProfiles.username,
          email: userProfiles.email,
          role: userProfiles.role,
          firstName: userProfiles.firstName,
          lastName: userProfiles.lastName
        });

      console.log(`✅ Nouvel utilisateur inscrit: ${newUser.username} (${newUser.email})`);

      res.status(201).json({
        success: true,
        message: "Compte créé avec succès",
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          firstName: newUser.firstName,
          lastName: newUser.lastName
        }
      });

    } catch (error: any) {
      console.error("Error during registration:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Données d'inscription invalides",
          details: error.errors
        });
      }

      res.status(500).json({
        error: "REGISTRATION_ERROR",
        message: "Erreur lors de la création du compte"
      });
    }
  }
);

/**
 * Vérifier un token d'invitation
 */
router.get('/invitations/verify/:token', 
  EnterpriseAuthMiddleware.rateLimitByTenant('/api/enterprise-auth/invitations/verify', {
    requests: 20,
    windowMs: 60 * 60 * 1000, // 1 heure
    blockDurationMs: 5 * 60 * 1000 // 5 minutes
  }),
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      const verification = await InvitationSystem.verifyInvitation(token);
      
      if (!verification.valid) {
        return res.status(400).json({
          error: "INVITATION_INVALID",
          message: verification.error
        });
      }
      
      res.json({
        valid: true,
        invitation: {
          email: verification.invitation.email,
          role: verification.invitation.role,
          organizationName: verification.tenant.name,
          expiresAt: verification.invitation.expiresAt
        }
      });
      
    } catch (error) {
      console.error("Error verifying invitation:", error);
      res.status(500).json({
        error: "INVITATION_VERIFICATION_ERROR",
        message: "Failed to verify invitation"
      });
    }
  }
);

/**
 * Accepter une invitation et créer le compte
 */
router.post('/invitations/accept', 
  EnterpriseAuthMiddleware.rateLimitByTenant('/api/enterprise-auth/invitations/accept', {
    requests: 5,
    windowMs: 60 * 60 * 1000, // 1 heure
    blockDurationMs: 30 * 60 * 1000 // 30 minutes
  }),
  async (req: Request, res: Response) => {
    try {
      const validatedData = acceptInvitationSchema.parse(req.body);
      
      const { userId, tenantId } = await InvitationSystem.acceptInvitation(
        validatedData.token,
        {
          username: validatedData.username,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          password: validatedData.password,
          phoneNumber: validatedData.phoneNumber
        }
      );
      
      // Créer une session automatiquement
      const sessionToken = crypto.randomBytes(64).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
      
      await db.insert(userSessions).values({
        userId,
        tenantId,
        sessionToken,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        expiresAt
      });
      
      res.status(201).json({
        success: true,
        message: "Account created and activated successfully",
        sessionToken,
        user: {
          id: userId,
          tenantId
        }
      });
      
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      res.status(400).json({
        error: "INVITATION_ACCEPTANCE_FAILED",
        message: error.message || "Failed to accept invitation"
      });
    }
  }
);

// 🌐 MODÈLE B: GESTION DES DOMAINES AUTORISÉS

/**
 * Ajouter un domaine à la allowlist (Admin/Owner)
 */
router.post('/domains/add',
  EnterpriseAuthMiddleware.requireAuthentication,
  async (req: any, res: Response) => {
    try {
      if (!['owner', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          error: "INSUFFICIENT_PERMISSIONS",
          message: "Only owners and admins can manage domain allowlist"
        });
      }
      
      const validatedData = addDomainSchema.parse(req.body);
      
      const { domainId, verificationToken } = await InvitationSystem.addAllowedDomain({
        ...validatedData,
        tenantId: req.tenantId,
        createdBy: req.user.id
      });
      
      res.status(201).json({
        success: true,
        domainId,
        verificationInstructions: {
          message: "Add this DNS TXT record to verify domain ownership",
          recordName: `_gmao-verify.${validatedData.domain}`,
          recordValue: verificationToken,
          ttl: 300
        }
      });
      
    } catch (error: any) {
      console.error("Error adding domain:", error);
      res.status(400).json({
        error: "DOMAIN_ADD_FAILED",
        message: error.message || "Failed to add domain"
      });
    }
  }
);

/**
 * Vérifier un domaine (DNS TXT)
 */
router.post('/domains/:domainId/verify',
  EnterpriseAuthMiddleware.requireAuthentication,
  async (req: any, res: Response) => {
    try {
      const { domainId } = req.params;
      
      const result = await InvitationSystem.verifyDomain(domainId);
      
      if (result.verified) {
        res.json({
          success: true,
          message: "Domain verified successfully",
          verified: true
        });
      } else {
        res.status(400).json({
          error: "DOMAIN_VERIFICATION_FAILED",
          message: result.error,
          verified: false
        });
      }
      
    } catch (error) {
      console.error("Error verifying domain:", error);
      res.status(500).json({
        error: "DOMAIN_VERIFICATION_ERROR",
        message: "Failed to verify domain"
      });
    }
  }
);

// 🔐 GESTION DES SESSIONS ENTERPRISE

/**
 * Login sécurisé avec création de session
 */
router.post('/login',
  EnterpriseAuthMiddleware.rateLimitByTenant('/api/enterprise-auth/login', {
    requests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 30 * 60 * 1000 // 30 minutes (bruteforce protection)
  }),
  async (req: Request, res: Response) => {
    try {
      const { email, password, tenantId } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          error: "CREDENTIALS_REQUIRED",
          message: "Email and password required"
        });
      }
      
      // Chercher l'utilisateur
      const [user] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.email, email))
        .limit(1);
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          error: "INVALID_CREDENTIALS",
          message: "Invalid email or password"
        });
      }
      
      // Vérifier le tenant si fourni
      if (tenantId && user.tenantId !== tenantId) {
        return res.status(401).json({
          error: "TENANT_MISMATCH",
          message: "User not authorized for this organization"
        });
      }
      
      // Vérifier le mot de passe
      const passwordMatch = await bcrypt.compare(password, user.password || '');
      if (!passwordMatch) {
        return res.status(401).json({
          error: "INVALID_CREDENTIALS",
          message: "Invalid email or password"
        });
      }
      
      // Créer une session sécurisée
      const sessionToken = crypto.randomBytes(64).toString('hex');
      const refreshToken = crypto.randomBytes(64).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
      
      const [session] = await db.insert(userSessions).values({
        userId: user.id,
        tenantId: user.tenantId || 'default-tenant',
        sessionToken,
        refreshToken,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        expiresAt
      }).returning();
      
      // Mettre à jour le dernier login
      await db
        .update(userProfiles)
        .set({ lastLogin: new Date() })
        .where(eq(userProfiles.id, user.id));
      
      // Configuration cookie sécurisé
      res.cookie('sessionToken', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
      });
      
      res.json({
        success: true,
        sessionToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId
        },
        expiresAt
      });
      
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        error: "LOGIN_ERROR",
        message: "Login failed"
      });
    }
  }
);

/**
 * Logout sécurisé (révocation de session)
 */
router.post('/logout',
  EnterpriseAuthMiddleware.requireAuthentication,
  async (req: any, res: Response) => {
    try {
      if (req.sessionId) {
        await EnterpriseAuthMiddleware.revokeSession(req.sessionId, 'logout');
      }
      
      res.clearCookie('sessionToken');
      
      res.json({
        success: true,
        message: "Logged out successfully"
      });
      
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        error: "LOGOUT_ERROR",
        message: "Failed to logout"
      });
    }
  }
);

/**
 * Refresh token
 */
router.post('/refresh',
  EnterpriseAuthMiddleware.rateLimitByTenant('/api/enterprise-auth/refresh', {
    requests: 10,
    windowMs: 60 * 60 * 1000, // 1 heure
    blockDurationMs: 10 * 60 * 1000 // 10 minutes
  }),
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          error: "REFRESH_TOKEN_REQUIRED",
          message: "Refresh token required"
        });
      }
      
      // Chercher la session avec le refresh token
      const [session] = await db
        .select()
        .from(userSessions)
        .where(
          eq(userSessions.refreshToken, refreshToken)
        )
        .limit(1);
      
      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return res.status(401).json({
          error: "INVALID_REFRESH_TOKEN",
          message: "Invalid or expired refresh token"
        });
      }
      
      // Générer nouveaux tokens
      const newSessionToken = crypto.randomBytes(64).toString('hex');
      const newRefreshToken = crypto.randomBytes(64).toString('hex');
      const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      await db
        .update(userSessions)
        .set({
          sessionToken: newSessionToken,
          refreshToken: newRefreshToken,
          expiresAt: newExpiresAt,
          lastActivityAt: new Date()
        })
        .where(eq(userSessions.id, session.id));
      
      res.json({
        success: true,
        sessionToken: newSessionToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt
      });
      
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(500).json({
        error: "TOKEN_REFRESH_ERROR",
        message: "Failed to refresh token"
      });
    }
  }
);

// 📊 ROUTES D'ADMINISTRATION

/**
 * Lister les invitations (Admin)
 */
router.get('/admin/invitations',
  EnterpriseAuthMiddleware.requireAuthentication,
  async (req: any, res: Response) => {
    try {
      if (!['owner', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          error: "INSUFFICIENT_PERMISSIONS",
          message: "Admin access required"
        });
      }
      
      const invitationList = await db
        .select()
        .from(invitations)
        .where(eq(invitations.tenantId, req.tenantId));
      
      res.json({
        success: true,
        invitations: invitationList.map((inv: any) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          isRevoked: inv.isRevoked,
          usedAt: inv.usedAt,
          expiresAt: inv.expiresAt,
          createdAt: inv.createdAt
        }))
      });
      
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({
        error: "FETCH_INVITATIONS_ERROR",
        message: "Failed to fetch invitations"
      });
    }
  }
);

/**
 * Révoquer une invitation (Admin)
 */
router.delete('/admin/invitations/:invitationId',
  EnterpriseAuthMiddleware.requireAuthentication,
  async (req: any, res: Response) => {
    try {
      if (!['owner', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          error: "INSUFFICIENT_PERMISSIONS",
          message: "Admin access required"
        });
      }
      
      const { invitationId } = req.params;
      
      await InvitationSystem.revokeInvitation(invitationId, req.user.id);
      
      res.json({
        success: true,
        message: "Invitation revoked successfully"
      });
      
    } catch (error) {
      console.error("Error revoking invitation:", error);
      res.status(500).json({
        error: "REVOKE_INVITATION_ERROR",
        message: "Failed to revoke invitation"
      });
    }
  }
);

// 🔐 GESTION DES IDENTIFIANTS PAR DÉFAUT ET CHANGEMENT OBLIGATOIRE

/**
 * Schéma de validation pour changement de mot de passe obligatoire
 */
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string().min(1, "Confirmation du mot de passe requise"),
  newUsername: z.string().min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères").optional()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"]
});

/**
 * 🔒 Vérifier si l'utilisateur doit changer son mot de passe
 */
router.get('/must-change-password',
  EnterpriseAuthMiddleware.requireAuthentication,
  async (req: any, res: Response) => {
    try {
      // Récupérer les informations utilisateur avec flags de sécurité
      const [user] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.id, req.user.id));

      if (!user) {
        return res.status(404).json({
          error: "USER_NOT_FOUND",
          message: "Utilisateur introuvable"
        });
      }

      // Vérifier les conditions pour changement obligatoire
      const mustChangePassword = 
        user.isDefaultCredentials === true ||
        (user.passwordExpiresAt && new Date() > user.passwordExpiresAt) ||
        user.mustChangePassword === true;

      res.json({
        mustChangePassword,
        isDefaultCredentials: user.isDefaultCredentials || false,
        passwordExpiresAt: user.passwordExpiresAt?.toISOString(),
        username: user.username,
        email: user.email,
        canChangeUsername: user.isDefaultCredentials === true // Permet changement username seulement pour identifiants par défaut
      });

    } catch (error) {
      console.error("Error checking password change requirement:", error);
      res.status(500).json({
        error: "PASSWORD_CHECK_ERROR",
        message: "Erreur lors de la vérification du changement de mot de passe"
      });
    }
  }
);

/**
 * 🔄 Changer mot de passe (et optionnellement username) pour identifiants par défaut
 */
router.post('/change-credentials',
  EnterpriseAuthMiddleware.requireAuthentication,
  EnterpriseAuthMiddleware.rateLimitByTenant('/api/enterprise-auth/change-credentials', {
    requests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 5 * 60 * 1000 // 5 minutes de blocage
  }),
  async (req: any, res: Response) => {
    try {
      const validatedData = changePasswordSchema.parse(req.body);
      
      // Récupérer l'utilisateur actuel
      const [user] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.id, req.user.id));

      if (!user) {
        return res.status(404).json({
          error: "USER_NOT_FOUND",
          message: "Utilisateur introuvable"
        });
      }

      // Vérifier le mot de passe actuel
      const isCurrentPasswordValid = await CredentialGenerator.verifyPassword(
        validatedData.currentPassword,
        user.password || ""
      );

      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          error: "INVALID_CURRENT_PASSWORD",
          message: "Mot de passe actuel incorrect"
        });
      }

      // Valider la force du nouveau mot de passe
      const passwordValidation = CredentialGenerator.validatePasswordStrength(validatedData.newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: "WEAK_PASSWORD",
          message: "Mot de passe trop faible",
          requirements: passwordValidation.errors
        });
      }

      // Vérifier unicité du nouveau nom d'utilisateur si fourni
      if (validatedData.newUsername && validatedData.newUsername !== user.username) {
        const [existingUser] = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.username, validatedData.newUsername));

        if (existingUser) {
          return res.status(400).json({
            error: "USERNAME_ALREADY_EXISTS",
            message: "Ce nom d'utilisateur est déjà utilisé"
          });
        }
      }

      // Hasher le nouveau mot de passe
      const hashedNewPassword = await CredentialGenerator.hashPassword(validatedData.newPassword);

      // Mettre à jour les identifiants
      const updateData: any = {
        password: hashedNewPassword,
        mustChangePassword: false,
        isDefaultCredentials: false,
        passwordExpiresAt: null,
        lastPasswordChange: new Date(),
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        updatedAt: new Date()
      };

      // Ajouter le nouveau username si fourni et autorisé
      if (validatedData.newUsername && user.isDefaultCredentials) {
        updateData.username = validatedData.newUsername;
      }

      const [updatedUser] = await db
        .update(userProfiles)
        .set(updateData)
        .where(eq(userProfiles.id, req.user.id))
        .returning({
          id: userProfiles.id,
          username: userProfiles.username,
          email: userProfiles.email,
          role: userProfiles.role,
          mustChangePassword: userProfiles.mustChangePassword,
          isDefaultCredentials: userProfiles.isDefaultCredentials
        });

      console.log(`✅ Identifiants mis à jour pour utilisateur ${updatedUser.id} (${updatedUser.username})`);

      res.json({
        success: true,
        message: "Identifiants mis à jour avec succès",
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          mustChangePassword: false,
          passwordScore: passwordValidation.score
        }
      });

    } catch (error: any) {
      console.error("Error changing credentials:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Données invalides",
          details: error.errors
        });
      }

      res.status(500).json({
        error: "CREDENTIAL_CHANGE_ERROR",
        message: "Erreur lors du changement d'identifiants"
      });
    }
  }
);

// 👥 GESTION DES UTILISATEURS PAR LES ADMINISTRATEURS DE TENANTS

/**
 * Schéma de validation pour création d'utilisateur avec identifiants par défaut
 */
const createUserSchema = z.object({
  email: z.string().email("Email invalide"),
  role: z.enum(['user', 'admin'], {
    errorMap: () => ({ message: "Le rôle doit être 'user' ou 'admin'" })
  }),
  firstName: z.string().min(1, "Prénom requis").optional(),
  lastName: z.string().min(1, "Nom requis").optional(),
  department: z.string().optional(),
  position: z.string().optional()
});

/**
 * 👥 Créer un utilisateur avec identifiants par défaut (Admin/Owner uniquement)
 */
router.post('/admin/create-user',
  EnterpriseAuthMiddleware.requireAuthentication,
  EnterpriseAuthMiddleware.rateLimitByTenant('/api/enterprise-auth/admin/create-user', {
    requests: 10,
    windowMs: 60 * 60 * 1000, // 1 heure
    blockDurationMs: 15 * 60 * 1000 // 15 minutes
  }),
  async (req: any, res: Response) => {
    try {
      // Vérifier les permissions (seuls les admin et owner peuvent créer des utilisateurs)
      if (!['owner', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          error: "INSUFFICIENT_PERMISSIONS",
          message: "Seuls les administrateurs peuvent créer des utilisateurs"
        });
      }

      const validatedData = createUserSchema.parse(req.body);
      
      // Vérifier si l'email existe déjà
      const [existingUser] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.email, validatedData.email));

      if (existingUser) {
        return res.status(400).json({
          error: "EMAIL_ALREADY_EXISTS",
          message: "Un utilisateur avec cet email existe déjà"
        });
      }

      // Générer identifiants par défaut
      const defaultCredentials = CredentialGenerator.generateTenantUserCredentials(
        validatedData.role,
        validatedData.email,
        req.tenantId
      );

      // Créer l'utilisateur avec identifiants par défaut
      const [newUser] = await db
        .insert(userProfiles)
        .values({
          username: defaultCredentials.username,
          email: validatedData.email,
          password: await CredentialGenerator.hashPassword(defaultCredentials.password),
          role: validatedData.role,
          tenantId: req.tenantId,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          department: validatedData.department,
          isDefaultCredentials: true,
          mustChangePassword: true,
          passwordExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours pour changer
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning({
          id: userProfiles.id,
          username: userProfiles.username,
          email: userProfiles.email,
          role: userProfiles.role,
          firstName: userProfiles.firstName,
          lastName: userProfiles.lastName
        });

      console.log(`✅ Utilisateur créé avec identifiants par défaut: ${newUser.username} (${newUser.email})`);

      // TODO: Créer la notification d'identifiants si nécessaire
      const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/login`;

      // TODO: Envoyer l'email avec les identifiants
      // const emailSent = await sendTenantCredentials(credentialNotification);

      res.status(201).json({
        success: true,
        message: "Utilisateur créé avec succès",
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          mustChangePassword: true,
          isDefaultCredentials: true
        },
        credentials: {
          // En production, ne retourner que le username
          username: defaultCredentials.username,
          temporaryPassword: defaultCredentials.password, // À enlever en production
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        instructions: [
          "L'utilisateur doit se connecter et changer son mot de passe sous 7 jours",
          "Un email avec les identifiants a été envoyé à l'utilisateur",
          "Le compte sera automatiquement désactivé si le mot de passe n'est pas changé"
        ]
      });

    } catch (error: any) {
      console.error("Error creating user with default credentials:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Données invalides",
          details: error.errors
        });
      }

      res.status(500).json({
        error: "USER_CREATION_ERROR",
        message: "Erreur lors de la création de l'utilisateur"
      });
    }
  }
);

/**
 * 👥 Lister tous les utilisateurs du tenant (Admin/Owner uniquement)
 */
router.get('/admin/users',
  EnterpriseAuthMiddleware.requireAuthentication,
  async (req: any, res: Response) => {
    try {
      if (!['owner', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          error: "INSUFFICIENT_PERMISSIONS",
          message: "Accès réservé aux administrateurs"
        });
      }

      const users = await db
        .select({
          id: userProfiles.id,
          username: userProfiles.username,
          email: userProfiles.email,
          role: userProfiles.role,
          firstName: userProfiles.firstName,
          lastName: userProfiles.lastName,
          department: userProfiles.department,
          isDefaultCredentials: userProfiles.isDefaultCredentials,
          mustChangePassword: userProfiles.mustChangePassword,
          lastLogin: userProfiles.lastLogin,
          passwordExpiresAt: userProfiles.passwordExpiresAt,
          createdAt: userProfiles.createdAt
        })
        .from(userProfiles)
        .where(eq(userProfiles.tenantId, req.tenantId || ''));

      res.json({
        success: true,
        users: users.map(user => ({
          ...user,
          needsPasswordChange: user.mustChangePassword || user.isDefaultCredentials,
          passwordExpired: user.passwordExpiresAt ? new Date() > user.passwordExpiresAt : false
        }))
      });

    } catch (error) {
      console.error("Error fetching tenant users:", error);
      res.status(500).json({
        error: "FETCH_USERS_ERROR",
        message: "Erreur lors de la récupération des utilisateurs"
      });
    }
  }
);

// 🔄 RÉINITIALISATION DE MOT DE PASSE

/**
 * Schéma de validation pour demande de réinitialisation
 */
const forgotPasswordSchema = z.object({
  email: z.string().email("Email invalide")
});

/**
 * Schéma de validation pour nouvelle réinitialisation
 */
const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requis"),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string().min(1, "Confirmation du mot de passe requise")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"]
});

/**
 * 📧 Demander une réinitialisation de mot de passe
 */
router.post('/forgot-password',
  EnterpriseAuthMiddleware.rateLimitByTenant('/api/enterprise-auth/forgot-password', {
    requests: 3, // Limite stricte pour éviter le spam
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 60 * 60 * 1000 // 1 heure de blocage
  }),
  async (req: Request, res: Response) => {
    try {
      const validatedData = forgotPasswordSchema.parse(req.body);
      
      // Rechercher l'utilisateur par email
      const [user] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.email, validatedData.email));

      // Toujours retourner succès pour éviter l'énumération d'emails
      if (!user) {
        console.log(`🔍 Tentative de réinitialisation pour email inexistant: ${validatedData.email}`);
        return res.json({
          success: true,
          message: "Si cet email existe, un lien de réinitialisation a été envoyé"
        });
      }

      // Vérifier que le compte est actif
      if (!user.isActive) {
        console.log(`🚫 Tentative de réinitialisation pour compte désactivé: ${user.email}`);
        return res.json({
          success: true,
          message: "Si cet email existe, un lien de réinitialisation a été envoyé"
        });
      }

      // Générer un token de réinitialisation sécurisé
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

      // Sauvegarder le token dans la base de données
      await db
        .update(userProfiles)
        .set({
          passwordResetToken: resetToken,
          passwordResetTokenExpiresAt: resetTokenExpiry,
          passwordResetRequestedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(userProfiles.id, user.id));

      // Créer le lien de réinitialisation
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;

      // Envoyer l'email de réinitialisation
      const emailSent = await sendPasswordResetEmail({
        recipientEmail: user.email,
        recipientName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
        resetUrl,
        expiresAt: resetTokenExpiry,
        userAgent: req.get('User-Agent') || 'Navigateur inconnu',
        ipAddress: req.ip || 'IP inconnue'
      });

      if (emailSent) {
        console.log(`✅ Email de réinitialisation envoyé à ${user.email}`);
      } else {
        console.error(`❌ Échec envoi email de réinitialisation à ${user.email}`);
      }

      res.json({
        success: true,
        message: "Si cet email existe, un lien de réinitialisation a été envoyé",
        expiresIn: "1 heure"
      });

    } catch (error: any) {
      console.error("Error processing forgot password request:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Email invalide",
          details: error.errors
        });
      }

      res.status(500).json({
        error: "FORGOT_PASSWORD_ERROR",
        message: "Erreur lors du traitement de la demande"
      });
    }
  }
);

/**
 * 🔍 Vérifier la validité d'un token de réinitialisation
 */
router.get('/reset-password/verify/:token',
  EnterpriseAuthMiddleware.rateLimitByTenant('/api/enterprise-auth/reset-password/verify', {
    requests: 10,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 5 * 60 * 1000
  }),
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          error: "INVALID_TOKEN",
          message: "Token manquant"
        });
      }

      // Rechercher l'utilisateur avec ce token
      const [user] = await db
        .select({
          id: userProfiles.id,
          email: userProfiles.email,
          username: userProfiles.username,
          firstName: userProfiles.firstName,
          lastName: userProfiles.lastName,
          passwordResetTokenExpiresAt: userProfiles.passwordResetTokenExpiresAt,
          isActive: userProfiles.isActive
        })
        .from(userProfiles)
        .where(eq(userProfiles.passwordResetToken, token));

      if (!user) {
        return res.status(400).json({
          error: "INVALID_TOKEN",
          message: "Token de réinitialisation invalide"
        });
      }

      // Vérifier l'expiration
      if (!user.passwordResetTokenExpiresAt || new Date() > user.passwordResetTokenExpiresAt) {
        return res.status(400).json({
          error: "EXPIRED_TOKEN",
          message: "Le token de réinitialisation a expiré"
        });
      }

      // Vérifier que le compte est actif
      if (!user.isActive) {
        return res.status(400).json({
          error: "ACCOUNT_DISABLED",
          message: "Ce compte est désactivé"
        });
      }

      res.json({
        valid: true,
        user: {
          email: user.email,
          username: user.username,
          displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username
        },
        expiresAt: user.passwordResetTokenExpiresAt.toISOString()
      });

    } catch (error) {
      console.error("Error verifying reset token:", error);
      res.status(500).json({
        error: "TOKEN_VERIFICATION_ERROR",
        message: "Erreur lors de la vérification du token"
      });
    }
  }
);

/**
 * 🔄 Effectuer la réinitialisation du mot de passe
 */
router.post('/reset-password',
  EnterpriseAuthMiddleware.rateLimitByTenant('/api/enterprise-auth/reset-password', {
    requests: 5,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 30 * 60 * 1000 // 30 minutes de blocage
  }),
  async (req: Request, res: Response) => {
    try {
      const validatedData = resetPasswordSchema.parse(req.body);
      
      // Rechercher l'utilisateur avec ce token
      const [user] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.passwordResetToken, validatedData.token));

      if (!user) {
        return res.status(400).json({
          error: "INVALID_TOKEN",
          message: "Token de réinitialisation invalide"
        });
      }

      // Vérifier l'expiration
      if (!user.passwordResetTokenExpiresAt || new Date() > user.passwordResetTokenExpiresAt) {
        return res.status(400).json({
          error: "EXPIRED_TOKEN",
          message: "Le token de réinitialisation a expiré"
        });
      }

      // Vérifier que le compte est actif
      if (!user.isActive) {
        return res.status(400).json({
          error: "ACCOUNT_DISABLED",
          message: "Ce compte est désactivé"
        });
      }

      // Valider la force du nouveau mot de passe
      const passwordValidation = CredentialGenerator.validatePasswordStrength(validatedData.newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: "WEAK_PASSWORD",
          message: "Mot de passe trop faible",
          requirements: passwordValidation.errors
        });
      }

      // Hasher le nouveau mot de passe
      const hashedNewPassword = await CredentialGenerator.hashPassword(validatedData.newPassword);

      // Mettre à jour le mot de passe et nettoyer les tokens
      await db
        .update(userProfiles)
        .set({
          password: hashedNewPassword,
          passwordResetToken: null,
          passwordResetTokenExpiresAt: null,
          passwordResetRequestedAt: null,
          lastPasswordChange: new Date(),
          mustChangePassword: false,
          isDefaultCredentials: false,
          failedLoginAttempts: 0,
          accountLockedUntil: null,
          updatedAt: new Date()
        })
        .where(eq(userProfiles.id, user.id));

      console.log(`✅ Mot de passe réinitialisé avec succès pour ${user.email}`);

      res.json({
        success: true,
        message: "Mot de passe réinitialisé avec succès",
        passwordScore: passwordValidation.score
      });

    } catch (error: any) {
      console.error("Error resetting password:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Données invalides",
          details: error.errors
        });
      }

      res.status(500).json({
        error: "PASSWORD_RESET_ERROR",
        message: "Erreur lors de la réinitialisation du mot de passe"
      });
    }
  }
);

/**
 * 📧 Fonction pour envoyer l'email de réinitialisation de mot de passe
 */
async function sendPasswordResetEmail(notification: {
  recipientEmail: string;
  recipientName: string;
  resetUrl: string;
  expiresAt: Date;
  userAgent: string;
  ipAddress: string;
}): Promise<boolean> {
  try {
    const { MailService } = require('@sendgrid/mail');
    
    if (!process.env.SENDGRID_API_KEY) {
      console.error("SENDGRID_API_KEY not configured");
      return false;
    }

    const mailService = new MailService();
    mailService.setApiKey(process.env.SENDGRID_API_KEY);

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>🔄 Réinitialisation de mot de passe</title>
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e0e0e0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
        .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .security-info { background: #f0f9ff; border: 1px solid #e0f2fe; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .monospace { font-family: 'Courier New', monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔄 Réinitialisation de mot de passe</h1>
            <p>Smart GMAO DiagFix - Demande de réinitialisation</p>
        </div>
        
        <div class="content">
            <h2>Bonjour ${notification.recipientName},</h2>
            
            <p>Vous avez demandé la réinitialisation de votre mot de passe sur <strong>Smart GMAO DiagFix</strong>.</p>
            
            <div class="warning">
                <h3>🚨 Important - Sécurité</h3>
                <p><strong>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</strong></p>
                <p>Votre mot de passe actuel reste inchangé jusqu'à ce que vous utilisiez le lien ci-dessous.</p>
            </div>
            
            <div style="text-align: center;">
                <a href="${notification.resetUrl}" class="btn">🔓 Réinitialiser mon mot de passe</a>
            </div>
            
            <div class="security-info">
                <h3>🛡️ Informations de sécurité :</h3>
                <ul>
                    <li><strong>⏰ Expire le :</strong> ${notification.expiresAt.toLocaleDateString('fr-FR')} à ${notification.expiresAt.toLocaleTimeString('fr-FR')}</li>
                    <li><strong>🌐 Demande depuis :</strong> ${notification.userAgent}</li>
                    <li><strong>📍 Adresse IP :</strong> <span class="monospace">${notification.ipAddress}</span></li>
                </ul>
            </div>
            
            <h3>📋 Étapes pour réinitialiser :</h3>
            <ol>
                <li>Cliquez sur le bouton "Réinitialiser mon mot de passe" ci-dessus</li>
                <li>Vous serez redirigé vers une page sécurisée</li>
                <li>Saisissez votre nouveau mot de passe (minimum 8 caractères)</li>
                <li>Confirmez votre nouveau mot de passe</li>
                <li>Connectez-vous avec vos nouveaux identifiants</li>
            </ol>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p><strong>💡 Conseils pour un mot de passe sécurisé :</strong></p>
                <ul>
                    <li>Au moins 8 caractères</li>
                    <li>Mélange de lettres majuscules et minuscules</li>
                    <li>Incluez des chiffres et des caractères spéciaux</li>
                    <li>Évitez les informations personnelles</li>
                    <li>Utilisez un mot de passe unique pour chaque service</li>
                </ul>
            </div>
            
            <p><strong>Le lien expire dans 1 heure.</strong> Si le lien a expiré, vous pouvez faire une nouvelle demande de réinitialisation.</p>
        </div>
        
        <div class="footer">
            <p><strong>Smart GMAO DiagFix</strong> - Plateforme de maintenance industrielle intelligente</p>
            <p style="font-size: 12px; color: #6b7280;">
                Si vous avez des questions, contactez notre support technique.<br>
                Cet email contient des informations sensibles, ne le transférez pas.
            </p>
        </div>
    </div>
</body>
</html>`;

    await mailService.send({
      to: notification.recipientEmail,
      from: 'noreply@smart-gmao-diagfix.com',
      subject: `🔄 Réinitialisation de mot de passe - Smart GMAO DiagFix`,
      html: emailContent
    });

    console.log(`✅ Email de réinitialisation envoyé à ${notification.recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Erreur envoi email réinitialisation:', error);
    return false;
  }
}

export default router;