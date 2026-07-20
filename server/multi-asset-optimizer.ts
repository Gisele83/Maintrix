/**
 * Multi-Asset Combinatorial Optimizer — Arbitrage GMAO sous contrainte budget
 * Brevet N°1 MAINTRIX-SCA-IMCA — Extension optimisation de portefeuille d'actifs
 *
 * Problème : Multiple Choice Knapsack Problem (MCKP)
 *   ─ N actifs, chacun avec K actions possibles (y compris "ne rien faire")
 *   ─ Variables : x_ij ∈ {0,1}, Σ_j x_ij ≤ 1 ∀i
 *   ─ Objectif  : Maximiser Σ_i Σ_j x_ij × v_ij
 *                 où v_ij = Δgain_ij × w_criticality_i
 *   ─ Contraintes : Σ_i Σ_j x_ij × cost_ij ≤ B  (budget)
 *                   Σ_i Σ_j x_ij × res_ij  ≤ R  (techniciens·jours)
 *                   x_ij ∈ {0,1}
 *
 * Solveurs implémentés :
 *   1. DP-MCKP         — exact optimal, O(N·K·slots)
 *   2. Greedy ROI       — heuristique rapide, tri par valeur/coût pondéré
 *   3. Front de Pareto  — courbe budget ↔ gain sur 25 niveaux de budget
 *   4. Branch & Bound   — exact avec élagage, meilleur pour grands N
 */

import type { ArbitrationWeights } from "./arbitration-learning";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionType = "none" | "inspection" | "preventive" | "corrective" | "overhaul";

export interface AssetAction {
  type: ActionType;
  label: string;
  cost: number;              // € TTC
  gainIMCA: number;          // Δ IMCA pts espéré
  techDays: number;          // technicien·jours requis
  duration: number;          // jours d'immobilisation équipement
  description: string;
}

export interface AssetInput {
  equipmentId: number;
  equipmentName: string;
  equipmentType: string;
  currentIMCA: number;       // score IMCA actuel [0–100]
  alertLevel: "ok" | "watch" | "warning" | "critical";
  isMandatory?: boolean;     // action corrective obligatoire si true
  maintenanceCost?: number;  // coût référence (optionnel, pour calibration)
  rul_hours?: number | null;  // RUL médian (P50) en heures
  actions?: AssetAction[];   // actions personnalisées (sinon générées automatiquement)
}

export interface BudgetConstraints {
  totalBudget: number;       // budget total disponible (€)
  maxTechDays: number;       // jours·technicien max simultanés
  maxImmobilizationDays?: number; // jours d'immobilisation max par actif
  minCriticalInterventions?: number; // nb minimal d'interventions sur actifs critiques
}

export interface AllocationDecision {
  equipmentId: number;
  equipmentName: string;
  currentIMCA: number;
  selectedAction: AssetAction;
  projectedIMCA: number;
  gainIMCA: number;
  weightedGain: number;      // gain × criticality_weight
  isMandatory: boolean;
  roi: number;               // gain / cost (€/pt IMCA)
}

export interface OptimizationResult {
  algorithm: "dp_mckp" | "greedy_roi" | "branch_bound";
  totalCost: number;
  totalGain: number;         // Δ IMCA total pondéré
  totalUnweightedGain: number;
  usedTechDays: number;
  budgetUtilization: number; // % du budget utilisé
  allocations: AllocationDecision[];
  skippedAssets: { equipmentId: number; equipmentName: string; reason: string }[];
  fleetIMCABefore: number;
  fleetIMCAAfter: number;
  feasible: boolean;
  solverTimeMs: number;
  explanation: string;
}

export interface ParetoPoint {
  budget: number;
  totalGain: number;
  unweightedGain: number;
  nInterventions: number;
  budgetUtilization: number;
}

export interface MultiAssetOptimizationResult {
  optimal: OptimizationResult;          // DP-MCKP exact
  greedy: OptimizationResult;           // Greedy ROI
  branchBound: OptimizationResult;      // Branch & Bound (recommandé pour N > 20 actifs)
  paretoFront: ParetoPoint[];           // courbe budget ↔ gain
  mandatoryBudget: number;             // budget minimum pour actifs critiques obligatoires
  actionCatalog: Record<number, AssetAction[]>; // catalogue actions par actif
  constraints: BudgetConstraints;
  summary: {
    nAssets: number;
    nInterventions: number;
    avgIMCAGain: number;
    criticalCovered: number;
    totalFleetGain: number;
  };
}

