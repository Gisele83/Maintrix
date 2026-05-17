/**
 * ISC — Indice de Similarité Contextuelle (4 dimensions)
 * Φ_i — Formule d'Agrégation Fédérée Pondérée par Site
 *
 * Brevet N°3 MAINTRIX-SCA-FED
 *
 * ISC = w1·D1_type + w2·D2_usageProfil + w3·D3_stressOp + w4·D4_historiqueDefaillances
 * Φ_i = α·ISC_i + β·Fiabilité + γ·Maturité
 *
 * La personnalisation par site cible i : Φ_i est calculée indépendamment
 * pour chaque destinataire selon son propre contexte opérationnel.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FailureHistoryProfile {
  recurrenceCount: number;          // bucket: 0=rare(<2), 1=occasionnel(2-5), 2=fréquent(6-15), 3=chronique(>15)
  mtbfBucket: number;               // bucket MTBF: 0=très_long, 1=long, 2=moyen, 3=court
  failureCategoryPattern: string[]; // catégories de défaillances historiques
  recoveryDifficulty: number;       // 0-1 difficulté de récupération (normalisée)
}

export interface PatternContext {
  equipmentType: string;
  symptomCategories: string[];
  urgencyLevel: string;
  severityLevel: number;            // 1-5
  failureHistory: FailureHistoryProfile;
  operationalComplexity: number;    // 0-1
  environmentalFactors: string[];
}

export interface ISCComponents {
  D1_equipType: number;     // [0-1] similarité type d'équipement
  D2_usageProfile: number;  // [0-1] similarité profil d'usage
  D3_opStress: number;      // [0-1] similarité stress opérationnel
  D4_failureHistory: number;// [0-1] similarité historique de défaillances — 4e dimension
  ISC: number;              // [0-1] indice composite
}

export interface FiabiliteComponents {
  solutionEffectiveness: number;  // [0-1] efficacité de la solution
  successRate: number;            // [0-1] taux de succès
  temporalConsistency: number;    // [0-1] stabilité dans le temps
  Fiabilite: number;              // [0-1] indice composite
}

export interface MaturiteComponents {
  confirmationCount: number;      // nombre de confirmations
  ageScore: number;               // ancienneté (normalisée, plus ancien = plus mature)
  breadthScore: number;           // diversité des sources confirmantes
  Maturite: number;               // [0-1] indice composite
}

export interface PhiResult {
  ISC: ISCComponents;
  Fiabilite: FiabiliteComponents;
  Maturite: MaturiteComponents;
  Phi: number;                    // Φ_i ∈ [0-1]
  alpha: number; beta: number; gamma: number;
  interpretation: string;
  targetSite: string;
}

// ─── ISC — 4 dimensions ───────────────────────────────────────────────────────

/**
 * D1 — Type d'équipement
 * Exact match = 1.0, même famille = 0.5, différent = 0.0
 */
function computeD1(type1: string, type2: string): number {
  if (!type1 || !type2) return 0;
  const t1 = type1.toLowerCase().trim();
  const t2 = type2.toLowerCase().trim();
  if (t1 === t2) return 1.0;
  // Famille : même préfixe (ex: "pompe_centrifuge" vs "pompe_axiale")
  const prefix1 = t1.split(/[_\s-]/)[0];
  const prefix2 = t2.split(/[_\s-]/)[0];
  if (prefix1 === prefix2 && prefix1.length >= 3) return 0.5;
  return 0.0;
}

/**
 * D2 — Profil d'usage (symptômes + complexité opérationnelle)
 * Jaccard sur catégories de symptômes + similarité de complexité
 */
function computeD2(
  cats1: string[], cats2: string[],
  complexity1: number, complexity2: number
): number {
  const s1 = new Set(cats1);
  const s2 = new Set(cats2);
  const intersection = [...s1].filter(c => s2.has(c)).length;
  const union = new Set([...cats1, ...cats2]).size;
  const jaccardSymptom = union > 0 ? intersection / union : 0;
  const complexitySimilarity = 1 - Math.abs(complexity1 - complexity2);
  return 0.7 * jaccardSymptom + 0.3 * complexitySimilarity;
}

