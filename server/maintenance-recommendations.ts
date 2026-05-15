/**
 * Moteur de recommandations personnalisées de maintenance
 * Analyse l'historique des OT, l'utilisation des équipements et les plans existants
 * pour générer des recommandations intelligentes et priorisées.
 */

import type { Express } from "express";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { storage } from "./storage";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MaintenanceRecommendation {
  id: string;
  equipmentId: number;
  equipmentName: string;
  equipmentType: string;
  location: string;
  priority: "critical" | "high" | "medium" | "low";
  type: "overdue" | "predictive" | "usage_based" | "failure_pattern" | "seasonal" | "ai_optimized";
  title: string;
  description: string;
  reasoning: string[];
  suggestedDate: string;
  estimatedDuration: number; // minutes
  estimatedCost: number;
  confidence: number; // 0-100
  kpis: {
    failureRisk: number;       // % risk of failure in 30 days
    mtbfDays: number;          // Mean Time Between Failures (days)
    daysSinceLastMaintenance: number;
    completionRate: number;    // % of PM plans completed on time
  };
  actions: string[];
  relatedWorkOrders: number[];
}

interface RecommendationSummary {
  totalRecommendations: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgConfidence: number;
  estimatedCostIfIgnored: number;
  topRisks: string[];
}

// ── Core analysis engine ───────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.abs((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function frequencyToDays(freq: string, value?: number | null): number {
  switch (freq) {
    case "daily":     return 1;
    case "weekly":    return 7;
    case "monthly":   return 30;
    case "quarterly": return 90;
    case "annually":  return 365;
    case "hours_based": return (value || 500) / 8; // assume 8h/day
    case "usage_based": return (value || 1000) / 20; // assume 20 cycles/day
    default: return 90;
  }
}

function calcMTBF(workOrders: any[], equipmentId: number): number {
  const failures = workOrders
    .filter((wo: any) => wo.equipmentId === equipmentId && wo.orderType === "corrective" && wo.actualEnd)
    .sort((a: any, b: any) => new Date(a.actualEnd).getTime() - new Date(b.actualEnd).getTime());

  if (failures.length < 2) return 365; // default: 1 year
  const gaps: number[] = [];
  for (let i = 1; i < failures.length; i++) {
    gaps.push(daysBetween(new Date(failures[i - 1].actualEnd), new Date(failures[i].actualEnd)));
  }
  return Math.round(gaps.reduce((s, v) => s + v, 0) / gaps.length);
}

function calcCompletionRate(workOrders: any[], equipmentId: number): number {
  const preventive = workOrders.filter((wo: any) => wo.equipmentId === equipmentId && wo.orderType === "preventive");
  if (!preventive.length) return 100;
  const completed = preventive.filter((wo: any) => wo.status === "completed").length;
  return Math.round((completed / preventive.length) * 100);
}

function calcFailureRisk(
  daysSinceLast: number,
  intervalDays: number,
  mtbf: number,
  recentFailures: number,
  criticalityLevel: string
): number {
  let risk = 0;

  // Overdue factor: more overdue → more risk
  const overdueRatio = daysSinceLast / intervalDays;
  if (overdueRatio > 1.5) risk += 40;
  else if (overdueRatio > 1.2) risk += 25;
  else if (overdueRatio > 1.0) risk += 15;
  else if (overdueRatio > 0.8) risk += 5;

  // MTBF factor
  if (mtbf < 30)  risk += 30;
  else if (mtbf < 60) risk += 20;
  else if (mtbf < 90) risk += 10;

  // Recent failures
  risk += Math.min(recentFailures * 8, 20);

  // Criticality weight
  if (criticalityLevel === "critical") risk = Math.round(risk * 1.4);
  else if (criticalityLevel === "high")   risk = Math.round(risk * 1.2);

  return Math.min(95, Math.max(2, risk));
}

function determinePriority(failureRisk: number, criticalityLevel: string, isOverdue: boolean): "critical" | "high" | "medium" | "low" {
  if (criticalityLevel === "critical" && isOverdue) return "critical";
  if (failureRisk >= 60) return "critical";
  if (failureRisk >= 35) return "high";
  if (failureRisk >= 15) return "medium";
  return "low";
}

function estimateCost(equipmentType: string, duration: number): number {
  const laborRate = 75; // €/h
  const materialRates: Record<string, number> = {
    pompe: 250, compresseur: 400, convoyeur: 300, moteur: 350,
    robot: 600, turbine: 800, generateur: 700, default: 200,
  };
  const typeKey = Object.keys(materialRates).find(k => equipmentType?.toLowerCase().includes(k)) || "default";
  const laborCost = (duration / 60) * laborRate;
  const materialCost = materialRates[typeKey];
  return Math.round(laborCost + materialCost);
}

