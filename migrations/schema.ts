import { pgTable, serial, text, timestamp, integer, boolean, real, foreignKey, unique, varchar, numeric, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const equipmentTypes = pgTable("equipment_types", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	nameEn: text("name_en").notNull(),
});

export const reportedCases = pgTable("reported_cases", {
	id: serial().primaryKey().notNull(),
	equipmentType: text("equipment_type").notNull(),
	equipmentId: text("equipment_id"),
	zone: text(),
	contact: text(),
	description: text().notNull(),
	attemptedSolutions: text("attempted_solutions"),
	impact: text().notNull(),
	status: text().default('pending').notNull(),
	attachments: text().array(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const maintenanceCases = pgTable("maintenance_cases", {
	id: serial().primaryKey().notNull(),
	equipmentType: text("equipment_type").notNull(),
	equipmentId: text("equipment_id"),
	zone: text(),
	sector: text(),
	symptoms: text().notNull(),
	symptomsChecked: text("symptoms_checked").array(),
	diagnosis: text().notNull(),
	solution: text().notNull(),
	duration: integer(),
	resolved: boolean().default(true),
	urgency: text().notNull(),
	confidence: real(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const repairProcedures = pgTable("repair_procedures", {
	id: serial().primaryKey().notNull(),
	caseId: integer("case_id"),
	stepNumber: integer("step_number").notNull(),
	title: text().notNull(),
	titleEn: text("title_en").notNull(),
	description: text().notNull(),
	descriptionEn: text("description_en").notNull(),
	safetyWarning: text("safety_warning"),
	safetyWarningEn: text("safety_warning_en"),
	toolsRequired: text("tools_required").array(),
	toolsRequiredEn: text("tools_required_en").array(),
	estimatedTime: integer("estimated_time"),
	isCompleted: boolean("is_completed").default(false),
}, (table) => [
	foreignKey({
			columns: [table.caseId],
			foreignColumns: [maintenanceCases.id],
			name: "repair_procedures_case_id_maintenance_cases_id_fk"
		}),
]);

export const diagnosticSessions = pgTable("diagnostic_sessions", {
	id: serial().primaryKey().notNull(),
	equipmentType: text("equipment_type").notNull(),
	equipmentId: text("equipment_id"),
	zone: text(),
	sector: text(),
	symptoms: text().notNull(),
	symptomsChecked: text("symptoms_checked").array(),
	urgency: text().notNull(),
	results: text(),
	selectedDiagnosis: text("selected_diagnosis"),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	confidence: real(),
	mlPrediction: boolean("ml_prediction").default(false),
	sessionData: text("session_data"),
	userId: integer("user_id"),
});

export const userProfiles = pgTable("user_profiles", {
	id: serial().primaryKey().notNull(),
	username: varchar({ length: 50 }).notNull(),
	firstName: varchar("first_name", { length: 50 }),
	lastName: varchar("last_name", { length: 50 }),
	email: varchar({ length: 100 }),
	role: varchar({ length: 30 }).default('technician'),
	department: varchar({ length: 50 }),
	phoneNumber: varchar("phone_number", { length: 20 }),
	preferredLanguage: varchar("preferred_language", { length: 5 }).default('fr'),
	specializations: text().array(),
	experienceLevel: varchar("experience_level", { length: 20 }).default('intermediate'),
	isActive: boolean("is_active").default(true),
	lastLogin: timestamp("last_login", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	validationLevel: integer("validation_level").default(0),
	canValidateWorkOrders: boolean("can_validate_work_orders").default(false),
	canValidatePurchaseOrders: boolean("can_validate_purchase_orders").default(false),
	maxPurchaseAmount: numeric("max_purchase_amount", { precision: 12, scale:  2 }),
	password: varchar({ length: 255 }),
}, (table) => [
	unique("user_profiles_username_unique").on(table.username),
	unique("user_profiles_email_unique").on(table.email),
]);

export const adaptiveLearning = pgTable("adaptive_learning", {
	id: serial().primaryKey().notNull(),
	equipmentType: text("equipment_type").notNull(),
	symptomKeywords: jsonb("symptom_keywords"),
	commonFailures: jsonb("common_failures"),
	seasonalPatterns: jsonb("seasonal_patterns"),
	zoneSpecificIssues: jsonb("zone_specific_issues"),
	learningWeight: real("learning_weight").default(1),
	confidenceAdjustment: real("confidence_adjustment").default(0),
	lastUpdate: timestamp("last_update", { mode: 'string' }).defaultNow(),
});

export const feedbackSessions = pgTable("feedback_sessions", {
	id: serial().primaryKey().notNull(),
	sessionId: integer("session_id"),
	userFeedback: text("user_feedback"),
	feedbackComment: text("feedback_comment"),
	actualSolution: text("actual_solution"),
	timeToResolution: integer("time_to_resolution"),
	wasAccurate: boolean("was_accurate"),
	difficultyLevel: text("difficulty_level"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [diagnosticSessions.id],
			name: "feedback_sessions_session_id_diagnostic_sessions_id_fk"
		}),
]);

export const learningMetrics = pgTable("learning_metrics", {
	id: serial().primaryKey().notNull(),
	equipmentType: text("equipment_type").notNull(),
	symptomPattern: text("symptom_pattern").notNull(),
	successRate: real("success_rate").default(0.75),
	avgConfidence: real("avg_confidence").default(0.8),
	totalCases: integer("total_cases").default(0),
	successfulCases: integer("successful_cases").default(0),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).defaultNow(),
	improvementSuggestions: jsonb("improvement_suggestions"),
});

export const modelPerformance = pgTable("model_performance", {
	id: serial().primaryKey().notNull(),
	modelType: text("model_type").notNull(),
	equipmentType: text("equipment_type").notNull(),
	accuracy: real().default(0),
	precision: real().default(0),
	recall: real().default(0),
	f1Score: real("f1_score").default(0),
	trainingDate: timestamp("training_date", { mode: 'string' }).defaultNow(),
	sampleSize: integer("sample_size").default(0),
	cvScore: real("cv_score").default(0),
});

export const predictiveAnalytics = pgTable("predictive_analytics", {
	id: serial().primaryKey().notNull(),
	equipmentId: integer("equipment_id"),
	analysisType: varchar("analysis_type", { length: 50 }).notNull(),
	predictionDate: timestamp("prediction_date", { mode: 'string' }).defaultNow(),
	remainingUsefulLife: integer("remaining_useful_life"),
	failureProbability: real("failure_probability"),
	anomalyScore: real("anomaly_score"),
	confidenceLevel: real("confidence_level"),
	riskLevel: varchar("risk_level", { length: 20 }).default('low'),
	recommendations: jsonb(),
	modelVersion: varchar("model_version", { length: 50 }),
	inputFeatures: jsonb("input_features"),
	alertGenerated: boolean("alert_generated").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.equipmentId],
			foreignColumns: [equipmentRegistry.id],
			name: "predictive_analytics_equipment_id_equipment_registry_id_fk"
		}),
]);

export const integrationLog = pgTable("integration_log", {
	id: serial().primaryKey().notNull(),
	systemName: varchar("system_name", { length: 100 }).notNull(),
	operationType: varchar("operation_type", { length: 50 }).notNull(),
	entityType: varchar("entity_type", { length: 50 }).notNull(),
	entityId: integer("entity_id"),
	status: varchar({ length: 30 }).notNull(),
	message: text(),
	requestData: jsonb("request_data"),
	responseData: jsonb("response_data"),
	processedAt: timestamp("processed_at", { mode: 'string' }).defaultNow(),
});

export const preventiveMaintenancePlans = pgTable("preventive_maintenance_plans", {
	id: serial().primaryKey().notNull(),
	planName: text("plan_name").notNull(),
	equipmentType: text("equipment_type").notNull(),
	equipmentIds: jsonb("equipment_ids"),
	frequency: varchar({ length: 30 }).notNull(),
	frequencyValue: integer("frequency_value"),
	tasks: jsonb(),
	estimatedDuration: integer("estimated_duration"),
	requiredSkills: text("required_skills").array(),
	safetyRequirements: text("safety_requirements"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	lastExecuted: timestamp("last_executed", { mode: 'string' }),
	nextDue: timestamp("next_due", { mode: 'string' }),
});

export const spareParts = pgTable("spare_parts", {
	id: serial().primaryKey().notNull(),
	partNumber: varchar("part_number", { length: 100 }).notNull(),
	partName: text("part_name").notNull(),
	description: text(),
	category: varchar({ length: 50 }),
	manufacturer: varchar({ length: 100 }),
	supplier: varchar({ length: 100 }),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }),
	currency: varchar({ length: 5 }).default('EUR'),
	currentStock: integer("current_stock").default(0),
	minStock: integer("min_stock").default(0),
	maxStock: integer("max_stock").default(100),
	reorderPoint: integer("reorder_point").default(0),
	leadTime: integer("lead_time"),
	location: text(),
	compatibleEquipment: jsonb("compatible_equipment"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("spare_parts_part_number_unique").on(table.partNumber),
]);

export const stockMovements = pgTable("stock_movements", {
	id: serial().primaryKey().notNull(),
	sparePartId: integer("spare_part_id"),
	movementType: varchar("movement_type", { length: 20 }).notNull(),
	quantity: integer().notNull(),
	reference: text(),
	reason: text(),
	performedBy: integer("performed_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.sparePartId],
			foreignColumns: [spareParts.id],
			name: "stock_movements_spare_part_id_spare_parts_id_fk"
		}),
	foreignKey({
			columns: [table.performedBy],
			foreignColumns: [userProfiles.id],
			name: "stock_movements_performed_by_user_profiles_id_fk"
		}),
]);

export const suppliers = pgTable("suppliers", {
	id: serial().primaryKey().notNull(),
	supplierCode: varchar("supplier_code", { length: 50 }).notNull(),
	companyName: varchar("company_name", { length: 200 }).notNull(),
	supplierType: varchar("supplier_type", { length: 50 }).notNull(),
	contactPerson: varchar("contact_person", { length: 100 }),
	email: varchar({ length: 150 }),
	phone: varchar({ length: 50 }),
	address: text(),
	city: varchar({ length: 100 }),
	country: varchar({ length: 100 }),
	rating: integer().default(0),
	paymentTerms: varchar("payment_terms", { length: 100 }),
	deliveryTime: integer("delivery_time"),
	certifications: jsonb(),
	notes: text(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("suppliers_supplier_code_unique").on(table.supplierCode),
]);

export const reorderRules = pgTable("reorder_rules", {
	id: serial().primaryKey().notNull(),
	sparePartId: integer("spare_part_id"),
	reorderPoint: integer("reorder_point").notNull(),
	reorderQuantity: integer("reorder_quantity").notNull(),
	maxStock: integer("max_stock"),
	supplierId: integer("supplier_id"),
	isActive: boolean("is_active").default(true),
	leadTime: integer("lead_time"),
	lastTriggered: timestamp("last_triggered", { mode: 'string' }),
	autoOrder: boolean("auto_order").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.sparePartId],
			foreignColumns: [spareParts.id],
			name: "reorder_rules_spare_part_id_spare_parts_id_fk"
		}),
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "reorder_rules_supplier_id_suppliers_id_fk"
		}),
]);

