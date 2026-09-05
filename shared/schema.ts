import { pgTable, text, serial, integer, boolean, timestamp, real, varchar, decimal, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// =======================
// MULTI-TENANT ARCHITECTURE
// =======================

export const tenants = pgTable("tenants", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 100 }).unique(),
  plan: varchar("plan", { length: 50 }).notNull().default("free"), // free, pro, business, enterprise
  isActive: boolean("is_active").default(true),
  maxUsers: integer("max_users").default(5),
  currentUsers: integer("current_users").default(0),
  dataRetentionDays: integer("data_retention_days").default(365),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Security & Compliance
  encryptionEnabled: boolean("encryption_enabled").default(true),
  gdprCompliant: boolean("gdpr_compliant").default(true),
  auditLogsEnabled: boolean("audit_logs_enabled").default(true),
  // Billing
  subscriptionId: varchar("subscription_id", { length: 100 }),
  trialEndDate: timestamp("trial_end_date"),
  lastBillingDate: timestamp("last_billing_date"),
  nextBillingDate: timestamp("next_billing_date"),
  // Contact Info
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  billingAddress: jsonb("billing_address"), // Address object
  // Settings
  settings: jsonb("settings").default({}), // Tenant-specific configuration
  features: jsonb("features").default({}), // Enabled features per tenant
  // 🔧 CCTP COMPLIANCE: Bons de Commande Configuration
  purchaseOrderConfig: jsonb("purchase_order_config").default({}), // PO header, logos, thresholds
  workOrderConfig: jsonb("work_order_config").$type<Record<string, any>>().default({}), // WO header, validation levels
  reportingConfig: jsonb("reporting_config").$type<Record<string, any>>().default({}), // Auto-report generation settings
  // 📜 LICENCE SYSTEM: Automatic licensing based on user count
  licenseType: varchar("license_type", { length: 50 }).default("solo"), // solo, team, enterprise_s, enterprise_m, enterprise_l
  licensedUsers: integer("licensed_users").default(1), // Number of users the license allows
  licenseGeneratedAt: timestamp("license_generated_at").defaultNow(),
  licenseUpdatedAt: timestamp("license_updated_at").defaultNow(),
  licenseKey: varchar("license_key", { length: 100 }), // Unique license identifier
  // 🔄 TRIAL & GRACE PERIOD
  trialStartDate: timestamp("trial_start_date"),       // When the trial began
  licenseStatus: varchar("license_status", { length: 30 }).default("trial"), // trial | active | grace | expired | suspended
  gracePeriodDays: integer("grace_period_days").default(7), // Days of offline grace period
  gracePeriodEnd: timestamp("grace_period_end"),       // When grace period expires
  lastLicenseCheckAt: timestamp("last_license_check_at"), // Last successful online validation
  // 🎫 PLATFORM EDITION: functional-capability tier — independent of `plan` (billing) and `licenseType` (org-size limits).
  // Internal key uses "complete" (not "enterprise") to avoid colliding with plan="enterprise" / licenseType="enterprise_l".
  // Drives `enabledDomains` via PLATFORM_EDITIONS in server/platform-edition-service.ts.
  platformEdition: varchar("platform_edition", { length: 50 }).notNull().default("complete"),
});

// 📜 LICENSE MANAGEMENT SYSTEM
export const licenseTypes = pgTable("license_types", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 50 }).notNull().unique(), // solo, team, enterprise_s, enterprise_m, enterprise_l
  displayName: varchar("display_name", { length: 100 }).notNull(), // "Licence Solo", "Licence Équipe", etc.
  description: text("description").notNull(),
  minUsers: integer("min_users").notNull(), // Minimum users for this license
  maxUsers: integer("max_users"), // Maximum users (null = unlimited for enterprise_l)
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }), // Price per month
  yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }), // Price per year
  features: jsonb("features").default({}), // Available features for this license
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 📜 LICENSE HISTORY & AUDIT
export const licenseHistory = pgTable("license_history", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  previousLicenseType: varchar("previous_license_type", { length: 50 }),
  newLicenseType: varchar("new_license_type", { length: 50 }).notNull(),
  userCountAtChange: integer("user_count_at_change").notNull(),
  reason: varchar("reason", { length: 100 }).notNull(), // "user_added", "user_removed", "manual_upgrade", "tenant_created"
  changedBy: integer("changed_by"), // User ID who triggered the change (null for automatic)
  automaticUpdate: boolean("automatic_update").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Federated Learning & AI Improvement
export const federatedLearning = pgTable("federated_learning", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  patternHash: varchar("pattern_hash", { length: 64 }).notNull(), // Anonymized pattern identifier
  equipmentCategory: varchar("equipment_category", { length: 100 }).notNull(),
  problemPattern: jsonb("problem_pattern").notNull(), // Anonymized symptom patterns
  solutionEffectiveness: real("solution_effectiveness"), // 0-1 success rate
  anonymizedMetrics: jsonb("anonymized_metrics"), // Non-identifying performance data
  contributionWeight: real("contribution_weight").default(1.0), // Contribution to global model
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// GDPR & Audit Compliance
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id"), // References userProfiles.id
  action: varchar("action", { length: 100 }).notNull(), // CREATE, READ, UPDATE, DELETE, EXPORT, etc.
  resourceType: varchar("resource_type", { length: 100 }).notNull(), // table/entity name
  resourceId: varchar("resource_id", { length: 100 }), // record ID
  oldValues: jsonb("old_values").$type<Record<string, any>>(), // Previous state
  newValues: jsonb("new_values").$type<Record<string, any>>(), // New state
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id", { length: 100 }),
  timestamp: timestamp("timestamp").defaultNow(),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
});

export const dataRetention = pgTable("data_retention", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  resourceType: varchar("resource_type", { length: 100 }).notNull(),
  resourceId: varchar("resource_id", { length: 100 }).notNull(),
  retentionPolicy: varchar("retention_policy", { length: 50 }).notNull(), // days, months, years
  retentionPeriod: integer("retention_period").notNull(),
  scheduledDeletion: timestamp("scheduled_deletion"),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  gdprRequestId: varchar("gdpr_request_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gdprRequests = pgTable("gdpr_requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  requestType: varchar("request_type", { length: 50 }).notNull(), // access, portability, deletion, rectification
  subjectEmail: varchar("subject_email", { length: 255 }).notNull(),
  subjectUserId: integer("subject_user_id"),
  status: varchar("status", { length: 50 }).default("pending"), // pending, processing, completed, rejected
  requestData: jsonb("request_data").$type<Record<string, any>>(),
  responseData: jsonb("response_data").$type<Record<string, any>>(),
  processedBy: integer("processed_by"), // Admin user ID
  requestDate: timestamp("request_date").defaultNow(),
  processedDate: timestamp("processed_date"),
  completionDate: timestamp("completion_date"),
  notes: text("notes"),
});

// SECURE ENTERPRISE ACCESS: Invitation System
export const invitations = pgTable("invitations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 30 }).notNull().default("technician"), // owner, admin, maintainer, viewer, technician
  permissions: jsonb("permissions").default([]), // Specific permissions array
  invitedBy: integer("invited_by").references(() => userProfiles.id), // Who sent the invitation
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(), // SHA-256 hash of invitation token
  expiresAt: timestamp("expires_at").notNull(), // Invitation expiration (24h-7d)
  usedAt: timestamp("used_at"), // When invitation was accepted
  createdAt: timestamp("created_at").defaultNow(),
  isRevoked: boolean("is_revoked").default(false), // Admin can revoke invitations
  revokedAt: timestamp("revoked_at"),
  revokedBy: integer("revoked_by").references(() => userProfiles.id),
});

// SECURE ENTERPRISE ACCESS: Domain Allowlist
export const allowedDomains = pgTable("allowed_domains", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  domain: varchar("domain", { length: 100 }).notNull(), // e.g., "entreprise.com"
  isVerified: boolean("is_verified").default(false), // DNS TXT verification status
  verificationToken: varchar("verification_token", { length: 64 }),
  verifiedAt: timestamp("verified_at"),
  autoProvision: boolean("auto_provision").default(false), // Auto-create accounts for this domain
  defaultRole: varchar("default_role", { length: 30 }).default("viewer"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").references(() => userProfiles.id),
});

// SECURE ENTERPRISE ACCESS: Session Management
export const userSessions = pgTable("user_sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: integer("user_id").references(() => userProfiles.id, { onDelete: "cascade" }).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  sessionToken: varchar("session_token", { length: 128 }).notNull().unique(),
  refreshToken: varchar("refresh_token", { length: 128 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at").notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
  revokedReason: varchar("revoked_reason", { length: 100 }), // logout, timeout, security, admin
});

// SECURE ENTERPRISE ACCESS: Rate Limiting
export const rateLimits = pgTable("rate_limits", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  identifier: varchar("identifier", { length: 100 }).notNull(), // IP, userID, tenantID
  identifierType: varchar("identifier_type", { length: 20 }).notNull(), // ip, user, tenant
  endpoint: varchar("endpoint", { length: 100 }).notNull(), // /api/auth/login, /api/diagnostic
  requestCount: integer("request_count").default(0),
  windowStart: timestamp("window_start").defaultNow(),
  isBlocked: boolean("is_blocked").default(false),
  blockExpiresAt: timestamp("block_expires_at"),
  lastRequestAt: timestamp("last_request_at").defaultNow(),
});

// =======================
// EXISTING TABLES (NOW MULTI-TENANT)
// =======================

export const equipmentTypes = pgTable("equipment_types", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
});

