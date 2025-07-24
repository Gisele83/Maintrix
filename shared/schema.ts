import { pgTable, text, serial, integer, boolean, timestamp, real, varchar, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const equipmentTypes = pgTable("equipment_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
});

export const maintenanceCases = pgTable("maintenance_cases", {
  id: serial("id").primaryKey(),
  equipmentType: text("equipment_type").notNull(),
  equipmentId: text("equipment_id"),
  zone: text("zone"),
  sector: text("sector"),
  symptoms: text("symptoms").notNull(),
  symptomsChecked: text("symptoms_checked").array(),
  diagnosis: text("diagnosis").notNull(),
  solution: text("solution").notNull(),
  duration: integer("duration"), // in minutes
  resolved: boolean("resolved").default(true),
  urgency: text("urgency").notNull(), // low, medium, high
  confidence: real("confidence"), // 0-1
  createdAt: timestamp("created_at").defaultNow(),
});

export const repairProcedures = pgTable("repair_procedures", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").references(() => maintenanceCases.id),
  stepNumber: integer("step_number").notNull(),
  title: text("title").notNull(),
  titleEn: text("title_en").notNull(),
  description: text("description").notNull(),
  descriptionEn: text("description_en").notNull(),
  safetyWarning: text("safety_warning"),
  safetyWarningEn: text("safety_warning_en"),
  toolsRequired: text("tools_required").array(),
  toolsRequiredEn: text("tools_required_en").array(),
  estimatedTime: integer("estimated_time"), // in minutes
  isCompleted: boolean("is_completed").default(false),
});

export const reportedCases = pgTable("reported_cases", {
  id: serial("id").primaryKey(),
  equipmentType: text("equipment_type").notNull(),
  equipmentId: text("equipment_id"),
  zone: text("zone"),
  contact: text("contact"),
  description: text("description").notNull(),
  attemptedSolutions: text("attempted_solutions"),
  impact: text("impact").notNull(), // low, medium, high
  status: text("status").notNull().default("pending"), // pending, analyzing, resolved
  attachments: text("attachments").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const diagnosticSessions = pgTable("diagnostic_sessions", {
  id: serial("id").primaryKey(),
  equipmentType: text("equipment_type").notNull(),
  equipmentId: text("equipment_id"),
  zone: text("zone"),
  sector: text("sector"),
  symptoms: text("symptoms").notNull(),
  symptomsChecked: text("symptoms_checked").array(),
  urgency: text("urgency").notNull(),
  results: text("results"), // JSON string of diagnostic results
  selectedDiagnosis: text("selected_diagnosis"),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed
  createdAt: timestamp("created_at").defaultNow(),
  confidence: real("confidence"),
  mlPrediction: boolean("ml_prediction").default(false),
  sessionData: text("session_data"), // JSON string for additional session data
  userId: integer("user_id"), // Link to user profile
});

// User profiles table
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  firstName: varchar("first_name", { length: 50 }),
  lastName: varchar("last_name", { length: 50 }),
  email: varchar("email", { length: 100 }).unique(),
  role: varchar("role", { length: 30 }).default("technician"), // technician, supervisor, admin
  department: varchar("department", { length: 50 }),
  phoneNumber: varchar("phone_number", { length: 20 }),
  preferredLanguage: varchar("preferred_language", { length: 5 }).default("fr"),
  specializations: text("specializations").array(), // Areas of expertise
  experienceLevel: varchar("experience_level", { length: 20 }).default("intermediate"), // beginner, intermediate, expert
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertMaintenanceCaseSchema = createInsertSchema(maintenanceCases).omit({
  id: true,
  createdAt: true,
});

export const insertRepairProcedureSchema = createInsertSchema(repairProcedures).omit({
  id: true,
});

export const insertReportedCaseSchema = createInsertSchema(reportedCases).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertDiagnosticSessionSchema = createInsertSchema(diagnosticSessions).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
});

// Types
export type MaintenanceCase = typeof maintenanceCases.$inferSelect;
export type InsertMaintenanceCase = z.infer<typeof insertMaintenanceCaseSchema>;

export type RepairProcedure = typeof repairProcedures.$inferSelect;
export type InsertRepairProcedure = z.infer<typeof insertRepairProcedureSchema>;

export type ReportedCase = typeof reportedCases.$inferSelect;
export type InsertReportedCase = z.infer<typeof insertReportedCaseSchema>;

export type DiagnosticSession = typeof diagnosticSessions.$inferSelect;
export type InsertDiagnosticSession = z.infer<typeof insertDiagnosticSessionSchema>;

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