// ── Main analysis function ─────────────────────────────────────────────────────

export async function generateRecommendations(tenantId: string): Promise<{
  recommendations: MaintenanceRecommendation[];
  summary: RecommendationSummary;
  generatedAt: string;
  analysisMetadata: object;
}> {
  const now = new Date();

  // Load all data
  const [allEquipment, allWorkOrders, allPlans] = await Promise.all([
    storage.getEquipmentRegistry(),
    storage.getWorkOrders(),
    storage.getPreventiveMaintenancePlans(),
  ]);

  // Filter by tenant
  const equipment = allEquipment.filter((e: any) => e.tenantId === tenantId);
  const workOrders = allWorkOrders.filter((wo: any) => wo.tenantId === tenantId);
  const plans = allPlans.filter((p: any) => !p.tenantId || p.tenantId === tenantId);

  const recommendations: MaintenanceRecommendation[] = [];

  for (const eq of equipment) {
    if (eq.operationalState === "decommissioned") continue;

    const eqWOs = workOrders.filter((wo: any) => wo.equipmentId === eq.id);
    const recentFailures = eqWOs.filter((wo: any) => {
      if (wo.orderType !== "corrective") return false;
      const created = new Date(wo.createdAt);
      return daysBetween(created, now) <= 90;
    }).length;

    const completedWOs = eqWOs.filter((wo: any) => wo.status === "completed" && wo.actualEnd);
    const lastMaintDate = completedWOs.length
      ? new Date(Math.max(...completedWOs.map((wo: any) => new Date(wo.actualEnd).getTime())))
      : (eq.installationDate ? new Date(eq.installationDate) : new Date(now.getTime() - 365 * 86400000));

    const daysSinceLast = Math.round(daysBetween(lastMaintDate, now));
    const mtbf = calcMTBF(workOrders, eq.id);
    const completionRate = calcCompletionRate(workOrders, eq.id);

    const relatedPlans = plans.filter((p: any) => {
      if (!p.equipmentType) return false;
      return eq.equipmentType?.toLowerCase().includes(p.equipmentType.toLowerCase()) ||
             p.equipmentType.toLowerCase().includes(eq.equipmentType?.toLowerCase() || "");
    });

    // ── RECOMMENDATION 1: Overdue preventive maintenance ──────────────────────
    for (const plan of relatedPlans) {
      if (!plan.isActive) continue;
      const intervalDays = frequencyToDays(plan.frequency, plan.frequencyValue);
      const overdueBy = daysSinceLast - intervalDays;

      if (overdueBy > -14) { // Within 2 weeks of due date or already overdue
        const failureRisk = calcFailureRisk(daysSinceLast, intervalDays, mtbf, recentFailures, eq.criticalityLevel || "medium");
        const isOverdue = overdueBy > 0;
        const priority = determinePriority(failureRisk, eq.criticalityLevel || "medium", isOverdue);
        const duration = plan.estimatedDuration || 120;

        const reasoning: string[] = [];
        if (isOverdue) reasoning.push(`En retard de ${Math.round(overdueBy)} jours selon le plan "${plan.planName}"`);
        else reasoning.push(`Échéance dans ${Math.abs(Math.round(overdueBy))} jours — planification recommandée`);
        if (recentFailures > 0) reasoning.push(`${recentFailures} panne(s) corrective(s) ces 90 derniers jours`);
        if (mtbf < 60) reasoning.push(`MTBF bas (${mtbf} jours) — risque de défaillance élevé`);
        if (completionRate < 70) reasoning.push(`Taux de complétion des MP : ${completionRate}% — amélioration nécessaire`);

        const suggestedDays = Math.max(0, -overdueBy);
        const suggestedDate = new Date(now.getTime() + suggestedDays * 86400000);

        recommendations.push({
          id: `REC-${eq.id}-PLAN-${plan.id}`,
          equipmentId: eq.id,
          equipmentName: eq.equipmentName,
          equipmentType: eq.equipmentType,
          location: eq.location || "Non défini",
          priority,
          type: isOverdue ? "overdue" : "predictive",
          title: isOverdue
            ? `⚠️ Maintenance en retard — ${plan.planName}`
            : `📅 Planifier — ${plan.planName}`,
          description: `${plan.planName} pour ${eq.equipmentName} (${eq.equipmentType})`,
          reasoning,
          suggestedDate: suggestedDate.toISOString().split("T")[0],
          estimatedDuration: duration,
          estimatedCost: estimateCost(eq.equipmentType, duration),
          confidence: Math.min(95, 50 + (isOverdue ? 30 : 15) + (recentFailures * 5)),
          kpis: { failureRisk, mtbfDays: mtbf, daysSinceLastMaintenance: daysSinceLast, completionRate },
          actions: [
            `Programmer un arrêt de ${Math.round(duration / 60)}h pour l'intervention`,
            "Préparer les pièces de rechange nécessaires",
            "Assigner un technicien qualifié",
            ...(recentFailures > 1 ? ["Effectuer une inspection approfondie des composants critiques"] : []),
          ],
          relatedWorkOrders: eqWOs.slice(0, 5).map((wo: any) => wo.id),
        });
      }
    }

    // ── RECOMMENDATION 2: Failure pattern detection ───────────────────────────
    if (recentFailures >= 2 && !relatedPlans.length) {
      const failureRisk = Math.min(90, 30 + recentFailures * 15);
      const priority = eq.criticalityLevel === "critical" ? "critical" : failureRisk >= 50 ? "high" : "medium";
      const duration = 180;

      recommendations.push({
        id: `REC-${eq.id}-PATTERN`,
        equipmentId: eq.id,
        equipmentName: eq.equipmentName,
        equipmentType: eq.equipmentType,
        location: eq.location || "Non défini",
        priority: priority as any,
        type: "failure_pattern",
        title: `🔄 Schéma de pannes récurrentes détecté`,
        description: `${recentFailures} pannes correctives en 90 jours sans plan de maintenance préventive`,
        reasoning: [
          `${recentFailures} interventions correctives ces 90 derniers jours`,
          "Aucun plan de maintenance préventive associé à cet équipement",
          `MTBF estimé : ${mtbf} jours — cycle de défaillance court`,
          "Coût total corectif estimé probablement supérieur à un plan préventif structuré",
        ],
        suggestedDate: new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0],
        estimatedDuration: duration,
        estimatedCost: estimateCost(eq.equipmentType, duration),
        confidence: Math.min(92, 60 + recentFailures * 8),
        kpis: { failureRisk, mtbfDays: mtbf, daysSinceLastMaintenance: daysSinceLast, completionRate },
        actions: [
          "Créer un plan de maintenance préventive dédié à cet équipement",
          "Analyser les causes racines des pannes récentes (RCA)",
          "Vérifier l'état des composants à usure rapide",
          "Constituer un stock de pièces critiques",
        ],
        relatedWorkOrders: eqWOs.filter((wo: any) => wo.orderType === "corrective").slice(0, 5).map((wo: any) => wo.id),
      });
    }

    // ── RECOMMENDATION 3: High-criticality equipment without recent maintenance ─
    if (
      (eq.criticalityLevel === "critical" || eq.criticalityLevel === "high") &&
      daysSinceLast > 60 &&
      !recommendations.find(r => r.equipmentId === eq.id)
    ) {
      const failureRisk = calcFailureRisk(daysSinceLast, 90, mtbf, recentFailures, eq.criticalityLevel);
      if (failureRisk >= 20) {
        const duration = 90;
        recommendations.push({
          id: `REC-${eq.id}-CRITICAL`,
          equipmentId: eq.id,
          equipmentName: eq.equipmentName,
          equipmentType: eq.equipmentType,
          location: eq.location || "Non défini",
          priority: failureRisk >= 50 ? "high" : "medium",
          type: "usage_based",
          title: `🔍 Inspection recommandée — équipement ${eq.criticalityLevel === "critical" ? "critique" : "prioritaire"}`,
          description: `${eq.equipmentName} n'a pas eu de maintenance depuis ${daysSinceLast} jours`,
          reasoning: [
            `Niveau de criticité : ${eq.criticalityLevel}`,
            `Dernière maintenance : il y a ${daysSinceLast} jours`,
            `Risque de défaillance estimé : ${failureRisk}%`,
          ],
          suggestedDate: new Date(now.getTime() + 14 * 86400000).toISOString().split("T")[0],
          estimatedDuration: duration,
          estimatedCost: estimateCost(eq.equipmentType, duration),
          confidence: 65,
          kpis: { failureRisk, mtbfDays: mtbf, daysSinceLastMaintenance: daysSinceLast, completionRate },
          actions: [
            "Planifier une inspection visuelle et fonctionnelle",
            "Vérifier les paramètres de fonctionnement (vibration, température, pression)",
            "Mettre à jour l'historique de maintenance",
          ],
          relatedWorkOrders: eqWOs.slice(0, 3).map((wo: any) => wo.id),
        });
      }
    }
  }

  // Sort: critical first, then by failure risk desc
  recommendations.sort((a, b) => {
    const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const pDiff = pOrder[a.priority] - pOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.kpis.failureRisk - a.kpis.failureRisk;
  });

  // Build summary
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  recommendations.forEach(r => counts[r.priority]++);
  const avgConf = recommendations.length
    ? Math.round(recommendations.reduce((s, r) => s + r.confidence, 0) / recommendations.length)
    : 0;

  const summary: RecommendationSummary = {
    totalRecommendations: recommendations.length,
    ...counts,
    avgConfidence: avgConf,
    estimatedCostIfIgnored: Math.round(
      recommendations.filter(r => r.priority === "critical" || r.priority === "high")
        .reduce((s, r) => s + r.estimatedCost * 3.5, 0) // corrective costs ~3.5x preventive
    ),
    topRisks: recommendations
      .filter(r => r.priority === "critical" || r.priority === "high")
      .slice(0, 3)
      .map(r => r.equipmentName),
  };

  return {
    recommendations,
    summary,
    generatedAt: now.toISOString(),
    analysisMetadata: {
      equipmentAnalyzed: equipment.length,
      workOrdersAnalyzed: workOrders.length,
      plansAnalyzed: plans.length,
      lookbackDays: 90,
    },
  };
}