export const maintenanceCases = pgTable("maintenance_cases", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
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
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
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
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
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
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
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
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  username: varchar("username", { length: 50 }).notNull().unique(),
  firstName: varchar("first_name", { length: 50 }),
  lastName: varchar("last_name", { length: 50 }),
  email: varchar("email", { length: 100 }).unique(),
  password: varchar("password", { length: 255 }), // Add password field for authentication
  role: varchar("role", { length: 30 }).default("technician"), // technician, team_leader, planner, procurement, maintenance_manager, technical_director, admin
  sector: varchar("sector", { length: 50 }), // Secteur géographique (pour chef d'équipe)
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
  // ✅ CHAMPS MFA POUR SÉCURITÉ ADMINISTRATEURS
  mfaSecret: varchar("mfa_secret", { length: 100 }), // Secret TOTP base32
  mfaEnabled: boolean("mfa_enabled").default(false), // MFA activé ou non
  mfaBackupCodes: text("mfa_backup_codes"), // Codes de récupération chiffrés (JSON)
  // 🔐 SÉCURITÉ MULTI-NIVEAUX: Gestion identifiants par défaut
  mustChangePassword: boolean("must_change_password").default(false), // Force changement mot de passe au prochain login
  isDefaultCredentials: boolean("is_default_credentials").default(false), // Indique si utilise identifiants par défaut
  passwordExpiresAt: timestamp("password_expires_at"), // Expiration mot de passe temporaire
  defaultCredentialsGeneratedAt: timestamp("default_credentials_generated_at"), // Quand identifiants générés
  defaultCredentialsGeneratedBy: integer("default_credentials_generated_by"), // Qui a généré (super-admin ID)
  lastPasswordChange: timestamp("last_password_change"), // Dernière modification mot de passe
  failedLoginAttempts: integer("failed_login_attempts").default(0), // Tentatives échouées
  accountLockedUntil: timestamp("account_locked_until"), // Verrouillage temporaire compte
  // 🔄 RÉINITIALISATION DE MOT DE PASSE
  passwordResetToken: varchar("password_reset_token", { length: 128 }), // Token de réinitialisation sécurisé
  passwordResetTokenExpiresAt: timestamp("password_reset_token_expires_at"), // Expiration du token (1h)
  passwordResetRequestedAt: timestamp("password_reset_requested_at"), // Quand demande envoyée
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertMaintenanceCaseSchema = createInsertSchema(maintenanceCases).omit({
  id: true,
  createdAt: true,
}).extend({
  // Make tenantId optional for backward compatibility  
  tenantId: z.string().nullable().optional(),
});

// 📜 LICENSE SCHEMAS
export const insertLicenseTypeSchema = createInsertSchema(licenseTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLicenseHistorySchema = createInsertSchema(licenseHistory).omit({
  id: true,
  createdAt: true,
});

// LICENSE TYPES
export type LicenseType = typeof licenseTypes.$inferSelect;
export type InsertLicenseType = z.infer<typeof insertLicenseTypeSchema>;
export type LicenseHistory = typeof licenseHistory.$inferSelect;
export type InsertLicenseHistory = z.infer<typeof insertLicenseHistorySchema>;

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
}).extend({
  // Allow symptoms to be either string or array - convert array to string in API
  symptoms: z.union([z.string(), z.array(z.string())]).transform((val) => {
    if (Array.isArray(val)) {
      return val.join(", ");
    }
    return val;
  }),
  // Make symptomsChecked optional since it can be derived from symptoms
  symptomsChecked: z.array(z.string()).optional(),
  // Make tenantId optional for backward compatibility
  tenantId: z.string().nullable().optional(),
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
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

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

// CCTP 4.5 - Failure Memory: Auto-capitalized validated failures
export const failureMemory = pgTable("failure_memory", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  equipmentType: text("equipment_type").notNull(),
  symptomSignature: text("symptom_signature").notNull(),
  diagnosis: text("diagnosis").notNull(),
  solution: text("solution").notNull(),
  rootCause: text("root_cause"),
  confirmedCount: integer("confirmed_count").default(0),
  invalidatedCount: integer("invalidated_count").default(0),
  avgResolutionTime: integer("avg_resolution_time"),
  lastConfirmedAt: timestamp("last_confirmed_at"),
  lastInvalidatedAt: timestamp("last_invalidated_at"),
  confidenceScore: real("confidence_score").default(0.5),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFailureMemorySchema = createInsertSchema(failureMemory).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFailureMemory = z.infer<typeof insertFailureMemorySchema>;
export type FailureMemory = typeof failureMemory.$inferSelect;

// CCTP 4.7 - Failure Trends: Recurrence and pattern tracking
export const failureTrends = pgTable("failure_trends", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  equipmentType: text("equipment_type").notNull(),
  failureCode: text("failure_code").notNull(),
  occurrences: integer("occurrences").default(1),
  firstOccurrenceAt: timestamp("first_occurrence_at").defaultNow(),
  lastOccurrenceAt: timestamp("last_occurrence_at").defaultNow(),
  avgTimeBetweenFailures: integer("avg_time_between_failures"),
  trendDirection: text("trend_direction").default("stable"),
  affectedZones: text("affected_zones").array(),
  seasonalPattern: jsonb("seasonal_pattern"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFailureTrendSchema = createInsertSchema(failureTrends).omit({ id: true, createdAt: true });
export type InsertFailureTrend = z.infer<typeof insertFailureTrendSchema>;
export type FailureTrend = typeof failureTrends.$inferSelect;

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
  // Purchase order and command letter thresholds
  purchaseOrderThreshold: decimal("purchase_order_threshold", { precision: 10, scale: 2 }).default("1500.00"),
  commandLetterThreshold: decimal("command_letter_threshold", { precision: 10, scale: 2 }).default("1500.01"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Equipment Registry - Complete asset management
export const equipmentRegistry = pgTable("equipment_registry", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
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
  // Cycle de vie ISO 55000 (12 étapes) — colonne vertébrale temporelle qui relie GMAO,
  // Digital Twin, Predictive Engine et Engineering Expertise. Distinct de operationalState
  // ci-dessus (qui est un statut court terme "en marche/en panne") et de asset_lifecycle
  // (suivi financier/amortissement, table séparée, optionnelle par équipement). Voir
  // server/equipment-lifecycle-engine.ts et ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md section 12.
  lifecycleStage: varchar("lifecycle_stage", { length: 30 }).notNull().default("exploitation"),
  lifecycleStageSince: timestamp("lifecycle_stage_since").defaultNow(),
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
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
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
  // ── Apprentissage post-action (Brevet 2, rev. 1g/3/10) — non renseigné si l'OT
  // n'origine pas d'une décision automatisée du moteur d'arbitrage.
  projectedCost: decimal("projected_cost", { precision: 10, scale: 2 }),
  projectedImcaImpact: real("projected_imca_impact"),
  imcaAtCreation: real("imca_at_creation"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Preventive Maintenance Plans
export const preventiveMaintenancePlans = pgTable("preventive_maintenance_plans", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
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

// Maintenance Counters - For tracking equipment usage metrics
export const maintenanceCounters = pgTable("maintenance_counters", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  equipmentName: text("equipment_name"),
  counterType: varchar("counter_type", { length: 50 }).notNull(), // hours, cycles, kilometers, etc.
  currentValue: real("current_value").default(0),
  thresholdValue: real("threshold_value"),
  lastResetDate: timestamp("last_reset_date"),
  lastResetValue: real("last_reset_value").default(0),
  isActive: boolean("is_active").default(true),
  maintenanceType: text("maintenance_type"),
  description: text("description"),
  incrementRate: real("increment_rate"),
  alertLevel: varchar("alert_level", { length: 20 }).default("info"), // info, warning, critical
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  planId: integer("plan_id"),
  intervalValue: real("interval_value"),
  warningThresholdPct: real("warning_threshold_pct"),
  lastServiceValue: real("last_service_value"),
  alertEmailSent: boolean("alert_email_sent").default(false),
});

// Counter History - Track counter reset history
export const counterHistory = pgTable("counter_history", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  counterId: integer("counter_id").references(() => maintenanceCounters.id, { onDelete: "cascade" }),
  previousValue: integer("previous_value").notNull(),
  resetReason: text("reset_reason").notNull(),
  performedBy: integer("performed_by").references(() => userProfiles.id),
  workOrderId: integer("work_order_id").references(() => workOrders.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Spare Parts Inventory Management
export const spareParts = pgTable("spare_parts", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
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

// Stock Movements - Enhanced for complete inventory tracking
export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  sparePartId: integer("spare_part_id").references(() => spareParts.id).notNull(),
  movementType: varchar("movement_type", { length: 20 }).notNull(), // 'IN', 'OUT', 'ADJUSTMENT', 'RETURN'
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  reason: varchar("reason", { length: 100 }), // 'MAINTENANCE', 'PURCHASE', 'RETURN', 'INVENTORY', 'DAMAGED', 'WORK_ORDER'
  workOrderId: integer("work_order_id").references(() => workOrders.id),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  performedBy: integer("performed_by").references(() => userProfiles.id),
  reference: text("reference"), // Work order number, purchase order, etc.
  notes: text("notes"),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
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
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
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
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
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
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
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
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
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
}).extend({
  equipmentId: z.string().optional(), // Make equipmentId optional so it can be auto-generated
  installationDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  warrantyExpiry: z.string().optional().transform((str) => str ? new Date(str) : undefined),
});

export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({
  id: true,
  orderNumber: true, // Auto-generated by storage layer
  createdAt: true,
  updatedAt: true,
  // Omit validation fields - they're set by system
  validationStatus: true,
  level1ValidatedBy: true,
  level1ValidatedAt: true,
  level1ValidationNotes: true,
  level2ValidatedBy: true,
  level2ValidatedAt: true,
  level2ValidationNotes: true,
  rejectedBy: true,
  rejectedAt: true,
  rejectionReason: true,
  canExecute: true,
}).extend({
  // Make optional fields truly optional with default values
  assignedTo: z.number().optional(),
  requestedBy: z.number().optional(),
  estimatedDuration: z.number().optional(),
  actualDuration: z.number().optional(),
  scheduledStart: z.date().optional(),
  actualStart: z.date().optional(),
  scheduledEnd: z.date().optional(),
  actualEnd: z.date().optional(),
  cost: z.number().optional(),
  laborCost: z.number().optional(),
  materialCost: z.number().optional(),
  externalCost: z.number().optional(),
  notes: z.string().optional(),
  completionNotes: z.string().optional(),
});

export const insertPreventiveMaintenancePlanSchema = createInsertSchema(preventiveMaintenancePlans).omit({
  id: true,
  createdAt: true,
}).extend({
  planName: z.string().min(1, "Le nom du plan est requis"),
  equipmentType: z.string().min(1, "Le type d'équipement est requis"), 
  equipmentIds: z.array(z.number()).or(z.number().transform(val => [val])).optional(), // Accept array or single number
  frequency: z.string().min(1, "La fréquence est requise"),
  frequencyValue: z.number().nullable().optional(),
  tasks: z.array(z.string()).or(z.string().transform(val => val.split(',').map(t => t.trim()))).optional(), // Accept array or comma-separated string
  estimatedDuration: z.number().nullable().optional(),
  requiredSkills: z.array(z.string()).or(z.string().transform(val => val.split(',').map(s => s.trim()))).optional(), // Accept array or comma-separated string
  safetyRequirements: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  lastExecuted: z.string().optional().transform((str) => str ? new Date(str) : undefined),
  nextDue: z.string().optional().transform((str) => str ? new Date(str) : undefined),
});

export const insertMaintenanceCounterSchema = createInsertSchema(maintenanceCounters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  counterType: z.string().min(1, "Le type de compteur est requis"),
});

export const insertCounterHistorySchema = createInsertSchema(counterHistory).omit({
  id: true,
  createdAt: true,
}).extend({
  resetReason: z.string().min(1, "La raison de remise à zéro est requise"),
});

// Table des entreprises pour isolation des données
export const companies = pgTable("companies", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 100 }),
  country: varchar("country", { length: 100 }),
  subscriptionPlan: varchar("subscription_plan", { length: 50 }).default("starter"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Table des permissions d'accès aux données
export const dataAccessPermissions = pgTable("data_access_permissions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  userId: integer("user_id").references(() => userProfiles.id),
  companyId: integer("company_id").references(() => companies.id),
  permission: varchar("permission", { length: 100 }).notNull(),
  metadata: jsonb("metadata"), // Détails de l'accès
  accessedAt: timestamp("accessed_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;
export type DataAccessPermission = typeof dataAccessPermissions.$inferSelect;

export const insertSparePartSchema = createInsertSchema(spareParts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Accept both string and number for unitPrice and convert to string
  unitPrice: z.union([z.string(), z.number()]).transform(val => 
    typeof val === 'string' ? val : val.toString()
  ).optional(),
  // Accept both string and number for leadTime
  leadTime: z.union([z.string(), z.number()]).transform(val => 
    typeof val === 'string' ? (val ? parseInt(val) : null) : val
  ).optional().nullable(),
  currentStock: z.number().optional(),
  minStock: z.number().optional(),
  maxStock: z.number().optional(),
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

export type MaintenanceCounter = typeof maintenanceCounters.$inferSelect;
export type InsertMaintenanceCounter = z.infer<typeof insertMaintenanceCounterSchema>;

// Schema de validation pour la création de compteurs depuis les plans de maintenance
export const createCounterFromPlanSchema = z.object({
  equipmentId: z.number().positive("ID d'équipement requis"),
  counterType: z.enum(["hours", "cycles", "kilometers", "units"]),
  currentValue: z.number().min(0, "Valeur actuelle doit être positive").default(0),
  counterName: z.string().optional(),
  thresholdWarning: z.number().min(0, "Seuil d'alerte doit être positif"),
  thresholdCritical: z.number().min(0, "Seuil critique doit être positif"),
  equipmentName: z.string().optional(),
  description: z.string().optional(),
});

export type CounterHistory = typeof counterHistory.$inferSelect;
export type InsertCounterHistory = z.infer<typeof insertCounterHistorySchema>;

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

// IoT Sensor Integration Tables
export const iotDevices = pgTable("iot_devices", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull().unique(),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  deviceType: text("device_type").notNull(), // accelerometer, thermometer, pressure_sensor, current_sensor
  location: text("location").notNull(),
  batteryLevel: real("battery_level"),
  signalStrength: real("signal_strength"),
  status: text("status").notNull().default("active"), // active, inactive, maintenance
  installationDate: timestamp("installation_date").defaultNow(),
  lastHeartbeat: timestamp("last_heartbeat"),
  calibrationDate: timestamp("calibration_date"),
  metadata: jsonb("metadata"), // Device-specific configuration
});

export const sensorThresholds = pgTable("sensor_thresholds", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => iotDevices.id),
  metricType: text("metric_type").notNull(), // temperature, vibration, pressure, current
  warningLevel: real("warning_level").notNull(),
  criticalLevel: real("critical_level").notNull(),
  unit: text("unit").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const automatedSymptomDetection = pgTable("automated_symptom_detection", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  deviceId: integer("device_id").references(() => iotDevices.id),
  detectedSymptom: text("detected_symptom").notNull(),
  symptomCode: text("symptom_code").notNull(),
  confidence: real("confidence").notNull(), // 0-1
  sensorData: jsonb("sensor_data"), // Raw sensor readings that triggered detection
  detectionAlgorithm: text("detection_algorithm").notNull(),
  status: text("status").notNull().default("pending"), // pending, verified, false_positive
  triggeredAt: timestamp("triggered_at").defaultNow(),
  verifiedBy: integer("verified_by"), // User ID who verified
  verifiedAt: timestamp("verified_at"),
});

export const smartNotifications = pgTable("smart_notifications", {
  id: serial("id").primaryKey(),
  recipientId: integer("recipient_id").notNull(), // User ID
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  notificationType: text("notification_type").notNull(), // predictive_alert, threshold_breach, maintenance_due
  severity: text("severity").notNull(), // info, warning, critical, emergency
  title: text("title").notNull(),
  message: text("message").notNull(),
  actionRequired: text("action_required"),
  estimatedTimeToFailure: integer("estimated_time_to_failure"), // in hours
  relatedWorkOrderId: integer("related_work_order_id").references(() => workOrders.id),
  isRead: boolean("is_read").default(false),
  isActioned: boolean("is_actioned").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  dismissedAt: timestamp("dismissed_at"),
  metadata: jsonb("metadata"), // Additional notification data
});

// Gamified Maintenance Skill Progression
export const maintenanceSkills = pgTable("maintenance_skills", {
  id: serial("id").primaryKey(),
  skillName: text("skill_name").notNull(),
  skillCategory: text("skill_category").notNull(), // mechanical, electrical, hydraulic, pneumatic
  description: text("description").notNull(),
  maxLevel: integer("max_level").default(10),
  experienceMultiplier: real("experience_multiplier").default(1.0),
});

export const userSkillProgress = pgTable("user_skill_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  skillId: integer("skill_id").references(() => maintenanceSkills.id),
  currentLevel: integer("current_level").default(1),
  experiencePoints: integer("experience_points").default(0),
  nextLevelThreshold: integer("next_level_threshold").default(100),
  achievementsUnlocked: text("achievements_unlocked").array(),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
});

export const maintenanceAchievements = pgTable("maintenance_achievements", {
  id: serial("id").primaryKey(),
  achievementName: text("achievement_name").notNull(),
  description: text("description").notNull(),
  iconUrl: text("icon_url"),
  category: text("category").notNull(), // efficiency, quality, innovation, safety
  pointsAwarded: integer("points_awarded").default(0),
  requirements: jsonb("requirements"), // Conditions to unlock achievement
  rarity: text("rarity").notNull().default("common"), // common, rare, epic, legendary
});

export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  achievementId: integer("achievement_id").references(() => maintenanceAchievements.id),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
  progress: real("progress").default(1.0), // 0-1 for partial achievements
});

export const skillChallenges = pgTable("skill_challenges", {
  id: serial("id").primaryKey(),
  challengeName: text("challenge_name").notNull(),
  description: text("description").notNull(),
  skillId: integer("skill_id").references(() => maintenanceSkills.id),
  difficultyLevel: integer("difficulty_level").notNull(), // 1-5
  experienceReward: integer("experience_reward").default(50),
  requirements: jsonb("requirements"), // Challenge conditions
  timeLimit: integer("time_limit"), // in minutes
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userChallengeProgress = pgTable("user_challenge_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  challengeId: integer("challenge_id").references(() => skillChallenges.id),
  status: text("status").notNull().default("active"), // active, completed, expired, failed
  progress: real("progress").default(0.0), // 0-1
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  score: integer("score").default(0),
});

// Insert schemas for IoT and gamification tables
export const insertIotDeviceSchema = createInsertSchema(iotDevices).omit({
  id: true,
  installationDate: true,
});

export const insertSensorThresholdSchema = createInsertSchema(sensorThresholds).omit({
  id: true,
  createdAt: true,
});

export const insertAutomatedSymptomDetectionSchema = createInsertSchema(automatedSymptomDetection).omit({
  id: true,
  triggeredAt: true,
});

export const insertSmartNotificationSchema = createInsertSchema(smartNotifications).omit({
  id: true,
  createdAt: true,
});

export const insertMaintenanceSkillSchema = createInsertSchema(maintenanceSkills).omit({
  id: true,
});

export const insertUserSkillProgressSchema = createInsertSchema(userSkillProgress).omit({
  id: true,
  lastActivityAt: true,
});

export const insertMaintenanceAchievementSchema = createInsertSchema(maintenanceAchievements).omit({
  id: true,
});

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  unlockedAt: true,
});

export const insertSkillChallengeSchema = createInsertSchema(skillChallenges).omit({
  id: true,
  createdAt: true,
});

export const insertUserChallengeProgressSchema = createInsertSchema(userChallengeProgress).omit({
  id: true,
  startedAt: true,
});

// User Sessions table was previously added - remove duplicate

// Types for IoT and gamification tables
export type IotDevice = typeof iotDevices.$inferSelect;
export type InsertIotDevice = z.infer<typeof insertIotDeviceSchema>;

export type SensorThreshold = typeof sensorThresholds.$inferSelect;
export type InsertSensorThreshold = z.infer<typeof insertSensorThresholdSchema>;

export type AutomatedSymptomDetection = typeof automatedSymptomDetection.$inferSelect;
export type InsertAutomatedSymptomDetection = z.infer<typeof insertAutomatedSymptomDetectionSchema>;

export type SmartNotification = typeof smartNotifications.$inferSelect;
export type InsertSmartNotification = z.infer<typeof insertSmartNotificationSchema>;

export type MaintenanceSkill = typeof maintenanceSkills.$inferSelect;
export type InsertMaintenanceSkill = z.infer<typeof insertMaintenanceSkillSchema>;

export type UserSkillProgress = typeof userSkillProgress.$inferSelect;
export type InsertUserSkillProgress = z.infer<typeof insertUserSkillProgressSchema>;

export type MaintenanceAchievement = typeof maintenanceAchievements.$inferSelect;
export type InsertMaintenanceAchievement = z.infer<typeof insertMaintenanceAchievementSchema>;

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;

export type SkillChallenge = typeof skillChallenges.$inferSelect;
export type InsertSkillChallenge = z.infer<typeof insertSkillChallengeSchema>;

export type UserChallengeProgress = typeof userChallengeProgress.$inferSelect;
export type InsertUserChallengeProgress = z.infer<typeof insertUserChallengeProgressSchema>;

// Suppliers/Manufacturers table
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
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
  // Portail Fournisseurs (server/supplier-routes.ts) — colonnes ajoutées migration 0019 : la
  // table ne portait à l'origine que le nécessaire pour purchase_orders/reorder_rules (voir
  // FK plus bas) ; le portail fournisseurs (contrats, assurance, KPI de performance) réutilise
  // cette même table plutôt que d'en dupliquer une seconde.
  siret: varchar("siret", { length: 50 }),
  vatNumber: varchar("vat_number", { length: 50 }),
  website: varchar("website", { length: 255 }),
  paymentTermsDays: integer("payment_terms_days").default(30),
  currency: varchar("currency", { length: 10 }).default("EUR"),
  specialties: jsonb("specialties").default([]),
  contractStart: timestamp("contract_start"),
  contractEnd: timestamp("contract_end"),
  contractNumber: varchar("contract_number", { length: 100 }),
  insuranceExpiry: timestamp("insurance_expiry"),
  insuranceAmount: decimal("insurance_amount", { precision: 12, scale: 2 }),
  status: varchar("status", { length: 30 }).default("active"), // active, inactive, blacklisted, pending_approval
  onTimeDeliveryPct: decimal("on_time_delivery_pct", { precision: 5, scale: 2 }),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }),
  totalOrders: integer("total_orders").default(0),
  totalSpend: decimal("total_spend", { precision: 12, scale: 2 }).default("0"),
  lastOrderDate: timestamp("last_order_date"),
  documents: jsonb("documents").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Orders table
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).unique().notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  orderType: varchar("order_type", { length: 50 }).notNull(), // spare_parts, services, maintenance
  documentType: varchar("document_type", { length: 50 }).notNull().default("purchase_order"), // "purchase_order" or "command_letter"
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
  chefServiceRejectionReason: text("chef_service_rejection_reason"), // Justification uniquement pour les rejets
  directeurValidatedBy: integer("directeur_validated_by").references(() => userProfiles.id), // Directeur Général
  directeurValidatedAt: timestamp("directeur_validated_at"),
  directeurRejectionReason: text("directeur_rejection_reason"), // Justification uniquement pour les rejets
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

// ========================================
// POST-DEPLOYMENT ACCESS MANAGEMENT TABLES
// ========================================

// Table pour les logs d'accès détaillés (contrôle d'accès continu)
export const accessLogs = pgTable("access_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => userProfiles.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 200 }).notNull(), // GET /api/diagnostic, POST /api/work-orders, etc.
  resource: varchar("resource", { length: 200 }).notNull(), // Resource path accessed
  result: varchar("result", { length: 20 }).notNull(), // granted, denied, challenged
  reason: text("reason"), // Reason for denial/challenge
  riskScore: integer("risk_score").default(0), // 0-100 risk assessment
  trustScore: integer("trust_score").default(50), // 0-100 trust level
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  deviceFingerprint: varchar("device_fingerprint", { length: 32 }),
  location: varchar("location", { length: 100 }), // Country:Region format
  timestamp: timestamp("timestamp").defaultNow(),
});

// Table pour les politiques de sécurité par tenant
export const securityPolicies = pgTable("security_policies", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  rules: jsonb("rules").notNull(), // SecurityPolicy.rules object
  enforcement: varchar("enforcement", { length: 20 }).default("moderate"), // strict, moderate, lenient
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Table pour les tâches de workflow (onboarding/offboarding)
export const workflowTasks = pgTable("workflow_tasks", {
  id: varchar("id", { length: 50 }).primaryKey(), // onboard-123456-abc, offboard-789012-def
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(), // onboarding, offboarding
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  assignedTo: integer("assigned_to").references(() => userProfiles.id),
  data: jsonb("data").notNull(), // Full workflow object (OnboardingWorkflow or OffboardingWorkflow)
  status: varchar("status", { length: 20 }).default("active"), // active, completed, cancelled
  priority: varchar("priority", { length: 10 }).default("medium"), // low, medium, high, critical
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Table pour l'audit trail (traçabilité complète)
export const auditTrail = pgTable("audit_trail", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => userProfiles.id),
  action: varchar("action", { length: 100 }).notNull(), // onboarding_initiated, access_revoked, etc.
  resource: varchar("resource", { length: 100 }).notNull(), // user_lifecycle, security_policy, etc.
  resourceId: varchar("resource_id", { length: 100 }),
  details: jsonb("details"), // Action-specific details
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
  severity: varchar("severity", { length: 20 }).default("info"), // info, warning, error, critical
});

// Table pour les rapports d'audit
export const auditReports = pgTable("audit_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // security_audit, access_review, compliance_check
  title: varchar("title", { length: 200 }).notNull(),
  summary: text("summary"),
  findings: jsonb("findings"), // Array of findings
  recommendations: jsonb("recommendations"), // Array of recommendations
  severity: varchar("severity", { length: 20 }).default("low"), // low, medium, high, critical
  status: varchar("status", { length: 20 }).default("draft"), // draft, completed, archived
  generatedAt: timestamp("generated_at").defaultNow(),
  generatedBy: integer("generated_by").references(() => userProfiles.id),
});

// Table pour les revues d'accès
export const accessReviews = pgTable("access_reviews", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => userProfiles.id, { onDelete: "cascade" }),
  reviewerId: integer("reviewer_id").references(() => userProfiles.id),
  status: varchar("status", { length: 20 }).default("pending"), // pending, approved, rejected, requires_attention
  findings: jsonb("findings"), // AccessReviewFinding[]
  recommendations: jsonb("recommendations"), // string[]
  actions: jsonb("actions"), // AccessReviewAction[]
  reviewDate: timestamp("review_date").defaultNow(),
  dueDate: timestamp("due_date"),
  completedDate: timestamp("completed_date"),
});

