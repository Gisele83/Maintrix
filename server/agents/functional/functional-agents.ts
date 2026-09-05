import { pool as sharedPool } from "../../db";
import { detectCompetencyGaps } from "../../techlearn-bridge-service";
import { canTransition } from "../../equipment-lifecycle-engine";
import { FunctionalDomain, type AgentSignal, type FunctionalAgentAssessment, type FunctionalAgentAssessor, worstSeverity } from "./types";

function assessment(
  domain: FunctionalDomain,
  name: string,
  signals: AgentSignal[],
  summary: string,
  recommendations: string[],
): FunctionalAgentAssessment {
  return { domain, name, status: worstSeverity(signals), summary, signals, recommendations, computedAt: new Date().toISOString() };
}

const diagnosticAgent: FunctionalAgentAssessor = async (tenantId) => {
  const r = await sharedPool.query(
    `SELECT
       COUNT(*) FILTER (WHERE asd.status = 'pending') AS pending,
       COUNT(*) FILTER (WHERE asd.status = 'pending' AND asd.confidence >= 0.8) AS high_confidence,
       COUNT(*) FILTER (WHERE asd.status = 'pending' AND asd.triggered_at > now() - interval '24 hours') AS last24h
     FROM automated_symptom_detection asd
     JOIN equipment_registry er ON er.id = asd.equipment_id
     WHERE er.tenant_id = $1`,
    [tenantId],
  );
  const { pending, high_confidence, last24h } = r.rows[0];
  const signals: AgentSignal[] = [
    { label: "Symptômes détectés en attente", value: Number(pending), severity: Number(pending) > 0 ? "warning" : "info" },
    { label: "Haute confiance (≥80%) non vérifiés", value: Number(high_confidence), severity: Number(high_confidence) > 0 ? "high" : "info" },
    { label: "Détectés dans les dernières 24h", value: Number(last24h), severity: "info" },
  ];
  return assessment(
    FunctionalDomain.DIAGNOSTIC,
    "Diagnostic Agent",
    signals,
    `${pending} symptôme(s) automatiquement détecté(s) en attente de vérification humaine.`,
    Number(high_confidence) > 0 ? ["Vérifier en priorité les détections à haute confiance non traitées"] : [],
  );
};

const planningAgent: FunctionalAgentAssessor = async (tenantId) => {
  const wo = await sharedPool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending') AS pending,
       COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled') AND scheduled_start < now()) AS overdue
     FROM work_orders WHERE tenant_id = $1`,
    [tenantId],
  );
  const pm = await sharedPool.query(
    `SELECT COUNT(*) AS overdue_pm FROM preventive_maintenance_plans
     WHERE tenant_id = $1 AND is_active = true AND next_due IS NOT NULL AND next_due < now()`,
    [tenantId],
  );
  const { pending, overdue } = wo.rows[0];
  const overduePm = pm.rows[0].overdue_pm;
  const signals: AgentSignal[] = [
    { label: "OT en attente d'affectation", value: Number(pending), severity: Number(pending) > 5 ? "warning" : "info" },
    { label: "OT en retard (planifiés non démarrés)", value: Number(overdue), severity: Number(overdue) > 0 ? "high" : "info" },
    { label: "Plans préventifs en retard", value: Number(overduePm), severity: Number(overduePm) > 0 ? "high" : "info" },
  ];
  return assessment(
    FunctionalDomain.PLANNING,
    "Planning Agent",
    signals,
    `${overdue} ordre(s) de travail en retard, ${overduePm} plan(s) préventif(s) échu(s).`,
    Number(overduePm) > 0 ? ["Replanifier les plans de maintenance préventive échus"] : [],
  );
};

const reliabilityAgent: FunctionalAgentAssessor = async (tenantId) => {
  const r = await sharedPool.query(
    `SELECT dt.last_remaining_useful_life AS rul, er.equipment_name, er.lifecycle_stage
     FROM digital_twins dt
     JOIN equipment_registry er ON er.id = dt.equipment_id
     WHERE dt.tenant_id = $1 AND dt.last_remaining_useful_life IS NOT NULL
     ORDER BY dt.last_remaining_useful_life ASC`,
    [tenantId],
  );
  const critical = r.rows.filter((row: any) => Number(row.rul) < 720); // < 30 jours (h)
  const warning = r.rows.filter((row: any) => Number(row.rul) >= 720 && Number(row.rul) < 2160); // 30-90 jours
  const signals: AgentSignal[] = [
    { label: "Jumeaux numériques avec RUL calculée", value: r.rows.length, severity: "info" },
    {
      label: "Équipements < 30j de durée de vie restante",
      value: critical.length,
      severity: critical.length > 0 ? "critical" : "info",
      detail: critical.map((c: any) => c.equipment_name).join(", ") || undefined,
    },
    { label: "Équipements 30-90j", value: warning.length, severity: warning.length > 0 ? "warning" : "info" },
  ];

  const recommendations: string[] = [];
  if (critical.length > 0) {
    recommendations.push(`Planifier une intervention avant échéance pour : ${critical.map((c: any) => c.equipment_name).join(", ")}`);
  }
  // Ancrage cycle de vie ISO 55000 (section 12) : une RUL critique justifie de faire
  // transiter l'équipement vers l'étape "Surveillance" — seulement si la machine à états
  // l'autorise depuis l'étape courante (pas de suggestion pour un équipement déjà en
  // réparation, par exemple).
  const needsSurveillance = critical.filter((c: any) => c.lifecycle_stage !== "surveillance" && canTransition(c.lifecycle_stage, "surveillance"));
  if (needsSurveillance.length > 0) {
    recommendations.push(
      `Faire transiter vers l'étape "Surveillance" (cycle de vie ISO 55000) : ${needsSurveillance.map((c: any) => c.equipment_name).join(", ")}`,
    );
  }

  return assessment(
    FunctionalDomain.RELIABILITY,
    "Reliability Agent",
    signals,
    r.rows.length === 0
      ? "Aucun jumeau numérique calibré avec estimation de durée de vie restante."
      : `${critical.length} équipement(s) à moins de 30 jours de fin de vie estimée.`,
    recommendations,
  );
};

