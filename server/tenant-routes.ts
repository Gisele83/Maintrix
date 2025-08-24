// =======================
// MULTI-TENANT API ROUTES  
// =======================
// Admin and tenant management endpoints

import { Router } from "express";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { db } from "./db";
import { z } from "zod";
import { 
  tenants, 
  auditLogs, 
  federatedLearning, 
  gdprRequests, 
  dataRetention 
} from "@shared/schema";
import { 
  TenantRequest, 
  resolveTenant, 
  enforceDataIsolation, 
  auditLogger, 
  rateLimitByTenant 
} from "./tenant-middleware";
import { federatedLearning as federatedService } from "./federated-learning";

const router = Router();

// Apply tenant middleware to specific routes only (not all routes)
// This prevents interference with frontend static resources

// Validation schemas
const createTenantSchema = z.object({
  name: z.string().min(1, "Nom requis").max(255),
  domain: z.string().optional(),
  plan: z.enum(["free", "pro", "business", "enterprise"]).default("free"),
  maxUsers: z.number().int().min(1).max(10000).default(5),
  dataRetentionDays: z.number().int().min(30).max(2555).default(365),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  encryptionEnabled: z.boolean().default(true),
  gdprCompliant: z.boolean().default(true),
  auditLogsEnabled: z.boolean().default(true),
});

const updateTenantSchema = createTenantSchema.partial();

// =======================
// ADMIN ROUTES (Super Admin Only)
// =======================

// Get all tenants (Admin only)
router.get('/api/admin/tenants', async (req: TenantRequest, res) => {
  try {
    // Check admin permissions (simplified for demo)
    const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_SECRET_KEY;
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const allTenants = await db
      .select()
      .from(tenants)
      .orderBy(desc(tenants.createdAt));

    // Add usage statistics
    const tenantsWithStats = await Promise.all(
      allTenants.map(async (tenant) => {
        const [auditCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.tenantId, tenant.id),
              gte(auditLogs.timestamp, sql`NOW() - INTERVAL '30 days'`)
            )
          );

        const [federatedContributions] = await db
          .select({ count: sql<number>`count(*)` })
          .from(federatedLearning)
          .where(eq(federatedLearning.tenantId, tenant.id));

        return {
          ...tenant,
          monthlyActivity: auditCount?.count || 0,
          federatedContributions: federatedContributions?.count || 0,
        };
      })
    );

    res.json(tenantsWithStats);
  } catch (error) {
    console.error("Admin tenants list error:", error);
    res.status(500).json({ error: "Failed to retrieve tenants" });
  }
});

