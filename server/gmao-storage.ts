import { db } from "./db";
import { eq, desc, and, or, gte, lte, isNull, sql } from "drizzle-orm";
import {
  equipmentRegistry,
  workOrders,
  preventiveMaintenancePlans,
  spareParts,
  stockMovements,
  iotSensorData,
  predictiveAnalytics,
  kpiMetrics,
  integrationLog,
  alertsNotifications,
  suppliers,
  purchaseOrders,
  purchaseOrderItems,
  reorderRules,
  type EquipmentRegistry,
  type InsertEquipmentRegistry,
  type WorkOrder,
  type InsertWorkOrder,
  type PreventiveMaintenancePlan,
  type InsertPreventiveMaintenancePlan,
  type SparePart,
  type InsertSparePart,
  type StockMovement,
  type InsertStockMovement,
  type IotSensorData,
  type InsertIotSensorData,
  type PredictiveAnalytics,
  type InsertPredictiveAnalytics,
  type KpiMetrics,
  type InsertKpiMetrics,
  type IntegrationLog,
  type InsertIntegrationLog,
  type AlertsNotifications,
  type InsertAlertsNotifications,
  type Supplier,
  type InsertSupplier,
  type PurchaseOrder,
  type InsertPurchaseOrder,
  type PurchaseOrderItem,
  type InsertPurchaseOrderItem,
  type ReorderRule,
  type InsertReorderRule,
} from "@shared/schema";

export class GMAOStorage {
  // Equipment Registry Methods
  async getEquipmentRegistry(): Promise<EquipmentRegistry[]> {
    return await db.select().from(equipmentRegistry).orderBy(desc(equipmentRegistry.createdAt));
  }

  async getEquipmentById(id: number): Promise<EquipmentRegistry | undefined> {
    const [equipment] = await db.select().from(equipmentRegistry).where(eq(equipmentRegistry.id, id));
    return equipment;
  }

  async getEquipmentByEquipmentId(equipmentId: string): Promise<EquipmentRegistry | undefined> {
    const [equipment] = await db.select().from(equipmentRegistry).where(eq(equipmentRegistry.equipmentId, equipmentId));
    return equipment;
  }

  async createEquipment(data: InsertEquipmentRegistry): Promise<EquipmentRegistry> {
    const [equipment] = await db.insert(equipmentRegistry).values(data).returning();
    return equipment;
  }

