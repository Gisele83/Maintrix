/**
 * Purchase Order and Supplier Management Routes
 * Gestion des bons de commande et fournisseurs avec commandes automatiques
 */

import { Router } from "express";
import { gmaoStorage } from "./gmao-storage";
import { checkAndCreateAutomaticOrders, getAutomaticOrderingStatus } from "./automated-procurement";
import { 
  insertSupplierSchema, 
  insertPurchaseOrderSchema,
  insertPurchaseOrderItemSchema,
  insertReorderRuleSchema 
} from "@shared/schema";
import { z } from "zod";
import { 
  uploadPurchaseOrderAttachments, 
  formatAttachmentMetadata, 
  deleteAttachment,
  getAttachmentPath,
  attachmentExists,
  type AttachmentMetadata 
} from "./purchase-order-attachments";
import fs from 'fs';

const router = Router();

// SUPPLIERS MANAGEMENT - GESTION DES FOURNISSEURS

// Get all suppliers
router.get("/suppliers", async (req, res) => {
  try {
    const suppliers = await gmaoStorage.getSuppliers();
    res.json(suppliers);
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    res.status(500).json({ message: "Failed to fetch suppliers" });
  }
});

// Get supplier by ID
router.get("/suppliers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid supplier ID" });
    }

    const supplier = await gmaoStorage.getSupplierById(id);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    res.json(supplier);
  } catch (error) {
    console.error("Error fetching supplier:", error);
    res.status(500).json({ message: "Failed to fetch supplier" });
  }
});

// Create new supplier
router.post("/suppliers", async (req, res) => {
  try {
    const validatedData = insertSupplierSchema.parse(req.body);
    const supplier = await gmaoStorage.createSupplier(validatedData);
    res.status(201).json(supplier);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    console.error("Error creating supplier:", error);
    res.status(500).json({ message: "Failed to create supplier" });
  }
});

// Update supplier
router.put("/suppliers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid supplier ID" });
    }

    const validatedData = insertSupplierSchema.partial().parse(req.body);
    const supplier = await gmaoStorage.updateSupplier(id, validatedData);
    res.json(supplier);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    console.error("Error updating supplier:", error);
    res.status(500).json({ message: "Failed to update supplier" });
  }
});

// PURCHASE ORDERS MANAGEMENT - GESTION DES BONS DE COMMANDE

// Get all purchase orders
router.get("/purchase-orders", async (req, res) => {
  try {
    const { status } = req.query;
    let orders;
    
    if (status && typeof status === "string") {
      orders = await gmaoStorage.getPurchaseOrdersByStatus(status);
    } else {
      orders = await gmaoStorage.getPurchaseOrders();
    }
    
    res.json(orders);
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    res.status(500).json({ message: "Failed to fetch purchase orders" });
  }
});

// Get purchase order by ID with items
router.get("/purchase-orders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid purchase order ID" });
    }

    const order = await gmaoStorage.getPurchaseOrderById(id);
    if (!order) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    const items = await gmaoStorage.getPurchaseOrderItems(id);
    res.json({ ...order, items });
  } catch (error) {
    console.error("Error fetching purchase order:", error);
    res.status(500).json({ message: "Failed to fetch purchase order" });
  }
});

// Create new purchase order
router.post("/purchase-orders", async (req, res) => {
  try {
    const { items, ...orderData } = req.body;
    
    // Validate purchase order data
    const validatedOrderData = insertPurchaseOrderSchema.parse(orderData);
    
    // Create purchase order
    const order = await gmaoStorage.createPurchaseOrder(validatedOrderData);
    
    // Add items if provided
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const validatedItem = insertPurchaseOrderItemSchema.parse({
          ...item,
          purchaseOrderId: order.id
        });
        await gmaoStorage.createPurchaseOrderItem(validatedItem);
      }
    }
    
    // Get complete order with items
    const completeOrder = await gmaoStorage.getPurchaseOrderById(order.id);
    const orderItems = await gmaoStorage.getPurchaseOrderItems(order.id);
    
    res.status(201).json({ ...completeOrder, items: orderItems });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    console.error("Error creating purchase order:", error);
    res.status(500).json({ message: "Failed to create purchase order" });
  }
});

// Update purchase order status
router.put("/purchase-orders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid purchase order ID" });
    }

    const validatedData = insertPurchaseOrderSchema.partial().parse(req.body);
    const order = await gmaoStorage.updatePurchaseOrder(id, validatedData);
    res.json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    console.error("Error updating purchase order:", error);
    res.status(500).json({ message: "Failed to update purchase order" });
  }
});

// REORDER RULES MANAGEMENT - GESTION DES RÈGLES DE RÉAPPROVISIONNEMENT

// Get all reorder rules
router.get("/reorder-rules", async (req, res) => {
  try {
    const rules = await gmaoStorage.getReorderRules();
    res.json(rules);
  } catch (error) {
    console.error("Error fetching reorder rules:", error);
    res.status(500).json({ message: "Failed to fetch reorder rules" });
  }
});

// Create reorder rule for a spare part
router.post("/reorder-rules", async (req, res) => {
  try {
    const validatedData = insertReorderRuleSchema.parse(req.body);
    const rule = await gmaoStorage.createReorderRule(validatedData);
    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    console.error("Error creating reorder rule:", error);
    res.status(500).json({ message: "Failed to create reorder rule" });
  }
});

// Update reorder rule
router.put("/reorder-rules/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid reorder rule ID" });
    }

    const validatedData = insertReorderRuleSchema.partial().parse(req.body);
    const rule = await gmaoStorage.updateReorderRule(id, validatedData);
    res.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    console.error("Error updating reorder rule:", error);
    res.status(500).json({ message: "Failed to update reorder rule" });
  }
});

