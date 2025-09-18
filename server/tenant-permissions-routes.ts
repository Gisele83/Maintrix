import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import { userProfiles, tenants } from "@shared/schema";
import { z } from "zod";

const router = Router();

// Schema de validation pour les permissions utilisateur
const userPermissionsSchema = z.object({
  role: z.string().optional(),
  validationLevel: z.number().min(0).max(5).optional(),
  canValidateWorkOrders: z.boolean().optional(),
  canValidatePurchaseOrders: z.boolean().optional(),
  maxPurchaseAmount: z.number().min(0).optional(),
  modulePermissions: z.record(z.boolean()).optional(),
  isActive: z.boolean().optional(),
  department: z.string().optional()
});

// Schema pour la création de rôles personnalisés
const customRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  level: z.number().min(1).max(5),
  permissions: z.array(z.string()),
  validationCapabilities: z.object({
    workOrders: z.boolean(),
    purchaseOrders: z.boolean(),
    maxAmount: z.number().min(0)
  }),
  moduleAccess: z.record(z.boolean())
});

/**
 * GET /api/tenant/users
 * Récupère tous les utilisateurs du tenant avec leurs permissions
 * ACCÈS RESTREINT : Seuls les admins et directeurs peuvent accéder
 */
router.get("/api/tenant/users", async (req: any, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const currentUserId = req.user?.id;
    
    if (!tenantId) {
      return res.status(400).json({
        error: "TENANT_REQUIRED",
        message: "Tenant context required"
      });
    }

    // Vérifier les permissions de l'utilisateur actuel
    const [currentUser] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, currentUserId));

    if (!currentUser || !["admin", "director"].includes(currentUser.role || "")) {
      return res.status(403).json({
        error: "INSUFFICIENT_PERMISSIONS",
        message: "Only administrators and directors can view user permissions"
      });
    }

    console.log(`📋 Fetching users for tenant: ${tenantId}`);

    // Récupérer tous les utilisateurs du tenant
    const users = await db
      .select({
        id: userProfiles.id,
        username: userProfiles.username,
        firstName: userProfiles.firstName,
        lastName: userProfiles.lastName,
        email: userProfiles.email,
        role: userProfiles.role,
        department: userProfiles.department,
        validationLevel: userProfiles.validationLevel,
        canValidateWorkOrders: userProfiles.canValidateWorkOrders,
        canValidatePurchaseOrders: userProfiles.canValidatePurchaseOrders,
        maxPurchaseAmount: userProfiles.maxPurchaseAmount,
        isActive: userProfiles.isActive,
        lastLogin: userProfiles.lastLogin,
        specializations: userProfiles.specializations,
        experienceLevel: userProfiles.experienceLevel
      })
      .from(userProfiles)
      .where(eq(userProfiles.tenantId, tenantId))
      .orderBy(desc(userProfiles.lastLogin));

    // Récupérer les permissions de modules personnalisées (stockées dans les paramètres du tenant)
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    const userModulePermissions = tenant?.settings ? (tenant.settings as any).userModulePermissions || {} : {};

    // Ajouter des permissions de modules (persistées ou par défaut basées sur le rôle)
    const usersWithModulePermissions = users.map(user => {
      const savedPermissions = userModulePermissions[user.id] || {};
      const defaultPermissions = {
        "gmao_core": true,
        "diagnostic_ai": user.role !== "viewer",
        "erp_procurement": ["manager", "director", "admin"].includes(user.role || ""),
        "analytics": ["supervisor", "manager", "director", "admin"].includes(user.role || ""),
        "enterprise_integration": ["director", "admin"].includes(user.role || ""),
        "advanced_ai": ["manager", "director", "admin"].includes(user.role || ""),
        "mobile_platform": user.role !== "viewer"
      };
      
      return {
        ...user,
        modulePermissions: { ...defaultPermissions, ...savedPermissions }
      };
    });

    console.log(`✅ Found ${usersWithModulePermissions.length} users for tenant ${tenantId}`);
    
    res.json(usersWithModulePermissions);
  } catch (error) {
    console.error("Error fetching tenant users:", error);
    res.status(500).json({
      error: "FETCH_USERS_ERROR",
      message: "Failed to fetch tenant users"
    });
  }
});

/**
 * PATCH /api/tenant/users/:userId/permissions
 * Met à jour les permissions d'un utilisateur spécifique
 */