/**
 * D3 — Stress Opérationnel (urgence + sévérité)
 */
function computeD3(urgency1: string, urgency2: string, severity1: number, severity2: number): number {
  const urgencyMap: Record<string, number> = { low: 1, normal: 2, medium: 2, high: 3, critical: 4, emergency: 5 };
  const u1 = urgencyMap[urgency1?.toLowerCase()] ?? 2;
  const u2 = urgencyMap[urgency2?.toLowerCase()] ?? 2;
  const urgencySim = 1 - Math.abs(u1 - u2) / 4;
  const severitySim = 1 - Math.abs((severity1 || 3) - (severity2 || 3)) / 4;
  return 0.5 * urgencySim + 0.5 * severitySim;
}

/**
 * D4 — Historique de défaillances (4e dimension — NOUVELLE)
 * Compare les profils de récurrence, MTBF, catégories et difficulté de récupération
 */
function computeD4(h1: FailureHistoryProfile, h2: FailureHistoryProfile): number {
  if (!h1 || !h2) return 0.5; // valeur neutre si données absentes

  // Récurrence bucket (ex: h1.recurrenceCount=2 vs h2.recurrenceCount=3 → distance=1/3)
  const recurrenceSim = 1 - Math.abs(h1.recurrenceCount - h2.recurrenceCount) / 3;

  // MTBF bucket
  const mtbfSim = 1 - Math.abs(h1.mtbfBucket - h2.mtbfBucket) / 3;

  // Catégories de défaillances (Jaccard)
  const s1 = new Set(h1.failureCategoryPattern);
  const s2 = new Set(h2.failureCategoryPattern);
  const inter = [...s1].filter(c => s2.has(c)).length;
  const union = new Set([...h1.failureCategoryPattern, ...h2.failureCategoryPattern]).size;
  const categorySim = union > 0 ? inter / union : 0.5;

  // Difficulté de récupération
  const recoverySim = 1 - Math.abs(h1.recoveryDifficulty - h2.recoveryDifficulty);

  return 0.30 * recurrenceSim + 0.25 * mtbfSim + 0.30 * categorySim + 0.15 * recoverySim;
}

/**
 * ISC composite — 4 dimensions pondérées
 * Poids calibrés Brevet N°3 : [0.30, 0.30, 0.20, 0.20]
 */
export function calculateISC4D(ctx1: PatternContext, ctx2: PatternContext): ISCComponents {
  const w = { D1: 0.30, D2: 0.30, D3: 0.20, D4: 0.20 };

  const D1 = computeD1(ctx1.equipmentType, ctx2.equipmentType);
  const D2 = computeD2(ctx1.symptomCategories, ctx2.symptomCategories, ctx1.operationalComplexity, ctx2.operationalComplexity);
  const D3 = computeD3(ctx1.urgencyLevel, ctx2.urgencyLevel, ctx1.severityLevel, ctx2.severityLevel);
  const D4 = computeD4(ctx1.failureHistory, ctx2.failureHistory);

  const ISC = w.D1 * D1 + w.D2 * D2 + w.D3 * D3 + w.D4 * D4;

  return {
    D1_equipType: parseFloat(D1.toFixed(4)),
    D2_usageProfile: parseFloat(D2.toFixed(4)),
    D3_opStress: parseFloat(D3.toFixed(4)),
    D4_failureHistory: parseFloat(D4.toFixed(4)),
    ISC: parseFloat(ISC.toFixed(4)),
  };
}

// ─── Fiabilité ────────────────────────────────────────────────────────────────

