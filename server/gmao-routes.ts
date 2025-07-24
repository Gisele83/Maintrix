import type { Express } from "express";
import { gmaoStorage } from "./gmao-storage";
import {
  insertEquipmentRegistrySchema,
  insertWorkOrderSchema,
  insertPreventiveMaintenancePlanSchema,
  insertSparePartSchema,
  insertStockMovementSchema,
  insertIotSensorDataSchema,
  insertPredictiveAnalyticsSchema,
  insertKpiMetricsSchema,
  insertIntegrationLogSchema,
  insertAlertsNotificationsSchema,
  insertMaintenanceReportSchema,
  insertMonthlyReportSchema
} from "@shared/schema";
import { z } from "zod";
import { createValidationDemo } from "./create-validation-demo";

export function registerGMAORoutes(app: Express) {
  
  // ============= EQUIPMENT REGISTRY ROUTES =============
  
  // Get all equipment
  app.get("/api/equipment", async (req, res) => {
    try {
      const equipment = await gmaoStorage.getEquipmentRegistry();
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Get equipment by ID
  app.get("/api/equipment/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid equipment ID" });
      }
      const equipment = await gmaoStorage.getEquipmentById(id);
      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Create new equipment
  app.post("/api/equipment", async (req, res) => {
    try {
      const data = insertEquipmentRegistrySchema.parse(req.body);
      const equipment = await gmaoStorage.createEquipment(data);
      res.status(201).json(equipment);
    } catch (error) {
      console.error("Error creating equipment:", error);
      res.status(400).json({ message: "Failed to create equipment" });
    }
  });

  // Update equipment
  app.put("/api/equipment/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const equipment = await gmaoStorage.updateEquipment(id, updates);
      res.json(equipment);
    } catch (error) {
      console.error("Error updating equipment:", error);
      res.status(400).json({ message: "Failed to update equipment" });
    }
  });

  // Search equipment
  app.get("/api/equipment/search", async (req, res) => {
    try {
      const { equipmentType, zone, sector } = req.query;
      const equipment = await gmaoStorage.searchEquipment({
        equipmentType: equipmentType as string,
        zone: zone as string,
        sector: sector as string
      });
      res.json(equipment);
    } catch (error) {
      console.error("Error searching equipment:", error);
      res.status(500).json({ message: "Failed to search equipment" });
    }
  });

  // ============= WORK ORDERS ROUTES =============
  
  // Get all work orders
  app.get("/api/work-orders", async (req, res) => {
    try {
      const workOrders = await gmaoStorage.getWorkOrders();
      res.json(workOrders);
    } catch (error) {
      console.error("Error fetching work orders:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  // Get work order by ID
  app.get("/api/work-orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const workOrder = await gmaoStorage.getWorkOrderById(id);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }
      res.json(workOrder);
    } catch (error) {
      console.error("Error fetching work order:", error);
      res.status(500).json({ message: "Failed to fetch work order" });
    }
  });

  // Create new work order
  app.post("/api/work-orders", async (req, res) => {
    try {
      // Handle case where body might be malformed
      if (!req.body || typeof req.body !== 'object') {
        console.error("Invalid request body format:", req.body);
        return res.status(400).json({ message: "Invalid request body format" });
      }

      // Transform and clean the data before validation
      const cleanedData: any = {};
      
      // Copy and transform each field explicitly
      if (req.body.equipmentId) cleanedData.equipmentId = parseInt(req.body.equipmentId);
      if (req.body.orderType) cleanedData.orderType = req.body.orderType;
      if (req.body.title) cleanedData.title = req.body.title;
      if (req.body.description) cleanedData.description = req.body.description;
      if (req.body.priority) cleanedData.priority = req.body.priority;
      if (req.body.status) cleanedData.status = req.body.status;
      if (req.body.assignedTo) cleanedData.assignedTo = parseInt(req.body.assignedTo);
      if (req.body.requestedBy) cleanedData.requestedBy = parseInt(req.body.requestedBy);
      if (req.body.estimatedDuration) cleanedData.estimatedDuration = parseInt(req.body.estimatedDuration);
      if (req.body.scheduledStart) cleanedData.scheduledStart = new Date(req.body.scheduledStart);
      if (req.body.cost) cleanedData.cost = parseFloat(req.body.cost);
      if (req.body.notes) cleanedData.notes = req.body.notes;

      const data = insertWorkOrderSchema.parse(cleanedData);
      const workOrder = await gmaoStorage.createWorkOrder(data);
      
      console.log(`Work order created: ${workOrder.orderNumber} - ${workOrder.title}`);
      res.status(201).json(workOrder);
    } catch (error) {
      console.error("Error creating work order:", error);
      if (error.issues) {
        console.error("Validation issues:", JSON.stringify(error.issues, null, 2));
      }
      res.status(400).json({ 
        message: "Failed to create work order",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Update work order
  app.put("/api/work-orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const workOrder = await gmaoStorage.updateWorkOrder(id, updates);
      res.json(workOrder);
    } catch (error) {
      console.error("Error updating work order:", error);
      res.status(400).json({ message: "Failed to update work order" });
    }
  });

  // Get work orders by equipment
  app.get("/api/equipment/:equipmentId/work-orders", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const workOrders = await gmaoStorage.getWorkOrdersByEquipment(equipmentId);
      res.json(workOrders);
    } catch (error) {
      console.error("Error fetching work orders:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  // Get work orders by status
  app.get("/api/work-orders/status/:status", async (req, res) => {
    try {
      const status = req.params.status;
      const workOrders = await gmaoStorage.getWorkOrdersByStatus(status);
      res.json(workOrders);
    } catch (error) {
      console.error("Error fetching work orders:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  // Get work orders by assignee
  app.get("/api/users/:userId/work-orders", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const workOrders = await gmaoStorage.getWorkOrdersByAssignee(userId);
      res.json(workOrders);
    } catch (error) {
      console.error("Error fetching work orders:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  // ============= PREVENTIVE MAINTENANCE ROUTES =============
  
  // Get all preventive maintenance plans
  app.get("/api/preventive-maintenance", async (req, res) => {
    try {
      const plans = await gmaoStorage.getPreventiveMaintenancePlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching maintenance plans:", error);
      res.status(500).json({ message: "Failed to fetch maintenance plans" });
    }
  });

  // Create preventive maintenance plan
  app.post("/api/preventive-maintenance", async (req, res) => {
    try {
      const data = insertPreventiveMaintenancePlanSchema.parse(req.body);
      const plan = await gmaoStorage.createPreventiveMaintenancePlan(data);
      res.status(201).json(plan);
    } catch (error) {
      console.error("Error creating maintenance plan:", error);
      res.status(400).json({ message: "Failed to create maintenance plan" });
    }
  });

  // Update preventive maintenance plan
  app.put("/api/preventive-maintenance/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const plan = await gmaoStorage.updatePreventiveMaintenancePlan(id, updates);
      res.json(plan);
    } catch (error) {
      console.error("Error updating maintenance plan:", error);
      res.status(400).json({ message: "Failed to update maintenance plan" });
    }
  });

  // ============= SPARE PARTS ROUTES =============
  
  // Get all spare parts
  app.get("/api/spare-parts", async (req, res) => {
    try {
      const parts = await gmaoStorage.getSpareParts();
      res.json(parts);
    } catch (error) {
      console.error("Error fetching spare parts:", error);
      res.status(500).json({ message: "Failed to fetch spare parts" });
    }
  });

  // Get spare part by ID
  app.get("/api/spare-parts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const part = await gmaoStorage.getSparePartById(id);
      if (!part) {
        return res.status(404).json({ message: "Spare part not found" });
      }
      res.json(part);
    } catch (error) {
      console.error("Error fetching spare part:", error);
      res.status(500).json({ message: "Failed to fetch spare part" });
    }
  });

  // Create spare part
  app.post("/api/spare-parts", async (req, res) => {
    try {
      const data = insertSparePartSchema.parse(req.body);
      const part = await gmaoStorage.createSparePart(data);
      res.status(201).json(part);
    } catch (error) {
      console.error("Error creating spare part:", error);
      res.status(400).json({ message: "Failed to create spare part" });
    }
  });

  // Update spare part
  app.put("/api/spare-parts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const part = await gmaoStorage.updateSparePart(id, updates);
      res.json(part);
    } catch (error) {
      console.error("Error updating spare part:", error);
      res.status(400).json({ message: "Failed to update spare part" });
    }
  });

  // Get low stock parts
  app.get("/api/spare-parts/low-stock", async (req, res) => {
    try {
      const parts = await gmaoStorage.getLowStockParts();
      res.json(parts);
    } catch (error) {
      console.error("Error fetching low stock parts:", error);
      res.status(500).json({ message: "Failed to fetch low stock parts" });
    }
  });

  // ============= STOCK MOVEMENTS ROUTES =============
  
  // Get stock movements
  app.get("/api/stock-movements", async (req, res) => {
    try {
      const movements = await gmaoStorage.getStockMovements();
      res.json(movements);
    } catch (error) {
      console.error("Error fetching stock movements:", error);
      res.status(500).json({ message: "Failed to fetch stock movements" });
    }
  });

  // Create stock movement
  app.post("/api/stock-movements", async (req, res) => {
    try {
      const data = insertStockMovementSchema.parse(req.body);
      const movement = await gmaoStorage.createStockMovement(data);
      res.status(201).json(movement);
    } catch (error) {
      console.error("Error creating stock movement:", error);
      res.status(400).json({ message: "Failed to create stock movement" });
    }
  });

  // Get stock movements by part
  app.get("/api/spare-parts/:partId/movements", async (req, res) => {
    try {
      const partId = parseInt(req.params.partId);
      const movements = await gmaoStorage.getStockMovementsByPart(partId);
      res.json(movements);
    } catch (error) {
      console.error("Error fetching stock movements:", error);
      res.status(500).json({ message: "Failed to fetch stock movements" });
    }
  });

  // ============= IOT SENSOR DATA ROUTES =============
  
  // Get IoT sensor data
  app.get("/api/iot-data", async (req, res) => {
    try {
      const { equipmentId, sensorType, limit } = req.query;
      const data = await gmaoStorage.getIotSensorData(
        equipmentId ? parseInt(equipmentId as string) : undefined,
        sensorType as string,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(data);
    } catch (error) {
      console.error("Error fetching IoT data:", error);
      res.status(500).json({ message: "Failed to fetch IoT data" });
    }
  });

  // Create IoT sensor data
  app.post("/api/iot-data", async (req, res) => {
    try {
      const data = insertIotSensorDataSchema.parse(req.body);
      const sensorData = await gmaoStorage.createIotSensorData(data);
      res.status(201).json(sensorData);
    } catch (error) {
      console.error("Error creating IoT data:", error);
      res.status(400).json({ message: "Failed to create IoT data" });
    }
  });

  // Get latest sensor data for equipment
  app.get("/api/equipment/:equipmentId/sensor-data", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const data = await gmaoStorage.getLatestSensorData(equipmentId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching sensor data:", error);
      res.status(500).json({ message: "Failed to fetch sensor data" });
    }
  });

  // ============= PREDICTIVE ANALYTICS ROUTES =============
  
  // Get predictive analytics
  app.get("/api/predictive-analytics", async (req, res) => {
    try {
      const { equipmentId } = req.query;
      const analytics = await gmaoStorage.getPredictiveAnalytics(
        equipmentId ? parseInt(equipmentId as string) : undefined
      );
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching predictive analytics:", error);
      res.status(500).json({ message: "Failed to fetch predictive analytics" });
    }
  });

  // Create predictive analytics
  app.post("/api/predictive-analytics", async (req, res) => {
    try {
      const data = insertPredictiveAnalyticsSchema.parse(req.body);
      const analytics = await gmaoStorage.createPredictiveAnalytics(data);
      res.status(201).json(analytics);
    } catch (error) {
      console.error("Error creating predictive analytics:", error);
      res.status(400).json({ message: "Failed to create predictive analytics" });
    }
  });

  // Get latest predictions for equipment
  app.get("/api/equipment/:equipmentId/predictions", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const prediction = await gmaoStorage.getLatestPredictions(equipmentId);
      res.json(prediction);
    } catch (error) {
      console.error("Error fetching predictions:", error);
      res.status(500).json({ message: "Failed to fetch predictions" });
    }
  });

  // ============= KPI METRICS ROUTES =============
  
  // Get KPI metrics
  app.get("/api/kpi-metrics", async (req, res) => {
    try {
      const { equipmentId, metricType } = req.query;
      const metrics = await gmaoStorage.getKpiMetrics(
        equipmentId ? parseInt(equipmentId as string) : undefined,
        metricType as string
      );
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching KPI metrics:", error);
      res.status(500).json({ message: "Failed to fetch KPI metrics" });
    }
  });

  // Create KPI metrics
  app.post("/api/kpi-metrics", async (req, res) => {
    try {
      const data = insertKpiMetricsSchema.parse(req.body);
      const metrics = await gmaoStorage.createKpiMetrics(data);
      res.status(201).json(metrics);
    } catch (error) {
      console.error("Error creating KPI metrics:", error);
      res.status(400).json({ message: "Failed to create KPI metrics" });
    }
  });

  // ============= ALERTS AND NOTIFICATIONS ROUTES =============
  
  // Get alerts and notifications
  app.get("/api/alerts", async (req, res) => {
    try {
      const { status } = req.query;
      const alerts = await gmaoStorage.getAlertsNotifications(status as string);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // Create alert
  app.post("/api/alerts", async (req, res) => {
    try {
      const data = insertAlertsNotificationsSchema.parse(req.body);
      const alert = await gmaoStorage.createAlert(data);
      res.status(201).json(alert);
    } catch (error) {
      console.error("Error creating alert:", error);
      res.status(400).json({ message: "Failed to create alert" });
    }
  });

  // Update alert
  app.put("/api/alerts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const alert = await gmaoStorage.updateAlert(id, updates);
      res.json(alert);
    } catch (error) {
      console.error("Error updating alert:", error);
      res.status(400).json({ message: "Failed to update alert" });
    }
  });

  // Get alerts by equipment
  app.get("/api/equipment/:equipmentId/alerts", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const alerts = await gmaoStorage.getAlertsByEquipment(equipmentId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // ============= INTEGRATION ROUTES =============
  
  // Get integration logs
  app.get("/api/integration-logs", async (req, res) => {
    try {
      const { systemName } = req.query;
      const logs = await gmaoStorage.getIntegrationLog(systemName as string);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching integration logs:", error);
      res.status(500).json({ message: "Failed to fetch integration logs" });
    }
  });

  // Create integration log
  app.post("/api/integration-logs", async (req, res) => {
    try {
      const data = insertIntegrationLogSchema.parse(req.body);
      const log = await gmaoStorage.createIntegrationLog(data);
      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating integration log:", error);
      res.status(400).json({ message: "Failed to create integration log" });
    }
  });

  // ============= DASHBOARD AND ANALYTICS ROUTES =============
  
  // Get GMAO dashboard data
  app.get("/api/gmao-dashboard", async (req, res) => {
    try {
      const [
        totalEquipment,
        activeWorkOrders,
        pendingWorkOrders,
        criticalAlerts,
        lowStockParts
      ] = await Promise.all([
        gmaoStorage.getEquipmentRegistry(),
        gmaoStorage.getWorkOrdersByStatus('in_progress'),
        gmaoStorage.getWorkOrdersByStatus('pending'),
        gmaoStorage.getAlertsNotifications('active'),
        gmaoStorage.getLowStockParts()
      ]);

      const dashboardData = {
        equipmentCount: totalEquipment.length,
        activeWorkOrdersCount: activeWorkOrders.length,
        pendingWorkOrdersCount: pendingWorkOrders.length,
        criticalAlertsCount: criticalAlerts.filter(a => a.severity === 'critical').length,
        lowStockPartsCount: lowStockParts.length,
        recentWorkOrders: activeWorkOrders.slice(0, 5),
        recentAlerts: criticalAlerts.slice(0, 5),
        equipmentByType: totalEquipment.reduce((acc: any, eq) => {
          acc[eq.equipmentType] = (acc[eq.equipmentType] || 0) + 1;
          return acc;
        }, {}),
        workOrdersByStatus: {
          pending: pendingWorkOrders.length,
          in_progress: activeWorkOrders.length,
          completed: (await gmaoStorage.getWorkOrdersByStatus('completed')).length
        }
      };

      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // ============= PROCUREMENT AND SUPPLIER MANAGEMENT ROUTES =============

  // SUPPLIERS MANAGEMENT
  // OLD suppliers route - will be replaced by demo version below

  app.post("/api/suppliers", async (req, res) => {
    try {
      const supplier = await gmaoStorage.createSupplier(req.body);
      res.status(201).json(supplier);
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(500).json({ message: "Failed to create supplier" });
    }
  });

  // PURCHASE ORDERS MANAGEMENT
  // OLD purchase orders route - will be replaced by demo version below

  // Check document type based on amount
  app.post("/api/purchase-orders/document-type", async (req, res) => {
    try {
      const { amount } = req.body;
      const numAmount = parseFloat(amount);
      
      if (isNaN(numAmount)) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      // Use fixed thresholds for now (avoid database dependency)
      const purchaseOrderThreshold = 1500;
      const commandLetterThreshold = 1500;
      
      let documentType, validationLevels, message;
      
      if (numAmount <= purchaseOrderThreshold) {
        documentType = "purchase_order";
        validationLevels = 2;
        message = `Montant ≤ ${purchaseOrderThreshold}€ : Bon de Commande avec validation 2 niveaux (Chef Service + Directeur)`;
      } else {
        documentType = "command_letter";
        validationLevels = 2;
        message = `Montant > ${commandLetterThreshold}€ : Lettre de Commande avec validation 2 niveaux (Chef Service + Directeur)`;
      }

      res.json({
        documentType,
        validationLevels,
        threshold: purchaseOrderThreshold,
        commandThreshold: commandLetterThreshold,
        message
      });
    } catch (error) {
      console.error("Error determining document type:", error);
      res.status(500).json({ error: "Failed to determine document type" });
    }
  });

  app.post("/api/purchase-orders", async (req, res) => {
    try {
      // Determine document type based on amount
      const amount = parseFloat(req.body.totalAmount);
      const documentType = amount <= 1500 ? "purchase_order" : "command_letter";
      
      const orderData = {
        orderType: req.body.orderType || "spare_parts",
        requestedBy: req.body.requestedBy,
        totalAmount: req.body.totalAmount,
        priority: req.body.priority || "medium",
        documentType,
        validationStatus: "pending",
        status: "draft",
        currency: "EUR",
        // Add other required fields with defaults
        deliveryAddress: req.body.deliveryAddress || "",
        notes: req.body.description || "",
        terms: req.body.terms || ""
      };
      
      const order = await gmaoStorage.createPurchaseOrder(orderData);
      res.status(201).json({
        success: true,
        message: `${documentType === "purchase_order" ? "Bon de commande" : "Lettre de commande"} créé avec succès`,
        order
      });
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res.status(500).json({ 
        success: false,
        message: "Erreur lors de la création de la commande",
        error: error.message 
      });
    }
  });

  // REORDER RULES AND AUTOMATIC ORDERING
  app.get("/api/reorder-rules", async (req, res) => {
    try {
      const rules = await gmaoStorage.getReorderRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching reorder rules:", error);
      res.status(500).json({ message: "Failed to fetch reorder rules" });
    }
  });

  app.post("/api/reorder-rules", async (req, res) => {
    try {
      const rule = await gmaoStorage.createReorderRule(req.body);
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating reorder rule:", error);
      res.status(500).json({ message: "Failed to create reorder rule" });
    }
  });

  // Trigger automatic reorder check - DIRECT DEMO
  app.post("/api/trigger-reorder-check", (req, res) => {
    console.log("🚀 Demo: Automatic procurement system...");
    
    res.json({
      success: true,
      message: "Vérification automatique terminée avec succès",
      triggeredRules: 4,
      createdOrders: 4,
      totalAmount: 7132.50,
      orders: [
        {
          partNumber: "ROB-001",
          partName: "Roulement moteur principal STS",
          quantity: 20,
          supplier: "SKF Roulements France",
          amount: 3000.00,
          priority: "urgent"
        },
        {
          partNumber: "JNT-002", 
          partName: "Joint pompe hydraulique RTG",
          quantity: 15,
          supplier: "Grundfos Pompes",
          amount: 382.50,
          priority: "high"
        },
        {
          partNumber: "CTR-003",
          partName: "Contacteur électrique 40A", 
          quantity: 10,
          supplier: "Schneider Electric",
          amount: 850.00,
          priority: "high"
        },
        {
          partNumber: "BLT-005",
          partName: "Courroie transmission principale",
          quantity: 12,
          supplier: "Siemens Industrial Solutions", 
          amount: 900.00,
          priority: "high"
        }
      ],
      timestamp: new Date().toISOString()
    });
  });

  // Get parts needing reorder - DIRECT DEMO
  app.get("/api/parts-needing-reorder", (req, res) => {
    res.json([
      {
        id: 1,
        partNumber: "ROB-001",
        partName: "Roulement moteur principal STS",
        currentStock: 2,
        reorderPoint: 5,
        reorderQuantity: 20,
        autoOrder: true,
        priority: "urgent",
        supplier: "SKF Roulements France",
        unitPrice: 150.00,
        estimatedCost: 3000.00
      },
      {
        id: 2, 
        partNumber: "JNT-002",
        partName: "Joint pompe hydraulique RTG",
        currentStock: 1,
        reorderPoint: 3,
        reorderQuantity: 15,
        autoOrder: true,
        priority: "high",
        supplier: "Grundfos Pompes",
        unitPrice: 25.50,
        estimatedCost: 382.50
      },
      {
        id: 3,
        partNumber: "CTR-003", 
        partName: "Contacteur électrique 40A",
        currentStock: 1,
        reorderPoint: 2,
        reorderQuantity: 10,
        autoOrder: true,
        priority: "high",
        supplier: "Schneider Electric",
        unitPrice: 85.00,
        estimatedCost: 850.00
      },
      {
        id: 5,
        partNumber: "BLT-005",
        partName: "Courroie transmission principale",
        currentStock: 2,
        reorderPoint: 4, 
        reorderQuantity: 12,
        autoOrder: true,
        priority: "high",
        supplier: "Siemens Industrial Solutions",
        unitPrice: 75.00,
        estimatedCost: 900.00
      }
    ]);
  });

  // Get suppliers - DIRECT DEMO
  app.get("/api/suppliers", (req, res) => {
    res.json([
      {
        id: 1,
        supplierCode: "SUP001",
        companyName: "Siemens Industrial Solutions",
        contactPerson: "Marie Dubois",
        email: "marie.dubois@siemens.com", 
        phone: "+33 1 49 22 33 44",
        rating: 4,
        paymentTerms: "NET 30",
        deliveryTime: 7,
        isActive: true,
        lastOrder: "2025-01-20"
      },
      {
        id: 2,
        supplierCode: "SUP002", 
        companyName: "SKF Roulements France",
        contactPerson: "Jean Martin",
        email: "jean.martin@skf.com",
        phone: "+33 1 64 49 30 00", 
        rating: 5,
        paymentTerms: "NET 30",
        deliveryTime: 3,
        isActive: true,
        lastOrder: "2025-01-23"
      },
      {
        id: 3,
        supplierCode: "SUP003",
        companyName: "Schneider Electric",
        contactPerson: "Pierre Lefebvre", 
        email: "pierre.lefebvre@schneider-electric.com",
        phone: "+33 1 41 29 70 00",
        rating: 4,
        paymentTerms: "NET 30", 
        deliveryTime: 5,
        isActive: true,
        lastOrder: "2025-01-18"
      },
      {
        id: 4,
        supplierCode: "SUP004",
        companyName: "Grundfos Pompes",
        contactPerson: "Sophie Durand",
        email: "sophie.durand@grundfos.com",
        phone: "+33 1 56 52 65 00",
        rating: 4,
        paymentTerms: "NET 30",
        deliveryTime: 5,
        isActive: true,
        lastOrder: "2025-01-22"
      },
      {
        id: 5,
        supplierCode: "SUP005", 
        companyName: "Atlas Copco France",
        contactPerson: "Marc Rousseau",
        email: "marc.rousseau@atlascopco.com",
        phone: "+33 1 39 30 68 00",
        rating: 4,
        paymentTerms: "NET 30",
        deliveryTime: 10,
        isActive: true,
        lastOrder: "2025-01-15"
      }
    ]);
  });

  // Get purchase orders - DIRECT DEMO
  app.get("/api/purchase-orders", (req, res) => {
    res.json([
      {
        id: 1,
        orderNumber: "AUTO-20250124-ROB-001",
        supplierId: 2,
        supplierName: "SKF Roulements France",
        status: "sent",
        priority: "urgent", 
        totalAmount: 3000.00,
        currency: "EUR",
        requestedBy: "Système Automatique",
        expectedDelivery: "2025-01-31",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 2,
        orderNumber: "AUTO-20250124-JNT-002", 
        supplierId: 4,
        supplierName: "Grundfos Pompes",
        status: "draft",
        priority: "high",
        totalAmount: 382.50,
        currency: "EUR",
        requestedBy: "Système Automatique", 
        expectedDelivery: "2025-01-29",
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 3,
        orderNumber: "AUTO-20250124-CTR-003",
        supplierId: 3,
        supplierName: "Schneider Electric",
        status: "confirmed",
        priority: "high",
        totalAmount: 850.00,
        currency: "EUR",
        requestedBy: "Système Automatique",
        expectedDelivery: "2025-01-27", 
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      }
    ]);
  });

  // ============= MAINTENANCE REPORTS ROUTES =============

  // Generate maintenance report
  app.post("/api/maintenance-reports", async (req, res) => {
    try {
      const { workOrderId, ...reportData } = req.body;
      const report = await gmaoStorage.generateMaintenanceReport(workOrderId, reportData);
      res.status(201).json(report);
    } catch (error) {
      console.error("Error generating maintenance report:", error);
      res.status(400).json({ message: "Failed to generate maintenance report" });
    }
  });

  // Get maintenance reports - Override with DEMO data
  app.get("/api/maintenance-reports", (req, res) => {
    try {
      // Return demo data for testing
      res.json([
        {
          id: 1,
          reportNumber: "MR20250124001",
          workOrderId: 1,
          equipmentId: 1,
          reportType: "corrective",
          interventionType: "repair",
          technician: "Jean Dupont",
          supervisor: "Marie Martin",
          startTime: "2025-01-24T08:00:00Z",
          endTime: "2025-01-24T12:30:00Z",
          actualDuration: 270,
          plannedDuration: 240,
          workDescription: "Remplacement du roulement défaillant sur grue portique STS-01",
          problemDiagnosis: "Usure prématurée du roulement principal due à une lubrification insuffisante",
          actionsTaken: "Démontage de l'ancien roulement, nettoyage complet, installation du nouveau roulement SKF, re-lubrification selon spécifications",
          partsUsed: [
            { partId: 1, partNumber: "SKF-22228-E1", quantity: 1, cost: 890.50 },
            { partId: 2, partNumber: "SHELL-GADUS-S2", quantity: 2, cost: 45.00 }
          ],
          toolsUsed: ["Extracteur hydraulique", "Clé dynamométrique", "Pistolet à graisse"],
          safetyIncidents: null,
          qualityCheck: true,
          qualityNotes: "Contrôle vibratoire validé, fonctionnement nominal",
          followUpRequired: true,
          followUpDate: "2025-02-24T00:00:00Z",
          followUpNotes: "Contrôle de la lubrification dans 1 mois",
          totalCost: 1160.50,
          laborCost: 225.00,
          partsCost: 935.50,
          status: "approved",
          approvedBy: "Marie Martin",
          approvalDate: "2025-01-24T13:00:00Z",
          createdAt: "2025-01-24T12:45:00Z",
          updatedAt: "2025-01-24T13:00:00Z"
        },
        {
          id: 2,
          reportNumber: "MR20250123002",
          workOrderId: 2,
          equipmentId: 2,
          reportType: "preventive",
          interventionType: "inspection",
          technician: "Pierre Leroy",
          supervisor: null,
          startTime: "2025-01-23T14:00:00Z",
          endTime: "2025-01-23T16:00:00Z",
          actualDuration: 120,
          plannedDuration: 120,
          workDescription: "Maintenance préventive trimestrielle - Grue RTG-02",
          problemDiagnosis: null,
          actionsTaken: "Inspection visuelle complète, contrôle des câbles, graissage des points de lubrification, test des systèmes de sécurité",
          partsUsed: [
            { partId: 3, partNumber: "GREASE-GENERAL", quantity: 1, cost: 25.00 }
          ],
          toolsUsed: ["Pistolet à graisse", "Multimètre", "Endoscope"],
          safetyIncidents: null,
          qualityCheck: true,
          qualityNotes: "Tous les systèmes fonctionnent correctement",
          followUpRequired: false,
          followUpDate: null,
          followUpNotes: null,
          totalCost: 125.00,
          laborCost: 100.00,
          partsCost: 25.00,
          status: "approved",
          approvedBy: "Système automatique",
          approvalDate: "2025-01-23T16:15:00Z",
          createdAt: "2025-01-23T16:10:00Z",
          updatedAt: "2025-01-23T16:15:00Z"
        },
        {
          id: 3,
          reportNumber: "MR20250122003",
          workOrderId: 3,
          equipmentId: 3,
          reportType: "corrective",
          interventionType: "replacement",
          technician: "Sophie Dubois",
          supervisor: "Jean-Claude Marin",
          startTime: "2025-01-22T09:00:00Z",
          endTime: "2025-01-22T17:30:00Z",
          actualDuration: 510,
          plannedDuration: 480,
          workDescription: "Remplacement du moteur hydraulique défaillant sur reach stacker RS-01",
          problemDiagnosis: "Fuite interne importante du moteur hydraulique, perte de puissance",
          actionsTaken: "Démontage complet du groupe hydraulique, remplacement du moteur, test de pression, remise en service",
          partsUsed: [
            { partId: 4, partNumber: "BOSCH-A2FM80", quantity: 1, cost: 2850.00 },
            { partId: 5, partNumber: "JOINT-KIT-HYD", quantity: 1, cost: 125.00 }
          ],
          toolsUsed: ["Pont roulant", "Clés hydrauliques", "Manomètre"],
          safetyIncidents: "Petite fuite d'huile hydraulique nettoyée immédiatement",
          qualityCheck: true,
          qualityNotes: "Test de charge validé à 80% de la capacité maximale",
          followUpRequired: true,
          followUpDate: "2025-01-29T00:00:00Z",
          followUpNotes: "Contrôle après 40h de fonctionnement",
          totalCost: 3400.00,
          laborCost: 425.00,
          partsCost: 2975.00,
          status: "approved",
          approvedBy: "Jean-Claude Marin",
          approvalDate: "2025-01-22T18:00:00Z",
          createdAt: "2025-01-22T17:45:00Z",
          updatedAt: "2025-01-22T18:00:00Z"
        }
      ]);
    } catch (error) {
      console.error("Error fetching maintenance reports:", error);
      res.status(500).json({ message: "Failed to fetch maintenance reports" });
    }
  });

  // ============= MONTHLY REPORTS ROUTES =============

  // Generate monthly report
  app.post("/api/monthly-reports", async (req, res) => {
    try {
      const { month, year, generatedBy } = req.body;
      const report = await gmaoStorage.generateMonthlyReport(month, year, generatedBy);
      res.status(201).json(report);
    } catch (error) {
      console.error("Error generating monthly report:", error);
      res.status(400).json({ message: "Failed to generate monthly report" });
    }
  });

  // Get monthly reports - DEMO VERSION
  app.get("/api/monthly-reports", async (req, res) => {
    try {
      // Return demo data for now since database implementation needs more work
      res.json([
        {
          id: 1,
          reportNumber: "MM20250124001",
          month: 1,
          year: 2025,
          periodStart: "2025-01-01T00:00:00Z",
          periodEnd: "2025-01-31T23:59:59Z",
          generatedBy: "Système GMAO",
          generatedAt: new Date().toISOString(),
          totalEquipment: 5,
          activeEquipment: 4,
          equipmentAvailability: 85.2,
          totalWorkOrders: 12,
          completedWorkOrders: 9,
          preventiveWorkOrders: 7,
          correctiveWorkOrders: 5,
          averageCompletionTime: 3.2,
          mtbf: 168.5,
          mttr: 2.8,
          plannedMaintenanceRatio: 58.3,
          maintenanceEfficiency: 75.0,
          totalMaintenanceCost: 15420.75,
          laborCost: 8950.00,
          partsCost: 6470.75,
          contractorCost: 0,
          costPerWorkOrder: 1285.06,
          partsConsumed: 23,
          inventoryTurnover: 4.2,
          stockouts: 2,
          emergencyPurchases: 1,
          totalAlerts: 18,
          criticalAlerts: 3,
          safetyIncidents: 0,
          qualityIssues: 1,
          performanceScore: 78,
          improvementAreas: ["Maintenance préventive", "Disponibilité équipements"],
          recommendations: [
            "Augmenter la proportion de maintenance préventive pour réduire les pannes",
            "Optimiser la planification des interventions pour améliorer la disponibilité",
            "Renforcer la surveillance préventive pour réduire les alertes critiques"
          ],
          statisticsData: {
            equipmentByType: {
              "Grue portique": 2,
              "Grue mobile": 1,
              "Reach stacker": 1,
              "Spreader": 1
            },
            workOrdersByStatus: {
              "completed": 9,
              "in_progress": 2,
              "pending": 1
            }
          },
          chartsData: {
            equipmentAvailabilityChart: {
              labels: ["Disponible", "En maintenance", "Arrêté"],
              data: [4, 1, 0]
            },
            maintenanceTypeChart: {
              labels: ["Préventive", "Corrective"],
              data: [7, 5]
            },
            costBreakdownChart: {
              labels: ["Main d'œuvre", "Pièces détachées"],
              data: [8950, 6470.75]
            }
          },
          status: "generated",
          notes: "Rapport automatique généré par le système GMAO"
        }
      ]);
    } catch (error) {
      console.error("Error fetching monthly reports:", error);
      res.status(500).json({ message: "Failed to fetch monthly reports" });
    }
  });



  // ============= COMPANY CONFIGURATION ROUTES =============
  
  // Get company configuration
  app.get("/api/company-config", async (req, res) => {
    try {
      const config = await gmaoStorage.getCompanyConfig();
      if (!config) {
        return res.json({
          companyName: "Votre Entreprise",
          address: "",
          phone: "",
          email: "",
          website: "",
          taxNumber: "",
          primaryColor: "#0066cc",
          secondaryColor: "#f8f9fa",
          fontFamily: "Arial, sans-serif"
        });
      }
      res.json(config);
    } catch (error) {
      console.error("Error fetching company config:", error);
      res.status(500).json({ message: "Failed to fetch company configuration" });
    }
  });

  // Get document type based on amount
  app.post("/api/purchase-orders/document-type", async (req, res) => {
    try {
      const { amount } = req.body;
      
      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ message: "Montant invalide" });
      }
      
      const config = await gmaoStorage.getCompanyConfig();
      const purchaseThreshold = parseFloat(config?.purchaseOrderThreshold || "1500.00");
      const commandThreshold = parseFloat(config?.commandLetterThreshold || "1500.01");
      
      const amountValue = parseFloat(amount);
      let documentType: string;
      let validationLevels: number;
      
      if (amountValue <= purchaseThreshold) {
        documentType = "purchase_order";
        validationLevels = 2; // Standard validation levels
      } else if (amountValue >= commandThreshold) {
        documentType = "command_letter";
        validationLevels = 3; // Enhanced validation for command letters
      } else {
        documentType = "purchase_order"; // Default to purchase order for edge cases
        validationLevels = 2;
      }
      
      res.json({
        documentType,
        validationLevels,
        threshold: purchaseThreshold,
        commandThreshold,
        message: `Montant ${amountValue}€ → ${documentType === "purchase_order" ? "Bon de Commande" : "Lettre de Commande"}`
      });
    } catch (error) {
      console.error("Error determining document type:", error);
      res.status(500).json({ message: "Failed to determine document type" });
    }
  });

  // Create or update company configuration  
  app.post("/api/company-config", async (req, res) => {
    try {
      const existingConfig = await gmaoStorage.getCompanyConfig();
      
      if (existingConfig) {
        const updatedConfig = await gmaoStorage.updateCompanyConfig(existingConfig.id, req.body);
        res.json({
          success: true,
          message: "Configuration mise à jour avec succès",
          config: updatedConfig
        });
      } else {
        const newConfig = await gmaoStorage.createCompanyConfig(req.body);
        res.json({
          success: true,
          message: "Configuration créée avec succès",
          config: newConfig
        });
      }
    } catch (error) {
      console.error("Error saving company config:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to save company configuration" 
      });
    }
  });

  // Generate purchase order with letterhead
  app.get("/api/purchase-orders/:id/letterhead", async (req, res) => {
    try {
      const purchaseOrderId = parseInt(req.params.id);
      
      // For demo purposes, use demo data directly
      const demoPurchaseOrders = [
        {
          id: 1,
          orderNumber: "PO-2025-001",
          orderType: "Pièces de rechange",
          description: "Commande de roulements et joints pour maintenance préventive",
          supplier: "Roulement Industriel SA",
          items: [
            { partNumber: "RLT-001", description: "Roulement SKF 6308", quantity: 4, unitPrice: 125.50 },
            { partNumber: "JNT-045", description: "Joint hydraulique NBR", quantity: 10, unitPrice: 15.20 }
          ],
          totalAmount: "654.00",
          currency: "EUR",
          validationStatus: "pending",
          priority: "medium",
          requestedBy: "Jean Martin",
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          createdAt: new Date()
        },
        {
          id: 2,
          orderNumber: "PO-2025-002",
          orderType: "Équipement",
          description: "Acquisition d'un nouveau moteur électrique haute performance",
          supplier: "Moteurs Électriques Pro", 
          items: [
            { partNumber: "MOT-HP-75", description: "Moteur 75kW IP55 IE4", quantity: 1, unitPrice: 4250.00 }
          ],
          totalAmount: "4250.00",
          currency: "EUR",
          validationStatus: "pending",
          priority: "high",
          requestedBy: "Marie Dupont",
          deliveryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          createdAt: new Date()
        }
      ];
      
      const demoOrder = demoPurchaseOrders.find(order => order.id === purchaseOrderId);
      
      if (!demoOrder) {
        return res.status(404).json({ message: "Bon de commande introuvable" });
      }
      
      const html = await gmaoStorage.generatePurchaseOrderWithLetterhead(purchaseOrderId, demoOrder);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      console.error("Error generating purchase order with letterhead:", error);
      res.status(500).json({ message: "Failed to generate purchase order with letterhead" });
    }
  });

  // Mark purchase order as printed (Service Achat final step)
  app.post("/api/purchase-orders/:id/mark-printed", async (req, res) => {
    try {
      const purchaseOrderId = parseInt(req.params.id);
      const { printedBy, printedAt } = req.body;
      
      const updatedOrder = await gmaoStorage.updatePurchaseOrder(purchaseOrderId, {
        validationStatus: "printed",
        printedBy: printedBy || 1, // Service Achat user ID
        printedAt: printedAt ? new Date(printedAt) : new Date()
      });
      
      res.json({
        success: true,
        message: "Bon de commande marqué comme imprimé",
        purchaseOrder: updatedOrder
      });
    } catch (error) {
      console.error("Error marking purchase order as printed:", error);
      res.status(500).json({ message: "Failed to mark purchase order as printed" });
    }
  });

  // Add supporting documents to purchase order
  app.post("/api/purchase-orders/:id/documents", async (req, res) => {
    try {
      const purchaseOrderId = parseInt(req.params.id);
      const { documents } = req.body;
      
      const updatedOrder = await gmaoStorage.updatePurchaseOrder(purchaseOrderId, {
        documentsJustificatifs: documents
      });
      
      res.json({
        success: true,
        message: "Documents justificatifs ajoutés",
        purchaseOrder: updatedOrder
      });
    } catch (error) {
      console.error("Error adding documents to purchase order:", error);
      res.status(500).json({ message: "Failed to add documents to purchase order" });
    }
  });

  // Download purchase order as PDF endpoint (placeholder)
  app.get("/api/purchase-orders/:id/pdf", async (req, res) => {
    try {
      const purchaseOrderId = parseInt(req.params.id);
      const html = await gmaoStorage.generatePurchaseOrderWithLetterhead(purchaseOrderId);
      
      // In a real implementation, you would convert HTML to PDF here
      // For now, we'll return the HTML with PDF headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="bon_commande_${purchaseOrderId}.pdf"`);
      res.send(html);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // ============= VALIDATION DEMO ROUTES =============
  
  // Create sample validation data for testing
  app.post("/api/create-validation-demo", async (req, res) => {
    try {
      const result = await createValidationDemo();
      res.json(result);
    } catch (error) {
      console.error("Error creating validation demo:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erreur lors de la création des données de démonstration",
        error: error.message 
      });
    }
  });

  console.log("✅ GMAO routes registered successfully");
}