const qhseAgent: FunctionalAgentAssessor = async (tenantId) => {
  const r = await sharedPool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'active') AS active,
       COUNT(*) FILTER (WHERE status = 'active' AND risk_level = 'critical') AS active_critical,
       COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled', 'rejected') AND planned_end < now()) AS overdue
     FROM permit_to_work WHERE tenant_id = $1`,
    [tenantId],
  );
  const { active, active_critical, overdue } = r.rows[0];
  const signals: AgentSignal[] = [
    { label: "Permis de travail actifs", value: Number(active), severity: "info" },
    { label: "Permis actifs à risque critique", value: Number(active_critical), severity: Number(active_critical) > 0 ? "high" : "info" },
    { label: "Permis dépassant leur fin planifiée", value: Number(overdue), severity: Number(overdue) > 0 ? "critical" : "info" },
  ];
  return assessment(
    FunctionalDomain.QHSE,
    "QHSE Agent",
    signals,
    `${active} permis de travail actif(s), dont ${active_critical} à risque critique.`,
    Number(overdue) > 0 ? ["Clôturer ou prolonger formellement les permis dépassant leur échéance planifiée"] : [],
  );
};

const documentationAgent: FunctionalAgentAssessor = async (tenantId) => {
  const r = await sharedPool.query(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE embedding IS NULL) AS without_embedding
     FROM knowledge_hub_documents WHERE tenant_id = $1`,
    [tenantId],
  );
  const { total, without_embedding } = r.rows[0];
  const signals: AgentSignal[] = [
    { label: "Documents au Knowledge Hub", value: Number(total), severity: "info" },
    {
      label: "Sans indexation sémantique",
      value: Number(without_embedding),
      severity: Number(total) > 0 && Number(without_embedding) === Number(total) ? "warning" : "info",
    },
  ];
  return assessment(
    FunctionalDomain.DOCUMENTATION,
    "Documentation Agent",
    signals,
    Number(total) === 0 ? "Aucun document au Knowledge Hub pour ce tenant." : `${total} document(s) au Knowledge Hub.`,
    [],
  );
};

