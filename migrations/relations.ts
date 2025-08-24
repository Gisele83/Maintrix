import { relations } from "drizzle-orm/relations";
import { maintenanceCases, repairProcedures, diagnosticSessions, feedbackSessions, equipmentRegistry, predictiveAnalytics, spareParts, stockMovements, userProfiles, reorderRules, suppliers, purchaseOrders, purchaseOrderItems, workOrders, validationUsers, userSessions, validationLogs, alertsNotifications, iotSensorData, kpiMetrics, maintenanceReports } from "./schema";

export const repairProceduresRelations = relations(repairProcedures, ({one}) => ({
	maintenanceCase: one(maintenanceCases, {
		fields: [repairProcedures.caseId],
		references: [maintenanceCases.id]
	}),
}));

export const maintenanceCasesRelations = relations(maintenanceCases, ({many}) => ({
	repairProcedures: many(repairProcedures),
}));

export const feedbackSessionsRelations = relations(feedbackSessions, ({one}) => ({
	diagnosticSession: one(diagnosticSessions, {
		fields: [feedbackSessions.sessionId],
		references: [diagnosticSessions.id]
	}),
}));

export const diagnosticSessionsRelations = relations(diagnosticSessions, ({many}) => ({
	feedbackSessions: many(feedbackSessions),
}));

export const predictiveAnalyticsRelations = relations(predictiveAnalytics, ({one}) => ({
	equipmentRegistry: one(equipmentRegistry, {
		fields: [predictiveAnalytics.equipmentId],
		references: [equipmentRegistry.id]
	}),
}));

export const equipmentRegistryRelations = relations(equipmentRegistry, ({many}) => ({
	predictiveAnalytics: many(predictiveAnalytics),
	workOrders: many(workOrders),
	alertsNotifications: many(alertsNotifications),
	iotSensorData: many(iotSensorData),
	kpiMetrics: many(kpiMetrics),
	maintenanceReports: many(maintenanceReports),
}));

export const stockMovementsRelations = relations(stockMovements, ({one}) => ({
	sparePart: one(spareParts, {
		fields: [stockMovements.sparePartId],
		references: [spareParts.id]
	}),
	userProfile: one(userProfiles, {
		fields: [stockMovements.performedBy],
		references: [userProfiles.id]
	}),
}));

export const sparePartsRelations = relations(spareParts, ({many}) => ({
	stockMovements: many(stockMovements),
	reorderRules: many(reorderRules),
	purchaseOrderItems: many(purchaseOrderItems),
}));

export const userProfilesRelations = relations(userProfiles, ({many}) => ({
	stockMovements: many(stockMovements),
	workOrders_assignedTo: many(workOrders, {
		relationName: "workOrders_assignedTo_userProfiles_id"
	}),
	workOrders_requestedBy: many(workOrders, {
		relationName: "workOrders_requestedBy_userProfiles_id"
	}),
	workOrders_level1ValidatedBy: many(workOrders, {
		relationName: "workOrders_level1ValidatedBy_userProfiles_id"
	}),
	workOrders_level2ValidatedBy: many(workOrders, {
		relationName: "workOrders_level2ValidatedBy_userProfiles_id"
	}),
	workOrders_rejectedBy: many(workOrders, {
		relationName: "workOrders_rejectedBy_userProfiles_id"
	}),
	purchaseOrders_level1ValidatedBy: many(purchaseOrders, {
		relationName: "purchaseOrders_level1ValidatedBy_userProfiles_id"
	}),
	purchaseOrders_level2ValidatedBy: many(purchaseOrders, {
		relationName: "purchaseOrders_level2ValidatedBy_userProfiles_id"
	}),
	purchaseOrders_level3ValidatedBy: many(purchaseOrders, {
		relationName: "purchaseOrders_level3ValidatedBy_userProfiles_id"
	}),
	purchaseOrders_rejectedBy: many(purchaseOrders, {
		relationName: "purchaseOrders_rejectedBy_userProfiles_id"
	}),
	purchaseOrders_printedBy: many(purchaseOrders, {
		relationName: "purchaseOrders_printedBy_userProfiles_id"
	}),
	validationLogs: many(validationLogs),
	alertsNotifications_assignedTo: many(alertsNotifications, {
		relationName: "alertsNotifications_assignedTo_userProfiles_id"
	}),
	alertsNotifications_acknowledgedBy: many(alertsNotifications, {
		relationName: "alertsNotifications_acknowledgedBy_userProfiles_id"
	}),
	alertsNotifications_resolvedBy: many(alertsNotifications, {
		relationName: "alertsNotifications_resolvedBy_userProfiles_id"
	}),
}));

export const reorderRulesRelations = relations(reorderRules, ({one}) => ({
	sparePart: one(spareParts, {
		fields: [reorderRules.sparePartId],
		references: [spareParts.id]
	}),
	supplier: one(suppliers, {
		fields: [reorderRules.supplierId],
		references: [suppliers.id]
	}),
}));