// Table pour les rapports de conformité
export const complianceReports = pgTable("compliance_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  framework: varchar("framework", { length: 20 }).notNull(), // GDPR, SOX, ISO27001, etc.
  reportPeriod: jsonb("report_period").notNull(), // {start: Date, end: Date}
  sections: jsonb("sections").notNull(), // ComplianceSection[]
  overallScore: integer("overall_score"), // 0-100
  status: varchar("status", { length: 20 }).notNull(), // compliant, non_compliant, partial_compliance
  generatedAt: timestamp("generated_at").defaultNow(),
  generatedBy: integer("generated_by").references(() => userProfiles.id),
});

// =======================
// PROGICIEL ERP CONFIGURATION
// =======================

// Module Catalog - Catalog of available ERP modules
export const moduleCatalog = pgTable("module_catalog", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).notNull().unique(), // unique module identifier
  name: varchar("name", { length: 255 }).notNull(), // display name
  description: text("description"), // module description
  category: varchar("category", { length: 100 }).notNull(), // GMAO, ERP, Analytics, etc.
  version: varchar("version", { length: 50 }).default("1.0.0"),
  dependencies: jsonb("dependencies").default([]), // array of required module keys
  defaultEnabled: boolean("default_enabled").default(false), // enabled by default for new tenants
  isCore: boolean("is_core").default(false), // core modules cannot be disabled
  routePaths: jsonb("route_paths").default([]), // array of frontend routes
  apiEndpoints: jsonb("api_endpoints").default([]), // array of backend API paths
  permissions: jsonb("permissions").default([]), // required permissions
  configuration: jsonb("configuration").default({}), // default module configuration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workflow Definitions - Configurable workflows per tenant