export const purchaseOrderItems = pgTable("purchase_order_items", {
	id: serial().primaryKey().notNull(),
	purchaseOrderId: integer("purchase_order_id"),
	sparePartId: integer("spare_part_id"),
	partNumber: varchar("part_number", { length: 100 }),
	description: text(),
	quantity: integer().notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }),
	totalPrice: numeric("total_price", { precision: 12, scale:  2 }),
	expectedDelivery: timestamp("expected_delivery", { mode: 'string' }),
	received: boolean().default(false),
	receivedQuantity: integer("received_quantity").default(0),
	receivedDate: timestamp("received_date", { mode: 'string' }),
	notes: text(),
}, (table) => [
	foreignKey({
			columns: [table.purchaseOrderId],
			foreignColumns: [purchaseOrders.id],
			name: "purchase_order_items_purchase_order_id_purchase_orders_id_fk"
		}),
	foreignKey({
			columns: [table.sparePartId],
			foreignColumns: [spareParts.id],
			name: "purchase_order_items_spare_part_id_spare_parts_id_fk"
		}),
]);

export const workOrders = pgTable("work_orders", {
	id: serial().primaryKey().notNull(),
	orderNumber: varchar("order_number", { length: 50 }).notNull(),
	equipmentId: integer("equipment_id"),
	orderType: varchar("order_type", { length: 30 }).notNull(),
	title: text().notNull(),
	description: text().notNull(),
	priority: varchar({ length: 20 }).default('medium'),
	status: varchar({ length: 30 }).default('pending'),
	assignedTo: integer("assigned_to"),
	requestedBy: integer("requested_by"),
	estimatedDuration: integer("estimated_duration"),
	actualDuration: integer("actual_duration"),
	scheduledStart: timestamp("scheduled_start", { mode: 'string' }),
	actualStart: timestamp("actual_start", { mode: 'string' }),
	scheduledEnd: timestamp("scheduled_end", { mode: 'string' }),
	actualEnd: timestamp("actual_end", { mode: 'string' }),
	cost: numeric({ precision: 10, scale:  2 }),
	laborCost: numeric("labor_cost", { precision: 10, scale:  2 }),
	materialCost: numeric("material_cost", { precision: 10, scale:  2 }),
	externalCost: numeric("external_cost", { precision: 10, scale:  2 }),
	notes: text(),
	completionNotes: text("completion_notes"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	validationStatus: varchar("validation_status", { length: 30 }).default('pending'),
	level1ValidatedBy: integer("level1_validated_by"),
	level1ValidatedAt: timestamp("level1_validated_at", { mode: 'string' }),
	level1ValidationNotes: text("level1_validation_notes"),
	level2ValidatedBy: integer("level2_validated_by"),
	level2ValidatedAt: timestamp("level2_validated_at", { mode: 'string' }),
	level2ValidationNotes: text("level2_validation_notes"),
	rejectedBy: integer("rejected_by"),
	rejectedAt: timestamp("rejected_at", { mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	canExecute: boolean("can_execute").default(false),
}, (table) => [
	foreignKey({
			columns: [table.equipmentId],
			foreignColumns: [equipmentRegistry.id],
			name: "work_orders_equipment_id_equipment_registry_id_fk"
		}),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [userProfiles.id],
			name: "work_orders_assigned_to_user_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.requestedBy],
			foreignColumns: [userProfiles.id],
			name: "work_orders_requested_by_user_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.level1ValidatedBy],
			foreignColumns: [userProfiles.id],
			name: "work_orders_level1_validated_by_user_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.level2ValidatedBy],
			foreignColumns: [userProfiles.id],
			name: "work_orders_level2_validated_by_user_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.rejectedBy],
			foreignColumns: [userProfiles.id],
			name: "work_orders_rejected_by_user_profiles_id_fk"
		}),
	unique("work_orders_order_number_unique").on(table.orderNumber),
]);

export const monthlyReports = pgTable("monthly_reports", {
	id: serial().primaryKey().notNull(),
	reportNumber: varchar("report_number", { length: 50 }).notNull(),
	month: integer().notNull(),
	year: integer().notNull(),
	periodStart: timestamp("period_start", { mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { mode: 'string' }).notNull(),
	generatedBy: varchar("generated_by", { length: 100 }),
	generatedAt: timestamp("generated_at", { mode: 'string' }).defaultNow(),
	totalEquipment: integer("total_equipment"),
	activeEquipment: integer("active_equipment"),
	equipmentAvailability: numeric("equipment_availability", { precision: 5, scale:  2 }),
	totalWorkOrders: integer("total_work_orders"),
	completedWorkOrders: integer("completed_work_orders"),
	preventiveWorkOrders: integer("preventive_work_orders"),
	correctiveWorkOrders: integer("corrective_work_orders"),
	averageCompletionTime: numeric("average_completion_time", { precision: 8, scale:  2 }),
	mtbf: numeric({ precision: 8, scale:  2 }),
	mttr: numeric({ precision: 8, scale:  2 }),
	plannedMaintenanceRatio: numeric("planned_maintenance_ratio", { precision: 5, scale:  2 }),
	maintenanceEfficiency: numeric("maintenance_efficiency", { precision: 5, scale:  2 }),
	totalMaintenanceCost: numeric("total_maintenance_cost", { precision: 12, scale:  2 }),
	laborCost: numeric("labor_cost", { precision: 12, scale:  2 }),
	partsCost: numeric("parts_cost", { precision: 12, scale:  2 }),
	contractorCost: numeric("contractor_cost", { precision: 12, scale:  2 }),
	costPerWorkOrder: numeric("cost_per_work_order", { precision: 10, scale:  2 }),
	partsConsumed: integer("parts_consumed"),
	inventoryTurnover: numeric("inventory_turnover", { precision: 5, scale:  2 }),
	stockouts: integer(),
	emergencyPurchases: integer("emergency_purchases"),
	totalAlerts: integer("total_alerts"),
	criticalAlerts: integer("critical_alerts"),
	safetyIncidents: integer("safety_incidents"),
	qualityIssues: integer("quality_issues"),
	performanceScore: numeric("performance_score", { precision: 5, scale:  2 }),
	improvementAreas: text("improvement_areas").array(),
	recommendations: text().array(),
	statisticsData: jsonb("statistics_data"),
	chartsData: jsonb("charts_data"),
	status: varchar({ length: 30 }).default('generated').notNull(),
	reviewedBy: varchar("reviewed_by", { length: 100 }),
	reviewDate: timestamp("review_date", { mode: 'string' }),
	notes: text(),
}, (table) => [
	unique("monthly_reports_report_number_unique").on(table.reportNumber),
]);

export const reportTemplates = pgTable("report_templates", {
	id: serial().primaryKey().notNull(),
	templateName: varchar("template_name", { length: 100 }).notNull(),
	templateType: varchar("template_type", { length: 50 }).notNull(),
	description: text(),
	sections: jsonb(),
	kpiMetrics: text("kpi_metrics").array(),
	chartTypes: text("chart_types").array(),
	format: varchar({ length: 30 }).default('pdf'),
	isDefault: boolean("is_default").default(false),
	isActive: boolean("is_active").default(true),
	createdBy: varchar("created_by", { length: 100 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const validationUsers = pgTable("validation_users", {
	id: serial().primaryKey().notNull(),
	username: varchar({ length: 50 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	matricule: varchar({ length: 20 }).notNull(),
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	department: varchar({ length: 100 }).notNull(),
	validationLevel: integer("validation_level").notNull(),
	isActive: boolean("is_active").default(true),
	canValidateOrders: boolean("can_validate_orders").default(false),
	canValidateWorkOrders: boolean("can_validate_work_orders").default(false),
	email: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("validation_users_username_key").on(table.username),
	unique("validation_users_matricule_key").on(table.matricule),
]);

export const userSessions = pgTable("user_sessions", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	sessionToken: varchar("session_token", { length: 255 }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [validationUsers.id],
			name: "user_sessions_user_id_fkey"
		}),
	unique("user_sessions_session_token_key").on(table.sessionToken),
]);

export const purchaseOrders = pgTable("purchase_orders", {
	id: serial().primaryKey().notNull(),
	orderNumber: varchar("order_number", { length: 50 }).notNull(),
	supplierId: integer("supplier_id"),
	orderType: varchar("order_type", { length: 50 }).notNull(),
	status: varchar({ length: 50 }).default('draft').notNull(),
	priority: varchar({ length: 20 }).default('medium').notNull(),
	requestedBy: varchar("requested_by", { length: 100 }),
	approvedBy: varchar("approved_by", { length: 100 }),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }),
	currency: varchar({ length: 10 }).default('EUR'),
	orderDate: timestamp("order_date", { mode: 'string' }).defaultNow(),
	expectedDelivery: timestamp("expected_delivery", { mode: 'string' }),
	actualDelivery: timestamp("actual_delivery", { mode: 'string' }),
	deliveryAddress: text("delivery_address"),
	notes: text(),
	terms: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	validationStatus: varchar("validation_status", { length: 30 }).default('pending'),
	level1ValidatedBy: integer("level1_validated_by"),
	level1ValidatedAt: timestamp("level1_validated_at", { mode: 'string' }),
	level1ValidationNotes: text("level1_validation_notes"),
	level2ValidatedBy: integer("level2_validated_by"),
	level2ValidatedAt: timestamp("level2_validated_at", { mode: 'string' }),
	level2ValidationNotes: text("level2_validation_notes"),
	level3ValidatedBy: integer("level3_validated_by"),
	level3ValidatedAt: timestamp("level3_validated_at", { mode: 'string' }),
	level3ValidationNotes: text("level3_validation_notes"),
	rejectedBy: integer("rejected_by"),
	rejectedAt: timestamp("rejected_at", { mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	canPrint: boolean("can_print").default(false),
	printedBy: integer("printed_by"),
	printedAt: timestamp("printed_at", { mode: 'string' }),
	documentType: varchar("document_type", { length: 50 }).default('purchase_order'),
	chefServiceValidatedBy: varchar("chef_service_validated_by", { length: 255 }),
	chefServiceValidatedAt: timestamp("chef_service_validated_at", { mode: 'string' }),
	directeurValidatedBy: varchar("directeur_validated_by", { length: 255 }),
	directeurValidatedAt: timestamp("directeur_validated_at", { mode: 'string' }),
	validationNotes: text("validation_notes"),
	chefServiceRejectionReason: text("chef_service_rejection_reason"),
	directeurRejectionReason: text("directeur_rejection_reason"),
	documentsJustificatifs: text("documents_justificatifs").array(),
}, (table) => [
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "purchase_orders_supplier_id_suppliers_id_fk"
		}),
	foreignKey({
			columns: [table.level1ValidatedBy],
			foreignColumns: [userProfiles.id],
			name: "purchase_orders_level1_validated_by_user_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.level2ValidatedBy],
			foreignColumns: [userProfiles.id],
			name: "purchase_orders_level2_validated_by_user_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.level3ValidatedBy],
			foreignColumns: [userProfiles.id],
			name: "purchase_orders_level3_validated_by_user_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.rejectedBy],
			foreignColumns: [userProfiles.id],
			name: "purchase_orders_rejected_by_user_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.printedBy],
			foreignColumns: [userProfiles.id],
			name: "purchase_orders_printed_by_user_profiles_id_fk"
		}),
	unique("purchase_orders_order_number_unique").on(table.orderNumber),
]);

export const companyConfig = pgTable("company_config", {
	id: serial().primaryKey().notNull(),
	companyName: varchar("company_name", { length: 255 }).notNull(),
	address: text(),
	phone: varchar({ length: 50 }),
	email: varchar({ length: 255 }),
	website: varchar({ length: 255 }),
	taxNumber: varchar("tax_number", { length: 100 }),
	logoUrl: varchar("logo_url", { length: 500 }),
	logoBase64: text("logo_base64"),
	headerTemplate: text("header_template"),
	footerTemplate: text("footer_template"),
	primaryColor: varchar("primary_color", { length: 7 }).default('#0066cc'),
	secondaryColor: varchar("secondary_color", { length: 7 }).default('#f8f9fa'),
	fontFamily: varchar("font_family", { length: 100 }).default('Arial, sans-serif'),
	letterheadTemplate: text("letterhead_template"),
	documentFooter: text("document_footer"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	purchaseOrderThreshold: numeric("purchase_order_threshold", { precision: 10, scale:  2 }).default('1500.00'),
	commandLetterThreshold: numeric("command_letter_threshold", { precision: 10, scale:  2 }).default('1500.01'),
});

export const validationLogs = pgTable("validation_logs", {
	id: serial().primaryKey().notNull(),
	recordType: varchar("record_type", { length: 30 }).notNull(),
	recordId: integer("record_id").notNull(),
	validationLevel: integer("validation_level").notNull(),
	action: varchar({ length: 20 }).notNull(),
	validatedBy: integer("validated_by"),
	validationDate: timestamp("validation_date", { mode: 'string' }).defaultNow(),
	comments: text(),
	previousStatus: varchar("previous_status", { length: 30 }),
	newStatus: varchar("new_status", { length: 30 }),
	metadata: jsonb(),
}, (table) => [
	foreignKey({
			columns: [table.validatedBy],
			foreignColumns: [userProfiles.id],
			name: "validation_logs_validated_by_user_profiles_id_fk"
		}),
]);

export const alertsNotifications = pgTable("alerts_notifications", {
	id: serial().primaryKey().notNull(),
	alertType: varchar("alert_type", { length: 50 }).notNull(),
	equipmentId: integer("equipment_id"),
	severity: varchar({ length: 20 }).default('medium'),
	title: text().notNull(),
	message: text().notNull(),
	status: varchar({ length: 20 }).default('active'),
	assignedTo: integer("assigned_to"),
	triggerValue: numeric("trigger_value", { precision: 15, scale:  6 }),
	thresholdValue: numeric("threshold_value", { precision: 15, scale:  6 }),
	acknowledgedBy: integer("acknowledged_by"),
	acknowledgedAt: timestamp("acknowledged_at", { mode: 'string' }),
	resolvedBy: integer("resolved_by"),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.equipmentId],
			foreignColumns: [equipmentRegistry.id],
			name: "alerts_notifications_equipment_id_equipment_registry_id_fk"
		}),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [userProfiles.id],
			name: "alerts_notifications_assigned_to_user_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.acknowledgedBy],
			foreignColumns: [userProfiles.id],
			name: "alerts_notifications_acknowledged_by_user_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.resolvedBy],
			foreignColumns: [userProfiles.id],
			name: "alerts_notifications_resolved_by_user_profiles_id_fk"
		}),
]);

