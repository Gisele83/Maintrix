import { db } from "./db";
import { eq, desc, and, or, gte, lte, isNull, sql, count } from "drizzle-orm";
import {
  equipmentRegistry,
  workOrders,
  preventiveMaintenancePlans,
  maintenanceCounters,
  counterHistory,
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
  type MaintenanceCounter,
  type InsertMaintenanceCounter,
  type CounterHistory,
  type InsertCounterHistory,
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
  type InsertUserProfile,
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
  // Equipment Registry Methods - TENANT ISOLATED
  async getEquipmentRegistry(tenantId: string): Promise<EquipmentRegistry[]> {
    return await db.select().from(equipmentRegistry)
      .where(eq(equipmentRegistry.tenantId, tenantId))
      .orderBy(desc(equipmentRegistry.createdAt));
  }

  // Efficient COUNT-based KPI aggregation — avoids fetching full rows
  async getDashboardKPIs(tenantId: string): Promise<{
    equipmentCount: number;
    activeWorkOrdersCount: number;
    pendingWorkOrdersCount: number;
    completedWorkOrdersCount: number;
    criticalAlertsCount: number;
    lowStockPartsCount: number;
  }> {
    const [
      [eqRow], [activeRow], [pendingRow], [completedRow], [alertRow], [stockRow]
    ] = await Promise.all([
      db.select({ total: count() }).from(equipmentRegistry)
        .where(eq(equipmentRegistry.tenantId, tenantId)),
      db.select({ total: count() }).from(workOrders)
        .where(and(eq(workOrders.tenantId, tenantId), eq(workOrders.status, 'in_progress'))),
      db.select({ total: count() }).from(workOrders)
        .where(and(eq(workOrders.tenantId, tenantId), eq(workOrders.status, 'pending'))),
      db.select({ total: count() }).from(workOrders)
        .where(and(eq(workOrders.tenantId, tenantId), eq(workOrders.status, 'completed'))),
      db.select({ total: count() }).from(alertsNotifications)
        .where(and(eq(alertsNotifications.tenantId, tenantId), eq(alertsNotifications.severity, 'critical'), eq(alertsNotifications.status, 'active'))),
      db.select({ total: count() }).from(spareParts)
        .where(and(eq(spareParts.tenantId, tenantId), sql`${spareParts.currentStock} <= ${spareParts.reorderPoint}`)),
    ]);
    return {
      equipmentCount: eqRow?.total ?? 0,
      activeWorkOrdersCount: activeRow?.total ?? 0,
      pendingWorkOrdersCount: pendingRow?.total ?? 0,
      completedWorkOrdersCount: completedRow?.total ?? 0,
      criticalAlertsCount: alertRow?.total ?? 0,
      lowStockPartsCount: stockRow?.total ?? 0,
    };
  }

  async getEquipmentById(id: number, tenantId: string): Promise<EquipmentRegistry | undefined> {
    const [equipment] = await db.select().from(equipmentRegistry)
      .where(and(eq(equipmentRegistry.id, id), eq(equipmentRegistry.tenantId, tenantId)));
    return equipment;
  }

  async getEquipmentByEquipmentId(equipmentId: string, tenantId: string): Promise<EquipmentRegistry | undefined> {
    const [equipment] = await db.select().from(equipmentRegistry)
      .where(and(eq(equipmentRegistry.equipmentId, equipmentId), eq(equipmentRegistry.tenantId, tenantId)));
    return equipment;
  }

  async getEquipmentByEquipmentIdGlobal(equipmentId: string): Promise<EquipmentRegistry | undefined> {
    const [equipment] = await db.select().from(equipmentRegistry)
      .where(eq(equipmentRegistry.equipmentId, equipmentId));
    return equipment;
  }

  async createEquipment(data: InsertEquipmentRegistry): Promise<EquipmentRegistry> {
    try {
      const equipmentId = data.equipmentId || `EQ-${Date.now()}`;
      const [equipment] = await db.insert(equipmentRegistry).values({ ...data, equipmentId }).returning();
      return equipment;
    } catch (error) {
      console.error("createEquipment error:", error);
      throw error;
    }
  }

  async updateEquipment(id: number, tenantId: string, updates: Partial<EquipmentRegistry>): Promise<EquipmentRegistry> {
    try {
      const [equipment] = await db
        .update(equipmentRegistry)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(equipmentRegistry.id, id), eq(equipmentRegistry.tenantId, tenantId)))
        .returning();
      if (!equipment) throw new Error(`Équipement #${id} non trouvé ou accès refusé`);
      return equipment;
    } catch (error) {
      console.error("updateEquipment error:", error);
      throw error;
    }
  }

  async searchEquipment(tenantId: string, query: { equipmentType?: string; zone?: string; sector?: string; equipmentName?: string }): Promise<EquipmentRegistry[]> {
    const conditions = [eq(equipmentRegistry.tenantId, tenantId)];

    if (query.equipmentType) {
      conditions.push(eq(equipmentRegistry.equipmentType, query.equipmentType));
    }
    if (query.zone) {
      conditions.push(eq(equipmentRegistry.zone, query.zone));
    }
    if (query.sector) {
      conditions.push(eq(equipmentRegistry.sector, query.sector));
    }
    if (query.equipmentName) {
      conditions.push(eq(equipmentRegistry.equipmentName, query.equipmentName));
    }

    return await db.select().from(equipmentRegistry)
      .where(and(...conditions))
      .orderBy(desc(equipmentRegistry.createdAt));
  }

  // Work Orders Methods - TENANT ISOLATED
  async getWorkOrders(tenantId: string): Promise<any[]> {
    return await db
      .select({
        id: workOrders.id,
        orderNumber: workOrders.orderNumber,
        equipmentId: workOrders.equipmentId,
        equipmentName: equipmentRegistry.equipmentName,
        orderType: workOrders.orderType,
        title: workOrders.title,
        description: workOrders.description,
        priority: workOrders.priority,
        status: workOrders.status,
        assignedTo: workOrders.assignedTo,
        requestedBy: workOrders.requestedBy,
        estimatedDuration: workOrders.estimatedDuration,
        actualDuration: workOrders.actualDuration,
        scheduledStart: workOrders.scheduledStart,
        actualStart: workOrders.actualStart,
        scheduledEnd: workOrders.scheduledEnd,
        actualEnd: workOrders.actualEnd,
        cost: workOrders.cost,
        laborCost: workOrders.laborCost,
        materialCost: workOrders.materialCost,
        externalCost: workOrders.externalCost,
        notes: workOrders.notes,
        completionNotes: workOrders.completionNotes,
        validationStatus: workOrders.validationStatus,
        canExecute: workOrders.canExecute,
        createdAt: workOrders.createdAt,
        updatedAt: workOrders.updatedAt,
        location: equipmentRegistry.location
      })
      .from(workOrders)
      .leftJoin(equipmentRegistry, and(
        eq(workOrders.equipmentId, equipmentRegistry.id),
        eq(equipmentRegistry.tenantId, tenantId)
      ))
      .where(eq(workOrders.tenantId, tenantId))
      .orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrderById(id: number, tenantId: string): Promise<WorkOrder | undefined> {
    const [workOrder] = await db.select().from(workOrders)
      .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, tenantId)));
    return workOrder;
  }

  async getWorkOrdersByEquipment(equipmentId: number, tenantId: string): Promise<WorkOrder[]> {
    return await db.select().from(workOrders)
      .where(and(eq(workOrders.equipmentId, equipmentId), eq(workOrders.tenantId, tenantId)))
      .orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrdersByStatus(status: string, tenantId: string): Promise<WorkOrder[]> {
    // ✅ FIXED: Tenant isolation enabled
    return await db.select().from(workOrders)
      .where(and(eq(workOrders.status, status), eq(workOrders.tenantId, tenantId)))
      .orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrdersByAssignee(userId: number, tenantId: string): Promise<WorkOrder[]> {
    // ✅ FIXED: Tenant isolation enabled
    return await db.select().from(workOrders)
      .where(and(eq(workOrders.assignedTo, userId), eq(workOrders.tenantId, tenantId)))
      .orderBy(desc(workOrders.createdAt));
  }

  async createWorkOrder(data: InsertWorkOrder): Promise<WorkOrder> {
    try {
      const orderNumber = `WO-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const { cost, laborCost, materialCost, externalCost, ...rest } = data;
      const [workOrder] = await db.insert(workOrders).values({
        ...rest,
        orderNumber,
        cost: cost?.toString(),
        laborCost: laborCost?.toString(),
        materialCost: materialCost?.toString(),
        externalCost: externalCost?.toString(),
      }).returning();
      return workOrder;
    } catch (error) {
      console.error("createWorkOrder error:", error);
      throw error;
    }
  }

  async updateWorkOrder(id: number, tenantId: string, updates: Partial<WorkOrder>): Promise<WorkOrder> {
    try {
      const safeUpdates = { ...updates };
      if (safeUpdates.level1ValidatedBy === undefined) delete safeUpdates.level1ValidatedBy;
      if (safeUpdates.level2ValidatedBy === undefined) delete safeUpdates.level2ValidatedBy;

      const [existing] = await db
        .select()
        .from(workOrders)
        .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, tenantId)));

      const [workOrder] = await db
        .update(workOrders)
        .set({ ...safeUpdates, updatedAt: new Date() })
        .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, tenantId)))
        .returning();

      if (!workOrder) throw new Error(`Ordre de travail #${id} non trouvé ou accès refusé`);

      if (existing?.status !== 'completed' && workOrder.status === 'completed' && workOrder.projectedCost != null) {
        this.recordAutomatedProjectionOutcome(workOrder).catch(err =>
          console.error("Apprentissage post-action échoué (best-effort):", err)
        );
      }

      return workOrder;
    } catch (error) {
      console.error("updateWorkOrder error:", error);
      throw error;
    }
  }

  /**
   * Compare le résultat réel d'un OT lié à une décision automatisée à sa
   * projection (coût, durée, impact IMCA) et ajuste λ_k/ω_j en conséquence
   * (apprentissage post-action, Brevet 2 rev. 1g/3/10). Best-effort — ne
   * doit jamais faire échouer la clôture de l'OT appelante.
   */
  private async recordAutomatedProjectionOutcome(workOrder: WorkOrder): Promise<void> {
    const { recordProjectionOutcome } = await import("./arbitration-learning");
    const { computeIMCA } = await import("./imca-engine");

    const actualCost = workOrder.cost != null ? parseFloat(workOrder.cost as unknown as string) : 0;
    const actualDuration = workOrder.actualDuration ?? workOrder.estimatedDuration ?? 0;

    let actualImcaImpact = 0;
    if (workOrder.equipmentId != null && workOrder.imcaAtCreation != null) {
      const after = await computeIMCA(workOrder.equipmentId, workOrder.tenantId).catch(() => null);
      if (after) actualImcaImpact = Math.max(0, after.IMCA - workOrder.imcaAtCreation);
    }

    await recordProjectionOutcome(
      workOrder.tenantId,
      {
        cost: parseFloat((workOrder.projectedCost as unknown as string) ?? "0"),
        duration: workOrder.estimatedDuration ?? 0,
        imcaImpact: workOrder.projectedImcaImpact ?? 0,
      },
      { cost: actualCost, duration: actualDuration, imcaImpact: actualImcaImpact }
    );
  }

  async deleteWorkOrder(id: number, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(workOrders)
      .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, tenantId)))
      .returning();
    return result.length > 0;
  }

  // Work Orders by Validation Status (same procedure as Purchase Orders) - TENANT ISOLATED
  async getWorkOrdersByValidationStatus(status: string, tenantId: string): Promise<WorkOrder[]> {
    // 🔧 CORRECTION: Activer le filtrage par tenant ET par status
    return await db.select().from(workOrders)
      .where(and(eq(workOrders.validationStatus, status), eq(workOrders.tenantId, tenantId)))
      .orderBy(desc(workOrders.createdAt));
  }

  // Preventive Maintenance Methods - TENANT ISOLATED
  async getPreventiveMaintenancePlans(tenantId: string): Promise<PreventiveMaintenancePlan[]> {
    return await db.select().from(preventiveMaintenancePlans)
      .where(eq(preventiveMaintenancePlans.tenantId, tenantId))
      .orderBy(desc(preventiveMaintenancePlans.createdAt));
  }

  async getPreventiveMaintenancePlanById(id: number, tenantId: string): Promise<PreventiveMaintenancePlan | undefined> {
    const [plan] = await db.select().from(preventiveMaintenancePlans)
      .where(and(eq(preventiveMaintenancePlans.id, id), eq(preventiveMaintenancePlans.tenantId, tenantId)));
    return plan;
  }

  async getPreventiveMaintenancePlansByEquipmentType(equipmentType: string, tenantId: string): Promise<PreventiveMaintenancePlan[]> {
    return await db.select().from(preventiveMaintenancePlans)
      .where(and(eq(preventiveMaintenancePlans.equipmentType, equipmentType), eq(preventiveMaintenancePlans.tenantId, tenantId)))
      .orderBy(desc(preventiveMaintenancePlans.createdAt));
  }

  async createPreventiveMaintenancePlan(data: InsertPreventiveMaintenancePlan): Promise<PreventiveMaintenancePlan> {
    const [plan] = await db.insert(preventiveMaintenancePlans).values(data).returning();
    return plan;
  }

  async updatePreventiveMaintenancePlan(id: number, tenantId: string, updates: Partial<PreventiveMaintenancePlan>): Promise<PreventiveMaintenancePlan> {
    const [plan] = await db
      .update(preventiveMaintenancePlans)
      .set(updates)
      .where(and(eq(preventiveMaintenancePlans.id, id), eq(preventiveMaintenancePlans.tenantId, tenantId)))
      .returning();
    return plan;
  }

  async deletePreventiveMaintenancePlan(id: number, tenantId: string): Promise<void> {
    await db.delete(preventiveMaintenancePlans)
      .where(and(eq(preventiveMaintenancePlans.id, id), eq(preventiveMaintenancePlans.tenantId, tenantId)));
  }

  // Maintenance Counters Methods - TENANT ISOLATED
  async getMaintenanceCounters(tenantId: string): Promise<MaintenanceCounter[]> {
    return await db.select().from(maintenanceCounters)
      .where(eq(maintenanceCounters.tenantId, tenantId))
      .orderBy(desc(maintenanceCounters.createdAt));
  }

  async getMaintenanceCounterById(id: number, tenantId: string): Promise<MaintenanceCounter | undefined> {
    const [counter] = await db.select().from(maintenanceCounters)
      .where(and(eq(maintenanceCounters.id, id), eq(maintenanceCounters.tenantId, tenantId)));
    return counter;
  }

  async getMaintenanceCountersByEquipment(equipmentId: number, tenantId: string): Promise<MaintenanceCounter[]> {
    return await db.select().from(maintenanceCounters)
      .where(and(eq(maintenanceCounters.equipmentId, equipmentId), eq(maintenanceCounters.tenantId, tenantId)))
      .orderBy(desc(maintenanceCounters.createdAt));
  }

  async createMaintenanceCounter(data: InsertMaintenanceCounter): Promise<MaintenanceCounter> {
    const [counter] = await db.insert(maintenanceCounters).values(data).returning();
    return counter;
  }

  async updateMaintenanceCounter(id: number, tenantId: string, updates: Partial<MaintenanceCounter>): Promise<MaintenanceCounter> {
    const [counter] = await db
      .update(maintenanceCounters)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(maintenanceCounters.id, id), eq(maintenanceCounters.tenantId, tenantId)))
      .returning();
    return counter;
  }

  async incrementCounter(id: number, tenantId: string, incrementValue: number): Promise<MaintenanceCounter> {
    const [counter] = await db
      .update(maintenanceCounters)
      .set({ 
        currentValue: sql`${maintenanceCounters.currentValue} + ${incrementValue}`,
        updatedAt: new Date()
      })
      .where(and(eq(maintenanceCounters.id, id), eq(maintenanceCounters.tenantId, tenantId)))
      .returning();
    
    // Check if alert needs to be generated
    if (counter) {
      await this.checkAndGenerateCounterAlert(counter);
    }
    
    return counter;
  }

  async resetCounter(id: number, tenantId: string, resetReason?: string, performedBy?: number, workOrderId?: number): Promise<MaintenanceCounter> {
    const counter = await this.getMaintenanceCounterById(id, tenantId);
    if (!counter) {
      throw new Error("Counter not found");
    }

    // Create history record
    await db.insert(counterHistory).values({
      tenantId,
      counterId: id,
      previousValue: counter.currentValue ?? 0,
      resetReason: resetReason || "Manual reset",
      performedBy,
      workOrderId
    });

    // Reset counter
    const [updatedCounter] = await db
      .update(maintenanceCounters)
      .set({ 
        currentValue: counter.lastResetValue,
        lastResetDate: new Date(),
        alertLevel: "info",
        alertEmailSent: false,
        updatedAt: new Date()
      })
      .where(and(eq(maintenanceCounters.id, id), eq(maintenanceCounters.tenantId, tenantId)))
      .returning();
    
    return updatedCounter;
  }

  async deleteMaintenanceCounter(id: number, tenantId: string): Promise<void> {
    // Delete history first due to foreign key constraints
    await db.delete(counterHistory)
      .where(and(eq(counterHistory.counterId, id), eq(counterHistory.tenantId, tenantId)));
    
    // Delete counter
    await db.delete(maintenanceCounters)
      .where(and(eq(maintenanceCounters.id, id), eq(maintenanceCounters.tenantId, tenantId)));
  }

  // Counter History Methods
  async getCounterHistory(counterId: number, tenantId: string): Promise<CounterHistory[]> {
    return await db.select().from(counterHistory)
      .where(and(eq(counterHistory.counterId, counterId), eq(counterHistory.tenantId, tenantId)))
      .orderBy(desc(counterHistory.createdAt));
  }

  // Helper method to check and generate alerts for counters
  async checkAndGenerateCounterAlert(counter: MaintenanceCounter): Promise<void> {
    if (!counter.thresholdValue) return;
    const percentage = ((counter.currentValue ?? 0) / counter.thresholdValue) * 100;
    let alertLevel: "info" | "warning" | "critical" = "info";
    let shouldGenerateAlert = false;

    // Determine alert level based on schema fields (warningThresholdPct) with safe defaults
    const warningThreshold = (counter as any).warningThresholdPct ?? 90;
    const criticalThreshold = Math.min(100, warningThreshold + 8);

    if (percentage >= criticalThreshold) {
      alertLevel = "critical";
      shouldGenerateAlert = true;
    } else if (percentage >= warningThreshold) {
      alertLevel = "warning";
      shouldGenerateAlert = percentage >= 95; // Generate warning at 95%
    }

    // Update counter alert level if changed
    if (counter.alertLevel !== alertLevel) {
      await db.update(maintenanceCounters)
        .set({ alertLevel, updatedAt: new Date() })
        .where(eq(maintenanceCounters.id, counter.id));
    }

    // Generate alert if needed and not already sent
    if (shouldGenerateAlert && !counter.alertEmailSent) {
      await this.createAlert({
        tenantId: counter.tenantId,
        alertType: "maintenance_due",
        equipmentId: counter.equipmentId,
        severity: alertLevel,
        title: `Maintenance due: ${counter.equipmentName}`,
        message: `${counter.maintenanceType} is due for ${counter.equipmentName}. Current value: ${counter.currentValue}/${counter.thresholdValue} ${counter.counterType}`,
        triggerValue: counter.currentValue?.toString(),
        thresholdValue: counter.thresholdValue?.toString()
      });

      // Mark email as sent
      await db.update(maintenanceCounters)
        .set({ alertEmailSent: true, updatedAt: new Date() })
        .where(eq(maintenanceCounters.id, counter.id));
    }
  }

  // Spare Parts Methods
  async getSpareParts(tenantId: string): Promise<SparePart[]> {
    return await db.select().from(spareParts)
      .where(eq(spareParts.tenantId, tenantId))
      .orderBy(desc(spareParts.createdAt));
  }

  async getSparePartById(id: number, tenantId: string): Promise<SparePart | undefined> {
    const [part] = await db.select().from(spareParts)
      .where(and(eq(spareParts.id, id), eq(spareParts.tenantId, tenantId)));
    return part;
  }

  async getSparePartByPartNumber(partNumber: string, tenantId: string): Promise<SparePart | undefined> {
    const [part] = await db.select().from(spareParts)
      .where(and(eq(spareParts.partNumber, partNumber), eq(spareParts.tenantId, tenantId)));
    return part;
  }

  async getSparePartsByCategory(category: string, tenantId: string): Promise<SparePart[]> {
    return await db.select().from(spareParts)
      .where(and(eq(spareParts.category, category), eq(spareParts.tenantId, tenantId)))
      .orderBy(desc(spareParts.createdAt));
  }

  async getLowStockParts(tenantId: string): Promise<SparePart[]> {
    return await db.select().from(spareParts)
      .where(and(sql`${spareParts.currentStock} <= ${spareParts.reorderPoint}`, eq(spareParts.tenantId, tenantId)))
      .orderBy(desc(spareParts.createdAt));
  }

  async createSparePart(data: InsertSparePart): Promise<SparePart> {
    const [part] = await db.insert(spareParts).values(data).returning();
    return part;
  }

  async updateSparePart(id: number, tenantId: string, updates: Partial<SparePart>): Promise<SparePart> {
    const [part] = await db
      .update(spareParts)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(spareParts.id, id), eq(spareParts.tenantId, tenantId)))
      .returning();
    return part;
  }

  async deleteSparePart(id: number, tenantId: string): Promise<boolean> {
    try {
      const result = await db.delete(spareParts)
        .where(and(eq(spareParts.id, id), eq(spareParts.tenantId, tenantId)));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting spare part:", error);
      return false;
    }
  }

  // Stock Movements Methods
  async getStockMovements(tenantId?: string): Promise<StockMovement[]> {
    if (tenantId) {
      return await db.select().from(stockMovements)
        .innerJoin(spareParts, eq(stockMovements.sparePartId, spareParts.id))
        .where(eq(spareParts.tenantId, tenantId))
        .orderBy(desc(stockMovements.createdAt))
        .then(rows => rows.map(r => r.stock_movements));
    }
    return await db.select().from(stockMovements).orderBy(desc(stockMovements.createdAt));
  }

  async getStockMovementsByPart(sparePartId: number): Promise<StockMovement[]> {
    return await db.select().from(stockMovements)
      .where(eq(stockMovements.sparePartId, sparePartId))
      .orderBy(desc(stockMovements.createdAt));
  }

  async createStockMovement(data: InsertStockMovement, tenantId: string): Promise<StockMovement> {
    const [movement] = await db.insert(stockMovements).values(data).returning();
    
    // Update spare part stock
    if (data.sparePartId) {
      const part = await this.getSparePartById(data.sparePartId, tenantId);
      if (part) {
        let newStock = part.currentStock || 0;
        if (data.movementType === 'in' || data.movementType === 'return') {
          newStock += data.quantity;
        } else if (data.movementType === 'out') {
          newStock -= data.quantity;
        } else if (data.movementType === 'adjustment') {
          newStock = data.quantity;
        }
        
        await this.updateSparePart(data.sparePartId, tenantId, { currentStock: Math.max(0, newStock) });
      }
    }
    
    return movement;
  }

  // IoT Sensor Data Methods
  async getIotSensorData(equipmentId?: number, sensorType?: string, limit: number = 1000): Promise<IotSensorData[]> {
    const conditions = [];
    if (equipmentId) conditions.push(eq(iotSensorData.equipmentId, equipmentId));
    if (sensorType) conditions.push(eq(iotSensorData.sensorType, sensorType));

    return await db.select().from(iotSensorData)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(iotSensorData.timestamp))
      .limit(limit);
  }

  // Get alerts for equipment
  async getAlerts(equipmentId?: number, limit: number = 50): Promise<any[]> {
    // For now, generate mock alerts based on recent sensor data
    const sensorData = await this.getIotSensorData(equipmentId, undefined, 20);
    const alerts: any[] = [];
    let alertId = 1;
    
    sensorData.forEach(reading => {
      const value = parseFloat(reading.value);

      if (reading.sensorType === 'temperature' && value > 75) {
        alerts.push({
          id: alertId++,
          severity: value > 85 ? 'critical' : 'warning',
          message: `Température élevée: ${reading.value}°C`,
          timestamp: reading.timestamp,
          equipmentId: reading.equipmentId
        });
      }

      if (reading.sensorType === 'vibration' && value > 4.5) {
        alerts.push({
          id: alertId++,
          severity: value > 6.0 ? 'critical' : 'warning',
          message: `Vibration excessive: ${reading.value} mm/s`,
          timestamp: reading.timestamp,
          equipmentId: reading.equipmentId
        });
      }

      if (reading.sensorType === 'pressure' && value > 4.0) {
        alerts.push({
          id: alertId++,
          severity: value > 5.0 ? 'critical' : 'warning',
          message: `Pression anormale: ${reading.value} bar`,
          timestamp: reading.timestamp,
          equipmentId: reading.equipmentId
        });
      }
    });
    
    return alerts.slice(0, limit);
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
    return await db.select().from(predictiveAnalytics)
      .where(equipmentId ? eq(predictiveAnalytics.equipmentId, equipmentId) : undefined)
      .orderBy(desc(predictiveAnalytics.createdAt));
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
    const conditions = [];
    if (equipmentId) conditions.push(eq(kpiMetrics.equipmentId, equipmentId));
    if (metricType) conditions.push(eq(kpiMetrics.metricType, metricType));

    return await db.select().from(kpiMetrics)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(kpiMetrics.calculationDate));
  }

  async createKpiMetrics(data: InsertKpiMetrics): Promise<KpiMetrics> {
    const [metrics] = await db.insert(kpiMetrics).values(data).returning();
    return metrics;
  }

  // ============= PREDICTIVE INSIGHTS DASHBOARD =============
  async getPredictiveInsightsDashboard(tenantId: string, equipmentId?: number): Promise<any> {
    // 1. Get equipment list
    let equipmentList = await db.select().from(equipmentRegistry)
      .where(eq(equipmentRegistry.tenantId, tenantId))
      .orderBy(equipmentRegistry.equipmentName);

    if (equipmentId) {
      equipmentList = equipmentList.filter(e => e.id === equipmentId);
    }

    const equipmentIds = equipmentList.map(e => e.id);

    // 2. Get latest sensor data per equipment (last 200 readings)
    const sensorDataRaw = equipmentIds.length > 0
      ? await db.select().from(iotSensorData)
          .where(equipmentIds.length === 1
            ? eq(iotSensorData.equipmentId, equipmentIds[0])
            : or(...equipmentIds.map(id => eq(iotSensorData.equipmentId, id)))
          )
          .orderBy(desc(iotSensorData.timestamp))
          .limit(500)
      : [];

    // 3. Get predictive analytics
    const analyticsRaw = equipmentIds.length > 0
      ? await db.select().from(predictiveAnalytics)
          .where(equipmentIds.length === 1
            ? eq(predictiveAnalytics.equipmentId, equipmentIds[0])
            : or(...equipmentIds.map(id => eq(predictiveAnalytics.equipmentId, id)))
          )
          .orderBy(desc(predictiveAnalytics.createdAt))
          .limit(200)
      : [];

    // 4. Get KPI metrics
    const kpiRaw = equipmentIds.length > 0
      ? await db.select().from(kpiMetrics)
          .where(equipmentIds.length === 1
            ? eq(kpiMetrics.equipmentId, equipmentIds[0])
            : or(...equipmentIds.map(id => eq(kpiMetrics.equipmentId, id)))
          )
          .orderBy(desc(kpiMetrics.calculationDate))
          .limit(200)
      : [];

    // 5. Get open work orders per equipment
    const openWOs = await db.select({
      equipmentId: workOrders.equipmentId,
      cnt: count()
    }).from(workOrders)
      .where(and(
        eq(workOrders.tenantId, tenantId),
        or(eq(workOrders.status, 'pending'), eq(workOrders.status, 'in_progress'))
      ))
      .groupBy(workOrders.equipmentId);

    const openWOMap: Record<number, number> = {};
    openWOs.forEach((row: any) => {
      if (row.equipmentId) openWOMap[row.equipmentId] = Number(row.cnt);
    });

    // ─── Build equipment insights ───────────────────────────────────────────
    const equipmentInsights = equipmentList.map(eq => {
      // Latest analytics for this equipment
      const analytics = analyticsRaw.filter(a => a.equipmentId === eq.id);
      const latestAnalytic = analytics[0];

      // Latest sensor readings grouped by type
      const sensors = sensorDataRaw.filter(s => s.equipmentId === eq.id);
      const sensorByType: Record<string, any> = {};
      sensors.forEach(s => {
        if (!sensorByType[s.sensorType]) sensorByType[s.sensorType] = s;
      });

      const failureProbability = Math.min(latestAnalytic?.failureProbability ?? 0, 1);
      // Normalize anomaly score: raw values from IoT engine are in 2.0-4.0 range → map to 0-1
      const rawAnomaly = latestAnalytic?.anomalyScore ?? 0;
      const anomalyScore = rawAnomaly > 1 ? Math.min((rawAnomaly - 2.0) / 2.0, 1) : rawAnomaly;
      const rul = latestAnalytic?.remainingUsefulLife ?? null;
      const riskLevel = latestAnalytic?.riskLevel ?? this._computeRiskLevel(failureProbability, anomalyScore);
      const healthScore = this._computeHealthScore(failureProbability, anomalyScore, eq.criticalityLevel ?? 'medium');

      // Top sensor (most recent with highest alarm state)
      const alarmSensor = sensors.find(s => s.alarmState === 'alarm' || s.alarmState === 'critical')
        ?? sensors.find(s => s.alarmState === 'warning')
        ?? sensors[0];

      // Recommendations
      const recs: string[] = [];
      if (latestAnalytic?.recommendations && Array.isArray(latestAnalytic.recommendations)) {
        recs.push(...(latestAnalytic.recommendations as string[]).slice(0, 3));
      }
      if (recs.length === 0 && failureProbability > 0.6) recs.push("Planifier une intervention préventive urgente");
      if (recs.length === 0 && anomalyScore > 0.5) recs.push("Analyser les données capteurs anormales");
      if (recs.length === 0) recs.push("Surveiller les tendances de performance");

      // Predicted failure date
      let predictedFailureDate: string | null = null;
      if (rul != null && rul > 0) {
        const d = new Date();
        d.setDate(d.getDate() + rul);
        predictedFailureDate = d.toISOString();
      }

      return {
        id: eq.id,
        name: eq.equipmentName,
        type: eq.equipmentType,
        healthScore,
        riskLevel,
        remainingUsefulLife: rul,
        failureProbability,
        anomalyScore,
        lastSensorUpdate: sensors[0]?.timestamp?.toISOString() ?? null,
        topSensor: alarmSensor?.sensorType ?? null,
        topSensorValue: alarmSensor ? parseFloat(alarmSensor.value) : null,
        topSensorUnit: alarmSensor?.unit ?? null,
        openWorkOrders: openWOMap[eq.id] ?? 0,
        predictedFailureDate,
        recommendations: recs,
      };
    });

    // ─── Fleet summary ──────────────────────────────────────────────────────
    const total = equipmentInsights.length;
    const critical = equipmentInsights.filter(e => e.riskLevel === 'critical').length;
    const warning = equipmentInsights.filter(e => e.riskLevel === 'high' || e.riskLevel === 'medium').length;
    const healthy = total - critical - warning;
    const avgHealthScore = total > 0 ? Math.round(equipmentInsights.reduce((s, e) => s + e.healthScore, 0) / total) : 0;
    const ruls = equipmentInsights.filter(e => e.remainingUsefulLife != null).map(e => e.remainingUsefulLife!);
    const avgRul = ruls.length > 0 ? Math.round(ruls.reduce((a, b) => a + b, 0) / ruls.length) : 0;
    const criticalAlerts = equipmentInsights.filter(e => e.riskLevel === 'critical' || e.failureProbability > 0.7).length;
    const predictedFailuresNext30d = equipmentInsights.filter(e => e.remainingUsefulLife != null && e.remainingUsefulLife! <= 30).length;

    const fleetSummary = { total, healthy, warning, critical, avgHealthScore, avgRul, criticalAlerts, predictedFailuresNext30d };

    // ─── Sensor trends (time-series for charts) ─────────────────────────────
    // Bucket last 100 readings by hour
    const trendMap: Record<string, { temperature: number[], vibration: number[], pressure: number[], current: number[] }> = {};
    sensorDataRaw.slice(0, 200).forEach(s => {
      if (!s.timestamp) return;
      const ts = new Date(s.timestamp);
      const key = `${ts.toISOString().slice(0, 13)}:00`;
      if (!trendMap[key]) trendMap[key] = { temperature: [], vibration: [], pressure: [], current: [] };
      const type = s.sensorType as keyof typeof trendMap[string];
      if (type in trendMap[key]) trendMap[key][type].push(parseFloat(s.value));
    });

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const sensorTrends = Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-24)
      .map(([ts, vals]) => ({
        timestamp: ts,
        temperature: avg(vals.temperature),
        vibration: avg(vals.vibration),
        pressure: avg(vals.pressure),
        current: avg(vals.current),
      }));

    // ─── Failure probability timeline (30-day projection) ───────────────────
    const baseProb = equipmentInsights.length > 0
      ? equipmentInsights.reduce((s, e) => s + e.failureProbability, 0) / equipmentInsights.length
      : 0.05;

    const failureProbabilityTimeline = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const growthFactor = 1 + i * 0.015;
      const prob = Math.min(baseProb * growthFactor, 0.99);
      return {
        day: `J+${i}`,
        probability: Math.round(prob * 1000) / 1000,
        threshold: 0.5,
      };
    });

    // ─── Anomaly distribution ────────────────────────────────────────────────
    const anomalyDistribution = equipmentInsights
      .filter(e => e.anomalyScore > 0)
      .sort((a, b) => b.anomalyScore - a.anomalyScore)
      .slice(0, 10)
      .map(e => ({
        equipment: e.name.length > 20 ? e.name.slice(0, 18) + '…' : e.name,
        score: Math.round(e.anomalyScore * 1000) / 1000,
        count: 1,
      }));

    // ─── KPI Radar ───────────────────────────────────────────────────────────
    const mtbfVals = kpiRaw.filter(k => k.metricType === 'mtbf').map(k => parseFloat(k.metricValue));
    const mttrVals = kpiRaw.filter(k => k.metricType === 'mttr').map(k => parseFloat(k.metricValue));
    const availVals = kpiRaw.filter(k => k.metricType === 'availability').map(k => parseFloat(k.metricValue));
    const oeeVals = kpiRaw.filter(k => k.metricType === 'oee').map(k => parseFloat(k.metricValue));

    const clamp = (v: number, max = 100) => Math.min(Math.round(v), max);
    const kpiRadar = [
      { metric: "Disponibilité", value: availVals.length ? clamp(avg(availVals)!) : Math.round(avgHealthScore * 0.9), benchmark: 95 },
      { metric: "MTBF (norm.)", value: mtbfVals.length ? clamp(Math.min(avg(mtbfVals)! / 5, 100)) : 70, benchmark: 80 },
      { metric: "MTTR (inv.)", value: mttrVals.length ? clamp(100 - Math.min(avg(mttrVals)! * 5, 100)) : 75, benchmark: 85 },
      { metric: "OEE", value: oeeVals.length ? clamp(avg(oeeVals)!) : Math.round(avgHealthScore * 0.85), benchmark: 85 },
      { metric: "Santé flotte", value: avgHealthScore, benchmark: 90 },
      { metric: "Prédictibilité", value: analyticsRaw.length > 0 ? Math.min(75 + Math.round(analyticsRaw.length / 2), 95) : 60, benchmark: 80 },
    ];

    // ─── Maintenance window suggestions ─────────────────────────────────────
    const maintenanceWindowSuggestions = equipmentInsights
      .filter(e => e.failureProbability > 0.2 || (e.remainingUsefulLife != null && e.remainingUsefulLife <= 60))
      .sort((a, b) => b.failureProbability - a.failureProbability)
      .slice(0, 8)
      .map(e => {
        const daysUntil = e.remainingUsefulLife != null ? Math.max(e.remainingUsefulLife - 7, 1) : 14;
        const d = new Date();
        d.setDate(d.getDate() + daysUntil);
        return {
          equipmentId: e.id,
          equipmentName: e.name,
          suggestedDate: d.toISOString(),
          urgency: e.riskLevel as "low" | "medium" | "high" | "critical",
          estimatedDuration: e.riskLevel === 'critical' ? 8 : e.riskLevel === 'high' ? 4 : 2,
          reason: e.recommendations[0] ?? `Probabilité de panne: ${Math.round(e.failureProbability * 100)}%`,
        };
      });

    return {
      equipment: equipmentInsights,
      fleetSummary,
      sensorTrends,
      failureProbabilityTimeline,
      anomalyDistribution,
      kpiRadar,
      maintenanceWindowSuggestions,
    };
  }

  // ============= DEMO DATA SEEDING =============
  async seedPredictiveInsightsDemoData(tenantId: string): Promise<{ inserted: number }> {
    const equips = await db.select().from(equipmentRegistry)
      .where(eq(equipmentRegistry.tenantId, tenantId))
      .orderBy(equipmentRegistry.id)
      .limit(10);

    if (equips.length === 0) return { inserted: 0 };

    let inserted = 0;

    // Risk profiles to make the dashboard interesting
    const profiles = [
      { failureProb: 0.82, anomalyScore: 0.78, rul: 8, risk: 'critical', recs: ['Arrêt machine préventif requis', 'Vérifier roulements et joints', 'Commander pièces de rechange'] },
      { failureProb: 0.61, anomalyScore: 0.58, rul: 22, risk: 'high', recs: ['Inspection vibratoire planifiée', 'Nettoyer filtres de lubrification'] },
      { failureProb: 0.45, anomalyScore: 0.41, rul: 38, risk: 'high', recs: ['Mesures thermiques à réaliser', 'Ajuster paramètres de charge'] },
      { failureProb: 0.30, anomalyScore: 0.28, rul: 55, risk: 'medium', recs: ['Surveillance continue recommandée'] },
      { failureProb: 0.18, anomalyScore: 0.15, rul: 80, risk: 'medium', recs: ['Maintenance préventive planifiée dans 3 mois'] },
      { failureProb: 0.08, anomalyScore: 0.07, rul: 120, risk: 'low', recs: ['Fonctionnement nominal — aucune action requise'] },
      { failureProb: 0.72, anomalyScore: 0.69, rul: 14, risk: 'critical', recs: ['Intervention urgente nécessaire', 'Probabilité de panne > 70%'] },
      { failureProb: 0.35, anomalyScore: 0.32, rul: 48, risk: 'medium', recs: ['Calibration capteurs recommandée'] },
      { failureProb: 0.12, anomalyScore: 0.10, rul: 95, risk: 'low', recs: ['Équipement en bon état opérationnel'] },
      { failureProb: 0.55, anomalyScore: 0.50, rul: 30, risk: 'high', recs: ['Vérification électrique préventive', 'Tester protections thermiques'] },
    ];

    const now = new Date();

    // Insert predictive analytics for each equipment
    for (let i = 0; i < equips.length; i++) {
      const eq = equips[i];
      const profile = profiles[i % profiles.length];

      await db.insert(predictiveAnalytics).values({
        tenantId,
        equipmentId: eq.id,
        analysisType: 'rul',
        predictionDate: now,
        remainingUsefulLife: profile.rul,
        failureProbability: profile.failureProb,
        anomalyScore: profile.anomalyScore,
        confidenceLevel: 0.85,
        riskLevel: profile.risk,
        recommendations: profile.recs,
        modelVersion: 'demo-v2',
        alertGenerated: profile.risk === 'critical',
        createdAt: now,
      });
      inserted++;

      // Insert KPI metrics: MTBF, MTTR, availability, OEE
      const periodStart = new Date(now);
      periodStart.setDate(now.getDate() - 30);

      const kpis = [
        { type: 'mtbf', value: String(120 + Math.round(Math.random() * 200)) },
        { type: 'mttr', value: String(2 + Math.round(Math.random() * 8)) },
        { type: 'availability', value: String(70 + Math.round((1 - profile.failureProb) * 25)) },
        { type: 'oee', value: String(60 + Math.round((1 - profile.failureProb) * 30)) },
      ];

      for (const kpi of kpis) {
        await db.insert(kpiMetrics).values({
          tenantId,
          equipmentId: eq.id,
          metricType: kpi.type,
          metricValue: kpi.value,
          periodStart,
          periodEnd: now,
          calculationDate: now,
          context: { source: 'demo-seed', equipment: eq.equipmentName },
        });
        inserted++;
      }

      // Insert historical sensor trends (last 24 hours, hourly)
      for (let h = 23; h >= 0; h--) {
        const ts = new Date(now);
        ts.setHours(now.getHours() - h);
        const noiseT = (Math.random() - 0.5) * 8;
        const noiseV = (Math.random() - 0.5) * 1.5;
        const noiseP = (Math.random() - 0.5) * 0.4;
        const noiseA = (Math.random() - 0.5) * 2;
        const trendFactor = (24 - h) / 24;

        const sensorReadings = [
          { type: 'temperature', value: String((55 + profile.failureProb * 30 + noiseT + trendFactor * 5).toFixed(2)), unit: '°C', sensorId: `TEMP-DEMO-${eq.id}` },
          { type: 'vibration', value: String((2.5 + profile.anomalyScore * 4 + noiseV + trendFactor * 0.8).toFixed(3)), unit: 'mm/s', sensorId: `VIB-DEMO-${eq.id}` },
          { type: 'pressure', value: String((3.5 + noiseP + trendFactor * 0.3).toFixed(2)), unit: 'bar', sensorId: `PRESS-DEMO-${eq.id}` },
          { type: 'current', value: String((10 + noiseA + trendFactor * 1.5).toFixed(2)), unit: 'A', sensorId: `CURR-DEMO-${eq.id}` },
        ];

        for (const s of sensorReadings) {
          const alarmState = parseFloat(s.value) > 85 && s.type === 'temperature' ? 'alarm'
            : parseFloat(s.value) > 75 && s.type === 'temperature' ? 'warning'
            : parseFloat(s.value) > 6 && s.type === 'vibration' ? 'alarm'
            : parseFloat(s.value) > 4.5 && s.type === 'vibration' ? 'warning'
            : 'normal';

          await db.insert(iotSensorData).values({
            equipmentId: eq.id,
            sensorType: s.type,
            sensorId: s.sensorId,
            value: s.value,
            unit: s.unit,
            timestamp: ts,
            quality: 'good',
            alarmState,
          });
          inserted++;
        }
      }
    }

    return { inserted };
  }

  private _computeRiskLevel(failureProb: number, anomalyScore: number): string {
    const combined = failureProb * 0.7 + anomalyScore * 0.3;
    if (combined >= 0.65) return 'critical';
    if (combined >= 0.4) return 'high';
    if (combined >= 0.2) return 'medium';
    return 'low';
  }

  private _computeHealthScore(failureProb: number, anomalyScore: number, criticality: string): number {
    const critWeight = criticality === 'critical' ? 1.2 : criticality === 'high' ? 1.1 : 1.0;
    const degradation = (failureProb * 0.6 + anomalyScore * 0.4) * critWeight;
    return Math.max(0, Math.round(100 - degradation * 100));
  }

  // Integration Log Methods
  async getIntegrationLog(systemName?: string): Promise<IntegrationLog[]> {
    return await db.select().from(integrationLog)
      .where(systemName ? eq(integrationLog.systemName, systemName) : undefined)
      .orderBy(desc(integrationLog.processedAt));
  }

  async createIntegrationLog(data: InsertIntegrationLog): Promise<IntegrationLog> {
    const [log] = await db.insert(integrationLog).values(data).returning();
    return log;
  }

  // Alerts and Notifications Methods
  async getAlertsNotifications(status?: string, tenantId?: string, maxLimit: number = 100): Promise<AlertsNotifications[]> {
    const conditions: any[] = [];
    
    if (status) {
      conditions.push(eq(alertsNotifications.status, status));
    }
    
    if (tenantId) {
      conditions.push(eq(alertsNotifications.tenantId, tenantId));
    }
    
    return await db.select().from(alertsNotifications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(alertsNotifications.createdAt))
      .limit(maxLimit);
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

  // User Profile Methods
  async createUserProfile(profileData: InsertUserProfile): Promise<UserProfile> {
    const [profile] = await db
      .insert(userProfiles)
      .values(profileData)
      .onConflictDoUpdate({
        target: userProfiles.id,
        set: profileData
      })
      .returning();
    return profile;
  }

  async getUserProfile(id: number): Promise<UserProfile | undefined> {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, id));
    return profile;
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
  async createPurchaseOrder(orderData: Omit<InsertPurchaseOrder, 'orderNumber'> & { orderNumber?: string }): Promise<PurchaseOrder> {
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
    return await this.db.select().from(purchaseOrders).where(eq(purchaseOrders.validationStatus, status));
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
  async checkStockLevelsAndTriggerReorders(tenantId: string): Promise<{ triggeredRules: ReorderRule[], createdOrders: PurchaseOrder[] }> {
    const rules = await this.getReorderRules();
    const triggeredRules: ReorderRule[] = [];
    const createdOrders: PurchaseOrder[] = [];

    for (const rule of rules) {
      if (rule.sparePartId == null) continue;
      const part = await this.getSparePartById(rule.sparePartId, tenantId);
      if (!part) continue;
      const currentStock = part.currentStock ?? 0;

      // Check if stock is below reorder point
      if (currentStock <= rule.reorderPoint) {
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
            severity: currentStock <= 0 ? "critical" : "high",
            title: "Stock faible détecté",
            message: `Stock de "${part.partName}" (${part.partNumber}) est descendu à ${currentStock} unités. Seuil de réapprovisionnement: ${rule.reorderPoint}`,
            triggerValue: currentStock.toString(),
            thresholdValue: rule.reorderPoint?.toString()
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
                priority: currentStock <= 0 ? "urgent" : "high",
                requestedBy: "Auto-Reorder System",
                totalAmount: (part.unitPrice ? (parseFloat(part.unitPrice) * rule.reorderQuantity).toFixed(2) : "0"),
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
                unitPrice: part.unitPrice ? part.unitPrice.toString() : "0",
                totalPrice: (part.unitPrice ? (parseFloat(part.unitPrice) * rule.reorderQuantity).toFixed(2) : "0"),
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
      if (rule && (part.currentStock ?? 0) <= rule.reorderPoint) {
        results.push({ ...part, reorderRule: rule });
      }
    }

    return results;
  }

  // ============= MAINTENANCE REPORTS MANAGEMENT =============

  // Generate maintenance report after work order completion
  async generateMaintenanceReport(workOrderId: number, tenantId: string, reportData: Partial<InsertMaintenanceReport>): Promise<MaintenanceReport> {
    // Get work order details
    const workOrder = await this.getWorkOrderById(workOrderId, tenantId);
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
    
    const laborCost = reportData.laborCost != null ?
      parseFloat(reportData.laborCost.toString()) :
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
      totalCost: totalCost.toString(),
      laborCost: laborCost.toString(),
      partsCost: partsCost.toString(),
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
    const conditions = [];
    if (filters?.equipmentId) conditions.push(eq(maintenanceReports.equipmentId, filters.equipmentId));
    if (filters?.reportType) conditions.push(eq(maintenanceReports.reportType, filters.reportType));
    if (filters?.status) conditions.push(eq(maintenanceReports.status, filters.status));
    if (filters?.startDate) conditions.push(gte(maintenanceReports.createdAt, filters.startDate));
    if (filters?.endDate) conditions.push(lte(maintenanceReports.createdAt, filters.endDate));

    return db.select().from(maintenanceReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(maintenanceReports.createdAt));
  }

  async getMaintenanceReportById(id: number): Promise<MaintenanceReport | undefined> {
    const [report] = await db.select().from(maintenanceReports).where(eq(maintenanceReports.id, id));
    return report;
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
  async generateMonthlyReport(month: number, year: number, tenantId: string, generatedBy?: string): Promise<MonthlyReport> {
    const reportNumber = await this.generateReportNumber("MM");

    // Calculate period dates
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    // Calculate equipment statistics
    const equipment = await this.getEquipmentRegistry(tenantId);
    const totalEquipment = equipment.length;
    const activeEquipment = equipment.filter(eq => eq.operationalState === "operational").length;
    const equipmentAvailability = activeEquipment > 0 ? (activeEquipment / totalEquipment) * 100 : 0;

    // Calculate work orders statistics
    const workOrders = await this.getWorkOrdersByDateRange(periodStart, periodEnd, tenantId);
    const totalWorkOrders = workOrders.length;
    const completedWorkOrders = workOrders.filter(wo => wo.status === "completed").length;
    const preventiveWorkOrders = workOrders.filter(wo => wo.orderType === "preventive").length;
    const correctiveWorkOrders = workOrders.filter(wo => wo.orderType === "corrective").length;

    // Calculate average completion time
    const completedWOs = workOrders.filter(wo => wo.status === "completed" && wo.actualEnd);
    const averageCompletionTime = completedWOs.length > 0 ?
      completedWOs.reduce((sum, wo) => {
        const duration = wo.actualEnd && wo.actualStart ?
          (new Date(wo.actualEnd).getTime() - new Date(wo.actualStart).getTime()) / (1000 * 60 * 60) : 0;
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
    const alerts = await this.getAlertsForPeriod(periodStart, periodEnd, tenantId);
    const totalAlerts = alerts.length;
    const criticalAlerts = alerts.filter(alert => alert.severity === "critical").length;

    // Generate statistics and charts data
    const statisticsData = {
      equipmentByType: equipment.reduce((acc: any, eq) => {
        acc[eq.equipmentType] = (acc[eq.equipmentType] || 0) + 1;
        return acc;
      }, {}),
      workOrdersByStatus: workOrders.reduce((acc: any, wo) => {
        const status = wo.status || "unknown";
        acc[status] = (acc[status] || 0) + 1;
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
      equipmentAvailability: equipmentAvailability.toString(),
      totalWorkOrders,
      completedWorkOrders,
      preventiveWorkOrders,
      correctiveWorkOrders,
      averageCompletionTime: averageCompletionTime.toString(),
      mtbf: mtbf.toString(),
      mttr: mttr.toString(),
      plannedMaintenanceRatio: plannedMaintenanceRatio.toString(),
      maintenanceEfficiency: maintenanceEfficiency.toString(),
      totalMaintenanceCost: totalMaintenanceCost.toString(),
      laborCost: laborCost.toString(),
      partsCost: partsCost.toString(),
      contractorCost: "0",
      costPerWorkOrder: costPerWorkOrder.toString(),
      partsConsumed: this.calculatePartsConsumed(maintenanceReportsInPeriod),
      inventoryTurnover: "0", // Could be calculated from stock movements
      stockouts: 0,
      emergencyPurchases: 0,
      totalAlerts,
      criticalAlerts,
      safetyIncidents: this.countSafetyIncidents(maintenanceReportsInPeriod),
      qualityIssues: this.countQualityIssues(maintenanceReportsInPeriod),
      performanceScore: performanceScore.toString(),
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
    return db.select().from(monthlyReports)
      .where(year ? eq(monthlyReports.year, year) : undefined)
      .orderBy(desc(monthlyReports.year), desc(monthlyReports.month));
  }

  async getMonthlyReportById(id: number): Promise<MonthlyReport | undefined> {
    const [report] = await db.select().from(monthlyReports).where(eq(monthlyReports.id, id));
    return report;
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
  private async getWorkOrdersByDateRange(startDate: Date, endDate: Date, tenantId: string): Promise<WorkOrder[]> {
    return db.select().from(workOrders)
      .where(and(
        eq(workOrders.tenantId, tenantId),
        gte(workOrders.createdAt, startDate),
        lte(workOrders.createdAt, endDate)
      ));
  }

  private async getAlertsForPeriod(startDate: Date, endDate: Date, tenantId: string): Promise<AlertsNotifications[]> {
    return db.select().from(alertsNotifications)
      .where(and(
        eq(alertsNotifications.tenantId, tenantId),
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
        const woDate = new Date(wo.createdAt ?? 0);
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
      const week = this.getWeekNumber(new Date(report.createdAt ?? 0));
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
    if (validationLevel === 1) {
      // Level 1: Chef de Service - Show pending orders
      return await db.select().from(workOrders).where(
        eq(workOrders.validationStatus, "pending")
      );
    } else if (validationLevel === 2) {
      // Level 2: Chef Département Maintenance - Show orders validated by Chef Service (final validation)
      return await db.select().from(workOrders).where(
        eq(workOrders.validationStatus, "level1_validated")
      );
    } else {
      throw new Error("Invalid validation level for work orders");
    }
  }

  async validateWorkOrder(data: {
    workOrderId: number;
    action: "validate" | "reject";
    validationLevel: number;
    comments?: string;
    validatorId: number;
  }, tenantId: string) {
    // 🔧 CORRECTION: Passer le tenant ID à getWorkOrderById  
    const workOrder = await this.getWorkOrderById(data.workOrderId, tenantId);
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
        // Chef de Service validation
        updatedWorkOrder = await this.updateWorkOrder(data.workOrderId, (workOrder as any).tenant_id || workOrder.tenantId, {
          validationStatus: "level1_validated"
        });
      } else if (data.validationLevel === 2) {
        // Chef Département Maintenance - Final validation
        // L'ordre retourne dans la liste principale avec status "assigned" pour exécution par les techniciens
        updatedWorkOrder = await this.updateWorkOrder(data.workOrderId, (workOrder as any).tenant_id || workOrder.tenantId, {
          validationStatus: "validated",
          status: "assigned", // 🔧 CORRECTION: Retour dans liste principale
          canExecute: true
        });
        console.log(`Work order ${data.workOrderId} fully validated, status changed to 'assigned' for technician execution`);
      }
    } else {
      updatedWorkOrder = await this.updateWorkOrder(data.workOrderId, (workOrder as any).tenant_id || workOrder.tenantId, {
        validationStatus: "rejected",
        status: "cancelled", // 🔧 CORRECTION: Status cohérent pour rejet
        rejectedBy: data.validatorId,
        rejectedAt: currentDate,
        rejectionReason: data.comments
      });
      console.log(`Work order ${data.workOrderId} rejected and cancelled`);
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
        isNull(purchaseOrders.chefServiceValidatedBy)
      );
    } else if (validationLevel === 2) {
      query = and(
        eq(purchaseOrders.validationStatus, "chef_service_validated"),
        isNull(purchaseOrders.directeurValidatedBy)
      );
    } else if (validationLevel === 3) {
      query = eq(purchaseOrders.validationStatus, "directeur_validated");
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
        // Directeur Général valide - Passe au niveau 3 ou prêt pour impression si c'est le dernier niveau
        updatedPurchaseOrder = await this.updatePurchaseOrder(data.purchaseOrderId, {
          validationStatus: "directeur_validated",
          directeurValidatedBy: data.validatorId,
          directeurValidatedAt: currentDate
        });
      } else if (data.validationLevel === 3) {
        // Validation finale - bon prêt pour impression
        updatedPurchaseOrder = await this.updatePurchaseOrder(data.purchaseOrderId, {
          validationStatus: "ready_for_print",
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

    const logs = await this.db.select().from(validationLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

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
  async getWorkOrderValidationStatus(workOrderId: number, tenantId: string) {
    const workOrder = await this.getWorkOrderById(workOrderId, tenantId);
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
        rejectionReason: purchaseOrder.chefServiceRejectionReason
      },
      directeur: {
        validated: purchaseOrder.directeurValidatedBy !== null,
        validatedBy: purchaseOrder.directeurValidatedBy,
        validatedAt: purchaseOrder.directeurValidatedAt,
        rejectionReason: purchaseOrder.directeurRejectionReason
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