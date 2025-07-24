/**
 * NEW API Routes for Automated Procurement System
 * Simple, working implementation for automatic parts ordering
 */

import type { Request, Response } from "express";
import { gmaoStorage } from "./gmao-storage";

// Interface for automatic order results
interface AutoOrderResult {
  ordersCreated: number;
  totalAmount: number;
  orders: Array<{
    partNumber: string;
    partName: string;
    quantity: number;
    supplier: string;
    amount: number;
  }>;
}

// Check stock levels and create automatic orders
export async function handleAutomaticReorder(req: Request, res: Response) {
  try {
    console.log("🚀 Starting automatic procurement check...");
    
    // Get all spare parts and check stock levels
    const spareParts = await gmaoStorage.getSpareParts();
    const reorderRules = await gmaoStorage.getReorderRules();
    const suppliers = await gmaoStorage.getSuppliers();
    
    // Create supplier lookup map  
    const supplierMap = new Map(suppliers.map(s => [s.id, s]));
    
    const result: AutoOrderResult = {
      ordersCreated: 0,
      totalAmount: 0,
      orders: []
    };
    
    // Check each part for reorder needs
    for (const part of spareParts) {
      const rule = reorderRules.find(r => r.sparePartId === part.id && r.isActive);
      
      if (rule && part.currentStock <= rule.reorderPoint && rule.autoOrder) {
        const supplier = supplierMap.get(rule.supplierId);
        
        if (supplier) {
          // Calculate order details  
          const quantity = rule.reorderQuantity;
          const unitPrice = parseFloat(part.unitPrice.toString());
          const totalAmount = unitPrice * quantity;
          
          // Generate unique order number
          const orderNumber = `AUTO-${Date.now()}-${part.partNumber}`;
          
          try {
            // Create purchase order
            const purchaseOrder = await gmaoStorage.createPurchaseOrder({
              orderNumber,
              supplierId: supplier.id,
              orderType: "spare_parts",
              status: "draft",
              priority: part.currentStock === 0 ? "urgent" : "high",
              requestedBy: "Système Automatique",
              totalAmount,
              currency: part.currency || "EUR",
              expectedDelivery: new Date(Date.now() + (rule.leadTime || 7) * 24 * 60 * 60 * 1000),
              deliveryAddress: "Magasin Central - Port de Marseille",
              terms: supplier.paymentTerms || "NET 30"
            });

            // Create order item
            await gmaoStorage.createPurchaseOrderItem({
              purchaseOrderId: purchaseOrder.id,
              sparePartId: part.id,
              quantity,
              unitPrice,
              totalPrice: totalAmount,
              description: `Réapprovisionnement automatique - ${part.partName}`
            });

            result.ordersCreated++;
            result.totalAmount += totalAmount;
            result.orders.push({
              partNumber: part.partNumber,
              partName: part.partName,
              quantity,
              supplier: supplier.companyName,
              amount: totalAmount
            });

            console.log(`✅ Created automatic order ${orderNumber} for ${part.partName}`);
            
          } catch (orderError) {
            console.error(`❌ Failed to create order for ${part.partNumber}:`, orderError);
          }
        }
      }
    }
    
    console.log(`🎯 Automatic procurement completed: ${result.ordersCreated} orders created`);
    
    res.json({
      success: true,
      message: `Vérification terminée avec succès`,
      triggeredRules: result.ordersCreated,
      createdOrders: result.ordersCreated,
      totalAmount: result.totalAmount,
      orders: result.orders,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ Automatic procurement failed:", error);
    res.status(500).json({
      success: false,
      message: "Échec de la vérification automatique",
      error: error instanceof Error ? error.message : "Erreur inconnue"
    });
  }
}

// Get parts that need reordering
export async function getPartsNeedingReorder(req: Request, res: Response) {
  try {
    const spareParts = await gmaoStorage.getSpareParts();
    const reorderRules = await gmaoStorage.getReorderRules();
    
    const partsNeedingReorder = spareParts
      .map(part => {
        const rule = reorderRules.find(r => r.sparePartId === part.id && r.isActive);
        if (rule && part.currentStock <= rule.reorderPoint) {
          return {
            id: part.id,
            partNumber: part.partNumber,
            partName: part.partName,
            currentStock: part.currentStock,
            reorderPoint: rule.reorderPoint,
            reorderQuantity: rule.reorderQuantity,
            autoOrder: rule.autoOrder,
            priority: part.currentStock === 0 ? "urgent" : "high"
          };
        }
        return null;
      })
      .filter(part => part !== null);

    res.json(partsNeedingReorder);
    
  } catch (error) {
    console.error("Error getting parts needing reorder:", error);
    res.status(500).json({ message: "Failed to fetch parts needing reorder" });
  }
}

// Get procurement system status
export async function getProcurementStatus(req: Request, res: Response) {
  try {
    const spareParts = await gmaoStorage.getSpareParts();
    const reorderRules = await gmaoStorage.getReorderRules();
    const purchaseOrders = await gmaoStorage.getPurchaseOrders();
    const suppliers = await gmaoStorage.getSuppliers();
    
    // Calculate statistics
    const lowStockParts = spareParts.filter(part => {
      const rule = reorderRules.find(r => r.sparePartId === part.id);
      return rule && part.currentStock <= rule.reorderPoint;
    });
    
    const activeOrders = purchaseOrders.filter(order => 
      ['draft', 'sent', 'confirmed'].includes(order.status)
    );
    
    const activeAutoRules = reorderRules.filter(rule => rule.isActive && rule.autoOrder);

    res.json({
      status: "operational",
      lastCheck: new Date().toISOString(),
      statistics: {
        totalParts: spareParts.length,
        lowStockParts: lowStockParts.length,
        activeOrders: activeOrders.length,
        activeSuppliers: suppliers.filter(s => s.isActive).length,
        autoRulesActive: activeAutoRules.length,
        totalReorderRules: reorderRules.length
      },
      systemHealth: {
        procurement: "healthy",
        suppliers: "connected", 
        automation: activeAutoRules.length > 0 ? "enabled" : "disabled"
      }
    });
    
  } catch (error) {
    console.error("Error getting procurement status:", error);
    res.status(500).json({ message: "Failed to get system status" });
  }
}