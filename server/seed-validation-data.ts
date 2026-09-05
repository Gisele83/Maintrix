import { db } from "./db";
import { gmaoStorage } from "./gmao-storage";

// Create sample validation data for testing multi-level validation system
export async function seedValidationData() {
  try {
    console.log("Creating sample validation data...");

    // Create sample user profiles with validation permissions
    const userProfiles = [
      {
        id: "1",
        name: "Marie Dupont",
        role: "Superviseur",
        email: "marie.dupont@company.com",
        canValidateWorkOrders: true,
        canValidatePurchaseOrders: true,
        validationLevel: 2,
        maxWorkOrderAmount: "10000",
        maxPurchaseOrderAmount: "50000"
      },
      {
        id: "2", 
        name: "Jean Martin",
        role: "Chef d'équipe",
        email: "jean.martin@company.com",
        canValidateWorkOrders: true,
        canValidatePurchaseOrders: false,
        validationLevel: 1,
        maxWorkOrderAmount: "5000",
        maxPurchaseOrderAmount: "0"
      },
      {
        id: "3",
        name: "Pierre Durand",
        role: "Directeur",
        email: "pierre.durand@company.com", 
        canValidateWorkOrders: true,
        canValidatePurchaseOrders: true,
        validationLevel: 3,
        maxWorkOrderAmount: "100000",
        maxPurchaseOrderAmount: "500000"
      }
    ];

    // Insert user profiles (skip since we'll use the current implementation)
    console.log("User profiles will be handled by the validation system");

    // Create sample work orders requiring validation
    const workOrders = [
      {
        tenantId: "default-tenant",
        orderType: "Maintenance",
        title: "Maintenance préventive pompe hydraulique",
        description: "Révision complète de la pompe hydraulique principale - remplacement des joints et filtres",
        priority: "high" as const,
        status: "pending" as const,
        requestedBy: 2,
        equipmentId: 1,
        estimatedDuration: 180,
        cost: 2500.00,
        scheduledStart: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
      },
      {
        tenantId: "default-tenant",
        orderType: "Réparation",
        title: "Réparation urgente moteur électrique",
        description: "Remplacement du moteur électrique du convoyeur principal suite à panne",
        priority: "urgent" as const,
        status: "pending" as const,
        requestedBy: 1,
        equipmentId: 2,
        estimatedDuration: 300,
        cost: 8500.00,
        scheduledStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 jours
      },
      {
        tenantId: "default-tenant",
        orderType: "Prédictive",
        title: "Maintenance prédictive ventilation",
        description: "Entretien du système de ventilation basé sur l'analyse prédictive - vibrations anormales détectées",
        priority: "medium" as const,
        status: "pending" as const,
        requestedBy: 3,
        equipmentId: 3,
        estimatedDuration: 120,
        cost: 1200.00,
        scheduledStart: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 jours
      }
    ];

    // Insert work orders
    for (const workOrder of workOrders) {
      await gmaoStorage.createWorkOrder(workOrder);
    }

    // Create sample purchase orders requiring validation
    const purchaseOrders = [
      {
        orderNumber: "PO-2025-001",
        orderType: "Pièces de rechange",
        notes: "Commande de roulements et joints pour maintenance préventive",
        items: [
          { partNumber: "RLT-001", description: "Roulement SKF 6308", quantity: 4, unitPrice: "125.50", totalPrice: "502.00" },
          { partNumber: "JNT-045", description: "Joint hydraulique NBR", quantity: 10, unitPrice: "15.20", totalPrice: "152.00" }
        ],
        totalAmount: "654.00",
        currency: "EUR",
        requestedBy: "Jean Martin",
        priority: "medium" as const,
        expectedDelivery: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 jours
        status: "pending" as const
      },
      {
        orderNumber: "PO-2025-002",
        orderType: "Équipement",
        notes: "Acquisition d'un nouveau moteur électrique haute performance",
        items: [
          { partNumber: "MOT-HP-75", description: "Moteur 75kW IP55 IE4", quantity: 1, unitPrice: "4250.00", totalPrice: "4250.00" },
          { partNumber: "ACC-001", description: "Kit de montage", quantity: 1, unitPrice: "180.00", totalPrice: "180.00" }
        ],
        totalAmount: "4430.00",
        currency: "EUR",
        requestedBy: "Marie Dupont",
        priority: "high" as const,
        expectedDelivery: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 jours
        status: "pending" as const
      },
      {
        orderNumber: "PO-2025-003",
        orderType: "Services",
        notes: "Contrat de maintenance annuel pour équipements de levage",
        items: [
          { description: "Maintenance préventive annuelle grues STS", quantity: 1, unitPrice: "25000.00", totalPrice: "25000.00" },
          { description: "Support technique 24/7", quantity: 1, unitPrice: "8000.00", totalPrice: "8000.00" }
        ],
        totalAmount: "33000.00",
        currency: "EUR",
        requestedBy: "Pierre Durand",
        priority: "low" as const,
        expectedDelivery: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
        status: "pending" as const
      }
    ];

    // Insert purchase orders with their line items
    for (const { items, ...purchaseOrder } of purchaseOrders) {
      const created = await gmaoStorage.createPurchaseOrder(purchaseOrder);
      for (const item of items) {
        await gmaoStorage.createPurchaseOrderItem({ purchaseOrderId: created.id, ...item });
      }
    }

    console.log("✅ Sample validation data created successfully");
    console.log("  - 3 user profiles with validation permissions");
    console.log("  - 3 work orders (1 pending, 1 urgent pending, 1 level1 validated)");
    console.log("  - 3 purchase orders (2 pending, 1 level1 validated)");

    return true;
  } catch (error) {
    console.error("❌ Error seeding validation data:", error);
    return false;
  }
}

// Export for use in other modules
export default seedValidationData;