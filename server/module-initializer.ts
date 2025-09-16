/**
 * Initialisation des modules ERP par défaut
 * Configure le catalogue de modules disponibles dans le système
 */

import { db } from "./db.js";
import { moduleCatalog, tenants, sectorTemplates } from "@shared/schema";
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
  },

  // MODULES AVANCÉS - INTÉGRATIONS ENTERPRISE
  {
    key: "advanced-integrations",
    name: "Intégrations Avancées",
    description: "Connecteurs ERP (SAP, Oracle), SCADA, Power BI et API externes avancées",
    category: "ENTERPRISE_INTEGRATION",
    version: "2.0.0",
    dependencies: ["equipment-management", "work-orders"],
    defaultEnabled: false,
    isCore: false,
    routePaths: ["/advanced-integrations"],
    apiEndpoints: ["/api/integrations/sap", "/api/integrations/scada", "/api/integrations/powerbi"],
    permissions: ["integration:read", "integration:configure", "integration:sync"],
    configuration: {
      features: ["sap_connector", "oracle_connector", "scada_integration", "powerbi_reports", "rest_api_gateway"],
      limits: { max_connections: 10, sync_frequency_minutes: 15 }
    }
  },

  {
    key: "ensemble-ai",
    name: "IA Ensemble Avancée",
    description: "Système IA multi-modèles avec 9 algorithmes ML et apprentissage fédéré",
    category: "ADVANCED_AI",
    version: "2.0.0",
    dependencies: ["smart-diagnostic", "equipment-management"],
    defaultEnabled: false,
    isCore: false,
    routePaths: ["/smart-diagnostic"],
    apiEndpoints: ["/api/diagnostic-ensemble-ml", "/api/federated-ai/diagnostic-feedback"],
    permissions: ["ai:advanced", "ai:ensemble", "ai:federated"],
    configuration: {
      features: ["ensemble_voting", "neural_networks", "anomaly_detection", "federated_learning"],
      limits: { max_models: 9, accuracy_threshold: 0.95 }
    }
  },

  {
    key: "mobile-access",
    name: "Accès Mobile",
    description: "Application mobile React Native avec mode hors-ligne et scanner QR",
    category: "MOBILE_PLATFORM",
    version: "1.0.0",
    dependencies: ["equipment-management", "work-orders", "smart-diagnostic"],
    defaultEnabled: false,
    isCore: false,
    routePaths: [],
    apiEndpoints: ["/api/mobile/sync", "/api/mobile/equipment/qr"],
    permissions: ["mobile:access", "mobile:offline", "mobile:qr"],
    configuration: {
      features: ["offline_mode", "qr_scanner", "field_technician", "data_sync"],
      limits: { offline_data_days: 30, max_offline_records: 1000 }
    }
  },

  {
    key: "multi-tenant-saas",
    name: "Multi-Tenant SaaS",
    description: "Architecture SaaS multi-tenant avec isolation des données et gestion enterprise",
    category: "ENTERPRISE_PLATFORM",
    version: "1.0.0",
    dependencies: [],
    defaultEnabled: true,
    isCore: true,
    routePaths: ["/tenant-management"],
    apiEndpoints: ["/api/tenant", "/api/enterprise-auth"],
    permissions: ["tenant:manage", "tenant:create", "enterprise:admin"],
    configuration: {
      features: ["data_isolation", "tenant_metrics", "federated_ai", "security_middleware"],
      limits: { max_tenants: 100, max_users_per_tenant: 50 }
    }
  },

  {
    key: "payment-management",
    name: "Gestion des Paiements",
    description: "Système de paiement PCI-DSS avec Stripe et PayPal pour abonnements SaaS",
    category: "PAYMENT_SYSTEM",
    version: "1.0.0",
    dependencies: ["multi-tenant-saas"],
    defaultEnabled: false,
    isCore: false,
    routePaths: ["/payment-management", "/subscription"],
    apiEndpoints: ["/api/payments/stripe", "/api/payments/paypal", "/api/subscriptions"],
    permissions: ["payment:read", "payment:process", "subscription:manage"],
    configuration: {
      features: ["stripe_integration", "paypal_integration", "subscription_plans", "invoice_generation"],
      limits: { max_transactions_per_month: 10000 }
    }
  },

  {
    key: "advanced-reporting",
    name: "Rapports Avancés PDF",
    description: "Génération avancée de rapports PDF avec analyses prédictives et KPIs industriels",
    category: "ADVANCED_ANALYTICS",
    version: "2.0.0",
    dependencies: ["reporting", "maintenance-dashboard"],
    defaultEnabled: false,
    isCore: false,
    routePaths: ["/advanced-reporting"],
    apiEndpoints: ["/api/pdf-reports", "/api/maintenance-reports", "/api/monthly-reports"],
    permissions: ["reports:advanced", "reports:pdf", "analytics:predictive"],
    configuration: {
      features: ["pdf_generation", "predictive_analytics", "kpi_dashboards", "automated_reports"],
      limits: { max_pdf_reports_per_month: 500 }
    }
  },

  {
    key: "local-deployment",
    name: "Déploiement Local",
    description: "Installation locale avec Docker et scripts automatisés pour environnements on-premise",
    category: "DEPLOYMENT",
    version: "1.0.0",
    dependencies: [],
    defaultEnabled: false,
    isCore: false,
    routePaths: ["/deployment-management"],
    apiEndpoints: ["/api/deployment/status", "/api/deployment/backup"],
    permissions: ["deploy:local", "deploy:backup", "system:admin"],
    configuration: {
      features: ["docker_containers", "automated_scripts", "nginx_proxy", "ssl_configuration"],
      limits: { max_backup_retention_days: 30 }
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
    
    // Si nous avons moins de modules que prévu, mettre à jour le catalogue
    if (existingModules.length > 0 && existingModules.length < defaultModules.length) {
      console.log(`🔄 Updating module catalog from ${existingModules.length} to ${defaultModules.length} modules`);
      
      // Supprimer les anciens modules pour une mise à jour complète
      await db.delete(moduleCatalog);
      console.log("  ✓ Cleared existing modules");
    } else if (existingModules.length >= defaultModules.length) {
      console.log(`✅ Module catalog already up-to-date with ${existingModules.length} modules`);
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
 * Initialise les templates sectoriels dans la base de données
 */
export async function initializeSectorTemplates(): Promise<void> {
  try {
    console.log("🏭 Initializing Sector Templates...");

    // Vérifier si des templates existent déjà
    const existingTemplates = await db.select().from(sectorTemplates);
    
    if (existingTemplates.length > 0) {
      console.log(`✅ Sector templates already initialized with ${existingTemplates.length} templates`);
      return;
    }

    // Templates sectoriels prédéfinis
    const sectorTemplatesData = [
      {
        key: "industry",
        name: "Industrie Manufacturière",
        description: "Template optimisé pour les environnements industriels avec production continue, maintenance préventive avancée et gestion des actifs critiques",
        enabledModules: [
          "equipment-management",
          "work-orders", 
          "preventive-maintenance",
          "inventory-simple",
          "smart-diagnostic",
          "maintenance-dashboard",
          "iot-integration",
          "reporting"
        ],
        defaultWorkflows: {
          work_order: {
            states: ["created", "assigned", "in_progress", "quality_check", "completed", "closed"],
            transitions: {
              created: ["assigned", "cancelled"],
              assigned: ["in_progress", "reassigned"],
              in_progress: ["quality_check", "blocked"],
              quality_check: ["completed", "rejected"],
              completed: ["closed"],
              blocked: ["in_progress"],
              rejected: ["in_progress"]
            },
            sla: { max_response_hours: 2, max_resolution_hours: 24 }
          },
          equipment_maintenance: {
            states: ["scheduled", "preparation", "execution", "verification", "documentation"],
            critical_path: true,
            quality_gates: ["safety_check", "performance_validation"]
          }
        },
        defaultSettings: {
          maintenance_mode: "predictive",
          quality_control: "mandatory", 
          safety_protocols: "strict",
          reporting_frequency: "daily",
          alert_escalation: "immediate"
        },
        kpiConfig: {
          primary: ["oee", "mtbf", "mttr", "availability"],
          secondary: ["maintenance_cost_ratio", "breakdown_frequency", "spare_parts_turnover"],
          thresholds: {
            oee_target: 85,
            availability_target: 95,
            mtbf_target: 720
          }
        },
        complianceRequirements: ["iso_9001", "iso_14001", "iso_45001"],
        industrySpecifics: {
          equipment_criticality: "high",
          safety_level: "critical",
          environmental_impact: "monitored",
          production_continuity: "essential"
        }
      },
      
      {
        key: "transport",
        name: "Transport et Logistique",
        description: "Solution adaptée pour les flottes de véhicules, équipements portuaires et infrastructure de transport avec traçabilité complète",
        enabledModules: [
          "equipment-management",
          "work-orders",
          "preventive-maintenance", 
          "inventory-simple",
          "smart-diagnostic",
          "maintenance-dashboard",
          "procurement"
        ],
        defaultWorkflows: {
          vehicle_maintenance: {
            states: ["scheduled", "pre_inspection", "maintenance", "road_test", "approved"],
            mandatory_docs: ["inspection_report", "maintenance_log", "compliance_check"],
            regulatory_compliance: true
          },
          equipment_inspection: {
            states: ["planned", "inspection", "evaluation", "action_required", "validated"],
            inspection_intervals: "regulatory_based",
            safety_critical: true
          }
        },
        defaultSettings: {
          maintenance_mode: "preventive_regulatory",
          compliance_tracking: "mandatory",
          fleet_optimization: "enabled",
          fuel_monitoring: "active",
          route_planning: "integrated"
        },
        kpiConfig: {
          primary: ["fleet_availability", "fuel_efficiency", "maintenance_cost_per_km", "regulatory_compliance"],
          secondary: ["breakdown_incidents", "route_optimization", "driver_satisfaction"],
          thresholds: {
            fleet_availability: 98,
            compliance_rate: 100,
            fuel_efficiency_target: 8.5
          }
        },
        complianceRequirements: ["transport_regulations", "environmental_standards", "safety_protocols"],
        industrySpecifics: {
          fleet_management: "integrated", 
          regulatory_compliance: "strict",
          route_optimization: "advanced",
          fuel_management: "monitored"
        }
      },

      {
        key: "energy",
        name: "Énergie et Utilities",
        description: "Template spécialisé pour les installations énergétiques, réseaux de distribution et infrastructures critiques avec haute disponibilité",
        enabledModules: [
          "equipment-management",
          "work-orders",
          "preventive-maintenance",
          "inventory-simple", 
          "smart-diagnostic",
          "maintenance-dashboard",
          "iot-integration",
          "reporting",
          "procurement"
        ],
        defaultWorkflows: {
          critical_equipment: {
            states: ["monitoring", "alert", "investigation", "intervention", "restoration", "analysis"],
            response_time: "immediate",
            escalation_levels: 3,
            regulatory_notification: true
          },
          outage_management: {
            states: ["detection", "assessment", "isolation", "repair", "testing", "restoration"],
            priority_matrix: "grid_impact_based",
            stakeholder_communication: "automated"
          }
        },
        defaultSettings: {
          maintenance_mode: "condition_based",
          monitoring: "continuous",
          redundancy: "n_plus_one",
          emergency_response: "24_7",
          regulatory_reporting: "automated"
        },
        kpiConfig: {
          primary: ["grid_availability", "equipment_reliability", "response_time", "energy_efficiency"],
          secondary: ["maintenance_efficiency", "cost_optimization", "environmental_impact"],
          thresholds: {
            grid_availability: 99.95,
            equipment_reliability: 99.5,
            max_response_time: 15
          }
        },
        complianceRequirements: ["grid_code", "environmental_regulations", "safety_standards", "iso_50001"],
        industrySpecifics: {
          grid_integration: "critical",
          renewable_sources: "integrated",
          demand_response: "active",
          storage_management: "optimized"
        }
      },

      {
        key: "facilities",
        name: "Facilities Management",
        description: "Gestion complète des infrastructures et espaces de travail avec focus sur le confort, la sécurité et l'efficacité énergétique",
        enabledModules: [
          "equipment-management",
          "work-orders",
          "preventive-maintenance",
          "inventory-simple",
          "smart-diagnostic", 
          "maintenance-dashboard",
          "procurement"
        ],
        defaultWorkflows: {
          facility_maintenance: {
            states: ["requested", "scheduled", "assigned", "completed", "verified"],
            request_types: ["corrective", "preventive", "improvement"],
            occupant_communication: true
          },
          space_management: {
            states: ["available", "reserved", "occupied", "maintenance", "unavailable"],
            booking_integration: true,
            utilization_tracking: true
          }
        },
        defaultSettings: {
          maintenance_mode: "planned_reactive",
          occupant_comfort: "priority",
          energy_efficiency: "optimized",
          security_integration: "enabled",
          cleaning_standards: "high"
        },
        kpiConfig: {
          primary: ["space_utilization", "energy_consumption", "occupant_satisfaction", "maintenance_efficiency"],
          secondary: ["response_time", "cost_per_sqm", "sustainability_index"],
          thresholds: {
            space_utilization: 75,
            energy_efficiency: 20,
            occupant_satisfaction: 85
          }
        },
        complianceRequirements: ["building_codes", "fire_safety", "accessibility", "environmental_standards"],
        industrySpecifics: {
          space_optimization: "dynamic",
          smart_building: "integrated", 
          sustainability: "focus",
          occupant_experience: "enhanced"
        }
      }
    ];

    // Insérer tous les templates sectoriels
    for (const template of sectorTemplatesData) {
      await db.insert(sectorTemplates).values(template);
      console.log(`  ✓ Sector template added: ${template.name} (${template.key})`);
    }

    console.log(`✅ Sector templates initialized with ${sectorTemplatesData.length} templates`);
  } catch (error) {
    console.error("❌ Error initializing sector templates:", error);
    throw error;
  }
}

/**
 * Initialisation complète du système de modules ERP
 */
export async function initializeERPSystem(): Promise<void> {
  try {
    await initializeModuleCatalog();
    await initializeSectorTemplates();
    await migrateTenantModules();
    console.log("🎉 ERP Module System fully initialized!");
  } catch (error) {
    console.error("❌ ERP System initialization failed:", error);
    throw error;
  }
}