export type EquipmentType = typeof equipmentTypes.$inferSelect;

// Feedback and Learning Tables for Continuous Improvement
export const feedbackSessions = pgTable("feedback_sessions", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => diagnosticSessions.id),
  userFeedback: text("user_feedback"), // "helpful", "partially_helpful", "not_helpful"
  feedbackComment: text("feedback_comment"),
  actualSolution: text("actual_solution"), // What actually fixed the problem
  timeToResolution: integer("time_to_resolution"), // Minutes to actually fix
  wasAccurate: boolean("was_accurate"), // Was the diagnosis correct?
  difficultyLevel: text("difficulty_level"), // "easy", "medium", "hard"
  createdAt: timestamp("created_at").defaultNow(),
});

export const learningMetrics = pgTable("learning_metrics", {
  id: serial("id").primaryKey(),
  equipmentType: text("equipment_type").notNull(),
  symptomPattern: text("symptom_pattern").notNull(),
  successRate: real("success_rate").default(0.75), // Percentage as decimal
  avgConfidence: real("avg_confidence").default(0.80),
  totalCases: integer("total_cases").default(0),
  successfulCases: integer("successful_cases").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
  improvementSuggestions: jsonb("improvement_suggestions"), // AI-generated suggestions
});

export const modelPerformance = pgTable("model_performance", {
  id: serial("id").primaryKey(),
  modelType: text("model_type").notNull(), // "standard_ml", "advanced_ml", "ensemble_ml"
  equipmentType: text("equipment_type").notNull(),
  accuracy: real("accuracy").default(0),
  precision: real("precision").default(0),
  recall: real("recall").default(0),
  f1Score: real("f1_score").default(0),
  trainingDate: timestamp("training_date").defaultNow(),
  sampleSize: integer("sample_size").default(0),
  crossValidationScore: real("cv_score").default(0),
});

export const adaptiveLearning = pgTable("adaptive_learning", {
  id: serial("id").primaryKey(),
  equipmentType: text("equipment_type").notNull(),
  symptomKeywords: jsonb("symptom_keywords"), // Most important keywords for this equipment
  commonFailures: jsonb("common_failures"), // Frequently occurring failure patterns
  seasonalPatterns: jsonb("seasonal_patterns"), // Time-based failure patterns
  zoneSpecificIssues: jsonb("zone_specific_issues"), // Issues specific to certain zones
  learningWeight: real("learning_weight").default(1.0),
  confidenceAdjustment: real("confidence_adjustment").default(0),
  lastUpdate: timestamp("last_update").defaultNow(),
});

export type InsertFeedbackSession = typeof feedbackSessions.$inferInsert;
export type FeedbackSession = typeof feedbackSessions.$inferSelect;
export type InsertLearningMetrics = typeof learningMetrics.$inferInsert;
export type LearningMetrics = typeof learningMetrics.$inferSelect;
export type InsertModelPerformance = typeof modelPerformance.$inferInsert;
export type ModelPerformance = typeof modelPerformance.$inferSelect;
export type InsertAdaptiveLearning = typeof adaptiveLearning.$inferInsert;
export type AdaptiveLearning = typeof adaptiveLearning.$inferSelect;

// GMAO COMPLETE TABLES - Extension for comprehensive maintenance management