// ─── Criticality weights ──────────────────────────────────────────────────────

export const CRITICALITY_WEIGHT: Record<string, number> = {
  critical: 4.0,
  warning: 2.5,
  watch: 1.5,
  ok: 1.0,
};

// ─── Objectif multi-critères λ_k (Brevet N°2, apprentissage post-action) ──────

/**
 * Poids λ_k des critères d'optimisation utilisés par défaut quand aucun état
 * appris n'est fourni (équivaut au comportement historique : pondération par
 * criticité seule, aucune préférence coût/disponibilité).
 */
export const DEFAULT_ARBITRATION_WEIGHTS: ArbitrationWeights = {
  riskWeight: 1,
  costWeight: 0,
  availabilityWeight: 0,
};

/**
 * Combine la pondération de criticité (existante) avec les poids λ_k appris
 * (risque / coût / disponibilité) pour produire, par actif et par action, un
 * multiplicateur de valeur utilisé par les quatre solveurs :
 *   value_ij = criticité_i × (λ_risk + λ_cost × U_cost_ij + λ_avail × U_avail_ij)
 * où U_cost_ij et U_avail_ij ∈ [0,1] favorisent respectivement les actions
 * moins coûteuses et moins immobilisantes au sein du catalogue de l'actif i.
 * Le gain IMCA physique (gainIMCA) n'est jamais altéré — seul ce multiplicateur
 * objectif (utilisé pour la sélection) diffère du gain réellement reporté.
 */
function computeObjectiveWeightMatrix(
  assets: AssetInput[],
  actionsPerAsset: AssetAction[][],
  arbitrationWeights: ArbitrationWeights,
): number[][] {
  return assets.map((asset, i) => {
    const acts = actionsPerAsset[i];
    const criticality = CRITICALITY_WEIGHT[asset.alertLevel] ?? 1.0;
    const maxCost = Math.max(...acts.map(a => a.cost), 1);
    const maxDuration = Math.max(...acts.map(a => a.duration), 1);
    return acts.map(a => {
      const costUtility = 1 - a.cost / maxCost;
      const availUtility = 1 - a.duration / maxDuration;
      const blend =
        arbitrationWeights.riskWeight +
        arbitrationWeights.costWeight * costUtility +
        arbitrationWeights.availabilityWeight * availUtility;
      return criticality * blend;
    });
  });
}

// ─── Action catalog generator ──────────────────────────────────────────────────

/**
 * Génère le catalogue d'actions standardisé pour un actif
 * Coûts et gains calibrés selon le score IMCA actuel et le niveau d'alerte
 */
