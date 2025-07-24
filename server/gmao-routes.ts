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
  insertAlertsNotificationsSchema
} from "@shared/schema";
import { z } from "zod";

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
      const data = insertWorkOrderSchema.parse(req.body);
      const workOrder = await gmaoStorage.createWorkOrder(data);
      res.status(201).json(workOrder);
    } catch (error) {
      console.error("Error creating work order:", error);
      res.status(400).json({ message: "Failed to create work order" });
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

  app.post("/api/purchase-orders", async (req, res) => {
    try {
      const order = await gmaoStorage.createPurchaseOrder(req.body);
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res.status(500).json({ message: "Failed to create purchase order" });
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
}