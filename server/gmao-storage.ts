import { db } from "./db";
import { eq, desc, and, or, gte, lte, inArray, notInArray, sql, count } from "drizzle-orm";

/**
 * La base, ou une transaction en cours sur celle-ci.
 *
 * Même type et même raison que l'`Executeur` de server/stock-management.ts :
 * la clôture d'un ordre de travail doit faire porter ses écritures de compteur
 * par SA transaction, sinon elles survivraient à son annulation.
 */
type ExecuteurBase = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Le compteur visé n'appartient pas au demandeur, ou n'existe pas.
 *
 * Classe dédiée pour que les routes répondent **404** et non 500 — convention
 * du dépôt (403 = rôle refusé, 404 = rôle accepté mais objet absent). Un
 * compteur d'autrui est, pour le demandeur, exactement un objet absent, et ne
 * pas distinguer les deux cas évite de révéler qu'un identifiant existe
 * ailleurs. Même forme que `PieceIntrouvable` dans stock-management.ts.
 */
export class CompteurIntrouvable extends Error {
  constructor(id: number) {
    super(`Compteur de maintenance #${id} non trouvé`);
    this.name = 'CompteurIntrouvable';
  }
}

/**
 * On a voulu relever un compteur désactivé.
 *
 * **409** et non 400 : la requête est bien formée, c'est l'état du compteur qui
 * la contredit — et le geste à faire est de le réactiver, pas de corriger la
 * saisie.
 */
export class CompteurDesactive extends Error {
  constructor(id: number) {
    super(`Le compteur #${id} est désactivé : son suivi a été suspendu, aucun relevé ne peut y être enregistré.`);
    this.name = 'CompteurDesactive';
  }
}

/** La demande visée n'appartient pas au demandeur, ou n'existe pas. → 404 */
export class DemandeIntrouvable extends Error {
  constructor(id: number) {
    super(`Demande d'intervention #${id} non trouvée`);
    this.name = 'DemandeIntrouvable';
  }
}

/**
 * La demande a déjà été arbitrée.
 *
 * **409** et non 400 : la requête est bien formée, c'est l'état de la demande
 * qui la contredit. Et le message DIT l'état trouvé — un « conflit » sans
 * préciser ce qui a déjà eu lieu oblige l'utilisateur à recharger pour
 * comprendre.
 *
 * Ce refus est ce qui empêche un second arbitrage d'écraser le premier : sans
 * lui, un refus pourrait annuler une acceptation et laisser un ordre de
 * travail orphelin de sa demande.
 */
export class DemandeDejaArbitree extends Error {
  constructor(id: number, public readonly etat: string) {
    const libelles: Record<string, string> = {
      accepted: 'déjà acceptée et convertie en ordre de travail',
      rejected: 'déjà refusée',
      cancelled: 'annulée par son demandeur',
    };
    super(`La demande d'intervention #${id} est ${libelles[etat] ?? `dans l'état « ${etat} »`} : elle ne peut plus être arbitrée.`);
    this.name = 'DemandeDejaArbitree';
  }
}
import { mtbfHeures, mttrHeures, arrondir } from "@shared/fiabilite";
import {
  equipmentRegistry,
  workOrders,
  preventiveMaintenancePlans,
  maintenanceCounters,
  counterHistory,
  counterReadings,
  interventionRequests,
  spareParts,
  stockMovements,
  iotSensorData,
  predictiveAnalytics,
  kpiMetrics,
  integrationLog,
  alertsNotifications,
  suppliers,
  purchaseOrders,
  purchaseOrderItems,
  reorderRules,
  userProfiles,
  type EquipmentRegistry,
  type InsertEquipmentRegistry,
  type WorkOrder,
  type InsertWorkOrder,
  type PreventiveMaintenancePlan,
  type InsertPreventiveMaintenancePlan,
  type MaintenanceCounter,
  type InsertMaintenanceCounter,
  type CounterHistory,
  type InsertCounterHistory,
  type CounterReading,
  type InterventionRequest,
  type InsertInterventionRequest,
  type SparePart,
  type InsertSparePart,
  type StockMovement,
  type InsertStockMovement,
  type IotSensorData,
  type InsertIotSensorData,
  type PredictiveAnalytics,
  type InsertPredictiveAnalytics,
  type KpiMetrics,
  type InsertKpiMetrics,
  type IntegrationLog,
  type InsertIntegrationLog,
  type AlertsNotifications,
  type InsertAlertsNotifications,
  type Supplier,
  type InsertSupplier,
  type PurchaseOrder,
  type InsertPurchaseOrder,
  type PurchaseOrderItem,
  type InsertPurchaseOrderItem,
  type ReorderRule,
  type InsertReorderRule,
  type UserProfile,
  type InsertUserProfile,
  maintenanceReports,
  monthlyReports,
  reportTemplates,
  type MaintenanceReport,
  type InsertMaintenanceReport,
  type MonthlyReport,
  type InsertMonthlyReport,
  type ReportTemplate,
  type InsertReportTemplate,
  companyConfig,
  type CompanyConfig,
  type InsertCompanyConfig,
} from "@shared/schema";

export class GMAOStorage {
  private db = db;
  // Equipment Registry Methods - TENANT ISOLATED
  async getEquipmentRegistry(tenantId: string): Promise<EquipmentRegistry[]> {
    return await db.select().from(equipmentRegistry)
      .where(eq(equipmentRegistry.tenantId, tenantId))
      .orderBy(desc(equipmentRegistry.createdAt));
  }

  // Efficient COUNT-based KPI aggregation — avoids fetching full rows
  /**
   * Contexte des indicateurs — ce qu'un chiffre seul ne dit pas.
   *
   * « 24 équipements » ne renseigne sur rien. « 24 équipements, 3 indisponibles,
   * +2 ce mois » se lit d'un coup d'œil et oriente la journée. Ces comptes sont
   * calculés en base, jamais estimés côté interface.
   *
   * Tout est borné au locataire, et chaque requête est un COUNT indexé : pas de
   * lecture de table complète.
   */
  /**
   * L'activité réelle des N derniers mois, locataire par locataire.
   *
   * ═══════════════════════════════════════════════════════════════════
   * POURQUOI CETTE MÉTHODE EXISTE
   * ═══════════════════════════════════════════════════════════════════
   * Le tableau de bord GMAO affichait deux graphiques entièrement INVENTÉS :
   * une évolution sur six mois dont cinq étaient des constantes, et une
   * répartition préventif/correctif sur douze mois intégralement fictive. Le
   * sixième point valait `dashboardData?.…?.completed || 45` — autrement dit,
   * le chiffre fabriqué n'apparaissait QUE lorsque la vraie valeur était zéro.
   * Un locataire sans la moindre saisie voyait donc une courbe d'activité
   * fournie, précisément parce qu'il n'avait rien saisi.
   *
   * Montrer des chiffres inventés à un industriel qui évalue l'outil est le
   * plus sûr moyen de perdre sa confiance. Signalé le 2026-10-11.
   *
   * Un mois sans activité rend des zéros. C'est une information, pas un vide à
   * combler : l'interface le présentera comme tel.
   */
  async getEvolutionMensuelle(tenantId: string, nombreDeMois = 6): Promise<Array<{
    mois: string;
    cles: string;
    termines: number;
    enCours: number;
    urgents: number;
    preventif: number;
    correctif: number;
  }>> {
    const mois = Math.min(Math.max(nombreDeMois, 1), 24);
    const debut = new Date();
    debut.setDate(1);
    debut.setHours(0, 0, 0, 0);
    debut.setMonth(debut.getMonth() - (mois - 1));

    // Une seule passe : agréger en base plutôt que de rapatrier les lignes.
    const lignes = await db
      .select({
        cles: sql<string>`to_char(date_trunc('month', ${workOrders.createdAt}), 'YYYY-MM')`,
        termines: sql<number>`count(*) filter (where ${workOrders.status} = 'completed')`,
        enCours: sql<number>`count(*) filter (where ${workOrders.status} in ('pending','assigned','in_progress','paused'))`,
        urgents: sql<number>`count(*) filter (where ${workOrders.priority} = 'urgent')`,
        preventif: sql<number>`count(*) filter (where ${workOrders.orderType} = 'preventive')`,
        correctif: sql<number>`count(*) filter (where ${workOrders.orderType} in ('corrective','emergency'))`,
      })
      .from(workOrders)
      .where(and(eq(workOrders.tenantId, tenantId), gte(workOrders.createdAt, debut)))
      .groupBy(sql`date_trunc('month', ${workOrders.createdAt})`);

    const parCle = new Map(lignes.map((l) => [l.cles, l]));

    // Les mois sans aucune intervention doivent apparaître — à zéro. Les
    // omettre déformerait la courbe en rapprochant deux mois distants.
    const NOMS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin',
      'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

    return Array.from({ length: mois }, (_, i) => {
      const d = new Date(debut.getFullYear(), debut.getMonth() + i, 1);
      const cles = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const trouve = parCle.get(cles);
      return {
        mois: NOMS[d.getMonth()],
        cles,
        termines: Number(trouve?.termines ?? 0),
        enCours: Number(trouve?.enCours ?? 0),
        urgents: Number(trouve?.urgents ?? 0),
        preventif: Number(trouve?.preventif ?? 0),
        correctif: Number(trouve?.correctif ?? 0),
      };
    });
  }

  /**
   * Les seuls indicateurs que nos données permettent réellement de calculer.
   *
   * ═══════════════════════════════════════════════════════════════════
   * POURQUOI CETTE MÉTHODE EXISTE
   * ═══════════════════════════════════════════════════════════════════
   * Le tableau de bord affichait « Taux de résolution 94,2 % (+2,4 % ce mois) »,
   * « MTTR 2,8 h (-15 min vs mois dernier) », « Maintenance préventive 78,5 % »,
   * « Disponibilité 94,7 % (+2,1 % vs secteur) » — tous écrits en dur dans le
   * code. Un locataire sans la moindre intervention voyait ces performances.
   *
   * Trois d'entre eux se calculent vraiment. Les autres — OEE, disponibilité,
   * comparaison sectorielle — n'ont aucune source dans cette base : ils sont
   * retirés plutôt que devinés. Signalé le 2026-10-11.
   *
   * `null` signifie « pas encore mesurable », et l'interface doit le dire.
   */
  async getIndicateursReels(tenantId: string): Promise<{
    tauxResolution: number | null;
    tauxPreventif: number | null;
    mttrHeures: number | null;
    totalInterventions: number;
  }> {
    const [ligne] = await db
      .select({
        total: count(),
        termines: sql<number>`count(*) filter (where ${workOrders.status} = 'completed')`,
        preventif: sql<number>`count(*) filter (where ${workOrders.orderType} = 'preventive')`,
        // MTTR : durée réelle moyenne des interventions correctives CLOSES.
        // Les préventifs n'y entrent pas — réparer et entretenir ne se mesurent
        // pas ensemble. Une durée nulle ou absente est écartée, sinon la
        // moyenne s'effondre avec les saisies incomplètes.
        mttrMinutes: sql<number | null>`avg(${workOrders.actualDuration}) filter (
          where ${workOrders.status} = 'completed'
            and ${workOrders.orderType} in ('corrective','emergency')
            and ${workOrders.actualDuration} > 0
        )`,
      })
      .from(workOrders)
      .where(eq(workOrders.tenantId, tenantId));

    const total = Number(ligne?.total ?? 0);
    if (total === 0) {
      // Aucun ordre de travail : aucun taux n'a de sens. Zéro serait un
      // mensonge aussi grave qu'un chiffre inventé.
      return { tauxResolution: null, tauxPreventif: null, mttrHeures: null, totalInterventions: 0 };
    }

    const arrondir = (v: number) => Math.round(v * 10) / 10;
    const mttrMinutes = ligne?.mttrMinutes == null ? null : Number(ligne.mttrMinutes);

    return {
      tauxResolution: arrondir((Number(ligne.termines) / total) * 100),
      tauxPreventif: arrondir((Number(ligne.preventif) / total) * 100),
      mttrHeures: mttrMinutes == null ? null : arrondir(mttrMinutes / 60),
      totalInterventions: total,
    };
  }

  async getDashboardContexte(tenantId: string): Promise<{
    equipementsIndisponibles: number;
    equipementsAjoutesCeMois: number;
    otEnRetard: number;
    otUrgents: number;
    alertesDernieres24h: number;
    piecesEnRupture: number;
    preventifEnRetard: number;
    preventifSous7Jours: number;
  }> {
    const maintenant = new Date();
    const debutDuMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
    const ilYA24h = new Date(maintenant.getTime() - 24 * 60 * 60 * 1000);
    const dans7Jours = new Date(maintenant.getTime() + 7 * 24 * 60 * 60 * 1000);
    const ouverts = or(eq(workOrders.status, 'pending'), eq(workOrders.status, 'in_progress'));

    const [
      [indispo], [ajoutes], [enRetard], [urgents], [alertes24h], [rupture], [prevRetard], [prev7j]
    ] = await Promise.all([
      // Hors service ou immobilisé pour maintenance — pas les réformés.
      db.select({ total: count() }).from(equipmentRegistry)
        .where(and(
          eq(equipmentRegistry.tenantId, tenantId),
          or(eq(equipmentRegistry.operationalState, 'offline'), eq(equipmentRegistry.operationalState, 'maintenance')),
        )),
      db.select({ total: count() }).from(equipmentRegistry)
        .where(and(eq(equipmentRegistry.tenantId, tenantId), gte(equipmentRegistry.createdAt, debutDuMois))),
      // En retard : la fin prévue est passée et l'intervention n'est pas close.
      db.select({ total: count() }).from(workOrders)
        .where(and(eq(workOrders.tenantId, tenantId), ouverts, lte(workOrders.scheduledEnd, maintenant))),
      db.select({ total: count() }).from(workOrders)
        .where(and(eq(workOrders.tenantId, tenantId), ouverts, eq(workOrders.priority, 'urgent'))),
      db.select({ total: count() }).from(alertsNotifications)
        .where(and(eq(alertsNotifications.tenantId, tenantId), eq(alertsNotifications.status, 'active'), gte(alertsNotifications.createdAt, ilYA24h))),
      // Rupture franche : plus rien en stock, à distinguer du seuil d'alerte.
      db.select({ total: count() }).from(spareParts)
        .where(and(eq(spareParts.tenantId, tenantId), lte(spareParts.currentStock, 0))),
      db.select({ total: count() }).from(preventiveMaintenancePlans)
        .where(and(eq(preventiveMaintenancePlans.tenantId, tenantId), eq(preventiveMaintenancePlans.isActive, true), lte(preventiveMaintenancePlans.nextDue, maintenant))),
      db.select({ total: count() }).from(preventiveMaintenancePlans)
        .where(and(
          eq(preventiveMaintenancePlans.tenantId, tenantId),
          eq(preventiveMaintenancePlans.isActive, true),
          gte(preventiveMaintenancePlans.nextDue, maintenant),
          lte(preventiveMaintenancePlans.nextDue, dans7Jours),
        )),
    ]);

    return {
      equipementsIndisponibles: indispo?.total ?? 0,
      equipementsAjoutesCeMois: ajoutes?.total ?? 0,
      otEnRetard: enRetard?.total ?? 0,
      otUrgents: urgents?.total ?? 0,
      alertesDernieres24h: alertes24h?.total ?? 0,
      piecesEnRupture: rupture?.total ?? 0,
      preventifEnRetard: prevRetard?.total ?? 0,
      preventifSous7Jours: prev7j?.total ?? 0,
    };
  }

  async getDashboardKPIs(tenantId: string): Promise<{
    equipmentCount: number;
    activeWorkOrdersCount: number;
    pendingWorkOrdersCount: number;
    completedWorkOrdersCount: number;
    criticalAlertsCount: number;
    lowStockPartsCount: number;
  }> {
    const [
      [eqRow], [activeRow], [pendingRow], [completedRow], [alertRow], [stockRow]
    ] = await Promise.all([
      db.select({ total: count() }).from(equipmentRegistry)
        .where(eq(equipmentRegistry.tenantId, tenantId)),
      db.select({ total: count() }).from(workOrders)
        .where(and(eq(workOrders.tenantId, tenantId), eq(workOrders.status, 'in_progress'))),
      db.select({ total: count() }).from(workOrders)
        .where(and(eq(workOrders.tenantId, tenantId), eq(workOrders.status, 'pending'))),
      db.select({ total: count() }).from(workOrders)
        .where(and(eq(workOrders.tenantId, tenantId), eq(workOrders.status, 'completed'))),
      db.select({ total: count() }).from(alertsNotifications)
        .where(and(eq(alertsNotifications.tenantId, tenantId), eq(alertsNotifications.severity, 'critical'), eq(alertsNotifications.status, 'active'))),
      db.select({ total: count() }).from(spareParts)
        .where(and(eq(spareParts.tenantId, tenantId), sql`${spareParts.currentStock} <= ${spareParts.reorderPoint}`)),
    ]);
    return {
      equipmentCount: eqRow?.total ?? 0,
      activeWorkOrdersCount: activeRow?.total ?? 0,
      pendingWorkOrdersCount: pendingRow?.total ?? 0,
      completedWorkOrdersCount: completedRow?.total ?? 0,
      criticalAlertsCount: alertRow?.total ?? 0,
      lowStockPartsCount: stockRow?.total ?? 0,
    };
  }

  async getEquipmentById(id: number, tenantId: string): Promise<EquipmentRegistry | undefined> {
    const [equipment] = await db.select().from(equipmentRegistry)
      .where(and(eq(equipmentRegistry.id, id), eq(equipmentRegistry.tenantId, tenantId)));
    return equipment;
  }

  async getEquipmentByEquipmentId(equipmentId: string, tenantId: string): Promise<EquipmentRegistry | undefined> {
    const [equipment] = await db.select().from(equipmentRegistry)
      .where(and(eq(equipmentRegistry.equipmentId, equipmentId), eq(equipmentRegistry.tenantId, tenantId)));
    return equipment;
  }

  async getEquipmentByEquipmentIdGlobal(equipmentId: string): Promise<EquipmentRegistry | undefined> {
    const [equipment] = await db.select().from(equipmentRegistry)
      .where(eq(equipmentRegistry.equipmentId, equipmentId));
    return equipment;
  }

  async createEquipment(data: InsertEquipmentRegistry): Promise<EquipmentRegistry> {
    try {
      const equipmentId = data.equipmentId || `EQ-${Date.now()}`;
      const [equipment] = await db.insert(equipmentRegistry).values({ ...data, equipmentId }).returning();
      return equipment;
    } catch (error) {
      console.error("createEquipment error:", error);
      throw error;
    }
  }

  async updateEquipment(id: number, tenantId: string, updates: Partial<EquipmentRegistry>): Promise<EquipmentRegistry> {
      // Le locataire est retiré des champs ecrits : la propriete doit etre
      // vraie ICI, sans dependre de la validation faite par l'appelant. Une
      // ligne ne change pas d'entreprise par une mise a jour (cf. updateAlert
      // et docs/EXAMEN_LISTES_BLANCHES.md).
      const { tenantId: _jamaisModifiable, ...updatesCloisonne } = updates;
    try {
      const [equipment] = await db
        .update(equipmentRegistry)
        .set({ ...updatesCloisonne, updatedAt: new Date() })
        .where(and(eq(equipmentRegistry.id, id), eq(equipmentRegistry.tenantId, tenantId)))
        .returning();
      if (!equipment) throw new Error(`Équipement #${id} non trouvé ou accès refusé`);
      return equipment;
    } catch (error) {
      console.error("updateEquipment error:", error);
      throw error;
    }
  }