// Create new tenant (Admin only)
router.post('/api/admin/tenants', async (req: TenantRequest, res) => {
  try {
    const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_SECRET_KEY;
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const validatedData = createTenantSchema.parse(req.body);

    const [newTenant] = await db
      .insert(tenants)
      .values({
        ...validatedData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json(newTenant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Tenant creation error:", error);
    res.status(500).json({ error: "Failed to create tenant" });
  }
});

// Update tenant (Admin only)
router.put('/api/admin/tenants/:tenantId', async (req: TenantRequest, res) => {
  try {
    const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_SECRET_KEY;
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { tenantId } = req.params;
    const validatedData = updateTenantSchema.parse(req.body);

    const [updatedTenant] = await db
      .update(tenants)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning();

    if (!updatedTenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json(updatedTenant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Tenant update error:", error);
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

// Delete tenant (Admin only - with GDPR compliance)
router.delete('/api/admin/tenants/:tenantId', async (req: TenantRequest, res) => {
  try {
    const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_SECRET_KEY;
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { tenantId } = req.params;

    // Start transaction for complete data deletion
    await db.transaction(async (tx) => {
      // Create GDPR deletion record
      await tx.insert(gdprRequests).values({
        tenantId,
        requestType: "deletion",
        subjectEmail: "admin-initiated@system",
        status: "processing",
        requestData: { reason: "tenant_deletion", initiatedBy: "admin" },
      });

      // Schedule data retention cleanup (cascade delete will handle related records)
      const [deletedTenant] = await tx
        .delete(tenants)
        .where(eq(tenants.id, tenantId))
        .returning();

      if (!deletedTenant) {
        throw new Error("Tenant not found");
      }
    });

    res.json({ message: "Tenant and all associated data deleted successfully" });
  } catch (error) {
    console.error("Tenant deletion error:", error);
    res.status(500).json({ error: "Failed to delete tenant" });
  }
});

// Get federated learning analytics (Admin only)
router.get('/api/admin/federated-analytics', async (req: TenantRequest, res) => {
  try {
    const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_SECRET_KEY;
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Global federated learning statistics
    const [totalContributions] = await db
      .select({ count: sql<number>`count(*)` })
      .from(federatedLearning);

    const [totalTenants] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenants)
      .where(eq(tenants.isActive, true));

    const [avgEffectiveness] = await db
      .select({ avg: sql<number>`AVG(${federatedLearning.solutionEffectiveness})` })
      .from(federatedLearning);

    const categoryStats = await db
      .select({
        category: federatedLearning.equipmentCategory,
        contributions: sql<number>`count(*)`,
        avgEffectiveness: sql<number>`AVG(${federatedLearning.solutionEffectiveness})`,
      })
      .from(federatedLearning)
      .groupBy(federatedLearning.equipmentCategory)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    res.json({
      totalContributions: totalContributions?.count || 0,
      totalActiveTenants: totalTenants?.count || 0,
      globalAverageEffectiveness: avgEffectiveness?.avg || 0,
      participationRate: totalTenants?.count > 0 
        ? (totalContributions?.count || 0) / totalTenants.count 
        : 0,
      categoryStats,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Federated analytics error:", error);
    res.status(500).json({ error: "Failed to retrieve analytics" });
  }
});

// =======================
// TENANT-SPECIFIC ROUTES
// =======================

// Apply data isolation middleware to tenant routes
router.use('/api/tenant', resolveTenant);
router.use('/api/tenant', rateLimitByTenant(200));
router.use('/api/tenant', enforceDataIsolation);
router.use('/api/tenant', auditLogger);

// Apply admin middleware to admin routes
router.use('/api/admin', resolveTenant); 
router.use('/api/admin', rateLimitByTenant(50));

// Get current tenant info
router.get('/api/tenant/info', async (req: TenantRequest, res) => {
  try {
    if (!req.tenantData) {
      return res.status(400).json({ error: "Tenant context missing" });
    }

    // Remove sensitive information
    const { settings, features, ...publicTenantData } = req.tenantData;
    
    res.json({
      ...publicTenantData,
      hasCustomSettings: Object.keys(settings || {}).length > 0,
      enabledFeatures: Object.keys(features || {}).length,
    });
  } catch (error) {
    console.error("Tenant info error:", error);
    res.status(500).json({ error: "Failed to retrieve tenant info" });
  }
});

// Get tenant usage statistics
router.get('/api/tenant/usage', async (req: TenantRequest, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Activity statistics
    const [activityStats] = await db
      .select({
        totalActions: sql<number>`count(*)`,
        successfulActions: sql<number>`count(*) FILTER (WHERE ${auditLogs.success} = true)`,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, req.tenantId),
          gte(auditLogs.timestamp, thirtyDaysAgo)
        )
      );

    // Daily activity trend
    const dailyActivity = await db
      .select({
        date: sql<string>`DATE(${auditLogs.timestamp})`,
        actions: sql<number>`count(*)`,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, req.tenantId),
          gte(auditLogs.timestamp, thirtyDaysAgo)
        )
      )
      .groupBy(sql`DATE(${auditLogs.timestamp})`)
      .orderBy(sql`DATE(${auditLogs.timestamp})`);

    // Resource usage by type
    const resourceUsage = await db
      .select({
        resourceType: auditLogs.resourceType,
        count: sql<number>`count(*)`,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, req.tenantId),
          gte(auditLogs.timestamp, thirtyDaysAgo)
        )
      )
      .groupBy(auditLogs.resourceType)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    res.json({
      period: "30 days",
      totalActions: activityStats?.totalActions || 0,
      successfulActions: activityStats?.successfulActions || 0,
      successRate: activityStats?.totalActions > 0 
        ? (activityStats.successfulActions / activityStats.totalActions) * 100 
        : 100,
      dailyActivity,
      resourceUsage,
      userLimit: req.tenantData?.maxUsers || 5,
      currentUsers: req.tenantData?.currentUsers || 0,
      storageUsed: Math.floor(Math.random() * 1000), // Mock data - would be real storage calculation
    });
  } catch (error) {
    console.error("Tenant usage error:", error);
    res.status(500).json({ error: "Failed to retrieve usage statistics" });
  }
});

// =======================
// FEDERATED LEARNING ROUTES
// =======================

// Contribute to federated learning
router.post('/api/tenant/federated-learning/contribute', async (req: TenantRequest, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }

    const result = await federatedService.contributeToGlobalLearning(req.tenantId);
    res.json(result);
  } catch (error) {
    console.error("Federated learning contribution error:", error);
    res.status(500).json({ error: "Failed to contribute to global learning" });
  }
});

// Get global insights for equipment category
router.get('/api/tenant/federated-learning/insights/:category', async (req: TenantRequest, res) => {
  try {
    const { category } = req.params;
    const insights = await federatedService.getGlobalInsights(category);
    
    if (!insights) {
      return res.status(404).json({ error: "No global insights available for this category" });
    }
    
    res.json(insights);
  } catch (error) {
    console.error("Global insights error:", error);
    res.status(500).json({ error: "Failed to retrieve global insights" });
  }
});

// Get tenant's federated learning analytics
router.get('/api/tenant/federated-learning/analytics', async (req: TenantRequest, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }

    const analytics = await federatedService.getTenantContributionAnalytics(req.tenantId);
    res.json(analytics);
  } catch (error) {
    console.error("Federated analytics error:", error);
    res.status(500).json({ error: "Failed to retrieve analytics" });
  }
});

// Update tenant ML model with federated insights
router.post('/api/tenant/federated-learning/update-model', async (req: TenantRequest, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }

    const { equipmentCategories } = req.body;
    if (!Array.isArray(equipmentCategories)) {
      return res.status(400).json({ error: "Equipment categories array required" });
    }

    const result = await federatedService.updateTenantModel(req.tenantId, equipmentCategories);
    res.json(result);
  } catch (error) {
    console.error("Model update error:", error);
    res.status(500).json({ error: "Failed to update model" });
  }
});

