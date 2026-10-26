import type { Express } from "express";
import { auMoins } from "@shared/roles";
import { notifyTaskAssigned } from "./push-notification-service";
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
  createCounterFromPlanSchema,
  companyConfigPayloadSchema
} from "@shared/schema";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { purchaseOrders } from "@shared/schema";
import { estViolationUnicite } from "./db-errors";
import { tenantRequis } from "./tenant-requis";
import {
  arreterEquipementPourIntervention,
  cloturerOrdreTravail,
  lirePiecesDeclarees,
  planIdValide,
  StockInsuffisant,
} from "./cloture-ordre-travail";
import { PieceIntrouvable } from "./stock-management";

/**
 * Une grandeur stockée en texte, relue comme nombre — ou `undefined`.
 *
 * ⚠️ Le code faisait `parseFloat(x?.toString() ?? "0")` : une valeur
 * délibérément absente redevenait zéro. Pour un MTBF, zéro se lit « tombe en
 * panne en permanence » ; pour une disponibilité, « jamais disponible ».
 * L'absence doit traverser.
 */
function nombreOuNull(valeur: unknown): number | undefined {
  if (valeur === null || valeur === undefined || valeur === "") return undefined;
  const n = Number(valeur);
  return Number.isFinite(n) ? n : undefined;
}


// Helper: reject if no authenticated tenantId (never default to 'default-tenant' for mutations)
function requireTenant(req: any, res: any): string | null {
  const tenantId = req.tenantId as string | undefined;
  if (!tenantId) {
    res.status(401).json({ error: "TENANT_REQUIRED", message: "Tenant context missing — re-authenticate" });
    return null;
  }
  return tenantId;
}

/**
 * Le rôle de l'appelant atteint-il le niveau demandé ?
 *
 * ⚠️ Remplace un `hasRole(req, ...roles)` qui comparait LITTÉRALEMENT la valeur
 * de `req.user.role` à une liste écrite à la main —
 * `'admin', 'director', 'technical_director', 'owner'`. Deux conséquences
 * mesurées sur la grappe de test :
 *
 *   • `director` n'existe dans AUCUN référentiel de rôles, et était pourtant
 *     accepté : un rôle inconnu du système obtenait le droit de supprimer ;
 *   • les orthographes déjà présentes en base (`directeur_technique`,
 *     `administrateur`, `proprietaire`) étaient refusées, alors qu'elles
 *     désignent des rôles autorisés — un refus d'accès inexplicable.
 *
 * `auMoins` normalise les deux côtés avant de comparer, et raisonne par niveau
 * plutôt que par énumération : `owner` (7) et `admin` (6) sont au-dessus de
 * `technical_director` (5), donc autorisés sans être nommés.
 */
function auMoinsNiveau(req: any, minimum: Parameters<typeof auMoins>[1]): boolean {
  return auMoins(req.user?.role, minimum);
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
      // L'absence traverse : une grandeur non calculable ne devient pas zéro.
      availability: nombreOuNull(report.equipmentAvailability),
      mtbf: nombreOuNull(report.mtbf),
      mttr: nombreOuNull(report.mttr),
    },
  };
}

