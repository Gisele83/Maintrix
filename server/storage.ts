import { 
  MaintenanceCase, 
  InsertMaintenanceCase,
  RepairProcedure,
  InsertRepairProcedure,
  ReportedCase,
  InsertReportedCase,
  DiagnosticSession,
  InsertDiagnosticSession,
  UserProfile,
  InsertUserProfile,
  FeedbackSession,
  InsertFeedbackSession,
  LearningMetrics,
  InsertLearningMetrics,
  ModelPerformance,
  InsertModelPerformance,
  AdaptiveLearning,
  InsertAdaptiveLearning,
  // GMAO types
  EquipmentRegistry,
  InsertEquipmentRegistry,
  WorkOrder,
  InsertWorkOrder,
  PreventiveMaintenancePlan,
  InsertPreventiveMaintenancePlan,
  SparePart,
  InsertSparePart,
  StockMovement,
  InsertStockMovement,
  IotSensorData,
  InsertIotSensorData,
  PredictiveAnalytics,
  InsertPredictiveAnalytics,
  KpiMetrics,
  InsertKpiMetrics,
  IntegrationLog,
  InsertIntegrationLog,
  AlertsNotifications,
  InsertAlertsNotifications,
  // Tables
  maintenanceCases,
  repairProcedures,
  reportedCases,
  diagnosticSessions,
  userProfiles,
  feedbackSessions,
  learningMetrics,
  modelPerformance,
  adaptiveLearning,
  equipmentRegistry,
  workOrders,
  preventiveMaintenancePlans,
  spareParts,
  stockMovements,
  iotSensorData,
  predictiveAnalytics,
  kpiMetrics,
  integrationLog,
  alertsNotifications
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, and, desc, arrayContains, sql } from "drizzle-orm";

/** IA → Analytics : agrégats réels sur diagnostic_sessions, surfacés dans le Reporting. */
export interface DiagnosticStats {
  totalSessions: number;
  avgConfidence: number;
  completionRate: number;
  mlPredictionRate: number;
}

export interface IStorage {
  // Maintenance Cases
  getMaintenanceCases(): Promise<MaintenanceCase[]>;
  getMaintenanceCaseById(id: number): Promise<MaintenanceCase | undefined>;
  createMaintenanceCase(data: InsertMaintenanceCase): Promise<MaintenanceCase>;
  searchMaintenanceCases(query: { equipmentType?: string; symptoms?: string[] }): Promise<MaintenanceCase[]>;

  // Repair Procedures
  getRepairProceduresByCaseId(caseId: number): Promise<RepairProcedure[]>;
  createRepairProcedure(data: InsertRepairProcedure): Promise<RepairProcedure>;
  updateRepairProcedureCompletion(id: number, completed: boolean): Promise<RepairProcedure>;

  // Reported Cases
  getReportedCases(): Promise<ReportedCase[]>;
  createReportedCase(data: InsertReportedCase): Promise<ReportedCase>;
  updateReportedCaseStatus(id: number, status: string): Promise<ReportedCase>;

  // Diagnostic Sessions
  getDiagnosticSessions(): Promise<DiagnosticSession[]>;
  createDiagnosticSession(data: InsertDiagnosticSession): Promise<DiagnosticSession>;
  updateDiagnosticSession(id: number, updates: Partial<DiagnosticSession>): Promise<DiagnosticSession>;
  getDiagnosticStats(tenantId: string): Promise<DiagnosticStats>;