router.patch("/api/tenant/users/:userId/permissions", async (req: any, res) => {
  try {
    const { userId } = req.params;
    const tenantId = req.tenantId || req.user?.tenantId;
    const currentUserId = req.user?.id;

    if (!tenantId) {
      return res.status(400).json({
        error: "TENANT_REQUIRED",
        message: "Tenant context required"
      });
    }

    // Valider les données d'entrée
    const validatedData = userPermissionsSchema.parse(req.body);

    console.log(`🔧 Updating permissions for user ${userId} in tenant ${tenantId}`);

    // Vérifier que l'utilisateur appartient au bon tenant
    const [existingUser] = await db
      .select()
      .from(userProfiles)
      .where(and(
        eq(userProfiles.id, parseInt(userId)),
        eq(userProfiles.tenantId, tenantId)
      ));

    if (!existingUser) {
      return res.status(404).json({
        error: "USER_NOT_FOUND",
        message: "User not found in this tenant"
      });
    }

    // Vérifier les permissions de l'utilisateur actuel (seuls les admins/directeurs peuvent modifier)
    const [currentUser] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, currentUserId));

    if (!currentUser || !["admin", "director"].includes(currentUser.role || "")) {
      return res.status(403).json({
        error: "INSUFFICIENT_PERMISSIONS",
        message: "Only administrators and directors can modify user permissions"
      });
    }

    // Mettre à jour les permissions de modules si spécifiées
    if (validatedData.modulePermissions !== undefined) {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      if (tenant) {
        const userModulePermissions = (tenant.settings as any)?.userModulePermissions || {};
        userModulePermissions[userId] = validatedData.modulePermissions;

        await db
          .update(tenants)
          .set({
            settings: {
              ...(tenant.settings as any || {}),
              userModulePermissions
            },
            updatedAt: new Date()
          })
          .where(eq(tenants.id, tenantId));
      }
    }

    // Mettre à jour les permissions
    const updateData: any = {
      updatedAt: new Date()
    };

    // Copier seulement les champs définis
    if (validatedData.role !== undefined) updateData.role = validatedData.role;
    if (validatedData.validationLevel !== undefined) updateData.validationLevel = validatedData.validationLevel;
    if (validatedData.canValidateWorkOrders !== undefined) updateData.canValidateWorkOrders = validatedData.canValidateWorkOrders;
    if (validatedData.canValidatePurchaseOrders !== undefined) updateData.canValidatePurchaseOrders = validatedData.canValidatePurchaseOrders;
    if (validatedData.maxPurchaseAmount !== undefined) updateData.maxPurchaseAmount = validatedData.maxPurchaseAmount;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.department !== undefined) updateData.department = validatedData.department;

    const [updatedUser] = await db
      .update(userProfiles)
      .set(updateData)
      .where(and(
        eq(userProfiles.id, parseInt(userId)),
        eq(userProfiles.tenantId, tenantId)
      ))
      .returning();

    console.log(`✅ Updated permissions for user ${userId}:`, {
      role: updatedUser.role,
      validationLevel: updatedUser.validationLevel,
      canValidateWorkOrders: updatedUser.canValidateWorkOrders,
      canValidatePurchaseOrders: updatedUser.canValidatePurchaseOrders,
      maxPurchaseAmount: updatedUser.maxPurchaseAmount
    });

    res.json({
      success: true,
      user: updatedUser,
      message: "User permissions updated successfully"
    });

  } catch (error) {
    console.error("Error updating user permissions:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid permission data",
        details: error.errors
      });
    }

    res.status(500).json({
      error: "UPDATE_PERMISSIONS_ERROR",
      message: "Failed to update user permissions"
    });
  }
});

/**
 * POST /api/tenant/roles
 * Crée un rôle personnalisé pour le tenant
 */
router.post("/api/tenant/roles", async (req: any, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const currentUserId = req.user?.id;

    if (!tenantId) {
      return res.status(400).json({
        error: "TENANT_REQUIRED",
        message: "Tenant context required"
      });
    }

    // Valider les données d'entrée
    const validatedData = customRoleSchema.parse(req.body);

    console.log(`🎭 Creating custom role for tenant ${tenantId}:`, validatedData.name);

    // Vérifier les permissions de l'utilisateur actuel
    const [currentUser] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, currentUserId));

    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({
        error: "INSUFFICIENT_PERMISSIONS",
        message: "Only tenant administrators can create custom roles"
      });
    }

    // Pour l'instant, nous stockons les rôles personnalisés dans les paramètres du tenant
    // Dans une implémentation complète, nous aurions une table dédiée
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    if (!tenant) {
      return res.status(404).json({
        error: "TENANT_NOT_FOUND",
        message: "Tenant not found"
      });
    }

    const customRoles = (tenant.settings as any)?.customRoles || [];
    const roleId = `custom_${Date.now()}`;
    
    const newRole = {
      id: roleId,
      ...validatedData,
      createdAt: new Date(),
      createdBy: currentUserId
    };

    customRoles.push(newRole);

    // Mettre à jour les paramètres du tenant
    await db
      .update(tenants)
      .set({
        settings: {
          ...(tenant.settings as any || {}),
          customRoles
        },
        updatedAt: new Date()
      })
      .where(eq(tenants.id, tenantId));

    console.log(`✅ Created custom role ${roleId} for tenant ${tenantId}`);

    res.json({
      success: true,
      role: newRole,
      message: "Custom role created successfully"
    });

  } catch (error) {
    console.error("Error creating custom role:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid role data",
        details: error.errors
      });
    }

    res.status(500).json({
      error: "CREATE_ROLE_ERROR",
      message: "Failed to create custom role"
    });
  }
});