export function generateActionCatalog(asset: AssetInput): AssetAction[] {
  const { currentIMCA, alertLevel, maintenanceCost } = asset;
  const baseCost = maintenanceCost ?? 5000;  // € référence

  // Facteur d'urgence : plus IMCA est bas, plus les interventions sont coûteuses
  const urgencyFactor = currentIMCA < 30 ? 1.8 : currentIMCA < 50 ? 1.4 : currentIMCA < 70 ? 1.1 : 1.0;

  // Gain maximal potentiel (ne peut pas dépasser 100)
  const maxGain = Math.min(100 - currentIMCA, 100);

  const actions: AssetAction[] = [
    {
      type: "none",
      label: "Aucune action",
      cost: 0,
      gainIMCA: 0,
      techDays: 0,
      duration: 0,
      description: "Surveillance passive uniquement.",
    },
    {
      type: "inspection",
      label: "Inspection approfondie",
      cost: Math.round(baseCost * 0.15 * urgencyFactor),
      gainIMCA: Math.min(maxGain, Math.round(3 + (100 - currentIMCA) * 0.03)),
      techDays: 0.5,
      duration: 0.5,
      description: "Contrôle visuel + mesures + rapport d'état. Permet de préciser le diagnostic.",
    },
    {
      type: "preventive",
      label: "Maintenance préventive",
      cost: Math.round(baseCost * 0.6 * urgencyFactor),
      gainIMCA: Math.min(maxGain, Math.round(10 + (100 - currentIMCA) * 0.08)),
      techDays: 2,
      duration: 1,
      description: "Remplacement pièces d'usure + nettoyage + recalibration + lubrification.",
    },
    {
      type: "corrective",
      label: "Intervention corrective",
      cost: Math.round(baseCost * 1.8 * urgencyFactor),
      gainIMCA: Math.min(maxGain, Math.round(22 + (100 - currentIMCA) * 0.18)),
      techDays: 5,
      duration: 3,
      description: "Réparation complète des défauts détectés. Remise en conformité.",
    },
    {
      type: "overhaul",
      label: "Révision générale (Overhaul)",
      cost: Math.round(baseCost * 5.0 * urgencyFactor),
      gainIMCA: Math.min(maxGain, Math.round(40 + (100 - currentIMCA) * 0.30)),
      techDays: 12,
      duration: 7,
      description: "Démontage complet, remplacement de tous les composants critiques, remise à neuf.",
    },
  ];

  // Filtrer les actions redondantes (si IMCA élevé, corrective/overhaul peu justifiés)
  return actions.filter(a => {
    if (a.type === "overhaul" && currentIMCA > 70 && alertLevel === "ok") return false;
    if (a.type === "corrective" && currentIMCA > 80) return false;
    return true;
  });
}

// ─── DP-MCKP Solver (exact optimal) ───────────────────────────────────────────

/**
 * Résout le Multiple Choice Knapsack Problem par programmation dynamique
 * Complexité : O(N × K × Sb × Sr) où Sb = slots budgétaires, Sr = slots techDays
 *
 * State : dp[b][r] = valeur maximale pondérée avec budget ≤ b×resB ET
 *         ressources techniciens·jours ≤ r×resR — les DEUX contraintes du
 *         Brevet N°1 (§10.2 : Σx_ij·c_ij ≤ B et Σx_ij·r_ij ≤ R) sont
 *         respectées pendant l'optimisation, pas seulement vérifiées a posteriori.
 * Trace : trace[i][b][r] = action choisie pour l'actif i à l'état (b,r)
 */
function solveDP_MCKP(
  assets: AssetInput[],
  actions: AssetAction[][],
  constraints: BudgetConstraints,
  weightMatrix: number[][],
  budgetSlots: number = 200,
  techSlots: number = 50,
): { trace: number[][][] } {
  const B = constraints.totalBudget;
  const R = constraints.maxTechDays > 0 ? constraints.maxTechDays : Infinity;
  const resB = B / budgetSlots;
  const resR = Number.isFinite(R) ? R / techSlots : Infinity;
  const N = assets.length;

  let dp: Float64Array[] = Array.from({ length: budgetSlots + 1 }, () => new Float64Array(techSlots + 1).fill(0));
  const trace: number[][][] = Array.from({ length: N }, () =>
    Array.from({ length: budgetSlots + 1 }, () => new Array(techSlots + 1).fill(0))
  );

  for (let i = 0; i < N; i++) {
    const acts = actions[i];
    const newDp: Float64Array[] = dp.map(row => new Float64Array(row));

    for (let b = budgetSlots; b >= 0; b--) {
      for (let r = techSlots; r >= 0; r--) {
        let bestVal = dp[b][r]; // action "none" (action 0)
        let bestJ = 0;

        for (let j = 1; j < acts.length; j++) {
          const costSlots = Math.ceil(acts[j].cost / resB);
          const techUsed = Number.isFinite(resR) ? Math.ceil(acts[j].techDays / resR) : 0;
          if (costSlots > b || techUsed > r) continue;

          const val = dp[b - costSlots][r - techUsed] + acts[j].gainIMCA * weightMatrix[i][j];
          if (val > bestVal) {
            bestVal = val;
            bestJ = j;
          }
        }

        newDp[b][r] = bestVal;
        trace[i][b][r] = bestJ;
      }
    }

    dp = newDp;
  }

  return { trace };
}

