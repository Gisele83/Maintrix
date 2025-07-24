import { gmaoStorage } from "./gmao-storage";

// Create simple demo data for validation system
export async function createValidationDemo() {
  try {
    console.log("Creating validation demo data...");

    // Create sample work orders that need validation
    const workOrder1 = await gmaoStorage.createWorkOrder({
      orderNumber: "WO-2025-001",
      orderType: "Maintenance",
      title: "Maintenance préventive pompe hydraulique",
      description: "Révision complète de la pompe hydraulique principale - remplacement des joints et filtres",
      priority: "high",
      status: "pending",
      validationStatus: "pending",
      requestedBy: 2,
      equipmentId: 1,
      estimatedDuration: 180,
      totalCost: "2500.00",
      scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    const workOrder2 = await gmaoStorage.createWorkOrder({
      orderNumber: "WO-2025-002",
      orderType: "Réparation",
      title: "Réparation urgente moteur électrique",
      description: "Remplacement du moteur électrique du convoyeur principal suite à panne",
      priority: "urgent",
      status: "pending",
      validationStatus: "pending",
      requestedBy: 1,
      equipmentId: 2,
      estimatedDuration: 300,
      totalCost: "8500.00",
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    });

    // Create purchase orders that need validation
    const purchaseOrder1 = await gmaoStorage.createPurchaseOrder({
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
      validationStatus: "pending",
      requestedBy: "Jean Martin",
      priority: "medium",
      deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: "pending"
    });

    const purchaseOrder2 = await gmaoStorage.createPurchaseOrder({
      orderNumber: "PO-2025-002",
      orderType: "Équipement",
      description: "Acquisition d'un nouveau moteur électrique haute performance",
      supplier: "Moteurs Électriques Pro",
      items: JSON.stringify([
        { partNumber: "MOT-HP-75", description: "Moteur 75kW IP55 IE4", quantity: 1, unitPrice: 4250.00 }
      ]),
      totalAmount: "4250.00",
      currency: "EUR",
      validationStatus: "pending", 
      requestedBy: "Marie Dupont",
      priority: "high",
      deliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      status: "pending"
    });

    console.log("✅ Validation demo data created successfully");
    console.log("  - 2 work orders pending validation");
    console.log("  - 2 purchase orders pending validation");

    return {
      success: true,
      workOrders: [workOrder1, workOrder2],
      purchaseOrders: [purchaseOrder1, purchaseOrder2]
    };
  } catch (error) {
    console.error("❌ Error creating validation demo:", error);
    return { success: false, error: error.message };
  }
}