export const suppliersRelations = relations(suppliers, ({many}) => ({
	reorderRules: many(reorderRules),
	purchaseOrders: many(purchaseOrders),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({one}) => ({
	purchaseOrder: one(purchaseOrders, {
		fields: [purchaseOrderItems.purchaseOrderId],
		references: [purchaseOrders.id]
	}),
	sparePart: one(spareParts, {
		fields: [purchaseOrderItems.sparePartId],
		references: [spareParts.id]
	}),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({one, many}) => ({
	purchaseOrderItems: many(purchaseOrderItems),
	supplier: one(suppliers, {
		fields: [purchaseOrders.supplierId],
		references: [suppliers.id]
	}),
	userProfile_level1ValidatedBy: one(userProfiles, {
		fields: [purchaseOrders.level1ValidatedBy],
		references: [userProfiles.id],
		relationName: "purchaseOrders_level1ValidatedBy_userProfiles_id"
	}),
	userProfile_level2ValidatedBy: one(userProfiles, {
		fields: [purchaseOrders.level2ValidatedBy],
		references: [userProfiles.id],
		relationName: "purchaseOrders_level2ValidatedBy_userProfiles_id"
	}),
	userProfile_level3ValidatedBy: one(userProfiles, {
		fields: [purchaseOrders.level3ValidatedBy],
		references: [userProfiles.id],
		relationName: "purchaseOrders_level3ValidatedBy_userProfiles_id"
	}),
	userProfile_rejectedBy: one(userProfiles, {
		fields: [purchaseOrders.rejectedBy],
		references: [userProfiles.id],
		relationName: "purchaseOrders_rejectedBy_userProfiles_id"
	}),
	userProfile_printedBy: one(userProfiles, {
		fields: [purchaseOrders.printedBy],
		references: [userProfiles.id],
		relationName: "purchaseOrders_printedBy_userProfiles_id"
	}),
}));

export const workOrdersRelations = relations(workOrders, ({one, many}) => ({
	equipmentRegistry: one(equipmentRegistry, {
		fields: [workOrders.equipmentId],
		references: [equipmentRegistry.id]
	}),
	userProfile_assignedTo: one(userProfiles, {
		fields: [workOrders.assignedTo],
		references: [userProfiles.id],
		relationName: "workOrders_assignedTo_userProfiles_id"
	}),
	userProfile_requestedBy: one(userProfiles, {
		fields: [workOrders.requestedBy],
		references: [userProfiles.id],
		relationName: "workOrders_requestedBy_userProfiles_id"
	}),
	userProfile_level1ValidatedBy: one(userProfiles, {
		fields: [workOrders.level1ValidatedBy],
		references: [userProfiles.id],
		relationName: "workOrders_level1ValidatedBy_userProfiles_id"
	}),
	userProfile_level2ValidatedBy: one(userProfiles, {
		fields: [workOrders.level2ValidatedBy],
		references: [userProfiles.id],
		relationName: "workOrders_level2ValidatedBy_userProfiles_id"
	}),
	userProfile_rejectedBy: one(userProfiles, {
		fields: [workOrders.rejectedBy],
		references: [userProfiles.id],
		relationName: "workOrders_rejectedBy_userProfiles_id"
	}),
	maintenanceReports: many(maintenanceReports),
}));

export const userSessionsRelations = relations(userSessions, ({one}) => ({
	validationUser: one(validationUsers, {
		fields: [userSessions.userId],
		references: [validationUsers.id]
	}),
}));

export const validationUsersRelations = relations(validationUsers, ({many}) => ({
	userSessions: many(userSessions),
}));

export const validationLogsRelations = relations(validationLogs, ({one}) => ({
	userProfile: one(userProfiles, {
		fields: [validationLogs.validatedBy],
		references: [userProfiles.id]
	}),
}));

export const alertsNotificationsRelations = relations(alertsNotifications, ({one}) => ({
	equipmentRegistry: one(equipmentRegistry, {
		fields: [alertsNotifications.equipmentId],
		references: [equipmentRegistry.id]
	}),
	userProfile_assignedTo: one(userProfiles, {
		fields: [alertsNotifications.assignedTo],
		references: [userProfiles.id],
		relationName: "alertsNotifications_assignedTo_userProfiles_id"
	}),
	userProfile_acknowledgedBy: one(userProfiles, {
		fields: [alertsNotifications.acknowledgedBy],
		references: [userProfiles.id],
		relationName: "alertsNotifications_acknowledgedBy_userProfiles_id"
	}),
	userProfile_resolvedBy: one(userProfiles, {
		fields: [alertsNotifications.resolvedBy],
		references: [userProfiles.id],
		relationName: "alertsNotifications_resolvedBy_userProfiles_id"
	}),
}));

export const iotSensorDataRelations = relations(iotSensorData, ({one}) => ({
	equipmentRegistry: one(equipmentRegistry, {
		fields: [iotSensorData.equipmentId],
		references: [equipmentRegistry.id]
	}),
}));

export const kpiMetricsRelations = relations(kpiMetrics, ({one}) => ({
	equipmentRegistry: one(equipmentRegistry, {
		fields: [kpiMetrics.equipmentId],
		references: [equipmentRegistry.id]
	}),
}));

export const maintenanceReportsRelations = relations(maintenanceReports, ({one}) => ({
	workOrder: one(workOrders, {
		fields: [maintenanceReports.workOrderId],
		references: [workOrders.id]
	}),
	equipmentRegistry: one(equipmentRegistry, {
		fields: [maintenanceReports.equipmentId],
		references: [equipmentRegistry.id]
	}),
}));