/**
 * Reconstruit le chemin optimal depuis la table DP 2D (budget × techDays)
 */
function reconstructDPSolution(
  assets: AssetInput[],
  actions: AssetAction[][],
  trace: number[][][],
  constraints: BudgetConstraints,
  weightMatrix: number[][],
  budgetSlots: number = 200,
  techSlots: number = 50,
): AllocationDecision[] {
  const R = constraints.maxTechDays > 0 ? constraints.maxTechDays : Infinity;
  const resB = constraints.totalBudget / budgetSlots;
  const resR = Number.isFinite(R) ? R / techSlots : Infinity;
  let b = budgetSlots;
  let r = techSlots;
  const decisions: AllocationDecision[] = [];

  for (let i = assets.length - 1; i >= 0; i--) {
    const j = trace[i][b][r];
    const action = actions[i][j];
    const w = weightMatrix[i][j];

    decisions.unshift({
      equipmentId: assets[i].equipmentId,
      equipmentName: assets[i].equipmentName,
      currentIMCA: assets[i].currentIMCA,
      selectedAction: action,
      projectedIMCA: Math.min(100, assets[i].currentIMCA + action.gainIMCA),
      gainIMCA: action.gainIMCA,
      weightedGain: action.gainIMCA * w,
      isMandatory: assets[i].isMandatory ?? false,
      roi: action.cost > 0 ? action.gainIMCA / (action.cost / 1000) : 0,
    });

    const costSlots = Math.ceil(action.cost / resB);
    const techUsed = Number.isFinite(resR) ? Math.ceil(action.techDays / resR) : 0;
    b = Math.max(0, b - costSlots);
    r = Math.max(0, r - techUsed);
  }

  return decisions;
}

// ─── Branch & Bound Solver (recommandé pour N > 20 actifs) ────────────────────

/**
 * Résolution par séparation et évaluation avec élagage par borne supérieure
 * (Brevet N°1, §10.3 — 4e solveur, absent jusqu'ici de l'implémentation).
 * Borne supérieure : relaxation fractionnaire du MCKP restant (autorise une
 * fraction de la meilleure action par actif), qui majore strictement toute
 * solution entière réalisable — permet un élagage correct.
 */