// Equipment Registry - Complete asset management
export const equipmentRegistry = pgTable("equipment_registry", {
  id: serial("id").primaryKey(),
  equipmentId: varchar("equipment_id", { length: 100 }).notNull().unique(),
  equipmentName: text("equipment_name").notNull(),
  equipmentType: text("equipment_type").notNull(),
  manufacturer: varchar("manufacturer", { length: 100 }),
  model: varchar("model", { length: 100 }),
  serialNumber: varchar("serial_number", { length: 100 }),
  location: text("location"), // Zone + Sector combined
  zone: varchar("zone", { length: 50 }),
  sector: varchar("sector", { length: 50 }),
  installationDate: timestamp("installation_date"),
  warrantyExpiry: timestamp("warranty_expiry"),
  criticalityLevel: varchar("criticality_level", { length: 20 }).default("medium"), // low, medium, high, critical
  operationalState: varchar("operational_state", { length: 20 }).default("operational"), // operational, maintenance, offline, decommissioned
  technicalSpecs: jsonb("technical_specs"), // JSON with technical specifications
  manuals: text("manuals").array(), // URLs to manuals and documentation
  spareParts: jsonb("spare_parts"), // JSON array of spare parts info
  maintenanceSchedule: jsonb("maintenance_schedule"), // Preventive maintenance schedule
  iotSensors: jsonb("iot_sensors"), // Connected IoT sensors configuration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Work Orders (Ordres de Travail) - Core GMAO functionality
export const workOrders = pgTable("work_orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  orderType: varchar("order_type", { length: 30 }).notNull(), // preventive, corrective, predictive, emergency
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium"), // low, medium, high, urgent
  status: varchar("status", { length: 30 }).default("pending"), // pending, assigned, in_progress, paused, completed, cancelled
  assignedTo: integer("assigned_to").references(() => userProfiles.id),
  requestedBy: integer("requested_by").references(() => userProfiles.id),
  estimatedDuration: integer("estimated_duration"), // minutes
  actualDuration: integer("actual_duration"), // minutes
  scheduledStart: timestamp("scheduled_start"),
  actualStart: timestamp("actual_start"),
  scheduledEnd: timestamp("scheduled_end"),
  actualEnd: timestamp("actual_end"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  laborCost: decimal("labor_cost", { precision: 10, scale: 2 }),
  materialCost: decimal("material_cost", { precision: 10, scale: 2 }),
  externalCost: decimal("external_cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  completionNotes: text("completion_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Preventive Maintenance Plans
export const preventiveMaintenancePlans = pgTable("preventive_maintenance_plans", {
  id: serial("id").primaryKey(),
  planName: text("plan_name").notNull(),
  equipmentType: text("equipment_type").notNull(),
  equipmentIds: jsonb("equipment_ids"), // Array of equipment IDs covered by this plan
  frequency: varchar("frequency", { length: 30 }).notNull(), // daily, weekly, monthly, quarterly, annually, hours_based, usage_based
  frequencyValue: integer("frequency_value"), // e.g., 500 (hours), 1000 (cycles)
  tasks: jsonb("tasks"), // Array of maintenance tasks
  estimatedDuration: integer("estimated_duration"), // minutes
  requiredSkills: text("required_skills").array(),
  safetyRequirements: text("safety_requirements"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastExecuted: timestamp("last_executed"),
  nextDue: timestamp("next_due"),
});

// Spare Parts Inventory Management
export const spareParts = pgTable("spare_parts", {
  id: serial("id").primaryKey(),
  partNumber: varchar("part_number", { length: 100 }).notNull().unique(),
  partName: text("part_name").notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }),
  manufacturer: varchar("manufacturer", { length: 100 }),
  supplier: varchar("supplier", { length: 100 }),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 5 }).default("EUR"),
  currentStock: integer("current_stock").default(0),
  minStock: integer("min_stock").default(0),
  maxStock: integer("max_stock").default(100),
  reorderPoint: integer("reorder_point").default(0),
  leadTime: integer("lead_time"), // days
  location: text("location"), // Storage location
  compatibleEquipment: jsonb("compatible_equipment"), // Array of equipment IDs
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stock Movements
export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  sparePartId: integer("spare_part_id").references(() => spareParts.id),
  movementType: varchar("movement_type", { length: 20 }).notNull(), // in, out, adjustment, return
  quantity: integer("quantity").notNull(),
  reference: text("reference"), // Work order number, purchase order, etc.
  reason: text("reason"),
  performedBy: integer("performed_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// IoT Sensor Data - Real-time monitoring
export const iotSensorData = pgTable("iot_sensor_data", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  sensorType: varchar("sensor_type", { length: 50 }).notNull(), // temperature, vibration, pressure, flow, current, etc.
  sensorId: varchar("sensor_id", { length: 100 }).notNull(),
  value: decimal("value", { precision: 15, scale: 6 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  quality: varchar("quality", { length: 20 }).default("good"), // good, uncertain, bad
  alarmState: varchar("alarm_state", { length: 20 }).default("normal"), // normal, warning, alarm, critical
  metadata: jsonb("metadata"), // Additional sensor metadata
});

// Predictive Analytics Data
export const predictiveAnalytics = pgTable("predictive_analytics", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  analysisType: varchar("analysis_type", { length: 50 }).notNull(), // rul, anomaly, pattern, trend
  predictionDate: timestamp("prediction_date").defaultNow(),
  remainingUsefulLife: integer("remaining_useful_life"), // days
  failureProbability: real("failure_probability"), // 0-1
  anomalyScore: real("anomaly_score"),
  confidenceLevel: real("confidence_level"), // 0-1
  riskLevel: varchar("risk_level", { length: 20 }).default("low"), // low, medium, high, critical
  recommendations: jsonb("recommendations"), // Array of recommended actions
  modelVersion: varchar("model_version", { length: 50 }),
  inputFeatures: jsonb("input_features"), // Features used for prediction
  alertGenerated: boolean("alert_generated").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// KPI Metrics Tracking
export const kpiMetrics = pgTable("kpi_metrics", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  metricType: varchar("metric_type", { length: 50 }).notNull(), // mtbf, mttr, availability, oee, cost
  metricValue: decimal("metric_value", { precision: 15, scale: 6 }).notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  calculationDate: timestamp("calculation_date").defaultNow(),
  context: jsonb("context"), // Additional context for the metric
});

// ERP/MES Integration Log
export const integrationLog = pgTable("integration_log", {
  id: serial("id").primaryKey(),
  systemName: varchar("system_name", { length: 100 }).notNull(), // SAP, Maximo, MES, etc.
  operationType: varchar("operation_type", { length: 50 }).notNull(), // sync, push, pull, update
  entityType: varchar("entity_type", { length: 50 }).notNull(), // work_order, equipment, spare_part
  entityId: integer("entity_id"),
  status: varchar("status", { length: 30 }).notNull(), // success, failed, pending
  message: text("message"),
  requestData: jsonb("request_data"),
  responseData: jsonb("response_data"),
  processedAt: timestamp("processed_at").defaultNow(),
});

// Alerts and Notifications
export const alertsNotifications = pgTable("alerts_notifications", {
  id: serial("id").primaryKey(),
  alertType: varchar("alert_type", { length: 50 }).notNull(), // threshold, anomaly, maintenance_due, stock_low
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  severity: varchar("severity", { length: 20 }).default("medium"), // low, medium, high, critical
  title: text("title").notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 20 }).default("active"), // active, acknowledged, resolved, dismissed
  assignedTo: integer("assigned_to").references(() => userProfiles.id),
  triggerValue: decimal("trigger_value", { precision: 15, scale: 6 }),
  thresholdValue: decimal("threshold_value", { precision: 15, scale: 6 }),
  acknowledgedBy: integer("acknowledged_by").references(() => userProfiles.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedBy: integer("resolved_by").references(() => userProfiles.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for new tables
export const insertEquipmentRegistrySchema = createInsertSchema(equipmentRegistry).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPreventiveMaintenancePlanSchema = createInsertSchema(preventiveMaintenancePlans).omit({
  id: true,
  createdAt: true,
});

export const insertSparePartSchema = createInsertSchema(spareParts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStockMovementSchema = createInsertSchema(stockMovements).omit({
  id: true,
  createdAt: true,
});

export const insertIotSensorDataSchema = createInsertSchema(iotSensorData).omit({
  id: true,
  timestamp: true,
});

export const insertPredictiveAnalyticsSchema = createInsertSchema(predictiveAnalytics).omit({
  id: true,
  predictionDate: true,
  createdAt: true,
});

export const insertKpiMetricsSchema = createInsertSchema(kpiMetrics).omit({
  id: true,
  calculationDate: true,
});

export const insertIntegrationLogSchema = createInsertSchema(integrationLog).omit({
  id: true,
  processedAt: true,
});

export const insertAlertsNotificationsSchema = createInsertSchema(alertsNotifications).omit({
  id: true,
  createdAt: true,
});

// Types for new tables
export type EquipmentRegistry = typeof equipmentRegistry.$inferSelect;
export type InsertEquipmentRegistry = z.infer<typeof insertEquipmentRegistrySchema>;

export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;

export type PreventiveMaintenancePlan = typeof preventiveMaintenancePlans.$inferSelect;
export type InsertPreventiveMaintenancePlan = z.infer<typeof insertPreventiveMaintenancePlanSchema>;

export type SparePart = typeof spareParts.$inferSelect;
export type InsertSparePart = z.infer<typeof insertSparePartSchema>;

export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;

export type IotSensorData = typeof iotSensorData.$inferSelect;
export type InsertIotSensorData = z.infer<typeof insertIotSensorDataSchema>;

export type PredictiveAnalytics = typeof predictiveAnalytics.$inferSelect;
export type InsertPredictiveAnalytics = z.infer<typeof insertPredictiveAnalyticsSchema>;

export type KpiMetrics = typeof kpiMetrics.$inferSelect;
export type InsertKpiMetrics = z.infer<typeof insertKpiMetricsSchema>;

export type IntegrationLog = typeof integrationLog.$inferSelect;
export type InsertIntegrationLog = z.infer<typeof insertIntegrationLogSchema>;

export type AlertsNotifications = typeof alertsNotifications.$inferSelect;
export type InsertAlertsNotifications = z.infer<typeof insertAlertsNotificationsSchema>;
