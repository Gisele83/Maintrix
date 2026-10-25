/**
 * Calcul des KPI du rapport GMAO complet (MTBF, MTTR, disponibilité, coûts…) à partir des
 * ordres de travail réels du tenant — remplace les valeurs figées précédemment codées en dur
 * dans /api/comprehensive-report/pdf et /excel (server/routes.ts).
 *
 * Principe : chaque champ est soit un calcul réel sur des données existantes, soit explicitement
 * absent (undefined) quand la donnée nécessaire n'existe pas dans le produit — jamais une valeur
 * inventée pour remplir un champ. C'est notamment le cas de l'OEE (Disponibilité × Performance ×
 * Qualité) : Performance et Qualité supposent un suivi de production (cadence, unités bonnes/
 * rejetées) qu'aucun module de Maintrix ne collecte aujourd'hui — seul un module dédié existe
 * (server/oee-routes.ts, saisie manuelle par équipe production), distinct de ce rapport GMAO.
 */

import type { WorkOrder } from "@shared/schema";

export interface GmaoReportKpis {
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  totalWorkOrders: number;
  completedWorkOrders: number;
  pendingWorkOrders: number;
  emergencyInterventions: number;
  preventiveCompliance: number | undefined;
  /** `undefined` sans aucun ordre de travail : un taux sans dénominateur n existe pas. */
  performanceScore: number | undefined;
  averageResolutionTime: number;
  mttr: number;
  mtbf: number | undefined;
  availability: number;
  reliability: number | undefined;
  laborCost: number;
  partsCost: number;
  contractorCost: number;
  totalCost: number;
  costPerWorkOrder: number;
  topEquipmentIssues: Array<{ equipment: string; issues: number; cost: number }>;
  techniciansPerformance: Array<{ name: string; workOrders: number; avgTime: number }>;
  equipmentHealth: Array<{ id: string; name: string; status: string; lastMaintenance: string }>;
  recommendedActions: string[];
}

const PERIOD_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

/**
 * Les quatre périodes, dans les DEUX orthographes que le produit emploie.
 *
 * ⚠️ `PERIOD_DAYS` n'indexait que `weekly | monthly | quarterly | yearly`, avec
 * un `?? PERIOD_DAYS.monthly` en repli. Or le sélecteur de l'écran
 * (client/src/pages/advanced-reporting.tsx) émet `week | month | quarter |
 * year` — AUCUNE de ces quatre valeurs n'existait dans la table. Les quatre
 * choix de l'utilisateur produisaient donc le même résultat mensuel, sans que
 * rien ne le signale. Mesuré sur la disponibilité, le 2026-10-20 :
 *
 *     week      → 99,3 %        weekly    → 97,0 %
 *     month     → 99,3 %        monthly   → 99,3 %
 *     quarter   → 99,3 %        quarterly → 99,8 %
 *     year      → 99,3 %        yearly    → 99,9 %
 *
 * La colonne de gauche est celle que l'écran envoyait : elle ne bouge pas.
 * Cela valait aussi pour `/api/comprehensive-report/excel`, déjà branché sur ce
 * service : le bouton « Export Excel » ignorait la période depuis toujours.
 *
 * La normalisation est faite ICI plutôt que chez l'appelant, pour que les deux
 * exports soient réparés par le même changement, et qu'un troisième appelant
 * n'ait pas à connaître l'orthographe attendue.
 */
const PERIOD_ALIASES: Record<string, keyof typeof PERIOD_DAYS & string> = {
  week: 'weekly',
  month: 'monthly',
  quarter: 'quarterly',
  year: 'yearly',
};

/**
 * Ramène une période demandée à sa clé canonique, ou `undefined` si elle est
 * inconnue — l'appelant décide alors, au lieu d'hériter d'un repli muet.
 */