function solveBranchAndBound(
  assets: AssetInput[],
  actions: AssetAction[][],
  constraints: BudgetConstraints,
  weightMatrix: number[][],
  maxNodes: number = 200_000,
): { decisions: AllocationDecision[]; nodesExplored: number; optimal: boolean } {
  const N = assets.length;
  const maxTech = constraints.maxTechDays > 0 ? constraints.maxTechDays : Infinity;

  // Ordre de branchement : meilleur ratio valeur/coût décroissant (convergence rapide)
  const bestRatio = actions.map((acts, i) => {
    let best = 0;
    for (let j = 1; j < acts.length; j++) {
      if (acts[j].cost > 0) best = Math.max(best, (acts[j].gainIMCA * weightMatrix[i][j]) / acts[j].cost);
    }
    return best;
  });
  const order = assets.map((_, i) => i).sort((a, b) => bestRatio[b] - bestRatio[a]);

  function upperBound(idx: number, remBudget: number, remTech: number): number {
    let bound = 0;
    for (let k = idx; k < N; k++) {
      const i = order[k];
      const acts = actions[i];
      let best = 0;
      for (let j = 1; j < acts.length; j++) {
        const a = acts[j];
        const fitsBudget = a.cost <= remBudget;
        const fitsTech = !Number.isFinite(remTech) || a.techDays <= remTech;
        if (fitsBudget && fitsTech) {
          best = Math.max(best, a.gainIMCA * weightMatrix[i][j]);
        } else if (a.cost > 0) {
          const fracBudget = Math.min(1, remBudget / a.cost);
          const fracTech = Number.isFinite(remTech) && a.techDays > 0 ? Math.min(1, remTech / a.techDays) : 1;
          best = Math.max(best, a.gainIMCA * weightMatrix[i][j] * Math.min(fracBudget, fracTech));
        }
      }
      bound += best;
    }
    return bound;
  }

  let bestValue = -Infinity;
  let bestChoice: number[] = new Array(N).fill(0);
  let nodesExplored = 0;

  function dfs(idx: number, remBudget: number, remTech: number, currentValue: number, choice: number[]) {
    nodesExplored++;
    if (nodesExplored > maxNodes) return;

    if (idx === N) {
      if (currentValue > bestValue) {
        bestValue = currentValue;
        bestChoice = [...choice];
      }
      return;
    }

    if (currentValue + upperBound(idx, remBudget, remTech) <= bestValue) return; // élagage

    const i = order[idx];
    const acts = actions[i];
    const byGainDesc = acts.map((_, j) => j).sort((a, b) => acts[b].gainIMCA - acts[a].gainIMCA);

    for (const j of byGainDesc) {
      const a = acts[j];
      if (a.cost > remBudget) continue;
      if (Number.isFinite(remTech) && a.techDays > remTech) continue;
      choice[idx] = j;
      dfs(idx + 1, remBudget - a.cost, remTech - a.techDays, currentValue + a.gainIMCA * weightMatrix[i][j], choice);
      if (nodesExplored > maxNodes) return;
    }
  }

  dfs(0, constraints.totalBudget, maxTech, 0, new Array(N).fill(0));

  const decisionsByOrder = order.map((i, k) => {
    const j = bestChoice[k];
    const action = actions[i][j];
    const w = weightMatrix[i][j];
    return {
      assetIdx: i,
      decision: {
        equipmentId: assets[i].equipmentId,
        equipmentName: assets[i].equipmentName,
        currentIMCA: assets[i].currentIMCA,
        selectedAction: action,
        projectedIMCA: Math.min(100, assets[i].currentIMCA + action.gainIMCA),
        gainIMCA: action.gainIMCA,
        weightedGain: action.gainIMCA * w,
        isMandatory: assets[i].isMandatory ?? false,
        roi: action.cost > 0 ? action.gainIMCA / (action.cost / 1000) : 0,
      } as AllocationDecision,
    };
  });

  const byAssetIdx = new Map(decisionsByOrder.map(d => [d.assetIdx, d.decision]));
  const decisions = assets.map((_, i) => byAssetIdx.get(i)!);

  return { decisions, nodesExplored, optimal: nodesExplored <= maxNodes };
}

// ─── Greedy ROI Solver ────────────────────────────────────────────────────────

/**
 * Heuristique gloutonne par ratio valeur/coût pondéré
 * Pour chaque actif, sélectionne l'action avec le meilleur ROI ajusté
 * Complexité : O(N·K·log(N·K))
 */
function solveGreedy(
  assets: AssetInput[],
  actions: AssetAction[][],
  constraints: BudgetConstraints,
  weightMatrix: number[][],
): AllocationDecision[] {
  // Construire une liste plate de (actif, action, score_roi)
  type Candidate = {
    assetIdx: number;
    actionIdx: number;
    roi: number;
    cost: number;
    gain: number;
    weightedGain: number;
  };

  const candidates: Candidate[] = [];
  for (let i = 0; i < assets.length; i++) {
    for (let j = 1; j < actions[i].length; j++) {
      const a = actions[i][j];
      if (a.cost === 0) continue;
      const w = weightMatrix[i][j];
      const roi = (a.gainIMCA * w) / (a.cost / 1000);
      candidates.push({ assetIdx: i, actionIdx: j, roi, cost: a.cost, gain: a.gainIMCA, weightedGain: a.gainIMCA * w });
    }
  }

  // Trier par ROI décroissant
  candidates.sort((a, b) => b.roi - a.roi);

  let remainingBudget = constraints.totalBudget;
  let usedTechDays = 0;
  const selected = new Map<number, number>(); // assetIdx → actionIdx

  // Forcer les actions obligatoires d'abord
  for (let i = 0; i < assets.length; i++) {
    if (assets[i].isMandatory) {
      // Sélectionner la corrective ou la plus haute disponible dans le budget
      const corrIdx = actions[i].findIndex(a => a.type === "corrective" || a.type === "overhaul");
      if (corrIdx > 0 && actions[i][corrIdx].cost <= remainingBudget) {
        selected.set(i, corrIdx);
        remainingBudget -= actions[i][corrIdx].cost;
        usedTechDays += actions[i][corrIdx].techDays;
      }
    }
  }

  // Greedy sur le reste
  for (const cand of candidates) {
    if (selected.has(cand.assetIdx)) continue;
    if (cand.cost > remainingBudget) continue;
    if (usedTechDays + actions[cand.assetIdx][cand.actionIdx].techDays > constraints.maxTechDays) continue;

    selected.set(cand.assetIdx, cand.actionIdx);
    remainingBudget -= cand.cost;
    usedTechDays += actions[cand.assetIdx][cand.actionIdx].techDays;
  }

  // Construire les décisions
  const decisions: AllocationDecision[] = [];
  for (let i = 0; i < assets.length; i++) {
    const j = selected.get(i) ?? 0;
    const action = actions[i][j];
    const w = weightMatrix[i][j];
    decisions.push({
      equipmentId: assets[i].equipmentId,
      equipmentName: assets[i].equipmentName,
      currentIMCA: assets[i].currentIMCA,
      selectedAction: action,
      projectedIMCA: Math.min(100, assets[i].currentIMCA + action.gainIMCA),
      gainIMCA: action.gainIMCA,
      weightedGain: action.gainIMCA * w,
      isMandatory: assets[i].isMandatory ?? false,
      roi: action.cost > 0 ? action.gainIMCA / (action.cost / 1000) : 0,
    });
  }

  return decisions;
}