  // User Profiles
  getUserProfiles(): Promise<UserProfile[]>;
  getUserProfileById(id: number): Promise<UserProfile | undefined>;
  getUserProfileByUsername(username: string): Promise<UserProfile | undefined>;
  createUserProfile(data: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(id: number, updates: Partial<UserProfile>): Promise<UserProfile>;
  deleteUserProfile(id: number): Promise<boolean>;

  // Continuous Learning System
  createFeedbackSession(data: InsertFeedbackSession): Promise<FeedbackSession>;
  getFeedbackSessions(): Promise<FeedbackSession[]>;
  getFeedbackBySessionId(sessionId: number): Promise<FeedbackSession | undefined>;
  
  // Learning Metrics
  getLearningMetrics(): Promise<LearningMetrics[]>;
  getLearningMetricsByEquipment(equipmentType: string): Promise<LearningMetrics[]>;
  updateLearningMetrics(equipmentType: string, symptomPattern: string, wasSuccessful: boolean): Promise<void>;
  
  // Model Performance Tracking
  getModelPerformance(): Promise<ModelPerformance[]>;
  updateModelPerformance(data: InsertModelPerformance): Promise<ModelPerformance>;
  
  // Adaptive Learning
  getAdaptiveLearning(): Promise<AdaptiveLearning[]>;
  getAdaptiveLearningByEquipment(equipmentType: string): Promise<AdaptiveLearning | undefined>;
  updateAdaptiveLearning(equipmentType: string, learningData: Partial<AdaptiveLearning>): Promise<void>;

  // GMAO - Equipment Registry
  getEquipmentRegistry(): Promise<EquipmentRegistry[]>;
  getEquipmentById(id: number): Promise<EquipmentRegistry | undefined>;
  getEquipmentByEquipmentId(equipmentId: string): Promise<EquipmentRegistry | undefined>;
  createEquipment(data: InsertEquipmentRegistry): Promise<EquipmentRegistry>;
  updateEquipment(id: number, updates: Partial<EquipmentRegistry>): Promise<EquipmentRegistry>;
  searchEquipment(query: { equipmentType?: string; zone?: string; sector?: string }): Promise<EquipmentRegistry[]>;

  // GMAO - Work Orders
  getWorkOrders(): Promise<WorkOrder[]>;
  getWorkOrdersByTenant(tenantId: string): Promise<WorkOrder[]>;
  getWorkOrderById(id: number): Promise<WorkOrder | undefined>;
  getWorkOrdersByEquipment(equipmentId: number): Promise<WorkOrder[]>;
  getWorkOrdersByStatus(status: string): Promise<WorkOrder[]>;
  getWorkOrdersByAssignee(userId: number): Promise<WorkOrder[]>;
  createWorkOrder(data: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: number, updates: Partial<WorkOrder>): Promise<WorkOrder>;

  // GMAO - Preventive Maintenance
  getPreventiveMaintenancePlans(): Promise<PreventiveMaintenancePlan[]>;
  getPreventiveMaintenancePlanById(id: number): Promise<PreventiveMaintenancePlan | undefined>;
  getPreventiveMaintenancePlansByEquipmentType(equipmentType: string): Promise<PreventiveMaintenancePlan[]>;
  createPreventiveMaintenancePlan(data: InsertPreventiveMaintenancePlan): Promise<PreventiveMaintenancePlan>;
  updatePreventiveMaintenancePlan(id: number, updates: Partial<PreventiveMaintenancePlan>): Promise<PreventiveMaintenancePlan>;

  // GMAO - Spare Parts Inventory
  getSpareParts(): Promise<SparePart[]>;
  getSparePartById(id: number): Promise<SparePart | undefined>;
  getSparePartByPartNumber(partNumber: string): Promise<SparePart | undefined>;
  getSparePartsByCategory(category: string): Promise<SparePart[]>;
  getLowStockParts(): Promise<SparePart[]>;
  createSparePart(data: InsertSparePart): Promise<SparePart>;
  updateSparePart(id: number, updates: Partial<SparePart>): Promise<SparePart>;

  // GMAO - Stock Movements
  getStockMovements(): Promise<StockMovement[]>;
  getStockMovementsByPart(sparePartId: number): Promise<StockMovement[]>;
  createStockMovement(data: InsertStockMovement): Promise<StockMovement>;

  // IoT Sensor Data
  getIotSensorData(equipmentId?: number, limit?: number): Promise<IotSensorData[]>;
  createIotSensorData(data: InsertIotSensorData): Promise<IotSensorData>;
  getLatestSensorData(equipmentId: number): Promise<IotSensorData[]>;

  // Predictive Analytics
  getPredictiveAnalytics(tenantId?: string, limit?: number): Promise<PredictiveAnalytics[]>;
  createPredictiveAnalytics(data: InsertPredictiveAnalytics): Promise<PredictiveAnalytics>;
  getLatestPredictions(equipmentId: number): Promise<PredictiveAnalytics | undefined>;

  // KPI Metrics
  getKpiMetrics(tenantId?: string, limit?: number): Promise<KpiMetrics[]>;
  createKpiMetrics(data: InsertKpiMetrics): Promise<KpiMetrics>;

  // Integration Log
  getIntegrationLog(limit?: number): Promise<IntegrationLog[]>;
  createIntegrationLog(data: InsertIntegrationLog): Promise<IntegrationLog>;

  // Alerts and Notifications
  getAlertsNotifications(status?: string): Promise<AlertsNotifications[]>;
  getAlertsByEquipment(equipmentId: number): Promise<AlertsNotifications[]>;
  createAlert(data: InsertAlertsNotifications): Promise<AlertsNotifications>;
  updateAlert(id: number, updates: Partial<AlertsNotifications>): Promise<AlertsNotifications>;
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {

  // Continuous Learning System — implémentations manquantes découvertes lors de l'audit des
  // erreurs TypeScript : ces méthodes étaient appelées par server/routes.ts (feedback,
  // apprentissage, performance des modèles) mais n'existaient nulle part sur DatabaseStorage —
  // chaque appel plantait avec un TypeError à l'exécution.
  async createFeedbackSession(data: InsertFeedbackSession): Promise<FeedbackSession> {
    const [record] = await db.insert(feedbackSessions).values(data).returning();
    return record;
  }

  async getFeedbackSessions(): Promise<FeedbackSession[]> {
    return await db.select().from(feedbackSessions).orderBy(desc(feedbackSessions.createdAt));
  }

  async getFeedbackBySessionId(sessionId: number): Promise<FeedbackSession | undefined> {
    const [record] = await db.select().from(feedbackSessions).where(eq(feedbackSessions.sessionId, sessionId));
    return record;
  }

  // Learning Metrics
  async getLearningMetrics(): Promise<LearningMetrics[]> {
    return await db.select().from(learningMetrics).orderBy(desc(learningMetrics.lastUpdated));
  }

  async getLearningMetricsByEquipment(equipmentType: string): Promise<LearningMetrics[]> {
    return await db.select().from(learningMetrics).where(eq(learningMetrics.equipmentType, equipmentType));
  }

  async updateLearningMetrics(equipmentType: string, symptomPattern: string, wasSuccessful: boolean): Promise<void> {
    const [existing] = await db.select().from(learningMetrics)
      .where(and(eq(learningMetrics.equipmentType, equipmentType), eq(learningMetrics.symptomPattern, symptomPattern)));

    if (existing) {
      const totalCases = (existing.totalCases ?? 0) + 1;
      const successfulCases = (existing.successfulCases ?? 0) + (wasSuccessful ? 1 : 0);
      await db.update(learningMetrics).set({
        totalCases,
        successfulCases,
        successRate: totalCases > 0 ? successfulCases / totalCases : 0,
        lastUpdated: new Date(),
      }).where(eq(learningMetrics.id, existing.id));
    } else {
      await db.insert(learningMetrics).values({
        equipmentType,
        symptomPattern,
        totalCases: 1,
        successfulCases: wasSuccessful ? 1 : 0,
        successRate: wasSuccessful ? 1 : 0,
      });
    }
  }

  // Model Performance Tracking
  async getModelPerformance(): Promise<ModelPerformance[]> {
    return await db.select().from(modelPerformance).orderBy(desc(modelPerformance.trainingDate));
  }

  async updateModelPerformance(data: InsertModelPerformance): Promise<ModelPerformance> {
    const [record] = await db.insert(modelPerformance).values(data).returning();
    return record;
  }

  // Adaptive Learning
  async getAdaptiveLearning(): Promise<AdaptiveLearning[]> {
    return await db.select().from(adaptiveLearning).orderBy(desc(adaptiveLearning.lastUpdate));
  }

  async getAdaptiveLearningByEquipment(equipmentType: string): Promise<AdaptiveLearning | undefined> {
    const [record] = await db.select().from(adaptiveLearning).where(eq(adaptiveLearning.equipmentType, equipmentType));
    return record;
  }

  async updateAdaptiveLearning(equipmentType: string, learningData: Partial<AdaptiveLearning>): Promise<void> {
    const [existing] = await db.select().from(adaptiveLearning).where(eq(adaptiveLearning.equipmentType, equipmentType));
    if (existing) {
      await db.update(adaptiveLearning).set({ ...learningData, lastUpdate: new Date() })
        .where(eq(adaptiveLearning.id, existing.id));
    } else {
      await db.insert(adaptiveLearning).values({ equipmentType, ...learningData });
    }
  }

  // Alerts and Notifications
  async createAlert(data: InsertAlertsNotifications): Promise<AlertsNotifications> {
    const [record] = await db.insert(alertsNotifications).values(data).returning();
    return record;
  }

  async updateAlert(id: number, updates: Partial<AlertsNotifications>): Promise<AlertsNotifications> {
    const [record] = await db.update(alertsNotifications).set(updates).where(eq(alertsNotifications.id, id)).returning();
    if (!record) throw new Error(`Alert with id ${id} not found`);
    return record;
  }

  async getAlertsByEquipment(equipmentId: number): Promise<AlertsNotifications[]> {
    return await db.select().from(alertsNotifications)
      .where(eq(alertsNotifications.equipmentId, equipmentId))
      .orderBy(desc(alertsNotifications.createdAt));
  }

  // Dernière lecture capteur / prédiction par équipement (utilisées pour des vues détail,
  // distinctes des listes paginées getIotSensorData / getPredictiveAnalytics ci-dessous).
  async getLatestSensorData(equipmentId: number): Promise<IotSensorData[]> {
    return await db.select().from(iotSensorData)
      .where(eq(iotSensorData.equipmentId, equipmentId))
      .orderBy(desc(iotSensorData.timestamp))
      .limit(50);
  }

  async getLatestPredictions(equipmentId: number): Promise<PredictiveAnalytics | undefined> {
    const [record] = await db.select().from(predictiveAnalytics)
      .where(eq(predictiveAnalytics.equipmentId, equipmentId))
      .orderBy(desc(predictiveAnalytics.predictionDate))
      .limit(1);
    return record;
  }

  // GMAO - Equipment Registry
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
    // insertEquipmentRegistrySchema documente equipmentId comme optionnel ("auto-generated"
    // côté appelant) — c'est ici, au seul point d'écriture réel, qu'il faut tenir cette promesse.
    const equipmentId = data.equipmentId || `EQ-${Date.now().toString(36).toUpperCase()}`;
    const [equipment] = await db.insert(equipmentRegistry).values({ ...data, equipmentId }).returning();
    return equipment;
  }

  async updateEquipment(id: number, updates: Partial<EquipmentRegistry>): Promise<EquipmentRegistry> {
    const [equipment] = await db
      .update(equipmentRegistry)
      .set(updates)
      .where(eq(equipmentRegistry.id, id))
      .returning();
    
    if (!equipment) {
      throw new Error(`Equipment with id ${id} not found`);
    }
    return equipment;
  }

  async getEquipment(): Promise<EquipmentRegistry[]> {
    return await db.select().from(equipmentRegistry).orderBy(desc(equipmentRegistry.createdAt));
  }

  async searchEquipment(query: { equipmentType?: string; zone?: string; sector?: string }): Promise<EquipmentRegistry[]> {
    const conditions = [];
    if (query.equipmentType) {
      conditions.push(ilike(equipmentRegistry.equipmentType, `%${query.equipmentType}%`));
    }
    if (query.zone) {
      conditions.push(ilike(equipmentRegistry.zone, `%${query.zone}%`));
    }
    if (query.sector) {
      conditions.push(ilike(equipmentRegistry.sector, `%${query.sector}%`));
    }

    return await db.select().from(equipmentRegistry)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(equipmentRegistry.createdAt));
  }

