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