// AUTOMATIC ORDERING SYSTEM - SYSTÈME DE COMMANDE AUTOMATIQUE

// Get parts needing reorder
router.get("/parts-needing-reorder", async (req, res) => {
  try {
    const parts = await gmaoStorage.getPartsNeedingReorder();
    res.json(parts);
  } catch (error) {
    console.error("Error fetching parts needing reorder:", error);
    res.status(500).json({ message: "Failed to fetch parts needing reorder" });
  }
});

// Trigger stock check and automatic reordering
router.post("/trigger-reorder-check", async (req, res) => {
  try {
    const result = await gmaoStorage.checkStockLevelsAndTriggerReorders();
    res.json({
      message: "Stock check completed",
      triggeredRules: result.triggeredRules.length,
      createdOrders: result.createdOrders.length,
      details: result
    });
  } catch (error) {
    console.error("Error during reorder check:", error);
    res.status(500).json({ message: "Failed to complete reorder check" });
  }
});

// Generate purchase order PDF/Email (future enhancement)
router.post("/purchase-orders/:id/send", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid purchase order ID" });
    }

    const order = await gmaoStorage.getPurchaseOrderById(id);
    if (!order) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    const supplier = await gmaoStorage.getSupplierById(order.supplierId!);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    // Update order status to sent
    await gmaoStorage.updatePurchaseOrder(id, { 
      status: "sent" 
    });

    // In a real implementation, this would generate PDF and send email
    console.log(`Purchase Order ${order.orderNumber} sent to ${supplier.companyName} at ${supplier.email}`);

    res.json({ 
      message: "Purchase order sent successfully",
      orderNumber: order.orderNumber,
      supplierEmail: supplier.email 
    });
  } catch (error) {
    console.error("Error sending purchase order:", error);
    res.status(500).json({ message: "Failed to send purchase order" });
  }
});

// ============= PIÈCES JUSTIFICATIVES (ATTACHMENTS) =============

// Upload attachments for purchase order
router.post("/purchase-orders/:id/attachments", 
  uploadPurchaseOrderAttachments.array('attachments', 5),
  async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid purchase order ID" });
      }

      // Vérifier que le bon de commande existe
      const order = await gmaoStorage.getPurchaseOrderById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Purchase order not found" });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      // Récupérer l'ID utilisateur si disponible
      const uploadedBy = (req as any).user?.id;

      // Formater les métadonnées des fichiers
      const newAttachments: AttachmentMetadata[] = files.map(file => 
        formatAttachmentMetadata(file, uploadedBy)
      );

      // Récupérer les pièces justificatives existantes
      const existingAttachments = order.documentsJustificatifs as AttachmentMetadata[] || [];

      // Combiner les anciennes et nouvelles pièces
      const allAttachments = [...existingAttachments, ...newAttachments];

      // Mettre à jour le bon de commande
      const updatedOrder = await gmaoStorage.updatePurchaseOrder(orderId, {
        documentsJustificatifs: allAttachments
      });

      res.json({
        message: `${files.length} fichier(s) uploadé(s) avec succès`,
        attachments: newAttachments,
        totalAttachments: allAttachments.length
      });
    } catch (error) {
      console.error("Error uploading attachments:", error);
      res.status(500).json({ 
        message: "Failed to upload attachments",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
);

// Get attachments list for a purchase order
router.get("/purchase-orders/:id/attachments", async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid purchase order ID" });
    }

    const order = await gmaoStorage.getPurchaseOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    const attachments = (order.documentsJustificatifs as AttachmentMetadata[]) || [];
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching attachments:", error);
    res.status(500).json({ message: "Failed to fetch attachments" });
  }
});

// Download a specific attachment
router.get("/purchase-orders/:id/attachments/:filename", async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const filename = req.params.filename;

    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid purchase order ID" });
    }

    // Vérifier que le bon de commande existe
    const order = await gmaoStorage.getPurchaseOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    // Vérifier que le fichier appartient à ce bon de commande
    const attachments = (order.documentsJustificatifs as AttachmentMetadata[]) || [];
    const attachment = attachments.find(a => a.filename === filename);
    
    if (!attachment) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    // Vérifier que le fichier existe sur le disque
    if (!attachmentExists(filename)) {
      return res.status(404).json({ message: "File not found on disk" });
    }

    const filePath = getAttachmentPath(filename);
    
    // Envoyer le fichier
    res.download(filePath, attachment.originalName, (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Error downloading file" });
        }
      }
    });
  } catch (error) {
    console.error("Error downloading attachment:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to download attachment" });
    }
  }
});

// Delete a specific attachment
router.delete("/purchase-orders/:id/attachments/:filename", async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const filename = req.params.filename;

    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid purchase order ID" });
    }

    // Récupérer le bon de commande
    const order = await gmaoStorage.getPurchaseOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    // Récupérer les pièces justificatives
    const attachments = (order.documentsJustificatifs as AttachmentMetadata[]) || [];
    const attachmentIndex = attachments.findIndex(a => a.filename === filename);
    
    if (attachmentIndex === -1) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    // Supprimer le fichier du système de fichiers
    const deleted = deleteAttachment(filename);
    if (!deleted) {
      console.warn(`File ${filename} not found on disk, but removing from database`);
    }

    // Supprimer de la liste
    const updatedAttachments = attachments.filter((_, index) => index !== attachmentIndex);

    // Mettre à jour le bon de commande
    await gmaoStorage.updatePurchaseOrder(orderId, {
      documentsJustificatifs: updatedAttachments
    });

    res.json({
      message: "Attachment deleted successfully",
      remainingAttachments: updatedAttachments.length
    });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    res.status(500).json({ message: "Failed to delete attachment" });
  }
});

export default router;