  // Work Orders - GMAO methods placeholders
  async getWorkOrders(): Promise<WorkOrder[]> {
    return await db.select().from(workOrders).orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrdersByTenant(tenantId: string): Promise<WorkOrder[]> {
    return await db.select().from(workOrders)
      .where(eq(workOrders.tenantId, tenantId))
      .orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrderById(id: number): Promise<WorkOrder | undefined> {
    const [order] = await db.select().from(workOrders).where(eq(workOrders.id, id));
    return order || undefined;
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
    // insertWorkOrderSchema omet orderNumber avec le commentaire "Auto-generated by storage
    // layer" — même convention que gmao-storage.ts::createWorkOrder pour rester cohérent.
    const orderNumber = `WO-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    // cost/laborCost/materialCost/externalCost sont number côté API (insertWorkOrderSchema)
    // mais decimal (string) côté colonne Postgres/Drizzle — conversion au seul point d'écriture.
    const { cost, laborCost, materialCost, externalCost, ...rest } = data;
    const [order] = await db.insert(workOrders).values({
      ...rest,
      orderNumber,
      cost: cost != null ? String(cost) : undefined,
      laborCost: laborCost != null ? String(laborCost) : undefined,
      materialCost: materialCost != null ? String(materialCost) : undefined,
      externalCost: externalCost != null ? String(externalCost) : undefined,
    }).returning();
    return order;
  }

  async updateWorkOrder(id: number, updates: Partial<WorkOrder>): Promise<WorkOrder> {
    const [order] = await db.update(workOrders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workOrders.id, id))
      .returning();
    if (!order) {
      throw new Error(`Work order with id ${id} not found`);
    }
    return order;
  }

  async updateWorkOrderStatus(id: number, status: string): Promise<WorkOrder> {
    const updates: Partial<WorkOrder> = { status, updatedAt: new Date() };
    if (status === 'completed') {
      updates.actualEnd = new Date();
    } else if (status === 'in_progress' ) {
      updates.actualStart = new Date();
    }
    const [order] = await db.update(workOrders)
      .set(updates)
      .where(eq(workOrders.id, id))
      .returning();
    if (!order) {
      throw new Error(`Work order with id ${id} not found`);
    }
    return order;
  }

  async getPreventiveMaintenancePlans(): Promise<PreventiveMaintenancePlan[]> {
    return await db.select().from(preventiveMaintenancePlans).orderBy(desc(preventiveMaintenancePlans.createdAt));
  }

  async getPreventiveMaintenancePlanById(id: number): Promise<PreventiveMaintenancePlan | undefined> {
    const [plan] = await db.select().from(preventiveMaintenancePlans).where(eq(preventiveMaintenancePlans.id, id));
    return plan || undefined;
  }

  async getPreventiveMaintenancePlansByEquipmentType(equipmentType: string): Promise<PreventiveMaintenancePlan[]> {
    return await db.select().from(preventiveMaintenancePlans)
      .where(eq(preventiveMaintenancePlans.equipmentType, equipmentType))
      .orderBy(desc(preventiveMaintenancePlans.createdAt));
  }

  async createPreventiveMaintenancePlan(data: InsertPreventiveMaintenancePlan): Promise<PreventiveMaintenancePlan> {
    const [plan] = await db
      .insert(preventiveMaintenancePlans)
      .values(data)
      .returning();
    return plan;
  }

  async updatePreventiveMaintenancePlan(id: number, updates: Partial<PreventiveMaintenancePlan>): Promise<PreventiveMaintenancePlan> {
    const [plan] = await db
      .update(preventiveMaintenancePlans)
      .set(updates)
      .where(eq(preventiveMaintenancePlans.id, id))
      .returning();
    
    if (!plan) {
      throw new Error(`Preventive maintenance plan with id ${id} not found`);
    }
    return plan;
  }

  async deletePreventiveMaintenancePlan(id: number): Promise<boolean> {
    const result = await db
      .delete(preventiveMaintenancePlans)
      .where(eq(preventiveMaintenancePlans.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getSpareParts(): Promise<SparePart[]> {
    return await db.select().from(spareParts).orderBy(desc(spareParts.createdAt));
  }

  async getSparePartById(id: number): Promise<SparePart | undefined> {
    const [part] = await db.select().from(spareParts).where(eq(spareParts.id, id));
    return part || undefined;
  }

  async getSparePartByPartNumber(partNumber: string): Promise<SparePart | undefined> {
    const [part] = await db.select().from(spareParts).where(eq(spareParts.partNumber, partNumber));
    return part || undefined;
  }

  async getSparePartsByCategory(category: string): Promise<SparePart[]> {
    return await db.select().from(spareParts)
      .where(eq(spareParts.category, category))
      .orderBy(desc(spareParts.createdAt));
  }

  async getLowStockParts(): Promise<SparePart[]> {
    return await db.select().from(spareParts)
      .where(sql`${spareParts.currentStock} <= ${spareParts.reorderPoint}`)
      .orderBy(spareParts.currentStock);
  }

  async createSparePart(data: InsertSparePart): Promise<SparePart> {
    const [part] = await db.insert(spareParts).values(data).returning();
    return part;
  }

  async updateSparePart(id: number, updates: Partial<SparePart>): Promise<SparePart> {
    const [part] = await db.update(spareParts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(spareParts.id, id))
      .returning();
    if (!part) {
      throw new Error(`Spare part with id ${id} not found`);
    }
    return part;
  }

  async getStockMovements(): Promise<StockMovement[]> {
    return await db.select().from(stockMovements).orderBy(desc(stockMovements.createdAt));
  }

  async getStockMovementsByPart(sparePartId: number): Promise<StockMovement[]> {
    return await db.select().from(stockMovements)
      .where(eq(stockMovements.sparePartId, sparePartId))
      .orderBy(desc(stockMovements.createdAt));
  }

  async createStockMovement(data: InsertStockMovement): Promise<StockMovement> {
    return await db.transaction(async (tx) => {
      const [movement] = await tx.insert(stockMovements).values(data).returning();
      if (data.movementType === 'IN' || data.movementType === 'RETURN') {
        await tx.update(spareParts)
          .set({ currentStock: sql`${spareParts.currentStock} + ${data.quantity}`, updatedAt: new Date() })
          .where(eq(spareParts.id, data.sparePartId));
      } else if (data.movementType === 'OUT') {
        await tx.update(spareParts)
          .set({ currentStock: sql`${spareParts.currentStock} - ${data.quantity}`, updatedAt: new Date() })
          .where(eq(spareParts.id, data.sparePartId));
      } else if (data.movementType === 'ADJUSTMENT') {
        await tx.update(spareParts)
          .set({ currentStock: data.newStock, updatedAt: new Date() })
          .where(eq(spareParts.id, data.sparePartId));
      }
      return movement;
    });
  }

  async getIotSensorData(equipmentId?: number, limit = 500): Promise<IotSensorData[]> {
    try {
      const query = db.select().from(iotSensorData).orderBy(desc(iotSensorData.timestamp)).limit(limit);
      if (equipmentId !== undefined) {
        return await db.select().from(iotSensorData)
          .where(eq(iotSensorData.equipmentId, equipmentId))
          .orderBy(desc(iotSensorData.timestamp)).limit(limit);
      }
      return await query;
    } catch (error) {
      console.error('getIotSensorData error:', error);
      return [];
    }
  }

  async createIotSensorData(data: InsertIotSensorData): Promise<IotSensorData> {
    const [record] = await db.insert(iotSensorData).values(data).returning();
    return record;
  }

  async getPredictiveAnalytics(tenantId?: string, limit = 100): Promise<PredictiveAnalytics[]> {
    try {
      if (tenantId) {
        return await db.select().from(predictiveAnalytics)
          .where(eq(predictiveAnalytics.tenantId, tenantId))
          .orderBy(desc(predictiveAnalytics.predictionDate)).limit(limit);
      }
      return await db.select().from(predictiveAnalytics)
        .orderBy(desc(predictiveAnalytics.predictionDate)).limit(limit);
    } catch (error) {
      console.error('getPredictiveAnalytics error:', error);
      return [];
    }
  }

  async createPredictiveAnalytics(data: InsertPredictiveAnalytics): Promise<PredictiveAnalytics> {
    const [record] = await db.insert(predictiveAnalytics).values(data).returning();
    return record;
  }

  async getKpiMetrics(tenantId?: string, limit = 200): Promise<KpiMetrics[]> {
    try {
      if (tenantId) {
        return await db.select().from(kpiMetrics)
          .where(eq(kpiMetrics.tenantId, tenantId))
          .orderBy(desc(kpiMetrics.calculationDate)).limit(limit);
      }
      return await db.select().from(kpiMetrics)
        .orderBy(desc(kpiMetrics.calculationDate)).limit(limit);
    } catch (error) {
      console.error('getKpiMetrics error:', error);
      return [];
    }
  }

  async createKpiMetrics(data: InsertKpiMetrics): Promise<KpiMetrics> {
    const [record] = await db.insert(kpiMetrics).values(data).returning();
    return record;
  }

  async getIntegrationLog(limit = 200): Promise<IntegrationLog[]> {
    try {
      return await db.select().from(integrationLog)
        .orderBy(desc(integrationLog.processedAt)).limit(limit);
    } catch (error) {
      console.error('getIntegrationLog error:', error);
      return [];
    }
  }

  async createIntegrationLog(data: InsertIntegrationLog): Promise<IntegrationLog> {
    const [record] = await db.insert(integrationLog).values(data).returning();
    return record;
  }

  async getAlerts(): Promise<AlertsNotifications[]> {
    return await db.select().from(alertsNotifications).orderBy(desc(alertsNotifications.createdAt)).limit(500);
  }

  async getAlertsNotifications(tenantId?: string, limit = 200): Promise<AlertsNotifications[]> {
    try {
      if (tenantId) {
        return await db.select().from(alertsNotifications)
          .where(eq(alertsNotifications.tenantId, tenantId))
          .orderBy(desc(alertsNotifications.createdAt)).limit(limit);
      }
      return await db.select().from(alertsNotifications)
        .orderBy(desc(alertsNotifications.createdAt)).limit(limit);
    } catch (error) {
      console.error('getAlertsNotifications error:', error);
      return [];
    }
  }

  async createAlertsNotifications(data: InsertAlertsNotifications): Promise<AlertsNotifications> {
    const [record] = await db.insert(alertsNotifications).values(data).returning();
    return record;
  }

  async getMaintenanceCases(): Promise<MaintenanceCase[]> {
    return await db.select().from(maintenanceCases).orderBy(desc(maintenanceCases.createdAt));
  }

  async getMaintenanceCaseById(id: number): Promise<MaintenanceCase | undefined> {
    const [case_] = await db.select().from(maintenanceCases).where(eq(maintenanceCases.id, id));
    return case_ || undefined;
  }

  async createMaintenanceCase(data: InsertMaintenanceCase): Promise<MaintenanceCase> {
    const [case_] = await db
      .insert(maintenanceCases)
      .values(data)
      .returning();
    return case_;
  }

  async searchMaintenanceCases(query: { equipmentType?: string; symptoms?: string[] }): Promise<MaintenanceCase[]> {
    let whereConditions = [];

    if (query.equipmentType) {
      whereConditions.push(eq(maintenanceCases.equipmentType, query.equipmentType));
    }

    if (query.symptoms && query.symptoms.length > 0) {
      const symptomConditions = query.symptoms.map(symptom => 
        ilike(maintenanceCases.symptoms, `%${symptom}%`)
      );
      whereConditions.push(or(...symptomConditions));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    return await db
      .select()
      .from(maintenanceCases)
      .where(whereClause)
      .orderBy(desc(maintenanceCases.createdAt));
  }

  // Repair Procedures
  async getRepairProceduresByCaseId(caseId: number): Promise<RepairProcedure[]> {
    return await db
      .select()
      .from(repairProcedures)
      .where(eq(repairProcedures.caseId, caseId))
      .orderBy(repairProcedures.stepNumber);
  }

  async createRepairProcedure(data: InsertRepairProcedure): Promise<RepairProcedure> {
    const [procedure] = await db
      .insert(repairProcedures)
      .values(data)
      .returning();
    return procedure;
  }

  async updateRepairProcedureCompletion(id: number, completed: boolean): Promise<RepairProcedure> {
    const [procedure] = await db
      .update(repairProcedures)
      .set({ isCompleted: completed })
      .where(eq(repairProcedures.id, id))
      .returning();
    
    if (!procedure) {
      throw new Error(`Repair procedure with id ${id} not found`);
    }
    return procedure;
  }

  // Reported Cases
  async getReportedCases(): Promise<ReportedCase[]> {
    return await db.select().from(reportedCases).orderBy(desc(reportedCases.createdAt));
  }

  async createReportedCase(data: InsertReportedCase): Promise<ReportedCase> {
    const [reportedCase] = await db
      .insert(reportedCases)
      .values({ ...data, status: "pending" })
      .returning();
    return reportedCase;
  }

  async updateReportedCaseStatus(id: number, status: string): Promise<ReportedCase> {
    const [reportedCase] = await db
      .update(reportedCases)
      .set({ status })
      .where(eq(reportedCases.id, id))
      .returning();
    
    if (!reportedCase) {
      throw new Error(`Reported case with id ${id} not found`);
    }
    return reportedCase;
  }

  // Diagnostic Sessions
  async getDiagnosticSessions(): Promise<DiagnosticSession[]> {
    return await db.select().from(diagnosticSessions).orderBy(desc(diagnosticSessions.createdAt));
  }

  async createDiagnosticSession(data: InsertDiagnosticSession): Promise<DiagnosticSession> {
    // Support both tenant and legacy mode - make tenantId optional for backward compatibility
    const sessionData = { ...data, status: "pending" };
    if (!sessionData.tenantId) {
      sessionData.tenantId = null; // Allow null for legacy mode
    }
    
    const [session] = await db
      .insert(diagnosticSessions)
      .values(sessionData)
      .returning();
    return session;
  }

  async updateDiagnosticSession(id: number, updates: Partial<DiagnosticSession>): Promise<DiagnosticSession> {
    const [session] = await db
      .update(diagnosticSessions)
      .set(updates)
      .where(eq(diagnosticSessions.id, id))
      .returning();

    if (!session) {
      throw new Error(`Diagnostic session with id ${id} not found`);
    }
    return session;
  }

  /**
   * IA → Analytics : agrégats réels sur diagnostic_sessions pour ce tenant. Scoping identique à
   * getEquipment/getWorkOrders (eq(tenantId, ...)) — ne pas imiter le pattern non-scopé de
   * getKpiMetrics/getBudgets. Les sessions à tenantId null (ancien chemin d'écriture legacy) ne
   * sont délibérément pas comptées ici : les mélanger à un tenant précis serait une fuite.
   */
  async getDiagnosticStats(tenantId: string): Promise<DiagnosticStats> {
    const [row] = await db
      .select({
        totalSessions: sql<number>`COUNT(*)`,
        avgConfidence: sql<number>`COALESCE(AVG(${diagnosticSessions.confidence}), 0)`,
        completionRate: sql<number>`COALESCE(AVG(CASE WHEN ${diagnosticSessions.status} = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 0)`,
        mlPredictionRate: sql<number>`COALESCE(AVG(CASE WHEN ${diagnosticSessions.mlPrediction} = true THEN 1.0 ELSE 0.0 END) * 100, 0)`,
      })
      .from(diagnosticSessions)
      .where(eq(diagnosticSessions.tenantId, tenantId));

    return {
      totalSessions: Number(row?.totalSessions ?? 0),
      avgConfidence: Number(row?.avgConfidence ?? 0),
      completionRate: Math.round(Number(row?.completionRate ?? 0)),
      mlPredictionRate: Math.round(Number(row?.mlPredictionRate ?? 0)),
    };
  }

  // User Profile Methods for DatabaseStorage
  async getUserProfiles(): Promise<UserProfile[]> {
    return await db.select().from(userProfiles).orderBy(desc(userProfiles.createdAt));
  }

  async getUserProfileById(id: number): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.id, id));
    return profile || undefined;
  }

  async getUserProfileByUsername(username: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.username, username));
    return profile || undefined;
  }

  async createUserProfile(data: InsertUserProfile): Promise<UserProfile> {
    const [profile] = await db
      .insert(userProfiles)
      .values(data)
      .returning();
    return profile;
  }

  async updateUserProfile(id: number, updates: Partial<UserProfile>): Promise<UserProfile> {
    const [profile] = await db
      .update(userProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userProfiles.id, id))
      .returning();
    
    if (!profile) {
      throw new Error(`User profile with id ${id} not found`);
    }
    return profile;
  }

  async deleteUserProfile(id: number): Promise<boolean> {
    const result = await db
      .delete(userProfiles)
      .where(eq(userProfiles.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();