/**
 * Fiabilité — Indice de fiabilité d'un pattern global
 * Fusionne l'efficacité de la solution, le taux de succès, et la cohérence temporelle
 *
 * Fiabilité = 0.50 × solutionEffectiveness + 0.30 × successRate + 0.20 × temporalConsistency
 */
export function calculateFiabilite(
  solutionEffectiveness: number, // [0-1] from federated_learning.solution_effectiveness
  successRate: number,            // [0-1] from anonymizedMetrics.successRate
  contributionHistory: { effectiveness: number; timestamp: Date }[] = []
): FiabiliteComponents {
  const eff = Math.max(0, Math.min(1, solutionEffectiveness || 0));
  const rate = Math.max(0, Math.min(1, successRate || 0));

  // Cohérence temporelle : std-dev normalisée des effectivités passées
  let temporalConsistency = 0.5; // valeur neutre par défaut
  if (contributionHistory.length >= 2) {
    const values = contributionHistory.map(h => h.effectiveness);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const stddev = Math.sqrt(variance);
    // Faible std-dev → haute consistance → haute fiabilité
    temporalConsistency = Math.max(0, 1 - stddev * 2);
  } else if (contributionHistory.length === 1) {
    temporalConsistency = eff; // cas dégénéré : confiance = efficacité
  }

  const Fiabilite = 0.50 * eff + 0.30 * rate + 0.20 * temporalConsistency;

  return {
    solutionEffectiveness: eff,
    successRate: rate,
    temporalConsistency: parseFloat(temporalConsistency.toFixed(4)),
    Fiabilite: parseFloat(Fiabilite.toFixed(4)),
  };
}

// ─── Maturité ────────────────────────────────────────────────────────────────

/**
 * Maturité — Indice de maturité d'un pattern
 * Fusionne : nombre de confirmations, ancienneté, diversité des sources
 *
 * Maturité = 0.40 × confirmationScore + 0.30 × ageScore + 0.30 × breadthScore
 */
export function calculateMaturite(
  confirmationCount: number,   // nombre de fois que le pattern a été confirmé
  firstSeenDate: Date | null,  // date de première observation
  tenantCount: number = 1      // nombre de tenants ayant contribué ce pattern
): MaturiteComponents {
  // Confirmation score : sigmoïde sur le nombre de confirmations
  // 1 confirmation → ~0.3, 5 → ~0.7, 10 → ~0.85, 20+ → ~0.95
  const confirmationScore = 1 - Math.exp(-0.15 * Math.max(0, confirmationCount));

  // Age score : plus le pattern est ancien (et stable), plus il est mature
  let ageScore = 0.3; // valeur par défaut
  if (firstSeenDate) {
    const agedays = (Date.now() - firstSeenDate.getTime()) / 86_400_000;
    // Sigmoïde : 7j→0.3, 30j→0.6, 90j→0.8, 180j+→0.95
    ageScore = 1 - Math.exp(-0.02 * agedays);
  }

  // Breadth score : diversité des tenants confirmants
  // 1 tenant → 0.2, 3 tenants → 0.6, 5+ tenants → 0.85+
  const breadthScore = 1 - Math.exp(-0.5 * Math.max(0, tenantCount - 1));

  const Maturite = 0.40 * confirmationScore + 0.30 * ageScore + 0.30 * breadthScore;

  return {
    confirmationCount,
    ageScore: parseFloat(ageScore.toFixed(4)),
    breadthScore: parseFloat(breadthScore.toFixed(4)),
    Maturite: parseFloat(Maturite.toFixed(4)),
  };
}

// ─── Φ_i — Formule d'agrégation fédérée ──────────────────────────────────────

export interface PhiConfig {
  alpha: number; // poids ISC (similarité contextuelle)
  beta: number;  // poids Fiabilité
  gamma: number; // poids Maturité
}

const DEFAULT_PHI_CONFIG: PhiConfig = { alpha: 0.45, beta: 0.35, gamma: 0.20 };