// =======================
// TESTS D'ISOLATION AUTOMATISÉS 
// =======================

// Test de sécurité multi-tenant - vérification isolation (Admin uniquement)
router.post('/api/admin/security/test-isolation', async (req: TenantRequest, res) => {
  try {
    const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_SECRET_KEY;
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required for security tests" });
    }

    const { TenantIsolationTester } = await import('./tenant-isolation-tests');
    const testResults = await TenantIsolationTester.runAllTests();
    
    // Calculer score de sécurité
    const passedTests = testResults.filter(t => t.passed).length;
    const totalTests = testResults.length;
    const securityScore = Math.round((passedTests / totalTests) * 100);
    
    res.json({
      securityScore,
      testResults,
      isolationStatus: securityScore === 100 ? "SECURE" : "VULNERABLE", 
      passedTests,
      totalTests,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Security test error:", error);
    res.status(500).json({ error: "Failed to run isolation tests" });
  }
});

// Test de performance RLS (Admin uniquement)
router.post('/api/admin/security/test-performance', async (req: TenantRequest, res) => {
  try {
    const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_SECRET_KEY;
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { TenantIsolationTester } = await import('./tenant-isolation-tests');
    const performanceResult = await TenantIsolationTester.runPerformanceTest();
    
    res.json(performanceResult);
  } catch (error) {
    console.error("Performance test error:", error);
    res.status(500).json({ error: "Failed to run performance test" });
  }
});

// Évaluation complète multi-tenant (Admin uniquement)
router.get('/api/admin/security/assessment', async (req: TenantRequest, res) => {
  try {
    const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_SECRET_KEY;
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required for security assessment" });
    }

    const { MultiTenantAssessment } = await import('./multi-tenant-assessment');
    const fullAssessment = await MultiTenantAssessment.generateFullAssessment();
    const validationResults = await MultiTenantAssessment.runSecurityValidation();
    
    res.json({
      ...fullAssessment,
      isolationValidation: validationResults,
      reportGenerated: new Date().toISOString()
    });
  } catch (error) {
    console.error("Security assessment error:", error);
    res.status(500).json({ error: "Failed to generate security assessment" });
  }
});