export const iotSensorData = pgTable("iot_sensor_data", {
	id: serial().primaryKey().notNull(),
	equipmentId: integer("equipment_id"),
	sensorType: varchar("sensor_type", { length: 50 }).notNull(),
	sensorId: varchar("sensor_id", { length: 100 }).notNull(),
	value: numeric({ precision: 15, scale:  6 }).notNull(),
	unit: varchar({ length: 20 }).notNull(),
	timestamp: timestamp({ mode: 'string' }).defaultNow(),
	quality: varchar({ length: 20 }).default('good'),
	alarmState: varchar("alarm_state", { length: 20 }).default('normal'),
	metadata: jsonb(),
}, (table) => [
	foreignKey({
			columns: [table.equipmentId],
			foreignColumns: [equipmentRegistry.id],
			name: "iot_sensor_data_equipment_id_equipment_registry_id_fk"
		}),
]);

export const equipmentRegistry = pgTable("equipment_registry", {
	id: serial().primaryKey().notNull(),
	equipmentId: varchar("equipment_id", { length: 100 }).notNull(),
	equipmentName: text("equipment_name").notNull(),
	equipmentType: text("equipment_type").notNull(),
	manufacturer: varchar({ length: 100 }),
	model: varchar({ length: 100 }),
	serialNumber: varchar("serial_number", { length: 100 }),
	location: text(),
	zone: varchar({ length: 50 }),
	sector: varchar({ length: 50 }),
	installationDate: timestamp("installation_date", { mode: 'string' }),
	warrantyExpiry: timestamp("warranty_expiry", { mode: 'string' }),
	criticalityLevel: varchar("criticality_level", { length: 20 }).default('medium'),
	operationalState: varchar("operational_state", { length: 20 }).default('operational'),
	technicalSpecs: jsonb("technical_specs"),
	manuals: text().array(),
	spareParts: jsonb("spare_parts"),
	maintenanceSchedule: jsonb("maintenance_schedule"),
	iotSensors: jsonb("iot_sensors"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("equipment_registry_equipment_id_unique").on(table.equipmentId),
]);

export const kpiMetrics = pgTable("kpi_metrics", {
	id: serial().primaryKey().notNull(),
	equipmentId: integer("equipment_id"),
	metricType: varchar("metric_type", { length: 50 }).notNull(),
	metricValue: numeric("metric_value", { precision: 15, scale:  6 }).notNull(),
	periodStart: timestamp("period_start", { mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { mode: 'string' }).notNull(),
	calculationDate: timestamp("calculation_date", { mode: 'string' }).defaultNow(),
	context: jsonb(),
}, (table) => [
	foreignKey({
			columns: [table.equipmentId],
			foreignColumns: [equipmentRegistry.id],
			name: "kpi_metrics_equipment_id_equipment_registry_id_fk"
		}),
]);

export const maintenanceReports = pgTable("maintenance_reports", {
	id: serial().primaryKey().notNull(),
	reportNumber: varchar("report_number", { length: 50 }).notNull(),
	workOrderId: integer("work_order_id"),
	equipmentId: integer("equipment_id"),
	reportType: varchar("report_type", { length: 50 }).notNull(),
	interventionType: varchar("intervention_type", { length: 50 }),
	technician: varchar({ length: 100 }).notNull(),
	supervisor: varchar({ length: 100 }),
	startTime: timestamp("start_time", { mode: 'string' }).notNull(),
	endTime: timestamp("end_time", { mode: 'string' }).notNull(),
	actualDuration: integer("actual_duration"),
	plannedDuration: integer("planned_duration"),
	workDescription: text("work_description").notNull(),
	problemDiagnosis: text("problem_diagnosis"),
	actionsTaken: text("actions_taken").notNull(),
	partsUsed: jsonb("parts_used"),
	toolsUsed: text("tools_used").array(),
	safetyIncidents: text("safety_incidents"),
	qualityCheck: boolean("quality_check").default(false),
	qualityNotes: text("quality_notes"),
	followUpRequired: boolean("follow_up_required").default(false),
	followUpDate: timestamp("follow_up_date", { mode: 'string' }),
	followUpNotes: text("follow_up_notes"),
	totalCost: numeric("total_cost", { precision: 10, scale:  2 }),
	laborCost: numeric("labor_cost", { precision: 10, scale:  2 }),
	partsCost: numeric("parts_cost", { precision: 10, scale:  2 }),
	status: varchar({ length: 30 }).default('draft').notNull(),
	approvedBy: varchar("approved_by", { length: 100 }),
	approvalDate: timestamp("approval_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.workOrderId],
			foreignColumns: [workOrders.id],
			name: "maintenance_reports_work_order_id_work_orders_id_fk"
		}),
	foreignKey({
			columns: [table.equipmentId],
			foreignColumns: [equipmentRegistry.id],
			name: "maintenance_reports_equipment_id_equipment_registry_id_fk"
		}),
	unique("maintenance_reports_report_number_unique").on(table.reportNumber),
]);
