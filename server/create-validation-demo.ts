import { gmaoStorage } from "./gmao-storage";

// Create simple demo data for validation system
export async function createValidationDemo() {
  try {
    console.log("Creating validation demo data...");

    // First create user profiles for the demo if they don't exist
    const demoUsers = [
      {
        id: 1,
        username: "chef.service",
        fullName: "Chef de Service",
        email: "chef.service@company.com",
        role: "Chef de Service Utilisateur",
        canValidateLevel1: true,
        canValidateLevel2: false,
        canValidateLevel3: false
      },
      {
        id: 2,
        username: "marie.dupont",
        fullName: "Marie Dupont",
        email: "marie.dupont@company.com",
        role: "Technicien Maintenance",
        canValidateLevel1: false,
        canValidateLevel2: false,
        canValidateLevel3: false
      },
      {
        id: 3,
        username: "directeur.general",
        fullName: "Directeur Général",
        email: "directeur@company.com",
        role: "Directeur Général",
        canValidateLevel1: false,
        canValidateLevel2: true,
        canValidateLevel3: false
      }
    ];

    // Create user profiles if they don't exist
    for (const user of demoUsers) {
      try {
        const existingUser = await gmaoStorage.getUserProfile(user.id);
        if (!existingUser) {
          await gmaoStorage.createUserProfile(user);
          console.log(`✓ Created user profile: ${user.fullName}`);
        }
      } catch (error) {
        console.log(`Creating user profile: ${user.fullName}`);
        await gmaoStorage.createUserProfile(user);
      }
    }

    // Create sample work orders that need validation
    const workOrder1 = await gmaoStorage.createWorkOrder({
      tenantId: "default-tenant",
      orderType: "Maintenance",
      title: "Maintenance préventive pompe hydraulique",
      description: "Révision complète de la pompe hydraulique principale - remplacement des joints et filtres",
      priority: "high",
      status: "pending",
      requestedBy: 2,
      equipmentId: 1,
      estimatedDuration: 180,
      cost: 2500.00,
      scheduledStart: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    const workOrder2 = await gmaoStorage.createWorkOrder({
      tenantId: "default-tenant",
      orderType: "Réparation",
      title: "Réparation urgente moteur électrique",
      description: "Remplacement du moteur électrique du convoyeur principal suite à panne",
      priority: "urgent",
      status: "pending",
      requestedBy: 1,
      equipmentId: 2,
      estimatedDuration: 300,
      cost: 8500.00,
      scheduledStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    });

    // Create purchase orders that need validation
    const purchaseOrder1 = await gmaoStorage.createPurchaseOrder({
      orderNumber: "PO-2025-001",
      orderType: "Pièces de rechange",
      notes: "Commande de roulements et joints pour maintenance préventive",
      totalAmount: "654.00",
      currency: "EUR",
      requestedBy: "Jean Martin",
      documentType: "purchase_order", // Will be automatically determined by amount
      priority: "medium",
      expectedDelivery: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: "pending"
    });
    for (const item of [
      { partNumber: "RLT-001", description: "Roulement SKF 6308", quantity: 4, unitPrice: "125.50", totalPrice: "502.00" },
      { partNumber: "JNT-045", description: "Joint hydraulique NBR", quantity: 10, unitPrice: "15.20", totalPrice: "152.00" }
    ]) {
      await gmaoStorage.createPurchaseOrderItem({ purchaseOrderId: purchaseOrder1.id, ...item });
    }

    const purchaseOrder2 = await gmaoStorage.createPurchaseOrder({
      orderNumber: "PO-2025-002",
      orderType: "Équipement",
      notes: "Acquisition d'un nouveau moteur électrique haute performance",
      totalAmount: "4250.00",
      currency: "EUR",
      requestedBy: "Marie Dupont",
      documentType: "command_letter", // Amount > 1500€
      priority: "high",
      expectedDelivery: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      status: "pending"
    });
    await gmaoStorage.createPurchaseOrderItem({
      purchaseOrderId: purchaseOrder2.id,
      partNumber: "MOT-HP-75", description: "Moteur 75kW IP55 IE4", quantity: 1, unitPrice: "4250.00", totalPrice: "4250.00"
    });

    console.log("✅ Validation demo data created successfully");
    console.log("  - 2 work orders pending validation");
    console.log("  - 2 purchase orders pending validation");

    return {
      success: true,
      workOrders: [workOrder1, workOrder2],
      purchaseOrders: [purchaseOrder1, purchaseOrder2]
    };
  } catch (error: any) {
    console.error("❌ Error creating validation demo:", error);
    return { success: false, error: error.message };
  }
}