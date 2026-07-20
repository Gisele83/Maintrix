/**
 * Apprentissage post-action — Brevet MAINTRIX-SCA-ORC, revendications 1g, 3, 10.
 *
 * Après chaque décision exécutée par le moteur d'arbitrage multi-actifs, le résultat
 * technique observé (coût réel, durée réelle, impact réel sur l'IMCA) est comparé à
 * la projection faite au moment de la décision. L'écart de précision par critère
 * ajuste les pondérations internes du moteur :
 *   - λ_k : poids des critères d'optimisation (risque / coût / disponibilité), Σλ_k = 1
 *   - ω_j : coefficients d'impact économique à six dimensions, Σω_j = 1
 * selon une règle d'incrémentation/décrémentation bornée à ±0,05 (revendication 10),
 * avec renormalisation pour préserver la somme unitaire.
 */

import { eq } from "drizzle-orm";
import { db } from "./db";
import { arbitrationWeightsState, type ArbitrationWeightsState } from "@shared/schema";

const ADJUSTMENT_STEP = 0.05;
const PROJECTION_ERROR_TOLERANCE = 0.15; // en-deçà : projection jugée précise

export interface ArbitrationWeights {
  riskWeight: number;
  costWeight: number;
  availabilityWeight: number;
}

export interface EconomicImpactWeights {
  directCost: number;
  downtimeCost: number;
  safetyCost: number;
  environmentalCost: number;
  productionLossCost: number;
  qualityCost: number;
}

export interface ProjectedOutcome {
  cost: number;
  duration: number;
  imcaImpact: number;
}

const DEFAULT_ARBITRATION_WEIGHTS: ArbitrationWeights = {
  riskWeight: 0.4,
  costWeight: 0.35,
  availabilityWeight: 0.25,
};

const DEFAULT_ECONOMIC_IMPACT_WEIGHTS: EconomicImpactWeights = {
  directCost: 1 / 6,
  downtimeCost: 1 / 6,
  safetyCost: 1 / 6,
  environmentalCost: 1 / 6,
  productionLossCost: 1 / 6,
  qualityCost: 1 / 6,
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Renormalise un jeu de poids pour que leur somme vaille exactement 1,
 * en préservant les proportions relatives (ou un partage égal si tout est nul).
 */
function renormalize<K extends string>(weights: Record<K, number>): Record<K, number> {
  const keys = Object.keys(weights) as K[];
  const sum = keys.reduce((s, k) => s + weights[k], 0);
  if (sum <= 0) {
    const equal = 1 / keys.length;
    return keys.reduce((acc, k) => ({ ...acc, [k]: equal }), {} as Record<K, number>);
  }
  return keys.reduce((acc, k) => ({ ...acc, [k]: weights[k] / sum }), {} as Record<K, number>);
}

/**
 * Ajuste un jeu de poids selon l'erreur de projection observée par critère.
 * Erreur faible (< tolérance) → le critère a été bien projeté → poids += 0,05.
 * Erreur élevée → poids -= 0,05. Clamp [0,1] puis renormalisation Σ = 1.
 */
function adjustWeightSet<K extends string>(
  current: Record<K, number>,
  projectionErrorByKey: Record<K, number>
): Record<K, number> {
  const keys = Object.keys(current) as K[];
  const adjusted = keys.reduce((acc, k) => {
    const error = projectionErrorByKey[k] ?? 0;
    const delta = error <= PROJECTION_ERROR_TOLERANCE ? ADJUSTMENT_STEP : -ADJUSTMENT_STEP;
    acc[k] = clamp01(current[k] + delta);
    return acc;
  }, {} as Record<K, number>);
  return renormalize(adjusted);
}

function relativeError(projected: number, actual: number): number {
  const denom = Math.max(Math.abs(actual), 1e-6);
  return Math.abs(actual - projected) / denom;
}

export async function getArbitrationWeights(tenantId: string): Promise<ArbitrationWeightsState> {
  const [existing] = await db
    .select()
    .from(arbitrationWeightsState)
    .where(eq(arbitrationWeightsState.tenantId, tenantId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(arbitrationWeightsState)
    .values({
      tenantId,
      riskWeight: DEFAULT_ARBITRATION_WEIGHTS.riskWeight,
      costWeight: DEFAULT_ARBITRATION_WEIGHTS.costWeight,
      availabilityWeight: DEFAULT_ARBITRATION_WEIGHTS.availabilityWeight,
      economicImpactWeights: DEFAULT_ECONOMIC_IMPACT_WEIGHTS,
    })
    .onConflictDoNothing({ target: arbitrationWeightsState.tenantId })
    .returning();

  if (created) return created;

  // Concurrence : une autre requête a créé la ligne entre le SELECT et l'INSERT.
  const [race] = await db
    .select()
    .from(arbitrationWeightsState)
    .where(eq(arbitrationWeightsState.tenantId, tenantId))
    .limit(1);

  return race;
}

/**
 * Compare le résultat réel d'une décision exécutée à sa projection, ajuste λ_k
 * (risque/coût/disponibilité) et ω_j (impact économique 6D), et persiste le
 * nouvel état pour le tenant. Best-effort : ne doit jamais bloquer la clôture
 * de l'ordre de travail appelant.
 */
export async function recordProjectionOutcome(
  tenantId: string,
  projected: ProjectedOutcome,
  actual: ProjectedOutcome
): Promise<ArbitrationWeightsState> {
  const state = await getArbitrationWeights(tenantId);

  const costError = relativeError(projected.cost, actual.cost);
  const durationError = relativeError(projected.duration, actual.duration);
  const imcaError = relativeError(projected.imcaImpact, actual.imcaImpact);

  const currentArbitration: ArbitrationWeights = {
    riskWeight: state.riskWeight,
    costWeight: state.costWeight,
    availabilityWeight: state.availabilityWeight,
  };

  // Le critère "risque" est jugé sur la précision de l'impact IMCA projeté,
  // le critère "disponibilité" sur la précision de la durée projetée.
  const newArbitration = adjustWeightSet(currentArbitration, {
    riskWeight: imcaError,
    costWeight: costError,
    availabilityWeight: durationError,
  });

  const currentEconomic = state.economicImpactWeights as EconomicImpactWeights;
  // Sans ventilation économique par dimension au niveau de l'OT, l'erreur de coût
  // globale s'applique uniformément aux six dimensions du vecteur d'impact ω_j.
  const newEconomic = adjustWeightSet(currentEconomic, {
    directCost: costError,
    downtimeCost: durationError,
    safetyCost: imcaError,
    environmentalCost: costError,
    productionLossCost: durationError,
    qualityCost: imcaError,
  });

  const [updated] = await db
    .update(arbitrationWeightsState)
    .set({
      riskWeight: newArbitration.riskWeight,
      costWeight: newArbitration.costWeight,
      availabilityWeight: newArbitration.availabilityWeight,
      economicImpactWeights: newEconomic,
      updatedAt: new Date(),
    })
    .where(eq(arbitrationWeightsState.tenantId, tenantId))
    .returning();

  return updated;
}