// ─── Pareto front computation ──────────────────────────────────────────────────

/**
 * Calcule le front de Pareto budget ↔ gain sur nPoints niveaux de budget
 * Retourne la courbe d'efficacité marginale des investissements
 */
function computeParetoFront(
  assets: AssetInput[],
  actions: AssetAction[][],
  maxBudget: number,
  weightMatrix: number[][],
  nPoints: number = 25,
): ParetoPoint[] {
  const points: ParetoPoint[] = [];

  for (let k = 0; k <= nPoints; k++) {
    const budget = (k / nPoints) * maxBudget;
    const constraints: BudgetConstraints = { totalBudget: budget, maxTechDays: 9999 };
    const greedy = solveGreedy(assets, actions, constraints, weightMatrix);
    const totalCost = greedy.reduce((s, d) => s + d.selectedAction.cost, 0);
    const totalGain = greedy.reduce((s, d) => s + d.weightedGain, 0);
    const unweightedGain = greedy.reduce((s, d) => s + d.gainIMCA, 0);
    const nInterventions = greedy.filter(d => d.selectedAction.type !== "none").length;
    points.push({
      budget,
      totalGain,
      unweightedGain,
      nInterventions,
      budgetUtilization: budget > 0 ? (totalCost / budget) * 100 : 0,
    });
  }

  return points;
}

// ─── Result builder ────────────────────────────────────────────────────────────

