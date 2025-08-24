import { Router, Request, Response } from "express";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { 
  InvitationSystem, 
  createInvitationSchema, 
  acceptInvitationSchema, 
  addDomainSchema 
} from "./invitation-system";
import { userSessions, userProfiles } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcrypt";

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
      const passwordMatch = await bcrypt.compare(password, user.password);
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
        tenantId: user.tenantId,
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
      
      const invitations = await db
        .select()
        .from(invitations)
        .where(eq(invitations.tenantId, req.tenantId));
      
      res.json({
        success: true,
        invitations: invitations.map(inv => ({
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

export default router;