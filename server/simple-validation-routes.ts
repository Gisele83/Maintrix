import type { Express } from "express";
import { gmaoStorage } from "./gmao-storage";

// Simple validation routes for demonstration
export function registerSimpleValidationRoutes(app: Express) {
  
  // Get pending work orders for validation (simplified)
  app.get("/api/validation/work-orders/pending", async (req, res) => {
    // For demo purposes, always return demo work orders for validation testing
    const demoWorkOrders = [
      {
        id: 1,
        orderNumber: "WO-2025-001",
        title: "Maintenance préventive pompe hydraulique",
        description: "Révision complète de la pompe hydraulique principale - remplacement des joints et filtres",
        priority: "high",
        status: "pending",
        validationStatus: "pending",
        totalCost: "2500.00",
        estimatedDuration: 180,
        requestedBy: "Jean Martin",
        equipmentId: 1,
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      },
      {
        id: 2,
        orderNumber: "WO-2025-002", 
        title: "Réparation urgente moteur électrique",
        description: "Remplacement du moteur électrique du convoyeur principal suite à panne",
        priority: "urgent",
        status: "pending",
        validationStatus: "pending",
        totalCost: "8500.00",
        estimatedDuration: 300,
        requestedBy: "Marie Dupont",
        equipmentId: 2,
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      }
    ];
    res.json(demoWorkOrders);
  });

  // Get pending purchase orders for validation based on user level
  app.get("/api/validation/purchase-orders/pending", async (req, res) => {
    try {
      const { validationLevel } = req.query;
      const userLevel = parseInt(validationLevel as string) || 1;
      
      // Get orders based on validation level:
      // Level 1: pending orders (not yet validated)
      // Level 2: level1_validated orders (validated by level 1, awaiting level 2)
      // Level 3: level2_validated orders (validated by level 2, awaiting final approval)
      let targetStatus;
      switch (userLevel) {
        case 1: targetStatus = "pending"; break;
        case 2: targetStatus = "level1_validated"; break;
        case 3: targetStatus = "level2_validated"; break;
        default: targetStatus = "pending";
      }
      
      const realPurchaseOrders = await gmaoStorage.getPurchaseOrdersByStatus(targetStatus);
      
      // Convert to validation format
      const formattedRealOrders = realPurchaseOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType || "Pièces de rechange",
        description: order.notes || "Commande créée via le système",
        supplier: "Fournisseur Standard",
        totalAmount: order.totalAmount,
        currency: order.currency || "EUR",
        validationStatus: order.validationStatus,
        priority: order.priority,
        requestedBy: order.requestedBy,
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: order.createdAt,
        documentType: order.documentType
      }));

      // Only add demo orders if no real orders and level 1
      const demoPurchaseOrders = (formattedRealOrders.length === 0 && userLevel === 1) ? [
      {
        id: 1,
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
        priority: "medium",
        requestedBy: "Jean Martin",
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      },
      {
        id: 2,
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
        priority: "high", 
        requestedBy: "Marie Dupont",
        deliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      }
      ] : [];
      
      // Return real orders + demo orders if needed
      const allOrders = [...formattedRealOrders, ...demoPurchaseOrders];
      res.json(allOrders);
    } catch (error) {
      console.error("Error fetching pending purchase orders:", error);
      res.status(500).json({ message: "Failed to fetch pending orders" });
    }
  });

  // Get validation statistics and history (simplified)
  app.get("/api/validation/statistics", async (req, res) => {
    try {
      // For demo purposes, return sample validation history
      const sampleHistory = [
        {
          id: 1,
          recordType: "work_order",
          validationLevel: 1,
          action: "validate",
          validationDate: new Date().toISOString(),
          comments: "Validation niveau 1 - ordre de travail approuvé",
          validatedBy: 1
        },
        {
          id: 2,
          recordType: "purchase_order", 
          validationLevel: 2,
          action: "validate",
          validationDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          comments: "Validation niveau 2 - bon de commande approuvé",
          validatedBy: 1
        }
      ];
      
      res.json({ logs: sampleHistory });
    } catch (error) {
      console.error("Error fetching validation statistics:", error);
      res.json({ logs: [] });
    }
  });

  // Validate work order (simplified)
  app.post("/api/validation/work-orders/validate", async (req, res) => {
    try {
      const { workorderId, action, validationLevel, comments } = req.body;
      
      // For demo purposes, just update the work order status
      if (action === "validate") {
        const newStatus = validationLevel === 1 ? "level1_validated" : "fully_validated";
        
        // In a real implementation, we would update the work order validation status
        console.log(`Work order ${workorderId} ${action}d at level ${validationLevel}`);
        
        res.json({
          success: true,
          message: `Ordre de travail ${action === "validate" ? "validé" : "rejeté"} avec succès`
        });
      } else {
        console.log(`Work order ${workorderId} rejected: ${comments}`);
        res.json({
          success: true,
          message: "Ordre de travail rejeté avec succès"
        });
      }
    } catch (error) {
      console.error("Error validating work order:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erreur lors de la validation de l'ordre de travail" 
      });
    }
  });

  // Validate purchase order with real database updates
  app.post("/api/validation/purchase-orders/validate", async (req, res) => {
    try {
      const { purchaseorderId, action, validationLevel, comments, validatorId } = req.body;
      
      if (action === "validate") {
        // Update the purchase order validation status in database
        const updateData: any = {
          validationStatus: validationLevel === 1 ? "level1_validated" : "level2_validated"
        };

        // Set validation fields based on level
        if (validationLevel === 1) {
          updateData.chefServiceValidatedBy = validatorId?.toString() || "Chef Service";
          updateData.chefServiceValidatedAt = new Date();
        } else if (validationLevel === 2) {
          updateData.directeurValidatedBy = validatorId?.toString() || "Directeur Général";
          updateData.directeurValidatedAt = new Date();
          updateData.validationStatus = "level2_validated"; // Goes to Service Achat
        } else if (validationLevel === 3) {
          // Final validation by Service Achat
          updateData.validationStatus = "validated";
          updateData.canPrint = true; // Allow printing after final validation
          updateData.printedAt = new Date(); // Auto-print and save
        }

        if (comments) {
          updateData.validationNotes = comments;
        }

        await gmaoStorage.updatePurchaseOrder(purchaseorderId, updateData);
        
        res.json({
          success: true,
          message: `Bon de commande validé avec succès - Niveau ${validationLevel}`
        });
      } else {
        // Handle rejection
        const updateData: any = {
          validationStatus: "rejected",
          rejectedBy: validatorId,
          rejectedAt: new Date(),
          rejectionReason: comments || "Rejet sans commentaire"
        };

        // Set specific rejection reason based on validation level
        if (validationLevel === 1) {
          updateData.chefServiceRejectionReason = comments;
        } else if (validationLevel === 2) {
          updateData.directeurRejectionReason = comments;
        }

        await gmaoStorage.updatePurchaseOrder(purchaseorderId, updateData);
        
        res.json({
          success: true,
          message: "Bon de commande rejeté avec succès"
        });
      }
    } catch (error) {
      console.error("Error validating purchase order:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erreur lors de la validation du bon de commande" 
      });
    }
  });

  console.log("✅ Simple validation routes registered");
}