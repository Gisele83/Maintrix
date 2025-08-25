import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { db } from "./db";
import { userProfiles, userSessions, tenants, federatedLearning } from "@shared/schema";
import { eq, count, desc } from "drizzle-orm";

const router = Router();

// Configuration super-admin
const SUPER_ADMIN_SECRET = process.env.SUPER_ADMIN_SECRET || "***REMOVED-SECRET***";
const SUPER_ADMIN_ACCOUNTS = [
  {
    email: "platform@admin.com",
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

// 🏢 Créer un nouveau tenant
router.post('/tenants', authenticateSuperAdmin, async (req, res) => {
  try {
    const { name, domain } = req.body;

    if (!name || !domain) {
      return res.status(400).json({
        error: "TENANT_DATA_REQUIRED",
        message: "Nom et domaine du tenant requis"
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

    // Créer le nouveau tenant
    const [newTenant] = await db.insert(tenants).values({
      name,
      domain,
      isActive: true
    }).returning();

    res.json({
      success: true,
      tenant: newTenant
    });
  } catch (error) {
    console.error('Super-admin create tenant error:', error);
    res.status(500).json({
      error: "SUPER_ADMIN_CREATE_TENANT_ERROR",
      message: "Erreur lors de la création du tenant"
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

// 🔒 Déconnexion super-admin
router.post('/logout', (req, res) => {
  res.clearCookie('superAdminToken');
  res.json({ 
    success: true, 
    message: "Déconnexion super-admin réussie" 
  });
});

export { router as superAdminRoutes };