function buildResult(
  algorithm: OptimizationResult["algorithm"],
  assets: AssetInput[],
  decisions: AllocationDecision[],
  constraints: BudgetConstraints,
  solverTimeMs: number,
): OptimizationResult {
  const interventions = decisions.filter(d => d.selectedAction.type !== "none");
  const totalCost = decisions.reduce((s, d) => s + d.selectedAction.cost, 0);
  const totalGain = decisions.reduce((s, d) => s + d.weightedGain, 0);
  const totalUnweightedGain = decisions.reduce((s, d) => s + d.gainIMCA, 0);
  const usedTechDays = decisions.reduce((s, d) => s + d.selectedAction.techDays, 0);
  const feasible = totalCost <= constraints.totalBudget && usedTechDays <= constraints.maxTechDays;

  const skipped: OptimizationResult["skippedAssets"] = [];
  for (const d of decisions) {
    if (d.selectedAction.type === "none" && (d.currentIMCA < 50)) {
      const asset = assets.find(a => a.equipmentId === d.equipmentId);
      if (asset) {
        skipped.push({
          equipmentId: d.equipmentId,
          equipmentName: d.equipmentName,
          reason: asset.isMandatory
            ? "Action obligatoire mais budget insuffisant"
            : `Budget insuffisant pour l'action recommandée (IMCA = ${d.currentIMCA})`,
        });
      }
    }
  }

  const nAssets = assets.length;
  const fleetIMCABefore = nAssets > 0 ? Math.round(assets.reduce((s, a) => s + a.currentIMCA, 0) / nAssets) : 0;
  const fleetIMCAAfter = nAssets > 0 ? Math.round(decisions.reduce((s, d) => s + d.projectedIMCA, 0) / nAssets) : 0;

  const explanation =
    `Optimisation ${algorithm === "dp_mckp" ? "DP-MCKP (exacte)" : algorithm === "greedy_roi" ? "Greedy ROI" : "Branch & Bound"} ` +
    `sur ${nAssets} actifs. Budget : ${totalCost.toLocaleString("fr-FR")}€ / ${constraints.totalBudget.toLocaleString("fr-FR")}€ ` +
    `(${Math.round((totalCost / Math.max(constraints.totalBudget, 1)) * 100)}%). ` +
    `Gain IMCA fleet : ${fleetIMCABefore} → ${fleetIMCAAfter} (+${fleetIMCAAfter - fleetIMCABefore} pts). ` +
    `${interventions.length} interventions planifiées · ${usedTechDays.toFixed(1)} technicien·jours.`;

  return {
    algorithm,
    totalCost,
    totalGain,
    totalUnweightedGain,
    usedTechDays,
    budgetUtilization: (totalCost / Math.max(constraints.totalBudget, 1)) * 100,
    allocations: decisions,
    skippedAssets: skipped,
    fleetIMCABefore,
    fleetIMCAAfter,
    feasible,
    solverTimeMs,
    explanation,
  };
}

// ─── Main entry point ──────────────────────────────────────────────────────────

/**
 * Optimisation combinatoire multi-actifs sous contrainte budget
 *
 * @param assets        — liste des actifs avec score IMCA et niveau d'alerte
 * @param constraints   — contraintes : budget, techniciens, etc.
 * @param customActions — catalogue d'actions personnalisé (optionnel)
 */