  async updateEquipment(id: number, updates: Partial<EquipmentRegistry>): Promise<EquipmentRegistry> {
    const [equipment] = await db
      .update(equipmentRegistry)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(equipmentRegistry.id, id))
      .returning();
    return equipment;
  }

  async searchEquipment(query: { equipmentType?: string; zone?: string; sector?: string }): Promise<EquipmentRegistry[]> {
    let whereCondition = undefined;
    const conditions = [];

    if (query.equipmentType) {
      conditions.push(eq(equipmentRegistry.equipmentType, query.equipmentType));
    }
    if (query.zone) {
      conditions.push(eq(equipmentRegistry.zone, query.zone));
    }
    if (query.sector) {
      conditions.push(eq(equipmentRegistry.sector, query.sector));
    }

    if (conditions.length > 0) {
      whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
    }

    return await db.select().from(equipmentRegistry)
      .where(whereCondition)
      .orderBy(desc(equipmentRegistry.createdAt));
  }

  // Work Orders Methods
  async getWorkOrders(): Promise<WorkOrder[]> {
    return await db.select().from(workOrders).orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrderById(id: number): Promise<WorkOrder | undefined> {
    const [workOrder] = await db.select().from(workOrders).where(eq(workOrders.id, id));
    return workOrder;
  }

  async getWorkOrdersByEquipment(equipmentId: number): Promise<WorkOrder[]> {
    return await db.select().from(workOrders)
      .where(eq(workOrders.equipmentId, equipmentId))
      .orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrdersByStatus(status: string): Promise<WorkOrder[]> {
    return await db.select().from(workOrders)
      .where(eq(workOrders.status, status))
      .orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrdersByAssignee(userId: number): Promise<WorkOrder[]> {
    return await db.select().from(workOrders)
      .where(eq(workOrders.assignedTo, userId))
      .orderBy(desc(workOrders.createdAt));
  }

  async createWorkOrder(data: InsertWorkOrder): Promise<WorkOrder> {
    // Generate unique order number
    const orderNumber = `WO-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const [workOrder] = await db.insert(workOrders).values({
      ...data,
      orderNumber
    }).returning();
    return workOrder;
  }

  async updateWorkOrder(id: number, updates: Partial<WorkOrder>): Promise<WorkOrder> {
    const [workOrder] = await db
      .update(workOrders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workOrders.id, id))
      .returning();
    return workOrder;
  }

  // Preventive Maintenance Methods
  async getPreventiveMaintenancePlans(): Promise<PreventiveMaintenancePlan[]> {
    return await db.select().from(preventiveMaintenancePlans).orderBy(desc(preventiveMaintenancePlans.createdAt));
  }

  async getPreventiveMaintenancePlanById(id: number): Promise<PreventiveMaintenancePlan | undefined> {
    const [plan] = await db.select().from(preventiveMaintenancePlans).where(eq(preventiveMaintenancePlans.id, id));
    return plan;
  }

  async getPreventiveMaintenancePlansByEquipmentType(equipmentType: string): Promise<PreventiveMaintenancePlan[]> {
    return await db.select().from(preventiveMaintenancePlans)
      .where(eq(preventiveMaintenancePlans.equipmentType, equipmentType))
      .orderBy(desc(preventiveMaintenancePlans.createdAt));
  }

  async createPreventiveMaintenancePlan(data: InsertPreventiveMaintenancePlan): Promise<PreventiveMaintenancePlan> {
    const [plan] = await db.insert(preventiveMaintenancePlans).values(data).returning();
    return plan;
  }

  async updatePreventiveMaintenancePlan(id: number, updates: Partial<PreventiveMaintenancePlan>): Promise<PreventiveMaintenancePlan> {
    const [plan] = await db
      .update(preventiveMaintenancePlans)
      .set(updates)
      .where(eq(preventiveMaintenancePlans.id, id))
      .returning();
    return plan;
  }

  // Spare Parts Methods
  async getSpareParts(): Promise<SparePart[]> {
    return await db.select().from(spareParts).orderBy(desc(spareParts.createdAt));
  }

  async getSparePartById(id: number): Promise<SparePart | undefined> {
    const [part] = await db.select().from(spareParts).where(eq(spareParts.id, id));
    return part;
  }

  async getSparePartByPartNumber(partNumber: string): Promise<SparePart | undefined> {
    const [part] = await db.select().from(spareParts).where(eq(spareParts.partNumber, partNumber));
    return part;
  }

  async getSparePartsByCategory(category: string): Promise<SparePart[]> {
    return await db.select().from(spareParts)
      .where(eq(spareParts.category, category))
      .orderBy(desc(spareParts.createdAt));
  }

  async getLowStockParts(): Promise<SparePart[]> {
    return await db.select().from(spareParts)
      .where(sql`${spareParts.currentStock} <= ${spareParts.reorderPoint}`)
      .orderBy(desc(spareParts.createdAt));
  }

  async createSparePart(data: InsertSparePart): Promise<SparePart> {
    const [part] = await db.insert(spareParts).values(data).returning();
    return part;
  }

  async updateSparePart(id: number, updates: Partial<SparePart>): Promise<SparePart> {
    const [part] = await db
      .update(spareParts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(spareParts.id, id))
      .returning();
    return part;
  }

  // Stock Movements Methods
  async getStockMovements(): Promise<StockMovement[]> {
    return await db.select().from(stockMovements).orderBy(desc(stockMovements.createdAt));
  }

  async getStockMovementsByPart(sparePartId: number): Promise<StockMovement[]> {
    return await db.select().from(stockMovements)
      .where(eq(stockMovements.sparePartId, sparePartId))
      .orderBy(desc(stockMovements.createdAt));
  }

  async createStockMovement(data: InsertStockMovement): Promise<StockMovement> {
    const [movement] = await db.insert(stockMovements).values(data).returning();
    
    // Update spare part stock
    if (data.sparePartId) {
      const part = await this.getSparePartById(data.sparePartId);
      if (part) {
        let newStock = part.currentStock || 0;
        if (data.movementType === 'in' || data.movementType === 'return') {
          newStock += data.quantity;
        } else if (data.movementType === 'out') {
          newStock -= data.quantity;
        } else if (data.movementType === 'adjustment') {
          newStock = data.quantity;
        }
        
        await this.updateSparePart(data.sparePartId, { currentStock: Math.max(0, newStock) });
      }
    }
    
    return movement;
  }

  // IoT Sensor Data Methods
  async getIotSensorData(equipmentId?: number, sensorType?: string, limit: number = 1000): Promise<IotSensorData[]> {
    let query = db.select().from(iotSensorData);
    
    const conditions = [];
    if (equipmentId) conditions.push(eq(iotSensorData.equipmentId, equipmentId));
    if (sensorType) conditions.push(eq(iotSensorData.sensorType, sensorType));
    
    if (conditions.length > 0) {
      query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
    }
    
    return await query.orderBy(desc(iotSensorData.timestamp)).limit(limit);
  }

  async createIotSensorData(data: InsertIotSensorData): Promise<IotSensorData> {
    const [sensorData] = await db.insert(iotSensorData).values(data).returning();
    return sensorData;
  }

  async getLatestSensorData(equipmentId: number): Promise<IotSensorData[]> {
    return await db.select().from(iotSensorData)
      .where(eq(iotSensorData.equipmentId, equipmentId))
      .orderBy(desc(iotSensorData.timestamp))
      .limit(10);
  }

  // Predictive Analytics Methods
  async getPredictiveAnalytics(equipmentId?: number): Promise<PredictiveAnalytics[]> {
    let query = db.select().from(predictiveAnalytics);
    
    if (equipmentId) {
      query = query.where(eq(predictiveAnalytics.equipmentId, equipmentId));
    }
    
    return await query.orderBy(desc(predictiveAnalytics.createdAt));
  }

  async createPredictiveAnalytics(data: InsertPredictiveAnalytics): Promise<PredictiveAnalytics> {
    const [analytics] = await db.insert(predictiveAnalytics).values(data).returning();
    return analytics;
  }

  async getLatestPredictions(equipmentId: number): Promise<PredictiveAnalytics | undefined> {
    const [prediction] = await db.select().from(predictiveAnalytics)
      .where(eq(predictiveAnalytics.equipmentId, equipmentId))
      .orderBy(desc(predictiveAnalytics.createdAt))
      .limit(1);
    return prediction;
  }

  // KPI Metrics Methods
  async getKpiMetrics(equipmentId?: number, metricType?: string): Promise<KpiMetrics[]> {
    let query = db.select().from(kpiMetrics);
    
    const conditions = [];
    if (equipmentId) conditions.push(eq(kpiMetrics.equipmentId, equipmentId));
    if (metricType) conditions.push(eq(kpiMetrics.metricType, metricType));
    
    if (conditions.length > 0) {
      query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
    }
    
    return await query.orderBy(desc(kpiMetrics.calculationDate));
  }

  async createKpiMetrics(data: InsertKpiMetrics): Promise<KpiMetrics> {
    const [metrics] = await db.insert(kpiMetrics).values(data).returning();
    return metrics;
  }

  // Integration Log Methods
  async getIntegrationLog(systemName?: string): Promise<IntegrationLog[]> {
    let query = db.select().from(integrationLog);
    
    if (systemName) {
      query = query.where(eq(integrationLog.systemName, systemName));
    }
    
    return await query.orderBy(desc(integrationLog.processedAt));
  }

  async createIntegrationLog(data: InsertIntegrationLog): Promise<IntegrationLog> {
    const [log] = await db.insert(integrationLog).values(data).returning();
    return log;
  }

  // Alerts and Notifications Methods
  async getAlertsNotifications(status?: string): Promise<AlertsNotifications[]> {
    let query = db.select().from(alertsNotifications);
    
    if (status) {
      query = query.where(eq(alertsNotifications.status, status));
    }
    
    return await query.orderBy(desc(alertsNotifications.createdAt));
  }

  async getAlertsByEquipment(equipmentId: number): Promise<AlertsNotifications[]> {
    return await db.select().from(alertsNotifications)
      .where(eq(alertsNotifications.equipmentId, equipmentId))
      .orderBy(desc(alertsNotifications.createdAt));
  }

  async createAlert(data: InsertAlertsNotifications): Promise<AlertsNotifications> {
    const [alert] = await db.insert(alertsNotifications).values(data).returning();
    return alert;
  }

  async updateAlert(id: number, updates: Partial<AlertsNotifications>): Promise<AlertsNotifications> {
    const [alert] = await db
      .update(alertsNotifications)
      .set(updates)
      .where(eq(alertsNotifications.id, id))
      .returning();
    return alert;
  }

  // Suppliers management
  async createSupplier(supplierData: InsertSupplier): Promise<Supplier> {
    const [supplier] = await this.db
      .insert(suppliers)
      .values(supplierData)
      .returning();
    return supplier;
  }

  async getSuppliers(): Promise<Supplier[]> {
    return await this.db.select().from(suppliers).where(eq(suppliers.isActive, true));
  }

  async getSupplierById(id: number): Promise<Supplier | undefined> {
    const [supplier] = await this.db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async updateSupplier(id: number, data: Partial<InsertSupplier>): Promise<Supplier> {
    const [supplier] = await this.db
      .update(suppliers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return supplier;
  }

  // Purchase Orders management
  async createPurchaseOrder(orderData: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const [order] = await this.db
      .insert(purchaseOrders)
      .values(orderData)
      .returning();
    return order;
  }

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return await this.db.select().from(purchaseOrders);
  }

  async getPurchaseOrderById(id: number): Promise<PurchaseOrder | undefined> {
    const [order] = await this.db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    return order;
  }

  async updatePurchaseOrder(id: number, data: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder> {
    const [order] = await this.db
      .update(purchaseOrders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning();
    return order;
  }

  async getPurchaseOrdersByStatus(status: string): Promise<PurchaseOrder[]> {
    return await this.db.select().from(purchaseOrders).where(eq(purchaseOrders.status, status));
  }

  // Purchase Order Items management
  async createPurchaseOrderItem(itemData: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const [item] = await this.db
      .insert(purchaseOrderItems)
      .values(itemData)
      .returning();
    return item;
  }

  async getPurchaseOrderItems(purchaseOrderId: number): Promise<PurchaseOrderItem[]> {
    return await this.db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
  }

  async updatePurchaseOrderItem(id: number, data: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem> {
    const [item] = await this.db
      .update(purchaseOrderItems)
      .set(data)
      .where(eq(purchaseOrderItems.id, id))
      .returning();
    return item;
  }

  // Reorder Rules management
  async createReorderRule(ruleData: InsertReorderRule): Promise<ReorderRule> {
    const [rule] = await this.db
      .insert(reorderRules)
      .values(ruleData)
      .returning();
    return rule;
  }

  async getReorderRules(): Promise<ReorderRule[]> {
    return await this.db.select().from(reorderRules).where(eq(reorderRules.isActive, true));
  }

  async getReorderRuleByPartId(sparePartId: number): Promise<ReorderRule | undefined> {
    const [rule] = await this.db.select().from(reorderRules)
      .where(and(eq(reorderRules.sparePartId, sparePartId), eq(reorderRules.isActive, true)));
    return rule;
  }

  async updateReorderRule(id: number, data: Partial<InsertReorderRule>): Promise<ReorderRule> {
    const [rule] = await this.db
      .update(reorderRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(reorderRules.id, id))
      .returning();
    return rule;
  }

  // Stock monitoring and automatic reorder
  async checkStockLevelsAndTriggerReorders(): Promise<{ triggeredRules: ReorderRule[], createdOrders: PurchaseOrder[] }> {
    const rules = await this.getReorderRules();
    const triggeredRules: ReorderRule[] = [];
    const createdOrders: PurchaseOrder[] = [];

    for (const rule of rules) {
      const part = await this.getSparePartById(rule.sparePartId);
      if (!part) continue;

      // Check if stock is below reorder point
      if (part.currentStock <= rule.reorderPoint) {
        // Check if not recently triggered (prevent spam)
        const hoursSinceLastTrigger = rule.lastTriggered 
          ? (Date.now() - rule.lastTriggered.getTime()) / (1000 * 60 * 60)
          : 24;

        if (hoursSinceLastTrigger >= 2) { // Minimum 2 hours between triggers
          triggeredRules.push(rule);

          // Update last triggered timestamp
          await this.updateReorderRule(rule.id, { lastTriggered: new Date() });

          // Generate alert
          await this.createAlert({
            alertType: "stock_low",
            equipmentId: null,
            severity: part.currentStock <= 0 ? "critical" : "high",
            title: "Stock faible détecté",
            message: `Stock de "${part.partName}" (${part.partNumber}) est descendu à ${part.currentStock} unités. Seuil de réapprovisionnement: ${rule.reorderPoint}`,
            triggerValue: part.currentStock,
            thresholdValue: rule.reorderPoint
          });

          // If auto-order is enabled, create purchase order
          if (rule.autoOrder && rule.supplierId) {
            const supplier = await this.getSupplierById(rule.supplierId);
            if (supplier) {
              const orderNumber = await this.generatePurchaseOrderNumber();
              const expectedDelivery = new Date();
              expectedDelivery.setDate(expectedDelivery.getDate() + (rule.leadTime || supplier.deliveryTime || 7));

              const purchaseOrder = await this.createPurchaseOrder({
                orderNumber,
                supplierId: rule.supplierId,
                orderType: "spare_parts",
                status: "draft",
                priority: part.currentStock <= 0 ? "urgent" : "high",
                requestedBy: "Auto-Reorder System",
                totalAmount: part.unitPrice ? parseFloat((parseFloat(part.unitPrice) * rule.reorderQuantity).toFixed(2)) : 0,
                currency: "EUR",
                expectedDelivery,
                deliveryAddress: "Magasin principal",
                notes: `Commande automatique - Stock critique atteint pour ${part.partName}`,
                terms: supplier.paymentTerms || "Standard"
              });

              // Add item to purchase order
              await this.createPurchaseOrderItem({
                purchaseOrderId: purchaseOrder.id,
                sparePartId: part.id,
                partNumber: part.partNumber,
                description: part.partName,
                quantity: rule.reorderQuantity,
                unitPrice: part.unitPrice ? parseFloat(part.unitPrice) : 0,
                totalPrice: part.unitPrice ? parseFloat((parseFloat(part.unitPrice) * rule.reorderQuantity).toFixed(2)) : 0,
                expectedDelivery
              });

              createdOrders.push(purchaseOrder);

              console.log(`Auto-order created: ${orderNumber} for ${part.partName} (${rule.reorderQuantity} units)`);
            }
          }
        }
      }
    }

    return { triggeredRules, createdOrders };
  }

  // Generate purchase order number
  private async generatePurchaseOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const orders = await this.db.select().from(purchaseOrders)
      .where(sql`EXTRACT(year FROM order_date) = ${year}`);
    
    const nextNumber = (orders.length + 1).toString().padStart(4, '0');
    return `PO${year}${nextNumber}`;
  }

  // Get parts with stock below reorder point
  async getPartsNeedingReorder(): Promise<(SparePart & { reorderRule?: ReorderRule })[]> {
    const partsQuery = await this.db.select().from(spareParts);
    const results = [];

    for (const part of partsQuery) {
      const rule = await this.getReorderRuleByPartId(part.id);
      if (rule && part.currentStock <= rule.reorderPoint) {
        results.push({ ...part, reorderRule: rule });
      }
    }

    return results;
  }
}

export const gmaoStorage = new GMAOStorage();