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

// User profiles table - Extended with validation capabilities
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  firstName: varchar("first_name", { length: 50 }),
  lastName: varchar("last_name", { length: 50 }),
  email: varchar("email", { length: 100 }).unique(),
  role: varchar("role", { length: 30 }).default("technician"), // technician, supervisor, manager, director, admin
  department: varchar("department", { length: 50 }),
  phoneNumber: varchar("phone_number", { length: 20 }),
  preferredLanguage: varchar("preferred_language", { length: 5 }).default("fr"),
  specializations: text("specializations").array(), // Areas of expertise
  experienceLevel: varchar("experience_level", { length: 20 }).default("intermediate"), // beginner, intermediate, expert
  // VALIDATION SYSTEM FIELDS
  validationLevel: integer("validation_level").default(0), // 0=no validation rights, 1-3=validation levels
  canValidateWorkOrders: boolean("can_validate_work_orders").default(false),
  canValidatePurchaseOrders: boolean("can_validate_purchase_orders").default(false),
  maxPurchaseAmount: decimal("max_purchase_amount", { precision: 12, scale: 2 }), // Maximum amount they can approve
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

// Company Configuration - Enterprise Branding and Letterhead
export const companyConfig = pgTable("company_config", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 255 }),
  taxNumber: varchar("tax_number", { length: 100 }),
  logoUrl: varchar("logo_url", { length: 500 }),
  logoBase64: text("logo_base64"), // For storing uploaded logo as base64
  headerTemplate: text("header_template"), // Custom header template HTML
  footerTemplate: text("footer_template"), // Custom footer template HTML
  primaryColor: varchar("primary_color", { length: 7 }).default("#0066cc"), // Hex color
  secondaryColor: varchar("secondary_color", { length: 7 }).default("#f8f9fa"),
  fontFamily: varchar("font_family", { length: 100 }).default("Arial, sans-serif"),
  letterheadTemplate: text("letterhead_template"), // Complete letterhead template
  documentFooter: text("document_footer"), // Standard footer for documents
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  // VALIDATION SYSTEM - 2 LEVELS FOR WORK ORDERS
  validationStatus: varchar("validation_status", { length: 30 }).default("pending"), // pending, level1_validated, fully_validated, rejected
  level1ValidatedBy: integer("level1_validated_by").references(() => userProfiles.id), // Supervisor validation
  level1ValidatedAt: timestamp("level1_validated_at"),
  level1ValidationNotes: text("level1_validation_notes"),
  level2ValidatedBy: integer("level2_validated_by").references(() => userProfiles.id), // Manager validation
  level2ValidatedAt: timestamp("level2_validated_at"),
  level2ValidationNotes: text("level2_validation_notes"),
  rejectedBy: integer("rejected_by").references(() => userProfiles.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  canExecute: boolean("can_execute").default(false), // Only true after full validation
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

// Validation Logs table - Track all validation steps for audit
export const validationLogs = pgTable("validation_logs", {
  id: serial("id").primaryKey(),
  recordType: varchar("record_type", { length: 30 }).notNull(), // work_order, purchase_order
  recordId: integer("record_id").notNull(),
  validationLevel: integer("validation_level").notNull(), // 1, 2, 3
  action: varchar("action", { length: 20 }).notNull(), // validate, reject
  validatedBy: integer("validated_by").references(() => userProfiles.id),
  validationDate: timestamp("validation_date").defaultNow(),
  comments: text("comments"),
  previousStatus: varchar("previous_status", { length: 30 }),
  newStatus: varchar("new_status", { length: 30 }),
  metadata: jsonb("metadata"), // Additional context data
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

export const insertValidationLogSchema = createInsertSchema(validationLogs).omit({
  id: true,
  validationDate: true,
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

export type ValidationLog = typeof validationLogs.$inferSelect;
export type InsertValidationLog = z.infer<typeof insertValidationLogSchema>;

// Suppliers/Manufacturers table
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  supplierCode: varchar("supplier_code", { length: 50 }).unique().notNull(),
  companyName: varchar("company_name", { length: 200 }).notNull(),
  supplierType: varchar("supplier_type", { length: 50 }).notNull(), // manufacturer, distributor, service_provider
  contactPerson: varchar("contact_person", { length: 100 }),
  email: varchar("email", { length: 150 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),
  rating: integer("rating").default(0), // 1-5 stars
  paymentTerms: varchar("payment_terms", { length: 100 }),
  deliveryTime: integer("delivery_time"), // days
  certifications: jsonb("certifications"), // ISO, quality certs
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Orders table
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).unique().notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  orderType: varchar("order_type", { length: 50 }).notNull(), // spare_parts, services, maintenance
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, sent, confirmed, received, cancelled
  priority: varchar("priority", { length: 20 }).notNull().default("medium"), // low, medium, high, urgent
  requestedBy: varchar("requested_by", { length: 100 }),
  approvedBy: varchar("approved_by", { length: 100 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("EUR"),
  orderDate: timestamp("order_date").defaultNow(),
  expectedDelivery: timestamp("expected_delivery"),
  actualDelivery: timestamp("actual_delivery"),
  deliveryAddress: text("delivery_address"),
  notes: text("notes"),
  terms: text("terms"),
  // VALIDATION SYSTEM - 2 LEVELS POUR BONS DE COMMANDE
  validationStatus: varchar("validation_status", { length: 30 }).default("pending"), // pending, chef_service_validated, directeur_validated, ready_for_print, printed, rejected
  chefServiceValidatedBy: integer("chef_service_validated_by").references(() => userProfiles.id), // Chef de Service Utilisateur
  chefServiceValidatedAt: timestamp("chef_service_validated_at"),
  chefServiceValidationNotes: text("chef_service_validation_notes"),
  directeurValidatedBy: integer("directeur_validated_by").references(() => userProfiles.id), // Directeur Général
  directeurValidatedAt: timestamp("directeur_validated_at"),
  directeurValidationNotes: text("directeur_validation_notes"),
  documentsJustificatifs: jsonb("documents_justificatifs"), // Documents joints par l'initiateur
  rejectedBy: integer("rejected_by").references(() => userProfiles.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  canPrint: boolean("can_print").default(false), // Only true after full validation
  printedBy: integer("printed_by").references(() => userProfiles.id),
  printedAt: timestamp("printed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Order Items table
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id),
  sparePartId: integer("spare_part_id").references(() => spareParts.id),
  partNumber: varchar("part_number", { length: 100 }),
  description: text("description"),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }),
  expectedDelivery: timestamp("expected_delivery"),
  received: boolean("received").default(false),
  receivedQuantity: integer("received_quantity").default(0),
  receivedDate: timestamp("received_date"),
  notes: text("notes"),
});

// Automatic Reorder Rules table
export const reorderRules = pgTable("reorder_rules", {
  id: serial("id").primaryKey(),
  sparePartId: integer("spare_part_id").references(() => spareParts.id),
  reorderPoint: integer("reorder_point").notNull(), // minimum stock level
  reorderQuantity: integer("reorder_quantity").notNull(), // quantity to order
  maxStock: integer("max_stock"), // maximum stock level
  supplierId: integer("supplier_id").references(() => suppliers.id),
  isActive: boolean("is_active").default(true),
  leadTime: integer("lead_time"), // days
  lastTriggered: timestamp("last_triggered"),
  autoOrder: boolean("auto_order").default(false), // automatic order generation
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas for new procurement tables
export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
});

export const insertReorderRuleSchema = createInsertSchema(reorderRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for new procurement tables
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;

export type ReorderRule = typeof reorderRules.$inferSelect;
export type InsertReorderRule = z.infer<typeof insertReorderRuleSchema>;

// ============= MAINTENANCE REPORTS TABLES =============

// Maintenance Reports table - Generated after each intervention
export const maintenanceReports = pgTable("maintenance_reports", {
  id: serial("id").primaryKey(),
  reportNumber: varchar("report_number", { length: 50 }).unique().notNull(),
  workOrderId: integer("work_order_id").references(() => workOrders.id),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  reportType: varchar("report_type", { length: 50 }).notNull(), // intervention, preventive, corrective, inspection
  interventionType: varchar("intervention_type", { length: 50 }), // repair, replacement, adjustment, inspection
  technician: varchar("technician", { length: 100 }).notNull(),
  supervisor: varchar("supervisor", { length: 100 }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  actualDuration: integer("actual_duration"), // minutes
  plannedDuration: integer("planned_duration"), // minutes
  workDescription: text("work_description").notNull(),
  problemDiagnosis: text("problem_diagnosis"),
  actionsTaken: text("actions_taken").notNull(),
  partsUsed: jsonb("parts_used"), // Array of {partId, partNumber, quantity, cost}
  toolsUsed: text("tools_used").array(),
  safetyIncidents: text("safety_incidents"),
  qualityCheck: boolean("quality_check").default(false),
  qualityNotes: text("quality_notes"),
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: timestamp("follow_up_date"),
  followUpNotes: text("follow_up_notes"),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  laborCost: decimal("labor_cost", { precision: 10, scale: 2 }),
  partsCost: decimal("parts_cost", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 30 }).notNull().default("draft"), // draft, approved, archived
  approvedBy: varchar("approved_by", { length: 100 }),
  approvalDate: timestamp("approval_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Monthly Reports table - Generated monthly with KPIs and statistics
export const monthlyReports = pgTable("monthly_reports", {
  id: serial("id").primaryKey(),
  reportNumber: varchar("report_number", { length: 50 }).unique().notNull(),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  generatedBy: varchar("generated_by", { length: 100 }),
  generatedAt: timestamp("generated_at").defaultNow(),
  
  // Equipment statistics
  totalEquipment: integer("total_equipment"),
  activeEquipment: integer("active_equipment"),
  equipmentAvailability: decimal("equipment_availability", { precision: 5, scale: 2 }), // percentage
  
  // Work orders statistics
  totalWorkOrders: integer("total_work_orders"),
  completedWorkOrders: integer("completed_work_orders"),
  preventiveWorkOrders: integer("preventive_work_orders"),
  correctiveWorkOrders: integer("corrective_work_orders"),
  averageCompletionTime: decimal("average_completion_time", { precision: 8, scale: 2 }), // hours
  
  // Maintenance KPIs
  mtbf: decimal("mtbf", { precision: 8, scale: 2 }), // Mean Time Between Failures (hours)
  mttr: decimal("mttr", { precision: 8, scale: 2 }), // Mean Time To Repair (hours)
  plannedMaintenanceRatio: decimal("planned_maintenance_ratio", { precision: 5, scale: 2 }), // percentage
  maintenanceEfficiency: decimal("maintenance_efficiency", { precision: 5, scale: 2 }), // percentage
  
  // Cost analysis
  totalMaintenanceCost: decimal("total_maintenance_cost", { precision: 12, scale: 2 }),
  laborCost: decimal("labor_cost", { precision: 12, scale: 2 }),
  partsCost: decimal("parts_cost", { precision: 12, scale: 2 }),
  contractorCost: decimal("contractor_cost", { precision: 12, scale: 2 }),
  costPerWorkOrder: decimal("cost_per_work_order", { precision: 10, scale: 2 }),
  
  // Parts and inventory
  partsConsumed: integer("parts_consumed"),
  inventoryTurnover: decimal("inventory_turnover", { precision: 5, scale: 2 }),
  stockouts: integer("stockouts"),
  emergencyPurchases: integer("emergency_purchases"),
  
  // Alerts and incidents
  totalAlerts: integer("total_alerts"),
  criticalAlerts: integer("critical_alerts"),
  safetyIncidents: integer("safety_incidents"),
  qualityIssues: integer("quality_issues"),
  
  // Performance trends
  performanceScore: decimal("performance_score", { precision: 5, scale: 2 }), // overall score 0-100
  improvementAreas: text("improvement_areas").array(),
  recommendations: text("recommendations").array(),
  
  // Additional data
  statisticsData: jsonb("statistics_data"), // Detailed stats for charts
  chartsData: jsonb("charts_data"), // Chart configurations and data
  
  status: varchar("status", { length: 30 }).notNull().default("generated"), // generated, reviewed, approved
  reviewedBy: varchar("reviewed_by", { length: 100 }),
  reviewDate: timestamp("review_date"),
  notes: text("notes"),
});

// Report Templates table for customizable report formats
export const reportTemplates = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  templateName: varchar("template_name", { length: 100 }).notNull(),
  templateType: varchar("template_type", { length: 50 }).notNull(), // intervention, monthly, custom
  description: text("description"),
  sections: jsonb("sections"), // Array of report sections to include
  kpiMetrics: text("kpi_metrics").array(), // Which KPIs to include
  chartTypes: text("chart_types").array(), // Which charts to generate
  format: varchar("format", { length: 30 }).default("pdf"), // pdf, excel, html
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas for maintenance reports
export const insertMaintenanceReportSchema = createInsertSchema(maintenanceReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMonthlyReportSchema = createInsertSchema(monthlyReports).omit({
  id: true,
  generatedAt: true,
});

export const insertReportTemplateSchema = createInsertSchema(reportTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for maintenance reports
export type MaintenanceReport = typeof maintenanceReports.$inferSelect;
export type InsertMaintenanceReport = z.infer<typeof insertMaintenanceReportSchema>;

export type MonthlyReport = typeof monthlyReports.$inferSelect;
export type InsertMonthlyReport = z.infer<typeof insertMonthlyReportSchema>;

export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type InsertReportTemplate = z.infer<typeof insertReportTemplateSchema>;

// Company Configuration types
export const insertCompanyConfigSchema = createInsertSchema(companyConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CompanyConfig = typeof companyConfig.$inferSelect;
export type InsertCompanyConfig = z.infer<typeof insertCompanyConfigSchema>;
