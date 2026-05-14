import type { Express } from "express";
import { gmaoStorage } from "./gmao-storage";
import { PDFGeneratorFunctional, type MaintenanceReportData, type MonthlyReportData } from "./pdf-generator-functional";
import { cctpComplianceService } from "./cctp-compliance-system";
import {
  insertEquipmentRegistrySchema,
  insertWorkOrderSchema,
  insertPreventiveMaintenancePlanSchema,
  insertSparePartSchema,
  insertStockMovementSchema,
  insertIotSensorDataSchema,
  insertPredictiveAnalyticsSchema,
  insertKpiMetricsSchema,
  insertIntegrationLogSchema,
  insertAlertsNotificationsSchema,
  insertMaintenanceReportSchema,
  insertMonthlyReportSchema,
  createCounterFromPlanSchema
} from "@shared/schema";
import { z } from "zod";
import { createValidationDemo } from "./create-validation-demo";

// Helper: reject if no authenticated tenantId (never default to 'default-tenant' for mutations)
function requireTenant(req: any, res: any): string | null {
  const tenantId = req.tenantId as string | undefined;
  if (!tenantId) {
    res.status(401).json({ error: "TENANT_REQUIRED", message: "Tenant context missing — re-authenticate" });
    return null;
  }
  return tenantId;
}

// Helper: check that authenticated user has one of the allowed roles
function hasRole(req: any, ...roles: string[]): boolean {
  const role = req.user?.role as string | undefined;
  return !!role && roles.includes(role);
}

const MOIS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

// Helper: map DB MaintenanceReport + associated records to PDF data structure
function buildMaintenanceReportPDFData(report: any, workOrder?: any, equipment?: any): MaintenanceReportData {
  const startDate = report.startTime ? new Date(report.startTime) : new Date();
  const dateStr = `${startDate.getDate()} ${MOIS_FR[startDate.getMonth()]} ${startDate.getFullYear()}`;
  const parts = Array.isArray(report.partsUsed)
    ? (report.partsUsed as any[]).map((p: any) => ({
        name: p.partNumber || p.name || "Pièce",
        quantity: p.quantity ?? 1,
        unitCost: parseFloat(p.cost ?? p.unitCost ?? 0),
      }))
    : [];
  const recommendations: string[] = [];
  if (report.followUpNotes) recommendations.push(report.followUpNotes);
  if (report.qualityNotes) recommendations.push(report.qualityNotes);

  return {
    reportNumber: report.reportNumber,
    equipment: equipment?.equipmentName || `Équipement #${report.equipmentId ?? "—"}`,
    description: report.workDescription || report.actionsTaken || "—",
    technician: report.technician || "—",
    date: dateStr,
    duration: report.actualDuration ?? report.plannedDuration ?? 0,
    status: report.status || "draft",
    priority: workOrder?.priority || "normal",
    workOrderNumber: workOrder?.orderNumber || `WO-${report.workOrderId ?? report.id}`,
    interventionType: report.interventionType || "repair",
    partsUsed: parts,
    laborCost: parseFloat(report.laborCost?.toString() ?? "0"),
    totalCost: parseFloat(report.totalCost?.toString() ?? "0"),
    nextMaintenanceDate: report.followUpDate
      ? new Date(report.followUpDate).toLocaleDateString("fr-FR")
      : undefined,
    recommendations,
    supervisor: report.supervisor ?? undefined,
    actualDuration: report.actualDuration ?? undefined,
  };
}

// Helper: map DB MonthlyReport to PDF data structure
function buildMonthlyReportPDFData(report: any): MonthlyReportData {
  const stats = (report.statisticsData as any) || {};
  const equipmentByType: Record<string, number> = stats.equipmentByType || {};
  const equipmentStats = Object.entries(equipmentByType).map(([name, count]) => ({
    equipmentName: name,
    interventionCount: count as number,
    totalDowntime: 0,
  }));

  return {
    reportNumber: report.reportNumber,
    month: MOIS_FR[(report.month ?? 1) - 1] ?? String(report.month),
    year: report.year ?? new Date().getFullYear(),
    totalInterventions: report.totalWorkOrders ?? 0,
    completedInterventions: report.completedWorkOrders ?? 0,
    pendingInterventions: Math.max(0, (report.totalWorkOrders ?? 0) - (report.completedWorkOrders ?? 0)),
    totalCost: parseFloat(report.totalMaintenanceCost?.toString() ?? "0"),
    averageDuration: parseFloat(report.averageCompletionTime?.toString() ?? "0") * 60,
    equipmentStats: equipmentStats.length > 0 ? equipmentStats : [],
    monthlyKPIs: {
      availability: parseFloat(report.equipmentAvailability?.toString() ?? "0"),
      mtbf: parseFloat(report.mtbf?.toString() ?? "0"),
      mttr: parseFloat(report.mttr?.toString() ?? "0"),
    },
  };
}

