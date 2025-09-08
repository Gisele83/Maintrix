import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { db } from "./db";
import { userProfiles, userSessions, tenants, federatedLearning } from "@shared/schema";
import { eq, count, desc } from "drizzle-orm";
import { sendTenantInvitation, sendTenantStatusNotification, sendTenantCredentials } from './email-service';
import { testSendGridConfiguration, testRealEmailSend } from './test-email';
import { CredentialGenerator, createCredentialNotification, SuperAdminUserCredentials } from './credential-generator';

const router = Router();

// Configuration super-admin
const SUPER_ADMIN_SECRET = process.env.SUPER_ADMIN_SECRET || "***REMOVED-SECRET***";
const SUPER_ADMIN_ACCOUNTS = [
  {
    email: "beatricesonfack@gmail.com", // Email réel de l'utilisateur
    password: "***REMOVED-SECRET***", // À hasher en production
    role: "super-admin"
  }
];

// Middleware d'authentification super-admin
const authenticateSuperAdmin = async (req: any, res: any, next: any) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies.superAdminToken ||
                  req.body.token;
    
    if (!token) {
      return res.status(401).json({ 
        error: "SUPER_ADMIN_TOKEN_REQUIRED",
        message: "Token super-admin requis" 
      });
    }

    // Vérifier le token (simulation simple - à améliorer avec JWT)
    const validToken = token.length === 128; // Token généré par crypto.randomBytes(64).toString('hex')
    if (!validToken) {
      return res.status(401).json({ 
        error: "INVALID_SUPER_ADMIN_TOKEN",
        message: "Token super-admin invalide" 
      });
    }

    req.superAdmin = { authenticated: true };
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: "SUPER_ADMIN_AUTH_ERROR",
      message: "Erreur d'authentification super-admin" 
    });
  }
};

// Schema Zod pour validation création d'utilisateur par super-admin
import { z } from "zod";

const createUserByAdminSchema = z.object({
  email: z.string().email("Email invalide"),
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  tenantId: z.string().min(1, "ID Tenant requis"),
  role: z.enum(['owner', 'admin', 'maintainer', 'technician', 'viewer']).default('technician'),
  department: z.string().optional(),
});

// 🔐 Connexion super-admin
router.post('/login', async (req, res) => {
  try {
    const { email, password, secretKey } = req.body;

    // Vérifier la clé secrète plateforme
    if (secretKey !== SUPER_ADMIN_SECRET) {
      return res.status(401).json({
        error: "INVALID_SECRET_KEY",
        message: "Clé secrète plateforme incorrecte"
      });
    }

    // Vérifier les identifiants super-admin
    const superAdminAccount = SUPER_ADMIN_ACCOUNTS.find(account => account.email === email);
    if (!superAdminAccount) {
      return res.status(401).json({
        error: "INVALID_SUPER_ADMIN_CREDENTIALS",
        message: "Identifiants super-admin incorrects"
      });
    }

    // Vérifier le mot de passe (en production, utiliser bcrypt.compare)
    const passwordMatch = password === superAdminAccount.password;
    if (!passwordMatch) {
      return res.status(401).json({
        error: "INVALID_SUPER_ADMIN_CREDENTIALS",
        message: "Identifiants super-admin incorrects"
      });
    }

    // Générer un token super-admin
    const token = crypto.randomBytes(64).toString('hex');
    
    // Configurer le cookie sécurisé
    res.cookie('superAdminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24h
    });

    res.json({
      success: true,
      token,
      user: {
        email: superAdminAccount.email,
        role: superAdminAccount.role
      }
    });
  } catch (error) {
    console.error('Super-admin login error:', error);
    res.status(500).json({
      error: "SUPER_ADMIN_LOGIN_ERROR",
      message: "Erreur lors de la connexion super-admin"
    });
  }
});