export const workflowDefinitions = pgTable("workflow_definitions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  entityType: varchar("entity_type", { length: 100 }).notNull(), // WorkOrder, PurchaseOrder, Equipment, etc.
  name: varchar("name", { length: 255 }).notNull(), // workflow name
  description: text("description"),
  isActive: boolean("is_active").default(true),
  states: jsonb("states").notNull(), // workflow states definition
  transitions: jsonb("transitions").notNull(), // allowed transitions
  rolePermissions: jsonb("role_permissions").default({}), // role-based permissions per state
  slaConfig: jsonb("sla_config").default({}), // SLA timers and escalation rules
  webhooks: jsonb("webhooks").default([]), // webhook notifications
  version: integer("version").default(1), // workflow version for history
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by").references(() => userProfiles.id),
});

// Sector Templates - Pre-configured templates for different industries
export const sectorTemplates = pgTable("sector_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).notNull().unique(), // industry, transport, energy, facilities
  name: varchar("name", { length: 255 }).notNull(), // display name
  description: text("description"),
  enabledModules: jsonb("enabled_modules").notNull().default([]), // array of module keys
  defaultWorkflows: jsonb("default_workflows").default({}), // workflow definitions per entity type
  defaultSettings: jsonb("default_settings").default({}), // tenant settings
  kpiConfig: jsonb("kpi_config").default({}), // default KPIs and dashboard configuration
  rolePresets: jsonb("role_presets").default([]), // default roles and permissions
  documentTemplates: jsonb("document_templates").default({}), // report and document templates
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =======================
// PROGICIEL ERP - ZOD SCHEMAS & TYPES
// =======================

// Module Catalog schemas
export const insertModuleCatalogSchema = createInsertSchema(moduleCatalog).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectModuleCatalogSchema = createInsertSchema(moduleCatalog);

export type InsertModuleCatalog = z.infer<typeof insertModuleCatalogSchema>;
export type ModuleCatalog = typeof moduleCatalog.$inferSelect;

// Workflow Definition schemas
export const insertWorkflowDefinitionSchema = createInsertSchema(workflowDefinitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectWorkflowDefinitionSchema = createInsertSchema(workflowDefinitions);

export type InsertWorkflowDefinition = z.infer<typeof insertWorkflowDefinitionSchema>;
export type WorkflowDefinition = typeof workflowDefinitions.$inferSelect;

// Sector Template schemas
export const insertSectorTemplateSchema = createInsertSchema(sectorTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectSectorTemplateSchema = createInsertSchema(sectorTemplates);

export type InsertSectorTemplate = z.infer<typeof insertSectorTemplateSchema>;
export type SectorTemplate = typeof sectorTemplates.$inferSelect;

// ERP Module Configuration Types
export interface ModuleManifest {
  [moduleKey: string]: {
    name: string;
    category: string;
    routes: string[];
    apiEndpoints: string[];
    dependencies: string[];
    permissions: string[];
    component?: React.ComponentType;
  };
}

export interface TenantModuleConfig {
  enabledModules: string[];
  moduleSettings: Record<string, any>;
  workflows: Record<string, WorkflowDefinition>;
  sector?: string;
}

export interface WorkflowState {
  id: string;
  name: string;
  type: 'initial' | 'intermediate' | 'final';
  permissions: string[];
  actions: string[];
  sla?: {
    timeLimit: number;
    escalationRoles: string[];
  };
}

export interface WorkflowTransition {
  from: string;
  to: string;
  action: string;
  guards?: {
    roles?: string[];
    conditions?: string[];
  };
  webhooks?: string[];
}

// =======================
// ADVANCED ERP/SCADA CONNECTORS
// =======================

export const erpSystems = pgTable("erp_systems", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  systemName: varchar("system_name", { length: 100 }).notNull(), // SAP, Oracle, Maximo, etc.
  systemType: varchar("system_type", { length: 50 }).notNull(), // "erp", "scada", "mes", "plc"
  connectionUrl: varchar("connection_url", { length: 500 }).notNull(),
  authMethod: varchar("auth_method", { length: 50 }).notNull(), // "basic", "oauth", "api_key", "certificate"
  credentials: jsonb("credentials").notNull(), // Encrypted credentials
  syncInterval: integer("sync_interval").default(300), // seconds
  lastSyncAt: timestamp("last_sync_at"),
  isActive: boolean("is_active").default(true),
  configParams: jsonb("config_params").default({}), // System-specific parameters
  mappingRules: jsonb("mapping_rules").default({}), // Data field mappings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const scadaConnections = pgTable("scada_connections", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  connectionName: varchar("connection_name", { length: 100 }).notNull(),
  protocol: varchar("protocol", { length: 20 }).notNull(), // "opcua", "modbus", "mqtt", "bacnet"
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  plcAddresses: jsonb("plc_addresses").default([]), // Array of PLC addresses
  tagMappings: jsonb("tag_mappings").default({}), // Tag to equipment mappings
  pollInterval: integer("poll_interval").default(5000), // milliseconds
  isConnected: boolean("is_connected").default(false),
  lastHeartbeat: timestamp("last_heartbeat"),
  errorCount: integer("error_count").default(0),
  configuration: jsonb("configuration").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dataIntegrationLogs = pgTable("data_integration_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  sourceSystem: varchar("source_system", { length: 100 }).notNull(),
  operationType: varchar("operation_type", { length: 50 }).notNull(), // "sync", "import", "export", "update"
  entityType: varchar("entity_type", { length: 100 }).notNull(), // "work_order", "equipment", "spare_part"
  entityId: varchar("entity_id", { length: 100 }),
  recordCount: integer("record_count").default(0),
  successCount: integer("success_count").default(0),
  errorCount: integer("error_count").default(0),
  status: varchar("status", { length: 20 }).notNull(), // "success", "failed", "partial"
  errorDetails: jsonb("error_details"),
  executionTime: integer("execution_time"), // milliseconds
  createdAt: timestamp("created_at").defaultNow(),
});

// =======================
// ADVANCED PREDICTIVE AI SYSTEM
// =======================

export const aiModels = pgTable("ai_models", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  modelName: varchar("model_name", { length: 100 }).notNull(),
  modelType: varchar("model_type", { length: 50 }).notNull(), // "failure_prediction", "rul_estimation", "anomaly_detection", "optimization"
  algorithmType: varchar("algorithm_type", { length: 50 }).notNull(), // "neural_network", "random_forest", "svm", "lstm", "transformer"
  equipmentCategory: varchar("equipment_category", { length: 100 }),
  trainDataSource: jsonb("train_data_source").notNull(), // Data sources used for training
  modelParameters: jsonb("model_parameters").default({}), // Hyperparameters
  featureSet: jsonb("feature_set").default([]), // Features used by the model
  accuracy: real("accuracy"), // Model accuracy 0-1
  precision: real("precision"),
  recall: real("recall"),
  f1Score: real("f1_score"),
  lastTrainingDate: timestamp("last_training_date"),
  trainingDuration: integer("training_duration"), // seconds
  isActive: boolean("is_active").default(true),
  version: varchar("version", { length: 20 }).default("1.0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const predictivePredictions = pgTable("predictive_predictions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id, { onDelete: "cascade" }),
  modelId: varchar("model_id", { length: 36 }).references(() => aiModels.id, { onDelete: "cascade" }),
  predictionType: varchar("prediction_type", { length: 50 }).notNull(), // "failure_risk", "remaining_useful_life", "anomaly_score", "maintenance_window"
  predictedValue: real("predicted_value"), // Numeric prediction
  predictedCategory: varchar("predicted_category", { length: 100 }), // Categorical prediction
  confidenceScore: real("confidence_score"), // 0-1
  predictionHorizon: integer("prediction_horizon"), // Days/hours ahead
  inputFeatures: jsonb("input_features"), // Features used for this prediction
  riskLevel: varchar("risk_level", { length: 20 }), // "low", "medium", "high", "critical"
  recommendedActions: jsonb("recommended_actions"), // Array of recommended actions
  explanationFactors: jsonb("explanation_factors"), // Feature importance/explanation
  validUntil: timestamp("valid_until"),
  actualOutcome: varchar("actual_outcome", { length: 100 }), // For feedback learning
  outcomeDate: timestamp("outcome_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiTrainingJobs = pgTable("ai_training_jobs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  modelId: varchar("model_id", { length: 36 }).references(() => aiModels.id, { onDelete: "cascade" }),
  jobType: varchar("job_type", { length: 50 }).notNull(), // "initial_training", "retraining", "incremental_learning"
  status: varchar("status", { length: 20 }).notNull(), // "pending", "running", "completed", "failed"
  dataSize: integer("data_size"), // Number of training samples
  hyperParameters: jsonb("hyper_parameters"),
  metrics: jsonb("metrics"), // Training metrics
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  resourceUsage: jsonb("resource_usage"), // CPU, memory usage during training
  createdAt: timestamp("created_at").defaultNow(),
});

// =======================
// POWER BI INTEGRATION SYSTEM
// =======================

export const powerBiWorkspaces = pgTable("power_bi_workspaces", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  workspaceName: varchar("workspace_name", { length: 100 }).notNull(),
  workspaceId: varchar("workspace_id", { length: 100 }).notNull().unique(), // Power BI workspace ID
  description: text("description"),
  powerBiAppId: varchar("power_bi_app_id", { length: 100 }), // Azure AD App ID
  tenantDomain: varchar("tenant_domain", { length: 100 }), // Power BI tenant domain
  accessToken: text("access_token"), // Encrypted OAuth token
  refreshToken: text("refresh_token"), // Encrypted refresh token
  tokenExpiresAt: timestamp("token_expires_at"),
  isActive: boolean("is_active").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: varchar("sync_status", { length: 20 }).default("pending"), // "pending", "syncing", "completed", "failed"
  errorDetails: jsonb("error_details"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const powerBiReports = pgTable("power_bi_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).references(() => powerBiWorkspaces.id, { onDelete: "cascade" }),
  reportName: varchar("report_name", { length: 100 }).notNull(),
  reportId: varchar("report_id", { length: 100 }).notNull(), // Power BI report ID
  reportUrl: varchar("report_url", { length: 500 }),
  embedUrl: varchar("embed_url", { length: 500 }), // URL for embedding
  datasetId: varchar("dataset_id", { length: 100 }), // Associated dataset
  reportType: varchar("report_type", { length: 50 }), // "maintenance", "kpi", "predictive", "financial"
  description: text("description"),
  refreshSchedule: jsonb("refresh_schedule"), // Refresh timing configuration
  lastRefreshed: timestamp("last_refreshed"),
  isPublic: boolean("is_public").default(false),
  permissions: jsonb("permissions"), // User/role permissions
  customParameters: jsonb("custom_parameters"), // Report-specific parameters
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const powerBiDatasets = pgTable("power_bi_datasets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).references(() => powerBiWorkspaces.id, { onDelete: "cascade" }),
  datasetName: varchar("dataset_name", { length: 100 }).notNull(),
  datasetId: varchar("dataset_id", { length: 100 }).notNull(), // Power BI dataset ID
  description: text("description"),
  dataSource: varchar("data_source", { length: 100 }).notNull(), // "gmao_database", "predictive_analytics", "iot_sensors"
  tables: jsonb("tables").default([]), // Array of table configurations
  refreshMode: varchar("refresh_mode", { length: 20 }).default("scheduled"), // "manual", "scheduled", "streaming"
  refreshSchedule: jsonb("refresh_schedule"),
  lastRefreshed: timestamp("last_refreshed"),
  nextRefresh: timestamp("next_refresh"),
  rowCount: integer("row_count"),
  sizeMB: real("size_mb"),
  status: varchar("status", { length: 20 }).default("active"), // "active", "failed", "processing"
  errorDetails: jsonb("error_details"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const reportingSchedules = pgTable("reporting_schedules", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  reportType: varchar("report_type", { length: 50 }).notNull(), // "daily", "weekly", "monthly", "custom"
  recipientEmails: jsonb("recipient_emails").default([]), // Array of email addresses
  reportFormats: jsonb("report_formats").default(["pdf"]), // ["pdf", "excel", "powerbi"]
  includeCharts: boolean("include_charts").default(true),
  includeKPIs: boolean("include_kpis").default(true),
  includePredictiveInsights: boolean("include_predictive_insights").default(false),
  customQueries: jsonb("custom_queries"), // Custom data queries for report
  schedule: jsonb("schedule").notNull(), // Cron-like schedule configuration
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  isActive: boolean("is_active").default(true),
  lastExecuted: timestamp("last_executed"),
  nextExecution: timestamp("next_execution"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema exports for new tables
export const insertERPSystemSchema = createInsertSchema(erpSystems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSCADAConnectionSchema = createInsertSchema(scadaConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataIntegrationLogSchema = createInsertSchema(dataIntegrationLogs).omit({
  id: true,
  createdAt: true,
});

export const insertAIModelSchema = createInsertSchema(aiModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPredictivePredictionSchema = createInsertSchema(predictivePredictions).omit({
  id: true,
  createdAt: true,
});

export const insertAITrainingJobSchema = createInsertSchema(aiTrainingJobs).omit({
  id: true,
  createdAt: true,
});

export const insertPowerBiWorkspaceSchema = createInsertSchema(powerBiWorkspaces).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPowerBiReportSchema = createInsertSchema(powerBiReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPowerBiDatasetSchema = createInsertSchema(powerBiDatasets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReportingScheduleSchema = createInsertSchema(reportingSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for the new schemas
export type InsertERPSystem = z.infer<typeof insertERPSystemSchema>;
export type ERPSystem = typeof erpSystems.$inferSelect;

export type InsertSCADAConnection = z.infer<typeof insertSCADAConnectionSchema>;
export type SCADAConnection = typeof scadaConnections.$inferSelect;

export type InsertDataIntegrationLog = z.infer<typeof insertDataIntegrationLogSchema>;
export type DataIntegrationLog = typeof dataIntegrationLogs.$inferSelect;

export type InsertAIModel = z.infer<typeof insertAIModelSchema>;
export type AIModel = typeof aiModels.$inferSelect;

export type InsertPredictivePrediction = z.infer<typeof insertPredictivePredictionSchema>;
export type PredictivePrediction = typeof predictivePredictions.$inferSelect;

export type InsertAITrainingJob = z.infer<typeof insertAITrainingJobSchema>;
export type AITrainingJob = typeof aiTrainingJobs.$inferSelect;

export type InsertPowerBiWorkspace = z.infer<typeof insertPowerBiWorkspaceSchema>;
export type PowerBiWorkspace = typeof powerBiWorkspaces.$inferSelect;

export type InsertPowerBiReport = z.infer<typeof insertPowerBiReportSchema>;
export type PowerBiReport = typeof powerBiReports.$inferSelect;

export type InsertPowerBiDataset = z.infer<typeof insertPowerBiDatasetSchema>;
export type PowerBiDataset = typeof powerBiDatasets.$inferSelect;

export type InsertReportingSchedule = z.infer<typeof insertReportingScheduleSchema>;
export type ReportingSchedule = typeof reportingSchedules.$inferSelect;

// Communication Channels - Integration with external platforms (Slack, Teams, Telegram, WhatsApp)
export const communicationChannels = pgTable("communication_channels", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(), // slack, teams, telegram, whatsapp, webhook
  webhookUrl: text("webhook_url"),
  botToken: text("bot_token"),
  channelId: varchar("channel_id", { length: 255 }),
  chatId: varchar("chat_id", { length: 255 }),
  isEnabled: boolean("is_enabled").default(true),
  severityFilter: jsonb("severity_filter").default(["critical", "warning"]),
  eventFilter: jsonb("event_filter").default(["threshold_breach", "predictive_alert", "maintenance_due", "work_order_update"]),
  tenantId: varchar("tenant_id", { length: 36 }),
  createdBy: integer("created_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const notificationDeliveryLogs = pgTable("notification_delivery_logs", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").references(() => communicationChannels.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 50 }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  message: text("message"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, sent, failed
  errorMessage: text("error_message"),
  responseCode: integer("response_code"),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const insertCommunicationChannelSchema = createInsertSchema(communicationChannels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationDeliveryLogSchema = createInsertSchema(notificationDeliveryLogs).omit({
  id: true,
  sentAt: true,
});

export type CommunicationChannel = typeof communicationChannels.$inferSelect;
export type InsertCommunicationChannel = z.infer<typeof insertCommunicationChannelSchema>;
export type NotificationDeliveryLog = typeof notificationDeliveryLogs.$inferSelect;
export type InsertNotificationDeliveryLog = z.infer<typeof insertNotificationDeliveryLogSchema>;

// ═══════════════════════════════════════════════════════════════════
// PERMIT-TO-WORK (PTW) — Permis de travail industriels
// Types: Travaux à chaud, Espace confiné, Consignation électrique (LOTO),
//        Travaux en hauteur, Travaux à froid, Risque chimique
// Cycle: draft → submitted → approved → active → completed / rejected / cancelled / expired
// ═══════════════════════════════════════════════════════════════════
export const permitToWork = pgTable("permit_to_work", {
  id: serial("id").primaryKey(),
  permitNumber: varchar("permit_number", { length: 50 }).notNull().unique(),
  type: varchar("type", { length: 50 }).notNull(), // hot_work | confined_space | electrical_loto | height_work | cold_work | chemical
  status: varchar("status", { length: 30 }).notNull().default("draft"), // draft | submitted | approved | active | completed | rejected | cancelled | expired
  riskLevel: varchar("risk_level", { length: 20 }).notNull().default("medium"), // low | medium | high | critical
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 255 }),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  workOrderId: integer("work_order_id").references(() => workOrders.id),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  requestedById: integer("requested_by_id").references(() => userProfiles.id),
  approvedById: integer("approved_by_id").references(() => userProfiles.id),
  issuedById: integer("issued_by_id").references(() => userProfiles.id),
  closedById: integer("closed_by_id").references(() => userProfiles.id),
  // Dates
  plannedStart: timestamp("planned_start"),
  plannedEnd: timestamp("planned_end"),
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  approvedAt: timestamp("approved_at"),
  // Safety data
  hazards: jsonb("hazards").default([]),                   // string[]
  precautions: jsonb("precautions").default([]),           // string[]
  safetyEquipment: jsonb("safety_equipment").default([]),  // string[] (PPE)
  isolationPoints: jsonb("isolation_points").default([]),  // { label, isolated, restoredAt }[]  — LOTO
  authorizedPersonnel: jsonb("authorized_personnel").default([]), // { name, role, signature? }[]
  checklistItems: jsonb("checklist_items").default([]),    // { label, checked, checkedBy? }[]
  // Text fields
  permitConditions: text("permit_conditions"),
  rejectionReason: text("rejection_reason"),
  completionNotes: text("completion_notes"),
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPermitToWorkSchema = createInsertSchema(permitToWork).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PermitToWork = typeof permitToWork.$inferSelect;
export type InsertPermitToWork = z.infer<typeof insertPermitToWorkSchema>;

// ═══════════════════════════════════════════════════════════════════
// ARBITRATION WEIGHTS STATE — Apprentissage post-action (Brevet 2, rev. 1g/3/10)
// λ_k (poids critères d'optimisation) et ω_j (coefficients d'impact économique)
// ═══════════════════════════════════════════════════════════════════

export const arbitrationWeightsState = pgTable("arbitration_weights_state", {
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).primaryKey(),
  riskWeight: real("risk_weight").notNull().default(0.4),
  costWeight: real("cost_weight").notNull().default(0.35),
  availabilityWeight: real("availability_weight").notNull().default(0.25),
  economicImpactWeights: jsonb("economic_impact_weights").notNull().default({
    directCost: 1 / 6, downtimeCost: 1 / 6, safetyCost: 1 / 6,
    environmentalCost: 1 / 6, productionLossCost: 1 / 6, qualityCost: 1 / 6,
  }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertArbitrationWeightsStateSchema = createInsertSchema(arbitrationWeightsState);
export type ArbitrationWeightsState = typeof arbitrationWeightsState.$inferSelect;
export type InsertArbitrationWeightsState = z.infer<typeof insertArbitrationWeightsStateSchema>;

// ═══════════════════════════════════════════════════════════════════
// EQUIPMENT DEPENDENCY GRAPH — Jumeau comportemental, graphe de dépendances
// fonctionnelles à coefficients de transmission de défaut (Brevet 1, rev. 1c/4)
// ═══════════════════════════════════════════════════════════════════

export const equipmentDependencyTemplates = pgTable("equipment_dependency_templates", {
  equipmentType: varchar("equipment_type", { length: 100 }).primaryKey(),
  nodes: jsonb("nodes").notNull(), // string[] — noms des composants élémentaires
  edges: jsonb("edges").notNull(), // { from: string; to: string; transmissionCoefficient: number }[]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEquipmentDependencyTemplateSchema = createInsertSchema(equipmentDependencyTemplates);
export type EquipmentDependencyTemplate = typeof equipmentDependencyTemplates.$inferSelect;
export type InsertEquipmentDependencyTemplate = z.infer<typeof insertEquipmentDependencyTemplateSchema>;

export const equipmentDependencyOverrides = pgTable("equipment_dependency_overrides", {
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id, { onDelete: "cascade" }).primaryKey(),
  nodes: jsonb("nodes").notNull(),
  edges: jsonb("edges").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEquipmentDependencyOverrideSchema = createInsertSchema(equipmentDependencyOverrides);
export type EquipmentDependencyOverride = typeof equipmentDependencyOverrides.$inferSelect;
export type InsertEquipmentDependencyOverride = z.infer<typeof insertEquipmentDependencyOverrideSchema>;

// ═══════════════════════════════════════════════════════════════════
// FEDERATED SYNC STATE — dernier vecteur de modèle local transmis par site,
// nécessaire au calcul du ParametersDelta (Brevet 3, rev. 1c/15)
// ═══════════════════════════════════════════════════════════════════

export const federatedSyncState = pgTable("federated_sync_state", {
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).primaryKey(),
  lastSentVector: jsonb("last_sent_vector").notNull(), // number[] — dernier vecteur local envoyé
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFederatedSyncStateSchema = createInsertSchema(federatedSyncState);
export type FederatedSyncState = typeof federatedSyncState.$inferSelect;
export type InsertFederatedSyncState = z.infer<typeof insertFederatedSyncStateSchema>;

// ═══════════════════════════════════════════════════════════════════
// PUSH NOTIFICATION SUBSCRIPTIONS — Mobile & PWA push notifications
// ═══════════════════════════════════════════════════════════════════
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => userProfiles.id, { onDelete: "cascade" }).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  deviceName: varchar("device_name", { length: 200 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;

// ═══════════════════════════════════════════════════════════════════
// MOBILE NOTIFICATIONS — Persistent in-app notification feed
// ═══════════════════════════════════════════════════════════════════
export const mobileNotifications = pgTable("mobile_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => userProfiles.id, { onDelete: "cascade" }).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // critical_alert | task_assigned | maintenance_due | work_order_update | system
  severity: varchar("severity", { length: 20 }).default("medium"), // low | medium | high | critical | emergency
  title: text("title").notNull(),
  body: text("body").notNull(),
  relatedEntityType: varchar("related_entity_type", { length: 50 }), // work_order | equipment | alert
  relatedEntityId: integer("related_entity_id"),
  actionUrl: text("action_url"),
  isRead: boolean("is_read").default(false),
  isDismissed: boolean("is_dismissed").default(false),
  pushSent: boolean("push_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

export const insertMobileNotificationSchema = createInsertSchema(mobileNotifications).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export type MobileNotification = typeof mobileNotifications.$inferSelect;
export type InsertMobileNotification = z.infer<typeof insertMobileNotificationSchema>;

// ═══════════════════════════════════════════════════════════════════
// CRYPTO JOURNAL — Journal append-only chainé par hachage SHA-256
// Enclavement cryptographique Brevet MAINTRIX-SCA
// ═══════════════════════════════════════════════════════════════════
export const cryptoJournalEntries = pgTable("crypto_journal_entries", {
  id: serial("id").primaryKey(),
  // Numéro de séquence monotone — unicité garantie au niveau applicatif
  sequenceNumber: integer("sequence_number").notNull().unique(),
  // Domaine d'exécution isolé (PTW_DOMAIN | GMAO_DOMAIN | IMCA_DOMAIN | SYSTEM_DOMAIN)
  domain: varchar("domain", { length: 50 }).notNull(),
  // Action normalisée (ex: PTW:APPROVE_PERMIT)
  action: varchar("action", { length: 100 }).notNull(),
  // Entité cible
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: varchar("entity_id", { length: 100 }).notNull(),
  // Acteur (dénormalisé pour immuabilité)
  actorId: integer("actor_id"),
  actorName: varchar("actor_name", { length: 255 }).notNull(),
  // Snapshot payload de l'entité au moment de l'action
  payload: jsonb("payload").notNull().default({}),
  // Métadonnées contextuelles (IP, tenantId, userAgent…)
  metadata: jsonb("metadata").notNull().default({}),
  // Chaîne cryptographique
  previousHash: varchar("previous_hash", { length: 64 }).notNull(),   // SHA-256 hex de l'entrée précédente
  entryHash: varchar("entry_hash", { length: 64 }).notNull().unique(), // SHA-256 hex de cette entrée
  // Timestamp immuable — jamais mis à jour
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCryptoJournalEntrySchema = createInsertSchema(cryptoJournalEntries).omit({
  id: true,
  createdAt: true,
});

export type CryptoJournalEntry = typeof cryptoJournalEntries.$inferSelect;
export type InsertCryptoJournalEntry = z.infer<typeof insertCryptoJournalEntrySchema>;

// ═══════════════════════════════════════════════════════════════════
// MAINTENANCE EXECUTION — cycle réel d'intervention technicien
// Réception → Inspection → Diagnostic → Réparation → Essais →
// Contrôle Qualité → Livraison → REX
// Voir CADRAGE_MAINTENANCE_EXECUTION_KNOWLEDGE_GRAPH.md
// ═══════════════════════════════════════════════════════════════════

export const interventionExecutions = pgTable("intervention_executions", {
  id: serial("id").primaryKey(),
  workOrderId: integer("work_order_id").references(() => workOrders.id).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id).notNull(),
  currentStep: varchar("current_step", { length: 30 }).notNull().default("reception"),
  // reception | inspection | diagnostic | reparation | essais | controle_qualite | livraison | rex | terminee
  overallStatus: varchar("overall_status", { length: 20 }).notNull().default("in_progress"), // in_progress, completed, on_hold
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const interventionSteps = pgTable("intervention_steps", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").references(() => interventionExecutions.id).notNull(),
  stepType: varchar("step_type", { length: 30 }).notNull(),
  // reception | inspection | diagnostic | reparation | essais | controle_qualite | livraison | rex
  sequenceOrder: integer("sequence_order").notNull(), // ordre réel d'exécution (permet les boucles arrière)
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, in_progress, completed, rejected, skipped
  technicianId: integer("technician_id").references(() => userProfiles.id),
  diagnosticSessionId: integer("diagnostic_session_id").references(() => diagnosticSessions.id), // lien natif à l'étape "diagnostic"
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationMinutes: integer("duration_minutes"),
  notes: text("notes"),
  structuredData: jsonb("structured_data"), // contenu spécifique par type d'étape — voir cadrage
  rejectionReason: text("rejection_reason"), // renseigné si status = rejected
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const interventionAttachments = pgTable("intervention_attachments", {
  id: serial("id").primaryKey(),
  stepId: integer("step_id").references(() => interventionSteps.id).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // photo, video, document
  url: text("url").notNull(),
  caption: text("caption"),
  uploadedBy: integer("uploaded_by").references(() => userProfiles.id),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const interventionMeasurements = pgTable("intervention_measurements", {
  id: serial("id").primaryKey(),
  stepId: integer("step_id").references(() => interventionSteps.id).notNull(),
  measurementType: varchar("measurement_type", { length: 50 }).notNull(), // vibration, temperature, pression, courant...
  value: real("value").notNull(),
  unit: varchar("unit", { length: 20 }),
  expectedMin: real("expected_min"),
  expectedMax: real("expected_max"),
  withinTolerance: boolean("within_tolerance"),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInterventionExecutionSchema = createInsertSchema(interventionExecutions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertInterventionStepSchema = createInsertSchema(interventionSteps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertInterventionAttachmentSchema = createInsertSchema(interventionAttachments).omit({
  id: true,
  createdAt: true,
});
export const insertInterventionMeasurementSchema = createInsertSchema(interventionMeasurements).omit({
  id: true,
  createdAt: true,
});

export type InterventionExecution = typeof interventionExecutions.$inferSelect;
export type InsertInterventionExecution = z.infer<typeof insertInterventionExecutionSchema>;
export type InterventionStep = typeof interventionSteps.$inferSelect;
export type InsertInterventionStep = z.infer<typeof insertInterventionStepSchema>;
export type InterventionAttachment = typeof interventionAttachments.$inferSelect;
export type InsertInterventionAttachment = z.infer<typeof insertInterventionAttachmentSchema>;
export type InterventionMeasurement = typeof interventionMeasurements.$inferSelect;
export type InsertInterventionMeasurement = z.infer<typeof insertInterventionMeasurementSchema>;

// ═══════════════════════════════════════════════════════════════════
// KNOWLEDGE GRAPH MÉTIER — graphe nœuds/arêtes dérivé du réel
// (remplace progressivement les données statiques de
// server/cognitive-layers/knowledge-graph.ts)
// Voir CADRAGE_MAINTENANCE_EXECUTION_KNOWLEDGE_GRAPH.md
// ═══════════════════════════════════════════════════════════════════

export const kgNodes = pgTable("kg_nodes", {
  id: serial("id").primaryKey(),
  nodeType: varchar("node_type", { length: 30 }).notNull(),
  // equipment | component | failure_mode | symptom | error_code | measurement_type |
  // test_type | procedure | technician | work_order | photo | client | plant | lesson_learned
  refTable: varchar("ref_table", { length: 50 }), // nullable — ex: "equipment_registry", "user_profiles", "work_orders"
  refId: varchar("ref_id", { length: 50 }), // nullable — id réel dans refTable
  label: text("label").notNull(), // libellé affichable / normalisé pour le matching
  metadata: jsonb("metadata"), // attributs libres
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const kgEdges = pgTable("kg_edges", {
  id: serial("id").primaryKey(),
  fromNodeId: integer("from_node_id").references(() => kgNodes.id).notNull(),
  toNodeId: integer("to_node_id").references(() => kgNodes.id).notNull(),
  relationType: varchar("relation_type", { length: 40 }).notNull(),
  // has_component | causes | exhibits_symptom | has_error_code | measured_by | tested_by |
  // resolved_by_procedure | repaired_by | performed_by | took_time | documented_by_photo |
  // part_of_work_order | belongs_to_client | located_at_plant | generated_lesson
  weight: real("weight").notNull().default(1.0), // renforcement — cf. learnFromIntervention existant
  occurrenceCount: integer("occurrence_count").notNull().default(1),
  lastReinforcedAt: timestamp("last_reinforced_at").defaultNow(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKgNodeSchema = createInsertSchema(kgNodes).omit({
  id: true,
  createdAt: true,
});
export const insertKgEdgeSchema = createInsertSchema(kgEdges).omit({
  id: true,
  createdAt: true,
  lastReinforcedAt: true,
});

export type KgNode = typeof kgNodes.$inferSelect;
export type InsertKgNode = z.infer<typeof insertKgNodeSchema>;
export type KgEdge = typeof kgEdges.$inferSelect;
export type InsertKgEdge = z.infer<typeof insertKgEdgeSchema>;

// ═══════════════════════════════════════════════════════════════════
// SMM — SYSTÈME DE MANAGEMENT DE MAINTENANCE
// Manuels, procédures, checklists, audits, non-conformités, amélioration continue.
// Modèle consolidé (5 tables plutôt que 10) : les documents (manuel qualité, manuel
// maintenance, procédures, modes opératoires, instructions) partagent la même structure
// et sont distingués par documentType. La "capitalisation" se fait par synchronisation
// des procédures vers kg_nodes (voir smm-routes.ts) plutôt que par une table dédiée.
// Voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md, section 4.
// ═══════════════════════════════════════════════════════════════════

export const smmDocuments = pgTable("smm_documents", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  documentType: varchar("document_type", { length: 30 }).notNull(),
  // manuel_qualite | manuel_maintenance | procedure | mode_operatoire | instruction
  title: text("title").notNull(),
  content: text("content").notNull(),
  version: varchar("version", { length: 20 }).notNull().default("1.0"),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, published, archived
  equipmentType: varchar("equipment_type", { length: 100 }), // pour les procédures/modes opératoires ciblés
  attachmentUrl: text("attachment_url"),
  createdBy: integer("created_by").references(() => userProfiles.id),
  approvedBy: integer("approved_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const smmChecklists = pgTable("smm_checklists", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  equipmentType: varchar("equipment_type", { length: 100 }),
  items: jsonb("items").notNull().default([]), // [{ label: string, required: boolean }]
  version: varchar("version", { length: 20 }).notNull().default("1.0"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  createdBy: integer("created_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const smmAudits = pgTable("smm_audits", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  auditNumber: varchar("audit_number", { length: 50 }).notNull().unique(),
  title: text("title").notNull(),
  auditType: varchar("audit_type", { length: 20 }).notNull().default("interne"), // interne, externe, fournisseur
  scope: text("scope"),
  auditorId: integer("auditor_id").references(() => userProfiles.id),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  checklistId: integer("checklist_id").references(() => smmChecklists.id),
  status: varchar("status", { length: 20 }).notNull().default("planned"), // planned, in_progress, completed
  score: real("score"), // 0-100, calculé depuis findings si checklist utilisée
  findings: jsonb("findings").default([]), // [{ item: string, conforme: boolean, commentaire?: string }]
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const smmNonConformities = pgTable("smm_non_conformities", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  ncNumber: varchar("nc_number", { length: 50 }).notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  severity: varchar("severity", { length: 20 }).notNull().default("mineure"), // mineure, majeure, critique
  source: varchar("source", { length: 30 }).notNull().default("autre"), // audit, controle_qualite, reclamation_client, autre
  sourceAuditId: integer("source_audit_id").references(() => smmAudits.id),
  sourceInterventionStepId: integer("source_intervention_step_id").references(() => interventionSteps.id),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  status: varchar("status", { length: 20 }).notNull().default("ouverte"), // ouverte, en_traitement, cloturee
  detectedBy: integer("detected_by").references(() => userProfiles.id),
  detectedAt: timestamp("detected_at").defaultNow(),
  rootCause: text("root_cause"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const smmImprovementActions = pgTable("smm_improvement_actions", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  nonConformityId: integer("non_conformity_id").references(() => smmNonConformities.id),
  title: text("title").notNull(),
  description: text("description"),
  actionType: varchar("action_type", { length: 20 }).notNull().default("corrective"), // corrective, preventive, amelioration
  responsibleId: integer("responsible_id").references(() => userProfiles.id),
  dueDate: timestamp("due_date"),
  status: varchar("status", { length: 20 }).notNull().default("a_faire"), // a_faire, en_cours, terminee, verifiee
  effectivenessCheck: text("effectiveness_check"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSmmDocumentSchema = createInsertSchema(smmDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSmmChecklistSchema = createInsertSchema(smmChecklists).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSmmAuditSchema = createInsertSchema(smmAudits).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSmmNonConformitySchema = createInsertSchema(smmNonConformities).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSmmImprovementActionSchema = createInsertSchema(smmImprovementActions).omit({ id: true, createdAt: true, updatedAt: true });

export type SmmDocument = typeof smmDocuments.$inferSelect;
export type InsertSmmDocument = z.infer<typeof insertSmmDocumentSchema>;
export type SmmChecklist = typeof smmChecklists.$inferSelect;
export type InsertSmmChecklist = z.infer<typeof insertSmmChecklistSchema>;
export type SmmAudit = typeof smmAudits.$inferSelect;
export type InsertSmmAudit = z.infer<typeof insertSmmAuditSchema>;
export type SmmNonConformity = typeof smmNonConformities.$inferSelect;
export type InsertSmmNonConformity = z.infer<typeof insertSmmNonConformitySchema>;
export type SmmImprovementAction = typeof smmImprovementActions.$inferSelect;
export type InsertSmmImprovementAction = z.infer<typeof insertSmmImprovementActionSchema>;

// ═══════════════════════════════════════════════════════════════════
// ENGINEERING KNOWLEDGE HUB
// Schémas, plans, notices, bulletins techniques, photos, vidéos, normes IEC/ISO,
// procédures SAEM, REX. "L'IA va chercher ici avant de répondre" — voir
// ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md section 6 et knowledge-hub-service.ts.
// La colonne embedding reste vide tant qu'aucune clé OPENAI_API_KEY n'est configurée ;
// la recherche retombe alors sur un scoring par mots-clés (voir knowledge-hub-service.ts).
// ═══════════════════════════════════════════════════════════════════

export const knowledgeHubDocuments = pgTable("knowledge_hub_documents", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  documentType: varchar("document_type", { length: 30 }).notNull(),
  // schema | plan | notice | bulletin_technique | photo | video | norme | procedure_saem | rex
  title: text("title").notNull(),
  description: text("description"),
  content: text("content"), // texte intégral/extrait recherchable (norme, REX, bulletin...)
  tags: text("tags").array(),
  equipmentType: varchar("equipment_type", { length: 100 }),
  fileUrl: text("file_url"),
  fileType: varchar("file_type", { length: 100 }),
  embedding: jsonb("embedding"), // number[] — null si pas de clé OpenAI configurée
  uploadedBy: integer("uploaded_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertKnowledgeHubDocumentSchema = createInsertSchema(knowledgeHubDocuments).omit({
  id: true, createdAt: true, updatedAt: true, embedding: true,
});

export type KnowledgeHubDocument = typeof knowledgeHubDocuments.$inferSelect;
export type InsertKnowledgeHubDocument = z.infer<typeof insertKnowledgeHubDocumentSchema>;

// ═══════════════════════════════════════════════════════════════════
// DIGITAL TWIN — propriété de l'actif, pas seulement une fonction de l'IA
// Une ligne par équipement (pas par type générique) : "calibration" porte les
// paramètres physiques réels de CET équipement précis, qui surchargent les valeurs
// par défaut génériques de server/cognitive-layers/physics-models.ts.
// Voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md, section 7.
// ═══════════════════════════════════════════════════════════════════

export const digitalTwins = pgTable("digital_twins", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id).notNull().unique(),
  calibration: jsonb("calibration").notNull().default({}), // ex: { bearingType, ratedCurrent, npsh, ratedLoad, ratedSpeed }
  isCalibrated: boolean("is_calibrated").notNull().default(false),
  lastResult: jsonb("last_result"), // dernier PhysicsModelResult calculé (voir physics-models.ts)
  lastRemainingUsefulLife: real("last_remaining_useful_life"),
  lastComputedAt: timestamp("last_computed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDigitalTwinSchema = createInsertSchema(digitalTwins).omit({
  id: true, createdAt: true, updatedAt: true, lastResult: true, lastRemainingUsefulLife: true, lastComputedAt: true,
});

export type DigitalTwin = typeof digitalTwins.$inferSelect;
export type InsertDigitalTwin = z.infer<typeof insertDigitalTwinSchema>;

// ═══════════════════════════════════════════════════════════════════
// RCM — Reliability Centered Maintenance
// Arbre de décision classique (Moubray, RCM II) : pour chaque mode de défaillance,
// détermine la stratégie de maintenance applicable (conditionnelle, restauration
// programmée, remplacement programmé, recherche de panne, run-to-failure, reconception).
// Voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md, section 9, et server/rcm-engine.ts.
// ═══════════════════════════════════════════════════════════════════

export const rcmAnalyses = pgTable("rcm_analyses", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  functionDescription: text("function_description").notNull(), // "Fournir un débit de X m³/h à Y bar"
  functionalFailure: text("functional_failure").notNull(), // "Incapable de fournir le débit requis"
  failureMode: text("failure_mode").notNull(), // "Usure de la roue"
  failureEffect: text("failure_effect"),
  // Réponses aux 3 questions de l'arbre de décision RCM classique
  evident: boolean("evident").notNull(), // la panne est-elle évidente en exploitation normale ?
  safetyOrEnvironmental: boolean("safety_or_environmental").notNull().default(false),
  operationalImpact: boolean("operational_impact").notNull().default(false),
  conditionMonitoringPossible: boolean("condition_monitoring_possible").notNull().default(false),
  // Résultat calculé par la logique de décision (server/rcm-engine.ts) — pas saisi manuellement
  consequenceCategory: varchar("consequence_category", { length: 30 }), // hidden | safety_environmental | operational | non_operational
  recommendedTaskType: varchar("recommended_task_type", { length: 30 }), // condition_based | scheduled_restoration | scheduled_discard | failure_finding | run_to_failure | redesign
  reasoning: text("reasoning"),
  taskDescription: text("task_description"),
  intervalSuggestion: varchar("interval_suggestion", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, validated
  createdBy: integer("created_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRcmAnalysisSchema = createInsertSchema(rcmAnalyses).omit({
  id: true, createdAt: true, updatedAt: true, consequenceCategory: true, recommendedTaskType: true, reasoning: true,
});

export type RcmAnalysis = typeof rcmAnalyses.$inferSelect;
export type InsertRcmAnalysis = z.infer<typeof insertRcmAnalysisSchema>;

// ═══════════════════════════════════════════════════════════════════
// RCA & FMEA — tables manquantes découvertes lors de la consolidation Engineering Expertise.
// server/rca-routes.ts et server/fmea-routes.ts existaient depuis longtemps avec un code
// CRUD complet (SQL brut via pool.query), mais interrogeaient des tables "rca_analyses" et
// "fmea_analyses" qui n'ont jamais été créées nulle part dans le projet — les deux
// fonctionnalités étaient donc cassées en pratique depuis leur écriture. Colonnes alignées
// exactement sur les requêtes SQL existantes dans ces deux fichiers de routes.
// ═══════════════════════════════════════════════════════════════════

export const rcaAnalyses = pgTable("rca_analyses", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  rcaNumber: varchar("rca_number", { length: 50 }).notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  methodology: varchar("methodology", { length: 20 }).notNull().default("5_whys"), // 5_whys, fishbone, fmea, fault_tree
  severity: varchar("severity", { length: 20 }).notNull().default("medium"),
  failureDate: timestamp("failure_date"),
  detectionDate: timestamp("detection_date"),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  workOrderId: integer("work_order_id").references(() => workOrders.id),
  failureMode: text("failure_mode"),
  estimatedLoss: decimal("estimated_loss", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("EUR"),
  whyChain: jsonb("why_chain").default([]),
  fishbone: jsonb("fishbone").default({}),
  contributingFactors: jsonb("contributing_factors").default([]),
  actionPlans: jsonb("action_plans").default([]),
  immediateCause: text("immediate_cause"),
  rootCause: text("root_cause"),
  lessonsLearned: text("lessons_learned"),
  preventiveMeasures: text("preventive_measures"),
  recurrenceRisk: text("recurrence_risk"),
  status: varchar("status", { length: 20 }).notNull().default("open"), // open, in_progress, closed, verified
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fmeaAnalyses = pgTable("fmea_analyses", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  fmeaNumber: varchar("fmea_number", { length: 50 }).notNull().unique(),
  title: text("title").notNull(),
  scope: text("scope"),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id),
  equipmentName: text("equipment_name"),
  processStep: text("process_step"),
  entries: jsonb("entries").default([]), // lignes AMDEC : severity/occurrence/detection/RPN par mode de défaillance
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, in_review, approved, obsolete
  revision: integer("revision").default(1),
  reviewedById: integer("reviewed_by_id").references(() => userProfiles.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// BUDGET — server/budget-routes.ts existait depuis longtemps avec un CRUD complet (SQL brut)
// mais interrogeait des tables qui n'ont jamais été créées nulle part dans le projet — même
// situation que rca_analyses/fmea_analyses avant elle. tenant_id présent dès la création.
// ═══════════════════════════════════════════════════════════════════

export const budgetPlans = pgTable("budget_plans", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  budgetNumber: varchar("budget_number", { length: 50 }).notNull().unique(),
  title: text("title").notNull(),
  fiscalYear: integer("fiscal_year").notNull(),
  department: varchar("department", { length: 100 }),
  budgetType: varchar("budget_type", { length: 20 }).notNull().default("maintenance"), // maintenance, capex, opex, emergency, project
  totalAllocated: decimal("total_allocated", { precision: 12, scale: 2 }).default("0"),
  totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).default("0"),
  totalCommitted: decimal("total_committed", { precision: 12, scale: 2 }).default("0"),
  contingencyPct: decimal("contingency_pct", { precision: 5, scale: 2 }).default("10"),
  currency: varchar("currency", { length: 10 }).default("EUR"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  lines: jsonb("lines").default([]), // BudgetLineSchema[] : category/description/allocated/spent/committed
  notes: text("notes"),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, approved, closed
  approvedBy: varchar("approved_by", { length: 100 }),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const budgetTransactions = pgTable("budget_transactions", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  budgetId: integer("budget_id").references(() => budgetPlans.id, { onDelete: "cascade" }).notNull(),
  budgetLineId: varchar("budget_line_id", { length: 50 }),
  transactionType: varchar("transaction_type", { length: 20 }).notNull(), // expense, commitment, adjustment, refund
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  reference: varchar("reference", { length: 100 }),
  supplierName: varchar("supplier_name", { length: 200 }),
  workOrderId: integer("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
  transactionDate: timestamp("transaction_date").notNull(),
  category: varchar("category", { length: 100 }),
  status: varchar("status", { length: 20 }).default("posted"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// OEE — server/oee-routes.ts existait depuis longtemps avec un CRUD complet (SQL brut) mais
// interrogeait une table qui n'a jamais été créée nulle part dans le projet. Distinct du rapport
// GMAO (server/gmao-report-kpi-service.ts) : ici la cadence/qualité de production est saisie
// manuellement par équipe, à la différence des KPI GMAO calculés depuis les ordres de travail.
// ═══════════════════════════════════════════════════════════════════

export const oeeRecords = pgTable("oee_records", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id, { onDelete: "cascade" }).notNull(),
  equipmentName: text("equipment_name"),
  recordDate: timestamp("record_date").notNull(),
  shift: varchar("shift", { length: 20 }).notNull().default("day"), // day, evening, night, all
  plannedTime: decimal("planned_time", { precision: 10, scale: 2 }).default("480"), // minutes
  downtime: decimal("downtime", { precision: 10, scale: 2 }).default("0"),
  speedLoss: decimal("speed_loss", { precision: 10, scale: 2 }).default("0"),
  plannedProduction: integer("planned_production").default(0),
  actualProduction: integer("actual_production").default(0),
  defectiveUnits: integer("defective_units").default(0),
  availability: decimal("availability", { precision: 6, scale: 4 }),
  performance: decimal("performance", { precision: 6, scale: 4 }),
  quality: decimal("quality", { precision: 6, scale: 4 }),
  oee: decimal("oee", { precision: 6, scale: 4 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// ASSET LIFECYCLE — server/asset-lifecycle-routes.ts existait depuis longtemps avec un CRUD
// complet (SQL brut) mais interrogeait une table qui n'a jamais été créée nulle part dans le
// projet. Distinct de equipmentRegistry.lifecycleStage (machine à états ISO 55000 déjà
// fonctionnelle, voir plus haut) : ce module trace la valeur financière (amortissement), le
// MTBF/MTTR par actif et le journal d'événements — complémentaire, pas redondant.
// ═══════════════════════════════════════════════════════════════════

export const assetLifecycle = pgTable("asset_lifecycle", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  assetTag: varchar("asset_tag", { length: 50 }).notNull().unique(),
  name: text("name").notNull(),
  category: varchar("category", { length: 100 }),
  manufacturer: varchar("manufacturer", { length: 100 }),
  model: varchar("model", { length: 100 }),
  serialNumber: varchar("serial_number", { length: 100 }),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id, { onDelete: "set null" }),
  lifecycleStage: varchar("lifecycle_stage", { length: 30 }).notNull().default("operation"), // procurement, commissioning, operation, maintenance, degradation, decommission, disposal
  purchaseDate: timestamp("purchase_date"),
  commissioningDate: timestamp("commissioning_date"),
  plannedReplacementDate: timestamp("planned_replacement_date"),
  actualDisposalDate: timestamp("actual_disposal_date"),
  usefulLifeYears: decimal("useful_life_years", { precision: 6, scale: 2 }),
  purchaseCost: decimal("purchase_cost", { precision: 12, scale: 2 }),
  salvageValue: decimal("salvage_value", { precision: 12, scale: 2 }),
  depreciationMethod: varchar("depreciation_method", { length: 30 }).default("linear"), // linear, declining, units_of_production
  location: varchar("location", { length: 200 }),
  criticality: varchar("criticality", { length: 20 }).default("medium"),
  notes: text("notes"),
  lifecycleEvents: jsonb("lifecycle_events").default([]), // purchase/commissioning/maintenance/repair/inspection/upgrade/incident/decommission/disposal
  documents: jsonb("documents").default([]),
  conditionScore: integer("condition_score"),
  mtbfHours: decimal("mtbf_hours", { precision: 10, scale: 2 }),
  mttrHours: decimal("mttr_hours", { precision: 10, scale: 2 }),
  failureCount: integer("failure_count").default(0),
  maintenanceCount: integer("maintenance_count").default(0),
  totalMaintenanceCost: decimal("total_maintenance_cost", { precision: 12, scale: 2 }).default("0"),
  totalDowntimeHours: decimal("total_downtime_hours", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// HABILITATIONS — server/habilitation-routes.ts existait depuis longtemps avec un CRUD complet
// (SQL brut) mais interrogeait une table qui n'a jamais été créée nulle part dans le projet.
// ═══════════════════════════════════════════════════════════════════

export const technicianHabilitations = pgTable("technician_habilitations", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  habilitationNumber: varchar("habilitation_number", { length: 50 }).notNull().unique(),
  technicianName: varchar("technician_name", { length: 200 }).notNull(),
  technicianId: integer("technician_id").references(() => userProfiles.id, { onDelete: "set null" }),
  technicianEmail: varchar("technician_email", { length: 150 }),
  department: varchar("department", { length: 100 }),
  habilitationType: varchar("habilitation_type", { length: 100 }).notNull(),
  category: varchar("category", { length: 100 }),
  level: varchar("level", { length: 50 }),
  title: text("title").notNull(),
  issuingBody: varchar("issuing_body", { length: 200 }),
  certificateNumber: varchar("certificate_number", { length: 100 }),
  issueDate: timestamp("issue_date").notNull(),
  expiryDate: timestamp("expiry_date"),
  isPermanent: boolean("is_permanent").default(false),
  status: varchar("status", { length: 20 }).default("valid"), // valid, expiring_soon, expired
  renewalAlertDays: integer("renewal_alert_days").default(60),
  trainingDurationHours: decimal("training_duration_hours", { precision: 6, scale: 2 }),
  trainingLocation: varchar("training_location", { length: 200 }),
  assessor: varchar("assessor", { length: 200 }),
  scope: text("scope"),
  restrictions: text("restrictions"),
  renewalHistory: jsonb("renewal_history").default([]),
  documents: jsonb("documents").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// CALIBRATION — server/calibration-routes.ts existait depuis longtemps avec un CRUD complet
// (SQL brut) mais interrogeait une table qui n'a jamais été créée nulle part dans le projet.
// ═══════════════════════════════════════════════════════════════════

export const calibrationRecords = pgTable("calibration_records", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  calibrationNumber: varchar("calibration_number", { length: 50 }).notNull().unique(),
  instrumentName: varchar("instrument_name", { length: 200 }).notNull(),
  instrumentTag: varchar("instrument_tag", { length: 100 }),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id, { onDelete: "set null" }),
  equipmentName: varchar("equipment_name", { length: 200 }),
  instrumentType: varchar("instrument_type", { length: 100 }),
  manufacturer: varchar("manufacturer", { length: 100 }),
  model: varchar("model", { length: 100 }),
  serialNumber: varchar("serial_number", { length: 100 }),
  location: varchar("location", { length: 200 }),
  calibrationDate: timestamp("calibration_date").notNull(),
  nextCalibrationDate: timestamp("next_calibration_date").notNull(),
  calibrationIntervalDays: integer("calibration_interval_days").default(365),
  performedBy: varchar("performed_by", { length: 200 }),
  externalLab: varchar("external_lab", { length: 200 }),
  certificateNumber: varchar("certificate_number", { length: 100 }),
  standardUsed: varchar("standard_used", { length: 200 }),
  method: varchar("method", { length: 200 }),
  temperatureC: decimal("temperature_c", { precision: 5, scale: 2 }),
  humidityPct: decimal("humidity_pct", { precision: 5, scale: 2 }),
  result: varchar("result", { length: 20 }).default("pass"), // pass, fail, conditional
  tolerancePct: decimal("tolerance_pct", { precision: 6, scale: 2 }),
  asFound: jsonb("as_found").default([]),
  asLeft: jsonb("as_left").default([]),
  notes: text("notes"),
  correctiveAction: text("corrective_action"),
  outOfService: boolean("out_of_service").default(false),
  status: varchar("status", { length: 20 }).default("compliant"), // compliant, due_soon, overdue, non_compliant, out_of_service
  history: jsonb("history").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// GARANTIES — server/warranty-routes.ts existait depuis longtemps avec un CRUD complet (SQL brut)
// mais interrogeait une table qui n'a jamais été créée nulle part dans le projet.
// ═══════════════════════════════════════════════════════════════════

export const warranties = pgTable("warranties", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  warrantyNumber: varchar("warranty_number", { length: 50 }).notNull().unique(),
  title: text("title").notNull(),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id, { onDelete: "set null" }),
  equipmentName: varchar("equipment_name", { length: 200 }),
  assetId: integer("asset_id").references(() => assetLifecycle.id, { onDelete: "set null" }),
  supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  supplierName: varchar("supplier_name", { length: 200 }),
  warrantyType: varchar("warranty_type", { length: 30 }).default("manufacturer"), // manufacturer, extended, parts, service, performance
  status: varchar("status", { length: 20 }).default("active"), // active, expiring_soon, expired
  purchaseDate: timestamp("purchase_date"),
  installationDate: timestamp("installation_date"),
  warrantyStart: timestamp("warranty_start").notNull(),
  warrantyEnd: timestamp("warranty_end").notNull(),
  extendedWarrantyEnd: timestamp("extended_warranty_end"),
  coverageDescription: text("coverage_description"),
  exclusions: text("exclusions"),
  maxCoverageAmount: decimal("max_coverage_amount", { precision: 12, scale: 2 }),
  deductible: decimal("deductible", { precision: 12, scale: 2 }).default("0"),
  contactName: varchar("contact_name", { length: 200 }),
  contactEmail: varchar("contact_email", { length: 150 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  contractNumber: varchar("contract_number", { length: 100 }),
  alertDaysBefore: integer("alert_days_before").default(60),
  notes: text("notes"),
  claims: jsonb("claims").default([]),
  documents: jsonb("documents").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════
// PONT TECHLEARN — Maintrix détecte qu'un technicien assigné à un OT n'a
// jamais réalisé d'intervention sur ce type d'équipement (server/techlearn-bridge-service.ts),
// déclenche une demande de formation vers la plateforme TechLearn (LearnSmartHub, produit
// séparé), et reçoit en retour le résultat du quiz/TP. Voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md
// section 11. techlearnTpId/techlearnScore restent null tant que TechLearn n'a pas répondu —
// l'intégration réseau entre les deux produits est un aller-retour asynchrone, pas garanti.
// ═══════════════════════════════════════════════════════════════════

export const trainingRequests = pgTable("training_requests", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  workOrderId: integer("work_order_id").references(() => workOrders.id),
  technicianId: integer("technician_id").references(() => userProfiles.id).notNull(),
  equipmentType: text("equipment_type").notNull(),
  gapReason: text("gap_reason").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("detected"), // detected, requested, in_progress, completed, dismissed
  techlearnTpId: varchar("techlearn_tp_id", { length: 100 }),
  techlearnTpTitle: text("techlearn_tp_title"),
  techlearnTpUrl: text("techlearn_tp_url"),
  techlearnScore: real("techlearn_score"), // 0-100, renseigné au retour du quiz
  requestedBy: integer("requested_by").references(() => userProfiles.id),
  requestedAt: timestamp("requested_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTrainingRequestSchema = createInsertSchema(trainingRequests).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type TrainingRequest = typeof trainingRequests.$inferSelect;
export type InsertTrainingRequest = z.infer<typeof insertTrainingRequestSchema>;

// ═══════════════════════════════════════════════════════════════════
// CYCLE DE VIE ISO 55000 — historique d'audit des transitions d'état. equipment_registry.
// lifecycleStage porte l'état courant (lecture rapide) ; cette table porte la trace complète
// (qui, quand, pourquoi, depuis/vers quoi, éventuellement rattaché à quel OT) — exigence de
// traçabilité propre à la gestion d'actifs, pas un simple log applicatif.
// ═══════════════════════════════════════════════════════════════════

export const equipmentLifecycleTransitions = pgTable("equipment_lifecycle_transitions", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  equipmentId: integer("equipment_id").references(() => equipmentRegistry.id).notNull(),
  fromStage: varchar("from_stage", { length: 30 }).notNull(),
  toStage: varchar("to_stage", { length: 30 }).notNull(),
  reason: text("reason"),
  triggeredBy: integer("triggered_by").references(() => userProfiles.id),
  relatedWorkOrderId: integer("related_work_order_id").references(() => workOrders.id),
  transitionedAt: timestamp("transitioned_at").defaultNow(),
});

export const insertEquipmentLifecycleTransitionSchema = createInsertSchema(equipmentLifecycleTransitions).omit({
  id: true, transitionedAt: true,
});

export type EquipmentLifecycleTransition = typeof equipmentLifecycleTransitions.$inferSelect;
export type InsertEquipmentLifecycleTransition = z.infer<typeof insertEquipmentLifecycleTransitionSchema>;

// ═══════════════════════════════════════════════════════════════════
// PLAN DE MAINTENANCE ANNUEL (PMA) — table manquante découverte lors de l'audit du code
// mort : server/maintenance-plan-routes.ts a un CRUD complet (SQL brut via pool.query)
// depuis longtemps, mais interroge une table "maintenance_plans" qui n'a jamais été créée
// nulle part — la fonctionnalité était donc cassée en pratique depuis son écriture, comme
// rca_analyses/fmea_analyses avant elle (voir plus haut).
// tenantId ajouté (migration 0018) : l'absence initiale reproduisait sciemment le même défaut
// que rca_analyses/fmea_analyses avaient avant leur propre correctif — cloisonnement par tenant
// désormais systématique sur toute nouvelle table de ce type.
// ═══════════════════════════════════════════════════════════════════

export const maintenancePlans = pgTable("maintenance_plans", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  planNumber: varchar("plan_number", { length: 50 }).notNull().unique(),
  title: text("title").notNull(),
  fiscalYear: integer("fiscal_year").notNull(),
  department: varchar("department", { length: 100 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  budgetAllocated: decimal("budget_allocated", { precision: 12, scale: 2 }).default("0"),
  budgetSpent: decimal("budget_spent", { precision: 12, scale: 2 }).default("0"),
  approvedBy: varchar("approved_by", { length: 100 }),
  tasks: jsonb("tasks").default([]), // { id, title, taskType, priority, status, plannedMonth, ... }[]
  notes: text("notes"),
  totalTasks: integer("total_tasks").default(0),
  completedTasks: integer("completed_tasks").default(0),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, approved, in_progress, completed, archived
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMaintenancePlanSchema = createInsertSchema(maintenancePlans).omit({
  id: true, createdAt: true, updatedAt: true, totalTasks: true, completedTasks: true,
});

export type MaintenancePlan = typeof maintenancePlans.$inferSelect;
export type InsertMaintenancePlan = z.infer<typeof insertMaintenancePlanSchema>;

// Authentication system cleaned up - now using userProfiles as the main user table
