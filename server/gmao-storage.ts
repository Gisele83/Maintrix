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
  validationLogs,
  userProfiles,
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
  type ValidationLog,
  type InsertValidationLog,
  type UserProfile,
  maintenanceReports,
  monthlyReports,
  reportTemplates,
  type MaintenanceReport,
  type InsertMaintenanceReport,
  type MonthlyReport,
  type InsertMonthlyReport,
  type ReportTemplate,
  type InsertReportTemplate,
  companyConfig,
  type CompanyConfig,
  type InsertCompanyConfig,
} from "@shared/schema";

export class GMAOStorage {
  private db = db;
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
    return await db.select().from(suppliers).where(eq(suppliers.isActive, true));
  }

  async getSupplierById(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async updateSupplier(id: number, data: Partial<InsertSupplier>): Promise<Supplier> {
    const [supplier] = await db
      .update(suppliers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return supplier;
  }

  // Purchase Orders management
  async createPurchaseOrder(orderData: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const orderNumber = `${orderData.documentType === "command_letter" ? "CL" : "PO"}-${Date.now()}`;
    
    const [order] = await db
      .insert(purchaseOrders)
      .values({
        ...orderData,
        orderNumber,
        status: "pending"
      })
      .returning();
    return order;
  }

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders);
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
    const [rule] = await db
      .insert(reorderRules)
      .values(ruleData)
      .returning();
    return rule;
  }

  async getReorderRules(): Promise<ReorderRule[]> {
    return await db.select().from(reorderRules).where(eq(reorderRules.isActive, true));
  }

  async getReorderRuleByPartId(sparePartId: number): Promise<ReorderRule | undefined> {
    const [rule] = await db.select().from(reorderRules)
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
    const orders = await db.select().from(purchaseOrders)
      .where(sql`EXTRACT(year FROM order_date) = ${year}`);
    
    const nextNumber = (orders.length + 1).toString().padStart(4, '0');
    return `PO${year}${nextNumber}`;
  }

  // Get parts with stock below reorder point
  async getPartsNeedingReorder(): Promise<(SparePart & { reorderRule?: ReorderRule })[]> {
    const partsQuery = await db.select().from(spareParts);
    const results = [];

    for (const part of partsQuery) {
      const rule = await this.getReorderRuleByPartId(part.id);
      if (rule && part.currentStock <= rule.reorderPoint) {
        results.push({ ...part, reorderRule: rule });
      }
    }

    return results;
  }

  // ============= MAINTENANCE REPORTS MANAGEMENT =============

  // Generate maintenance report after work order completion
  async generateMaintenanceReport(workOrderId: number, reportData: Partial<InsertMaintenanceReport>): Promise<MaintenanceReport> {
    // Get work order details
    const workOrder = await this.getWorkOrderById(workOrderId);
    if (!workOrder) {
      throw new Error("Work order not found");
    }

    // Generate report number
    const reportNumber = await this.generateReportNumber("MR");
    
    // Calculate duration if not provided
    const actualDuration = reportData.actualDuration || 
      (reportData.endTime && reportData.startTime ? 
        Math.floor((new Date(reportData.endTime).getTime() - new Date(reportData.startTime).getTime()) / (1000 * 60)) : 
        null);

    // Calculate costs
    const partsCost = reportData.partsUsed ? 
      Array.isArray(reportData.partsUsed) ? 
        reportData.partsUsed.reduce((sum: number, part: any) => sum + (part.cost || 0), 0) : 0 : 0;
    
    const laborCost = reportData.laborCost || 
      (actualDuration ? (actualDuration / 60) * 50 : 0); // 50€/hour default rate

    const totalCost = partsCost + laborCost;

    const reportDataComplete: InsertMaintenanceReport = {
      reportNumber,
      workOrderId,
      equipmentId: workOrder.equipmentId,
      reportType: workOrder.orderType || "corrective",
      interventionType: reportData.interventionType || "repair",
      technician: reportData.technician || workOrder.assignedTo?.toString() || "Non spécifié",
      supervisor: reportData.supervisor,
      startTime: reportData.startTime || workOrder.createdAt || new Date(),
      endTime: reportData.endTime || new Date(),
      actualDuration,
      plannedDuration: workOrder.estimatedDuration,
      workDescription: reportData.workDescription || workOrder.description,
      problemDiagnosis: reportData.problemDiagnosis,
      actionsTaken: reportData.actionsTaken || "Intervention terminée",
      partsUsed: reportData.partsUsed,
      toolsUsed: reportData.toolsUsed,
      safetyIncidents: reportData.safetyIncidents,
      qualityCheck: reportData.qualityCheck || false,
      qualityNotes: reportData.qualityNotes,
      followUpRequired: reportData.followUpRequired || false,
      followUpDate: reportData.followUpDate,
      followUpNotes: reportData.followUpNotes,
      totalCost,
      laborCost,
      partsCost,
      status: "draft",
      ...reportData
    };

    const [report] = await db.insert(maintenanceReports).values(reportDataComplete).returning();

    // Auto-approve if no issues
    if (!reportData.safetyIncidents && !reportData.followUpRequired) {
      await this.approveMaintenanceReport(report.id, reportData.technician || "System");
    }

    console.log(`Maintenance report ${reportNumber} generated for work order ${workOrderId}`);
    return report;
  }

  // Get maintenance reports
  async getMaintenanceReports(filters?: {
    equipmentId?: number;
    reportType?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<MaintenanceReport[]> {
    let query = db.select().from(maintenanceReports);
    
    if (filters) {
      const conditions = [];
      if (filters.equipmentId) conditions.push(eq(maintenanceReports.equipmentId, filters.equipmentId));
      if (filters.reportType) conditions.push(eq(maintenanceReports.reportType, filters.reportType));
      if (filters.status) conditions.push(eq(maintenanceReports.status, filters.status));
      if (filters.startDate) conditions.push(gte(maintenanceReports.createdAt, filters.startDate));
      if (filters.endDate) conditions.push(lte(maintenanceReports.createdAt, filters.endDate));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    return query.orderBy(desc(maintenanceReports.createdAt));
  }

  // Approve maintenance report
  async approveMaintenanceReport(reportId: number, approvedBy: string): Promise<MaintenanceReport> {
    const [report] = await db
      .update(maintenanceReports)
      .set({
        status: "approved",
        approvedBy,
        approvalDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(maintenanceReports.id, reportId))
      .returning();
    return report;
  }

  // ============= MONTHLY REPORTS MANAGEMENT =============

  // Generate monthly maintenance report
  async generateMonthlyReport(month: number, year: number, generatedBy?: string): Promise<MonthlyReport> {
    const reportNumber = await this.generateReportNumber("MM");
    
    // Calculate period dates
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    // Calculate equipment statistics
    const equipment = await this.getEquipmentRegistry();
    const totalEquipment = equipment.length;
    const activeEquipment = equipment.filter(eq => eq.operationalState === "operational").length;
    const equipmentAvailability = activeEquipment > 0 ? (activeEquipment / totalEquipment) * 100 : 0;

    // Calculate work orders statistics
    const workOrders = await this.getWorkOrdersByDateRange(periodStart, periodEnd);
    const totalWorkOrders = workOrders.length;
    const completedWorkOrders = workOrders.filter(wo => wo.status === "completed").length;
    const preventiveWorkOrders = workOrders.filter(wo => wo.type === "preventive").length;
    const correctiveWorkOrders = workOrders.filter(wo => wo.type === "corrective").length;

    // Calculate average completion time
    const completedWOs = workOrders.filter(wo => wo.status === "completed" && wo.actualEndTime);
    const averageCompletionTime = completedWOs.length > 0 ? 
      completedWOs.reduce((sum, wo) => {
        const duration = wo.actualEndTime && wo.startTime ? 
          (new Date(wo.actualEndTime).getTime() - new Date(wo.startTime).getTime()) / (1000 * 60 * 60) : 0;
        return sum + duration;
      }, 0) / completedWOs.length : 0;

    // Calculate maintenance KPIs
    const maintenanceReportsInPeriod = await this.getMaintenanceReports({
      startDate: periodStart,
      endDate: periodEnd
    });

    // MTBF and MTTR calculations (simplified)
    const mtbf = totalEquipment > 0 && correctiveWorkOrders > 0 ? 
      (30 * 24 * totalEquipment) / correctiveWorkOrders : 0; // 30 days in hours per equipment
    const mttr = correctiveWorkOrders > 0 ? averageCompletionTime : 0;
    const plannedMaintenanceRatio = totalWorkOrders > 0 ? (preventiveWorkOrders / totalWorkOrders) * 100 : 0;
    const maintenanceEfficiency = completedWorkOrders > 0 ? (completedWorkOrders / totalWorkOrders) * 100 : 0;

    // Calculate costs
    const totalMaintenanceCost = maintenanceReportsInPeriod.reduce((sum, report) => {
      return sum + (parseFloat(report.totalCost?.toString() || "0"));
    }, 0);

    const laborCost = maintenanceReportsInPeriod.reduce((sum, report) => {
      return sum + (parseFloat(report.laborCost?.toString() || "0"));
    }, 0);

    const partsCost = maintenanceReportsInPeriod.reduce((sum, report) => {
      return sum + (parseFloat(report.partsCost?.toString() || "0"));
    }, 0);

    const costPerWorkOrder = completedWorkOrders > 0 ? totalMaintenanceCost / completedWorkOrders : 0;

    // Get alerts for the period
    const alerts = await this.getAlertsForPeriod(periodStart, periodEnd);
    const totalAlerts = alerts.length;
    const criticalAlerts = alerts.filter(alert => alert.severity === "critical").length;

    // Generate statistics and charts data
    const statisticsData = {
      equipmentByType: equipment.reduce((acc: any, eq) => {
        acc[eq.equipmentType] = (acc[eq.equipmentType] || 0) + 1;
        return acc;
      }, {}),
      workOrdersByStatus: workOrders.reduce((acc: any, wo) => {
        acc[wo.status] = (acc[wo.status] || 0) + 1;
        return acc;
      }, {}),
      dailyWorkOrders: this.calculateDailyWorkOrders(workOrders, periodStart, periodEnd),
      costTrends: this.calculateCostTrends(maintenanceReportsInPeriod),
      alertsByType: alerts.reduce((acc: any, alert) => {
        acc[alert.alertType] = (acc[alert.alertType] || 0) + 1;
        return acc;
      }, {})
    };

    const chartsData = {
      equipmentAvailabilityChart: {
        labels: ["Disponible", "En maintenance", "Arrêté"],
        data: [activeEquipment, totalWorkOrders, totalEquipment - activeEquipment - totalWorkOrders]
      },
      maintenanceTypeChart: {
        labels: ["Préventive", "Corrective"],
        data: [preventiveWorkOrders, correctiveWorkOrders]
      },
      costBreakdownChart: {
        labels: ["Main d'œuvre", "Pièces détachées"],
        data: [laborCost, partsCost]
      }
    };

    // Calculate performance score
    const performanceScore = this.calculatePerformanceScore({
      equipmentAvailability,
      plannedMaintenanceRatio,
      maintenanceEfficiency,
      mtbf: mtbf > 0 ? Math.min(mtbf / 100, 100) : 0 // Normalize MTBF
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      plannedMaintenanceRatio,
      equipmentAvailability,
      criticalAlerts,
      totalAlerts,
      mttr
    });

    const monthlyReportData: InsertMonthlyReport = {
      reportNumber,
      month,
      year,
      periodStart,
      periodEnd,
      generatedBy: generatedBy || "System",
      totalEquipment,
      activeEquipment,
      equipmentAvailability,
      totalWorkOrders,
      completedWorkOrders,
      preventiveWorkOrders,
      correctiveWorkOrders,
      averageCompletionTime,
      mtbf,
      mttr,
      plannedMaintenanceRatio,
      maintenanceEfficiency,
      totalMaintenanceCost,
      laborCost,
      partsCost,
      contractorCost: 0,
      costPerWorkOrder,
      partsConsumed: this.calculatePartsConsumed(maintenanceReportsInPeriod),
      inventoryTurnover: 0, // Could be calculated from stock movements
      stockouts: 0,
      emergencyPurchases: 0,
      totalAlerts,
      criticalAlerts,
      safetyIncidents: this.countSafetyIncidents(maintenanceReportsInPeriod),
      qualityIssues: this.countQualityIssues(maintenanceReportsInPeriod),
      performanceScore,
      improvementAreas: this.identifyImprovementAreas(performanceScore, plannedMaintenanceRatio, equipmentAvailability),
      recommendations,
      statisticsData,
      chartsData,
      status: "generated"
    };

    const [report] = await db.insert(monthlyReports).values(monthlyReportData).returning();
    
    console.log(`Monthly report ${reportNumber} generated for ${month}/${year}`);
    return report;
  }

  // Get monthly reports
  async getMonthlyReports(year?: number): Promise<MonthlyReport[]> {
    let query = db.select().from(monthlyReports);
    
    if (year) {
      query = query.where(eq(monthlyReports.year, year));
    }
    
    return query.orderBy(desc(monthlyReports.year), desc(monthlyReports.month));
  }

  // Helper method to generate report numbers
  private async generateReportNumber(prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-4);
    return `${prefix}${year}${month}${day}${timestamp}`;
  }

  // Helper methods for monthly report calculations
  private async getWorkOrdersByDateRange(startDate: Date, endDate: Date): Promise<WorkOrder[]> {
    return db.select().from(workOrders)
      .where(and(
        gte(workOrders.createdAt, startDate),
        lte(workOrders.createdAt, endDate)
      ));
  }

  private async getAlertsForPeriod(startDate: Date, endDate: Date): Promise<AlertsNotifications[]> {
    return db.select().from(alertsNotifications)
      .where(and(
        gte(alertsNotifications.createdAt, startDate),
        lte(alertsNotifications.createdAt, endDate)
      ));
  }

  private calculateDailyWorkOrders(workOrders: WorkOrder[], startDate: Date, endDate: Date): any[] {
    const dailyData = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayStart = new Date(current);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59);
      
      const dayWorkOrders = workOrders.filter(wo => {
        const woDate = new Date(wo.createdAt);
        return woDate >= dayStart && woDate <= dayEnd;
      });
      
      dailyData.push({
        date: current.toISOString().split('T')[0],
        count: dayWorkOrders.length
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return dailyData;
  }

  private calculateCostTrends(reports: MaintenanceReport[]): any[] {
    const costByWeek = reports.reduce((acc: any, report) => {
      const week = this.getWeekNumber(new Date(report.createdAt));
      acc[week] = (acc[week] || 0) + parseFloat(report.totalCost?.toString() || "0");
      return acc;
    }, {});
    
    return Object.entries(costByWeek).map(([week, cost]) => ({
      week: parseInt(week),
      cost
    }));
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private calculatePerformanceScore(metrics: any): number {
    const weights = {
      equipmentAvailability: 0.3,
      plannedMaintenanceRatio: 0.25,
      maintenanceEfficiency: 0.25,
      mtbf: 0.2
    };
    
    return Math.round(
      (metrics.equipmentAvailability * weights.equipmentAvailability) +
      (metrics.plannedMaintenanceRatio * weights.plannedMaintenanceRatio) +
      (metrics.maintenanceEfficiency * weights.maintenanceEfficiency) +
      (metrics.mtbf * weights.mtbf)
    );
  }

  private generateRecommendations(metrics: any): string[] {
    const recommendations = [];
    
    if (metrics.plannedMaintenanceRatio < 70) {
      recommendations.push("Augmenter la proportion de maintenance préventive pour réduire les pannes");
    }
    
    if (metrics.equipmentAvailability < 85) {
      recommendations.push("Optimiser la planification des interventions pour améliorer la disponibilité");
    }
    
    if (metrics.criticalAlerts > metrics.totalAlerts * 0.3) {
      recommendations.push("Renforcer la surveillance préventive pour réduire les alertes critiques");
    }
    
    if (metrics.mttr > 4) {
      recommendations.push("Améliorer la formation des techniciens pour réduire le temps de réparation");
    }
    
    return recommendations;
  }

  private identifyImprovementAreas(score: number, plannedRatio: number, availability: number): string[] {
    const areas = [];
    
    if (score < 70) areas.push("Performance globale");
    if (plannedRatio < 60) areas.push("Maintenance préventive");
    if (availability < 80) areas.push("Disponibilité équipements");
    
    return areas;
  }

  private calculatePartsConsumed(reports: MaintenanceReport[]): number {
    return reports.reduce((sum, report) => {
      if (report.partsUsed && Array.isArray(report.partsUsed)) {
        return sum + report.partsUsed.reduce((partSum: number, part: any) => partSum + (part.quantity || 0), 0);
      }
      return sum;
    }, 0);
  }

  private countSafetyIncidents(reports: MaintenanceReport[]): number {
    return reports.filter(report => report.safetyIncidents && report.safetyIncidents.trim().length > 0).length;
  }

  private countQualityIssues(reports: MaintenanceReport[]): number {
    return reports.filter(report => report.qualityCheck === false || 
      (report.qualityNotes && report.qualityNotes.toLowerCase().includes("problème"))).length;
  }

  // ============= VALIDATION SYSTEM METHODS =============

  // Work Order Validation Methods
  async getPendingWorkOrdersForValidation(validatorId: number, validationLevel: number): Promise<WorkOrder[]> {
    const user = await this.getUserProfile(validatorId);
    if (!user || !user.canValidateWorkOrders) {
      throw new Error("User does not have work order validation permissions");
    }

    // Get work orders that need validation at the specified level
    let query;
    if (validationLevel === 1) {
      query = and(
        eq(workOrders.validationStatus, "pending"),
        isNull(workOrders.level1ValidatedBy)
      );
    } else if (validationLevel === 2) {
      query = and(
        eq(workOrders.validationStatus, "level1_validated"),
        isNull(workOrders.level2ValidatedBy)
      );
    } else {
      throw new Error("Invalid validation level for work orders");
    }

    return await this.db.select().from(workOrders).where(query);
  }

  async validateWorkOrder(data: {
    workOrderId: number;
    action: "validate" | "reject";
    validationLevel: number;
    comments?: string;
    validatorId: number;
  }) {
    const workOrder = await this.getWorkOrderById(data.workOrderId);
    if (!workOrder) {
      throw new Error("Work order not found");
    }

    const user = await this.getUserProfile(data.validatorId);
    if (!user || !user.canValidateWorkOrders) {
      throw new Error("User does not have validation permissions");
    }

    const currentDate = new Date();
    let updatedWorkOrder;
    
    if (data.action === "validate") {
      if (data.validationLevel === 1) {
        updatedWorkOrder = await this.updateWorkOrder(data.workOrderId, {
          validationStatus: "level1_validated",
          level1ValidatedBy: data.validatorId,
          level1ValidatedAt: currentDate,
          level1ValidationNotes: data.comments
        });
      } else if (data.validationLevel === 2) {
        updatedWorkOrder = await this.updateWorkOrder(data.workOrderId, {
          validationStatus: "fully_validated",
          level2ValidatedBy: data.validatorId,
          level2ValidatedAt: currentDate,
          level2ValidationNotes: data.comments,
          canExecute: true
        });
      }
    } else {
      updatedWorkOrder = await this.updateWorkOrder(data.workOrderId, {
        validationStatus: "rejected",
        rejectedBy: data.validatorId,
        rejectedAt: currentDate,
        rejectionReason: data.comments
      });
    }

    // Log the validation action
    const validationLog = await this.createValidationLog({
      recordType: "work_order",
      recordId: data.workOrderId,
      validationLevel: data.validationLevel,
      action: data.action,
      validatedBy: data.validatorId,
      comments: data.comments,
      previousStatus: workOrder.validationStatus,
      newStatus: updatedWorkOrder?.validationStatus
    });

    return { workOrder: updatedWorkOrder, validationLog };
  }

  // Purchase Order Validation Methods
  async getPendingPurchaseOrdersForValidation(validatorId: number, validationLevel: number): Promise<PurchaseOrder[]> {
    const user = await this.getUserProfile(validatorId);
    if (!user || !user.canValidatePurchaseOrders) {
      throw new Error("User does not have purchase order validation permissions");
    }

    // Get purchase orders that need validation at the specified level
    let query;
    if (validationLevel === 1) {
      query = and(
        eq(purchaseOrders.validationStatus, "pending"),
        isNull(purchaseOrders.level1ValidatedBy)
      );
    } else if (validationLevel === 2) {
      query = and(
        eq(purchaseOrders.validationStatus, "level1_validated"),
        isNull(purchaseOrders.level2ValidatedBy)
      );
    } else if (validationLevel === 3) {
      query = and(
        eq(purchaseOrders.validationStatus, "level2_validated"),
        isNull(purchaseOrders.level3ValidatedBy)
      );
    } else {
      throw new Error("Invalid validation level for purchase orders");
    }

    return await this.db.select().from(purchaseOrders).where(query);
  }

  async validatePurchaseOrder(data: {
    purchaseOrderId: number;
    action: "validate" | "reject";
    validationLevel: number;
    comments?: string;
    validatorId: number;
  }) {
    const purchaseOrder = await this.getPurchaseOrderById(data.purchaseOrderId);
    if (!purchaseOrder) {
      throw new Error("Purchase order not found");
    }

    const user = await this.getUserProfile(data.validatorId);
    if (!user || !user.canValidatePurchaseOrders) {
      throw new Error("User does not have validation permissions");
    }

    // Check if user has sufficient authority for the purchase amount
    if (user.maxPurchaseAmount && purchaseOrder.totalAmount && 
        parseFloat(purchaseOrder.totalAmount) > parseFloat(user.maxPurchaseAmount)) {
      throw new Error("Purchase amount exceeds user's approval limit");
    }

    const currentDate = new Date();
    let updatedPurchaseOrder;
    
    if (data.action === "validate") {
      if (data.validationLevel === 1) {
        // Chef de Service Utilisateur valide
        updatedPurchaseOrder = await this.updatePurchaseOrder(data.purchaseOrderId, {
          validationStatus: "chef_service_validated",
          chefServiceValidatedBy: data.validatorId,
          chefServiceValidatedAt: currentDate
        });
      } else if (data.validationLevel === 2) {
        // Directeur Général valide - bon prêt pour impression
        updatedPurchaseOrder = await this.updatePurchaseOrder(data.purchaseOrderId, {
          validationStatus: "ready_for_print",
          directeurValidatedBy: data.validatorId,
          directeurValidatedAt: currentDate,
          canPrint: true
        });
      }
    } else {
      updatedPurchaseOrder = await this.updatePurchaseOrder(data.purchaseOrderId, {
        validationStatus: "rejected",
        rejectedBy: data.validatorId,
        rejectedAt: currentDate,
        rejectionReason: data.comments
      });
    }

    // Log the validation action
    const validationLog = await this.createValidationLog({
      recordType: "purchase_order",
      recordId: data.purchaseOrderId,
      validationLevel: data.validationLevel,
      action: data.action,
      validatedBy: data.validatorId,
      comments: data.comments,
      previousStatus: purchaseOrder.validationStatus,
      newStatus: updatedPurchaseOrder?.validationStatus
    });

    return { purchaseOrder: updatedPurchaseOrder, validationLog };
  }

  // Validation Log Methods
  async createValidationLog(data: InsertValidationLog): Promise<ValidationLog> {
    const [log] = await this.db.insert(validationLogs).values(data).returning();
    return log;
  }

  async getValidationHistory(recordType: string, recordId: number): Promise<ValidationLog[]> {
    return await this.db.select().from(validationLogs)
      .where(and(
        eq(validationLogs.recordType, recordType),
        eq(validationLogs.recordId, recordId)
      ))
      .orderBy(desc(validationLogs.validationDate));
  }

  async getValidationStatistics(filters: {
    validatorId?: number;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    let query = this.db.select().from(validationLogs);
    
    const conditions = [];
    if (filters.validatorId) {
      conditions.push(eq(validationLogs.validatedBy, filters.validatorId));
    }
    if (filters.dateFrom) {
      conditions.push(gte(validationLogs.validationDate, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(validationLogs.validationDate, filters.dateTo));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const logs = await query;

    // Calculate statistics
    const total = logs.length;
    const validated = logs.filter(log => log.action === "validate").length;
    const rejected = logs.filter(log => log.action === "reject").length;
    const workOrderValidations = logs.filter(log => log.recordType === "work_order").length;
    const purchaseOrderValidations = logs.filter(log => log.recordType === "purchase_order").length;

    return {
      total,
      validated,
      rejected,
      workOrderValidations,
      purchaseOrderValidations,
      validationRate: total > 0 ? (validated / total) * 100 : 0,
      rejectionRate: total > 0 ? (rejected / total) * 100 : 0
    };
  }

  // User Profile Methods
  async getUserProfile(id: number): Promise<UserProfile | undefined> {
    const [user] = await this.db.select().from(userProfiles).where(eq(userProfiles.id, id));
    return user;
  }

  async updateUserValidationPermissions(userId: number, updates: {
    validationLevel?: number;
    canValidateWorkOrders?: boolean;
    canValidatePurchaseOrders?: boolean;
    maxPurchaseAmount?: string;
  }): Promise<UserProfile> {
    const [user] = await this.db.update(userProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userProfiles.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  // Validation Status Methods
  async getWorkOrderValidationStatus(workOrderId: number) {
    const workOrder = await this.getWorkOrderById(workOrderId);
    if (!workOrder) {
      throw new Error("Work order not found");
    }

    return {
      workOrderId,
      validationStatus: workOrder.validationStatus,
      canExecute: workOrder.canExecute,
      level1: {
        validated: workOrder.level1ValidatedBy !== null,
        validatedBy: workOrder.level1ValidatedBy,
        validatedAt: workOrder.level1ValidatedAt,
        notes: workOrder.level1ValidationNotes
      },
      level2: {
        validated: workOrder.level2ValidatedBy !== null,
        validatedBy: workOrder.level2ValidatedBy,
        validatedAt: workOrder.level2ValidatedAt,
        notes: workOrder.level2ValidationNotes
      },
      rejection: {
        rejected: workOrder.rejectedBy !== null,
        rejectedBy: workOrder.rejectedBy,
        rejectedAt: workOrder.rejectedAt,
        reason: workOrder.rejectionReason
      }
    };
  }

  async getPurchaseOrderValidationStatus(purchaseOrderId: number) {
    const purchaseOrder = await this.getPurchaseOrderById(purchaseOrderId);
    if (!purchaseOrder) {
      throw new Error("Purchase order not found");
    }

    return {
      purchaseOrderId,
      validationStatus: purchaseOrder.validationStatus,
      canPrint: purchaseOrder.canPrint,
      chefService: {
        validated: purchaseOrder.chefServiceValidatedBy !== null,
        validatedBy: purchaseOrder.chefServiceValidatedBy,
        validatedAt: purchaseOrder.chefServiceValidatedAt,
        notes: purchaseOrder.chefServiceValidationNotes
      },
      directeur: {
        validated: purchaseOrder.directeurValidatedBy !== null,
        validatedBy: purchaseOrder.directeurValidatedBy,
        validatedAt: purchaseOrder.directeurValidatedAt,
        notes: purchaseOrder.directeurValidationNotes
      },
      documentsJustificatifs: purchaseOrder.documentsJustificatifs,
      rejection: {
        rejected: purchaseOrder.rejectedBy !== null,
        rejectedBy: purchaseOrder.rejectedBy,
        rejectedAt: purchaseOrder.rejectedAt,
        reason: purchaseOrder.rejectionReason
      }
    };
  }

  // ============= COMPANY CONFIGURATION METHODS =============
  
  async getCompanyConfig(): Promise<CompanyConfig | undefined> {
    const [config] = await db.select().from(companyConfig).where(eq(companyConfig.isActive, true));
    return config;
  }

  async createCompanyConfig(configData: InsertCompanyConfig): Promise<CompanyConfig> {
    // Deactivate existing configs
    await db.update(companyConfig).set({ isActive: false });
    
    const [newConfig] = await db
      .insert(companyConfig)
      .values({ ...configData, isActive: true })
      .returning();
    return newConfig;
  }

  async updateCompanyConfig(id: number, configData: Partial<InsertCompanyConfig>): Promise<CompanyConfig> {
    const [updatedConfig] = await db
      .update(companyConfig)
      .set({ ...configData, updatedAt: new Date() })
      .where(eq(companyConfig.id, id))
      .returning();
    return updatedConfig;
  }

  async generatePurchaseOrderWithLetterhead(purchaseOrderId: number, demoData?: any): Promise<string> {
    const [config] = await db.select().from(companyConfig).where(eq(companyConfig.isActive, true));
    
    let purchaseOrder;
    if (demoData) {
      // Use demo data from validation system
      purchaseOrder = demoData;
    } else {
      // Try to get from real database
      const [dbOrder] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, purchaseOrderId));
      purchaseOrder = dbOrder;
    }

    if (!config) {
      throw new Error("Configuration d'entreprise introuvable");
    }

    if (!purchaseOrder) {
      throw new Error("Bon de commande introuvable");
    }

    // Generate HTML with company letterhead
    const letterheadTemplate = config.letterheadTemplate || this.generateDefaultLetterhead(config);
    
    const purchaseOrderContent = this.generatePurchaseOrderContent(purchaseOrder);
    
    return letterheadTemplate.replace('{{DOCUMENT_CONTENT}}', purchaseOrderContent);
  }

  private generateDefaultLetterhead(config: CompanyConfig): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { 
      font-family: ${config.fontFamily || 'Arial, sans-serif'}; 
      margin: 0; 
      padding: 20mm;
      color: #333;
    }
    .letterhead-header {
      display: flex;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 3px solid ${config.primaryColor || '#0066cc'};
      margin-bottom: 30px;
    }
    .logo-section {
      flex: 0 0 auto;
      margin-right: 30px;
    }
    .logo {
      max-height: 80px;
      max-width: 200px;
    }
    .company-info {
      flex: 1;
    }
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: ${config.primaryColor || '#0066cc'};
      margin-bottom: 10px;
    }
    .company-details {
      font-size: 12px;
      line-height: 1.4;
      color: #666;
    }
    .document-content {
      min-height: 400px;
      margin: 30px 0;
    }
    .document-footer {
      border-top: 2px solid ${config.secondaryColor || '#f8f9fa'};
      padding-top: 15px;
      margin-top: 30px;
      text-align: center;
      font-size: 10px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="letterhead-header">
    ${config.logoBase64 ? `
    <div class="logo-section">
      <img src="${config.logoBase64}" alt="Logo" class="logo">
    </div>
    ` : ''}
    <div class="company-info">
      <div class="company-name">${config.companyName}</div>
      <div class="company-details">
        ${config.address ? config.address.replace(/\n/g, '<br>') + '<br>' : ''}
        ${config.phone ? 'Tél: ' + config.phone : ''} ${config.email ? '| Email: ' + config.email : ''}<br>
        ${config.website ? 'Web: ' + config.website : ''} ${config.taxNumber ? '| SIRET: ' + config.taxNumber : ''}
      </div>
    </div>
  </div>
  
  <div class="document-content">
    {{DOCUMENT_CONTENT}}
  </div>
  
  <div class="document-footer">
    ${config.documentFooter || config.companyName + ' - ' + config.phone + ' - ' + config.email}
  </div>
</body>
</html>`;
  }

  private generatePurchaseOrderContent(purchaseOrder: any): string {
    const items = Array.isArray(purchaseOrder.items) 
      ? purchaseOrder.items 
      : (typeof purchaseOrder.items === 'string' ? JSON.parse(purchaseOrder.items) : []);
    
    const itemsRows = items.map((item: any) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 10px;">${item.description}</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${item.quantity}</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${item.unitPrice.toFixed(2)} €</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${(item.quantity * item.unitPrice).toFixed(2)} €</td>
      </tr>
    `).join('');

    return `
    <div style="margin-bottom: 30px;">
      <h2 style="color: #0066cc; margin-bottom: 20px;">BON DE COMMANDE</h2>
      <div style="display: flex; justify-content: space-between;">
        <div>
          <strong>Numéro:</strong> ${purchaseOrder.orderNumber}<br>
          <strong>Date:</strong> ${new Date(purchaseOrder.createdAt!).toLocaleDateString('fr-FR')}<br>
          <strong>Demandeur:</strong> ${purchaseOrder.requestedBy}
        </div>
        <div style="text-align: right;">
          <strong>Fournisseur:</strong><br>
          ${purchaseOrder.supplier}
        </div>
      </div>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: #0066cc; color: white;">
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Article</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Qté</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Prix Unit.</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
        <tr style="font-weight: bold; background-color: #f5f5f5;">
          <td colspan="3" style="border: 1px solid #ddd; padding: 10px; text-align: right;">TOTAL HT:</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${purchaseOrder.totalAmount} €</td>
        </tr>
      </tbody>
    </table>
    
    <div style="margin-top: 30px;">
      <p><strong>Description:</strong> ${purchaseOrder.description}</p>
      <p><strong>Statut validation:</strong> ${purchaseOrder.validationStatus}</p>
      <p><strong>Date de livraison:</strong> ${purchaseOrder.deliveryDate ? new Date(purchaseOrder.deliveryDate).toLocaleDateString('fr-FR') : 'À définir'}</p>
    </div>`;
  }
}

export const gmaoStorage = new GMAOStorage();