// 🏢 Récupérer tous les tenants
router.get('/tenants', authenticateSuperAdmin, async (req, res) => {
  try {
    // Récupérer tous les tenants
    const allTenants = await db.select().from(tenants).orderBy(desc(tenants.createdAt));
    
    // Compter les utilisateurs par tenant
    const tenantsWithStats = await Promise.all(
      allTenants.map(async (tenant) => {
        const [userCount] = await db
          .select({ count: count() })
          .from(userProfiles)
          .where(eq(userProfiles.tenantId, tenant.id));

        return {
          ...tenant,
          userCount: userCount.count || 0,
          lastActivity: new Date().toISOString() // À implémenter avec vraies données
        };
      })
    );

    res.json(tenantsWithStats);
  } catch (error) {
    console.error('Super-admin tenants error:', error);
    res.status(500).json({
      error: "SUPER_ADMIN_TENANTS_ERROR",
      message: "Erreur lors de la récupération des tenants"
    });
  }
});

// 🧪 Route de test pour la configuration SendGrid
router.get('/test-sendgrid', authenticateSuperAdmin, async (req, res) => {
  try {
    const testResult = await testSendGridConfiguration();
    
    res.json({
      success: true,
      sendgridTest: testResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur test SendGrid:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du test SendGrid',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// 📧 Route de test d'envoi d'email réel (pour diagnostic)
router.post('/test-email', authenticateSuperAdmin, async (req, res) => {
  try {
    const { toEmail, fromEmail } = req.body;
    
    if (!toEmail || !fromEmail) {
      return res.status(400).json({
        success: false,
        error: 'toEmail et fromEmail sont requis'
      });
    }

    const testResult = await testRealEmailSend(toEmail, fromEmail);
    
    res.json({
      success: testResult.success,
      result: testResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur test envoi email:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du test d\'envoi d\'email',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// 🏢 Créer un nouveau tenant avec identifiants par défaut
router.post('/tenants', authenticateSuperAdmin, async (req, res) => {
  try {
    const { name, domain, adminEmail } = req.body;

    if (!name || !domain || !adminEmail) {
      return res.status(400).json({
        error: "TENANT_DATA_REQUIRED",
        message: "Nom, domaine et email administrateur du tenant requis"
      });
    }

    // Vérifier si le domaine existe déjà
    const existingTenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.domain, domain))
      .limit(1);

    if (existingTenant.length > 0) {
      return res.status(400).json({
        error: "TENANT_DOMAIN_EXISTS",
        message: "Ce domaine est déjà utilisé par un autre tenant"
      });
    }

    // Vérifier si l'email admin existe déjà
    const existingUser = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.email, adminEmail))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({
        error: "ADMIN_EMAIL_EXISTS",
        message: "Cet email est déjà utilisé par un autre utilisateur"
      });
    }

    // Créer le nouveau tenant
    const [newTenant] = await db.insert(tenants).values({
      name,
      domain,
      isActive: true,
      contactEmail: adminEmail,
      plan: req.body.plan || 'pro'
    }).returning();

    console.log(`🏢 TENANT CRÉÉ: ${newTenant.name} (${newTenant.id})`);

    // 🔐 ÉTAPE CRITIQUE: Générer identifiants par défaut pour l'admin tenant
    const adminCredentials = CredentialGenerator.generateTenantAdminCredentials(
      newTenant.name,
      adminEmail,
      newTenant.id
    );

    console.log(`🔐 IDENTIFIANTS GÉNÉRÉS pour ${adminEmail}:`, {
      username: adminCredentials.username,
      tenantId: adminCredentials.tenantId,
      mustChangePassword: adminCredentials.mustChangePassword
    });

    // Hasher le mot de passe temporaire
    const hashedPassword = await CredentialGenerator.hashPassword(adminCredentials.password);
    
    // Créer le premier utilisateur admin avec identifiants par défaut
    const [adminUser] = await db.insert(userProfiles).values({
      tenantId: newTenant.id,
      username: adminCredentials.username,
      email: adminCredentials.email,
      password: hashedPassword,
      role: 'owner', // Premier utilisateur = propriétaire du tenant
      firstName: req.body.adminFirstName || '',
      lastName: req.body.adminLastName || '',
      // 🔐 FLAGS SÉCURITÉ: Forcer changement mot de passe
      mustChangePassword: true,
      isDefaultCredentials: true,
      passwordExpiresAt: adminCredentials.expiresAt,
      defaultCredentialsGeneratedAt: new Date(),
      defaultCredentialsGeneratedBy: 1, // Super-admin ID (à récupérer dynamiquement)
      isActive: true
    }).returning();

    console.log(`👤 ADMIN CRÉÉ: ${adminUser.username} (${adminUser.id})`);

    // 📧 Envoyer les identifiants par email
    try {
      const host = req.get('host') || 'localhost:5000';
      const loginUrl = `${req.protocol}://${host}/login`;
      
      // Créer la notification avec identifiants
      const credentialNotification = createCredentialNotification(
        adminCredentials,
        newTenant.name,
        loginUrl
      );

      // Envoyer email avec identifiants
      const emailSent = await sendTenantCredentials(credentialNotification);

      res.json({
        success: true,
        tenant: newTenant,
        adminUser: {
          id: adminUser.id,
          username: adminUser.username,
          email: adminUser.email,
          role: adminUser.role,
          mustChangePassword: adminUser.mustChangePassword
        },
        credentials: {
          sent: emailSent,
          expiresAt: adminCredentials.expiresAt,
          loginUrl
        },
        message: emailSent 
          ? `✅ Tenant créé et identifiants envoyés à ${adminEmail}`
          : `⚠️ Tenant créé mais échec envoi email à ${adminEmail}`
      });

    } catch (emailError) {
      console.error('Erreur envoi identifiants:', emailError);
      
      // En cas d'échec email, retourner les identifiants dans la réponse (sécurisé car super-admin)
      res.json({
        success: true,
        tenant: newTenant,
        adminUser: {
          id: adminUser.id,
          username: adminUser.username,
          email: adminUser.email,
          role: adminUser.role,
          mustChangePassword: adminUser.mustChangePassword
        },
        credentials: {
          sent: false,
          // 🚨 ATTENTION: Identifiants en clair uniquement pour super-admin en cas d'échec email
          temporaryCredentials: {
            username: adminCredentials.username,
            password: adminCredentials.password,
            loginUrl: `${req.protocol}://${req.get('host') || 'localhost:5000'}/login`
          },
          expiresAt: adminCredentials.expiresAt
        },
        message: `⚠️ Tenant créé mais échec envoi email. Identifiants affichés ci-dessus (à transmettre manuellement)`
      });
    }

  } catch (error) {
    console.error('Super-admin create tenant error:', error);
    res.status(500).json({
      error: "SUPER_ADMIN_CREATE_TENANT_ERROR",
      message: "Erreur lors de la création du tenant",
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// 🔄 Désactiver/Activer un tenant
router.patch('/tenants/:tenantId/status', authenticateSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { isActive, reason } = req.body;

    // Vérifier que le tenant existe
    const [existingTenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!existingTenant) {
      return res.status(404).json({
        error: "TENANT_NOT_FOUND",
        message: "Tenant introuvable"
      });
    }

    // Mettre à jour le statut du tenant
    const [updatedTenant] = await db
      .update(tenants)
      .set({ 
        isActive,
        updatedAt: new Date(),
        // Ajouter la raison dans les settings si fournie
        settings: reason ? { ...(existingTenant.settings || {}), deactivationReason: reason } : existingTenant.settings
      })
      .where(eq(tenants.id, tenantId))
      .returning();

    // Envoyer une notification par email si les settings contiennent un email admin
    if (existingTenant.settings && (existingTenant.settings as any).adminEmail) {
      try {
        await sendTenantStatusNotification(
          (existingTenant.settings as any).adminEmail,
          existingTenant.name,
          isActive ? 'activated' : 'deactivated',
          reason
        );
      } catch (emailError) {
        console.error('Erreur envoi notification email:', emailError);
      }
    }

    res.json({
      success: true,
      tenant: updatedTenant,
      message: isActive ? 'Tenant réactivé avec succès' : 'Tenant désactivé avec succès'
    });
  } catch (error) {
    console.error('Super-admin update tenant status error:', error);
    res.status(500).json({
      error: "SUPER_ADMIN_UPDATE_TENANT_STATUS_ERROR",
      message: "Erreur lors de la mise à jour du statut du tenant"
    });
  }
});

// 🗑️ Supprimer un tenant
router.delete('/tenants/:tenantId', authenticateSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Vérifier que le tenant existe
    const [existingTenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!existingTenant) {
      return res.status(404).json({
        error: "TENANT_NOT_FOUND",
        message: "Tenant introuvable"
      });
    }

    // Supprimer le tenant (cascade supprimera automatiquement les données liées)
    await db.delete(tenants).where(eq(tenants.id, tenantId));

    res.json({
      success: true,
      message: `Tenant "${existingTenant.name}" supprimé définitivement`
    });
  } catch (error) {
    console.error('Super-admin delete tenant error:', error);
    res.status(500).json({
      error: "SUPER_ADMIN_DELETE_TENANT_ERROR",
      message: "Erreur lors de la suppression du tenant"
    });
  }
});

// 🧠 Récupérer les statistiques d'apprentissage fédéré
router.get('/federated-stats', authenticateSuperAdmin, async (req, res) => {
  try {
    const stats = await db
      .select()
      .from(federatedLearning)
      .orderBy(desc(federatedLearning.lastUpdated));

    res.json(stats);
  } catch (error) {
    console.error('Super-admin federated stats error:', error);
    res.status(500).json({
      error: "SUPER_ADMIN_FEDERATED_STATS_ERROR",
      message: "Erreur lors de la récupération des statistiques d'apprentissage fédéré"
    });
  }
});

// 📊 Statistiques globales de la plateforme
router.get('/platform-stats', authenticateSuperAdmin, async (req, res) => {
  try {
    // Compter le nombre total de tenants
    const [tenantCount] = await db.select({ count: count() }).from(tenants);
    
    // Compter le nombre total d'utilisateurs
    const [userCount] = await db.select({ count: count() }).from(userProfiles);
    
    // Statistiques d'apprentissage fédéré
    const federatedStats = await db.select().from(federatedLearning);
    const totalContributions = federatedStats.length;
    const avgEffectiveness = federatedStats.length > 0 
      ? federatedStats.reduce((sum, stat) => sum + (stat.solutionEffectiveness || 0), 0) / federatedStats.length
      : 0;

    res.json({
      tenants: tenantCount.count || 0,
      users: userCount.count || 0,
      federatedLearning: {
        totalContributions,
        avgEffectiveness,
        activeTenants: new Set(federatedStats.map(stat => stat.tenantId)).size
      }
    });
  } catch (error) {
    console.error('Super-admin platform stats error:', error);
    res.status(500).json({
      error: "SUPER_ADMIN_PLATFORM_STATS_ERROR",
      message: "Erreur lors de la récupération des statistiques plateforme"
    });
  }
});

/**
 * 👤 CRÉER UN UTILISATEUR INDIVIDUEL (Super-Admin seulement)
 * Nouvelle fonctionnalité: Seul le super-admin peut créer des comptes utilisateurs
 */
router.post('/create-user', authenticateSuperAdmin, async (req, res) => {
  try {
    const validatedData = createUserByAdminSchema.parse(req.body);
    
    // Vérifier que le tenant existe
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, validatedData.tenantId))
      .limit(1);
      
    if (!tenant) {
      return res.status(404).json({
        error: "TENANT_NOT_FOUND",
        message: "Tenant non trouvé"
      });
    }
    
    // Vérifier que l'email n'existe pas déjà
    const [existingUser] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.email, validatedData.email))
      .limit(1);
      
    if (existingUser) {
      return res.status(400).json({
        error: "EMAIL_ALREADY_EXISTS",
        message: "Un utilisateur avec cet email existe déjà"
      });
    }
    
    // 🔐 GÉNÉRER IDENTIFIANTS PAR DÉFAUT VIA SUPER-ADMIN
    const credentials = CredentialGenerator.generateUserCredentialsForSuperAdmin(
      validatedData.email,
      validatedData.firstName,
      validatedData.lastName,
      validatedData.tenantId,
      validatedData.role,
      1 // Super-admin ID (à récupérer dynamiquement)
    );
    
    // Hacher le mot de passe temporaire
    const hashedPassword = await CredentialGenerator.hashPassword(credentials.password);
    
    // Créer l'utilisateur avec identifiants par défaut
    const [newUser] = await db
      .insert(userProfiles)
      .values({
        tenantId: validatedData.tenantId,
        username: credentials.username,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role,
        department: validatedData.department,
        isActive: true,
        // 🔐 CHAMPS IDENTIFIANTS PAR DÉFAUT
        mustChangePassword: true,
        isDefaultCredentials: true,
        passwordExpiresAt: credentials.passwordExpiresAt,
        defaultCredentialsGeneratedAt: credentials.defaultCredentialsGeneratedAt,
        defaultCredentialsGeneratedBy: 1, // Super-admin ID
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
    
    console.log(`✅ Super-admin: Utilisateur créé ${newUser.username} pour tenant ${validatedData.tenantId}`);
    
    // Retourner les identifiants temporaires (pour notification email)
    res.status(201).json({
      success: true,
      user: newUser,
      temporaryCredentials: {
        username: credentials.username,
        password: credentials.password,
        expiresAt: credentials.passwordExpiresAt,
        mustChangePassword: true
      },
      message: "Utilisateur créé avec succès par le super-admin. Identifiants temporaires générés."
    });
    
  } catch (error: any) {
    console.error("Error creating user by super-admin:", error);
    
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
});

/**
 * 📊 LISTER LES UTILISATEURS AVEC IDENTIFIANTS PAR DÉFAUT
 */
router.get('/users-with-default-credentials', authenticateSuperAdmin, async (req, res) => {
  try {
    const usersWithDefaults = await db
      .select({
        id: userProfiles.id,
        username: userProfiles.username,
        firstName: userProfiles.firstName,
        lastName: userProfiles.lastName,
        email: userProfiles.email,
        role: userProfiles.role,
        tenantId: userProfiles.tenantId,
        mustChangePassword: userProfiles.mustChangePassword,
        isDefaultCredentials: userProfiles.isDefaultCredentials,
        passwordExpiresAt: userProfiles.passwordExpiresAt,
        defaultCredentialsGeneratedAt: userProfiles.defaultCredentialsGeneratedAt,
        lastLogin: userProfiles.lastLogin
      })
      .from(userProfiles)
      .where(eq(userProfiles.isDefaultCredentials, true));
    
    res.json({
      success: true,
      users: usersWithDefaults,
      count: usersWithDefaults.length
    });
    
  } catch (error) {
    console.error("Error fetching users with default credentials:", error);
    res.status(500).json({
      error: "FETCH_USERS_ERROR",
      message: "Erreur lors de la récupération des utilisateurs"
    });
  }
});

// 🔒 Déconnexion super-admin
router.post('/logout', (req, res) => {
  res.clearCookie('superAdminToken');
  res.json({ 
    success: true, 
    message: "Déconnexion super-admin réussie" 
  });
});

export { router as superAdminRoutes };