export function optimizeMultiAsset(
  assets: AssetInput[],
  constraints: BudgetConstraints,
  customActions?: Record<number, AssetAction[]>,
  arbitrationWeights: ArbitrationWeights = DEFAULT_ARBITRATION_WEIGHTS,
): MultiAssetOptimizationResult {
  if (assets.length === 0) {
    const empty: OptimizationResult = {
      algorithm: "dp_mckp", totalCost: 0, totalGain: 0, totalUnweightedGain: 0,
      usedTechDays: 0, budgetUtilization: 0, allocations: [], skippedAssets: [],
      fleetIMCABefore: 0, fleetIMCAAfter: 0, feasible: true, solverTimeMs: 0,
      explanation: "Aucun actif fourni.",
    };
    return {
      optimal: empty, greedy: empty, branchBound: empty, paretoFront: [], mandatoryBudget: 0,
      actionCatalog: {}, constraints,
      summary: { nAssets: 0, nInterventions: 0, avgIMCAGain: 0, criticalCovered: 0, totalFleetGain: 0 },
    };
  }

  // Générer les catalogues d'actions
  const actionCatalog: Record<number, AssetAction[]> = {};
  const actionsPerAsset: AssetAction[][] = [];

  for (const asset of assets) {
    const acts = customActions?.[asset.equipmentId] ?? generateActionCatalog(asset);
    actionCatalog[asset.equipmentId] = acts;
    actionsPerAsset.push(acts);
  }

  // Budget minimal pour actifs obligatoires
  let mandatoryBudget = 0;
  for (let i = 0; i < assets.length; i++) {
    if (assets[i].isMandatory) {
      const corrAction = actionsPerAsset[i].find(a => a.type === "corrective") ?? actionsPerAsset[i][actionsPerAsset[i].length - 1];
      mandatoryBudget += corrAction.cost;
    }
  }

  // Poids objectif λ_k (risque/coût/disponibilité) — apprentissage post-action
  const weightMatrix = computeObjectiveWeightMatrix(assets, actionsPerAsset, arbitrationWeights);

  // ── DP-MCKP (optimal, budget ET techDays) ─────────────────────────────────
  const t0dp = Date.now();
  const budgetSlots = Math.min(400, Math.max(100, assets.length * 20));
  const techSlots = Math.min(100, Math.max(20, assets.length * 4));
  const { trace } = solveDP_MCKP(assets, actionsPerAsset, constraints, weightMatrix, budgetSlots, techSlots);
  const dpDecisions = reconstructDPSolution(assets, actionsPerAsset, trace, constraints, weightMatrix, budgetSlots, techSlots);
  const optimalResult = buildResult("dp_mckp", assets, dpDecisions, constraints, Date.now() - t0dp);

  // ── Greedy ROI ─────────────────────────────────────────────────────────────
  const t0g = Date.now();
  const greedyDecisions = solveGreedy(assets, actionsPerAsset, constraints, weightMatrix);
  const greedyResult = buildResult("greedy_roi", assets, greedyDecisions, constraints, Date.now() - t0g);

  // ── Branch & Bound (recommandé pour N > 20 actifs, Brevet N°1 §10.3) ──────
  const t0bb = Date.now();
  const bbSolution = solveBranchAndBound(assets, actionsPerAsset, constraints, weightMatrix);
  const branchBoundResult = buildResult("branch_bound", assets, bbSolution.decisions, constraints, Date.now() - t0bb);

  // ── Front de Pareto ────────────────────────────────────────────────────────
  const paretoFront = computeParetoFront(assets, actionsPerAsset, constraints.totalBudget, weightMatrix, 25);

  // ── Summary ────────────────────────────────────────────────────────────────
  const criticalAssets = assets.filter(a => a.alertLevel === "critical" || a.alertLevel === "warning");
  const criticalCovered = optimalResult.allocations.filter(d => {
    const asset = assets.find(a => a.equipmentId === d.equipmentId);
    return (asset?.alertLevel === "critical" || asset?.alertLevel === "warning") && d.selectedAction.type !== "none";
  }).length;

  const summary = {
    nAssets: assets.length,
    nInterventions: optimalResult.allocations.filter(d => d.selectedAction.type !== "none").length,
    avgIMCAGain: assets.length > 0 ? optimalResult.totalUnweightedGain / assets.length : 0,
    criticalCovered,
    totalFleetGain: optimalResult.fleetIMCAAfter - optimalResult.fleetIMCABefore,
  };

  return { optimal: optimalResult, greedy: greedyResult, branchBound: branchBoundResult, paretoFront, mandatoryBudget, actionCatalog, constraints, summary };
}

// ─── Sensitivity analysis ──────────────────────────────────────────────────────

/**
 * Analyse de sensibilité : impact de ±20% sur chaque paramètre clé
 */
export function sensitivityAnalysis(
  assets: AssetInput[],
  constraints: BudgetConstraints,
  paramName: "budget" | "techDays",
  nSteps: number = 10,
): Array<{ value: number; totalGain: number; nInterventions: number; totalCost: number }> {
  const results = [];
  const actionCatalog: AssetAction[][] = assets.map(a => generateActionCatalog(a));
  const weightMatrix = computeObjectiveWeightMatrix(assets, actionCatalog, DEFAULT_ARBITRATION_WEIGHTS);

  for (let k = 0; k <= nSteps; k++) {
    const factor = 0.5 + (k / nSteps) * 1.5; // 50% → 200% du paramètre
    const modifiedConstraints: BudgetConstraints = {
      ...constraints,
      totalBudget: paramName === "budget" ? constraints.totalBudget * factor : constraints.totalBudget,
      maxTechDays: paramName === "techDays" ? constraints.maxTechDays * factor : constraints.maxTechDays,
    };
    const decisions = solveGreedy(assets, actionCatalog, modifiedConstraints, weightMatrix);
    results.push({
      value: paramName === "budget" ? modifiedConstraints.totalBudget : modifiedConstraints.maxTechDays,
      totalGain: decisions.reduce((s, d) => s + d.weightedGain, 0),
      nInterventions: decisions.filter(d => d.selectedAction.type !== "none").length,
      totalCost: decisions.reduce((s, d) => s + d.selectedAction.cost, 0),
    });
  }

  return results;
}
