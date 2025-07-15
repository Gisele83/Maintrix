import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
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

// Types
export type MaintenanceCase = typeof maintenanceCases.$inferSelect;
export type InsertMaintenanceCase = z.infer<typeof insertMaintenanceCaseSchema>;

export type RepairProcedure = typeof repairProcedures.$inferSelect;
export type InsertRepairProcedure = z.infer<typeof insertRepairProcedureSchema>;

export type ReportedCase = typeof reportedCases.$inferSelect;
export type InsertReportedCase = z.infer<typeof insertReportedCaseSchema>;

export type DiagnosticSession = typeof diagnosticSessions.$inferSelect;
export type InsertDiagnosticSession = z.infer<typeof insertDiagnosticSessionSchema>;

export type EquipmentType = typeof equipmentTypes.$inferSelect;