// =======================
// GDPR COMPLIANCE ROUTES
// =======================

// Data export (GDPR Article 20 - Right to data portability)
router.get('/api/tenant/gdpr/export', async (req: TenantRequest, res) => {
  try {
    if (!req.tenantId || !req.tenantData?.gdprCompliant) {
      return res.status(400).json({ error: "GDPR compliance required" });
    }

    // Create GDPR export request
    const [exportRequest] = await db.insert(gdprRequests).values({
      tenantId: req.tenantId,
      requestType: "portability",
      subjectEmail: req.tenantData.contactEmail || "no-email@tenant.local",
      status: "processing",
      requestData: { format: "json", scope: "all_tenant_data" },
    }).returning();

    // In a real implementation, this would trigger background job to prepare export
    res.json({
      requestId: exportRequest.id,
      status: "processing",
      message: "Data export initiated. You will be notified when ready.",
      estimatedCompletionTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });
  } catch (error) {
    console.error("GDPR export error:", error);
    res.status(500).json({ error: "Failed to initiate data export" });
  }
});

// Data deletion request (GDPR Article 17 - Right to erasure)
router.post('/api/tenant/gdpr/delete-request', async (req: TenantRequest, res) => {
  try {
    if (!req.tenantId || !req.tenantData?.gdprCompliant) {
      return res.status(400).json({ error: "GDPR compliance required" });
    }

    const { reason, scope } = req.body;
    
    const [deletionRequest] = await db.insert(gdprRequests).values({
      tenantId: req.tenantId,
      requestType: "deletion",
      subjectEmail: req.tenantData.contactEmail || "no-email@tenant.local",
      status: "pending",
      requestData: { reason, scope },
      notes: "Tenant-initiated deletion request",
    }).returning();

    res.json({
      requestId: deletionRequest.id,
      status: "pending",
      message: "Deletion request submitted. This will be reviewed and processed within 30 days.",
      reviewPeriod: "30 days",
    });
  } catch (error) {
    console.error("GDPR deletion error:", error);
    res.status(500).json({ error: "Failed to submit deletion request" });
  }
});

// Get GDPR request status
router.get('/api/tenant/gdpr/requests', async (req: TenantRequest, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: "Tenant context required" });
    }

    const requests = await db
      .select({
        id: gdprRequests.id,
        requestType: gdprRequests.requestType,
        status: gdprRequests.status,
        requestDate: gdprRequests.requestDate,
        processedDate: gdprRequests.processedDate,
        completionDate: gdprRequests.completionDate,
      })
      .from(gdprRequests)
      .where(eq(gdprRequests.tenantId, req.tenantId))
      .orderBy(desc(gdprRequests.requestDate));

    res.json(requests);
  } catch (error) {
    console.error("GDPR requests error:", error);
    res.status(500).json({ error: "Failed to retrieve GDPR requests" });
  }
});

export default router;