// ── Route registration ─────────────────────────────────────────────────────────

export function registerRecommendationRoutes(app: Express) {
  // GET /api/maintenance-recommendations — full recommendations for the current tenant
  app.get(
    "/api/maintenance-recommendations",
    EnterpriseAuthMiddleware.requireAuthentication,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || "default-tenant";
        const result = await generateRecommendations(tenantId);
        res.json(result);
      } catch (err) {
        console.error("[Recommendations] Error:", err);
        res.status(500).json({ error: "RECOMMENDATION_FAILED", message: "Impossible de générer les recommandations." });
      }
    }
  );

  // GET /api/maintenance-recommendations/equipment/:id — recommendations for one equipment
  app.get(
    "/api/maintenance-recommendations/equipment/:id",
    EnterpriseAuthMiddleware.requireAuthentication,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId || "default-tenant";
        const equipmentId = parseInt(req.params.id);
        if (isNaN(equipmentId)) return res.status(400).json({ error: "Invalid equipment id" });

        const result = await generateRecommendations(tenantId);
        const filtered = {
          ...result,
          recommendations: result.recommendations.filter(r => r.equipmentId === equipmentId),
        };
        res.json(filtered);
      } catch (err) {
        console.error("[Recommendations] Equipment filter error:", err);
        res.status(500).json({ error: "RECOMMENDATION_FAILED" });
      }
    }
  );

  // POST /api/maintenance-recommendations/apply — convert recommendation to a work order
  app.post(
    "/api/maintenance-recommendations/apply",
    EnterpriseAuthMiddleware.requireAuthentication,
    async (req: any, res) => {
      try {
        const { recommendationId, equipmentId, title, description, scheduledDate, estimatedDuration, priority } = req.body;
        if (!equipmentId || !title) {
          return res.status(400).json({ error: "equipmentId and title are required" });
        }

        const tenantId = req.user?.tenantId || "default-tenant";
        const userId = req.user?.id;

        // Generate unique order number
        const orderNumber = `OT-REC-${Date.now().toString().slice(-8)}`;

        const newWO = await storage.createWorkOrder({
          tenantId,
          orderNumber,
          equipmentId,
          orderType: "preventive",
          title,
          description: description || `Créé depuis la recommandation ${recommendationId}`,
          priority: priority || "medium",
          status: "pending",
          requestedBy: userId,
          scheduledStart: scheduledDate ? new Date(scheduledDate) : undefined,
          scheduledEnd: scheduledDate
            ? new Date(new Date(scheduledDate).getTime() + (estimatedDuration || 120) * 60000)
            : undefined,
          estimatedDuration: estimatedDuration || 120,
          notes: `Généré automatiquement depuis la recommandation de maintenance ${recommendationId}`,
        } as any);

        res.status(201).json({
          success: true,
          workOrder: newWO,
          message: "Ordre de travail créé avec succès depuis la recommandation.",
        });
      } catch (err) {
        console.error("[Recommendations] Apply error:", err);
        res.status(500).json({ error: "APPLY_FAILED", message: "Impossible de créer l'ordre de travail." });
      }
    }
  );

  console.log("🎯 Maintenance Recommendations routes registered");
}