  async searchEquipment(tenantId: string, query: { equipmentType?: string; zone?: string; sector?: string; equipmentName?: string }): Promise<EquipmentRegistry[]> {
    const conditions = [eq(equipmentRegistry.tenantId, tenantId)];

    if (query.equipmentType) {
      conditions.push(eq(equipmentRegistry.equipmentType, query.equipmentType));
    }
    if (query.zone) {
      conditions.push(eq(equipmentRegistry.zone, query.zone));
    }
    if (query.sector) {
      conditions.push(eq(equipmentRegistry.sector, query.sector));
    }
    if (query.equipmentName) {
      conditions.push(eq(equipmentRegistry.equipmentName, query.equipmentName));
    }

    return await db.select().from(equipmentRegistry)
      .where(and(...conditions))
      .orderBy(desc(equipmentRegistry.createdAt));
  }

  // Work Orders Methods - TENANT ISOLATED
  async getWorkOrders(tenantId: string): Promise<any[]> {
    return await db
      .select({
        id: workOrders.id,
        orderNumber: workOrders.orderNumber,
        equipmentId: workOrders.equipmentId,
        equipmentName: equipmentRegistry.equipmentName,
        orderType: workOrders.orderType,
        // ⚠️ CETTE PROJECTION EST EXPLICITE : tout champ absent d'ici est
        // absent de la réponse, SANS erreur. Mesuré en ouvrant l'écran : la
        // boîte de clôture n'annonçait ni la replanification du plan ni la
        // remise en service de l'équipement, et n'affichait aucun compteur —
        // non pas à cause d'un défaut de la boîte, mais parce que
        // `/api/work-orders` ne servait ni `planId` ni `requiresShutdown`. Le
        // JSX était juste, le contrat de champs ne l'était pas, et seul
        // l'écran ouvert l'a montré : la liste répondait 200 avec 28 champs.
        planId: workOrders.planId,
        requiresShutdown: workOrders.requiresShutdown,
        title: workOrders.title,
        description: workOrders.description,
        priority: workOrders.priority,
        status: workOrders.status,
        assignedTo: workOrders.assignedTo,
        requestedBy: workOrders.requestedBy,
        estimatedDuration: workOrders.estimatedDuration,
        actualDuration: workOrders.actualDuration,
        scheduledStart: workOrders.scheduledStart,
        actualStart: workOrders.actualStart,
        scheduledEnd: workOrders.scheduledEnd,
        actualEnd: workOrders.actualEnd,
        cost: workOrders.cost,
        laborCost: workOrders.laborCost,
        materialCost: workOrders.materialCost,
        externalCost: workOrders.externalCost,
        notes: workOrders.notes,
        completionNotes: workOrders.completionNotes,
        validationStatus: workOrders.validationStatus,
        canExecute: workOrders.canExecute,
        createdAt: workOrders.createdAt,
        updatedAt: workOrders.updatedAt,
        location: equipmentRegistry.location
      })
      .from(workOrders)
      .leftJoin(equipmentRegistry, and(
        eq(workOrders.equipmentId, equipmentRegistry.id),
        eq(equipmentRegistry.tenantId, tenantId)
      ))
      .where(eq(workOrders.tenantId, tenantId))
      .orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrderById(id: number, tenantId: string): Promise<WorkOrder | undefined> {
    const [workOrder] = await db.select().from(workOrders)
      .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, tenantId)));
    return workOrder;
  }

  async getWorkOrdersByEquipment(equipmentId: number, tenantId: string): Promise<WorkOrder[]> {
    return await db.select().from(workOrders)
      .where(and(eq(workOrders.equipmentId, equipmentId), eq(workOrders.tenantId, tenantId)))
      .orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrdersByStatus(status: string, tenantId: string): Promise<WorkOrder[]> {
    // ✅ FIXED: Tenant isolation enabled
    return await db.select().from(workOrders)
      .where(and(eq(workOrders.status, status), eq(workOrders.tenantId, tenantId)))
      .orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrdersByAssignee(userId: number, tenantId: string): Promise<WorkOrder[]> {
    // ✅ FIXED: Tenant isolation enabled
    return await db.select().from(workOrders)
      .where(and(eq(workOrders.assignedTo, userId), eq(workOrders.tenantId, tenantId)))
      .orderBy(desc(workOrders.createdAt));
  }

  async createWorkOrder(data: InsertWorkOrder): Promise<WorkOrder> {
    try {
      const orderNumber = `WO-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const { cost, laborCost, materialCost, externalCost, ...rest } = data;
      const [workOrder] = await db.insert(workOrders).values({
        ...rest,
        orderNumber,
        cost: cost?.toString(),
        laborCost: laborCost?.toString(),
        materialCost: materialCost?.toString(),
        externalCost: externalCost?.toString(),
      }).returning();
      return workOrder;
    } catch (error) {
      console.error("createWorkOrder error:", error);
      throw error;
    }
  }

  async updateWorkOrder(id: number, tenantId: string, updates: Partial<WorkOrder>): Promise<WorkOrder> {
    try {
      // `tenantId` est retiré des champs écrits. La clause `WHERE` ci-dessous
      // cloisonne la ligne qu'on ATTEINT, pas la valeur qu'on y écrit : mesuré
      // sur banc, `PUT /api/work-orders/:id` avec `{ tenantId: <autre> }`
      // faisait PASSER l'ordre chez l'autre entreprise
      // (docs/EXAMEN_LISTES_BLANCHES.md, anomalie C). L'appelant lisait un 403,
      // posé par le filet anti-fuite sur la réponse, APRÈS l'écriture.
      //
      // Un ordre de travail ne change pas d'entreprise par une mise à jour.
      // Même protection que `updateAlert`.
      const { tenantId: _jamaisModifiable, ...sansLocataire } = updates;
      const safeUpdates = { ...sansLocataire };
      if (safeUpdates.level1ValidatedBy === undefined) delete safeUpdates.level1ValidatedBy;
      if (safeUpdates.level2ValidatedBy === undefined) delete safeUpdates.level2ValidatedBy;

      const [existing] = await db
        .select()
        .from(workOrders)
        .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, tenantId)));

      const [workOrder] = await db
        .update(workOrders)
        .set({ ...safeUpdates, updatedAt: new Date() })
        .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, tenantId)))
        .returning();

      if (!workOrder) throw new Error(`Ordre de travail #${id} non trouvé ou accès refusé`);

      if (existing?.status !== 'completed' && workOrder.status === 'completed' && workOrder.projectedCost != null) {
        this.recordAutomatedProjectionOutcome(workOrder).catch(err =>
          console.error("Apprentissage post-action échoué (best-effort):", err)
        );
      }

      return workOrder;
    } catch (error) {
      console.error("updateWorkOrder error:", error);
      throw error;
    }
  }

  /**
   * Compare le résultat réel d'un OT lié à une décision automatisée à sa
   * projection (coût, durée, impact IMCA) et ajuste λ_k/ω_j en conséquence
   * (apprentissage post-action, Brevet 2 rev. 1g/3/10). Best-effort — ne
   * doit jamais faire échouer la clôture de l'OT appelante.
   *
   * ⚠️ N'EST PLUS `private`, et le changement est délibéré. La clôture d'un
   * ordre de travail ne passe plus par `updateWorkOrder` : elle a son propre
   * chemin transactionnel (`server/cloture-ordre-travail.ts`), parce qu'elle
   * écrit dans cinq tables qui doivent être vraies ensemble. Or c'est
   * EXACTEMENT sur la transition vers `completed` que cet apprentissage se
   * déclenche. Laissé privé, il aurait cessé de s'exécuter sans que rien ne le
   * signale — une capacité perdue en silence, du genre que seul un audit
   * retrouve. La clôture l'appelle donc explicitement, après son commit.
   *
   * Il reste hors transaction, et c'est la règle du dépôt : il calcule un IMCA
   * et écrit dans un autre magasin (docs/TRANSACTIONS.md, « rien de lent ni de
   * distant dans une transaction »).
   */
  async recordAutomatedProjectionOutcome(workOrder: WorkOrder): Promise<void> {
    const { recordProjectionOutcome } = await import("./arbitration-learning");
    const { computeIMCA } = await import("./imca-engine");

    const actualCost = workOrder.cost != null ? parseFloat(workOrder.cost as unknown as string) : 0;
    const actualDuration = workOrder.actualDuration ?? workOrder.estimatedDuration ?? 0;

    let actualImcaImpact = 0;
    if (workOrder.equipmentId != null && workOrder.imcaAtCreation != null) {
      const after = await computeIMCA(workOrder.equipmentId, workOrder.tenantId).catch(() => null);
      if (after) actualImcaImpact = Math.max(0, after.IMCA - workOrder.imcaAtCreation);
    }

    await recordProjectionOutcome(
      workOrder.tenantId,
      {
        cost: parseFloat((workOrder.projectedCost as unknown as string) ?? "0"),
        duration: workOrder.estimatedDuration ?? 0,
        imcaImpact: workOrder.projectedImcaImpact ?? 0,
      },
      { cost: actualCost, duration: actualDuration, imcaImpact: actualImcaImpact }
    );
  }

  async deleteWorkOrder(id: number, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(workOrders)
      .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, tenantId)))
      .returning();
    return result.length > 0;
  }

  // Work Orders by Validation Status (same procedure as Purchase Orders) - TENANT ISOLATED
  async getWorkOrdersByValidationStatus(status: string, tenantId: string): Promise<WorkOrder[]> {
    // 🔧 CORRECTION: Activer le filtrage par tenant ET par status
    return await db.select().from(workOrders)
      .where(and(eq(workOrders.validationStatus, status), eq(workOrders.tenantId, tenantId)))
      .orderBy(desc(workOrders.createdAt));
  }

  // Preventive Maintenance Methods - TENANT ISOLATED
  async getPreventiveMaintenancePlans(tenantId: string): Promise<PreventiveMaintenancePlan[]> {
    return await db.select().from(preventiveMaintenancePlans)
      .where(eq(preventiveMaintenancePlans.tenantId, tenantId))
      .orderBy(desc(preventiveMaintenancePlans.createdAt));
  }

  async getPreventiveMaintenancePlanById(id: number, tenantId: string): Promise<PreventiveMaintenancePlan | undefined> {
    const [plan] = await db.select().from(preventiveMaintenancePlans)
      .where(and(eq(preventiveMaintenancePlans.id, id), eq(preventiveMaintenancePlans.tenantId, tenantId)));
    return plan;
  }

  async getPreventiveMaintenancePlansByEquipmentType(equipmentType: string, tenantId: string): Promise<PreventiveMaintenancePlan[]> {
    return await db.select().from(preventiveMaintenancePlans)
      .where(and(eq(preventiveMaintenancePlans.equipmentType, equipmentType), eq(preventiveMaintenancePlans.tenantId, tenantId)))
      .orderBy(desc(preventiveMaintenancePlans.createdAt));
  }

  async createPreventiveMaintenancePlan(data: InsertPreventiveMaintenancePlan): Promise<PreventiveMaintenancePlan> {
    const [plan] = await db.insert(preventiveMaintenancePlans).values(data).returning();
    return plan;
  }

  async updatePreventiveMaintenancePlan(id: number, tenantId: string, updates: Partial<PreventiveMaintenancePlan>): Promise<PreventiveMaintenancePlan> {
    const [plan] = await db
      .update(preventiveMaintenancePlans)
      .set(updates)
      .where(and(eq(preventiveMaintenancePlans.id, id), eq(preventiveMaintenancePlans.tenantId, tenantId)))
      .returning();
    return plan;
  }

  /**
   * ⚠️ Renvoyait `void` : la route répondait donc « supprimé avec succès » même
   * quand aucune ligne n'avait été touchée. Mesuré sur un identifiant
   * inexistant : plan = 200, là où `deleteWorkOrder` et `deleteSparePart`
   * rendaient 404. L'interface ne pouvait pas distinguer une suppression réelle
   * d'un coup dans le vide. Même forme que `deleteWorkOrder` désormais.
   */
  async deletePreventiveMaintenancePlan(id: number, tenantId: string): Promise<boolean> {
    const result = await db.delete(preventiveMaintenancePlans)
      .where(and(eq(preventiveMaintenancePlans.id, id), eq(preventiveMaintenancePlans.tenantId, tenantId)))
      .returning();
    return result.length > 0;
  }

  // Maintenance Counters Methods - TENANT ISOLATED
  /**
   * Les compteurs du locataire, avec le nom de leur équipement RÉSOLU.
   *
   * ⚠️ `maintenance_counters.equipment_name` est une copie dénormalisée, et
   * elle est souvent vide : le seul chemin qui la remplissait
   * (`POST /api/preventive-maintenance-plans`) la prend du corps de la requête
   * avant de se rabattre sur l'équipement, et les lignes posées autrement ne
   * l'ont pas du tout. Mesuré en ouvrant l'écran : deux compteurs rattachés à
   * l'équipement #9 « Compresseur atelier » s'affichaient tous deux
   * « Équipement non précisé », alors que le rattachement était bon en base.
   *
   * On lit donc le nom là où il est vrai — `equipment_registry` — et la copie
   * ne sert que de repli, pour les compteurs sans `equipment_id`. Même forme
   * que `getWorkOrders()`, qui résout déjà `equipmentName` par jointure.
   *
   * La jointure porte le locataire, comme ailleurs dans ce fichier : sans
   * cette condition, elle rapprocherait un compteur d'un équipement d'une
   * autre organisation et en afficherait le nom.
   */
  async getMaintenanceCounters(tenantId: string): Promise<MaintenanceCounter[]> {
    const lignes = await db
      .select({
        compteur: maintenanceCounters,
        nomEquipement: equipmentRegistry.equipmentName,
      })
      .from(maintenanceCounters)
      .leftJoin(equipmentRegistry, and(
        eq(maintenanceCounters.equipmentId, equipmentRegistry.id),
        eq(equipmentRegistry.tenantId, tenantId),
      ))
      .where(eq(maintenanceCounters.tenantId, tenantId))
      .orderBy(desc(maintenanceCounters.createdAt));

    return lignes.map(({ compteur, nomEquipement }) => ({
      ...compteur,
      equipmentName: nomEquipement ?? compteur.equipmentName,
    }));
  }

  async getMaintenanceCounterById(id: number, tenantId: string): Promise<MaintenanceCounter | undefined> {
    const [counter] = await db.select().from(maintenanceCounters)
      .where(and(eq(maintenanceCounters.id, id), eq(maintenanceCounters.tenantId, tenantId)));
    return counter;
  }

  async getMaintenanceCountersByEquipment(equipmentId: number, tenantId: string): Promise<MaintenanceCounter[]> {
    return await db.select().from(maintenanceCounters)
      .where(and(eq(maintenanceCounters.equipmentId, equipmentId), eq(maintenanceCounters.tenantId, tenantId)))
      .orderBy(desc(maintenanceCounters.createdAt));
  }

  async createMaintenanceCounter(data: InsertMaintenanceCounter): Promise<MaintenanceCounter> {
    const [counter] = await db.insert(maintenanceCounters).values(data).returning();
    return counter;
  }

  async updateMaintenanceCounter(id: number, tenantId: string, updates: Partial<MaintenanceCounter>): Promise<MaintenanceCounter> {
      // Le locataire est retiré des champs ecrits : la propriete doit etre
      // vraie ICI, sans dependre de la validation faite par l'appelant. Une
      // ligne ne change pas d'entreprise par une mise a jour (cf. updateAlert
      // et docs/EXAMEN_LISTES_BLANCHES.md).
      const { tenantId: _jamaisModifiable, ...updatesCloisonne } = updates;
    const [counter] = await db
      .update(maintenanceCounters)
      .set({ ...updatesCloisonne, updatedAt: new Date() })
      .where(and(eq(maintenanceCounters.id, id), eq(maintenanceCounters.tenantId, tenantId)))
      .returning();
    return counter;
  }

  async incrementCounter(id: number, tenantId: string, incrementValue: number): Promise<MaintenanceCounter> {
    const [counter] = await db
      .update(maintenanceCounters)
      .set({
        currentValue: sql`${maintenanceCounters.currentValue} + ${incrementValue}`,
        updatedAt: new Date()
      })
      .where(and(eq(maintenanceCounters.id, id), eq(maintenanceCounters.tenantId, tenantId)))
      .returning();

    // Le compteur a bougé : alerte ET ordre de travail préventif si l'échéance
    // est atteinte. Cette méthode n'a aucun appelant aujourd'hui — elle est
    // prévue pour une future alimentation automatique depuis un signal de
    // marche — mais elle doit tirer les mêmes conséquences qu'un relevé saisi,
    // sans quoi l'alimentation automatique, le jour où elle arrivera, ferait
    // monter les compteurs sans jamais créer de travail.
    if (counter) {
      await this.traiterEcheanceCompteur(counter);
    }

    return counter;
  }

  /**
   * Enregistre un relevé d'usage : le compteur avance, et le relevé est tracé.
   *
   * ═══════════════════════════════════════════════════════════════════
   * CE QUI MANQUAIT
   * ═══════════════════════════════════════════════════════════════════
   * `incrementCounter()` ci-dessus existait et n'avait AUCUN appelant. Rien
   * n'augmentait `current_value` : un compteur restait à la valeur posée à sa
   * création, n'atteignait donc jamais son seuil, et la remise à zéro à la
   * clôture (migration 0024) ne servait à rien. Un compteur ne franchissait son
   * seuil que si quelqu'un éditait la base à la main.
   *
   * ═══════════════════════════════════════════════════════════════════
   * POURQUOI PAS `incrementCounter()` TEL QUEL
   * ═══════════════════════════════════════════════════════════════════
   * Il fait l'avance en SQL (`current_value + $1`), ce qui est juste et
   * concurrent-sûr, mais il ne sait pas dire ce que valait le compteur avant —
   * donc il ne peut pas écrire la ligne de relevé qui rend l'avance traçable.
   * Ici on verrouille la ligne, on lit, on écrit les deux, dans une
   * transaction : l'avance et sa trace sont vraies ensemble, sinon le compteur
   * aurait bougé sans que personne ne sache de combien ni par qui.
   *
   * `incrementCounter()` reste en place pour un appelant qui n'aurait pas
   * besoin de trace — par exemple une future alimentation automatique depuis
   * un signal de marche.
   */
  async enregistrerReleveCompteur(
    id: number,
    tenantId: string,
    usage: number,
    options: { recordedBy?: number | null; notes?: string } = {},
  ): Promise<{ compteur: MaintenanceCounter; releve: CounterReading }> {
    if (!Number.isFinite(usage) || usage <= 0) {
      throw new Error(`Usage relevé invalide : ${usage}`);
    }

    const resultat = await db.transaction(async (tx) => {
      // Verrou : deux relevés simultanés sur le même compteur liraient la même
      // valeur de départ et le second écraserait le premier. Le compteur
      // n'avancerait alors que d'un seul des deux usages, et les deux lignes
      // de relevé se contrediraient.
      const [avant] = await tx
        .select()
        .from(maintenanceCounters)
        .where(and(eq(maintenanceCounters.id, id), eq(maintenanceCounters.tenantId, tenantId)))
        .for('update');

      if (!avant) throw new CompteurIntrouvable(id);

      // Un compteur désactivé ne se relève pas : le suivi a été suspendu
      // délibérément (instrument démonté, machine à l'arrêt prolongé), et
      // l'avancer le ferait rentrer dans le suivi par la petite porte — en
      // déclenchant éventuellement une alerte de maintenance sur un
      // équipement qu'on avait sorti du périmètre.
      if (avant.isActive === false) {
        throw new CompteurDesactive(id);
      }

      const previousValue = avant.currentValue ?? 0;
      const newValue = previousValue + usage;

      const [compteur] = await tx
        .update(maintenanceCounters)
        .set({ currentValue: newValue, updatedAt: new Date() })
        .where(and(eq(maintenanceCounters.id, id), eq(maintenanceCounters.tenantId, tenantId)))
        .returning();

      const [releve] = await tx
        .insert(counterReadings)
        .values({
          tenantId,
          counterId: id,
          previousValue,
          usage,
          newValue,
          recordedBy: options.recordedBy ?? undefined,
          notes: options.notes,
        })
        .returning();

      return { compteur, releve };
    });

    // HORS transaction, et volontairement : les conséquences écrivent dans
    // `alerts_notifications` et `work_orders`, et peuvent déclencher une
    // notification. La règle du dépôt est que rien de lent ni de distant ne
    // vit dans un `BEGIN` (docs/TRANSACTIONS.md). Leur échec ne doit pas
    // annuler un relevé valide — le relevé est un fait CONSTATÉ, l'alerte et
    // l'ordre de travail en sont des conséquences.
    await this.traiterEcheanceCompteur(resultat.compteur);

    return resultat;
  }

  /**
   * L'histoire complète d'un compteur : ses relevés ET ses remises à zéro,
   * dans l'ordre chronologique.
   *
   * Les deux vivent dans des tables distinctes (`counter_readings` et
   * `counter_history`, voir migration 0025) parce qu'ils ne décrivent pas le
   * même geste. Mais pour lire un compteur, il faut les deux : une suite de
   * relevés sans les remises à zéro donne une courbe qui semble redescendre
   * sans raison, et l'inverse donne des remises à zéro sans rien qui les
   * justifie.
   */
  async getHistoriqueCompteur(
    counterId: number,
    tenantId: string,
  ): Promise<Array<{
    genre: 'releve' | 'remise_a_zero';
    date: Date | null;
    valeurAvant: number;
    valeurApres: number;
    usage: number | null;
    motif: string | null;
    parQui: number | null;
    ordreTravail: number | null;
  }>> {
    // Le compteur doit appartenir au demandeur. La condition porte sur le
    // compteur plutôt que sur chaque ligne : un compteur étant à un seul
    // locataire, le vérifier une fois suffit à cloisonner son histoire — et
    // `counter_history.tenant_id` est nullable, donc des lignes anciennes
    // pourraient s'y cacher de leur propre propriétaire.
    const [compteur] = await db
      .select({ id: maintenanceCounters.id, lastResetValue: maintenanceCounters.lastResetValue })
      .from(maintenanceCounters)
      .where(and(eq(maintenanceCounters.id, counterId), eq(maintenanceCounters.tenantId, tenantId)));

    if (!compteur) return [];

    const releves = await db
      .select()
      .from(counterReadings)
      .where(eq(counterReadings.counterId, counterId));

    const remises = await db
      .select()
      .from(counterHistory)
      .where(eq(counterHistory.counterId, counterId));

    const valeurDeDepart = compteur.lastResetValue ?? 0;

    const lignes = [
      ...releves.map((r) => ({
        genre: 'releve' as const,
        date: r.createdAt,
        valeurAvant: r.previousValue,
        valeurApres: r.newValue,
        usage: r.usage,
        motif: r.notes,
        parQui: r.recordedBy,
        ordreTravail: null,
      })),
      ...remises.map((h) => ({
        genre: 'remise_a_zero' as const,
        date: h.createdAt,
        valeurAvant: h.previousValue,
        // `counter_history` ne stocke pas la valeur d'arrivée : la remise à
        // zéro pose `current_value = last_reset_value`, qu'on relit sur le
        // compteur. C'est exact tant que `last_reset_value` ne change pas ;
        // il n'est écrit nulle part aujourd'hui (il vaut son défaut, 0).
        valeurApres: valeurDeDepart,
        usage: null,
        motif: h.resetReason,
        parQui: h.performedBy,
        ordreTravail: h.workOrderId,
      })),
    ];

    // Tri décroissant, le plus récent d'abord. Une date nulle (ligne ancienne
    // sans `created_at`) part en fin de liste plutôt que de désordonner le reste.
    return lignes.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  }

  /**
   * Remet un compteur d'usage à sa valeur de départ, et journalise le relevé
   * qu'il portait juste avant.
   *
   * ═══════════════════════════════════════════════════════════════════
   * CETTE MÉTHODE N'AVAIT AUCUN APPELANT
   * ═══════════════════════════════════════════════════════════════════
   * Elle était écrite, correcte, et paramétrée par un `workOrderId` — donc
   * manifestement prévue pour être appelée à la clôture d'un ordre de travail.
   * Recensement du 2026-10-26 : **zéro appel**, ni depuis une route, ni depuis
   * le cycle de vie d'un OT, ni depuis le client. Même forme de défaut que
   * `StockManager`, dont le moteur complet n'était joignable que par des
   * endpoints explicites.
   *
   * Elle est maintenant appelée par la clôture (server/cloture-ordre-travail.ts),
   * d'où le paramètre `executeur` : la remise à zéro doit être vraie en même
   * temps que la clôture qui la provoque. Sans lui, les écritures partiraient
   * sur `db` et survivraient à l'annulation de la transaction — le piège décrit
   * dans docs/TRANSACTIONS.md.
   *
   * ═══════════════════════════════════════════════════════════════════
   * CE COMPTEUR EST UN COMPTEUR DE TRONÇON, PAS UN TOTALISATEUR
   * ═══════════════════════════════════════════════════════════════════
   * Le point n'est pas anodin : on ne remet pas à zéro le compteur
   * kilométrique d'un véhicule à chaque révision. Mais c'est bien la sémantique
   * que ce schéma implémente, et le relevé le confirme des deux côtés :
   *
   *   • `checkAndGenerateCounterAlert` compare `currentValue` à
   *     `thresholdValue` DIRECTEMENT, et non un écart à un jalon — donc
   *     `currentValue` signifie « usage depuis la dernière intervention » et
   *     `thresholdValue` « périodicité ».
   *   • les colonnes qui porteraient la lecture « totalisateur » —
   *     `last_service_value` et `interval_value` — ne sont écrites ni lues
   *     nulle part (mesuré : zéro usage hors du schéma). Elles sont mortes.
   *
   * On honore donc la sémantique en place plutôt que d'en introduire une
   * seconde : deux sens contradictoires pour `currentValue` dans la même table
   * seraient exactement le genre de défaut que cette campagne passe son temps
   * à retrouver. `counter_type` ('hours', 'cycles', 'kilometers', 'units')
   * nomme l'UNITÉ, pas la nature absolue ou relative du relevé.
   */
  async resetCounter(
    id: number,
    tenantId: string,
    resetReason?: string,
    performedBy?: number | null,
    workOrderId?: number,
    executeur: ExecuteurBase = db,
  ): Promise<MaintenanceCounter> {
    // Lecture + verrou sur l'exécuteur fourni : dans une transaction, lire par
    // `db` reviendrait à décider sur un état qui n'est pas celui qu'on écrit.
    const [counter] = await executeur
      .select()
      .from(maintenanceCounters)
      .where(and(eq(maintenanceCounters.id, id), eq(maintenanceCounters.tenantId, tenantId)))
      .for('update');

    if (!counter) {
      throw new Error("Counter not found");
    }

    // Create history record
    await executeur.insert(counterHistory).values({
      tenantId,
      counterId: id,
      // `counter_history.previous_value` est un `integer` alors que
      // `current_value` est un `real` : un compteur à 1 234,5 h serait arrondi
      // par le pilote sans que rien ne le dise. On arrondit donc ici,
      // explicitement, pour que la troncature soit une décision lisible et non
      // un effet de bord du type de colonne.
      previousValue: Math.round(counter.currentValue ?? 0),
      resetReason: resetReason || "Manual reset",
      performedBy: performedBy ?? undefined,
      workOrderId
    });

    // Reset counter
    const [updatedCounter] = await executeur
      .update(maintenanceCounters)
      .set({
        currentValue: counter.lastResetValue,
        lastResetDate: new Date(),
        // L'alerte est levée AVEC la remise à zéro, et c'est indispensable :
        // `checkAndGenerateCounterAlert` ne produit une alerte que si
        // `alertEmailSent` est faux. Laissé à `true`, le compteur repartirait
        // de zéro mais resterait muet au cycle suivant — une échéance atteinte
        // sans que personne ne soit averti.
        alertLevel: "info",
        alertEmailSent: false,
        updatedAt: new Date()
      })
      .where(and(eq(maintenanceCounters.id, id), eq(maintenanceCounters.tenantId, tenantId)))
      .returning();

    return updatedCounter;
  }

  /**
   * Les compteurs actifs rattachés à un plan préventif.
   *
   * `isActive` est filtré ici, et non chez l'appelant : un compteur désactivé
   * l'a été délibérément (instrument démonté, suivi suspendu), et la clôture
   * d'une gamme ne doit pas le réveiller en lui écrivant une ligne
   * d'historique.
   */
  async getCompteursActifsDuPlan(
    planId: number,
    tenantId: string,
    executeur: ExecuteurBase = db,
  ): Promise<MaintenanceCounter[]> {
    return await executeur
      .select()
      .from(maintenanceCounters)
      .where(and(
        eq(maintenanceCounters.planId, planId),
        eq(maintenanceCounters.tenantId, tenantId),
        eq(maintenanceCounters.isActive, true),
      ))
      .orderBy(maintenanceCounters.id);
  }

  async deleteMaintenanceCounter(id: number, tenantId: string): Promise<void> {
    // Delete history first due to foreign key constraints
    await db.delete(counterHistory)
      .where(and(eq(counterHistory.counterId, id), eq(counterHistory.tenantId, tenantId)));
    
    // Delete counter
    await db.delete(maintenanceCounters)
      .where(and(eq(maintenanceCounters.id, id), eq(maintenanceCounters.tenantId, tenantId)));
  }

  // Counter History Methods
  async getCounterHistory(counterId: number, tenantId: string): Promise<CounterHistory[]> {
    return await db.select().from(counterHistory)
      .where(and(eq(counterHistory.counterId, counterId), eq(counterHistory.tenantId, tenantId)))
      .orderBy(desc(counterHistory.createdAt));
  }

  // Helper method to check and generate alerts for counters
  async checkAndGenerateCounterAlert(counter: MaintenanceCounter): Promise<void> {
    if (!counter.thresholdValue) return;
    const percentage = ((counter.currentValue ?? 0) / counter.thresholdValue) * 100;
    let alertLevel: "info" | "warning" | "critical" = "info";
    let shouldGenerateAlert = false;

    // Determine alert level based on schema fields (warningThresholdPct) with safe defaults
    const warningThreshold = (counter as any).warningThresholdPct ?? 90;
    const criticalThreshold = Math.min(100, warningThreshold + 8);

    if (percentage >= criticalThreshold) {
      alertLevel = "critical";
      shouldGenerateAlert = true;
    } else if (percentage >= warningThreshold) {
      alertLevel = "warning";
      shouldGenerateAlert = percentage >= 95; // Generate warning at 95%
    }

    // Update counter alert level if changed
    if (counter.alertLevel !== alertLevel) {
      await db.update(maintenanceCounters)
        .set({ alertLevel, updatedAt: new Date() })
        .where(eq(maintenanceCounters.id, counter.id));
    }

    // Generate alert if needed and not already sent
    if (shouldGenerateAlert && !counter.alertEmailSent) {
      // ⚠️ LE MESSAGE DISAIT « null is due for null ».
      //
      // Il était composé de `equipmentName` et `maintenanceType`, deux champs
      // facultatifs de `maintenance_counters` — et `equipmentName` est une
      // copie dénormalisée vide sur la plupart des lignes. Relevé en
      // provoquant l'alerte depuis l'écran : « Maintenance due: null » /
      // « null is due for null. Current value: 2025.5/2000 hours ».
      //
      // Le défaut n'avait jamais pu se voir : rien n'augmentait les compteurs
      // avant ce lot, donc ce chemin ne s'exécutait pas. Une alerte de
      // maintenance qui ne nomme pas la machine ne sert à rien — et le reste
      // de la plateforme est en français.
      //
      // Le nom est donc résolu depuis `equipment_registry`, DANS le locataire,
      // avec la copie en repli ; et chaque morceau absent est remplacé par une
      // formulation qui reste vraie au lieu d'imprimer « null ».
      let nomEquipement = counter.equipmentName ?? null;
      // ⚠️ `maintenance_counters.tenant_id` est NULLABLE dans ce schéma. Sans
      // locataire, on ne résout PAS : une lecture non cloisonnée irait
      // chercher le nom d'un équipement de n'importe quelle organisation pour
      // le mettre dans l'alerte. Mieux vaut une alerte qui dit « un équipement
      // non identifié » qu'une alerte qui nomme la machine d'autrui.
      if (!nomEquipement && counter.equipmentId != null && counter.tenantId) {
        const [equipement] = await db
          .select({ nom: equipmentRegistry.equipmentName })
          .from(equipmentRegistry)
          .where(and(
            eq(equipmentRegistry.id, counter.equipmentId),
            eq(equipmentRegistry.tenantId, counter.tenantId),
          ));
        nomEquipement = equipement?.nom ?? null;
      }

      const UNITES_FR: Record<string, string> = {
        hours: "h", cycles: "cycles", kilometers: "km", units: "unités",
      };
      const unite = UNITES_FR[counter.counterType] ?? counter.counterType;
      const cible = nomEquipement ?? "un équipement non identifié";
      const gamme = counter.maintenanceType || counter.description || "Maintenance périodique";

      await this.createAlert({
        tenantId: counter.tenantId,
        alertType: "maintenance_due",
        equipmentId: counter.equipmentId,
        severity: alertLevel,
        title: `Échéance de maintenance atteinte — ${cible}`,
        message:
          `${gamme} est due sur ${cible} : ` +
          `${counter.currentValue ?? 0} ${unite} relevés pour une périodicité de ` +
          `${counter.thresholdValue} ${unite}.`,
        triggerValue: counter.currentValue?.toString(),
        thresholdValue: counter.thresholdValue?.toString()
      });

      // Mark email as sent
      await db.update(maintenanceCounters)
        .set({ alertEmailSent: true, updatedAt: new Date() })
        .where(eq(maintenanceCounters.id, counter.id));
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * COMPTEUR → ORDRE DE TRAVAIL PRÉVENTIF
   * ═══════════════════════════════════════════════════════════════════
   *
   * CE QUI ÉTAIT
   * ───────────────────────────────────────────────────────────────────
   * Un compteur qui atteignait son seuil produisait une ALERTE, et rien
   * d'autre (audit fonctionnel du 2026-10-25, section 1 : « Compteur → OT
   * préventif : ouverte — le compteur crée une alerte, jamais un OT »).
   *
   * Une alerte se lit, s'acquitte, et disparaît. Elle ne porte ni affectation,
   * ni durée estimée, ni pièces, ni traçabilité d'exécution — et surtout elle
   * ne se CLÔTURE pas, donc elle ne remet pas le compteur à zéro. L'échéance
   * restait donc indéfiniment atteinte, à crier la même chose à chaque relevé.
   *
   * CE QUI SE PASSE MAINTENANT
   * ───────────────────────────────────────────────────────────────────
   * Le franchissement du seuil crée un ordre de travail préventif rattaché au
   * plan. Sa clôture replanifie le plan et REMET LE COMPTEUR À ZÉRO
   * (migration 0024) : le cycle se referme sur lui-même, et c'est ce qui
   * distingue cette boucle d'une alerte de plus.
   *
   * POURQUOI AU SEUIL D'ALERTE, ET NON À 100 %
   * ───────────────────────────────────────────────────────────────────
   * `warningThresholdPct` est exactement le champ que l'exploitant règle pour
   * « prévenir assez tôt pour laisser le temps de programmer » — c'est le
   * libellé de l'écran. Créer l'ordre à 100 % le ferait naître déjà en retard,
   * ce qui est le défaut qu'on vient de corriger ailleurs sur les plans
   * calendaires.
   *
   * CE QUI N'EST PAS INVENTÉ
   * ───────────────────────────────────────────────────────────────────
   *   • pas d'échéance (`scheduledStart`) : un plan réglé sur un compteur n'a
   *     pas de date, et en déduire une demanderait une cadence d'usage —
   *     c'est-à-dire une prévision. Le planificateur la pose ;
   *   • `requiresShutdown` reste à `false`, le défaut prudent posé en 0024 :
   *     le plan ne dit pas si la gamme immobilise la machine ;
   *   • la priorité vient de la MESURE (la part du seuil consommée), pas d'un
   *     tirage ni d'une constante. Jamais « urgent » : un préventif dû n'est
   *     pas une urgence, et le dire le mettrait au même rang qu'une panne ;
   *   • la durée estimée vient du plan quand il la porte, et reste absente
   *     sinon.
   *
   * @returns l'ordre créé, ou `null` avec le motif journalisé.
   */
  async creerOrdreTravailSiEcheanceCompteurAtteinte(
    counter: MaintenanceCounter,
  ): Promise<WorkOrder | null> {
    // ── Un compteur SANS PLAN ne crée pas d'ordre, et c'est la condition la
    //    plus importante de cette fonction.
    //
    //    La remise à zéro à la clôture se fait PAR LE PLAN
    //    (`getCompteursActifsDuPlan`). Un ordre créé pour un compteur sans
    //    plan ne pourrait donc jamais remettre ce compteur à zéro : le
    //    compteur resterait au-dessus de son seuil, et le relevé suivant
    //    créerait un nouvel ordre, indéfiniment. On refuserait de fermer la
    //    boucle tout en fabriquant du travail — pire que de ne rien faire.
    //
    //    L'écran des compteurs affiche « aucune gamme rattachée » : le cas est
    //    visible, et se corrige en rattachant le compteur à une gamme.
    if (counter.planId == null) return null;
    if (counter.equipmentId == null) return null;
    if (!counter.tenantId) return null;
    if (counter.isActive === false) return null;
    if (!counter.thresholdValue || counter.thresholdValue <= 0) return null;

    const part = ((counter.currentValue ?? 0) / counter.thresholdValue) * 100;
    const seuilAlerte = counter.warningThresholdPct ?? 90;
    if (part < seuilAlerte) return null;

    const tenantId = counter.tenantId;

    // Le plan doit exister, appartenir au demandeur et être actif. Un plan
    // désactivé décrit une gamme qu'on a cessé d'appliquer : lui créer du
    // travail irait contre une décision d'exploitation.
    const [plan] = await db
      .select()
      .from(preventiveMaintenancePlans)
      .where(and(
        eq(preventiveMaintenancePlans.id, counter.planId),
        eq(preventiveMaintenancePlans.tenantId, tenantId),
      ));
    if (!plan || plan.isActive === false) return null;

    // ── GARDE D'IDEMPOTENCE ─────────────────────────────────────────
    //
    // Le compteur est relu régulièrement, et chaque relevé repasse ici. Sans
    // cette garde, un ordre naîtrait à CHAQUE relevé au-dessus du seuil.
    //
    // La garde porte sur (locataire, plan, équipement) et non sur le compteur :
    // un plan peut porter plusieurs compteurs (heures ET cycles), et la gamme
    // ne s'exécute qu'une fois. Deux ordres pour la même gamme feraient
    // exécuter deux fois le même travail, et la seconde clôture avancerait
    // l'échéance d'une période de trop.
    //
    // Le filtre est posé EN SQL et sans limite de lignes. Le motif existant
    // ailleurs dans ce dépôt (`predictive-maintenance-engine.ts`) relit les
    // cinq derniers ordres de l'équipement et cherche parmi eux : un ordre
    // ouvert plus ancien que ces cinq lui échappe, et il en crée un doublon.
    const [dejaOuvert] = await db
      .select({ id: workOrders.id, orderNumber: workOrders.orderNumber })
      .from(workOrders)
      .where(and(
        eq(workOrders.tenantId, tenantId),
        eq(workOrders.planId, counter.planId),
        eq(workOrders.equipmentId, counter.equipmentId),
        notInArray(workOrders.status, ['completed', 'cancelled']),
      ))
      .limit(1);

    if (dejaOuvert) {
      console.log(
        `Compteur #${counter.id} au-delà de son seuil — ordre ${dejaOuvert.orderNumber} déjà ouvert pour le plan #${counter.planId}`,
      );
      return null;
    }

    // ── Création ────────────────────────────────────────────────────
    const UNITES_FR: Record<string, string> = {
      hours: "h", cycles: "cycles", kilometers: "km", units: "unités",
    };
    const unite = UNITES_FR[counter.counterType] ?? counter.counterType;
    const libelleCompteur = counter.description || `compteur ${unite}`;

    // La priorité est DÉDUITE DE LA MESURE. Le seuil critique est celui que
    // `checkAndGenerateCounterAlert` emploie déjà, pour que la priorité de
    // l'ordre et la sévérité de l'alerte ne puissent pas se contredire.
    const seuilCritique = Math.min(100, seuilAlerte + 8);
    const priorite = part >= seuilCritique ? 'high' : 'medium';

    const ordre = await this.createWorkOrder({
      tenantId,
      equipmentId: counter.equipmentId,
      planId: counter.planId,
      orderType: 'preventive',
      title: `${plan.planName} — échéance compteur atteinte`,
      description:
        `Créé automatiquement : le compteur « ${libelleCompteur} » a atteint son échéance. ` +
        `Relevé ${counter.currentValue ?? 0} ${unite} pour une périodicité de ${counter.thresholdValue} ${unite} ` +
        `(${part.toFixed(0)} %). La clôture de cet ordre replanifiera le plan « ${plan.planName} » ` +
        `et remettra ce compteur à zéro.`,
      priority: priorite,
      status: 'pending',
      // `false` : le plan ne dit pas si la gamme immobilise la machine, et
      // déclarer un arrêt qui n'a pas lieu rendrait indisponible un équipement
      // qui produit.
      requiresShutdown: false,
      ...(plan.estimatedDuration != null ? { estimatedDuration: plan.estimatedDuration } : {}),
    } as InsertWorkOrder);

    console.log(
      `Compteur #${counter.id} → ordre de travail ${ordre.orderNumber} créé ` +
      `(plan #${plan.id}, ${part.toFixed(0)} % du seuil)`,
    );
    return ordre;
  }

  /**
   * Le compteur vient de changer d'état : on en tire TOUTES les conséquences.
   *
   * Deux conséquences, et il fallait un seul point d'entrée pour qu'aucun
   * appelant n'en oublie une :
   *
   *   1. l'alerte, qui prévient ;
   *   2. l'ordre de travail préventif, qui fait exécuter — et dont la clôture
   *      remet le compteur à zéro, refermant la boucle.
   *
   * `checkAndGenerateCounterAlert` reste la primitive d'alerte, et garde son
   * nom : une fonction qui s'appelle « generate alert » et qui créerait aussi
   * des ordres de travail mentirait sur ce qu'elle fait.
   *
   * Chaque conséquence est indépendante : l'échec de l'une ne doit pas priver
   * de l'autre. Un ordre de travail créé sans alerte reste utile, et
   * l'inverse aussi.
   */
  async traiterEcheanceCompteur(counter: MaintenanceCounter): Promise<void> {
    await this.checkAndGenerateCounterAlert(counter).catch((err) =>
      console.error("Alerte de compteur non générée (best-effort):", err),
    );
    await this.creerOrdreTravailSiEcheanceCompteurAtteinte(counter).catch((err) =>
      console.error("Ordre de travail de compteur non créé (best-effort):", err),
    );
  }

  /**
   * Les ordres de travail préventifs OUVERTS, indexés par « plan:équipement ».
   *
   * Sert à l'écran des compteurs : sans cette information, un compteur affiche
   * « échéance atteinte » sans dire qu'un ordre a déjà été créé pour elle — et
   * l'exploitant en saisit un second à la main. La clé composée est celle de
   * la garde d'idempotence ci-dessus, pour que l'écran montre exactement ce
   * que le serveur considère comme déjà pris en charge.
   */
  async getOrdresPreventifsOuvertsParPlan(tenantId: string): Promise<Map<string, { id: number; orderNumber: string }>> {
    const ouverts = await db
      .select({
        id: workOrders.id,
        orderNumber: workOrders.orderNumber,
        planId: workOrders.planId,
        equipmentId: workOrders.equipmentId,
      })
      .from(workOrders)
      .where(and(
        eq(workOrders.tenantId, tenantId),
        notInArray(workOrders.status, ['completed', 'cancelled']),
        eq(workOrders.orderType, 'preventive'),
      ))
      .orderBy(desc(workOrders.createdAt));

    const index = new Map<string, { id: number; orderNumber: string }>();
    for (const o of ouverts) {
      if (o.planId == null || o.equipmentId == null) continue;
      const cle = `${o.planId}:${o.equipmentId}`;
      // Le plus récent gagne : `orderBy` descendant, et on ne remplace pas une
      // entrée déjà posée.
      if (!index.has(cle)) index.set(cle, { id: o.id, orderNumber: o.orderNumber });
    }
    return index;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * DEMANDES D'INTERVENTION — signaler, arbitrer, convertir ou refuser
   * ═══════════════════════════════════════════════════════════════════
   * Voir l'en-tête de `intervention_requests` dans shared/schema.ts et la
   * migration 0026 pour le pourquoi.
   */
  async getDemandesIntervention(
    tenantId: string,
    filtres: { status?: string } = {},
  ): Promise<Array<InterventionRequest & {
    equipmentName: string | null;
    workOrderNumber: string | null;
  }>> {
    const conditions = [eq(interventionRequests.tenantId, tenantId)];
    if (filtres.status) conditions.push(eq(interventionRequests.status, filtres.status));

    const lignes = await db
      .select({
        demande: interventionRequests,
        // Le nom vient du registre, DANS le locataire — jamais d'une copie
        // dénormalisée. Le lot des compteurs a montré ce que coûte l'inverse :
        // un écran qui affiche « non précisé » pour un équipement connu.
        equipmentName: equipmentRegistry.equipmentName,
        workOrderNumber: workOrders.orderNumber,
      })
      .from(interventionRequests)
      .leftJoin(equipmentRegistry, and(
        eq(interventionRequests.equipmentId, equipmentRegistry.id),
        eq(equipmentRegistry.tenantId, tenantId),
      ))
      .leftJoin(workOrders, and(
        eq(interventionRequests.workOrderId, workOrders.id),
        eq(workOrders.tenantId, tenantId),
      ))
      .where(and(...conditions))
      .orderBy(desc(interventionRequests.createdAt));

    return lignes.map(({ demande, equipmentName, workOrderNumber }) => ({
      ...demande,
      equipmentName: equipmentName ?? null,
      workOrderNumber: workOrderNumber ?? null,
    }));
  }

  async getDemandeInterventionById(id: number, tenantId: string): Promise<InterventionRequest | undefined> {
    const [demande] = await db
      .select()
      .from(interventionRequests)
      .where(and(eq(interventionRequests.id, id), eq(interventionRequests.tenantId, tenantId)));
    return demande;
  }

  /** La demande née d'une alerte donnée, s'il en existe une encore vivante. */
  async getDemandePourAlerte(alertId: number, tenantId: string): Promise<InterventionRequest | undefined> {
    // « Vivante » = ni refusée ni annulée : une alerte dont la demande a été
    // refusée peut être re-signalée (les circonstances ont pu changer), mais
    // une alerte dont la demande est en attente ou déjà convertie ne doit pas
    // produire un doublon.
    const [demande] = await db
      .select()
      .from(interventionRequests)
      .where(and(
        eq(interventionRequests.alertId, alertId),
        eq(interventionRequests.tenantId, tenantId),
        inArray(interventionRequests.status, ['pending', 'accepted']),
      ))
      .orderBy(desc(interventionRequests.createdAt));
    return demande;
  }

  async createDemandeIntervention(data: Omit<InsertInterventionRequest, 'requestNumber'>): Promise<InterventionRequest> {
    const requestNumber = `DI-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const [demande] = await db
      .insert(interventionRequests)
      .values({ ...data, requestNumber })
      .returning();
    return demande;
  }

  /**
   * ACCEPTER une demande : elle devient un ordre de travail.
   *
   * TRANSACTIONNEL, et la raison est la règle du dépôt
   * (docs/TRANSACTIONS.md) : deux écritures qui doivent être vraies ensemble.
   * Un ordre créé sans que la demande soit marquée acceptée se ferait
   * re-convertir au clic suivant — deux ordres pour un signalement. Une
   * demande marquée acceptée sans ordre créé serait un signalement classé
   * « pris en charge » dont le travail n'existe nulle part : le pire des deux,
   * parce qu'il est invisible.
   *
   * Le VERROU sur la demande est ce qui rend l'arbitrage sûr face à deux
   * arbitres simultanés. Sans lui, les deux liraient `pending` et créeraient
   * chacun un ordre.
   *
   * La priorité et le type viennent de l'ARBITRE, pas de la demande :
   * l'urgence perçue par le demandeur reste une information, elle n'engage pas
   * la planification. C'est toute la raison d'être de la séparation DI / OT.
   */
  async accepterDemandeIntervention(
    id: number,
    tenantId: string,
    decision: {
      orderType: string;
      priority: string;
      requiresShutdown: boolean;
      assignedTo?: number | null;
      estimatedHours?: number;
      reviewNotes?: string;
      reviewedBy?: number | null;
    },
  ): Promise<{ demande: InterventionRequest; ordre: WorkOrder }> {
    return db.transaction(async (tx) => {
      const [avant] = await tx
        .select()
        .from(interventionRequests)
        .where(and(eq(interventionRequests.id, id), eq(interventionRequests.tenantId, tenantId)))
        .for('update');

      if (!avant) throw new DemandeIntrouvable(id);
      if (avant.status !== 'pending') throw new DemandeDejaArbitree(id, avant.status);

      const orderNumber = `WO-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const [ordre] = await tx
        .insert(workOrders)
        .values({
          tenantId,
          orderNumber,
          equipmentId: avant.equipmentId,
          orderType: decision.orderType,
          title: avant.title,
          // La demande d'origine est citée dans la description : c'est le seul
          // endroit où un technicien qui ouvre l'ordre voit ce qui a été
          // signalé, et par qui le signalement a été fait.
          description:
            `${avant.description}\n\n` +
            `— Né de la demande d'intervention ${avant.requestNumber}` +
            (avant.reportedLocation ? ` (lieu signalé : ${avant.reportedLocation})` : '') +
            `, urgence perçue par le demandeur : ${avant.urgency}.`,
          priority: decision.priority,
          status: 'pending',
          requiresShutdown: decision.requiresShutdown,
          // `requestedBy` porte le DEMANDEUR, pas l'arbitre : c'est lui qui a
          // signalé, et c'est à lui qu'on rendra compte.
          requestedBy: avant.requestedBy,
          assignedTo: decision.assignedTo ?? undefined,
          ...(decision.estimatedHours != null
            ? { estimatedDuration: Math.round(decision.estimatedHours * 60) }
            : {}),
        })
        .returning();

      const [demande] = await tx
        .update(interventionRequests)
        .set({
          status: 'accepted',
          workOrderId: ordre.id,
          reviewedBy: decision.reviewedBy ?? undefined,
          reviewedAt: new Date(),
          reviewNotes: decision.reviewNotes,
          updatedAt: new Date(),
        })
        .where(and(eq(interventionRequests.id, id), eq(interventionRequests.tenantId, tenantId)))
        .returning();

      return { demande, ordre };
    });
  }

  /**
   * REFUSER une demande, avec un motif.
   *
   * Le motif est ce qui rend la charge écartée MESURABLE — défaut n° 2 de
   * l'audit. Sans lui, un refus est indistinguable d'un oubli, et personne ne
   * peut dire combien de signalements ont été écartés ni pourquoi.
   *
   * Même verrou que l'acceptation : une demande déjà arbitrée ne se réarbitre
   * pas, sinon un refus pourrait écraser une acceptation et laisser un ordre
   * de travail orphelin de sa demande.
   */
  async refuserDemandeIntervention(
    id: number,
    tenantId: string,
    rejectionReason: string,
    reviewedBy?: number | null,
  ): Promise<InterventionRequest> {
    return db.transaction(async (tx) => {
      const [avant] = await tx
        .select()
        .from(interventionRequests)
        .where(and(eq(interventionRequests.id, id), eq(interventionRequests.tenantId, tenantId)))
        .for('update');

      if (!avant) throw new DemandeIntrouvable(id);
      if (avant.status !== 'pending') throw new DemandeDejaArbitree(id, avant.status);

      const [demande] = await tx
        .update(interventionRequests)
        .set({
          status: 'rejected',
          rejectionReason,
          reviewedBy: reviewedBy ?? undefined,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(interventionRequests.id, id), eq(interventionRequests.tenantId, tenantId)))
        .returning();

      return demande;
    });
  }

  /** Le demandeur retire sa propre demande, tant qu'elle n'est pas arbitrée. */
  async annulerDemandeIntervention(
    id: number,
    tenantId: string,
  ): Promise<InterventionRequest> {
    return db.transaction(async (tx) => {
      const [avant] = await tx
        .select()
        .from(interventionRequests)
        .where(and(eq(interventionRequests.id, id), eq(interventionRequests.tenantId, tenantId)))
        .for('update');

      if (!avant) throw new DemandeIntrouvable(id);
      if (avant.status !== 'pending') throw new DemandeDejaArbitree(id, avant.status);

      const [demande] = await tx
        .update(interventionRequests)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(interventionRequests.id, id), eq(interventionRequests.tenantId, tenantId)))
        .returning();

      return demande;
    });
  }

  /**
   * Le compte des demandes par état — la CHARGE, y compris celle qu'on a
   * écartée.
   *
   * C'est la mesure que l'absence de table rendait impossible : « le refus
   * motivé n'existe pas, donc la charge non traitée n'est pas mesurable ».
   */
  async getChargeDemandes(tenantId: string): Promise<Record<string, number>> {
    const lignes = await db
      .select({ status: interventionRequests.status, n: count() })
      .from(interventionRequests)
      .where(eq(interventionRequests.tenantId, tenantId))
      .groupBy(interventionRequests.status);

    const parEtat: Record<string, number> = { pending: 0, accepted: 0, rejected: 0, cancelled: 0 };
    for (const l of lignes) parEtat[l.status] = Number(l.n);
    return parEtat;
  }

  // Spare Parts Methods
  async getSpareParts(tenantId: string): Promise<SparePart[]> {
    return await db.select().from(spareParts)
      .where(eq(spareParts.tenantId, tenantId))
      .orderBy(desc(spareParts.createdAt));
  }

  async getSparePartById(id: number, tenantId: string): Promise<SparePart | undefined> {
    const [part] = await db.select().from(spareParts)
      .where(and(eq(spareParts.id, id), eq(spareParts.tenantId, tenantId)));
    return part;
  }

  async getSparePartByPartNumber(partNumber: string, tenantId: string): Promise<SparePart | undefined> {
    const [part] = await db.select().from(spareParts)
      .where(and(eq(spareParts.partNumber, partNumber), eq(spareParts.tenantId, tenantId)));
    return part;
  }

  async getSparePartsByCategory(category: string, tenantId: string): Promise<SparePart[]> {
    return await db.select().from(spareParts)
      .where(and(eq(spareParts.category, category), eq(spareParts.tenantId, tenantId)))
      .orderBy(desc(spareParts.createdAt));
  }

  async getLowStockParts(tenantId: string): Promise<SparePart[]> {
    return await db.select().from(spareParts)
      .where(and(sql`${spareParts.currentStock} <= ${spareParts.reorderPoint}`, eq(spareParts.tenantId, tenantId)))
      .orderBy(desc(spareParts.createdAt));
  }

  async createSparePart(data: InsertSparePart): Promise<SparePart> {
    const [part] = await db.insert(spareParts).values(data).returning();
    return part;
  }

  async updateSparePart(id: number, tenantId: string, updates: Partial<SparePart>): Promise<SparePart> {
    // `tenantId` retiré des champs écrits : mesuré sur banc,
    // `PUT /api/spare-parts/:id` avec `{ tenantId: <autre> }` faisait sortir la
    // pièce de son entreprise — et le stock avec elle
    // (docs/EXAMEN_LISTES_BLANCHES.md, anomalie D). Le `WHERE` cloisonne la
    // ligne atteinte, pas la valeur écrite.
    const { tenantId: _jamaisModifiable, ...modifications } = updates;

    const [part] = await db
      .update(spareParts)
      .set({ ...modifications, updatedAt: new Date() })
      .where(and(eq(spareParts.id, id), eq(spareParts.tenantId, tenantId)))
      .returning();
    return part;
  }

  async deleteSparePart(id: number, tenantId: string): Promise<boolean> {
    try {
      const result = await db.delete(spareParts)
        .where(and(eq(spareParts.id, id), eq(spareParts.tenantId, tenantId)));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting spare part:", error);
      return false;
    }
  }

  // Stock Movements Methods
  async getStockMovements(tenantId?: string): Promise<StockMovement[]> {
    if (tenantId) {
      return await db.select().from(stockMovements)
        .innerJoin(spareParts, eq(stockMovements.sparePartId, spareParts.id))
        .where(eq(spareParts.tenantId, tenantId))
        .orderBy(desc(stockMovements.createdAt))
        .then(rows => rows.map(r => r.stock_movements));
    }
    return await db.select().from(stockMovements).orderBy(desc(stockMovements.createdAt));
  }

  async getStockMovementsByPart(sparePartId: number): Promise<StockMovement[]> {
    return await db.select().from(stockMovements)
      .where(eq(stockMovements.sparePartId, sparePartId))
      .orderBy(desc(stockMovements.createdAt));
  }

  async createStockMovement(data: InsertStockMovement, tenantId: string): Promise<StockMovement> {
    const [movement] = await db.insert(stockMovements).values(data).returning();
    
    // Update spare part stock
    if (data.sparePartId) {
      const part = await this.getSparePartById(data.sparePartId, tenantId);
      if (part) {
        let newStock = part.currentStock || 0;
        if (data.movementType === 'in' || data.movementType === 'return') {
          newStock += data.quantity;
        } else if (data.movementType === 'out') {
          newStock -= data.quantity;
        } else if (data.movementType === 'adjustment') {
          newStock = data.quantity;
        }
        
        await this.updateSparePart(data.sparePartId, tenantId, { currentStock: Math.max(0, newStock) });
      }
    }
    
    return movement;
  }

  // IoT Sensor Data Methods
  /**
   * Relevés de capteurs d'UN locataire.
   *
   * `equipmentId` reste facultatif — lire tout le parc du demandeur est un
   * besoin légitime — mais `tenantId` ne l'est plus. C'est la conjonction des
   * deux qui faisait la fuite : appelée sans équipement par
   * `GET /api/iot-data`, cette méthode partait sans AUCUNE condition et rendait
   * les relevés de toute l'instance.
   */
  async getIotSensorData(tenantId: string, equipmentId?: number, sensorType?: string, limit: number = 1000): Promise<IotSensorData[]> {
    const conditions = [eq(iotSensorData.tenantId, tenantId)];
    if (equipmentId) conditions.push(eq(iotSensorData.equipmentId, equipmentId));
    if (sensorType) conditions.push(eq(iotSensorData.sensorType, sensorType));

    // Plus de branche « aucune condition » : le locataire est toujours là.
    return await db.select().from(iotSensorData)
      .where(and(...conditions))
      .orderBy(desc(iotSensorData.timestamp))
      .limit(limit);
  }

  // Get alerts for equipment
  // Dérive des relevés : son cloisonnement est celui de la lecture appelée.
  async getAlerts(tenantId: string, equipmentId?: number, limit: number = 50): Promise<any[]> {
    // For now, generate mock alerts based on recent sensor data
    const sensorData = await this.getIotSensorData(tenantId, equipmentId, undefined, 20);
    const alerts: any[] = [];
    let alertId = 1;
    
    sensorData.forEach(reading => {
      const value = parseFloat(reading.value);

      if (reading.sensorType === 'temperature' && value > 75) {
        alerts.push({
          id: alertId++,
          severity: value > 85 ? 'critical' : 'warning',
          message: `Température élevée: ${reading.value}°C`,
          timestamp: reading.timestamp,
          equipmentId: reading.equipmentId
        });
      }

      if (reading.sensorType === 'vibration' && value > 4.5) {
        alerts.push({
          id: alertId++,
          severity: value > 6.0 ? 'critical' : 'warning',
          message: `Vibration excessive: ${reading.value} mm/s`,
          timestamp: reading.timestamp,
          equipmentId: reading.equipmentId
        });
      }

      if (reading.sensorType === 'pressure' && value > 4.0) {
        alerts.push({
          id: alertId++,
          severity: value > 5.0 ? 'critical' : 'warning',
          message: `Pression anormale: ${reading.value} bar`,
          timestamp: reading.timestamp,
          equipmentId: reading.equipmentId
        });
      }
    });
    
    return alerts.slice(0, limit);
  }

  async createIotSensorData(data: InsertIotSensorData): Promise<IotSensorData> {
    const [sensorData] = await db.insert(iotSensorData).values(data).returning();
    return sensorData;
  }

  /**
   * Résout le locataire d'un équipement, pour les chemins d'INGESTION qui ne
   * connaissent que lui.
   *
   * Le connecteur IoT reçoit des trames portant un identifiant d'équipement et
   * rien d'autre : il n'a pas de session, donc pas de locataire. Plutôt que de
   * laisser chaque LECTURE redériver le rattachement par jointure — ce qui est
   * précisément l'oubli qui a produit la fuite — on le résout une fois, à
   * l'écriture. Rend `undefined` pour un équipement inconnu, que l'appelant
   * doit traiter comme un refus d'écrire : un relevé sans locataire connu ne
   * doit pas entrer en base.
   */
  async resoudreLocataireEquipement(equipmentId: number): Promise<string | undefined> {
    const [equipement] = await db
      .select({ tenantId: equipmentRegistry.tenantId })
      .from(equipmentRegistry)
      .where(eq(equipmentRegistry.id, equipmentId))
      .limit(1);
    return equipement?.tenantId;
  }

  async getLatestSensorData(equipmentId: number, tenantId: string): Promise<IotSensorData[]> {
    return await db.select().from(iotSensorData)
      .where(and(eq(iotSensorData.equipmentId, equipmentId), eq(iotSensorData.tenantId, tenantId)))
      .orderBy(desc(iotSensorData.timestamp))
      .limit(10);
  }

  // Predictive Analytics Methods
  async getPredictiveAnalytics(equipmentId?: number): Promise<PredictiveAnalytics[]> {
    return await db.select().from(predictiveAnalytics)
      .where(equipmentId ? eq(predictiveAnalytics.equipmentId, equipmentId) : undefined)
      .orderBy(desc(predictiveAnalytics.createdAt));
  }

  async createPredictiveAnalytics(data: InsertPredictiveAnalytics): Promise<PredictiveAnalytics> {
    const [analytics] = await db.insert(predictiveAnalytics).values(data).returning();
    return analytics;
  }

  async getLatestPredictions(equipmentId: number): Promise<PredictiveAnalytics | undefined> {
    const [prediction] = await db.select().from(predictiveAnalytics)
      .where(eq(predictiveAnalytics.equipmentId, equipmentId))
      .orderBy(desc(predictiveAnalytics.createdAt))
      .limit(1);
    return prediction;
  }

  // KPI Metrics Methods
  async getKpiMetrics(equipmentId?: number, metricType?: string): Promise<KpiMetrics[]> {
    const conditions = [];
    if (equipmentId) conditions.push(eq(kpiMetrics.equipmentId, equipmentId));
    if (metricType) conditions.push(eq(kpiMetrics.metricType, metricType));

    return await db.select().from(kpiMetrics)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(kpiMetrics.calculationDate));
  }

  async createKpiMetrics(data: InsertKpiMetrics): Promise<KpiMetrics> {
    const [metrics] = await db.insert(kpiMetrics).values(data).returning();
    return metrics;
  }

  // ============= PREDICTIVE INSIGHTS DASHBOARD =============
  async getPredictiveInsightsDashboard(tenantId: string, equipmentId?: number): Promise<any> {
    // 1. Get equipment list
    let equipmentList = await db.select().from(equipmentRegistry)
      .where(eq(equipmentRegistry.tenantId, tenantId))
      .orderBy(equipmentRegistry.equipmentName);

    if (equipmentId) {
      equipmentList = equipmentList.filter(e => e.id === equipmentId);
    }

    const equipmentIds = equipmentList.map(e => e.id);

    // 2. Get latest sensor data per equipment (last 200 readings)
    // La liste d'équipements vient déjà d'une requête filtrée par locataire,
    // mais la condition est posée explicitement : un cloisonnement qui repose
    // sur la provenance d'une variable se perd au premier remaniement.
    const sensorDataRaw = equipmentIds.length > 0
      ? await db.select().from(iotSensorData)
          .where(and(
            eq(iotSensorData.tenantId, tenantId),
            equipmentIds.length === 1
              ? eq(iotSensorData.equipmentId, equipmentIds[0])
              : or(...equipmentIds.map(id => eq(iotSensorData.equipmentId, id)))!,
          ))
          .orderBy(desc(iotSensorData.timestamp))
          .limit(500)
      : [];

    // 3. Get predictive analytics
    const analyticsRaw = equipmentIds.length > 0
      ? await db.select().from(predictiveAnalytics)
          .where(equipmentIds.length === 1
            ? eq(predictiveAnalytics.equipmentId, equipmentIds[0])
            : or(...equipmentIds.map(id => eq(predictiveAnalytics.equipmentId, id)))
          )
          .orderBy(desc(predictiveAnalytics.createdAt))
          .limit(200)
      : [];

    // 4. Get KPI metrics
    const kpiRaw = equipmentIds.length > 0
      ? await db.select().from(kpiMetrics)
          .where(equipmentIds.length === 1
            ? eq(kpiMetrics.equipmentId, equipmentIds[0])
            : or(...equipmentIds.map(id => eq(kpiMetrics.equipmentId, id)))
          )
          .orderBy(desc(kpiMetrics.calculationDate))
          .limit(200)
      : [];

    // 5. Get open work orders per equipment
    const openWOs = await db.select({
      equipmentId: workOrders.equipmentId,
      cnt: count()
    }).from(workOrders)
      .where(and(
        eq(workOrders.tenantId, tenantId),
        or(eq(workOrders.status, 'pending'), eq(workOrders.status, 'in_progress'))
      ))
      .groupBy(workOrders.equipmentId);

    const openWOMap: Record<number, number> = {};
    openWOs.forEach((row: any) => {
      if (row.equipmentId) openWOMap[row.equipmentId] = Number(row.cnt);
    });

    // ─── Build equipment insights ───────────────────────────────────────────
    const equipmentInsights = equipmentList.map(eq => {
      // Latest analytics for this equipment
      const analytics = analyticsRaw.filter(a => a.equipmentId === eq.id);
      const latestAnalytic = analytics[0];

      // Latest sensor readings grouped by type
      const sensors = sensorDataRaw.filter(s => s.equipmentId === eq.id);
      const sensorByType: Record<string, any> = {};
      sensors.forEach(s => {
        if (!sensorByType[s.sensorType]) sensorByType[s.sensorType] = s;
      });

      const failureProbability = Math.min(latestAnalytic?.failureProbability ?? 0, 1);
      // Normalize anomaly score: raw values from IoT engine are in 2.0-4.0 range → map to 0-1
      const rawAnomaly = latestAnalytic?.anomalyScore ?? 0;
      const anomalyScore = rawAnomaly > 1 ? Math.min((rawAnomaly - 2.0) / 2.0, 1) : rawAnomaly;
      const rul = latestAnalytic?.remainingUsefulLife ?? null;
      const riskLevel = latestAnalytic?.riskLevel ?? this._computeRiskLevel(failureProbability, anomalyScore);
      const healthScore = this._computeHealthScore(failureProbability, anomalyScore, eq.criticalityLevel ?? 'medium');

      // Top sensor (most recent with highest alarm state)
      const alarmSensor = sensors.find(s => s.alarmState === 'alarm' || s.alarmState === 'critical')
        ?? sensors.find(s => s.alarmState === 'warning')
        ?? sensors[0];

      // Recommendations
      const recs: string[] = [];
      if (latestAnalytic?.recommendations && Array.isArray(latestAnalytic.recommendations)) {
        recs.push(...(latestAnalytic.recommendations as string[]).slice(0, 3));
      }
      if (recs.length === 0 && failureProbability > 0.6) recs.push("Planifier une intervention préventive urgente");
      if (recs.length === 0 && anomalyScore > 0.5) recs.push("Analyser les données capteurs anormales");
      if (recs.length === 0) recs.push("Surveiller les tendances de performance");

      // Predicted failure date
      let predictedFailureDate: string | null = null;
      if (rul != null && rul > 0) {
        const d = new Date();
        d.setDate(d.getDate() + rul);
        predictedFailureDate = d.toISOString();
      }

      return {
        id: eq.id,
        name: eq.equipmentName,
        type: eq.equipmentType,
        healthScore,
        riskLevel,
        remainingUsefulLife: rul,
        failureProbability,
        anomalyScore,
        lastSensorUpdate: sensors[0]?.timestamp?.toISOString() ?? null,
        topSensor: alarmSensor?.sensorType ?? null,
        topSensorValue: alarmSensor ? parseFloat(alarmSensor.value) : null,
        topSensorUnit: alarmSensor?.unit ?? null,
        openWorkOrders: openWOMap[eq.id] ?? 0,
        predictedFailureDate,
        recommendations: recs,
      };
    });

    // ─── Fleet summary ──────────────────────────────────────────────────────
    const total = equipmentInsights.length;
    const critical = equipmentInsights.filter(e => e.riskLevel === 'critical').length;
    const warning = equipmentInsights.filter(e => e.riskLevel === 'high' || e.riskLevel === 'medium').length;
    const healthy = total - critical - warning;
    const avgHealthScore = total > 0 ? Math.round(equipmentInsights.reduce((s, e) => s + e.healthScore, 0) / total) : 0;
    const ruls = equipmentInsights.filter(e => e.remainingUsefulLife != null).map(e => e.remainingUsefulLife!);
    const avgRul = ruls.length > 0 ? Math.round(ruls.reduce((a, b) => a + b, 0) / ruls.length) : 0;
    const criticalAlerts = equipmentInsights.filter(e => e.riskLevel === 'critical' || e.failureProbability > 0.7).length;
    const predictedFailuresNext30d = equipmentInsights.filter(e => e.remainingUsefulLife != null && e.remainingUsefulLife! <= 30).length;

    const fleetSummary = { total, healthy, warning, critical, avgHealthScore, avgRul, criticalAlerts, predictedFailuresNext30d };

    // ─── Sensor trends (time-series for charts) ─────────────────────────────
    // Bucket last 100 readings by hour
    const trendMap: Record<string, { temperature: number[], vibration: number[], pressure: number[], current: number[] }> = {};
    sensorDataRaw.slice(0, 200).forEach(s => {
      if (!s.timestamp) return;
      const ts = new Date(s.timestamp);
      const key = `${ts.toISOString().slice(0, 13)}:00`;
      if (!trendMap[key]) trendMap[key] = { temperature: [], vibration: [], pressure: [], current: [] };
      const type = s.sensorType as keyof typeof trendMap[string];
      if (type in trendMap[key]) trendMap[key][type].push(parseFloat(s.value));
    });

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const sensorTrends = Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-24)
      .map(([ts, vals]) => ({
        timestamp: ts,
        temperature: avg(vals.temperature),
        vibration: avg(vals.vibration),
        pressure: avg(vals.pressure),
        current: avg(vals.current),
      }));

    // ─── Failure probability timeline (30-day projection) ───────────────────
    const baseProb = equipmentInsights.length > 0
      ? equipmentInsights.reduce((s, e) => s + e.failureProbability, 0) / equipmentInsights.length
      : 0.05;

    const failureProbabilityTimeline = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const growthFactor = 1 + i * 0.015;
      const prob = Math.min(baseProb * growthFactor, 0.99);
      return {
        day: `J+${i}`,
        probability: Math.round(prob * 1000) / 1000,
        threshold: 0.5,
      };
    });

    // ─── Anomaly distribution ────────────────────────────────────────────────
    const anomalyDistribution = equipmentInsights
      .filter(e => e.anomalyScore > 0)
      .sort((a, b) => b.anomalyScore - a.anomalyScore)
      .slice(0, 10)
      .map(e => ({
        equipment: e.name.length > 20 ? e.name.slice(0, 18) + '…' : e.name,
        score: Math.round(e.anomalyScore * 1000) / 1000,
        count: 1,
      }));

    // ─── KPI Radar ───────────────────────────────────────────────────────────
    const mtbfVals = kpiRaw.filter(k => k.metricType === 'mtbf').map(k => parseFloat(k.metricValue));
    const mttrVals = kpiRaw.filter(k => k.metricType === 'mttr').map(k => parseFloat(k.metricValue));
    const availVals = kpiRaw.filter(k => k.metricType === 'availability').map(k => parseFloat(k.metricValue));
    const oeeVals = kpiRaw.filter(k => k.metricType === 'oee').map(k => parseFloat(k.metricValue));

    const clamp = (v: number, max = 100) => Math.min(Math.round(v), max);
    const kpiRadar = [
      { metric: "Disponibilité", value: availVals.length ? clamp(avg(availVals)!) : Math.round(avgHealthScore * 0.9), benchmark: 95 },
      { metric: "MTBF (norm.)", value: mtbfVals.length ? clamp(Math.min(avg(mtbfVals)! / 5, 100)) : 70, benchmark: 80 },
      { metric: "MTTR (inv.)", value: mttrVals.length ? clamp(100 - Math.min(avg(mttrVals)! * 5, 100)) : 75, benchmark: 85 },
      { metric: "OEE", value: oeeVals.length ? clamp(avg(oeeVals)!) : Math.round(avgHealthScore * 0.85), benchmark: 85 },
      { metric: "Santé flotte", value: avgHealthScore, benchmark: 90 },
      { metric: "Prédictibilité", value: analyticsRaw.length > 0 ? Math.min(75 + Math.round(analyticsRaw.length / 2), 95) : 60, benchmark: 80 },
    ];

    // ─── Maintenance window suggestions ─────────────────────────────────────
    const maintenanceWindowSuggestions = equipmentInsights
      .filter(e => e.failureProbability > 0.2 || (e.remainingUsefulLife != null && e.remainingUsefulLife <= 60))
      .sort((a, b) => b.failureProbability - a.failureProbability)
      .slice(0, 8)
      .map(e => {
        const daysUntil = e.remainingUsefulLife != null ? Math.max(e.remainingUsefulLife - 7, 1) : 14;
        const d = new Date();
        d.setDate(d.getDate() + daysUntil);
        return {
          equipmentId: e.id,
          equipmentName: e.name,
          suggestedDate: d.toISOString(),
          urgency: e.riskLevel as "low" | "medium" | "high" | "critical",
          estimatedDuration: e.riskLevel === 'critical' ? 8 : e.riskLevel === 'high' ? 4 : 2,
          reason: e.recommendations[0] ?? `Probabilité de panne: ${Math.round(e.failureProbability * 100)}%`,
        };
      });

    return {
      equipment: equipmentInsights,
      fleetSummary,
      sensorTrends,
      failureProbabilityTimeline,
      anomalyDistribution,
      kpiRadar,
      maintenanceWindowSuggestions,
    };
  }

  // ============= DEMO DATA SEEDING =============
  async seedPredictiveInsightsDemoData(tenantId: string): Promise<{ inserted: number }> {
    const equips = await db.select().from(equipmentRegistry)
      .where(eq(equipmentRegistry.tenantId, tenantId))
      .orderBy(equipmentRegistry.id)
      .limit(10);

    if (equips.length === 0) return { inserted: 0 };

    let inserted = 0;

    // Risk profiles to make the dashboard interesting
    const profiles = [
      { failureProb: 0.82, anomalyScore: 0.78, rul: 8, risk: 'critical', recs: ['Arrêt machine préventif requis', 'Vérifier roulements et joints', 'Commander pièces de rechange'] },
      { failureProb: 0.61, anomalyScore: 0.58, rul: 22, risk: 'high', recs: ['Inspection vibratoire planifiée', 'Nettoyer filtres de lubrification'] },
      { failureProb: 0.45, anomalyScore: 0.41, rul: 38, risk: 'high', recs: ['Mesures thermiques à réaliser', 'Ajuster paramètres de charge'] },
      { failureProb: 0.30, anomalyScore: 0.28, rul: 55, risk: 'medium', recs: ['Surveillance continue recommandée'] },
      { failureProb: 0.18, anomalyScore: 0.15, rul: 80, risk: 'medium', recs: ['Maintenance préventive planifiée dans 3 mois'] },
      { failureProb: 0.08, anomalyScore: 0.07, rul: 120, risk: 'low', recs: ['Fonctionnement nominal — aucune action requise'] },
      { failureProb: 0.72, anomalyScore: 0.69, rul: 14, risk: 'critical', recs: ['Intervention urgente nécessaire', 'Probabilité de panne > 70%'] },
      { failureProb: 0.35, anomalyScore: 0.32, rul: 48, risk: 'medium', recs: ['Calibration capteurs recommandée'] },
      { failureProb: 0.12, anomalyScore: 0.10, rul: 95, risk: 'low', recs: ['Équipement en bon état opérationnel'] },
      { failureProb: 0.55, anomalyScore: 0.50, rul: 30, risk: 'high', recs: ['Vérification électrique préventive', 'Tester protections thermiques'] },
    ];

    const now = new Date();

    // Insert predictive analytics for each equipment
    for (let i = 0; i < equips.length; i++) {
      const eq = equips[i];
      const profile = profiles[i % profiles.length];

      await db.insert(predictiveAnalytics).values({
        tenantId,
        equipmentId: eq.id,
        analysisType: 'rul',
        predictionDate: now,
        remainingUsefulLife: profile.rul,
        failureProbability: profile.failureProb,
        anomalyScore: profile.anomalyScore,
        confidenceLevel: 0.85,
        riskLevel: profile.risk,
        recommendations: profile.recs,
        modelVersion: 'demo-v2',
        alertGenerated: profile.risk === 'critical',
        createdAt: now,
      });
      inserted++;

      // Insert KPI metrics: MTBF, MTTR, availability, OEE
      const periodStart = new Date(now);
      periodStart.setDate(now.getDate() - 30);

      const kpis = [
        { type: 'mtbf', value: String(120 + Math.round(Math.random() * 200)) },
        { type: 'mttr', value: String(2 + Math.round(Math.random() * 8)) },
        { type: 'availability', value: String(70 + Math.round((1 - profile.failureProb) * 25)) },
        { type: 'oee', value: String(60 + Math.round((1 - profile.failureProb) * 30)) },
      ];

      for (const kpi of kpis) {
        await db.insert(kpiMetrics).values({
          tenantId,
          equipmentId: eq.id,
          metricType: kpi.type,
          metricValue: kpi.value,
          periodStart,
          periodEnd: now,
          calculationDate: now,
          context: { source: 'demo-seed', equipment: eq.equipmentName },
        });
        inserted++;
      }

      // Insert historical sensor trends (last 24 hours, hourly)
      for (let h = 23; h >= 0; h--) {
        const ts = new Date(now);
        ts.setHours(now.getHours() - h);
        const noiseT = (Math.random() - 0.5) * 8;
        const noiseV = (Math.random() - 0.5) * 1.5;
        const noiseP = (Math.random() - 0.5) * 0.4;
        const noiseA = (Math.random() - 0.5) * 2;
        const trendFactor = (24 - h) / 24;

        const sensorReadings = [
          { type: 'temperature', value: String((55 + profile.failureProb * 30 + noiseT + trendFactor * 5).toFixed(2)), unit: '°C', sensorId: `TEMP-DEMO-${eq.id}` },
          { type: 'vibration', value: String((2.5 + profile.anomalyScore * 4 + noiseV + trendFactor * 0.8).toFixed(3)), unit: 'mm/s', sensorId: `VIB-DEMO-${eq.id}` },
          { type: 'pressure', value: String((3.5 + noiseP + trendFactor * 0.3).toFixed(2)), unit: 'bar', sensorId: `PRESS-DEMO-${eq.id}` },
          { type: 'current', value: String((10 + noiseA + trendFactor * 1.5).toFixed(2)), unit: 'A', sensorId: `CURR-DEMO-${eq.id}` },
        ];

        for (const s of sensorReadings) {
          const alarmState = parseFloat(s.value) > 85 && s.type === 'temperature' ? 'alarm'
            : parseFloat(s.value) > 75 && s.type === 'temperature' ? 'warning'
            : parseFloat(s.value) > 6 && s.type === 'vibration' ? 'alarm'
            : parseFloat(s.value) > 4.5 && s.type === 'vibration' ? 'warning'
            : 'normal';

          await db.insert(iotSensorData).values({
            tenantId,
            equipmentId: eq.id,
            sensorType: s.type,
            sensorId: s.sensorId,
            value: s.value,
            unit: s.unit,
            timestamp: ts,
            quality: 'good',
            alarmState,
          });
          inserted++;
        }
      }
    }

    return { inserted };
  }

  private _computeRiskLevel(failureProb: number, anomalyScore: number): string {
    const combined = failureProb * 0.7 + anomalyScore * 0.3;
    if (combined >= 0.65) return 'critical';
    if (combined >= 0.4) return 'high';
    if (combined >= 0.2) return 'medium';
    return 'low';
  }

  private _computeHealthScore(failureProb: number, anomalyScore: number, criticality: string): number {
    const critWeight = criticality === 'critical' ? 1.2 : criticality === 'high' ? 1.1 : 1.0;
    const degradation = (failureProb * 0.6 + anomalyScore * 0.4) * critWeight;
    return Math.max(0, Math.round(100 - degradation * 100));
  }

  // Integration Log Methods
  async getIntegrationLog(systemName?: string): Promise<IntegrationLog[]> {
    return await db.select().from(integrationLog)
      .where(systemName ? eq(integrationLog.systemName, systemName) : undefined)
      .orderBy(desc(integrationLog.processedAt));
  }

  async createIntegrationLog(data: InsertIntegrationLog): Promise<IntegrationLog> {
    const [log] = await db.insert(integrationLog).values(data).returning();
    return log;
  }

  // Alerts and Notifications Methods
  async getAlertsNotifications(status?: string, tenantId?: string, maxLimit: number = 100): Promise<AlertsNotifications[]> {
    const conditions: any[] = [];
    
    if (status) {
      conditions.push(eq(alertsNotifications.status, status));
    }
    
    if (tenantId) {
      conditions.push(eq(alertsNotifications.tenantId, tenantId));
    }
    
    return await db.select().from(alertsNotifications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(alertsNotifications.createdAt))
      .limit(maxLimit);
  }

  /**
   * Une alerte, DANS le locataire.
   *
   * Il n'existait aucune lecture unitaire cloisonnée de cette table : seules
   * la liste et la lecture par équipement. Le signalement d'une alerte à la
   * maintenance en a besoin — et une alerte d'autrui doit s'y lire comme un
   * objet absent, sinon son titre et son message passeraient dans la demande
   * créée.
   */
  async getAlertById(id: number, tenantId: string): Promise<AlertsNotifications | undefined> {
    const [alerte] = await db
      .select()
      .from(alertsNotifications)
      .where(and(eq(alertsNotifications.id, id), eq(alertsNotifications.tenantId, tenantId)));
    return alerte;
  }

  /**
   * Les identifiants des profils du locataire — pour vérifier qu'une
   * affectation désigne quelqu'un de l'organisation.
   *
   * Ne rend QUE les identifiants et le nom : cette méthode sert à valider une
   * affectation, pas à servir des profils. Rendre les lignes entières ferait
   * passer des secrets d'authentification par un chemin qui n'a aucune raison
   * de les connaître — `/api/user-profiles` les retire explicitement, et un
   * second chemin qui l'oublierait annulerait cette précaution.
   */
  async getIdentifiantsProfils(tenantId: string): Promise<Array<{ id: number; username: string }>> {
    return await db
      .select({ id: userProfiles.id, username: userProfiles.username })
      .from(userProfiles)
      .where(eq(userProfiles.tenantId, tenantId));
  }

  async getAlertsByEquipment(equipmentId: number, tenantId: string): Promise<AlertsNotifications[]> {
    // Le locataire est OBLIGATOIRE et positionnel : la route
    // `/api/equipment/:id/alerts` lisait les alertes d'un équipement sur son
    // seul identifiant numérique, donc celles d'un équipement d'autrui en
    // changeant un chiffre dans l'URL. Le filtre porte sur les deux colonnes,
    // et non sur l'équipement seul : une alerte mal rattachée ne doit pas
    // devenir lisible parce que son équipement, lui, est bien rattaché.
    return await db.select().from(alertsNotifications)
      .where(and(
        eq(alertsNotifications.equipmentId, equipmentId),
        eq(alertsNotifications.tenantId, tenantId),
      ))
      .orderBy(desc(alertsNotifications.createdAt));
  }

  /**
   * Crée une alerte — ou refuse.
   *
   * ═══════════════════════════════════════════════════════════════════
   * POURQUOI CETTE FONCTION REFUSE AU LIEU DE COMPLÉTER
   * ═══════════════════════════════════════════════════════════════════
   * Elle est le passage unique par lequel toute alerte persistée entre en
   * base : compteurs de maintenance, règles de réapprovisionnement, seuils
   * de capteurs, analyse prédictive, et la route HTTP. Quatre de ces cinq
   * chemins n'ont jamais transmis de `tenantId`, et la colonne étant
   * nullable, l'écriture passait sans bruit. Le résultat : des alertes
   * n'appartenant à personne, produites toutes les 30 secondes par le
   * simulateur, invisibles dans l'interface puisque les lectures filtrent
   * par locataire — mais bien présentes, et liées aux équipements par clé
   * étrangère. Elles ont fini par faire échouer le retrait du jeu de
   * démonstration sur une contrainte de clé étrangère : le seul symptôme
   * visible d'un défaut qui durait depuis le début.
   *
   * Deux refus distincts, et un troisième qu'on ne fait PAS :
   *
   *   1. SANS LOCATAIRE, on refuse. On ne « devine » pas, et surtout on ne
   *      déduit pas le locataire de l'équipement ici : ce serait transformer
   *      un oubli d'appelant en écriture silencieuse, et l'appelant qui
   *      ignore à qui appartient son alerte ignore aussi s'il a le droit de
   *      l'écrire. La déduction a sa place à l'INGESTION — là où une trame
   *      arrive sans session — et elle y est déjà faite, une fois, par
   *      `resoudreLocataireEquipement`.
   *
   *   2. ÉQUIPEMENT D'UN AUTRE LOCATAIRE, on refuse. Sans cela, la route
   *      `POST /api/alerts` permettrait de poser une alerte sur
   *      l'équipement d'autrui : le corps de la requête fournissait le
   *      `tenantId`, et rien ne vérifiait que l'équipement visé était bien
   *      le sien. Le contrôle est ici plutôt que dans la route, parce qu'une
   *      garde placée dans une seule route ne protège que cette route-là.
   *
   *   3. Ce qu'on NE fait PAS : remplacer un `tenantId` manquant par celui
   *      de la session, ni par un locataire par défaut. Une valeur par
   *      défaut rendrait le défaut invisible au lieu de le supprimer.
   *
   * Elle LÈVE au lieu de rendre un indicateur d'échec : les appelants sont
   * des boucles de fond, et une boucle qui ignore un code de retour écrirait
   * encore des alertes orphelines. Les tâches de fond ont déjà leur propre
   * isolation et leur temporisation — une levée y est tracée, pas fatale.
   */
  async createAlert(data: InsertAlertsNotifications): Promise<AlertsNotifications> {
    if (!data.tenantId) {
      throw new Error(
        `ALERTE_SANS_LOCATAIRE : refus d'écrire une alerte « ${data.alertType} » `
        + `sans organisation propriétaire`
        + (data.equipmentId ? ` (équipement #${data.equipmentId}).` : '.')
        + ` L'appelant doit fournir tenantId ; à l'ingestion, le résoudre avec `
        + `resoudreLocataireEquipement() et abandonner s'il est introuvable.`,
      );
    }

    if (data.equipmentId != null) {
      const proprietaire = await this.resoudreLocataireEquipement(data.equipmentId);
      if (!proprietaire) {
        throw new Error(
          `ALERTE_EQUIPEMENT_INCONNU : équipement #${data.equipmentId} introuvable — `
          + `impossible de vérifier qu'il appartient à ${data.tenantId}.`,
        );
      }
      if (proprietaire !== data.tenantId) {
        throw new Error(
          `ALERTE_HORS_LOCATAIRE : l'équipement #${data.equipmentId} appartient à une `
          + `autre organisation que ${data.tenantId}. Alerte refusée.`,
        );
      }
    }

    const [alert] = await db.insert(alertsNotifications).values(data).returning();
    return alert;
  }

  async updateAlert(id: number, tenantId: string, updates: Partial<AlertsNotifications>): Promise<AlertsNotifications> {
    // Locataire obligatoire et positionnel, même raison que pour la lecture :
    // `PUT /api/alerts/:id` modifiait n'importe quelle alerte sur son seul
    // identifiant. Le `tenantId` est retiré des champs modifiables — une
    // alerte ne change pas de propriétaire par une mise à jour.
    const { tenantId: _ignore, ...modifications } = updates;
    const [alert] = await db
      .update(alertsNotifications)
      .set(modifications)
      .where(and(
        eq(alertsNotifications.id, id),
        eq(alertsNotifications.tenantId, tenantId),
      ))
      .returning();
    return alert;
  }

  // User Profile Methods
  async createUserProfile(profileData: InsertUserProfile): Promise<UserProfile> {
    const [profile] = await db
      .insert(userProfiles)
      .values(profileData)
      .onConflictDoUpdate({
        target: userProfiles.id,
        set: profileData
      })
      .returning();
    return profile;
  }

  async getUserProfile(id: number): Promise<UserProfile | undefined> {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, id));
    return profile;
  }

  // Suppliers management
  async createSupplier(supplierData: InsertSupplier): Promise<Supplier> {
    const [supplier] = await this.db
      .insert(suppliers)
      .values(supplierData)
      .returning();
    return supplier;
  }

  async getSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers).where(eq(suppliers.isActive, true));
  }

  async getSupplierById(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async updateSupplier(id: number, data: Partial<InsertSupplier>): Promise<Supplier> {
      // Le locataire est retiré des champs ecrits : la propriete doit etre
      // vraie ICI, sans dependre de la validation faite par l'appelant. Une
      // ligne ne change pas d'entreprise par une mise a jour (cf. updateAlert
      // et docs/EXAMEN_LISTES_BLANCHES.md).
      const { tenantId: _jamaisModifiable, ...dataCloisonne } = data;
    const [supplier] = await db
      .update(suppliers)
      .set({ ...dataCloisonne, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return supplier;
  }

  // ════════════════════════════════════════════════════════════════
  // BONS DE COMMANDE — cloisonnés par locataire depuis la migration 0023
  // ════════════════════════════════════════════════════════════════
  //
  // Aucune de ces méthodes ne filtrait sur quoi que ce soit : `purchase_orders`
  // ne portait pas de colonne `tenant_id`. Chacune prend désormais un
  // `tenantId` OBLIGATOIRE, et il vient de la session de l'appelant — jamais du
  // corps de la requête, jamais d'un en-tête (voir server/tenant-requis.ts).
  //
  // Le locataire est placé APRÈS l'identifiant du document, comme pour les
  // ordres de travail (`getWorkOrderById(id, tenantId)`,
  // `updateWorkOrder(id, tenantId, data)`), pour que les deux circuits se
  // lisent de la même façon.
  //
  // `updatePurchaseOrder` rend désormais `undefined` quand aucune ligne n'a été
  // touchée, au lieu de `PurchaseOrder`. C'est le point important : un bon
  // appartenant à un autre locataire ne produit plus une écriture silencieuse
  // ni une exception, mais une absence que l'appelant doit traiter — en 404.

  async createPurchaseOrder(
    tenantId: string,
    orderData: Omit<InsertPurchaseOrder, 'orderNumber' | 'tenantId'> & { orderNumber?: string },
  ): Promise<PurchaseOrder> {
    const orderNumber = `${orderData.documentType === "command_letter" ? "CL" : "PO"}-${Date.now()}`;

    const [order] = await db
      .insert(purchaseOrders)
      .values({
        ...orderData,
        // Le locataire est posé APRÈS l'étalement de `orderData` : même si un
        // appelant y glissait un `tenantId`, c'est celui de la session qui est
        // écrit. Le type l'interdit déjà, mais un `any` sur le chemin d'appel
        // suffirait à contourner le type et pas cette ligne.
        tenantId,
        orderNumber,
        status: "pending"
      })
      .returning();
    return order;
  }

  async getPurchaseOrders(tenantId: string): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders).where(eq(purchaseOrders.tenantId, tenantId));
  }

  async getPurchaseOrderById(id: number, tenantId: string): Promise<PurchaseOrder | undefined> {
    const [order] = await this.db.select().from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)));
    return order;
  }

  async updatePurchaseOrder(
    id: number,
    tenantId: string,
    data: Partial<Omit<InsertPurchaseOrder, 'tenantId'>>,
  ): Promise<PurchaseOrder | undefined> {
      // Rien a retirer ici : le TYPE de cet argument exclut deja `tenantId`
      // (Partial<Omit<…, "tenantId">>, ou table sans colonne locataire). Une
      // protection par le type vaut mieux qu'une extraction a l'ecriture : le
      // typecheck refuse l'APPELANT, pas seulement la valeur.
    const [order] = await this.db
      .update(purchaseOrders)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)))
      .returning();
    return order;
  }

  async getPurchaseOrdersByStatus(status: string, tenantId: string): Promise<PurchaseOrder[]> {
    return await this.db.select().from(purchaseOrders)
      .where(and(eq(purchaseOrders.validationStatus, status), eq(purchaseOrders.tenantId, tenantId)));
  }

  // ── Lignes de bon de commande ───────────────────────────────────
  //
  // `purchase_order_items` ne porte PAS de colonne `tenant_id`, et n'en reçoit
  // pas : une ligne n'existe que par son bon. Le cloisonnement passe donc par
  // le bon parent, et il est exact — une ligne dont le bon appartient à un
  // autre locataire n'est ni lisible, ni modifiable, ni créable.
  //
  // `bonsDuLocataire()` sert de sous-requête commune. Drizzle n'exprime pas de
  // jointure dans un UPDATE : le `IN (SELECT ...)` est la forme qui marche
  // aussi bien en lecture qu'en écriture, donc une seule règle à relire.

  private bonsDuLocataire(tenantId: string) {
    return this.db.select({ id: purchaseOrders.id }).from(purchaseOrders)
      .where(eq(purchaseOrders.tenantId, tenantId));
  }

  async createPurchaseOrderItem(
    itemData: InsertPurchaseOrderItem,
    tenantId: string,
  ): Promise<PurchaseOrderItem | undefined> {
    // Le bon parent est vérifié AVANT l'insertion : sans ce contrôle, un
    // appelant pouvait ajouter une ligne — donc un montant — à un bon de
    // commande d'une autre organisation, alors même que la table des lignes
    // n'a pas de locataire à usurper.
    if (itemData.purchaseOrderId == null) return undefined;
    const bon = await this.getPurchaseOrderById(itemData.purchaseOrderId, tenantId);
    if (!bon) return undefined;

    const [item] = await this.db
      .insert(purchaseOrderItems)
      .values(itemData)
      .returning();
    return item;
  }

  async getPurchaseOrderItems(purchaseOrderId: number, tenantId: string): Promise<PurchaseOrderItem[]> {
    return await this.db.select().from(purchaseOrderItems)
      .where(and(
        eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId),
        inArray(purchaseOrderItems.purchaseOrderId, this.bonsDuLocataire(tenantId)),
      ));
  }

  async updatePurchaseOrderItem(
    id: number,
    tenantId: string,
    data: Partial<InsertPurchaseOrderItem>,
  ): Promise<PurchaseOrderItem | undefined> {
    const [item] = await this.db
      .update(purchaseOrderItems)
      .set(data)
      .where(and(
        eq(purchaseOrderItems.id, id),
        inArray(purchaseOrderItems.purchaseOrderId, this.bonsDuLocataire(tenantId)),
      ))
      .returning();
    return item;
  }

  // Reorder Rules management
  async createReorderRule(ruleData: InsertReorderRule): Promise<ReorderRule> {
    const [rule] = await db
      .insert(reorderRules)
      .values(ruleData)
      .returning();
    return rule;
  }

  async getReorderRules(): Promise<ReorderRule[]> {
    return await db.select().from(reorderRules).where(eq(reorderRules.isActive, true));
  }

  async getReorderRuleByPartId(sparePartId: number): Promise<ReorderRule | undefined> {
    const [rule] = await db.select().from(reorderRules)
      .where(and(eq(reorderRules.sparePartId, sparePartId), eq(reorderRules.isActive, true)));
    return rule;
  }

  async updateReorderRule(id: number, data: Partial<InsertReorderRule>): Promise<ReorderRule> {
      // Rien a retirer ici : le TYPE de cet argument exclut deja `tenantId`
      // (Partial<Omit<…, "tenantId">>, ou table sans colonne locataire). Une
      // protection par le type vaut mieux qu'une extraction a l'ecriture : le
      // typecheck refuse l'APPELANT, pas seulement la valeur.
    const [rule] = await this.db
      .update(reorderRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(reorderRules.id, id))
      .returning();
    return rule;
  }

  // Stock monitoring and automatic reorder
  async checkStockLevelsAndTriggerReorders(tenantId: string): Promise<{ triggeredRules: ReorderRule[], createdOrders: PurchaseOrder[] }> {
    const rules = await this.getReorderRules();
    const triggeredRules: ReorderRule[] = [];
    const createdOrders: PurchaseOrder[] = [];

    for (const rule of rules) {
      if (rule.sparePartId == null) continue;
      const part = await this.getSparePartById(rule.sparePartId, tenantId);
      if (!part) continue;
      const currentStock = part.currentStock ?? 0;

      // Check if stock is below reorder point
      if (currentStock <= rule.reorderPoint) {
        // Check if not recently triggered (prevent spam)
        const hoursSinceLastTrigger = rule.lastTriggered 
          ? (Date.now() - rule.lastTriggered.getTime()) / (1000 * 60 * 60)
          : 24;

        if (hoursSinceLastTrigger >= 2) { // Minimum 2 hours between triggers
          triggeredRules.push(rule);

          // Update last triggered timestamp
          await this.updateReorderRule(rule.id, { lastTriggered: new Date() });

          // Generate alert
          await this.createAlert({
            // Le locataire est dans la portée depuis le début de la fonction —
            // la ligne qui lit la pièce s'en sert déjà. Il n'était simplement
            // pas transmis, et chaque alerte de stock bas s'écrivait sans
            // propriétaire.
            tenantId,
            alertType: "stock_low",
            equipmentId: null,
            severity: currentStock <= 0 ? "critical" : "high",
            title: "Stock faible détecté",
            message: `Stock de "${part.partName}" (${part.partNumber}) est descendu à ${currentStock} unités. Seuil de réapprovisionnement: ${rule.reorderPoint}`,
            triggerValue: currentStock.toString(),
            thresholdValue: rule.reorderPoint?.toString()
          });

          // If auto-order is enabled, create purchase order
          if (rule.autoOrder && rule.supplierId) {
            const supplier = await this.getSupplierById(rule.supplierId);
            if (supplier) {
              const orderNumber = await this.generatePurchaseOrderNumber(tenantId);
              const expectedDelivery = new Date();
              expectedDelivery.setDate(expectedDelivery.getDate() + (rule.leadTime || supplier.deliveryTime || 7));

              const purchaseOrder = await this.createPurchaseOrder(tenantId, {
                orderNumber,
                supplierId: rule.supplierId,
                orderType: "spare_parts",
                status: "draft",
                priority: currentStock <= 0 ? "urgent" : "high",
                requestedBy: "Auto-Reorder System",
                totalAmount: (part.unitPrice ? (parseFloat(part.unitPrice) * rule.reorderQuantity).toFixed(2) : "0"),
                currency: "EUR",
                expectedDelivery,
                deliveryAddress: "Magasin principal",
                notes: `Commande automatique - Stock critique atteint pour ${part.partName}`,
                terms: supplier.paymentTerms || "Standard"
              });

              // Add item to purchase order
              await this.createPurchaseOrderItem({
                purchaseOrderId: purchaseOrder.id,
                sparePartId: part.id,
                partNumber: part.partNumber,
                description: part.partName,
                quantity: rule.reorderQuantity,
                unitPrice: part.unitPrice ? part.unitPrice.toString() : "0",
                totalPrice: (part.unitPrice ? (parseFloat(part.unitPrice) * rule.reorderQuantity).toFixed(2) : "0"),
                expectedDelivery
              }, tenantId);

              createdOrders.push(purchaseOrder);

              console.log(`Auto-order created: ${orderNumber} for ${part.partName} (${rule.reorderQuantity} units)`);
            }
          }
        }
      }
    }

    return { triggeredRules, createdOrders };
  }

  // Generate purchase order number
  //
  // ⚠️ LE NUMÉRO RENDU ICI N'EST PAS CELUI QUI FINIT EN BASE. `createPurchaseOrder`
  // recalcule systématiquement `orderNumber = PO-${Date.now()}` et ignore celui
  // qu'on lui passe — ce qui veut dire que la trace
  // « Auto-order created: PO20260001 » du réapprovisionnement automatique
  // annonce un numéro que la ligne insérée ne porte pas. Défaut antérieur,
  // laissé en place : changer la numérotation touche à `order_number`, qui est
  // UNIQUE à l'échelle de l'instance, et ne se décide pas dans un lot
  // d'isolation. Il est noté ici pour qu'il cesse d'être invisible.
  //
  // La lecture est tout de même cloisonnée : elle parcourait les bons de
  // commande de toute l'instance, et c'est inutile pour un comptage qui ne sort
  // pas de ce locataire.
  private async generatePurchaseOrderNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const orders = await db.select({ id: purchaseOrders.id }).from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.tenantId, tenantId),
        sql`EXTRACT(year FROM order_date) = ${year}`,
      ));

    const nextNumber = (orders.length + 1).toString().padStart(4, '0');
    return `PO${year}${nextNumber}`;
  }

  // Get parts with stock below reorder point
  async getPartsNeedingReorder(): Promise<(SparePart & { reorderRule?: ReorderRule })[]> {
    const partsQuery = await db.select().from(spareParts);
    const results = [];

    for (const part of partsQuery) {
      const rule = await this.getReorderRuleByPartId(part.id);
      if (rule && (part.currentStock ?? 0) <= rule.reorderPoint) {
        results.push({ ...part, reorderRule: rule });
      }
    }

    return results;
  }

  // ============= MAINTENANCE REPORTS MANAGEMENT =============

  // Generate maintenance report after work order completion
  async generateMaintenanceReport(workOrderId: number, tenantId: string, reportData: Partial<InsertMaintenanceReport>): Promise<MaintenanceReport> {
    // Get work order details
    const workOrder = await this.getWorkOrderById(workOrderId, tenantId);
    if (!workOrder) {
      throw new Error("Work order not found");
    }

    // Generate report number
    const reportNumber = await this.generateReportNumber("MR");
    
    // Calculate duration if not provided
    const actualDuration = reportData.actualDuration || 
      (reportData.endTime && reportData.startTime ? 
        Math.floor((new Date(reportData.endTime).getTime() - new Date(reportData.startTime).getTime()) / (1000 * 60)) : 
        null);

    // Calculate costs
    const partsCost = reportData.partsUsed ? 
      Array.isArray(reportData.partsUsed) ? 
        reportData.partsUsed.reduce((sum: number, part: any) => sum + (part.cost || 0), 0) : 0 : 0;
    
    const laborCost = reportData.laborCost != null ?
      parseFloat(reportData.laborCost.toString()) :
      (actualDuration ? (actualDuration / 60) * 50 : 0); // 50€/hour default rate

    const totalCost = partsCost + laborCost;

    const reportDataComplete: InsertMaintenanceReport = {
      reportNumber,
      workOrderId,
      equipmentId: workOrder.equipmentId,
      reportType: workOrder.orderType || "corrective",
      interventionType: reportData.interventionType || "repair",
      technician: reportData.technician || workOrder.assignedTo?.toString() || "Non spécifié",
      supervisor: reportData.supervisor,
      startTime: reportData.startTime || workOrder.createdAt || new Date(),
      endTime: reportData.endTime || new Date(),
      actualDuration,
      plannedDuration: workOrder.estimatedDuration,
      workDescription: reportData.workDescription || workOrder.description,
      problemDiagnosis: reportData.problemDiagnosis,
      actionsTaken: reportData.actionsTaken || "Intervention terminée",
      partsUsed: reportData.partsUsed,
      toolsUsed: reportData.toolsUsed,
      safetyIncidents: reportData.safetyIncidents,
      qualityCheck: reportData.qualityCheck || false,
      qualityNotes: reportData.qualityNotes,
      followUpRequired: reportData.followUpRequired || false,
      followUpDate: reportData.followUpDate,
      followUpNotes: reportData.followUpNotes,
      totalCost: totalCost.toString(),
      laborCost: laborCost.toString(),
      partsCost: partsCost.toString(),
      status: "draft",
      ...reportData,
      // Le locataire vient de la SESSION, jamais du corps de la requête, et il
      // est posé après l'étalement de `reportData` : un client qui enverrait
      // `tenantId` — ou un `equipmentId` appartenant à autrui — ne peut pas
      // détourner le rattachement du rapport.
      tenantId,
    };

    const [report] = await db.insert(maintenanceReports).values(reportDataComplete).returning();

    // Auto-approve if no issues
    if (!reportData.safetyIncidents && !reportData.followUpRequired) {
      await this.approveMaintenanceReport(report.id, tenantId, reportData.technician || "System");
    }

    console.log(`Maintenance report ${reportNumber} generated for work order ${workOrderId}`);
    return report;
  }

  /**
   * Rapports de maintenance d'UN locataire.
   *
   * `tenantId` est un paramètre positionnel obligatoire, et non une entrée de
   * plus dans `filters`. C'est délibéré : la fuite corrigée ici n'était pas un
   * filtre mal écrit, c'était un filtre ABSENT. Tant que le cloisonnement reste
   * optionnel, il se fait oublier sans que rien ne le signale — exactement ce
   * qui s'est produit. Obligatoire, le compilateur refuse tout appelant qui
   * l'omet, et un futur écran ne peut plus naître en lisant le parc entier.
   */
  async getMaintenanceReports(tenantId: string, filters?: {
    equipmentId?: number;
    reportType?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<MaintenanceReport[]> {
    const conditions = [eq(maintenanceReports.tenantId, tenantId)];
    if (filters?.equipmentId) conditions.push(eq(maintenanceReports.equipmentId, filters.equipmentId));
    if (filters?.reportType) conditions.push(eq(maintenanceReports.reportType, filters.reportType));
    if (filters?.status) conditions.push(eq(maintenanceReports.status, filters.status));
    if (filters?.startDate) conditions.push(gte(maintenanceReports.createdAt, filters.startDate));
    if (filters?.endDate) conditions.push(lte(maintenanceReports.createdAt, filters.endDate));

    // `conditions` contient au minimum le locataire : il n'y a plus de branche
    // « aucune condition », qui était le chemin par lequel la requête partait
    // sans le moindre WHERE.
    return db.select().from(maintenanceReports)
      .where(and(...conditions))
      .orderBy(desc(maintenanceReports.createdAt));
  }

  /**
   * Un rapport par son identifiant, dans la limite du locataire demandeur.
   *
   * Les identifiants sont des entiers séquentiels communs à toute l'instance :
   * sans cette condition, une route qui sert le rapport n° N le sert à qui en
   * devine le numéro — description de panne, diagnostic, technicien et coûts
   * compris.
   */
  async getMaintenanceReportById(id: number, tenantId: string): Promise<MaintenanceReport | undefined> {
    const [report] = await db.select().from(maintenanceReports)
      .where(and(eq(maintenanceReports.id, id), eq(maintenanceReports.tenantId, tenantId)));
    return report;
  }

  // Approve maintenance report
  // Une écriture se cloisonne comme une lecture : sans le locataire au WHERE,
  // approuver le rapport n° N d'autrui ne demandait que d'en connaître le
  // numéro.
  async approveMaintenanceReport(reportId: number, tenantId: string, approvedBy: string): Promise<MaintenanceReport> {
    const [report] = await db
      .update(maintenanceReports)
      .set({
        status: "approved",
        approvedBy,
        approvalDate: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(maintenanceReports.id, reportId), eq(maintenanceReports.tenantId, tenantId)))
      .returning();
    return report;
  }

  // ============= MONTHLY REPORTS MANAGEMENT =============

  // Generate monthly maintenance report
  async generateMonthlyReport(month: number, year: number, tenantId: string, generatedBy?: string): Promise<MonthlyReport> {
    const reportNumber = await this.generateReportNumber("MM");

    // Calculate period dates
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    // Calculate equipment statistics
    const equipment = await this.getEquipmentRegistry(tenantId);
    const totalEquipment = equipment.length;
    const activeEquipment = equipment.filter(eq => eq.operationalState === "operational").length;
    const equipmentAvailability = activeEquipment > 0 ? (activeEquipment / totalEquipment) * 100 : 0;

    // Calculate work orders statistics
    const workOrders = await this.getWorkOrdersByDateRange(periodStart, periodEnd, tenantId);
    const totalWorkOrders = workOrders.length;
    const completedWorkOrders = workOrders.filter(wo => wo.status === "completed").length;
    const preventiveWorkOrders = workOrders.filter(wo => wo.orderType === "preventive").length;
    const correctiveWorkOrders = workOrders.filter(wo => wo.orderType === "corrective").length;

    // Calculate average completion time
    const completedWOs = workOrders.filter(wo => wo.status === "completed" && wo.actualEnd);
    const averageCompletionTime = completedWOs.length > 0 ?
      completedWOs.reduce((sum, wo) => {
        const duration = wo.actualEnd && wo.actualStart ?
          (new Date(wo.actualEnd).getTime() - new Date(wo.actualStart).getTime()) / (1000 * 60 * 60) : 0;
        return sum + duration;
      }, 0) / completedWOs.length : 0;

    // Calculate maintenance KPIs
    //
    // ⚠️ Cet appel se faisait SANS locataire. Les quatre indicateurs de coût
    // calculés plus bas — `totalMaintenanceCost`, `laborCost`, `partsCost` et
    // `costPerWorkOrder` — additionnaient donc les rapports de TOUS les
    // locataires de l'instance, pendant que le reste du rapport (parc, ordres
    // de travail, alertes) était correctement restreint à `tenantId`. Un
    // locataire voyait les dépenses des autres mêlées aux siennes, et son coût
    // par intervention — somme globale divisée par SES seules interventions —
    // ne voulait rien dire.
    const maintenanceReportsInPeriod = await this.getMaintenanceReports(tenantId, {
      startDate: periodStart,
      endDate: periodEnd
    });

    // ⚠️ Le calcul précédent tenait en une ligne et portait trois fautes :
    //
    //   (30 * 24 * totalEquipment) / correctiveWorkOrders
    //
    //   • il supposait une période de 30 jours alors que `periodStart` et
    //     `periodEnd` délimitent un mois civil, qui en compte 28 à 31 ;
    //   • il prenait le temps CALENDAIRE de tout le parc — équipements à
    //     l'arrêt, en réforme ou jamais mis en service compris — pour du temps
    //     de fonctionnement ;
    //   • sans aucun correctif, il rendait 0. Un MTBF nul se lit « tombe en
    //     panne en permanence », soit exactement l'inverse de la réalité.
    //
    // On emploie désormais la définition unique de `shared/fiabilite.ts` :
    // moyenne des intervalles entre déclenchements de pannes, en heures, et
    // `undefined` quand elle n'est pas calculable.
    const evenementsPanne = workOrders
      .filter(wo => wo.orderType === "corrective" || wo.orderType === "emergency")
      .map(wo => ({ debut: wo.actualStart, fin: wo.actualEnd }));

    const mtbf = arrondir(mtbfHeures(evenementsPanne), 1);
    const mttr = arrondir(mttrHeures(evenementsPanne), 1);
    const plannedMaintenanceRatio = totalWorkOrders > 0 ? (preventiveWorkOrders / totalWorkOrders) * 100 : 0;
    const maintenanceEfficiency = completedWorkOrders > 0 ? (completedWorkOrders / totalWorkOrders) * 100 : 0;

    // Calculate costs
    const totalMaintenanceCost = maintenanceReportsInPeriod.reduce((sum, report) => {
      return sum + (parseFloat(report.totalCost?.toString() || "0"));
    }, 0);

    const laborCost = maintenanceReportsInPeriod.reduce((sum, report) => {
      return sum + (parseFloat(report.laborCost?.toString() || "0"));
    }, 0);

    const partsCost = maintenanceReportsInPeriod.reduce((sum, report) => {
      return sum + (parseFloat(report.partsCost?.toString() || "0"));
    }, 0);

    const costPerWorkOrder = completedWorkOrders > 0 ? totalMaintenanceCost / completedWorkOrders : 0;

    // Get alerts for the period
    const alerts = await this.getAlertsForPeriod(periodStart, periodEnd, tenantId);
    const totalAlerts = alerts.length;
    const criticalAlerts = alerts.filter(alert => alert.severity === "critical").length;

    // Generate statistics and charts data
    const statisticsData = {
      equipmentByType: equipment.reduce((acc: any, eq) => {
        acc[eq.equipmentType] = (acc[eq.equipmentType] || 0) + 1;
        return acc;
      }, {}),
      workOrdersByStatus: workOrders.reduce((acc: any, wo) => {
        const status = wo.status || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
      dailyWorkOrders: this.calculateDailyWorkOrders(workOrders, periodStart, periodEnd),
      costTrends: this.calculateCostTrends(maintenanceReportsInPeriod),
      alertsByType: alerts.reduce((acc: any, alert) => {
        acc[alert.alertType] = (acc[alert.alertType] || 0) + 1;
        return acc;
      }, {})
    };

    const chartsData = {
      equipmentAvailabilityChart: {
        labels: ["Disponible", "En maintenance", "Arrêté"],
        data: [activeEquipment, totalWorkOrders, totalEquipment - activeEquipment - totalWorkOrders]
      },
      maintenanceTypeChart: {
        labels: ["Préventive", "Corrective"],
        data: [preventiveWorkOrders, correctiveWorkOrders]
      },
      costBreakdownChart: {
        labels: ["Main d'œuvre", "Pièces détachées"],
        data: [laborCost, partsCost]
      }
    };

    // Calculate performance score
    const performanceScore = this.calculatePerformanceScore({
      equipmentAvailability,
      plannedMaintenanceRatio,
      maintenanceEfficiency,
      mtbf,
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      plannedMaintenanceRatio,
      equipmentAvailability,
      criticalAlerts,
      totalAlerts,
      mttr
    });

    const monthlyReportData: InsertMonthlyReport = {
      reportNumber,
      // Sans ce rattachement, des agrégats justement calculés resteraient
      // lisibles par tous via GET /api/monthly-reports.
      tenantId,
      month,
      year,
      periodStart,
      periodEnd,
      generatedBy: generatedBy || "System",
      totalEquipment,
      activeEquipment,
      equipmentAvailability: equipmentAvailability.toString(),
      totalWorkOrders,
      completedWorkOrders,
      preventiveWorkOrders,
      correctiveWorkOrders,
      averageCompletionTime: averageCompletionTime.toString(),
      // `null` et non `"0"` : une grandeur non calculable n'est pas une
      // grandeur nulle, et la distinction doit survivre à l'enregistrement.
      mtbf: mtbf === undefined ? null : mtbf.toString(),
      mttr: mttr === undefined ? null : mttr.toString(),
      plannedMaintenanceRatio: plannedMaintenanceRatio.toString(),
      maintenanceEfficiency: maintenanceEfficiency.toString(),
      totalMaintenanceCost: totalMaintenanceCost.toString(),
      laborCost: laborCost.toString(),
      partsCost: partsCost.toString(),
      contractorCost: "0",
      costPerWorkOrder: costPerWorkOrder.toString(),
      partsConsumed: this.calculatePartsConsumed(maintenanceReportsInPeriod),
      inventoryTurnover: "0", // Could be calculated from stock movements
      stockouts: 0,
      emergencyPurchases: 0,
      totalAlerts,
      criticalAlerts,
      safetyIncidents: this.countSafetyIncidents(maintenanceReportsInPeriod),
      qualityIssues: this.countQualityIssues(maintenanceReportsInPeriod),
      // Une note non calculable reste absente plutôt que de valoir « 0 », qui
      // se lirait comme la pire performance possible.
      performanceScore: performanceScore === undefined ? null : performanceScore.toString(),
      improvementAreas: this.identifyImprovementAreas(performanceScore, plannedMaintenanceRatio, equipmentAvailability),
      recommendations,
      statisticsData,
      chartsData,
      status: "generated"
    };

    const [report] = await db.insert(monthlyReports).values(monthlyReportData).returning();
    
    console.log(`Monthly report ${reportNumber} generated for ${month}/${year}`);
    return report;
  }

  // Get monthly reports
  // `tenantId` obligatoire, pour la même raison que sur les rapports
  // d'intervention : un filtre facultatif se fait oublier.
  async getMonthlyReports(tenantId: string, year?: number): Promise<MonthlyReport[]> {
    const conditions = [eq(monthlyReports.tenantId, tenantId)];
    if (year) conditions.push(eq(monthlyReports.year, year));

    return db.select().from(monthlyReports)
      .where(and(...conditions))
      .orderBy(desc(monthlyReports.year), desc(monthlyReports.month));
  }

  async getMonthlyReportById(id: number, tenantId: string): Promise<MonthlyReport | undefined> {
    const [report] = await db.select().from(monthlyReports)
      .where(and(eq(monthlyReports.id, id), eq(monthlyReports.tenantId, tenantId)));
    return report;
  }

  // Helper method to generate report numbers
  private async generateReportNumber(prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-4);
    return `${prefix}${year}${month}${day}${timestamp}`;
  }

  // Helper methods for monthly report calculations
  private async getWorkOrdersByDateRange(startDate: Date, endDate: Date, tenantId: string): Promise<WorkOrder[]> {
    return db.select().from(workOrders)
      .where(and(
        eq(workOrders.tenantId, tenantId),
        gte(workOrders.createdAt, startDate),
        lte(workOrders.createdAt, endDate)
      ));
  }

  private async getAlertsForPeriod(startDate: Date, endDate: Date, tenantId: string): Promise<AlertsNotifications[]> {
    return db.select().from(alertsNotifications)
      .where(and(
        eq(alertsNotifications.tenantId, tenantId),
        gte(alertsNotifications.createdAt, startDate),
        lte(alertsNotifications.createdAt, endDate)
      ));
  }

  private calculateDailyWorkOrders(workOrders: WorkOrder[], startDate: Date, endDate: Date): any[] {
    const dailyData = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayStart = new Date(current);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59);
      
      const dayWorkOrders = workOrders.filter(wo => {
        const woDate = new Date(wo.createdAt ?? 0);
        return woDate >= dayStart && woDate <= dayEnd;
      });
      
      dailyData.push({
        date: current.toISOString().split('T')[0],
        count: dayWorkOrders.length
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return dailyData;
  }

  private calculateCostTrends(reports: MaintenanceReport[]): any[] {
    const costByWeek = reports.reduce((acc: any, report) => {
      const week = this.getWeekNumber(new Date(report.createdAt ?? 0));
      acc[week] = (acc[week] || 0) + parseFloat(report.totalCost?.toString() || "0");
      return acc;
    }, {});
    
    return Object.entries(costByWeek).map(([week, cost]) => ({
      week: parseInt(week),
      cost
    }));
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Note globale de performance, de 0 à 100 — ou `undefined`.
   *
   * ⚠️ DEUX FAUTES corrigées ici, le 2026-10-13.
   *
   * 1. Le MTBF entrait dans la note après un `Math.min(mtbf / 100, 100)`
   *    présenté comme une « normalisation ». Diviser une DURÉE par 100 pour en
   *    faire un pourcentage n'a aucun sens : 10 000 h donnait 100, 50 h donnait
   *    0,5. Le choix de 100 ne reposait sur rien. L'échelle est désormais
   *    explicite : on sature à un horizon de référence, énoncé et modifiable.
   *
   * 2. Un MTBF inconnu valait 0 et retirait jusqu'à 20 points sur 100. Un site
   *    neuf, ou un site SANS AUCUNE PANNE, était donc noté comme le plus
   *    mauvais possible sur ce critère. Un indicateur ne doit jamais punir
   *    l'absence de défaillance. Les composantes absentes sont maintenant
   *    exclues, et les poids restants renormalisés.
   */
  private calculatePerformanceScore(metrics: {
    equipmentAvailability?: number;
    plannedMaintenanceRatio?: number;
    maintenanceEfficiency?: number;
    /** MTBF en HEURES, ou `undefined` s'il n'est pas calculable. */
    mtbf?: number;
  }): number | undefined {
    // Horizon de référence : un MTBF de 90 jours vaut la note maximale sur ce
    // critère. Valeur conventionnelle, posée ici pour être discutée plutôt que
    // dissimulée dans une division.
    const MTBF_REFERENCE_HEURES = 90 * 24;

    const composantes: Array<{ valeur: number | undefined; poids: number }> = [
      { valeur: metrics.equipmentAvailability, poids: 0.3 },
      { valeur: metrics.plannedMaintenanceRatio, poids: 0.25 },
      { valeur: metrics.maintenanceEfficiency, poids: 0.25 },
      {
        valeur: metrics.mtbf === undefined
          ? undefined
          : Math.min((metrics.mtbf / MTBF_REFERENCE_HEURES) * 100, 100),
        poids: 0.2,
      },
    ];

    const retenues = composantes.filter(
      (c) => typeof c.valeur === 'number' && Number.isFinite(c.valeur));
    if (!retenues.length) return undefined;

    const poidsTotal = retenues.reduce((s, c) => s + c.poids, 0);
    const somme = retenues.reduce((s, c) => s + (c.valeur as number) * c.poids, 0);
    return Math.round(somme / poidsTotal);
  }


  private generateRecommendations(metrics: any): string[] {
    const recommendations = [];
    
    if (metrics.plannedMaintenanceRatio < 70) {
      recommendations.push("Augmenter la proportion de maintenance préventive pour réduire les pannes");
    }
    
    if (metrics.equipmentAvailability < 85) {
      recommendations.push("Optimiser la planification des interventions pour améliorer la disponibilité");
    }
    
    if (metrics.criticalAlerts > metrics.totalAlerts * 0.3) {
      recommendations.push("Renforcer la surveillance préventive pour réduire les alertes critiques");
    }
    
    if (metrics.mttr > 4) {
      recommendations.push("Améliorer la formation des techniciens pour réduire le temps de réparation");
    }
    
    return recommendations;
  }

  /**
   * ⚠️ `score < 70` était vrai pour une note ABSENTE une fois passée par
   * `undefined` : la plateforme recommandait d'améliorer une performance
   * qu'elle n'avait pas mesurée. Une absence n'est pas un mauvais résultat.
   */
  private identifyImprovementAreas(score: number | undefined, plannedRatio: number, availability: number): string[] {
    const areas = [];

    if (score !== undefined && score < 70) areas.push("Performance globale");
    if (plannedRatio < 60) areas.push("Maintenance préventive");
    if (availability < 80) areas.push("Disponibilité équipements");
    
    return areas;
  }

  private calculatePartsConsumed(reports: MaintenanceReport[]): number {
    return reports.reduce((sum, report) => {
      if (report.partsUsed && Array.isArray(report.partsUsed)) {
        return sum + report.partsUsed.reduce((partSum: number, part: any) => partSum + (part.quantity || 0), 0);
      }
      return sum;
    }, 0);
  }

  private countSafetyIncidents(reports: MaintenanceReport[]): number {
    return reports.filter(report => report.safetyIncidents && report.safetyIncidents.trim().length > 0).length;
  }

  private countQualityIssues(reports: MaintenanceReport[]): number {
    return reports.filter(report => report.qualityCheck === false ||
      (report.qualityNotes && report.qualityNotes.toLowerCase().includes("problème"))).length;
  }

  // ═══════════════════════════════════════════════════════════════════
  // PLUS DE MÉTHODES DE VALIDATION ICI — ET C'EST VOULU
  // ═══════════════════════════════════════════════════════════════════
  // Dix méthodes ont été retirées le 2026-10-25 : `getPendingWorkOrdersForValidation`,
  // `validateWorkOrder`, `getPendingPurchaseOrdersForValidation`,
  // `validatePurchaseOrder`, `createValidationLog`, `getValidationHistory`,
  // `getValidationStatistics`, `updateUserValidationPermissions`,
  // `getWorkOrderValidationStatus` et `getPurchaseOrderValidationStatus`.
  //
  // Leur SEUL appelant était `server/validation-routes.ts`, un routeur Express
  // qu'aucun `app.use(...)` ne montait : elles étaient donc inatteignables, et
  // le fichier a été supprimé avec elles.
  //
  // Les garder aurait été pire que du code mort. `validateWorkOrder` et
  // `validatePurchaseOrder` recevaient un `validatorId` : elles vérifiaient
  // `canValidateWorkOrders`, `canValidatePurchaseOrders` et `maxPurchaseAmount`
  // sur le compte DÉSIGNÉ par ce paramètre, c'est-à-dire les droits de
  // quelqu'un d'autre que l'appelant. C'est exactement la faille fermée le même
  // jour dans la version montée ; monter ce routeur l'aurait rouverte.
  //
  // Elles écrivaient en outre un vocabulaire de statuts QUE PLUS RIEN NE LIT —
  // `chef_service_validated`, `directeur_validated`, `ready_for_print` — là où
  // les routes en service écrivent et relisent `level1_validated`,
  // `level2_validated`, `validated` puis `printed`. Un document passé par
  // l'ancien chemin aurait été inatteignable par le nouveau : son statut ne
  // correspondant à aucune étape, aucune validation n'y serait plus attendue.
  //
  // Le circuit réel vit dans `server/simple-validation-routes.ts` : identité et
  // niveau pris sur la SESSION, quatre barrières, écriture et trace dans la même
  // transaction. Les traces s'y écrivent avec le même `tx` que la mise à jour
  // du document — raison pour laquelle `createValidationLog`, qui ouvrait sa
  // propre connexion, n'avait plus d'emploi.

  // ============= COMPANY CONFIGURATION METHODS =============
  //
  // ⚠️ `tenantId` est OBLIGATOIRE sur les quatre méthodes qui suivent, et c'est
  // délibéré : un paramètre facultatif aurait laissé les appelants existants
  // compiler sans changement, donc continuer de lire la configuration d'autrui
  // en silence. En l'exigeant, le compilateur désigne lui-même les appelants —
  // vérifié en retirant l'argument : cinq erreurs TS2554 dans gmao-routes.ts,
  // une par lecture de configuration (GET /api/company-config,
  // POST /api/purchase-orders/document-type, POST /api/company-config, et les
  // deux routes PDF de bon de commande), plus l'écriture de cette même route.
  // `generatePurchaseOrderWithLetterhead` ci-dessous n'a, lui, aucun appelant.

  async getCompanyConfig(tenantId: string): Promise<CompanyConfig | undefined> {
    const [config] = await db
      .select()
      .from(companyConfig)
      .where(and(eq(companyConfig.tenantId, tenantId), eq(companyConfig.isActive, true)));
    return config;
  }

  /**
   * ⚠️ `configData` NE PORTE PAS `tenantId` : il vient de la session, jamais de
   * la charge. Le type l'interdit pour que personne ne rebranche la charge du
   * client sur cette colonne (voir `companyConfigPayloadSchema`).
   */
  async createCompanyConfig(
    tenantId: string,
    configData: Omit<InsertCompanyConfig, "tenantId">,
  ): Promise<CompanyConfig> {
    // ⚠️ LE DÉFAUT CORRIGÉ ICI. La désactivation s'écrivait
    // `db.update(companyConfig).set({ isActive: false })` — sans WHERE. Elle
    // éteignait donc la configuration de TOUS les locataires de l'instance, et
    // la ligne nouvellement insérée devenait la seule active : l'identité
    // commerciale de celui qui enregistrait était ensuite servie à tout le
    // monde par `getCompanyConfig()`.
    //
    // Les deux écritures sont désormais dans une TRANSACTION. Sans elle, une
    // panne entre les deux laisse le locataire sans aucune configuration active
    // alors qu'il vient d'en enregistrer une — et ses bons de commande sortent
    // sans en-tête sans que rien ne le signale.
    return await db.transaction(async (tx) => {
      await tx
        .update(companyConfig)
        .set({ isActive: false })
        .where(eq(companyConfig.tenantId, tenantId));

      const [newConfig] = await tx
        .insert(companyConfig)
        .values({ ...configData, tenantId, isActive: true })
        .returning();
      return newConfig;
    });
  }

  /**
   * Met à jour la configuration `id` **à condition qu'elle appartienne à
   * `tenantId`**. Renvoie `undefined` si elle ne lui appartient pas : la route
   * répond alors 404, et non un succès silencieux sur la ligne d'autrui.
   */
  async updateCompanyConfig(
    id: number,
    tenantId: string,
    configData: Partial<Omit<InsertCompanyConfig, "tenantId">>,
  ): Promise<CompanyConfig | undefined> {
      // Rien a retirer ici : le TYPE de cet argument exclut deja `tenantId`
      // (Partial<Omit<…, "tenantId">>, ou table sans colonne locataire). Une
      // protection par le type vaut mieux qu'une extraction a l'ecriture : le
      // typecheck refuse l'APPELANT, pas seulement la valeur.
    const [updatedConfig] = await db
      .update(companyConfig)
      .set({ ...configData, updatedAt: new Date() })
      .where(and(eq(companyConfig.id, id), eq(companyConfig.tenantId, tenantId)))
      .returning();
    return updatedConfig;
  }

  /**
   * Bon de commande rendu en HTML sur le papier en-tête du locataire.
   *
   * ⚠️ AUCUN APPELANT à ce jour (vérifié par recensement sur tout le dépôt) :
   * les deux routes PDF passent par `generatePurchaseOrderPDF`. La méthode est
   * cloisonnée quand même — une fonction morte qui lit une table commune est un
   * piège pour le jour où on la rebranche, et c'est ainsi que la configuration
   * commune a été lue par cinq endroits sans que personne ne s'en aperçoive.
   *
   * Cette méthode lisait DEUX tables sans locataire, et les deux défauts ont été
   * trouvés séparément : la configuration d'entreprise (migration 0022) et le
   * bon de commande lui-même (migration 0023). Les deux sont cloisonnés ici.
   */
  async generatePurchaseOrderWithLetterhead(purchaseOrderId: number, tenantId: string, demoData?: any): Promise<string> {
    const config = await this.getCompanyConfig(tenantId);

    let purchaseOrder;
    if (demoData) {
      // Use demo data from validation system
      purchaseOrder = demoData;
    } else {
      // ✅ La réserve posée ici par la migration 0022 — « `purchase_orders` ne
      // porte pas de `tenant_id`, ce défaut demande sa propre migration et la
      // reprise de procurement-routes.ts » — est levée : c'est la migration
      // 0023, et tous les appelants sont repris.
      purchaseOrder = await this.getPurchaseOrderById(purchaseOrderId, tenantId);
    }

    if (!config) {
      throw new Error("Configuration d'entreprise introuvable");
    }

    if (!purchaseOrder) {
      throw new Error("Bon de commande introuvable");
    }

    // Generate HTML with company letterhead
    const letterheadTemplate = config.letterheadTemplate || this.generateDefaultLetterhead(config);
    
    const purchaseOrderContent = this.generatePurchaseOrderContent(purchaseOrder);
    
    return letterheadTemplate.replace('{{DOCUMENT_CONTENT}}', purchaseOrderContent);
  }

  private generateDefaultLetterhead(config: CompanyConfig): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { 
      font-family: ${config.fontFamily || 'Arial, sans-serif'}; 
      margin: 0; 
      padding: 20mm;
      color: #333;
    }
    .letterhead-header {
      display: flex;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 3px solid ${config.primaryColor || '#0066cc'};
      margin-bottom: 30px;
    }
    .logo-section {
      flex: 0 0 auto;
      margin-right: 30px;
    }
    .logo {
      max-height: 80px;
      max-width: 200px;
    }
    .company-info {
      flex: 1;
    }
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: ${config.primaryColor || '#0066cc'};
      margin-bottom: 10px;
    }
    .company-details {
      font-size: 12px;
      line-height: 1.4;
      color: #666;
    }
    .document-content {
      min-height: 400px;
      margin: 30px 0;
    }
    .document-footer {
      border-top: 2px solid ${config.secondaryColor || '#f8f9fa'};
      padding-top: 15px;
      margin-top: 30px;
      text-align: center;
      font-size: 10px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="letterhead-header">
    ${config.logoBase64 ? `
    <div class="logo-section">
      <img src="${config.logoBase64}" alt="Logo" class="logo">
    </div>
    ` : ''}
    <div class="company-info">
      <div class="company-name">${config.companyName}</div>
      <div class="company-details">
        ${config.address ? config.address.replace(/\n/g, '<br>') + '<br>' : ''}
        ${config.phone ? 'Tél: ' + config.phone : ''} ${config.email ? '| Email: ' + config.email : ''}<br>
        ${config.website ? 'Web: ' + config.website : ''} ${config.taxNumber ? '| SIRET: ' + config.taxNumber : ''}
      </div>
    </div>
  </div>
  
  <div class="document-content">
    {{DOCUMENT_CONTENT}}
  </div>
  
  <div class="document-footer">
    ${config.documentFooter || config.companyName + ' - ' + config.phone + ' - ' + config.email}
  </div>
</body>
</html>`;
  }

  private generatePurchaseOrderContent(purchaseOrder: any): string {
    const items = Array.isArray(purchaseOrder.items) 
      ? purchaseOrder.items 
      : (typeof purchaseOrder.items === 'string' ? JSON.parse(purchaseOrder.items) : []);
    
    const itemsRows = items.map((item: any) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 10px;">${item.description}</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${item.quantity}</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${item.unitPrice.toFixed(2)} €</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${(item.quantity * item.unitPrice).toFixed(2)} €</td>
      </tr>
    `).join('');

    return `
    <div style="margin-bottom: 30px;">
      <h2 style="color: #0066cc; margin-bottom: 20px;">BON DE COMMANDE</h2>
      <div style="display: flex; justify-content: space-between;">
        <div>
          <strong>Numéro:</strong> ${purchaseOrder.orderNumber}<br>
          <strong>Date:</strong> ${new Date(purchaseOrder.createdAt!).toLocaleDateString('fr-FR')}<br>
          <strong>Demandeur:</strong> ${purchaseOrder.requestedBy}
        </div>
        <div style="text-align: right;">
          <strong>Fournisseur:</strong><br>
          ${purchaseOrder.supplier}
        </div>
      </div>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: #0066cc; color: white;">
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Article</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Qté</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Prix Unit.</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
        <tr style="font-weight: bold; background-color: #f5f5f5;">
          <td colspan="3" style="border: 1px solid #ddd; padding: 10px; text-align: right;">TOTAL HT:</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${purchaseOrder.totalAmount} €</td>
        </tr>
      </tbody>
    </table>
    
    <div style="margin-top: 30px;">
      <p><strong>Description:</strong> ${purchaseOrder.description}</p>
      <p><strong>Statut validation:</strong> ${purchaseOrder.validationStatus}</p>
      <p><strong>Date de livraison:</strong> ${purchaseOrder.deliveryDate ? new Date(purchaseOrder.deliveryDate).toLocaleDateString('fr-FR') : 'À définir'}</p>
    </div>`;
  }
}

export const gmaoStorage = new GMAOStorage();