/**
 * GET /api/tenant/modules
 * Récupère tous les modules disponibles pour le tenant
 */
router.get("/api/tenant/modules", async (req: any, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        error: "TENANT_REQUIRED",
        message: "Tenant context required"
      });
    }

    // Modules disponibles dans la plateforme
    const availableModules = [
      {
        id: "gmao_core",
        name: "GMAO Core",
        description: "Gestion de maintenance assistée par ordinateur de base",
        category: "core"
      },
      {
        id: "diagnostic_ai",
        name: "Diagnostic IA",
        description: "Intelligence artificielle pour diagnostic de maintenance",
        category: "ai"
      },
      {
        id: "erp_procurement",
        name: "Approvisionnement ERP",
        description: "Gestion des achats et approvisionnements",
        category: "erp"
      },
      {
        id: "analytics",
        name: "Analytics",
        description: "Tableaux de bord et analytiques avancées",
        category: "analytics"
      },
      {
        id: "enterprise_integration",
        name: "Intégrations Entreprise",
        description: "Connecteurs SAP, ERP, et systèmes tiers",
        category: "integration"
      },
      {
        id: "advanced_ai",
        name: "IA Avancée",
        description: "Machine learning et prédictions avancées",
        category: "ai"
      },
      {
        id: "mobile_platform",
        name: "Plateforme Mobile",
        description: "Applications mobiles pour techniciens terrain",
        category: "mobile"
      }
    ];

    res.json({
      modules: availableModules,
      totalModules: availableModules.length
    });

  } catch (error) {
    console.error("Error fetching tenant modules:", error);
    res.status(500).json({
      error: "FETCH_MODULES_ERROR",
      message: "Failed to fetch tenant modules"
    });
  }
});

/**
 * GET /api/tenant/roles
 * Récupère tous les rôles (prédéfinis + personnalisés) du tenant
 */
router.get("/api/tenant/roles", async (req: any, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        error: "TENANT_REQUIRED",
        message: "Tenant context required"
      });
    }

    // Récupérer les rôles personnalisés du tenant
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    const customRoles = tenant?.settings ? (tenant.settings as any).customRoles || [] : [];

    // Rôles prédéfinis
    const presetRoles = [
      {
        id: "technician",
        name: "Technicien",
        description: "Accès de base pour les techniciens de maintenance",
        level: 1,
        permissions: ["view_equipment", "create_work_orders", "update_work_orders"],
        validationCapabilities: { workOrders: false, purchaseOrders: false, maxAmount: 0 },
        moduleAccess: { "gmao_core": true, "diagnostic_ai": true, "mobile_access": true },
        isPreset: true
      },
      {
        id: "supervisor",
        name: "Superviseur",
        description: "Supervision d'équipe et validation niveau 1",
        level: 2,
        permissions: ["view_equipment", "create_work_orders", "validate_level1", "manage_team"],
        validationCapabilities: { workOrders: true, purchaseOrders: true, maxAmount: 5000 },
        moduleAccess: { "gmao_core": true, "diagnostic_ai": true, "erp_procurement": true, "analytics": true },
        isPreset: true
      },
      {
        id: "manager",
        name: "Chef de Service",
        description: "Gestion de service et validation niveau 2",
        level: 3,
        permissions: ["view_equipment", "create_work_orders", "validate_level2", "manage_budget", "manage_team"],
        validationCapabilities: { workOrders: true, purchaseOrders: true, maxAmount: 25000 },
        moduleAccess: { "gmao_core": true, "erp_procurement": true, "analytics": true, "enterprise_integration": true },
        isPreset: true
      },
      {
        id: "director",
        name: "Directeur Maintenance",
        description: "Direction maintenance et validation niveau 3",
        level: 4,
        permissions: ["all_permissions"],
        validationCapabilities: { workOrders: true, purchaseOrders: true, maxAmount: 100000 },
        moduleAccess: { "*": true },
        isPreset: true
      },
      {
        id: "admin",
        name: "Administrateur Tenant",
        description: "Administration complète du tenant",
        level: 5,
        permissions: ["all_permissions", "manage_users", "manage_tenant"],
        validationCapabilities: { workOrders: true, purchaseOrders: true, maxAmount: 999999 },
        moduleAccess: { "*": true },
        isPreset: true
      }
    ];

    res.json({
      presetRoles,
      customRoles,
      totalRoles: presetRoles.length + customRoles.length
    });

  } catch (error) {
    console.error("Error fetching tenant roles:", error);
    res.status(500).json({
      error: "FETCH_ROLES_ERROR",
      message: "Failed to fetch tenant roles"
    });
  }
});

console.log("🔐 Tenant permissions routes registered");

export default router;