export function registerGMAORoutes(app: Express) {
  
  // ============= EQUIPMENT REGISTRY ROUTES =============
  
  // Get all equipment
  app.get("/api/equipment", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const equipment = await gmaoStorage.getEquipmentRegistry(tenantId);
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Search equipment
  app.get("/api/equipment/search", async (req, res) => {
    try {
      const { equipmentType, zone, sector } = req.query;
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const equipment = await gmaoStorage.searchEquipment(tenantId, {
        equipmentType: equipmentType as string,
        zone: zone as string,
        sector: sector as string
      });
      res.json(equipment);
    } catch (error) {
      console.error("Error searching equipment:", error);
      res.status(500).json({ message: "Failed to search equipment" });
    }
  });

  // Get equipment by ID
  app.get("/api/equipment/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid equipment ID" });
      }
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
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

      // 🔑 F10 — Collision détectée par la BASE, pas par la vérification préalable.
      //
      // Le contrôle d'unicité ci-dessus lit puis écrit : entre les deux, une
      // requête concurrente peut insérer le même identifiant. Les deux appels
      // passent alors le contrôle, et c'est l'index unique
      // `equipment_registry_equipment_id_unique` qui tranche — code PostgreSQL
      // 23505.
      //
      // Sans ce traitement, deux testeurs créant le même équipement au même
      // instant recevaient « Failed to create equipment », message qui
      // n'indique ni la cause ni la conduite à tenir — alors que le même
      // conflit, en séquentiel, produisait un message actionnable. On rend les
      // deux chemins cohérents.
      // ⚠️ Depuis drizzle-orm 0.44, l'erreur du pilote est encapsulée dans un
      // `DrizzleQueryError` : le code SQLSTATE n'est plus sur `error.code` mais
      // sur `.cause`. Lire `error.code` seul faisait silencieusement retomber ce
      // conflit dans le message générique. Voir server/db-errors.ts.
      if (estViolationUnicite(error)) {
        return res.status(400).json({
          message: "Cet ID d'équipement existe déjà. Veuillez en choisir un autre ou laissez le champ vide pour une génération automatique.",
          field: "equipmentId"
        });
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
      
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
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

  // ============= WORK ORDERS ROUTES =============
  
  // Get all work orders
  app.get("/api/work-orders", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
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
      // ═══════════════════════════════════════════════════════════════
      // CRÉER UN ORDRE DE TRAVAIL ENGAGE LA PLANIFICATION ET LE BUDGET
      // ═══════════════════════════════════════════════════════════════
      //
      // L'audit du 2026-10-25 (section 1) relevait, comme première conséquence
      // de l'absence de demande d'intervention : « n'importe qui doit créer
      // directement un OT, c'est-à-dire engager la planification et le
      // budget ». Cette route n'avait AUCUN contrôle de rôle.
      //
      // Le niveau est celui de l'ARBITRAGE d'une demande (`team_leader`), et
      // ce n'est pas un choix de confort : si créer un ordre directement était
      // plus permissif qu'arbitrer une demande, la séparation DI / OT serait
      // contournable par la porte d'à côté — il suffirait de créer l'ordre au
      // lieu de faire arbitrer le signalement. Les deux gestes engagent la
      // même chose, ils exigent donc le même niveau.
      //
      // CE QUI RESTE OUVERT À TOUS, et c'est le point : SIGNALER. Un opérateur
      // qui constate une fuite n'est pas bloqué, il est redirigé vers le geste
      // qui lui revient. Le message le dit, parce qu'un refus qui ne nomme pas
      // l'alternative ne fait qu'empêcher le travail.
      //
      // Les créations AUTOMATIQUES ne passent pas par ici et ne sont donc pas
      // concernées : l'acceptation d'une demande, le franchissement d'un seuil
      // de compteur, le moteur prédictif et le jumeau numérique écrivent par
      // la couche de stockage.
      if (!auMoinsNiveau(req, 'team_leader')) {
        return res.status(403).json({
          error: "FORBIDDEN",
          message:
            "Créer un ordre de travail engage la planification et le budget, et demande au moins " +
            "un chef d'équipe. Pour signaler un constat, créez une demande d'intervention : " +
            "la maintenance l'arbitrera.",
          alternative: "/api/demandes-intervention",
        });
      }

      // Handle case where body might be malformed
      if (!req.body || typeof req.body !== 'object') {
        console.error("Invalid request body format:", req.body);
        return res.status(400).json({ message: "Invalid request body format" });
      }

      // Transform and clean the data before validation
      const cleanedData: any = {};
      
      // Équipement : privilégier un equipmentId réel envoyé par un sélecteur,
      // sinon retomber sur l'ancien comportement find-or-create par nom (compatibilité).
      let equipmentId = null;
      if (req.body.equipmentId) {
        equipmentId = parseInt(req.body.equipmentId, 10);
      } else if (req.body.equipmentName) {
        // Try to find existing equipment by name
        const tenantId = tenantRequis(req as any, res as any);
        if (!tenantId) return;
        const existingEquipment = await gmaoStorage.searchEquipment(tenantId, { equipmentName: req.body.equipmentName });
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
      if (req.body.assignedTo && !isNaN(parseInt(req.body.assignedTo, 10))) {
        cleanedData.assignedTo = parseInt(req.body.assignedTo, 10);
      }
      if (req.body.estimatedHours) cleanedData.estimatedDuration = parseInt(req.body.estimatedHours) * 60; // Convert to minutes
      if (req.body.dueDate) cleanedData.scheduledStart = req.body.dueDate; // Keep as string for validation
      if (req.body.cost) cleanedData.cost = parseFloat(req.body.cost);
      if (req.body.notes) cleanedData.notes = req.body.notes;
      if (req.body.requiresShutdown !== undefined) {
        cleanedData.requiresShutdown = req.body.requiresShutdown === true || req.body.requiresShutdown === 'true';
      }

      // Add tenantId BEFORE validation
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      cleanedData.tenantId = tenantId;

      // Rattachement au plan préventif : vérifié CONTRE LE LOCATAIRE avant
      // d'être écrit. C'est ce lien, absent jusqu'ici, qui permet à la clôture
      // de savoir quel plan replanifier — et c'est aussi par lui qu'un plan
      // d'une autre organisation pourrait se faire replanifier, si on se
      // contentait de la clé étrangère.
      if (req.body.planId !== undefined && req.body.planId !== null && req.body.planId !== '') {
        cleanedData.planId = await planIdValide(req.body.planId, tenantId);
      }

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

      // Un ordre créé DÉJÀ en cours et avec arrêt machine consigne tout de
      // suite l'équipement : sans cela, le cas « je saisis l'intervention que
      // je suis en train de faire » laisserait la machine déclarée en service
      // pendant qu'elle est consignée, et la clôture n'aurait rien à remettre.
      if (workOrder.status === 'in_progress' && workOrder.requiresShutdown && workOrder.equipmentId != null) {
        await arreterEquipementPourIntervention(workOrder.equipmentId, tenantId);
      }

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

      // Traduction des noms de champs utilisés par le formulaire web (mêmes alias que POST /api/work-orders)
      // vers les vraies colonnes de work_orders, avant tout traitement.
      const processedUpdates: any = { ...updates };
      if (processedUpdates.category !== undefined) {
        processedUpdates.orderType = processedUpdates.category === 'Préventif' ? 'preventive' : 'corrective';
        delete processedUpdates.category;
      }
      if (processedUpdates.estimatedHours !== undefined) {
        processedUpdates.estimatedDuration = Math.round(parseFloat(processedUpdates.estimatedHours) * 60);
        delete processedUpdates.estimatedHours;
      }
      if (processedUpdates.dueDate !== undefined) {
        processedUpdates.scheduledStart = processedUpdates.dueDate;
        delete processedUpdates.dueDate;
      }
      if (processedUpdates.equipmentId !== undefined && processedUpdates.equipmentId !== null) {
        processedUpdates.equipmentId = parseInt(processedUpdates.equipmentId, 10);
      }
      if (processedUpdates.assignedTo !== undefined) {
        processedUpdates.assignedTo = processedUpdates.assignedTo === "" || processedUpdates.assignedTo === null
          ? null
          : parseInt(processedUpdates.assignedTo, 10);
      }
      // `requires_shutdown` est NOT NULL : une case de formulaire envoyée en
      // `"false"` (chaîne) serait vraie pour Drizzle, et consignerait une
      // machine qu'on venait de déclarer non consignée.
      if (processedUpdates.requiresShutdown !== undefined) {
        processedUpdates.requiresShutdown =
          processedUpdates.requiresShutdown === true || processedUpdates.requiresShutdown === 'true';
      }

      // Convert date strings to Date objects for timestamp fields
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
      
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;

      // Un `planId` qui arrive par la requête est vérifié ici, et pas au
      // moment de l'écriture : la clé étrangère garantit que le plan existe,
      // pas qu'il appartient au demandeur. Rattacher un ordre au plan d'une
      // autre organisation ferait avancer l'échéance de ce plan-là à la
      // clôture (voir planIdValide).
      if (processedUpdates.planId !== undefined) {
        processedUpdates.planId = await planIdValide(processedUpdates.planId, tenantId);
      }

      // Les pièces consommées ne sont PAS une colonne de `work_orders` : on les
      // retire des champs à écrire avant toute mise à jour, sans quoi Drizzle
      // recevrait une clé inconnue.
      const piecesDeclarees = lirePiecesDeclarees(req.body);
      delete processedUpdates.partsUsed;

      const prevWorkOrder = await gmaoStorage.getWorkOrderById(id, tenantId);

      // ── LA CLÔTURE EST UN CHEMIN À PART, ET TRANSACTIONNEL ──────────
      //
      // Elle écrit dans cinq tables (`work_orders`, `stock_movements`,
      // `spare_parts`, `preventive_maintenance_plans`, `equipment_registry`)
      // et ces écritures doivent être vraies ensemble. Avant ce correctif, la
      // clôture ne déclenchait qu'une génération de rapport non enregistrée :
      // mesuré en base, HTTP 200 et absolument rien d'écrit.
      //
      // La condition porte sur la TRANSITION, pas sur le statut demandé : une
      // requête qui repasse `completed` sur un ordre déjà clôturé ne doit pas
      // reconsommer les pièces ni réavancer le plan. `cloturerOrdreTravail`
      // s'en protège aussi de son côté, sous verrou, pour le cas concurrent.
      let workOrder: Awaited<ReturnType<typeof gmaoStorage.updateWorkOrder>>;
      if (processedUpdates.status === 'completed' && prevWorkOrder && prevWorkOrder.status !== 'completed') {
        const bilan = await cloturerOrdreTravail({
          id,
          tenantId,
          modifications: processedUpdates,
          pieces: piecesDeclarees,
          // L'auteur vient de la SESSION, jamais du corps de requête : un
          // mouvement de stock signé d'un identifiant fourni par le client
          // imputerait la sortie à n'importe qui.
          performedBy: (req as any).user?.id ?? null,
        });
        workOrder = bilan.ordre;
        console.log(
          `OT ${workOrder.orderNumber} clôturé — ${bilan.piecesConsommees.length} référence(s) consommée(s)` +
          (bilan.replanification
            ? bilan.replanification.nextDue
              ? `, plan #${bilan.replanification.plan} replanifié au ${bilan.replanification.nextDue.toISOString().slice(0, 10)}`
              : `, plan #${bilan.replanification.plan} non replanifié (${bilan.replanification.motif})`
            : '') +
          (bilan.compteursReinitialises.length > 0
            ? `, ${bilan.compteursReinitialises.length} compteur(s) remis à zéro`
            : '') +
          (bilan.equipementRemisEnService ? ', équipement remis en service' : ''),
        );
      } else {
        workOrder = await gmaoStorage.updateWorkOrder(id, tenantId, processedUpdates);

        // Symétrique de la remise en service : une intervention AVEC ARRÊT qui
        // démarre consigne la machine. Sans cette bascule, la remise en
        // service de la clôture n'aurait jamais rien à remettre — et
        // `operationalState` resterait ce qu'il était : une colonne que le
        // serveur n'écrivait qu'à l'import.
        if (
          processedUpdates.status === 'in_progress' &&
          prevWorkOrder?.status !== 'in_progress' &&
          workOrder.requiresShutdown &&
          workOrder.equipmentId != null
        ) {
          await arreterEquipementPourIntervention(workOrder.equipmentId, tenantId);
        }
      }

      // 📱 PUSH: Notify technician when task is newly assigned
      if (
        workOrder &&
        processedUpdates.assignedTo &&
        processedUpdates.assignedTo !== prevWorkOrder?.assignedTo
      ) {
        try {
          const equipment = workOrder.equipmentId
            ? await gmaoStorage.getEquipmentById(workOrder.equipmentId, tenantId)
            : null;
          notifyTaskAssigned(processedUpdates.assignedTo, workOrder, equipment).catch(() => {});
        } catch {}
      }

      // 🔄 CCTP AUTO-GENERATION: Déclencher génération automatique de rapport si OT terminé
      if (processedUpdates.status === 'completed' && workOrder) {
        try {
          console.log(`🎯 OT ${workOrder.orderNumber} terminé - tentative auto-génération rapport`);

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
      // ── STOCK INSUFFISANT : 409, ET LA LISTE DES MANQUES ───────────
      //
      // 409 Conflict et non 400 : la requête est bien formée, c'est l'ÉTAT du
      // magasin qui la contredit. La distinction compte pour l'interface — un
      // 400 se lit « vous avez mal saisi », un 409 « régularisez le magasin
      // puis recommencez ». Les manques sont rendus en structure, référence
      // par référence, pour que le magasinier sache quoi ajuster sans avoir à
      // relire un message.
      //
      // La transaction a été annulée : l'ordre de travail est TOUJOURS
      // ouvert, aucun mouvement n'a été écrit, le plan n'a pas bougé.
      if (error instanceof StockInsuffisant) {
        return res.status(409).json({
          error: "STOCK_INSUFFISANT",
          message: "Clôture refusée : le stock déclaré n'est pas disponible. " +
            "Régularisez l'inventaire (entrée ou ajustement de stock) puis clôturez à nouveau.",
          manques: error.manques,
        });
      }
      // Une pièce hors du périmètre du demandeur est, pour lui, un objet
      // absent : 404, pas 500 — convention du dépôt, voir PieceIntrouvable.
      if (error instanceof PieceIntrouvable) {
        return res.status(404).json({ error: "PIECE_INTROUVABLE", message: error.message });
      }
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
      if (!auMoinsNiveau(req, 'technical_director')) {
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const data = insertPreventiveMaintenancePlanSchema.parse(req.body);
      const planData = { ...data, tenantId };
      
      // Créer le plan de maintenance
      const plan = await gmaoStorage.createPreventiveMaintenancePlan(planData);
      
      // Si un compteur est configuré, le créer aussi
      if (req.body.counter && req.body.counter.counterType) {
        try {
          // Valider les données du compteur avec Zod
          const validatedCounter = createCounterFromPlanSchema.parse(req.body.counter);
          const counterEquipment = await gmaoStorage.getEquipmentById(validatedCounter.equipmentId, tenantId);

          const counterData = {
            tenantId,
            equipmentId: validatedCounter.equipmentId,
            equipmentName: validatedCounter.equipmentName || counterEquipment?.equipmentName,
            counterType: validatedCounter.counterType,
            currentValue: validatedCounter.currentValue,
            description: validatedCounter.counterName || validatedCounter.description,
            maintenanceType: planData.equipmentType || "Maintenance préventive",
            thresholdValue: validatedCounter.thresholdCritical,
            warningThresholdPct: validatedCounter.thresholdCritical > 0
              ? (validatedCounter.thresholdWarning / validatedCounter.thresholdCritical) * 100
              : 90,
            // ⚠️ LE RATTACHEMENT AU PLAN MANQUAIT, et c'était l'autre moitié de
            // l'obstacle relevé par l'audit du 2026-10-25.
            //
            // `maintenance_counters.plan_id` existait dans le schéma mais
            // n'était écrit NULLE PART — y compris ici, le seul endroit du
            // dépôt où un compteur naît d'un plan. Mesuré : zéro écriture,
            // zéro lecture, colonne morte. Un compteur créé depuis un plan
            // était donc orphelin dès sa naissance, et la clôture de l'ordre
            // qui exécute ce plan n'avait aucun moyen de savoir quel compteur
            // remettre à zéro.
            //
            // C'est ce lien qui ferme la boucle « OT préventif clôturé →
            // compteur remis à zéro » (voir server/cloture-ordre-travail.ts).
            planId: plan.id,
            isActive: true
          };

          console.log("Creating validated counter:", counterData);
          const newCounter = await gmaoStorage.createMaintenanceCounter(counterData);

          // Générer une alerte immédiate si la valeur actuelle dépasse déjà les
          // seuils — et l'ordre de travail préventif qui va avec, puisque le
          // compteur vient d'être rattaché au plan qu'on est en train de créer.
          if (validatedCounter.currentValue >= validatedCounter.thresholdCritical ||
              validatedCounter.currentValue >= validatedCounter.thresholdWarning) {
            await gmaoStorage.traiterEcheanceCompteur(newCounter);
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
      
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
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
      if (!auMoinsNiveau(req, 'technical_director')) {
        return res.status(403).json({ error: "FORBIDDEN", message: "Droits insuffisants pour supprimer un plan de maintenance" });
      }
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const id = parseInt(req.params.id);
      // Même contrat que les deux autres suppressions du module : on ne
      // confirme que ce qui a réellement été supprimé.
      const supprime = await gmaoStorage.deletePreventiveMaintenancePlan(id, tenantId);
      if (!supprime) {
        return res.status(404).json({ message: "Plan de maintenance non trouvé" });
      }
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const parts = await gmaoStorage.getSpareParts(tenantId);
      res.json(parts);
    } catch (error) {
      console.error("Error fetching spare parts:", error);
      res.status(500).json({ message: "Failed to fetch spare parts" });
    }
  });

  // Get low stock parts
  app.get("/api/spare-parts/low-stock", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const parts = await gmaoStorage.getLowStockParts(tenantId);
      res.json(parts);
    } catch (error) {
      console.error("Error fetching low stock parts:", error);
      res.status(500).json({ message: "Failed to fetch low stock parts" });
    }
  });

  // Get spare part by ID
  app.get("/api/spare-parts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const part = await gmaoStorage.getSparePartById(id, tenantId);
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const dataToValidate = { ...req.body, tenantId };
      
      const data = insertSparePartSchema.parse(dataToValidate);
      
      // Générer un numéro de pièce unique si conflit détecté
      let uniquePartNumber = data.partNumber;
      let counter = 1;
      
      // Vérifier si le numéro existe déjà
      while (true) {
        try {
          const existing = await gmaoStorage.getSparePartByPartNumber(uniquePartNumber, tenantId);
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const part = await gmaoStorage.updateSparePart(id, tenantId, updates);
      res.json(part);
    } catch (error) {
      console.error("Error updating spare part:", error);
      res.status(400).json({ message: "Failed to update spare part" });
    }
  });

  // Delete spare part — restricted to admin/director + tenant check
  app.delete("/api/spare-parts/:id", async (req, res) => {
    try {
      if (!auMoinsNiveau(req, 'technical_director')) {
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const data = insertStockMovementSchema.parse(req.body);
      const movement = await gmaoStorage.createStockMovement(data, tenantId);
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
  //
  // ⚠️ Appelée sans `equipmentId` — ce que fait l'écran quand il veut « tous les
  // relevés » — cette route rendait les capteurs de TOUTE l'instance : la
  // méthode de stockage n'avait alors plus aucune condition à poser.
  app.get("/api/iot-data", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const { equipmentId, sensorType, limit } = req.query;
      const data = await gmaoStorage.getIotSensorData(
        tenantId,
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      // Le locataire vient de la session et est posé APRÈS l'analyse du corps :
      // un client qui enverrait `tenantId` ne peut pas écrire chez autrui.
      const data = insertIotSensorDataSchema.parse({ ...req.body, tenantId });
      const sensorData = await gmaoStorage.createIotSensorData({ ...data, tenantId });
      res.status(201).json(sensorData);
    } catch (error) {
      console.error("Error creating IoT data:", error);
      res.status(400).json({ message: "Failed to create IoT data" });
    }
  });

  // Get latest sensor data for equipment
  // L'identifiant d'équipement vient de l'URL : sans condition de locataire,
  // lire les capteurs d'autrui ne demandait que d'en deviner le numéro.
  app.get("/api/equipment/:equipmentId/sensor-data", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const equipmentId = parseInt(req.params.equipmentId);
      const data = await gmaoStorage.getLatestSensorData(equipmentId, tenantId);
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const result = await gmaoStorage.seedPredictiveInsightsDemoData(tenantId);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error seeding demo data:", error);
      res.status(500).json({ message: "Failed to seed demo data" });
    }
  });

  app.get("/api/predictive-insights", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const data = insertAlertsNotificationsSchema.parse(req.body);
      // Le locataire est posé APRÈS l'analyse du corps, donc il l'écrase :
      // c'est la session qui dit à qui appartient l'alerte, jamais le client.
      // Auparavant le corps fournissait `tenantId` et rien ne le contrôlait —
      // on pouvait écrire une alerte au nom d'une autre organisation. La
      // vérification que l'équipement visé est bien le sien est faite par
      // createAlert, qui est le passage unique.
      const alert = await gmaoStorage.createAlert({ ...data, tenantId });
      res.status(201).json(alert);
    } catch (error) {
      console.error("Error creating alert:", error);
      // Un refus de cloisonnement n'est pas une requête malformée : il est
      // rendu tel quel, pour qu'un appelant légitime comprenne ce qu'on lui
      // reproche au lieu de lire « Failed to create alert ».
      const message = error instanceof Error && /^ALERTE_/.test(error.message)
        ? error.message
        : "Failed to create alert";
      res.status(400).json({ message });
    }
  });

  // Update alert
  app.put("/api/alerts/:id", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const id = parseInt(req.params.id);
      const updates = req.body;
      const alert = await gmaoStorage.updateAlert(id, tenantId, updates);
      // Sans correspondance, l'alerte existe peut-être — mais pas pour ce
      // locataire. On rend 404 et non 403 : dire « interdit » confirmerait
      // l'existence de l'alerte d'autrui, ce qui est déjà une information.
      if (!alert) {
        return res.status(404).json({ message: "Alerte introuvable" });
      }
      res.json(alert);
    } catch (error) {
      console.error("Error updating alert:", error);
      res.status(400).json({ message: "Failed to update alert" });
    }
  });

  // Get alerts by equipment
  app.get("/api/equipment/:equipmentId/alerts", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const equipmentId = parseInt(req.params.equipmentId);
      const alerts = await gmaoStorage.getAlertsByEquipment(equipmentId, tenantId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // ============= INTEGRATION ROUTES =============

  // GET /api/integration-logs est géré par advanced-integrations-routes.ts (isolation par
  // tenant + filtres sourceSystem/entityType/status — cette version-ci n'en avait aucun).

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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const userRole = (req as any).user?.role || 'technician';

      // Run KPI counts and recent rows in parallel — no full-table scans
      const [kpis, contexte, evolution, indicateurs, activeWorkOrders, pendingWorkOrders, recentAlerts, equipmentList] = await Promise.all([
        gmaoStorage.getDashboardKPIs(tenantId),
        gmaoStorage.getDashboardContexte(tenantId),
        // Activité réelle des douze derniers mois. Les graphiques du tableau de
        // bord affichaient jusqu'ici des constantes inventées.
        gmaoStorage.getEvolutionMensuelle(tenantId, 12),
        gmaoStorage.getIndicateursReels(tenantId),
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
        // Ce qui donne du sens aux chiffres : indisponibilites, retards, echeances.
        // Voir gmaoStorage.getDashboardContexte.
        contexte,
        evolution,
        indicateurs,
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
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
  // POST /api/suppliers et GET /api/suppliers sont gérés par supplier-routes.ts
  // (registerSupplierRoutes, enregistré avant ce fichier — table réelle, authentifié).
  // POST /api/purchase-orders/document-type : voir la version basée sur la config
  // entreprise (gmaoStorage.getCompanyConfig()) plus bas dans ce fichier.

  app.post("/api/purchase-orders", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;

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

      // Le propriétaire du bon vient de la SESSION. Cette route le créait sans
      // aucun locataire : la ligne naissait orpheline, donc lisible et
      // approuvable par tout le monde (migration 0023).
      const order = await gmaoStorage.createPurchaseOrder(tenantId, orderData);
      res.status(201).json({
        success: true,
        message: `${documentType === "purchase_order" ? "Bon de commande" : "Lettre de commande"} créé avec succès`,
        order
      });
    } catch (error: any) {
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

  // Trigger automatic reorder check — real stock levels, real purchase orders
  app.post("/api/trigger-reorder-check", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const { triggeredRules, createdOrders } = await gmaoStorage.checkStockLevelsAndTriggerReorders(tenantId);
      const totalAmount = createdOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || "0"), 0);
      res.json({
        success: true,
        message: "Vérification automatique terminée avec succès",
        triggeredRules: triggeredRules.length,
        createdOrders: createdOrders.length,
        totalAmount,
        orders: createdOrders,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error triggering reorder check:", error);
      res.status(500).json({ success: false, message: "Échec de la vérification automatique" });
    }
  });

  // Get parts needing reorder — real stock levels from DB
  app.get("/api/parts-needing-reorder", async (req, res) => {
    try {
      const parts = await gmaoStorage.getPartsNeedingReorder();
      res.json(parts);
    } catch (error) {
      console.error("Error fetching parts needing reorder:", error);
      res.status(500).json({ message: "Failed to fetch parts needing reorder" });
    }
  });

  // Get purchase orders — real data from DB
  app.get("/api/purchase-orders", async (req, res) => {
    try {
      // Rendait les bons de commande de toute l'instance — montants,
      // fournisseurs et demandeurs compris.
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;

      const orders = await gmaoStorage.getPurchaseOrders(tenantId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
  });

  // ============= MAINTENANCE REPORTS ROUTES =============

  // Generate maintenance report
  app.post("/api/maintenance-reports", async (req, res) => {
    try {
      const { workOrderId, ...reportData } = req.body;
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const report = await gmaoStorage.generateMaintenanceReport(workOrderId, tenantId, reportData);
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;

      // Le locataire était déjà exigé ici, mais seulement pour enrichir le PDF
      // : la lecture du rapport lui-même l'ignorait. On le lui passe.
      const report = await gmaoStorage.getMaintenanceReportById(reportId, tenantId);
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
  //
  // ⚠️ Cette route n'exigeait AUCUN locataire et n'en transmettait aucun : elle
  // renvoyait les rapports de toute l'instance au composant
  // client/src/components/maintenance-reports.tsx, qui les affiche tels quels
  // (technicien, description de l'intervention, coût total). C'était la fuite
  // la plus directe des cinq, et la seule visible à l'œil nu dans l'écran.
  app.get("/api/maintenance-reports", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const { reportType, status, equipmentId } = req.query;
      const reports = await gmaoStorage.getMaintenanceReports(tenantId, {
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const report = await gmaoStorage.generateMonthlyReport(month, year, tenantId, generatedBy);
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
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;

      const report = await gmaoStorage.getMonthlyReportById(reportId, tenantId);
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
  //
  // ⚠️ Même absence de contrôle que sur /api/maintenance-reports, pour des
  // données plus condensées encore : chaque ligne porte les coûts de
  // maintenance AGRÉGÉS d'un mois. L'écran les affiche en évidence
  // (« Coût total », « Main d'œuvre », « Pièces », « Coût / intervention »).
  app.get("/api/monthly-reports", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const reports = await gmaoStorage.getMonthlyReports(tenantId, year);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching monthly reports:", error);
      res.status(500).json({ message: "Impossible de charger les rapports mensuels" });
    }
  });



  // ============= COMPANY CONFIGURATION ROUTES =============
  //
  // Ces routes lisaient et écrivaient UNE SEULE ligne pour toute l'instance :
  // la raison sociale, l'adresse, le numéro fiscal, le logo et les seuils
  // d'approbation étaient communs à tous les locataires, et le dernier à
  // enregistrer effaçait la configuration de tous les autres. Voir
  // shared/schema.ts (table `companyConfig`) et
  // migrations/0022_company_config_tenant_scoped.sql.

  // Get company configuration
  app.get("/api/company-config", async (req, res) => {
    try {
      const tenantId = tenantRequis(req, res);
      if (!tenantId) return;

      const config = await gmaoStorage.getCompanyConfig(tenantId);
      if (!config) {
        // Gabarit de départ pour un locataire qui n'a encore rien enregistré.
        // ⚠️ Il ne doit JAMAIS retomber sur la configuration d'un autre : un
        // locataire neuf voit des champs vides et les remplit, il ne reprend
        // pas l'identité commerciale du voisin.
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
      // ⚠️ Les seuils vivent dans `company_config`. Tant que cette table était
      // commune, un locataire qui modifiait son seuil déplaçait celui de tout
      // le monde : le montant au-delà duquel une dépense exige une validation
      // renforcée changeait chez les autres, sans qu'ils en sachent rien.
      const tenantId = tenantRequis(req, res);
      if (!tenantId) return;

      const { amount } = req.body;

      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ message: "Montant invalide" });
      }

      const config = await gmaoStorage.getCompanyConfig(tenantId);
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
      // ⚠️ AUCUN CONTRÔLE DE RÔLE n'existait ici. N'importe quel compte
      // authentifié — un technicien, un lecteur — pouvait réécrire la raison
      // sociale, l'adresse et le numéro fiscal portés par les bons de commande,
      // et déplacer le seuil au-delà duquel une dépense exige une validation.
      // Le second point est le plus grave : relever le seuil désarme le contrôle
      // d'engagement, sans laisser de trace ailleurs que dans cette ligne.
      //
      // `technical_director` est le niveau retenu parce qu'il désigne EXACTEMENT
      // les rôles auxquels server/rbac-permissions.ts accorde `manage_settings`
      // (technical_director 5, admin 6, owner 7) : les deux référentiels disent
      // donc la même chose. `auMoins` est préféré à une liste littérale pour la
      // raison documentée en tête de ce fichier — `owner` est au-dessus et
      // n'a pas à être nommé, et les orthographes déjà en base sont rattrapées.
      if (!auMoinsNiveau(req, 'technical_director')) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Droits insuffisants pour modifier la configuration de l'entreprise",
        });
      }

      const tenantId = tenantRequis(req, res);
      if (!tenantId) return;

      // La charge est VALIDÉE puis réduite : ni `id`, ni `tenantId`, ni
      // `isActive` ne traversent. Sans cela, `{ "tenantId": "<autre
      // locataire>" }` posté par le client faisait déménager la ligne chez lui
      // (le `.set()` réécrivait la colonne même que le `WHERE` venait de
      // viser). Voir companyConfigPayloadSchema dans shared/schema.ts.
      const charge = companyConfigPayloadSchema.safeParse(req.body);
      if (!charge.success) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Configuration d'entreprise invalide",
          details: charge.error.errors,
        });
      }

      const existingConfig = await gmaoStorage.getCompanyConfig(tenantId);

      if (existingConfig) {
        const updatedConfig = await gmaoStorage.updateCompanyConfig(existingConfig.id, tenantId, charge.data);
        // `undefined` signifie que la ligne n'appartient pas à ce locataire —
        // impossible ici puisqu'on vient de la lire pour lui, mais le contrat de
        // la méthode le prévoit et un succès inventé serait pire qu'un 404.
        if (!updatedConfig) {
          return res.status(404).json({ success: false, message: "Configuration d'entreprise introuvable" });
        }
        res.json({
          success: true,
          message: "Configuration mise à jour avec succès",
          config: updatedConfig
        });
      } else {
        const newConfig = await gmaoStorage.createCompanyConfig(tenantId, charge.data);
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
      // DEUX défauts se rejoignaient sur cette route, trouvés séparément :
      //
      //   • l'EN-TÊTE du document était la ligne active commune à l'instance, et
      //     non celle du demandeur (migration 0022) : un engagement de dépense
      //     sortait sous la raison sociale, l'adresse et le numéro fiscal d'une
      //     autre entreprise ;
      //   • le BON DE COMMANDE lui-même se lisait sans locataire (migration
      //     0023) : un identifiant deviné suffisait à obtenir le PDF complet
      //     — montant, fournisseur, lignes commandées — du bon d'autrui.
      //
      // L'en-tête et la provenance sont désormais tous deux ceux de la session.
      const tenantId = tenantRequis(req, res);
      if (!tenantId) return;

      const purchaseOrderId = parseInt(req.params.id);

      const order = await gmaoStorage.getPurchaseOrderById(purchaseOrderId, tenantId);
      if (!order) {
        return res.status(404).json({ message: "Bon de commande introuvable" });
      }

      // Enrich with line items and resolved supplier name
      const items = await gmaoStorage.getPurchaseOrderItems(purchaseOrderId, tenantId);
      const supplier = order.supplierId ? await gmaoStorage.getSupplierById(order.supplierId) : undefined;
      const enrichedOrder = {
        ...order,
        description: order.notes || "",
        supplier: supplier?.companyName || "—",
        totalAmount: order.totalAmount ?? "0",
        currency: order.currency || "EUR",
        validationStatus: order.validationStatus || "pending",
        requestedBy: order.requestedBy || "—",
        createdAt: order.createdAt ?? undefined,
        items: items.map(i => ({
          partNumber: i.partNumber || `ITEM-${i.id}`,
          description: i.description || "—",
          quantity: i.quantity ?? 0,
          unitPrice: parseFloat(i.unitPrice?.toString() ?? "0"),
        })),
      };

      const { generatePurchaseOrderPDF } = await import('../server/pdf-generator-pdfkit');
      const companyConfig = await gmaoStorage.getCompanyConfig(tenantId);
      const pdfCompanyConfig = companyConfig ? {
        companyName: companyConfig.companyName,
        address: companyConfig.address || "",
        phone: companyConfig.phone || "",
        email: companyConfig.email || "",
        website: companyConfig.website || "",
        taxNumber: companyConfig.taxNumber || "",
        logoBase64: companyConfig.logoBase64 || undefined,
        primaryColor: companyConfig.primaryColor || undefined,
      } : undefined;
      const pdfDoc = generatePurchaseOrderPDF(enrichedOrder, pdfCompanyConfig);

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

  /**
   * Marquer un bon de commande comme imprimé — dernier geste du service achat.
   *
   * ═══════════════════════════════════════════════════════════════════
   * CE QUI ÉTAIT CASSÉ (mesuré le 2026-10-25)
   * ═══════════════════════════════════════════════════════════════════
   * La route lisait `printedBy` ET `printedAt` DANS LE CORPS : qui a imprimé,
   * et quand, étaient DÉCLARÉS par l'appelant. Même défaut de traçabilité que
   * celui fermé le même jour sur les validations, et aucun contrôle de droit.
   *
   * Mesuré depuis un simple technicien (`role = technician`, aucun droit sur
   * les achats), sur un bon de commande RÉEL de 87 000 € au statut `pending` :
   *
   *   • HTTP 200, et `printed_by = 1001` — le compte que le CORPS désignait,
   *     pas l'appelant (1002). Une impression inscrite au nom de quelqu'un
   *     d'autre : exactement la signature falsifiée du lot précédent ;
   *   • `printed_at` venait du corps : 2020-01-01, soit une impression datée
   *     six ans avant le geste ;
   *   • le bon portait `can_print = false` — il n'avait franchi AUCUN des
   *     trois niveaux — et passait pourtant à `validation_status = "printed"` ;
   *   • conséquence la plus grave : « printed » ne correspond à aucune étape du
   *     circuit (voir `niveauAttendu()`, server/simple-validation-routes.ts).
   *     Le validateur de niveau 1 qui tentait ensuite d'approuver ce marché
   *     recevait 409 CIRCUIT_CLOS. Tout compte authentifié pouvait donc
   *     NEUTRALISER l'approbation de n'importe quelle dépense, en une requête ;
   *   • et sur un identifiant inexistant (999999), la route répondait 200
   *     « marqué comme imprimé » : `updatePurchaseOrder` ne touchait aucune
   *     ligne et rendait `undefined`, sans que personne le regarde.
   *
   * ═══════════════════════════════════════════════════════════════════
   * CE QUI LA GARDE MAINTENANT
   * ═══════════════════════════════════════════════════════════════════
   * L'auteur vient de la SESSION, la date de l'HORLOGE SERVEUR, et le corps de
   * la requête n'est plus lu du tout. S'y ajoutent l'habilitation d'achat de
   * l'appelant (`canValidatePurchaseOrders`, le drapeau que le circuit de
   * validation oppose déjà aux bons de commande), l'exigence que le bon ait
   * RÉELLEMENT franchi les trois niveaux (`can_print`, que seule la validation
   * finale pose), et le refus de réécrire une impression déjà inscrite : la
   * première trace est celle qui compte, et le document reste téléchargeable
   * autant de fois qu'il le faut (`GET /api/purchase-orders/:id/pdf`).
   *
   * Ces deux dernières conditions partent aussi dans le `WHERE` de l'UPDATE, et
   * pas seulement dans les gardes ci-dessus : deux agents du service achat qui
   * cliquent en même temps ne peuvent pas inscrire deux impressions (zéro ligne
   * touchée → 409), et c'est la première qui reste.
   *
   * Le locataire de la session CLOISONNE réellement, depuis la migration
   * `0022_purchase_orders_tenant_scoped.sql` : il est porté par la lecture du
   * bon ET par le `WHERE` de l'UPDATE. Jusqu'à cette migration, l'exiger ne
   * servait qu'à éviter une route de plus à reprendre — `purchase_orders` ne
   * portait aucune colonne `tenant_id`, et un service achat habilité pouvait
   * marquer imprimé le bon d'une autre organisation.
   */
  app.post("/api/purchase-orders/:id/mark-printed", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;

      const compte = (req as any).user;
      if (!compte?.id) {
        return res.status(401).json({
          error: "AUTHENTIFICATION_REQUISE",
          message: "Aucun compte en session : une impression exige une identité.",
        });
      }

      if (compte.canValidatePurchaseOrders !== true) {
        return res.status(403).json({
          error: "IMPRESSION_NON_HABILITEE",
          message: "Votre compte ne porte pas le droit d'agir sur les bons de commande.",
        });
      }

      const purchaseOrderId = Number(req.params.id);
      if (!Number.isInteger(purchaseOrderId) || purchaseOrderId <= 0) {
        return res.status(400).json({
          error: "DOCUMENT_NON_DESIGNE",
          message: "Identifiant de bon de commande invalide.",
        });
      }

      // Cherché DANS le locataire de la session : l'identifiant d'une autre
      // organisation donne 404, et non une impression inscrite chez elle.
      const bon = await gmaoStorage.getPurchaseOrderById(purchaseOrderId, tenantId);
      if (!bon) {
        return res.status(404).json({
          error: "BON_INTROUVABLE",
          message: `Bon de commande #${purchaseOrderId} introuvable dans votre organisation.`,
        });
      }

      if (bon.canPrint !== true) {
        return res.status(409).json({
          error: "CIRCUIT_INCOMPLET",
          message:
            `Ce bon de commande est au statut « ${bon.validationStatus} » et n'est pas ` +
            "imprimable : seule la validation du dernier niveau pose ce droit.",
          validationStatus: bon.validationStatus,
        });
      }

      if (bon.printedAt) {
        return res.status(409).json({
          error: "DEJA_IMPRIME",
          message: "Ce bon de commande porte déjà une impression : sa trace est conservée.",
          printedBy: bon.printedBy,
          printedAt: bon.printedAt,
        });
      }

      const maintenant = new Date();
      const [maj] = await db
        .update(purchaseOrders)
        .set({
          validationStatus: "printed",
          printedBy: compte.id,
          printedAt: maintenant,
          updatedAt: maintenant,
        })
        .where(and(
          eq(purchaseOrders.id, purchaseOrderId),
          // Le locataire est dans le WHERE autant que dans la lecture : entre la
          // vérification et l'écriture, c'est lui qui garantit qu'on n'inscrit
          // pas une impression sur la ligne d'une autre organisation.
          eq(purchaseOrders.tenantId, tenantId),
          eq(purchaseOrders.canPrint, true),
          isNull(purchaseOrders.printedAt),
        ))
        .returning();

      if (!maj) {
        return res.status(409).json({
          error: "ETAT_MODIFIE",
          message: "Ce bon de commande a changé d'état entre-temps : rechargez-le.",
        });
      }

      res.json({
        success: true,
        message: "Bon de commande marqué comme imprimé",
        validationStatus: maj.validationStatus,
        printedBy: maj.printedBy,
        printedAt: maj.printedAt,
      });
    } catch (error) {
      console.error("Error marking purchase order as printed:", error);
      res.status(500).json({ message: "Failed to mark purchase order as printed" });
    }
  });

  // Add supporting documents to purchase order
  app.post("/api/purchase-orders/:id/documents", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;

      const purchaseOrderId = parseInt(req.params.id);
      const { documents } = req.body;

      const updatedOrder = await gmaoStorage.updatePurchaseOrder(purchaseOrderId, tenantId, {
        documentsJustificatifs: documents
      });
      if (!updatedOrder) {
        return res.status(404).json({ message: "Bon de commande introuvable" });
      }

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
      // Mêmes deux gardes que sur `/letterhead` juste au-dessus : en-tête du
      // demandeur, et bon de commande cherché dans son locataire.
      const tenantId = tenantRequis(req, res);
      if (!tenantId) return;

      const purchaseOrderId = parseInt(req.params.id);

      const order = await gmaoStorage.getPurchaseOrderById(purchaseOrderId, tenantId);
      if (!order) {
        return res.status(404).json({ message: "Bon de commande introuvable" });
      }

      const items = await gmaoStorage.getPurchaseOrderItems(purchaseOrderId, tenantId);
      const supplier = order.supplierId ? await gmaoStorage.getSupplierById(order.supplierId) : undefined;
      const enrichedOrder = {
        ...order,
        description: order.notes || "",
        supplier: supplier?.companyName || "—",
        totalAmount: order.totalAmount ?? "0",
        currency: order.currency || "EUR",
        validationStatus: order.validationStatus || "pending",
        requestedBy: order.requestedBy || "—",
        createdAt: order.createdAt ?? undefined,
        items: items.map(i => ({
          partNumber: i.partNumber || `ITEM-${i.id}`,
          description: i.description || "—",
          quantity: i.quantity ?? 0,
          unitPrice: parseFloat(i.unitPrice?.toString() ?? "0"),
        })),
      };

      const { generatePurchaseOrderPDF } = await import('../server/pdf-generator-pdfkit');
      const companyConfig = await gmaoStorage.getCompanyConfig(tenantId);
      const pdfCompanyConfig = companyConfig ? {
        companyName: companyConfig.companyName,
        address: companyConfig.address || "",
        phone: companyConfig.phone || "",
        email: companyConfig.email || "",
        website: companyConfig.website || "",
        taxNumber: companyConfig.taxNumber || "",
        logoBase64: companyConfig.logoBase64 || undefined,
        primaryColor: companyConfig.primaryColor || undefined,
      } : undefined;
      const pdfDoc = generatePurchaseOrderPDF(enrichedOrder, pdfCompanyConfig);

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

  // ═══════════════════════════════════════════════════════════════════
  // PAS DE ROUTE DE DÉMONSTRATION ICI — ET C'EST VOULU
  // ═══════════════════════════════════════════════════════════════════
  // `POST /api/create-validation-demo` a été retirée le 2026-10-25. Elle
  // exécutait `createValidationDemo()` (server/create-validation-demo.ts,
  // supprimé) sans AUCUN contrôle de rôle : tout compte authentifié pouvait
  // l'appeler. Mesuré sur une grappe de test, depuis un simple technicien
  // (`role = technician`, `validation_level = 0`) — HTTP 200 :
  //
  //   • deux ordres de travail écrits dans le locataire codé en dur
  //     « default-tenant », donc pas celui de l'appelant, donc visibles de
  //     personne — pointant pourtant les équipements nº 1 et 2 d'un VRAI
  //     locataire, et attribués (`requested_by`) aux comptes nº 1 et 2 ;
  //   • deux bons de commande RÉELS, de 654,00 € et 4 250,00 €, au statut
  //     `pending` : ils sont entrés dans la file de validation de niveau 1
  //     d'un validateur habilité, puis — après son approbation — dans celle
  //     d'un validateur d'une AUTRE organisation. De la dépense fictive
  //     soumise à signature réelle ;
  //   • là où les identifiants 1, 2 et 3 étaient libres, trois profils écrits
  //     à ces identifiants FORCÉS, `tenant_id` à NULL, sans mot de passe, et
  //     portant des rôles qui n'existent dans aucune nomenclature du dépôt
  //     (« Chef de Service Utilisateur », « Technicien Maintenance ») — la
  //     classe de valeur que shared/roles.ts existe pour éliminer. Leurs
  //     champs `canValidateLevel1/2/3` ne correspondant à aucune colonne, ils
  //     étaient ignorés en silence : ces « validateurs » naissaient à
  //     `validation_level = 0`, incapables de valider quoi que ce soit ;
  //   • sur une instance neuve, dont la séquence de `user_profiles.id` n'a pas
  //     encore dépassé 3, la création du compte suivant échoue — clé primaire
  //     déjà prise. Un jeu de démonstration ne doit pas squatter l'espace
  //     d'identifiants des vrais comptes.
  //
  // En prime, l'échec n'était pas transactionnel et répondait HTTP 200 avec
  // `success: false`, en recopiant dans le corps la requête SQL complète et
  // ses paramètres.
  //
  // Le besoin légitime — montrer le produit sur des données crédibles — est
  // couvert par `scripts/jeu-de-demonstration.ts` : locataire dédié à
  // l'identifiant figé, domaine en `.demo.invalid`, refus d'écrire ailleurs,
  // réversible (`npm run demo:charger` / `npm run demo:retirer`). Une commande
  // d'exploitation, lancée par qui administre la machine — pas une route
  // d'écriture ouverte à toute session.

  console.log("✅ GMAO routes registered successfully");
}