/**
 * Φ_i = α·ISC_i + β·Fiabilité + γ·Maturité
 *
 * Calculé séparément pour chaque site cible i, ce qui permet
 * une personnalisation différentielle de l'agrégation par site.
 */
export function computePhi(
  iscComponents: ISCComponents,
  fiabiliteComponents: FiabiliteComponents,
  maturiteComponents: MaturiteComponents,
  config: PhiConfig = DEFAULT_PHI_CONFIG,
  targetSite: string = "global"
): PhiResult {
  const { alpha, beta, gamma } = config;

  // Normalisation des poids (somme=1)
  const total = alpha + beta + gamma;
  const a = alpha / total;
  const b = beta / total;
  const g = gamma / total;

  const Phi = a * iscComponents.ISC + b * fiabiliteComponents.Fiabilite + g * maturiteComponents.Maturite;

  const interpretation =
    Phi >= 0.80 ? `Pattern hautement pertinent (Φ=${Phi.toFixed(2)}). Recommandation prioritaire pour ${targetSite}.`
    : Phi >= 0.60 ? `Bonne pertinence (Φ=${Phi.toFixed(2)}). Pattern fiable et contextuel pour ${targetSite}.`
    : Phi >= 0.40 ? `Pertinence modérée (Φ=${Phi.toFixed(2)}). À pondérer avec d'autres sources pour ${targetSite}.`
    : `Pertinence faible (Φ=${Phi.toFixed(2)}). Pattern peu adapté au contexte de ${targetSite}.`;

  return {
    ISC: iscComponents,
    Fiabilite: fiabiliteComponents,
    Maturite: maturiteComponents,
    Phi: parseFloat(Phi.toFixed(4)),
    alpha: a, beta: b, gamma: g,
    interpretation,
    targetSite,
  };
}

// ─── Weighted federated aggregation using Φ_i ────────────────────────────────

export interface PatternWithPhi {
  patternHash: string;
  solutionEffectiveness: number;
  phi: number;
  phi_detail: PhiResult;
}

/**
 * Agrégation pondérée de plusieurs patterns pour un site cible i
 * SolutionRelevance_i = Σ_j(Φ_ij × solution_j) / Σ_j(Φ_ij)
 * Préserve la spécialisation locale (patterns de faible Φ_i exclus si Φ < threshold)
 */
export function aggregatePatternsByPhi(
  patterns: PatternWithPhi[],
  minPhiThreshold: number = 0.3
): {
  aggregatedEffectiveness: number;
  totalWeight: number;
  usedPatterns: number;
  excludedByThreshold: number;
  topPatterns: PatternWithPhi[];
} {
  const eligible = patterns.filter(p => p.phi >= minPhiThreshold);
  const excluded = patterns.length - eligible.length;

  if (eligible.length === 0) {
    return { aggregatedEffectiveness: 0, totalWeight: 0, usedPatterns: 0, excludedByThreshold: excluded, topPatterns: [] };
  }

  const totalWeight = eligible.reduce((s, p) => s + p.phi, 0);
  const aggregatedEffectiveness = eligible.reduce((s, p) => s + p.phi * p.solutionEffectiveness, 0) / totalWeight;

  const topPatterns = eligible.sort((a, b) => b.phi - a.phi).slice(0, 5);

  return {
    aggregatedEffectiveness: parseFloat(aggregatedEffectiveness.toFixed(4)),
    totalWeight: parseFloat(totalWeight.toFixed(4)),
    usedPatterns: eligible.length,
    excludedByThreshold: excluded,
    topPatterns,
  };
}

// ─── Failure history extraction helpers ──────────────────────────────────────

/**
 * Convertit un compte de défaillances en bucket MTBF et recurrence.
 * Utilisé lors de l'anonymisation des données de session.
 */
