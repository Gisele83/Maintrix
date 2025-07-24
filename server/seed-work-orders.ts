import { gmaoStorage } from "./gmao-storage";

export async function seedWorkOrders() {
  try {
    console.log('🌱 Seeding work orders for validation testing...');
    
    // Create test work orders for validation
    const workOrdersData = [
      {
        title: "Maintenance préventive pompe hydraulique",
        description: "Révision complète de la pompe hydraulique principale - vérification des joints, remplacement des filtres et contrôle des pressions",
        orderType: "preventive",
        priority: "medium" as const,
        status: "pending" as const,
        validationStatus: "pending" as const,
        equipmentId: 1,
        assignedTo: 1,
        requestedBy: 1,
        estimatedDuration: 240, // 4 heures
        cost: 850,
        scheduledStart: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Dans 2 jours
        scheduledEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), // +4h
      },
      {
        title: "Réparation moteur électrique",
        description: "Diagnostic et réparation du moteur électrique de la ligne de production 2 - rebobinage nécessaire",
        orderType: "corrective",
        priority: "high" as const,
        status: "pending" as const,
        validationStatus: "pending" as const,
        equipmentId: 2,
        assignedTo: 2,
        requestedBy: 1,
        estimatedDuration: 480, // 8 heures
        cost: 1250,
        scheduledStart: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Demain
        scheduledEnd: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000), // +8h
      },
      {
        title: "Calibrage capteurs de pression",
        description: "Calibrage et étalonnage des capteurs de pression du circuit principal selon normes ISO 9001",
        orderType: "preventive",
        priority: "low" as const,
        status: "pending" as const,
        validationStatus: "pending" as const,
        equipmentId: 3,
        assignedTo: 3,
        requestedBy: 2,
        estimatedDuration: 120, // 2 heures
        cost: 350,
        scheduledStart: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Dans 3 jours
        scheduledEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // +2h
      },
      {
        title: "Remplacement courroies transmission",
        description: "Remplacement des courroies de transmission usées sur le convoyeur principal - inspection complète du système d'entraînement",
        orderType: "corrective",
        priority: "medium" as const,
        status: "pending" as const,
        validationStatus: "level1_validated" as const, // Déjà validé niveau 1
        equipmentId: 4,
        assignedTo: 1,
        requestedBy: 3,
        estimatedDuration: 180, // 3 heures
        cost: 450,
        scheduledStart: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        scheduledEnd: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        level1ValidatedBy: 1,
        level1ValidatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Validé il y a 2h
        level1ValidationNotes: "Ordre approuvé - pièces disponibles en stock"
      },
      {
        title: "Inspection sécurité équipements",
        description: "Inspection annuelle de sécurité réglementaire - vérification des dispositifs de protection et mise à jour des certificats",
        orderType: "inspection",
        priority: "high" as const,
        status: "pending" as const,
        validationStatus: "level2_validated" as const, // Déjà validé niveau 2
        equipmentId: 5,
        assignedTo: 2,
        requestedBy: 1,
        estimatedDuration: 360, // 6 heures
        cost: 1100,
        scheduledStart: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        scheduledEnd: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
        level1ValidatedBy: 1,
        level1ValidatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        level1ValidationNotes: "Ordre approuvé niveau 1",
        level2ValidatedBy: 2,
        level2ValidatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // Validé il y a 4h
        level2ValidationNotes: "Inspection approuvée - budget alloué"
      }
    ];

    // Insert work orders
    const createdOrders = [];
    for (const orderData of workOrdersData) {
      const workOrder = await gmaoStorage.createWorkOrder(orderData);
      createdOrders.push(workOrder);
      console.log(`✅ Created work order: ${workOrder.orderNumber} (${workOrder.title})`);
    }

    console.log(`🎉 Successfully seeded ${createdOrders.length} work orders for validation testing`);
    return createdOrders;
    
  } catch (error) {
    console.error("❌ Error seeding work orders:", error);
    throw error;
  }
}