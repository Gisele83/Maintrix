/**
 * Seed file for procurement and supplier management data
 * Creates test data for suppliers, spare parts, and reorder rules
 */

import { gmaoStorage } from "./gmao-storage";

export async function seedProcurementData() {
  console.log("🚀 Seeding procurement and supplier data...");

  try {
    // 1. Create spare parts with low stock to trigger automatic reordering
    const spareParts = [
      {
        partNumber: "ROB-001",
        partName: "Roulement moteur principal STS",
        description: "Roulement à billes 6308-2RS1 pour moteur de grue STS",
        category: "bearing",
        unitPrice: "150.00",
        currency: "EUR",
        currentStock: 3, // Stock faible pour déclencher commande auto
        minStock: 5,
        maxStock: 50,
        storageLocation: "A-01-03",
        supplier: "SKF Roulements",
        isActive: true
      },
      {
        partNumber: "JNT-002",
        partName: "Joint pompe hydraulique RTG",
        description: "Joint torique NBR 70 Shore A pour pompe hydraulique RTG",
        category: "seal",
        unitPrice: "25.50",
        currency: "EUR",
        currentStock: 2, // Stock critique
        minStock: 3,
        maxStock: 30,
        storageLocation: "B-02-05",
        supplier: "Grundfos Pompes",
        isActive: true
      },
      {
        partNumber: "CTR-003",
        partName: "Contacteur électrique 40A",
        description: "Contacteur tripolaire 40A 400V pour alimentation moteur",
        category: "electrical",
        unitPrice: "85.00",
        currency: "EUR",
        currentStock: 1, // Stock très faible
        minStock: 2,
        maxStock: 25,
        storageLocation: "C-01-02",
        supplier: "Schneider Electric",
        isActive: true
      },
      {
        partNumber: "FLT-004",
        partName: "Filtre hydraulique haute pression",
        description: "Filtre hydraulique 300 bar pour circuit principal",
        category: "filter",
        unitPrice: "120.00",
        currency: "EUR",
        currentStock: 6, // Stock correct
        minStock: 8,
        maxStock: 60,
        storageLocation: "D-03-01",
        supplier: "Atlas Copco",
        isActive: true
      },
      {
        partNumber: "BLT-005",
        partName: "Courroie transmission principale",
        description: "Courroie trapézoïdale SPC 4000 pour transmission principale",
        category: "belt",
        unitPrice: "75.00",
        currency: "EUR",
        currentStock: 3, // Stock faible
        minStock: 4,
        maxStock: 35,
        storageLocation: "E-01-04",
        supplier: "Siemens Industrial",
        isActive: true
      },
      {
        partNumber: "CAB-006",
        partName: "Câble de commande 5x2.5mm²",
        description: "Câble multiconducteur blindé pour signalisation",
        category: "cable",
        unitPrice: "12.50",
        currency: "EUR",
        currentStock: 45, // Stock normal
        minStock: 20,
        maxStock: 100,
        storageLocation: "F-02-01",
        supplier: "Schneider Electric",
        isActive: true
      }
    ];

    console.log("Creating spare parts...");
    const createdParts = [];
    for (const part of spareParts) {
      try {
        const createdPart = await gmaoStorage.createSparePart(part);
        createdParts.push(createdPart);
        console.log(`✓ Created spare part: ${part.partName} (ID: ${createdPart.id})`);
      } catch (error) {
        console.error(`❌ Failed to create spare part ${part.partName}:`, error);
      }
    }

    // 2. Get supplier IDs
    const suppliers = await gmaoStorage.getSuppliers();
    console.log(`Found ${suppliers.length} suppliers`);

    if (suppliers.length === 0) {
      console.log("No suppliers found, skipping reorder rules creation");
      return;
    }

    // 3. Create reorder rules for critical parts with automatic ordering
    const reorderRules = [
      {
        sparePartId: createdParts[0]?.id, // Roulement moteur
        reorderPoint: 5,
        reorderQuantity: 20,
        maxStock: 50,
        supplierId: suppliers.find(s => s.companyName.includes('SKF'))?.id || suppliers[0]?.id,
        isActive: true,
        leadTime: 7,
        autoOrder: true, // Commande automatique activée
        notes: "Pièce critique - commande automatique obligatoire"
      },
      {
        sparePartId: createdParts[1]?.id, // Joint pompe
        reorderPoint: 3,
        reorderQuantity: 15,
        maxStock: 30,
        supplierId: suppliers.find(s => s.companyName.includes('Grundfos'))?.id || suppliers[0]?.id,
        isActive: true,
        leadTime: 5,
        autoOrder: true,
        notes: "Stock critique - réapprovisionnement prioritaire"
      },
      {
        sparePartId: createdParts[2]?.id, // Contacteur
        reorderPoint: 2,
        reorderQuantity: 10,
        maxStock: 25,
        supplierId: suppliers.find(s => s.companyName.includes('Schneider'))?.id || suppliers[0]?.id,
        isActive: true,
        leadTime: 3,
        autoOrder: true,
        notes: "Equipement électrique critique"
      },
      {
        sparePartId: createdParts[3]?.id, // Filtre hydraulique
        reorderPoint: 8,
        reorderQuantity: 25,
        maxStock: 60,
        supplierId: suppliers.find(s => s.companyName.includes('Atlas'))?.id || suppliers[0]?.id,
        isActive: true,
        leadTime: 10,
        autoOrder: false, // Commande manuelle pour cette pièce
        notes: "Surveillance stock - validation manuelle requise"
      },
      {
        sparePartId: createdParts[4]?.id, // Courroie
        reorderPoint: 4,
        reorderQuantity: 12,
        maxStock: 35,
        supplierId: suppliers.find(s => s.companyName.includes('Siemens'))?.id || suppliers[0]?.id,
        isActive: true,
        leadTime: 7,
        autoOrder: true,
        notes: "Pièce d'usure - remplacement régulier"
      }
    ];

    console.log("Creating reorder rules...");
    for (const rule of reorderRules) {
      if (rule.sparePartId && rule.supplierId) {
        try {
          const createdRule = await gmaoStorage.createReorderRule(rule);
          console.log(`✓ Created reorder rule for part ID ${rule.sparePartId} (Rule ID: ${createdRule.id})`);
        } catch (error) {
          console.error(`❌ Failed to create reorder rule for part ID ${rule.sparePartId}:`, error);
        }
      }
    }

    // 4. Create some initial purchase orders examples
    const initialOrders = [
      {
        orderNumber: "PO20250001",
        supplierId: suppliers[0]?.id,
        orderType: "spare_parts",
        status: "draft",
        priority: "normal",
        requestedBy: "Maintenance Manager",
        totalAmount: "2450.00",
        currency: "EUR",
        expectedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
        deliveryAddress: "Port de Marseille - Magasin Central",
        notes: "Commande de maintenance préventive Q1 2025",
        terms: "NET 30"
      }
    ];

    console.log("Creating initial purchase orders...");
    for (const order of initialOrders) {
      if (order.supplierId) {
        try {
          const createdOrder = await gmaoStorage.createPurchaseOrder(order);
          console.log(`✓ Created purchase order: ${order.orderNumber} (ID: ${createdOrder.id})`);
        } catch (error) {
          console.error(`❌ Failed to create purchase order ${order.orderNumber}:`, error);
        }
      }
    }

    console.log("✅ Procurement data seeding completed successfully!");
    console.log(`📊 Summary:
    - Spare parts: ${createdParts.length}
    - Suppliers: ${suppliers.length}  
    - Reorder rules: ${reorderRules.filter(r => r.sparePartId && r.supplierId).length}
    - Initial orders: ${initialOrders.length}`);

    return {
      spareParts: createdParts,
      suppliers,
      reorderRulesCount: reorderRules.filter(r => r.sparePartId && r.supplierId).length
    };

  } catch (error) {
    console.error("❌ Error seeding procurement data:", error);
    throw error;
  }
}

// Function to trigger automatic reorder check (for testing)
export async function testAutomaticReordering() {
  console.log("🔄 Testing automatic reordering system...");
  
  try {
    const result = await gmaoStorage.checkStockLevelsAndTriggerReorders('default-tenant');
    
    console.log(`📈 Automatic reorder check results:
    - Rules triggered: ${result.triggeredRules.length}
    - Orders created: ${result.createdOrders.length}`);
    
    if (result.triggeredRules.length > 0) {
      console.log("🚨 Triggered rules:");
      for (const rule of result.triggeredRules) {
        console.log(`  - Part ID ${rule.sparePartId}: reorder ${rule.reorderQuantity} units`);
      }
    }
    
    if (result.createdOrders.length > 0) {
      console.log("📝 Created orders:");
      for (const order of result.createdOrders) {
        console.log(`  - Order ${order.orderNumber}: €${order.totalAmount}`);
      }
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error testing automatic reordering:", error);
    throw error;
  }
}