const procurementAgent: FunctionalAgentAssessor = async (tenantId) => {
  const parts = await sharedPool.query(
    `SELECT part_name, current_stock, reorder_point FROM spare_parts
     WHERE tenant_id = $1 AND is_active = true AND current_stock <= reorder_point`,
    [tenantId],
  );
  // purchase_orders n'a pas de colonne tenant_id dans le schéma actuel — comptage global,
  // pas isolé par tenant (limite connue de la table, pas une omission de cette requête).
  const po = await sharedPool.query(`SELECT COUNT(*) AS pending FROM purchase_orders WHERE status IN ('draft', 'sent')`);
  const signals: AgentSignal[] = [
    {
      label: "Pièces sous le seuil de réapprovisionnement",
      value: parts.rows.length,
      severity: parts.rows.length > 0 ? "high" : "info",
      detail: parts.rows.map((p: any) => p.part_name).join(", ") || undefined,
    },
    { label: "Bons de commande en attente (tous tenants)", value: Number(po.rows[0].pending), severity: "info" },
  ];
  return assessment(
    FunctionalDomain.PROCUREMENT,
    "Procurement Agent",
    signals,
    `${parts.rows.length} référence(s) de pièces détachées sous le seuil de réapprovisionnement.`,
    parts.rows.length > 0 ? [`Déclencher un réapprovisionnement pour : ${parts.rows.map((p: any) => p.part_name).join(", ")}`] : [],
  );
};

const knowledgeAgent: FunctionalAgentAssessor = async (tenantId) => {
  const nodes = await sharedPool.query(`SELECT COUNT(*) AS total FROM kg_nodes WHERE tenant_id = $1`, [tenantId]);
  const edges = await sharedPool.query(
    `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE last_reinforced_at > now() - interval '7 days') AS recent
     FROM kg_edges WHERE tenant_id = $1`,
    [tenantId],
  );
  const signals: AgentSignal[] = [
    { label: "Nœuds du graphe de connaissance", value: Number(nodes.rows[0].total), severity: "info" },
    { label: "Relations (arêtes)", value: Number(edges.rows[0].total), severity: "info" },
    { label: "Renforcées dans les 7 derniers jours", value: Number(edges.rows[0].recent), severity: "info" },
  ];
  return assessment(
    FunctionalDomain.KNOWLEDGE,
    "Knowledge Agent",
    signals,
    `Graphe de connaissance métier : ${nodes.rows[0].total} nœuds, ${edges.rows[0].total} relations.`,
    [],
  );
};

const digitalTwinAgent: FunctionalAgentAssessor = async (tenantId) => {
  const r = await sharedPool.query(
    `SELECT
       COUNT(*) AS total_equipment,
       COUNT(dt.id) AS with_twin,
       COUNT(*) FILTER (WHERE dt.is_calibrated = true) AS calibrated,
       COUNT(*) FILTER (WHERE dt.last_computed_at IS NOT NULL AND dt.last_computed_at < now() - interval '30 days') AS stale
     FROM equipment_registry er
     LEFT JOIN digital_twins dt ON dt.equipment_id = er.id
     WHERE er.tenant_id = $1`,
    [tenantId],
  );
  const { total_equipment, with_twin, calibrated, stale } = r.rows[0];
  const coverage = Number(total_equipment) > 0 ? Math.round((Number(with_twin) / Number(total_equipment)) * 100) : 0;
  const signals: AgentSignal[] = [
    { label: "Couverture jumeau numérique", value: `${coverage}% (${with_twin}/${total_equipment})`, severity: coverage < 50 ? "warning" : "info" },
    { label: "Jumeaux calibrés (données réelles)", value: Number(calibrated), severity: "info" },
    { label: "Résultats non recalculés depuis 30j", value: Number(stale), severity: Number(stale) > 0 ? "warning" : "info" },
  ];
  return assessment(
    FunctionalDomain.DIGITAL_TWIN,
    "Digital Twin Agent",
    signals,
    `${with_twin}/${total_equipment} équipement(s) disposent d'un jumeau numérique (${calibrated} calibré(s)).`,
    Number(stale) > 0 ? ["Relancer le calcul des jumeaux numériques obsolètes (> 30 jours)"] : [],
  );
};

