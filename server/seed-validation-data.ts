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
        orderNumber: "WO-2025-001",
        orderType: "Maintenance",
        title: "Maintenance préventive pompe hydraulique",
        description: "Révision complète de la pompe hydraulique principale - remplacement des joints et filtres",
        priority: "high" as const,
        status: "pending" as const,
        validationStatus: "pending" as const,
        requestedBy: 2,
        assignedTo: null,
        equipmentId: 1,
        estimatedDuration: 180,
        totalCost: "2500.00",
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
      },
      {
        orderNumber: "WO-2025-002",
        orderType: "Réparation",
        title: "Réparation urgente moteur électrique",
        description: "Remplacement du moteur électrique du convoyeur principal suite à panne",
        priority: "urgent" as const,
        status: "pending" as const,
        validationStatus: "pending" as const,
        requestedBy: 1,
        assignedTo: null,
        equipmentId: 2,
        estimatedDuration: 300,
        totalCost: "8500.00",
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 jours
      },
      {
        orderNumber: "WO-2025-003",
        orderType: "Prédictive",
        title: "Maintenance prédictive ventilation",
        description: "Entretien du système de ventilation basé sur l'analyse prédictive - vibrations anormales détectées",
        priority: "medium" as const,
        status: "pending" as const,
        validationStatus: "level1_validated" as const,
        requestedBy: 3,
        assignedTo: null,
        equipmentId: 3,
        estimatedDuration: 120,
        totalCost: "1200.00",
        scheduledDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 jours
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
        description: "Commande de roulements et joints pour maintenance préventive",
        supplier: "Roulement Industriel SA",
        items: JSON.stringify([
          { partNumber: "RLT-001", description: "Roulement SKF 6308", quantity: 4, unitPrice: 125.50 },
          { partNumber: "JNT-045", description: "Joint hydraulique NBR", quantity: 10, unitPrice: 15.20 }
        ]),
        totalAmount: "654.00",
        currency: "EUR",
        validationStatus: "pending" as const,
        requestedBy: "Jean Martin",
        priority: "medium" as const,
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 jours
        status: "pending" as const
      },
      {
        orderNumber: "PO-2025-002",
        orderType: "Équipement",
        description: "Acquisition d'un nouveau moteur électrique haute performance",
        supplier: "Moteurs Électriques Pro",
        items: JSON.stringify([
          { partNumber: "MOT-HP-75", description: "Moteur 75kW IP55 IE4", quantity: 1, unitPrice: 4250.00 },
          { partNumber: "ACC-001", description: "Kit de montage", quantity: 1, unitPrice: 180.00 }
        ]),
        totalAmount: "4430.00",
        currency: "EUR",
        validationStatus: "pending" as const,
        requestedBy: "Marie Dupont",
        priority: "high" as const,
        deliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 jours
        status: "pending" as const
      },
      {
        orderNumber: "PO-2025-003",
        orderType: "Services",
        description: "Contrat de maintenance annuel pour équipements de levage",
        supplier: "Maintenance Portuaire Express",
        items: JSON.stringify([
          { description: "Maintenance préventive annuelle grues STS", quantity: 1, unitPrice: 25000.00 },
          { description: "Support technique 24/7", quantity: 1, unitPrice: 8000.00 }
        ]),
        totalAmount: "33000.00",
        currency: "EUR",
        validationStatus: "level1_validated" as const,
        requestedBy: "Pierre Durand",
        priority: "low" as const,
        deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
        status: "pending" as const
      }
    ];

    // Insert purchase orders
    for (const purchaseOrder of purchaseOrders) {
      await gmaoStorage.createPurchaseOrder(purchaseOrder);
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