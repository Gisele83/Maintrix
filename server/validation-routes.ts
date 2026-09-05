import express from "express";
import { z } from "zod";
import { gmaoStorage } from "./gmao-storage";
import { type ValidationLog, type WorkOrder, type PurchaseOrder, type UserProfile } from "@shared/schema";

const router = express.Router();

// Validation request schemas
const workOrderValidationSchema = z.object({
  workOrderId: z.number(),
  action: z.enum(["validate", "reject"]),
  validationLevel: z.number().min(1).max(2),
  comments: z.string().optional(),
  validatorId: z.number(),
});

const purchaseOrderValidationSchema = z.object({
  purchaseOrderId: z.number(),
  action: z.enum(["validate", "reject"]),
  validationLevel: z.number().min(1).max(3),
  comments: z.string().optional(),
  validatorId: z.number(),
});

// WORK ORDER VALIDATION ENDPOINTS

// Get pending work orders for validation
router.get("/work-orders/pending", async (req, res) => {
  try {
    const { validatorId, validationLevel } = req.query;
    
    if (!validatorId || !validationLevel) {
      return res.status(400).json({ message: "validatorId and validationLevel required" });
    }

    const workOrders = await gmaoStorage.getPendingWorkOrdersForValidation(
      Number(validatorId),
      Number(validationLevel)
    );
    
    res.json(workOrders);
  } catch (error) {
    console.error("Error fetching pending work orders:", error);
    res.status(500).json({ message: "Failed to fetch pending work orders" });
  }
});

// Validate or reject work order
router.post("/work-orders/validate", async (req, res) => {
  try {
    const validatedData = workOrderValidationSchema.parse(req.body);
    
    // 🔧 CORRECTION: Récupérer le tenant ID depuis la requête
    const tenantId = (req as any).tenantId || 'b5c85c4a-b8a1-49c9-9138-dae0b3dff7fa';
    
    const result = await gmaoStorage.validateWorkOrder(validatedData, tenantId);
    
    res.json({
      success: true,
      message: `Work order ${validatedData.action === "validate" ? "validated" : "rejected"} successfully`,
      workOrder: result.workOrder,
      validationLog: result.validationLog
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    console.error("Error validating work order:", error);
    res.status(500).json({ message: "Failed to validate work order" });
  }
});

// PURCHASE ORDER VALIDATION ENDPOINTS

// Get pending purchase orders for validation
router.get("/purchase-orders/pending", async (req, res) => {
  try {
    const { validatorId, validationLevel } = req.query;
    
    if (!validatorId || !validationLevel) {
      return res.status(400).json({ message: "validatorId and validationLevel required" });
    }

    const purchaseOrders = await gmaoStorage.getPendingPurchaseOrdersForValidation(
      Number(validatorId),
      Number(validationLevel)
    );
    
    res.json(purchaseOrders);
  } catch (error) {
    console.error("Error fetching pending purchase orders:", error);
    res.status(500).json({ message: "Failed to fetch pending purchase orders" });
  }
});

// Validate or reject purchase order
router.post("/purchase-orders/validate", async (req, res) => {
  try {
    const validatedData = purchaseOrderValidationSchema.parse(req.body);
    
    const result = await gmaoStorage.validatePurchaseOrder(validatedData);
    
    res.json({
      success: true,
      message: `Purchase order ${validatedData.action === "validate" ? "validated" : "rejected"} successfully`,
      purchaseOrder: result.purchaseOrder,
      validationLog: result.validationLog
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    console.error("Error validating purchase order:", error);
    res.status(500).json({ message: "Failed to validate purchase order" });
  }
});

// VALIDATION HISTORY AND AUDIT

// Get validation history for a record
router.get("/history/:recordType/:recordId", async (req, res) => {
  try {
    const { recordType, recordId } = req.params;
    
    if (!["work_order", "purchase_order"].includes(recordType)) {
      return res.status(400).json({ message: "Invalid record type" });
    }

    const history = await gmaoStorage.getValidationHistory(recordType, Number(recordId));
    res.json(history);
  } catch (error) {
    console.error("Error fetching validation history:", error);
    res.status(500).json({ message: "Failed to fetch validation history" });
  }
});

// Get validation statistics
router.get("/statistics", async (req, res) => {
  try {
    const { validatorId, dateFrom, dateTo } = req.query;
    
    const stats = await gmaoStorage.getValidationStatistics({
      validatorId: validatorId ? Number(validatorId) : undefined,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
    });
    
    res.json(stats);
  } catch (error) {
    console.error("Error fetching validation statistics:", error);
    res.status(500).json({ message: "Failed to fetch validation statistics" });
  }
});

// USER VALIDATION PERMISSIONS

// Get user validation permissions
router.get("/users/:userId/permissions", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await gmaoStorage.getUserProfile(Number(userId));
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      userId: user.id,
      username: user.username,
      role: user.role,
      validationLevel: user.validationLevel,
      canValidateWorkOrders: user.canValidateWorkOrders,
      canValidatePurchaseOrders: user.canValidatePurchaseOrders,
      maxPurchaseAmount: user.maxPurchaseAmount
    });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    res.status(500).json({ message: "Failed to fetch user permissions" });
  }
});

// Update user validation permissions
router.put("/users/:userId/permissions", async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;
    
    const updatedUser = await gmaoStorage.updateUserValidationPermissions(Number(userId), updateData);
    
    res.json({
      success: true,
      message: "User validation permissions updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("Error updating user permissions:", error);
    res.status(500).json({ message: "Failed to update user permissions" });
  }
});

// VALIDATION WORKFLOW STATUS

// Get validation workflow status for work order
router.get("/work-orders/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).tenantId || 'default-tenant';
    const status = await gmaoStorage.getWorkOrderValidationStatus(Number(id), tenantId);
    res.json(status);
  } catch (error) {
    console.error("Error fetching work order validation status:", error);
    res.status(500).json({ message: "Failed to fetch validation status" });
  }
});

// Get validation workflow status for purchase order
router.get("/purchase-orders/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const status = await gmaoStorage.getPurchaseOrderValidationStatus(Number(id));
    res.json(status);
  } catch (error) {
    console.error("Error fetching purchase order validation status:", error);
    res.status(500).json({ message: "Failed to fetch validation status" });
  }
});

export default router;