const trainingAgent: FunctionalAgentAssessor = async (tenantId) => {
  const gaps = await detectCompetencyGaps(tenantId);
  const signals: AgentSignal[] = [
    {
      label: "Écarts de compétence détectés",
      value: gaps.length,
      severity: gaps.length > 0 ? "high" : "info",
      detail: gaps.map((g) => `${g.technicianName} → ${g.equipmentType} (OT ${g.orderNumber})`).join("; ") || undefined,
    },
  ];
  return assessment(
    FunctionalDomain.TRAINING,
    "Training Agent",
    signals,
    gaps.length === 0
      ? "Tous les techniciens assignés à des OT ouverts ont déjà de l'expérience sur le type d'équipement concerné."
      : `${gaps.length} technicien(s) assigné(s) à un type d'équipement jamais traité auparavant.`,
    gaps.length > 0 ? ["Déclencher une formation TechLearn avant intervention pour les techniciens concernés"] : [],
  );
};

const customerAgent: FunctionalAgentAssessor = async (tenantId) => {
  const r = await sharedPool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending' AND created_at < now() - interval '48 hours') AS unaddressed,
       ROUND(AVG(EXTRACT(EPOCH FROM (actual_start - created_at)) / 3600) FILTER (WHERE actual_start IS NOT NULL AND created_at > now() - interval '30 days'))::int AS avg_hours_to_start
     FROM work_orders
     WHERE tenant_id = $1 AND requested_by IS NOT NULL`,
    [tenantId],
  );
  const { unaddressed, avg_hours_to_start } = r.rows[0];
  const signals: AgentSignal[] = [
    { label: "Demandes internes sans suite depuis > 48h", value: Number(unaddressed), severity: Number(unaddressed) > 0 ? "high" : "info" },
    {
      label: "Délai moyen de prise en charge (30j)",
      value: avg_hours_to_start !== null ? `${avg_hours_to_start}h` : "n/a",
      severity: "info",
    },
  ];
  return assessment(
    FunctionalDomain.CUSTOMER,
    "Customer Agent",
    signals,
    `${unaddressed} demande(s) de client interne sans prise en charge depuis plus de 48h.`,
    Number(unaddressed) > 0 ? ["Accuser réception ou planifier les demandes internes en attente"] : [],
  );
};

const energyAgent: FunctionalAgentAssessor = async (tenantId) => {
  const r = await sharedPool.query(
    `SELECT COUNT(*) AS total_equipment, COUNT(iot.id) AS with_current_sensor
     FROM equipment_registry er
     LEFT JOIN iot_devices iot ON iot.equipment_id = er.id AND iot.device_type = 'current_sensor'
     WHERE er.tenant_id = $1`,
    [tenantId],
  );
  const { total_equipment, with_current_sensor } = r.rows[0];
  // Aucune table de consommation énergétique (kWh) n'existe dans le schéma actuel — le seul
  // signal réel disponible est la couverture en capteurs de courant, pas la consommation
  // elle-même. Statut honnête plutôt qu'une donnée inventée.
  const signals: AgentSignal[] = [
    { label: "Équipements instrumentés (capteur de courant)", value: `${with_current_sensor}/${total_equipment}`, severity: "info" },
  ];
  return assessment(
    FunctionalDomain.ENERGY,
    "Energy Agent",
    signals,
    "Non instrumenté : aucune donnée de consommation énergétique (kWh) n'est encore collectée dans Maintrix.",
    ["Instrumenter le suivi de consommation énergétique pour activer ce domaine"],
  );
};

export const FUNCTIONAL_AGENTS: { domain: FunctionalDomain; assess: FunctionalAgentAssessor }[] = [
  { domain: FunctionalDomain.DIAGNOSTIC, assess: diagnosticAgent },
  { domain: FunctionalDomain.PLANNING, assess: planningAgent },
  { domain: FunctionalDomain.RELIABILITY, assess: reliabilityAgent },
  { domain: FunctionalDomain.QHSE, assess: qhseAgent },
  { domain: FunctionalDomain.DOCUMENTATION, assess: documentationAgent },
  { domain: FunctionalDomain.PROCUREMENT, assess: procurementAgent },
  { domain: FunctionalDomain.KNOWLEDGE, assess: knowledgeAgent },
  { domain: FunctionalDomain.DIGITAL_TWIN, assess: digitalTwinAgent },
  { domain: FunctionalDomain.TRAINING, assess: trainingAgent },
  { domain: FunctionalDomain.CUSTOMER, assess: customerAgent },
  { domain: FunctionalDomain.ENERGY, assess: energyAgent },
];
