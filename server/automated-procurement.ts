/**
 * Automated Procurement System for GMAO
 * Handles automatic parts ordering when stock levels reach critical thresholds
 */

import { gmaoStorage } from "./gmao-storage";

export interface AutomaticOrderResult {
  triggeredRules: number;
  createdOrders: Array<{
    orderNumber: string;
    partNumber: string;
    partName: string;
    quantity: number;
    supplierName: string;
    totalAmount: number;
    priority: string;
  }>;
  errors: string[];
}

export async function checkAndCreateAutomaticOrders(): Promise<AutomaticOrderResult> {
  const result: AutomaticOrderResult = {
    triggeredRules: 0,
    createdOrders: [],
    errors: []
  };

  try {
    console.log("🔍 Starting automatic procurement check...");

    // Get all spare parts that need reordering (stock below reorder point)
    const spareParts = await gmaoStorage.getSpareParts();
    const reorderRules = await gmaoStorage.getReorderRules();
    const suppliers = await gmaoStorage.getSuppliers();

    console.log(`Found ${spareParts.length} spare parts, ${reorderRules.length} reorder rules, ${suppliers.length} suppliers`);

    // Create a map for quick supplier lookup
    const supplierMap = new Map();
    suppliers.forEach(supplier => {
      supplierMap.set(supplier.id, supplier);
    });

    // Check each part against its reorder rules
    for (const part of spareParts) {
      const rule = reorderRules.find(r => r.sparePartId === part.id && r.isActive);
      
      if (!rule) continue;

      // Check if stock is below reorder point
      if (part.currentStock <= rule.reorderPoint) {
        console.log(`📦 Part ${part.partNumber} (${part.partName}) needs reordering: ${part.currentStock} <= ${rule.reorderPoint}`);
        
        const supplier = supplierMap.get(rule.supplierId);
        
        if (!supplier) {
          result.errors.push(`No supplier found for part ${part.partNumber}`);
          continue;
        }

        // Only create automatic orders if auto_order is enabled
        if (rule.autoOrder) {
          try {
            const orderNumber = `AUTO-${Date.now()}-${part.partNumber}`;
            const totalAmount = parseFloat(part.unitPrice) * rule.reorderQuantity;
            
            // Create purchase order
            const purchaseOrder = await gmaoStorage.createPurchaseOrder({
              orderNumber,
              supplierId: supplier.id,
              orderType: "spare_parts",
              status: "draft",
              priority: part.currentStock === 0 ? "urgent" : "high",
              requestedBy: "Automated System",
              totalAmount,
              currency: part.currency || "EUR",
              expectedDelivery: new Date(Date.now() + rule.leadTime * 24 * 60 * 60 * 1000),
              deliveryAddress: "Magasin Central - Zone Maintenance",
              terms: supplier.paymentTerms || "NET 30"
            });

            // Create purchase order items
            await gmaoStorage.createPurchaseOrderItem({
              purchaseOrderId: purchaseOrder.id,
              sparePartId: part.id,
              quantity: rule.reorderQuantity,
              unitPrice: parseFloat(part.unitPrice),
              totalPrice: totalAmount,
              description: `Réapprovisionnement automatique - ${part.partName}`
            });

            result.triggeredRules++;
            result.createdOrders.push({
              orderNumber,
              partNumber: part.partNumber,
              partName: part.partName,
              quantity: rule.reorderQuantity,
              supplierName: supplier.companyName,
              totalAmount,
              priority: part.currentStock === 0 ? "urgent" : "high"
            });

            console.log(`✅ Created automatic order ${orderNumber} for ${part.partName}: ${rule.reorderQuantity} units from ${supplier.companyName}`);

          } catch (error) {
            result.errors.push(`Failed to create order for ${part.partNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.error(`❌ Failed to create order for ${part.partNumber}:`, error);
          }
        } else {
          console.log(`⚠️ Part ${part.partNumber} needs reordering but auto-order is disabled`);
        }
      }
    }

    console.log(`🎯 Automatic procurement check completed: ${result.triggeredRules} orders created, ${result.errors.length} errors`);
    
    return result;

  } catch (error) {
    result.errors.push(`System error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error("❌ Automatic procurement check failed:", error);
    return result;
  }
}

export async function generateAutomaticOrderEmail(order: any, supplier: any, items: any[]): Promise<string> {
  const itemsList = items.map(item => 
    `- ${item.description}: ${item.quantity} x ${item.unitPrice}€ = ${item.totalPrice}€`
  ).join('\n');

  return `
Objet: Commande automatique ${order.orderNumber} - Maintrix GMAO

Bonjour ${supplier.contactPerson},

Notre système de gestion de maintenance (GMAO) a automatiquement généré une commande suite à l'atteinte d'un seuil de stock critique.

DÉTAILS DE LA COMMANDE:
- Numéro: ${order.orderNumber}
- Date: ${new Date().toLocaleDateString('fr-FR')}
- Priorité: ${order.priority}
- Livraison souhaitée: ${new Date(order.expectedDelivery).toLocaleDateString('fr-FR')}

ARTICLES COMMANDÉS:
${itemsList}

TOTAL: ${order.totalAmount}€ ${order.currency}

LIVRAISON:
${order.deliveryAddress}

CONDITIONS:
${order.terms}

Cette commande a été générée automatiquement par notre système de maintenance prédictive pour éviter toute rupture de stock critique.

Merci de confirmer la réception et les délais de livraison.

Cordialement,
Système GMAO Maintrix
Contact: maintenance@port-marseille.fr
`;
}

export function getAutomaticOrderingStatus() {
  return {
    enabled: true,
    description: "Système de commandes automatiques activé",
    lastCheck: new Date().toISOString(),
    nextCheck: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    rules: {
      active: 4,
      total: 5
    }
  };
}