export function registerGMAORoutes(app: Express) {
  
  // ============= EQUIPMENT REGISTRY ROUTES =============
  
  // Get all equipment
  app.get("/api/equipment", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || 'default-tenant';
      const equipment = await gmaoStorage.getEquipmentRegistry(tenantId);
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Get equipment by ID
  app.get("/api/equipment/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid equipment ID" });
      }
      const tenantId = (req as any).tenantId || 'default-tenant';
      const equipment = await gmaoStorage.getEquipmentById(id, tenantId);
      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Create new equipment
  app.post("/api/equipment", async (req, res) => {
    try {
      console.log("Creating equipment with data:", req.body);
      
      // Add tenantId BEFORE validation
      const tenantId = (req as any).tenantId || 'default-tenant';
      const dataToValidate = { ...req.body, tenantId };
      
      // First validate with Zod (expects strings for date fields)
      const validatedData = insertEquipmentRegistrySchema.parse(dataToValidate);
      
      let equipmentId = validatedData.equipmentId;
      
      if (!equipmentId) {
        equipmentId = `EQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        console.log(`Auto-generated equipmentId: ${equipmentId}`);
      } else {
        const existing = await gmaoStorage.getEquipmentByEquipmentIdGlobal(equipmentId);
        if (existing) {
          return res.status(400).json({ 
            message: "Cet ID d'équipement existe déjà. Veuillez en choisir un autre ou laissez le champ vide pour une génération automatique.",
            field: "equipmentId"
          });
        }
      }
      
      // Then convert date strings to Date objects for database storage
      const processedData = { 
        ...validatedData, 
        equipmentId // Use the generated or validated unique ID
      };
      
      if (processedData.installationDate && typeof processedData.installationDate === 'string') {
        processedData.installationDate = new Date(processedData.installationDate);
      }
      if (processedData.warrantyExpiry && typeof processedData.warrantyExpiry === 'string') {
        processedData.warrantyExpiry = new Date(processedData.warrantyExpiry);
      }
      
      const equipment = await gmaoStorage.createEquipment(processedData);
      res.status(201).json(equipment);
    } catch (error) {
      console.error("Error creating equipment:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.issues);
      }
      res.status(400).json({ 
        message: "Failed to create equipment",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Update equipment
  app.put("/api/equipment/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      console.log("Updating equipment:", id, "with updates:", updates);
      
      // Convert date strings to Date objects for timestamp fields
      const processedUpdates = { ...updates };
      if (processedUpdates.installationDate && typeof processedUpdates.installationDate === 'string') {
        processedUpdates.installationDate = new Date(processedUpdates.installationDate);
      }
      if (processedUpdates.warrantyExpiry && typeof processedUpdates.warrantyExpiry === 'string') {
        processedUpdates.warrantyExpiry = new Date(processedUpdates.warrantyExpiry);
      }
      
      const tenantId = (req as any).tenantId || 'default-tenant';
      const equipment = await gmaoStorage.updateEquipment(id, tenantId, processedUpdates);
      res.json(equipment);
    } catch (error) {
      console.error("Error updating equipment:", error);
      res.status(400).json({ 
        message: "Failed to update equipment",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Search equipment
  app.get("/api/equipment/search", async (req, res) => {
    try {
      const { equipmentType, zone, sector } = req.query;
      const tenantId = (req as any).tenantId || 'default-tenant';
      const equipment = await gmaoStorage.searchEquipment({
        equipmentType: equipmentType as string,
        zone: zone as string,
        sector: sector as string
      }, tenantId);
      res.json(equipment);
    } catch (error) {
      console.error("Error searching equipment:", error);
      res.status(500).json({ message: "Failed to search equipment" });
    }
  });

  // ============= WORK ORDERS ROUTES =============
  
  // Get all work orders
  app.get("/api/work-orders", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || 'default-tenant';
      const workOrders = await gmaoStorage.getWorkOrders(tenantId);
      res.json(workOrders);
    } catch (error) {
      console.error("Error fetching work orders:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  // Get work order by ID
  app.get("/api/work-orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = (req as any).tenantId || 'default-tenant';
      const workOrder = await gmaoStorage.getWorkOrderById(id, tenantId);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }
      res.json(workOrder);
    } catch (error) {
      console.error("Error fetching work order:", error);
      res.status(500).json({ message: "Failed to fetch work order" });
    }
  });

  // Create new work order
  app.post("/api/work-orders", async (req, res) => {
    try {
      // Handle case where body might be malformed
      if (!req.body || typeof req.body !== 'object') {
        console.error("Invalid request body format:", req.body);
        return res.status(400).json({ message: "Invalid request body format" });
      }

      // Transform and clean the data before validation
      const cleanedData: any = {};
      
      // For creation via web interface, find or create equipment
      let equipmentId = null;
      if (req.body.equipmentName) {
        // Try to find existing equipment by name
        const tenantId = (req as any).tenantId || 'default-tenant';
        const existingEquipment = await gmaoStorage.searchEquipment({ equipmentName: req.body.equipmentName }, tenantId);
        if (existingEquipment && existingEquipment.length > 0) {
          equipmentId = existingEquipment[0].id;
        } else {
          // Create new equipment entry
          const newEquipment = await gmaoStorage.createEquipment({
            tenantId,
            equipmentId: `EQ-${Date.now()}`,
            equipmentName: req.body.equipmentName,
            equipmentType: 'Generic',
            location: req.body.location || 'Non spécifié'
          });
          equipmentId = newEquipment.id;
        }
      }
      
      // Copy and transform each field explicitly
      if (equipmentId) cleanedData.equipmentId = equipmentId;
      cleanedData.orderType = req.body.category === 'Préventif' ? 'preventive' : 'corrective';
      if (req.body.title) cleanedData.title = req.body.title;
      if (req.body.description) cleanedData.description = req.body.description;
      if (req.body.priority) cleanedData.priority = req.body.priority;
      if (req.body.status) cleanedData.status = req.body.status;
      if (req.body.assignedTo && req.body.assignedTo !== "Non assigné") {
        // For now, skip assignedTo parsing since we don't have user IDs
        // cleanedData.assignedTo = parseInt(req.body.assignedTo);
      }
      if (req.body.estimatedHours) cleanedData.estimatedDuration = parseInt(req.body.estimatedHours) * 60; // Convert to minutes
      if (req.body.dueDate) cleanedData.scheduledStart = req.body.dueDate; // Keep as string for validation
      if (req.body.cost) cleanedData.cost = parseFloat(req.body.cost);
      if (req.body.notes) cleanedData.notes = req.body.notes;

      // Add tenantId BEFORE validation
      const tenantId = (req as any).tenantId || 'default-tenant';
      cleanedData.tenantId = tenantId;

      // First validate with Zod (expects strings for date fields)
      const validatedData = insertWorkOrderSchema.parse(cleanedData);
      
      // Then convert date strings to Date objects for database storage
      const processedData = { ...validatedData };
      if (processedData.scheduledStart && typeof processedData.scheduledStart === 'string') {
        processedData.scheduledStart = new Date(processedData.scheduledStart);
      }
      if (processedData.scheduledEnd && typeof processedData.scheduledEnd === 'string') {
        processedData.scheduledEnd = new Date(processedData.scheduledEnd);
      }
      
      const workOrder = await gmaoStorage.createWorkOrder(processedData);
      
      console.log(`Work order created: ${workOrder.orderNumber} - ${workOrder.title}`);
      res.status(201).json(workOrder);
    } catch (error) {
      console.error("Error creating work order:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation issues:", JSON.stringify(error.issues, null, 2));
      }
      res.status(400).json({ 
        message: "Failed to create work order",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Update work order
  app.put("/api/work-orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      console.log("Updating work order:", id, "with updates:", updates);
      
      // Convert date strings to Date objects for timestamp fields
      const processedUpdates = { ...updates };
      if (processedUpdates.scheduledStart && typeof processedUpdates.scheduledStart === 'string') {
        processedUpdates.scheduledStart = new Date(processedUpdates.scheduledStart);
      }
      if (processedUpdates.scheduledEnd && typeof processedUpdates.scheduledEnd === 'string') {
        processedUpdates.scheduledEnd = new Date(processedUpdates.scheduledEnd);
      }
      if (processedUpdates.actualStart && typeof processedUpdates.actualStart === 'string') {
        processedUpdates.actualStart = new Date(processedUpdates.actualStart);
      }
      if (processedUpdates.actualEnd && typeof processedUpdates.actualEnd === 'string') {
        processedUpdates.actualEnd = new Date(processedUpdates.actualEnd);
      }
      if (processedUpdates.completedAt && typeof processedUpdates.completedAt === 'string') {
        processedUpdates.completedAt = new Date(processedUpdates.completedAt);
      }
      
      const tenantId = (req as any).tenantId || 'default-tenant';
      const workOrder = await gmaoStorage.updateWorkOrder(id, tenantId, processedUpdates);
      
      // 🔄 CCTP AUTO-GENERATION: Déclencher génération automatique de rapport si OT terminé
      if (processedUpdates.status === 'completed' && workOrder) {
        try {
          console.log(`🎯 OT ${workOrder.orderNumber} terminé - tentative auto-génération rapport`);
          
          // Récupérer le tenant ID depuis l'équipement ou default pour la démo
          const equipment = await gmaoStorage.getEquipmentById(workOrder.equipmentId, tenantId);
          const tenantId = equipment?.tenantId || 'default-tenant';
          
          const reportHTML = await cctpComplianceService.checkAndGenerateWorkOrderReport(
            tenantId,
            workOrder.id
          );
          
          if (reportHTML) {
            console.log(`✅ Rapport d'intervention auto-généré pour OT ${workOrder.orderNumber}`);
            // On pourrait sauvegarder le rapport en DB ou l'envoyer par email ici
          } else {
            console.log(`ℹ️ Auto-génération désactivée pour tenant ${tenantId}`);
          }
        } catch (error) {
          console.error("Erreur auto-génération rapport:", error);
          // Ne pas faire échouer la mise à jour de l'OT si la génération de rapport échoue
        }
      }
      
      res.json(workOrder);
    } catch (error) {
      console.error("Error updating work order:", error);
      res.status(400).json({ 
        message: "Failed to update work order",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Delete work order — restricted to admin, director, technical_director
  app.delete("/api/work-orders/:id", async (req, res) => {
    try {
      if (!hasRole(req, 'admin', 'director', 'technical_director', 'owner')) {
        return res.status(403).json({ error: "FORBIDDEN", message: "Droits insuffisants pour supprimer un ordre de travail" });
      }
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const id = parseInt(req.params.id);
      const deleted = await gmaoStorage.deleteWorkOrder(id, tenantId);
      if (deleted) {
        res.json({ success: true, message: "Ordre de travail supprimé avec succès" });
      } else {
        res.status(404).json({ message: "Ordre de travail non trouvé" });
      }
    } catch (error) {
      console.error("Error deleting work order:", error);
      res.status(500).json({ message: "Impossible de supprimer l'ordre de travail" });
    }
  });

  // Get work orders by equipment
  app.get("/api/equipment/:equipmentId/work-orders", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const tenantId = (req as any).tenantId || 'default-tenant';
      const workOrders = await gmaoStorage.getWorkOrdersByEquipment(equipmentId, tenantId);
      res.json(workOrders);
    } catch (error) {
      console.error("Error fetching work orders:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  // Get work orders by status
  app.get("/api/work-orders/status/:status", async (req, res) => {
    try {
      const status = req.params.status;
      const tenantId = (req as any).tenantId || 'default-tenant';
      const workOrders = await gmaoStorage.getWorkOrdersByStatus(status, tenantId);
      res.json(workOrders);
    } catch (error) {
      console.error("Error fetching work orders:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  // Get work orders by assignee
  app.get("/api/users/:userId/work-orders", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const tenantId = (req as any).tenantId || 'default-tenant';
      const workOrders = await gmaoStorage.getWorkOrdersByAssignee(userId, tenantId);
      res.json(workOrders);
    } catch (error) {
      console.error("Error fetching work orders:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  // ============= PREVENTIVE MAINTENANCE ROUTES =============
  
  // Get all preventive maintenance plans
  app.get("/api/preventive-maintenance-plans", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || 'default-tenant';
      const plans = await gmaoStorage.getPreventiveMaintenancePlans(tenantId);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching maintenance plans:", error);
      res.status(500).json({ message: "Failed to fetch maintenance plans" });
    }
  });

  // Create preventive maintenance plan
  app.post("/api/preventive-maintenance-plans", async (req, res) => {
    try {
      console.log("Received maintenance plan data:", req.body);
      const tenantId = (req as any).tenantId || 'default-tenant';
      const data = insertPreventiveMaintenancePlanSchema.parse(req.body);
      const planData = { ...data, tenantId };
      
      // Créer le plan de maintenance
      const plan = await gmaoStorage.createPreventiveMaintenancePlan(planData);
      
      // Si un compteur est configuré, le créer aussi
      if (req.body.counter && req.body.counter.counterType) {
        try {
          // Valider les données du compteur avec Zod
          const validatedCounter = createCounterFromPlanSchema.parse(req.body.counter);
          
          const counterData = {
            tenantId,
            equipmentId: validatedCounter.equipmentId,
            counterName: validatedCounter.counterName,
            counterType: validatedCounter.counterType,
            currentValue: validatedCounter.currentValue,
            thresholdWarning: validatedCounter.thresholdWarning,
            thresholdCritical: validatedCounter.thresholdCritical,
            isActive: true
          };
          
          console.log("Creating validated counter:", counterData);
          const newCounter = await gmaoStorage.createMaintenanceCounter(counterData);
          
          // Générer une alerte immédiate si la valeur actuelle dépasse déjà les seuils
          if (validatedCounter.currentValue >= validatedCounter.thresholdCritical || 
              validatedCounter.currentValue >= validatedCounter.thresholdWarning) {
            await gmaoStorage.checkAndGenerateCounterAlert(newCounter);
          }
          
        } catch (counterError) {
          console.error("Counter validation error:", counterError);
          // On continue sans créer le compteur plutôt que de faire échouer toute la création
        }
      }
      
      res.status(201).json(plan);
    } catch (error) {
      console.error("Error creating maintenance plan:", error);
      res.status(400).json({ message: "Failed to create maintenance plan" });
    }
  });

  // Update preventive maintenance plan
  app.put("/api/preventive-maintenance-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log("Updating maintenance plan:", id, "with data:", req.body);
      
      // Extract the data from the request body (could be wrapped in 'data' property)
      const updateData = req.body.data || req.body;
      
      // Validate the update data using the schema (partial for updates)
      const partialSchema = insertPreventiveMaintenancePlanSchema.partial();
      const validatedData = partialSchema.parse(updateData);
      
      const tenantId = (req as any).tenantId || 'default-tenant';
      const plan = await gmaoStorage.updatePreventiveMaintenancePlan(id, tenantId, validatedData);
      res.json(plan);
    } catch (error) {
      console.error("Error updating maintenance plan:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.issues);
      }
      res.status(400).json({ 
        message: "Failed to update maintenance plan",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Delete preventive maintenance plan
  app.delete("/api/preventive-maintenance-plans/:id", async (req, res) => {
    try {
      if (!hasRole(req, 'admin', 'director', 'technical_director', 'owner')) {
        return res.status(403).json({ error: "FORBIDDEN", message: "Droits insuffisants pour supprimer un plan de maintenance" });
      }
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const id = parseInt(req.params.id);
      await gmaoStorage.deletePreventiveMaintenancePlan(id, tenantId);
      res.json({ success: true, message: "Plan de maintenance supprimé avec succès" });
    } catch (error) {
      console.error("Error deleting maintenance plan:", error);
      res.status(400).json({ 
        message: "Impossible de supprimer le plan de maintenance",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  // ============= SPARE PARTS ROUTES =============
  
  // Get all spare parts
  app.get("/api/spare-parts", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || 'default-tenant';
      const parts = await gmaoStorage.getSpareParts(tenantId);
      res.json(parts);
    } catch (error) {
      console.error("Error fetching spare parts:", error);
      res.status(500).json({ message: "Failed to fetch spare parts" });
    }
  });

  // Get spare part by ID
  app.get("/api/spare-parts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const part = await gmaoStorage.getSparePartById(id);
      if (!part) {
        return res.status(404).json({ message: "Spare part not found" });
      }
      res.json(part);
    } catch (error) {
      console.error("Error fetching spare part:", error);
      res.status(500).json({ message: "Failed to fetch spare part" });
    }
  });

  // Create spare part
  app.post("/api/spare-parts", async (req, res) => {
    try {
      console.log("Received spare part data:", req.body);
      
      // Add tenantId BEFORE validation
      const tenantId = (req as any).tenantId || 'default-tenant';
      const dataToValidate = { ...req.body, tenantId };
      
      const data = insertSparePartSchema.parse(dataToValidate);
      
      // Générer un numéro de pièce unique si conflit détecté
      let uniquePartNumber = data.partNumber;
      let counter = 1;
      
      // Vérifier si le numéro existe déjà
      while (true) {
        try {
          const existing = await gmaoStorage.getSparePartByPartNumber(uniquePartNumber);
          if (!existing) {
            break; // Numéro unique trouvé
          }
          
          // Générer un nouveau numéro avec suffixe
          uniquePartNumber = `${data.partNumber}-${counter.toString().padStart(3, '0')}`;
          counter++;
          
          if (counter > 999) {
            throw new Error("Impossible de générer un numéro de pièce unique");
          }
        } catch (error: any) {
          if (error.message?.includes('Impossible de générer')) {
            throw error;
          }
          break; // En cas d'erreur de requête, continuer avec le numéro actuel
        }
      }
      
      // Créer la pièce avec le numéro unique
      const partToCreate = {
        ...data,
        partNumber: uniquePartNumber
      };
      
      const part = await gmaoStorage.createSparePart(partToCreate);
      console.log(`Pièce créée avec succès: ${uniquePartNumber}`);
      res.status(201).json(part);
    } catch (error: any) {
      console.error("Error creating spare part:", error);
      
      // Gestion spécifique des erreurs de contraintes uniques
      if (error.message && (
        error.message.includes('duplicate key') || 
        error.message.includes('unique constraint') ||
        error.message.includes('already exists')
      )) {
        res.status(400).json({ 
          message: "Cette référence de pièce existe déjà", 
          error: "Référence en doublon" 
        });
      } else {
        res.status(400).json({ 
          message: "Failed to create spare part", 
          error: error.message 
        });
      }
    }
  });

  // Update spare part
  app.put("/api/spare-parts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const part = await gmaoStorage.updateSparePart(id, updates);
      res.json(part);
    } catch (error) {
      console.error("Error updating spare part:", error);
      res.status(400).json({ message: "Failed to update spare part" });
    }
  });

  // Delete spare part — restricted to admin/director + tenant check
  app.delete("/api/spare-parts/:id", async (req, res) => {
    try {
      if (!hasRole(req, 'admin', 'director', 'technical_director', 'owner')) {
        return res.status(403).json({ error: "FORBIDDEN", message: "Droits insuffisants pour supprimer une pièce détachée" });
      }
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const id = parseInt(req.params.id);
      
      const part = await gmaoStorage.getSparePartById(id, tenantId);
      if (!part) {
        return res.status(404).json({ message: "Pièce détachée non trouvée" });
      }

      const movements = await gmaoStorage.getStockMovementsByPart(id);
      if (movements.length > 0) {
        return res.status(400).json({ 
          message: "Impossible de supprimer cette pièce car elle a un historique de mouvements de stock",
          details: `${movements.length} mouvement(s) trouvé(s)`,
          suggestion: "Désactivez la pièce au lieu de la supprimer"
        });
      }

      const success = await gmaoStorage.deleteSparePart(id, tenantId);
      
      if (success) {
        res.json({ 
          message: "Pièce détachée supprimée avec succès",
          deletedPart: {
            id: part.id,
            partNumber: part.partNumber,
            partName: part.partName
          }
        });
      } else {
        res.status(500).json({ message: "Erreur lors de la suppression" });
      }
    } catch (error) {
      console.error("Error deleting spare part:", error);
      res.status(500).json({ 
        message: "Erreur lors de la suppression de la pièce",
        error: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  });

  // Get low stock parts
  app.get("/api/spare-parts/low-stock", async (req, res) => {
    try {
      const parts = await gmaoStorage.getLowStockParts();
      res.json(parts);
    } catch (error) {
      console.error("Error fetching low stock parts:", error);
      res.status(500).json({ message: "Failed to fetch low stock parts" });
    }
  });

  // ============= STOCK MOVEMENTS ROUTES =============
  
  // Get stock movements
  app.get("/api/stock-movements", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId as string | undefined;
      const movements = await gmaoStorage.getStockMovements(tenantId);
      res.json(movements);
    } catch (error) {
      console.error("Error fetching stock movements:", error);
      res.status(500).json({ message: "Failed to fetch stock movements" });
    }
  });

  // Create stock movement
  app.post("/api/stock-movements", async (req, res) => {
    try {
      const data = insertStockMovementSchema.parse(req.body);
      const movement = await gmaoStorage.createStockMovement(data);
      res.status(201).json(movement);
    } catch (error) {
      console.error("Error creating stock movement:", error);
      res.status(400).json({ message: "Failed to create stock movement" });
    }
  });

  // Get stock movements by part
  app.get("/api/spare-parts/:partId/movements", async (req, res) => {
    try {
      const partId = parseInt(req.params.partId);
      const movements = await gmaoStorage.getStockMovementsByPart(partId);
      res.json(movements);
    } catch (error) {
      console.error("Error fetching stock movements:", error);
      res.status(500).json({ message: "Failed to fetch stock movements" });
    }
  });

  // ============= IOT SENSOR DATA ROUTES =============
  
  // Get IoT sensor data
  app.get("/api/iot-data", async (req, res) => {
    try {
      const { equipmentId, sensorType, limit } = req.query;
      const data = await gmaoStorage.getIotSensorData(
        equipmentId ? parseInt(equipmentId as string) : undefined,
        sensorType as string,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(data);
    } catch (error) {
      console.error("Error fetching IoT data:", error);
      res.status(500).json({ message: "Failed to fetch IoT data" });
    }
  });

  // Create IoT sensor data
  app.post("/api/iot-data", async (req, res) => {
    try {
      const data = insertIotSensorDataSchema.parse(req.body);
      const sensorData = await gmaoStorage.createIotSensorData(data);
      res.status(201).json(sensorData);
    } catch (error) {
      console.error("Error creating IoT data:", error);
      res.status(400).json({ message: "Failed to create IoT data" });
    }
  });

  // Get latest sensor data for equipment
  app.get("/api/equipment/:equipmentId/sensor-data", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const data = await gmaoStorage.getLatestSensorData(equipmentId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching sensor data:", error);
      res.status(500).json({ message: "Failed to fetch sensor data" });
    }
  });

  // ============= PREDICTIVE ANALYTICS ROUTES =============
  
  // Get predictive analytics
  app.get("/api/predictive-analytics", async (req, res) => {
    try {
      const { equipmentId } = req.query;
      const analytics = await gmaoStorage.getPredictiveAnalytics(
        equipmentId ? parseInt(equipmentId as string) : undefined
      );
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching predictive analytics:", error);
      res.status(500).json({ message: "Failed to fetch predictive analytics" });
    }
  });

  // Create predictive analytics
  app.post("/api/predictive-analytics", async (req, res) => {
    try {
      const data = insertPredictiveAnalyticsSchema.parse(req.body);
      const analytics = await gmaoStorage.createPredictiveAnalytics(data);
      res.status(201).json(analytics);
    } catch (error) {
      console.error("Error creating predictive analytics:", error);
      res.status(400).json({ message: "Failed to create predictive analytics" });
    }
  });

  // Get latest predictions for equipment
  app.get("/api/equipment/:equipmentId/predictions", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const prediction = await gmaoStorage.getLatestPredictions(equipmentId);
      res.json(prediction);
    } catch (error) {
      console.error("Error fetching predictions:", error);
      res.status(500).json({ message: "Failed to fetch predictions" });
    }
  });

  // ============= KPI METRICS ROUTES =============
  
  // Get KPI metrics
  app.get("/api/kpi-metrics", async (req, res) => {
    try {
      const { equipmentId, metricType } = req.query;
      const metrics = await gmaoStorage.getKpiMetrics(
        equipmentId ? parseInt(equipmentId as string) : undefined,
        metricType as string
      );
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching KPI metrics:", error);
      res.status(500).json({ message: "Failed to fetch KPI metrics" });
    }
  });

  // Create KPI metrics
  app.post("/api/kpi-metrics", async (req, res) => {
    try {
      const data = insertKpiMetricsSchema.parse(req.body);
      const metrics = await gmaoStorage.createKpiMetrics(data);
      res.status(201).json(metrics);
    } catch (error) {
      console.error("Error creating KPI metrics:", error);
      res.status(400).json({ message: "Failed to create KPI metrics" });
    }
  });

  // ============= PREDICTIVE INSIGHTS DASHBOARD =============

  app.post("/api/predictive-insights/seed-demo", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || 'default-tenant';
      const result = await gmaoStorage.seedPredictiveInsightsDemoData(tenantId);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error seeding demo data:", error);
      res.status(500).json({ message: "Failed to seed demo data" });
    }
  });

  app.get("/api/predictive-insights", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || 'default-tenant';
      const { equipmentId } = req.query;
      const data = await gmaoStorage.getPredictiveInsightsDashboard(
        tenantId,
        equipmentId ? parseInt(equipmentId as string) : undefined
      );
      res.json(data);
    } catch (error) {
      console.error("Error fetching predictive insights:", error);
      res.status(500).json({ message: "Failed to fetch predictive insights" });
    }
  });

  // ============= ALERTS AND NOTIFICATIONS ROUTES =============
  
  // Get alerts and notifications
  app.get("/api/alerts", async (req, res) => {
    try {
      const { status, limit } = req.query;
      const tenantId = (req as any).tenantId || 'default-tenant';
      const maxLimit = limit ? Math.min(parseInt(limit as string), 500) : 100;
      const alerts = await gmaoStorage.getAlertsNotifications(status as string, tenantId, maxLimit);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // Create alert
  app.post("/api/alerts", async (req, res) => {
    try {
      const data = insertAlertsNotificationsSchema.parse(req.body);
      const alert = await gmaoStorage.createAlert(data);
      res.status(201).json(alert);
    } catch (error) {
      console.error("Error creating alert:", error);
      res.status(400).json({ message: "Failed to create alert" });
    }
  });

  // Update alert
  app.put("/api/alerts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const alert = await gmaoStorage.updateAlert(id, updates);
      res.json(alert);
    } catch (error) {
      console.error("Error updating alert:", error);
      res.status(400).json({ message: "Failed to update alert" });
    }
  });

  // Get alerts by equipment
  app.get("/api/equipment/:equipmentId/alerts", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const alerts = await gmaoStorage.getAlertsByEquipment(equipmentId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // ============= INTEGRATION ROUTES =============
  
  // Get integration logs
  app.get("/api/integration-logs", async (req, res) => {
    try {
      const { systemName } = req.query;
      const logs = await gmaoStorage.getIntegrationLog(systemName as string);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching integration logs:", error);
      res.status(500).json({ message: "Failed to fetch integration logs" });
    }
  });

  // Create integration log
  app.post("/api/integration-logs", async (req, res) => {
    try {
      const data = insertIntegrationLogSchema.parse(req.body);
      const log = await gmaoStorage.createIntegrationLog(data);
      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating integration log:", error);
      res.status(400).json({ message: "Failed to create integration log" });
    }
  });

  // ============= DASHBOARD AND ANALYTICS ROUTES =============
  
  // Get GMAO dashboard data — optimized with SQL COUNT queries + recent rows only
  app.get("/api/gmao-dashboard", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || 'default-tenant';
      const userRole = (req as any).user?.role || 'technician';

      // Run KPI counts and recent rows in parallel — no full-table scans
      const [kpis, activeWorkOrders, pendingWorkOrders, recentAlerts, equipmentList] = await Promise.all([
        gmaoStorage.getDashboardKPIs(tenantId),
        gmaoStorage.getWorkOrdersByStatus('in_progress', tenantId).then(r => r.slice(0, 3)),
        gmaoStorage.getWorkOrdersByStatus('pending', tenantId).then(r => r.slice(0, 3)),
        gmaoStorage.getAlertsNotifications('active', tenantId).then(r => r.slice(0, 5)),
        gmaoStorage.getEquipmentRegistry(tenantId).then(r => r.slice(0, 50)),
      ]);

      const dashboardData = {
        equipmentCount: kpis.equipmentCount,
        activeWorkOrdersCount: kpis.activeWorkOrdersCount,
        pendingWorkOrdersCount: kpis.pendingWorkOrdersCount,
        criticalAlertsCount: kpis.criticalAlertsCount,
        lowStockPartsCount: kpis.lowStockPartsCount,
        recentWorkOrders: [...activeWorkOrders, ...pendingWorkOrders].slice(0, 5),
        recentAlerts,
        equipmentByType: equipmentList.reduce((acc: Record<string, number>, eq) => {
          const t = eq.equipmentType || 'Autre';
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        }, {}),
        workOrdersByStatus: {
          pending: kpis.pendingWorkOrdersCount,
          in_progress: kpis.activeWorkOrdersCount,
          completed: kpis.completedWorkOrdersCount,
        },
        tenantId,
        accessLevel: userRole,
      };

      res.json(dashboardData);
    } catch (error) {
      console.error("❌ Error fetching dashboard data:", error);
      res.status(500).json({ message: "Impossible de charger le tableau de bord" });
    }
  });

  // Get tenant data access policy - Explains who can see and modify what
  app.get("/api/tenant-access-policy", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || 'default-tenant';
      const userRole = (req as any).user?.role || 'technician';
      
      const accessPolicy = {
        tenantId,
        currentRole: userRole,
        dataVisibility: {
          description: "Tous les utilisateurs du même tenant voient les mêmes données",
          workOrders: "Lecture pour tous, modification selon le rôle",
          equipment: "Lecture pour tous, modification selon le rôle", 
          maintenancePlans: "Lecture pour tous, modification selon le rôle",
          inventory: "Lecture pour tous, modification selon le rôle",
          reports: "Accès selon le niveau du rôle"
        },
        rolePermissions: {
          technician: {
            canView: ["own_work_orders", "equipment", "inventory", "diagnostic_ai"],
            canModify: ["own_work_orders"],
            description: "Technicien - Accès limité aux propres interventions"
          },
          team_leader: {
            canView: ["team_work_orders", "equipment", "inventory", "preventive_maintenance"],
            canModify: ["team_work_orders", "equipment"],
            description: "Chef d'équipe - Accès aux interventions de l'équipe"
          },
          planner: {
            canView: ["all_work_orders", "equipment", "inventory", "planning", "history"],
            canModify: ["all_work_orders", "equipment", "preventive_maintenance", "planning"],
            description: "Planificateur - Accès complet planification"
          },
          maintenance_manager: {
            canView: ["all_work_orders", "equipment", "inventory", "reports", "budget"],
            canModify: ["all_work_orders", "equipment", "preventive_maintenance", "delete_operations"],
            description: "Responsable Maintenance - Vue globale et validation"
          },
          procurement: {
            canView: ["inventory", "all_work_orders", "equipment", "budget"],
            canModify: ["inventory", "purchase_orders"],
            description: "Service Achats - Gestion stock et commandes"
          },
          technical_director: {
            canView: ["all_data", "reports", "budget", "analytics"],
            canModify: ["all_data", "budget", "settings"],
            description: "Directeur Technique - Accès complet"
          },
          admin: {
            canView: ["all_data", "users", "audit_logs", "settings"],
            canModify: ["all_data", "users", "settings", "tenant_configuration"],
            description: "Administrateur - Contrôle total"
          }
        }
      };
      
      res.json(accessPolicy);
    } catch (error) {
      console.error("Error fetching access policy:", error);
      res.status(500).json({ message: "Failed to fetch access policy" });
    }
  });

  // ============= PROCUREMENT AND SUPPLIER MANAGEMENT ROUTES =============

  // SUPPLIERS MANAGEMENT
  // OLD suppliers route - will be replaced by demo version below

  app.post("/api/suppliers", async (req, res) => {
    try {
      const supplier = await gmaoStorage.createSupplier(req.body);
      res.status(201).json(supplier);
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(500).json({ message: "Failed to create supplier" });
    }
  });

  // PURCHASE ORDERS MANAGEMENT
  // OLD purchase orders route - will be replaced by demo version below

  // Check document type based on amount
  app.post("/api/purchase-orders/document-type", async (req, res) => {
    try {
      const { amount } = req.body;
      const numAmount = parseFloat(amount);
      
      if (isNaN(numAmount)) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      // Use fixed thresholds for now (avoid database dependency)
      const purchaseOrderThreshold = 1500;
      const commandLetterThreshold = 1500;
      
      let documentType, validationLevels, message;
      
      if (numAmount <= purchaseOrderThreshold) {
        documentType = "purchase_order";
        validationLevels = 2;
        message = `Montant ≤ ${purchaseOrderThreshold}€ : Bon de Commande avec validation 2 niveaux (Chef Service + Directeur)`;
      } else {
        documentType = "command_letter";
        validationLevels = 2;
        message = `Montant > ${commandLetterThreshold}€ : Lettre de Commande avec validation 2 niveaux (Chef Service + Directeur)`;
      }

      res.json({
        documentType,
        validationLevels,
        threshold: purchaseOrderThreshold,
        commandThreshold: commandLetterThreshold,
        message
      });
    } catch (error) {
      console.error("Error determining document type:", error);
      res.status(500).json({ error: "Failed to determine document type" });
    }
  });

  app.post("/api/purchase-orders", async (req, res) => {
    try {
      // Determine document type based on amount
      const amount = parseFloat(req.body.totalAmount);
      const documentType = amount <= 1500 ? "purchase_order" : "command_letter";
      
      const orderData = {
        orderType: req.body.orderType || "spare_parts",
        requestedBy: req.body.requestedBy,
        totalAmount: req.body.totalAmount,
        priority: req.body.priority || "medium",
        documentType,
        validationStatus: "pending",
        status: "draft",
        currency: "EUR",
        // Add other required fields with defaults
        deliveryAddress: req.body.deliveryAddress || "",
        notes: req.body.description || "",
        terms: req.body.terms || ""
      };
      
      const order = await gmaoStorage.createPurchaseOrder(orderData);
      res.status(201).json({
        success: true,
        message: `${documentType === "purchase_order" ? "Bon de commande" : "Lettre de commande"} créé avec succès`,
        order
      });
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res.status(500).json({ 
        success: false,
        message: "Erreur lors de la création de la commande",
        error: error.message 
      });
    }
  });

  // REORDER RULES AND AUTOMATIC ORDERING
  app.get("/api/reorder-rules", async (req, res) => {
    try {
      const rules = await gmaoStorage.getReorderRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching reorder rules:", error);
      res.status(500).json({ message: "Failed to fetch reorder rules" });
    }
  });

  app.post("/api/reorder-rules", async (req, res) => {
    try {
      const rule = await gmaoStorage.createReorderRule(req.body);
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating reorder rule:", error);
      res.status(500).json({ message: "Failed to create reorder rule" });
    }
  });

  // Trigger automatic reorder check - DIRECT DEMO
  app.post("/api/trigger-reorder-check", (req, res) => {
    console.log("🚀 Demo: Automatic procurement system...");
    
    res.json({
      success: true,
      message: "Vérification automatique terminée avec succès",
      triggeredRules: 4,
      createdOrders: 4,
      totalAmount: 7132.50,
      orders: [
        {
          partNumber: "ROB-001",
          partName: "Roulement moteur principal STS",
          quantity: 20,
          supplier: "SKF Roulements France",
          amount: 3000.00,
          priority: "urgent"
        },
        {
          partNumber: "JNT-002", 
          partName: "Joint pompe hydraulique RTG",
          quantity: 15,
          supplier: "Grundfos Pompes",
          amount: 382.50,
          priority: "high"
        },
        {
          partNumber: "CTR-003",
          partName: "Contacteur électrique 40A", 
          quantity: 10,
          supplier: "Schneider Electric",
          amount: 850.00,
          priority: "high"
        },
        {
          partNumber: "BLT-005",
          partName: "Courroie transmission principale",
          quantity: 12,
          supplier: "Siemens Industrial Solutions", 
          amount: 900.00,
          priority: "high"
        }
      ],
      timestamp: new Date().toISOString()
    });
  });

  // Get parts needing reorder - DIRECT DEMO
  app.get("/api/parts-needing-reorder", (req, res) => {
    res.json([
      {
        id: 1,
        partNumber: "ROB-001",
        partName: "Roulement moteur principal STS",
        currentStock: 2,
        reorderPoint: 5,
        reorderQuantity: 20,
        autoOrder: true,
        priority: "urgent",
        supplier: "SKF Roulements France",
        unitPrice: 150.00,
        estimatedCost: 3000.00
      },
      {
        id: 2, 
        partNumber: "JNT-002",
        partName: "Joint pompe hydraulique RTG",
        currentStock: 1,
        reorderPoint: 3,
        reorderQuantity: 15,
        autoOrder: true,
        priority: "high",
        supplier: "Grundfos Pompes",
        unitPrice: 25.50,
        estimatedCost: 382.50
      },
      {
        id: 3,
        partNumber: "CTR-003", 
        partName: "Contacteur électrique 40A",
        currentStock: 1,
        reorderPoint: 2,
        reorderQuantity: 10,
        autoOrder: true,
        priority: "high",
        supplier: "Schneider Electric",
        unitPrice: 85.00,
        estimatedCost: 850.00
      },
      {
        id: 5,
        partNumber: "BLT-005",
        partName: "Courroie transmission principale",
        currentStock: 2,
        reorderPoint: 4, 
        reorderQuantity: 12,
        autoOrder: true,
        priority: "high",
        supplier: "Siemens Industrial Solutions",
        unitPrice: 75.00,
        estimatedCost: 900.00
      }
    ]);
  });

  // Get suppliers - DIRECT DEMO
  app.get("/api/suppliers", (req, res) => {
    res.json([
      {
        id: 1,
        supplierCode: "SUP001",
        companyName: "Siemens Industrial Solutions",
        contactPerson: "Marie Dubois",
        email: "marie.dubois@siemens.com", 
        phone: "+33 1 49 22 33 44",
        rating: 4,
        paymentTerms: "NET 30",
        deliveryTime: 7,
        isActive: true,
        lastOrder: "2025-01-20"
      },
      {
        id: 2,
        supplierCode: "SUP002", 
        companyName: "SKF Roulements France",
        contactPerson: "Jean Martin",
        email: "jean.martin@skf.com",
        phone: "+33 1 64 49 30 00", 
        rating: 5,
        paymentTerms: "NET 30",
        deliveryTime: 3,
        isActive: true,
        lastOrder: "2025-01-23"
      },
      {
        id: 3,
        supplierCode: "SUP003",
        companyName: "Schneider Electric",
        contactPerson: "Pierre Lefebvre", 
        email: "pierre.lefebvre@schneider-electric.com",
        phone: "+33 1 41 29 70 00",
        rating: 4,
        paymentTerms: "NET 30", 
        deliveryTime: 5,
        isActive: true,
        lastOrder: "2025-01-18"
      },
      {
        id: 4,
        supplierCode: "SUP004",
        companyName: "Grundfos Pompes",
        contactPerson: "Sophie Durand",
        email: "sophie.durand@grundfos.com",
        phone: "+33 1 56 52 65 00",
        rating: 4,
        paymentTerms: "NET 30",
        deliveryTime: 5,
        isActive: true,
        lastOrder: "2025-01-22"
      },
      {
        id: 5,
        supplierCode: "SUP005", 
        companyName: "Atlas Copco France",
        contactPerson: "Marc Rousseau",
        email: "marc.rousseau@atlascopco.com",
        phone: "+33 1 39 30 68 00",
        rating: 4,
        paymentTerms: "NET 30",
        deliveryTime: 10,
        isActive: true,
        lastOrder: "2025-01-15"
      }
    ]);
  });

  // Get purchase orders - DIRECT DEMO
  app.get("/api/purchase-orders", (req, res) => {
    res.json([
      {
        id: 1,
        orderNumber: "AUTO-20250124-ROB-001",
        supplierId: 2,
        supplierName: "SKF Roulements France",
        status: "sent",
        priority: "urgent", 
        totalAmount: 3000.00,
        currency: "EUR",
        requestedBy: "Système Automatique",
        expectedDelivery: "2025-01-31",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 2,
        orderNumber: "AUTO-20250124-JNT-002", 
        supplierId: 4,
        supplierName: "Grundfos Pompes",
        status: "draft",
        priority: "high",
        totalAmount: 382.50,
        currency: "EUR",
        requestedBy: "Système Automatique", 
        expectedDelivery: "2025-01-29",
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 3,
        orderNumber: "AUTO-20250124-CTR-003",
        supplierId: 3,
        supplierName: "Schneider Electric",
        status: "confirmed",
        priority: "high",
        totalAmount: 850.00,
        currency: "EUR",
        requestedBy: "Système Automatique",
        expectedDelivery: "2025-01-27", 
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      }
    ]);
  });

  // ============= MAINTENANCE REPORTS ROUTES =============

  // Generate maintenance report
  app.post("/api/maintenance-reports", async (req, res) => {
    try {
      const { workOrderId, ...reportData } = req.body;
      const report = await gmaoStorage.generateMaintenanceReport(workOrderId, reportData);
      res.status(201).json(report);
    } catch (error) {
      console.error("Error generating maintenance report:", error);
      res.status(400).json({ message: "Failed to generate maintenance report" });
    }
  });

  // Download maintenance report as PDF — connected to real DB
  app.get("/api/maintenance-reports/:id/pdf", async (req, res) => {
    try {
      const reportId = parseInt(req.params.id);
      if (isNaN(reportId)) {
        return res.status(400).json({ message: "ID de rapport invalide" });
      }
      const tenantId = (req as any).tenantId || 'default-tenant';

      const report = await gmaoStorage.getMaintenanceReportById(reportId);
      if (!report) {
        return res.status(404).json({ message: "Rapport de maintenance introuvable" });
      }

      // Fetch associated work order and equipment for enriched PDF
      const [workOrder, equipment] = await Promise.all([
        report.workOrderId ? gmaoStorage.getWorkOrderById(report.workOrderId, tenantId) : Promise.resolve(undefined),
        report.equipmentId ? gmaoStorage.getEquipmentById(report.equipmentId, tenantId) : Promise.resolve(undefined),
      ]);

      const reportData = buildMaintenanceReportPDFData(report, workOrder, equipment);
      const pdfGenerator = new PDFGeneratorFunctional();
      await pdfGenerator.sendMaintenanceReportHTML(res, reportData);
    } catch (error) {
      console.error("Error generating maintenance report PDF:", error);
      res.status(500).json({ message: "Impossible de générer le rapport PDF" });
    }
  });

  // Get maintenance reports — real data from DB
  app.get("/api/maintenance-reports", async (req, res) => {
    try {
      const { reportType, status, equipmentId } = req.query;
      const reports = await gmaoStorage.getMaintenanceReports({
        ...(reportType && { reportType: reportType as string }),
        ...(status && { status: status as string }),
        ...(equipmentId && { equipmentId: parseInt(equipmentId as string) }),
      });
      res.json(reports);
    } catch (error) {
      console.error("Error fetching maintenance reports:", error);
      res.status(500).json({ message: "Impossible de charger les rapports de maintenance" });
    }
  });

  // ============= MONTHLY REPORTS ROUTES =============

  // Generate monthly report
  app.post("/api/monthly-reports", async (req, res) => {
    try {
      const { month, year, generatedBy } = req.body;
      const report = await gmaoStorage.generateMonthlyReport(month, year, generatedBy);
      res.status(201).json(report);
    } catch (error) {
      console.error("Error generating monthly report:", error);
      res.status(400).json({ message: "Failed to generate monthly report" });
    }
  });

  // Download monthly report as PDF — connected to real DB
  app.get("/api/monthly-reports/:id/pdf", async (req, res) => {
    try {
      const reportId = parseInt(req.params.id);
      if (isNaN(reportId)) {
        return res.status(400).json({ message: "ID de rapport invalide" });
      }

      const report = await gmaoStorage.getMonthlyReportById(reportId);
      if (!report) {
        return res.status(404).json({ message: "Rapport mensuel introuvable" });
      }

      const reportData = buildMonthlyReportPDFData(report);
      const pdfGenerator = new PDFGeneratorFunctional();
      await pdfGenerator.sendMonthlyReportHTML(res, reportData);
    } catch (error) {
      console.error("Error generating monthly report PDF:", error);
      res.status(500).json({ message: "Impossible de générer le rapport PDF" });
    }
  });

  // Get monthly reports — real data from DB
  app.get("/api/monthly-reports", async (req, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const reports = await gmaoStorage.getMonthlyReports(year);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching monthly reports:", error);
      res.status(500).json({ message: "Impossible de charger les rapports mensuels" });
    }
  });



  // ============= COMPANY CONFIGURATION ROUTES =============
  
  // Get company configuration
  app.get("/api/company-config", async (req, res) => {
    try {
      const config = await gmaoStorage.getCompanyConfig();
      if (!config) {
        return res.json({
          companyName: "Votre Entreprise",
          address: "",
          phone: "",
          email: "",
          website: "",
          taxNumber: "",
          primaryColor: "#0066cc",
          secondaryColor: "#f8f9fa",
          fontFamily: "Arial, sans-serif"
        });
      }
      res.json(config);
    } catch (error) {
      console.error("Error fetching company config:", error);
      res.status(500).json({ message: "Failed to fetch company configuration" });
    }
  });

  // Get document type based on amount
  app.post("/api/purchase-orders/document-type", async (req, res) => {
    try {
      const { amount } = req.body;
      
      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ message: "Montant invalide" });
      }
      
      const config = await gmaoStorage.getCompanyConfig();
      const purchaseThreshold = parseFloat(config?.purchaseOrderThreshold || "1500.00");
      const commandThreshold = parseFloat(config?.commandLetterThreshold || "1500.01");
      
      const amountValue = parseFloat(amount);
      let documentType: string;
      let validationLevels: number;
      
      if (amountValue <= purchaseThreshold) {
        documentType = "purchase_order";
        validationLevels = 2; // Standard validation levels
      } else if (amountValue >= commandThreshold) {
        documentType = "command_letter";
        validationLevels = 3; // Enhanced validation for command letters
      } else {
        documentType = "purchase_order"; // Default to purchase order for edge cases
        validationLevels = 2;
      }
      
      res.json({
        documentType,
        validationLevels,
        threshold: purchaseThreshold,
        commandThreshold,
        message: `Montant ${amountValue}€ → ${documentType === "purchase_order" ? "Bon de Commande" : "Lettre de Commande"}`
      });
    } catch (error) {
      console.error("Error determining document type:", error);
      res.status(500).json({ message: "Failed to determine document type" });
    }
  });

  // Create or update company configuration  
  app.post("/api/company-config", async (req, res) => {
    try {
      const existingConfig = await gmaoStorage.getCompanyConfig();
      
      if (existingConfig) {
        const updatedConfig = await gmaoStorage.updateCompanyConfig(existingConfig.id, req.body);
        res.json({
          success: true,
          message: "Configuration mise à jour avec succès",
          config: updatedConfig
        });
      } else {
        const newConfig = await gmaoStorage.createCompanyConfig(req.body);
        res.json({
          success: true,
          message: "Configuration créée avec succès",
          config: newConfig
        });
      }
    } catch (error) {
      console.error("Error saving company config:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to save company configuration" 
      });
    }
  });

  // Generate purchase order with letterhead — real data from DB
  app.get("/api/purchase-orders/:id/letterhead", async (req, res) => {
    try {
      const purchaseOrderId = parseInt(req.params.id);

      const order = await gmaoStorage.getPurchaseOrderById(purchaseOrderId);
      if (!order) {
        return res.status(404).json({ message: "Bon de commande introuvable" });
      }

      // Enrich with line items
      const items = await gmaoStorage.getPurchaseOrderItems(purchaseOrderId);
      const enrichedOrder = {
        ...order,
        items: items.map(i => ({
          partNumber: i.partNumber || `ITEM-${i.id}`,
          description: i.description || "—",
          quantity: i.quantity ?? 0,
          unitPrice: parseFloat(i.unitPrice?.toString() ?? "0"),
        })),
      };

      const { generatePurchaseOrderPDF } = await import('../server/pdf-generator-pdfkit');
      const companyConfig = await gmaoStorage.getCompanyConfig();
      const pdfDoc = generatePurchaseOrderPDF(enrichedOrder, companyConfig || undefined);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="bon_commande_${order.orderNumber}.pdf"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (error) {
      console.error("Error generating purchase order with letterhead:", error);
      res.status(500).json({ message: "Impossible de générer le bon de commande" });
    }
  });

  // Mark purchase order as printed (Service Achat final step)
  app.post("/api/purchase-orders/:id/mark-printed", async (req, res) => {
    try {
      const purchaseOrderId = parseInt(req.params.id);
      const { printedBy, printedAt } = req.body;
      
      const updatedOrder = await gmaoStorage.updatePurchaseOrder(purchaseOrderId, {
        validationStatus: "printed",
        printedBy: printedBy || 1, // Service Achat user ID
        printedAt: printedAt ? new Date(printedAt) : new Date()
      });
      
      res.json({
        success: true,
        message: "Bon de commande marqué comme imprimé",
        purchaseOrder: updatedOrder
      });
    } catch (error) {
      console.error("Error marking purchase order as printed:", error);
      res.status(500).json({ message: "Failed to mark purchase order as printed" });
    }
  });

  // Add supporting documents to purchase order
  app.post("/api/purchase-orders/:id/documents", async (req, res) => {
    try {
      const purchaseOrderId = parseInt(req.params.id);
      const { documents } = req.body;
      
      const updatedOrder = await gmaoStorage.updatePurchaseOrder(purchaseOrderId, {
        documentsJustificatifs: documents
      });
      
      res.json({
        success: true,
        message: "Documents justificatifs ajoutés",
        purchaseOrder: updatedOrder
      });
    } catch (error) {
      console.error("Error adding documents to purchase order:", error);
      res.status(500).json({ message: "Failed to add documents to purchase order" });
    }
  });

  // Download purchase order as PDF — real data from DB
  app.get("/api/purchase-orders/:id/pdf", async (req, res) => {
    try {
      const purchaseOrderId = parseInt(req.params.id);

      const order = await gmaoStorage.getPurchaseOrderById(purchaseOrderId);
      if (!order) {
        return res.status(404).json({ message: "Bon de commande introuvable" });
      }

      const items = await gmaoStorage.getPurchaseOrderItems(purchaseOrderId);
      const enrichedOrder = {
        ...order,
        items: items.map(i => ({
          partNumber: i.partNumber || `ITEM-${i.id}`,
          description: i.description || "—",
          quantity: i.quantity ?? 0,
          unitPrice: parseFloat(i.unitPrice?.toString() ?? "0"),
        })),
      };

      const { generatePurchaseOrderPDF } = await import('../server/pdf-generator-pdfkit');
      const companyConfig = await gmaoStorage.getCompanyConfig();
      const pdfDoc = generatePurchaseOrderPDF(enrichedOrder, companyConfig || undefined);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="bon_commande_${order.orderNumber}.pdf"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Impossible de générer le PDF du bon de commande" });
    }
  });

  // ============= VALIDATION DEMO ROUTES =============
  
  // Create sample validation data for testing
  app.post("/api/create-validation-demo", async (req, res) => {
    try {
      const result = await createValidationDemo();
      res.json(result);
    } catch (error) {
      console.error("Error creating validation demo:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erreur lors de la création des données de démonstration",
        error: error.message 
      });
    }
  });


  console.log("✅ GMAO routes registered successfully");
}