export function normaliserPeriode(period: string): string | undefined {
  const brut = period.trim().toLowerCase();
  if (brut in PERIOD_DAYS) return brut;
  return PERIOD_ALIASES[brut];
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

const FAILURE_ORDER_TYPES = new Set(["corrective", "emergency"]);

export function computeGmaoReportKpis(
  allWorkOrders: WorkOrder[],
  period: string,
  equipmentNameById: Map<number, string>,
  technicianNameById: Map<number, string>,
  equipmentList: Array<{ id: number; equipmentName: string; operationalState?: string | null }>,
): GmaoReportKpis {
  // Le repli mensuel reste, mais il ne s'applique plus qu'à une période
  // RÉELLEMENT inconnue : les deux orthographes du produit sont reconnues.
  const periodeCanonique = normaliserPeriode(period) ?? 'monthly';
  const periodDays = PERIOD_DAYS[periodeCanonique];
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 3600 * 1000);
  const periodHours = periodDays * 24;

  const periodOrders = allWorkOrders.filter(
    (wo) => wo.createdAt && new Date(wo.createdAt) >= periodStart
  );

  const totalWorkOrders = periodOrders.length;
  const completedWorkOrders = periodOrders.filter((wo) => wo.status === "completed").length;
  const pendingWorkOrders = periodOrders.filter((wo) =>
    ["pending", "assigned", "in_progress", "paused"].includes(wo.status ?? "")
  ).length;
  const emergencyInterventions = periodOrders.filter((wo) => wo.orderType === "emergency").length;
  const failureOrders = periodOrders.filter((wo) => FAILURE_ORDER_TYPES.has(wo.orderType));
  const preventiveOrders = periodOrders.filter((wo) => wo.orderType === "preventive");

  // ⚠️ Ces trois taux retombaient sur une valeur par défaut en l absence
  // d ordres de travail — et dans DEUX SENS OPPOSÉS, ce qui est le plus
  // révélateur : conformité et performance à 0 (le pire), fiabilité à 100 (le
  // meilleur). Un parc sans activité était donc décrit comme parfaitement
  // fiable et totalement défaillant, dans le même rapport.
  //
  // Un taux sans dénominateur n existe pas. Constaté le 2026-10-13.
  const preventiveCompliance = totalWorkOrders > 0
    ? (preventiveOrders.length / totalWorkOrders) * 100 : undefined;
  const performanceScore = totalWorkOrders > 0
    ? (completedWorkOrders / totalWorkOrders) * 100 : undefined;
  const reliability = totalWorkOrders > 0
    ? 100 - (failureOrders.length / totalWorkOrders) * 100 : undefined;

  // Durées réelles (heures) — uniquement les OT complétés avec un début et une fin renseignés.
  const completedWithDuration = periodOrders.filter(
    (wo) => wo.status === "completed" && wo.actualStart && wo.actualEnd
  );
  const allDurationsH = completedWithDuration.map(
    (wo) => (new Date(wo.actualEnd!).getTime() - new Date(wo.actualStart!).getTime()) / 3600000
  );
  const failureDurationsH = completedWithDuration
    .filter((wo) => FAILURE_ORDER_TYPES.has(wo.orderType))
    .map((wo) => (new Date(wo.actualEnd!).getTime() - new Date(wo.actualStart!).getTime()) / 3600000);

  const averageResolutionTime = avg(allDurationsH);
  const mttr = failureDurationsH.length > 0 ? avg(failureDurationsH) : averageResolutionTime;

  // MTBF — intervalle moyen entre déclenchements consécutifs d'OT correctifs/urgents (flotte
  // entière). Nécessite au moins 2 événements de panne sur la période pour produire un intervalle ;
  // sinon la donnée est honnêtement absente plutôt que d'afficher un 0 trompeur.
  const failureStarts = failureOrders
    .filter((wo) => wo.actualStart)
    .map((wo) => new Date(wo.actualStart!).getTime())
    .sort((a, b) => a - b);
  let mtbf: number | undefined;
  if (failureStarts.length >= 2) {
    const intervalsH: number[] = [];
    for (let i = 1; i < failureStarts.length; i++) {
      intervalsH.push((failureStarts[i] - failureStarts[i - 1]) / 3600000);
    }
    mtbf = avg(intervalsH);
  }

  // Disponibilité — proportion de la période non couverte par une intervention corrective/urgente
  // en cours. Approximation par les durées d'OT de panne complétés sur la période (pas de suivi
  // temps réel de l'état opérationnel de chaque équipement seconde par seconde).
  const downtimeHours = failureDurationsH.reduce((s, v) => s + v, 0);
  const availability = periodHours > 0
    ? Math.max(0, Math.min(100, ((periodHours - downtimeHours) / periodHours) * 100))
    : 0;

  // Coûts réels — somme des champs déjà saisis sur les OT (aucun montant de "budget alloué" n'a
  // de source de vérité dans le produit actuel ; seules les dépenses réelles sont donc restituées).
  const laborCost = periodOrders.reduce((s, wo) => s + (wo.laborCost ? Number(wo.laborCost) : 0), 0);
  const partsCost = periodOrders.reduce((s, wo) => s + (wo.materialCost ? Number(wo.materialCost) : 0), 0);
  const contractorCost = periodOrders.reduce((s, wo) => s + (wo.externalCost ? Number(wo.externalCost) : 0), 0);
  const totalCostFromOrders = periodOrders.reduce((s, wo) => s + (wo.cost ? Number(wo.cost) : 0), 0);
  const totalCost = totalCostFromOrders > 0 ? totalCostFromOrders : laborCost + partsCost + contractorCost;
  const costPerWorkOrder = totalWorkOrders > 0 ? totalCost / totalWorkOrders : 0;

  // Top équipements par nombre d'interventions sur la période.
  const byEquipment = new Map<number, { issues: number; cost: number }>();
  for (const wo of periodOrders) {
    if (!wo.equipmentId) continue;
    const entry = byEquipment.get(wo.equipmentId) ?? { issues: 0, cost: 0 };
    entry.issues += 1;
    entry.cost += wo.cost ? Number(wo.cost) : 0;
    byEquipment.set(wo.equipmentId, entry);
  }
  const topEquipmentIssues = Array.from(byEquipment.entries())
    .map(([id, v]) => ({ equipment: equipmentNameById.get(id) ?? `Équipement #${id}`, ...v }))
    .sort((a, b) => b.issues - a.issues)
    .slice(0, 5);

  // Performance par technicien (OT complétés avec durée réelle sur la période).
  const byTechnician = new Map<number, { count: number; totalHours: number }>();
  for (const wo of completedWithDuration) {
    if (!wo.assignedTo) continue;
    const hours = (new Date(wo.actualEnd!).getTime() - new Date(wo.actualStart!).getTime()) / 3600000;
    const entry = byTechnician.get(wo.assignedTo) ?? { count: 0, totalHours: 0 };
    entry.count += 1;
    entry.totalHours += hours;
    byTechnician.set(wo.assignedTo, entry);
  }
  const techniciansPerformance = Array.from(byTechnician.entries())
    .map(([id, v]) => ({
      name: technicianNameById.get(id) ?? `Technicien #${id}`,
      workOrders: v.count,
      avgTime: v.count > 0 ? v.totalHours / v.count : 0,
    }))
    .sort((a, b) => b.workOrders - a.workOrders)
    .slice(0, 5);

  const lastMaintenanceByEquipment = new Map<number, Date>();
  for (const wo of allWorkOrders) {
    if (wo.status === "completed" && wo.equipmentId && wo.actualEnd) {
      const current = lastMaintenanceByEquipment.get(wo.equipmentId);
      const end = new Date(wo.actualEnd);
      if (!current || end > current) lastMaintenanceByEquipment.set(wo.equipmentId, end);
    }
  }
  const equipmentHealth = equipmentList.slice(0, 20).map((eq) => ({
    id: String(eq.id),
    name: eq.equipmentName,
    status: eq.operationalState ?? "inconnu",
    lastMaintenance: lastMaintenanceByEquipment.get(eq.id)?.toLocaleDateString("fr-FR") ?? "Aucune",
  }));

  // Constats factuels ancrés dans les chiffres réels de la période — pas de conseil générique
  // pré-écrit indépendant des données.
  const recommendedActions: string[] = [];
  if (totalWorkOrders === 0) {
    recommendedActions.push("Aucun ordre de travail enregistré sur cette période — vérifier la saisie GMAO.");
  } else {
    // Dans cette branche `totalWorkOrders > 0`, donc les trois taux existent.
    // TypeScript ne déduit pas cette garantie à travers la condition.
    const partPreventive = preventiveCompliance as number;

    if (partPreventive < 50) {
      recommendedActions.push(
        `Seulement ${partPreventive.toFixed(0)}% des ordres de travail sont de type préventif sur la période (référence courante en fiabilité industrielle : majorité préventive) — la part corrective/urgente reste élevée.`
      );
    }
    if (emergencyInterventions > 0) {
      recommendedActions.push(
        `${emergencyInterventions} intervention(s) d'urgence non planifiée(s) sur la période.`
      );
    }
    if (pendingWorkOrders > completedWorkOrders && totalWorkOrders >= 5) {
      recommendedActions.push(
        `${pendingWorkOrders} ordres de travail en attente ou en cours contre ${completedWorkOrders} complétés sur la période.`
      );
    }
    if (mtbf === undefined && failureOrders.length <= 1) {
      recommendedActions.push(
        "MTBF non calculable : moins de deux interventions correctives/urgentes enregistrées sur la période."
      );
    }
    if (recommendedActions.length === 0) {
      recommendedActions.push(
        `${completedWorkOrders}/${totalWorkOrders} ordres de travail complétés, ${partPreventive.toFixed(0)}% de part préventive — aucun signal défavorable détecté sur la période.`
      );
    }
  }

  const periodLabelMap: Record<string, string> = {
    weekly: "7 derniers jours",
    monthly: "30 derniers jours",
    quarterly: "90 derniers jours",
    yearly: "365 derniers jours",
  };

  return {
    periodLabel: periodLabelMap[periodeCanonique],
    periodStart,
    periodEnd,
    totalWorkOrders,
    completedWorkOrders,
    pendingWorkOrders,
    emergencyInterventions,
    preventiveCompliance,
    performanceScore,
    averageResolutionTime,
    mttr,
    mtbf,
    availability,
    reliability,
    laborCost,
    partsCost,
    contractorCost,
    totalCost,
    costPerWorkOrder,
    topEquipmentIssues,
    techniciansPerformance,
    equipmentHealth,
    recommendedActions,
  };
}