export function buildFailureHistoryProfile(
  failureCount: number,         // nombre de défaillances historiques
  averageMTBF_days: number,     // MTBF moyen en jours (0 si inconnu)
  symptomCategories: string[],  // catégories de symptômes courants
  resolutionTime_min: number    // temps de résolution moyen en minutes
): FailureHistoryProfile {
  // Recurrence bucket
  const recurrenceCount =
    failureCount <= 1 ? 0 : failureCount <= 5 ? 1 : failureCount <= 15 ? 2 : 3;

  // MTBF bucket : 0=très_long(>180j), 1=long(30-180j), 2=moyen(7-30j), 3=court(<7j)
  const mtbfBucket =
    averageMTBF_days <= 0 ? 1 // inconnu → bucket moyen
    : averageMTBF_days >= 180 ? 0
    : averageMTBF_days >= 30 ? 1
    : averageMTBF_days >= 7 ? 2
    : 3;

  // Difficulté de récupération : normalisée sur 720 min (12h)
  const recoveryDifficulty = Math.min(1, resolutionTime_min / 720);

  return {
    recurrenceCount,
    mtbfBucket,
    failureCategoryPattern: symptomCategories,
    recoveryDifficulty: parseFloat(recoveryDifficulty.toFixed(3)),
  };
}

/**
 * Compute ISC-based similarity from raw anonymized pattern objects.
 * Bridge function for use in both federated-ai-system.ts and federated-learning.ts.
 */
export function patternSimilarityISC4D(pattern1: any, pattern2: any): number {
  const ctx1: PatternContext = {
    equipmentType: pattern1.equipmentType || pattern1.equipmentCategory || "",
    symptomCategories: pattern1.symptomCategories || [],
    urgencyLevel: pattern1.urgencyLevel || "normal",
    severityLevel: pattern1.severityLevel || 3,
    operationalComplexity: pattern1.operationalComplexity || 0.3,
    environmentalFactors: pattern1.environmentalFactors || [],
    failureHistory: pattern1.failureHistory || {
      recurrenceCount: 0, mtbfBucket: 1, failureCategoryPattern: [], recoveryDifficulty: 0.3,
    },
  };
  const ctx2: PatternContext = {
    equipmentType: pattern2.equipmentType || pattern2.equipmentCategory || "",
    symptomCategories: pattern2.symptomCategories || [],
    urgencyLevel: pattern2.urgencyLevel || "normal",
    severityLevel: pattern2.severityLevel || 3,
    operationalComplexity: pattern2.operationalComplexity || 0.3,
    environmentalFactors: pattern2.environmentalFactors || [],
    failureHistory: pattern2.failureHistory || {
      recurrenceCount: 0, mtbfBucket: 1, failureCategoryPattern: [], recoveryDifficulty: 0.3,
    },
  };
  return calculateISC4D(ctx1, ctx2).ISC;
}

/**
 * Compute contribution weight using Φ_i formula.
 * Replaces simple heuristic used previously in both federated files.
 */
export function computePhiContributionWeight(
  solutionEffectiveness: number,
  successRate: number,
  confirmationCount: number = 1,
  firstSeenDate: Date | null = null,
  tenantCount: number = 1,
  phiConfig: PhiConfig = DEFAULT_PHI_CONFIG
): number {
  // For contribution weight, ISC = 1.0 (self-similarity within same tenant context)
  const iscComponents: ISCComponents = {
    D1_equipType: 1, D2_usageProfile: 1, D3_opStress: 1, D4_failureHistory: 1, ISC: 1,
  };
  const fiabilite = calculateFiabilite(solutionEffectiveness, successRate, []);
  const maturite = calculateMaturite(confirmationCount, firstSeenDate, tenantCount);
  const phi = computePhi(iscComponents, fiabilite, maturite, phiConfig);
  return parseFloat(Math.max(0.01, phi.Phi * 2).toFixed(4)); // Scale to [0-2] for backward compat
}

export const ISC_WEIGHTS = { D1: 0.30, D2: 0.30, D3: 0.20, D4: 0.20 };
export const PHI_DEFAULTS = DEFAULT_PHI_CONFIG;
