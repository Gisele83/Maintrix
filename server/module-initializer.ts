/**
 * Initialisation des modules ERP par défaut
 * Configure le catalogue de modules disponibles dans le système
 */

import { db } from "./db.js";
import { moduleCatalog, tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { InsertModuleCatalog } from "@shared/schema";

// Définition des modules ERP de base
const defaultModules: InsertModuleCatalog[] = [
  // MODULES GMAO CORE
  {
    key: "equipment-management",
    name: "Gestion des Équipements",
    description: "Registre complet des équipements avec historique maintenance et géolocalisation",
    category: "GMAO",
    version: "1.0.0",
    dependencies: [],
    defaultEnabled: true,
    isCore: true,
    routePaths: ["/equipment-management", "/gmao/equipment"],
    apiEndpoints: ["/api/equipment", "/api/equipment-registry"],
    permissions: ["equipment:read", "equipment:write", "equipment:delete"],
    configuration: {
      features: ["qr_codes", "health_scoring", "location_tracking", "documents"],
      limits: { max_equipment: 1000 }
    }
  },
  
  {
    key: "work-orders",
    name: "Ordres de Travail",
    description: "Gestion complète des ordres de travail avec workflow de validation multi-niveaux",
    category: "GMAO", 
    version: "1.0.0",
    dependencies: ["equipment-management"],
    defaultEnabled: true,
    isCore: true,
    routePaths: ["/work-orders", "/gmao/work-orders"],
    apiEndpoints: ["/api/work-orders", "/api/validation"],
    permissions: ["workorder:read", "workorder:write", "workorder:validate"],
    configuration: {
      features: ["multi_level_validation", "auto_numbering", "sla_tracking"],
      limits: { max_work_orders: 5000 }
    }
  },

  {
    key: "preventive-maintenance",
    name: "Maintenance Préventive", 
    description: "Planification et gestion des maintenances préventives basées sur calendrier, usage ou état",
    category: "GMAO",
    version: "1.0.0",
    dependencies: ["equipment-management", "work-orders"],
    defaultEnabled: true,
    isCore: true,
    routePaths: ["/preventive-maintenance", "/gmao/preventive"],
    apiEndpoints: ["/api/preventive-maintenance-plans"],
    permissions: ["preventive:read", "preventive:write", "preventive:schedule"],
    configuration: {
      features: ["calendar_based", "usage_based", "condition_based", "auto_generation"],
      limits: { max_plans: 500 }
    }
  },

  {
    key: "inventory-simple",
    name: "Gestion des Stocks",
    description: "Inventaire des pièces détachées avec gestion automatique des seuils et réapprovisionnement",
    category: "GMAO",
    version: "1.0.0", 
    dependencies: ["equipment-management"],
    defaultEnabled: true,
    isCore: true,
    routePaths: ["/inventory-management", "/gmao/inventory"],
    apiEndpoints: ["/api/spare-parts", "/api/stock", "/api/stock-movements"],
    permissions: ["inventory:read", "inventory:write", "inventory:move"],
    configuration: {
      features: ["automatic_reorder", "stock_alerts", "movement_tracking"],
      limits: { max_parts: 2000 }
    }
  },

  {
    key: "smart-diagnostic",
    name: "Diagnostic IA",
    description: "Assistant de diagnostic intelligent avec IA avancée et apprentissage automatique",
    category: "IA_DIAGNOSTICS",
    version: "1.0.0",
    dependencies: ["equipment-management"],
    defaultEnabled: true,
    isCore: true,
    routePaths: ["/smart-diagnostic", "/", "/dashboard"],
    apiEndpoints: ["/api/diagnostic", "/api/diagnostic-advanced-ml", "/api/diagnostic-ensemble-ml"],
    permissions: ["diagnostic:read", "diagnostic:advanced", "diagnostic:ml"],
    configuration: {
      features: ["standard_ml", "advanced_ml", "ensemble_ml", "pattern_matching"],
      limits: { max_diagnostics_per_month: 1000 }
    }
  },

  {
    key: "maintenance-dashboard",
    name: "Tableau de Bord Maintenance",
    description: "Dashboard complet avec KPIs temps réel, alertes et indicateurs de performance",
    category: "ANALYTICS",
    version: "1.0.0",
    dependencies: ["equipment-management", "work-orders"],
    defaultEnabled: true,
    isCore: true,
    routePaths: ["/maintenance-dashboard", "/gmao-dashboard", "/gmao"],
    apiEndpoints: ["/api/kpis", "/api/dashboard-metrics"],
    permissions: ["dashboard:read", "analytics:view"],
    configuration: {
      features: ["real_time_kpis", "equipment_health", "cost_tracking", "alerts"],
      limits: { data_retention_days: 365 }
    }
  },

  // MODULES ERP ÉTENDUS
  {
    key: "procurement",
    name: "Achats et Approvisionnement",
    description: "Gestion des achats, bons de commande et relations fournisseurs",
    category: "ERP_PROCUREMENT",
    version: "1.0.0",
    dependencies: ["inventory-simple"],
    defaultEnabled: false,
    isCore: false,
    routePaths: ["/procurement", "/purchase-orders"],
    apiEndpoints: ["/api/purchase-orders", "/api/suppliers", "/api/procurement"],
    permissions: ["procurement:read", "procurement:write", "procurement:approve"],
    configuration: {
      features: ["purchase_orders", "supplier_management", "auto_approval", "budget_control"],
      limits: { max_suppliers: 200, max_po_per_month: 1000 }
    }
  },

  {
    key: "reporting",
    name: "Rapports et Exports",
    description: "Génération de rapports de maintenance, exports PDF et analyses avancées", 
    category: "ANALYTICS",
    version: "1.0.0",
    dependencies: ["maintenance-dashboard"],
    defaultEnabled: false,
    isCore: false,
    routePaths: ["/reports", "/advanced-reporting"],
    apiEndpoints: ["/api/reports", "/api/pdf-export", "/api/export"],
    permissions: ["reports:read", "reports:generate", "reports:export"],
    configuration: {
      features: ["pdf_generation", "excel_export", "custom_reports", "scheduled_reports"],
      limits: { max_reports_per_month: 100 }
    }
  },

  {
    key: "iot-integration",
    name: "Intégration IoT",
    description: "Collecte de données capteurs, alertes automatiques et surveillance temps réel",
    category: "IOT_AUTOMATION",
    version: "1.0.0",
    dependencies: ["equipment-management"],
    defaultEnabled: false,
    isCore: false,
    routePaths: ["/iot-gamification-dashboard"],
    apiEndpoints: ["/api/iot", "/api/sensors", "/api/alerts"],
    permissions: ["iot:read", "iot:configure", "iot:alerts"],
    configuration: {
      features: ["sensor_monitoring", "automatic_alerts", "threshold_config", "data_visualization"],
      limits: { max_sensors: 100, data_retention_days: 90 }
    }
  }
];

/**
 * Initialise le catalogue de modules dans la base de données
 */
export async function initializeModuleCatalog(): Promise<void> {
  try {
    console.log("🔧 Initializing ERP Module Catalog...");

    // Vérifier si des modules existent déjà
    const existingModules = await db.select().from(moduleCatalog);
    
    if (existingModules.length > 0) {
      console.log(`✅ Module catalog already initialized with ${existingModules.length} modules`);
      return;
    }

    // Insérer tous les modules par défaut
    for (const module of defaultModules) {
      await db.insert(moduleCatalog).values(module);
      console.log(`  ✓ Module added: ${module.name} (${module.key})`);
    }

    console.log(`✅ Module catalog initialized with ${defaultModules.length} modules`);
  } catch (error) {
    console.error("❌ Error initializing module catalog:", error);
    throw error;
  }
}

/**
 * Met à jour la configuration des tenants existants avec les modules par défaut
 */
export async function migrateTenantModules(): Promise<void> {
  try {
    console.log("🔄 Migrating existing tenants to module system...");

    const existingTenants = await db.select().from(tenants);
    
    // Modules par défaut activés pour les tenants existants
    const defaultEnabledModules = defaultModules
      .filter(m => m.defaultEnabled)
      .map(m => m.key);

    for (const tenant of existingTenants) {
      const currentFeatures = tenant.features as any || {};
      
      // Si le tenant n'a pas encore de configuration de modules
      if (!currentFeatures.enabledModules) {
        const updatedFeatures = {
          ...currentFeatures,
          enabledModules: defaultEnabledModules
        };

        await db
          .update(tenants)
          .set({ 
            features: updatedFeatures,
            updatedAt: new Date()
          })
          .where(eq(tenants.id, tenant.id));

        console.log(`  ✓ Tenant migrated: ${tenant.name} (${defaultEnabledModules.length} modules enabled)`);
      }
    }

    console.log("✅ Tenant migration completed");
  } catch (error) {
    console.error("❌ Error migrating tenants:", error);
    throw error;
  }
}

/**
 * Initialisation complète du système de modules ERP
 */
export async function initializeERPSystem(): Promise<void> {
  try {
    await initializeModuleCatalog();
    await migrateTenantModules();
    console.log("🎉 ERP Module System fully initialized!");
  } catch (error) {
    console.error("❌ ERP System initialization failed:", error);
    throw error;
  }
}