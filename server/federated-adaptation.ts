/**
 * Adaptation Locale Différentielle — Préservation de la Spécialisation des Sites Matures
 * Brevet MAINTRIX-SCA — Module Apprentissage Fédéré Adaptatif
 *
 * Problème : FedAvg standard écrase la spécialisation locale des sites matures.
 *
 * Solution : Personnalised Federated Learning (pFed) avec couplage élastique.
 *
 * ─── Formules mathématiques ──────────────────────────────────────────────────
 *
 * 1. Score de maturité (0–1) :
 *    M(s) = α·min(1, N_cas/N_seuil) + β·min(1, N_patterns/P_seuil)
 *         + γ·SuccessRate(s) + δ·min(1, Ancienneté(s)/365)
 *    avec α=0.35, β=0.25, γ=0.25, δ=0.15
 *
 * 2. Coefficient de mélange (couplage élastique) :
 *    λ(s) = λ_max × (1 − exp(−k × M(s)))
 *    λ_max = 0.85 (site le plus mature garde 85% de son modèle local)
 *    k = 3.5 (vitesse de convergence vers λ_max)
 *
 * 3. Modèle personnalisé pour le site s :
 *    θ̂(s) = (1 − λ(s)) × θ_global + λ(s) × θ_local(s)
 *    Gradient descent équivalent : θ̂ est le minimiseur de
 *    L(θ) = (1−λ)·‖θ − θ_global‖² + λ·‖θ − θ_local‖²
 *
 * 4. Agrégation globale différentielle (FedAvg pondéré) :
 *    θ_global = Σ_s w(s)·θ_local(s) / Σ_s w(s)
 *    w(s) = n_s × (1 − λ(s))       [sites matures contribuent moins au consensus]
 *    → Propriété : sites avec λ→1 n'influencent pas le modèle global
 *
 * 5. Indice de Préservation de la Spécialisation (SPI) :
 *    SPI(s) = 1 − cosineSim(θ_global, θ_local(s))
 *    SPI → 0 : site identique au global (non spécialisé)
 *    SPI → 1 : site maximalement spécialisé
 *
 * 6. Détection de dérive locale (drift monitor) :
 *    Δ(s, t) = cosineSim(θ_local(s, t), θ_local(s, t−1))
 *    Si Δ descend sous 0.85 : alerte drift (changement de comportement du site)
 */

import { db } from "./db";
import { federatedLearning, diagnosticSessions, maintenanceCases, tenants, workOrders, federatedSyncState } from "@shared/schema";
import { eq, and, count, avg, max, min, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { buildParametersDelta, verifyParametersDelta, ParametersDeltaSchema, type ParametersDelta } from "./parameters-delta";

// ─── Model vector dimensions ──────────────────────────────────────────────────
// θ ∈ ℝ^12 — vecteur de poids du modèle diagnostique
export const MODEL_DIMS = 12;

export const DIM_LABELS = [
  "vibration_w",        // D0 — poids capteur vibration
  "temperature_w",      // D1 — poids capteur température
  "pressure_w",         // D2 — poids capteur pression
  "current_w",          // D3 — poids capteur courant
  "acoustic_w",         // D4 — poids capteur acoustique
  "speed_w",            // D5 — poids capteur vitesse
  "bearing_wear_p",     // D6 — probabilité défaillance roulement
  "lubrication_p",      // D7 — probabilité défaillance lubrification
  "overheating_p",      // D8 — probabilité surchauffe
  "cavitation_p",       // D9 — probabilité cavitation
  "electrical_p",       // D10 — probabilité défaut électrique
  "imca_sensitivity",   // D11 — sensibilité IMCA (ajustement seuil)
] as const;

// Paramètres du couplage élastique
export const LAMBDA_MAX = 0.85;    // coefficient max pour site ultra-mature
export const K_ELASTIC  = 3.5;     // vitesse de convergence vers λ_max
const N_CAS_SEUIL   = 100;  // nombre de cas pour saturation maturité
const N_PAT_SEUIL   = 50;   // nombre de patterns pour saturation maturité

// Pondérations du score de maturité (α + β + γ + δ = 1)
const ALPHA = 0.35;  // historique de cas
const BETA  = 0.25;  // richesse des patterns
const GAMMA = 0.25;  // taux de succès
const DELTA = 0.15;  // ancienneté

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SiteProfile {
  tenantId: string;
  tenantName: string;
  maturityScore: number;        // M(s) ∈ [0,1]
  mixingCoefficient: number;    // λ(s) ∈ [0, λ_max]
  nCases: number;
  nPatterns: number;
  avgSuccessRate: number;
  daysActive: number;
  localModelVector: number[];   // θ_local(s) ∈ ℝ^12
  specializations: string[];    // catégories où le site est le plus fort
}

export interface PersonalizedModelResult {
  tenantId: string;
  personalizedVector: number[];  // θ̂(s) = (1−λ)·θ_global + λ·θ_local
  globalVector: number[];        // θ_global
  localVector: number[];         // θ_local(s)
  mixingCoefficient: number;     // λ(s)
  spi: number;                   // Specialization Preservation Index
  globalContribution: number;    // 1 - λ(s)
  localContribution: number;     // λ(s)
}

export interface DifferentialAggregationResult {
  globalModel: number[];                          // θ_global nouveau
  previousGlobalModel: number[] | null;           // θ_global précédent (pour Δ)
  siteProfiles: SiteProfile[];
  personalizedModels: PersonalizedModelResult[];
  aggregationWeights: Record<string, number>;     // w(s) normalisés
  fleetMaturityAvg: number;
  fleetLambdaAvg: number;
  fleetSPIAvg: number;
  nSitesMature: number;                           // sites avec M > 0.7
  nSitesSpecialized: number;                      // sites avec SPI > 0.3
  driftAlerts: { tenantId: string; delta: number; reason: string }[];
  aggregatedAt: string;
}

// ─── Vector math ───────────────────────────────────────────────────────────────

function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const na = norm(a), nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return Math.max(-1, Math.min(1, dot(a, b) / (na * nb)));
}

function normalizeVector(v: number[]): number[] {
  const s = v.reduce((acc, x) => acc + x, 0);
  if (s === 0) return v.map(() => 1 / MODEL_DIMS);
  return v.map(x => x / s);
}

function lerpVector(a: number[], b: number[], t: number): number[] {
  return a.map((va, i) => (1 - t) * va + t * b[i]);
}

// ─── Uniform prior (global initial model) ─────────────────────────────────────

function uniformPrior(): number[] {
  return new Array(MODEL_DIMS).fill(1 / MODEL_DIMS);
}

// ─── Local model extraction from patterns ─────────────────────────────────────

/**
 * Construit le vecteur θ_local(s) à partir des patterns diagnostiques du site.
 * Utilise la fréquence des catégories de symptômes et l'efficacité des solutions.
 */
function buildLocalModelFromPatterns(
  patterns: { problemPattern: any; solutionEffectiveness: number | null }[],
): number[] {
  const vec = new Array(MODEL_DIMS).fill(0);

  if (patterns.length === 0) return uniformPrior();

  const symptomFreq: Record<string, number> = {
    mechanical: 0, thermal: 0, electrical: 0,
    hydraulic: 0, vibration: 0, acoustic: 0,
  };
  let totalEffectiveness = 0;
  let totalWeight = 0;

  for (const p of patterns) {
    const eff = p.solutionEffectiveness ?? 0.5;
    const cats: string[] = (p.problemPattern?.symptomCategories as string[]) ?? [];
    const complexity: number = p.problemPattern?.operationalComplexity ?? 0.5;
    const urgency: string = p.problemPattern?.urgencyLevel ?? "normal";

    const urgencyW = urgency === "critical" ? 2.0 : urgency === "high" ? 1.5 : 1.0;

    for (const cat of cats) {
      const key = cat.toLowerCase();
      if (key in symptomFreq) symptomFreq[key] += eff * urgencyW;
      // Inférer les capteurs dominants depuis les catégories
      if (key.includes("vibr") || key.includes("mechan")) vec[0] += eff * urgencyW; // vibration
      if (key.includes("therm") || key.includes("heat"))  vec[1] += eff * urgencyW; // temperature
      if (key.includes("hydr") || key.includes("pressure")) vec[2] += eff * urgencyW; // pressure
      if (key.includes("electr") || key.includes("current")) vec[3] += eff * urgencyW; // current
      if (key.includes("acous") || key.includes("noise")) vec[4] += eff * urgencyW; // acoustic
      if (key.includes("speed") || key.includes("rotat")) vec[5] += eff * urgencyW; // speed
    }

    // Probabilités de mode de défaillance (inférées depuis les catégories)
    if (cats.some(c => c.includes("mechan") || c.includes("vibr"))) vec[6] += eff * 0.8; // bearing
    if (cats.some(c => c.includes("lubric") || c.includes("viscosity")))  vec[7] += eff * 0.7; // lubrication
    if (cats.some(c => c.includes("therm") || c.includes("heat")))       vec[8] += eff * 0.9; // overheating
    if (cats.some(c => c.includes("hydr") || c.includes("cav")))         vec[9] += eff * 0.6; // cavitation
    if (cats.some(c => c.includes("electr")))                            vec[10] += eff * 0.8; // electrical

    // Sensibilité IMCA : complexité opérationnelle → ajustement seuil
    vec[11] += (1 - complexity) * eff;
    totalEffectiveness += eff;
    totalWeight += 1;
  }

  // Normaliser par le nombre de patterns
  const n = patterns.length || 1;
  for (let i = 0; i < MODEL_DIMS; i++) vec[i] /= n;

  // Ajouter un prior uniforme faible (régularisation)
  const alpha_reg = 0.1;
  const prior = uniformPrior();
  return normalizeVector(lerpVector(vec, prior, alpha_reg));
}

// ─── Site maturity computation ─────────────────────────────────────────────────

/**
 * Calcule le score de maturité M(s) ∈ [0,1] pour un site (tenant).
 *
 * M(s) = α·min(1, N_cas/N_seuil) + β·min(1, N_patterns/P_seuil)
 *       + γ·SuccessRate(s)       + δ·min(1, Ancienneté(s)/365)
 */
export async function computeSiteMaturityScore(tenantId: string): Promise<{
  maturityScore: number;
  nCases: number;
  nPatterns: number;
  avgSuccessRate: number;
  daysActive: number;
  components: { cases: number; patterns: number; success: number; age: number };
}> {
  // 1. Nombre de sessions diagnostiques
  const [casesRow] = await db
    .select({ cnt: count() })
    .from(diagnosticSessions)
    .where(eq(diagnosticSessions.tenantId, tenantId));
  const nCases = Number(casesRow?.cnt ?? 0);

  // 2. Nombre de patterns contribués
  const [patRow] = await db
    .select({ cnt: count() })
    .from(federatedLearning)
    .where(eq(federatedLearning.tenantId, tenantId));
  const nPatterns = Number(patRow?.cnt ?? 0);

  // 3. Taux de succès moyen des patterns
  const [effRow] = await db
    .select({ avgEff: avg(federatedLearning.solutionEffectiveness) })
    .from(federatedLearning)
    .where(eq(federatedLearning.tenantId, tenantId));
  const avgSuccessRate = Math.min(1, Math.max(0, Number(effRow?.avgEff ?? 0.5)));

  // 4. Ancienneté (jours depuis première session)
  const [ageRow] = await db
    .select({ earliest: min(diagnosticSessions.createdAt) })
    .from(diagnosticSessions)
    .where(eq(diagnosticSessions.tenantId, tenantId));
  const daysActive = ageRow?.earliest
    ? Math.round((Date.now() - new Date(ageRow.earliest).getTime()) / 86400000)
    : 0;

  const c_cases    = Math.min(1, nCases / N_CAS_SEUIL);
  const c_patterns = Math.min(1, nPatterns / N_PAT_SEUIL);
  const c_success  = avgSuccessRate;
  const c_age      = Math.min(1, daysActive / 365);

  const maturityScore = ALPHA * c_cases + BETA * c_patterns + GAMMA * c_success + DELTA * c_age;

  return {
    maturityScore: Math.min(1, Math.max(0, maturityScore)),
    nCases,
    nPatterns,
    avgSuccessRate,
    daysActive,
    components: { cases: c_cases, patterns: c_patterns, success: c_success, age: c_age },
  };
}

/**
 * Calcule λ(s) = λ_max × (1 − exp(−k × M(s)))
 *
 * Propriétés :
 *   λ(0)   = 0             → site neuf suit entièrement le modèle global
 *   λ(0.5) ≈ 0.60          → site modérément mature conserve 60% de son modèle local
 *   λ(1)   ≈ λ_max = 0.85  → site ultra-mature conserve 85% de sa spécialisation
 */
export function computeMixingCoefficient(maturityScore: number): number {
  return LAMBDA_MAX * (1 - Math.exp(-K_ELASTIC * maturityScore));
}

// ─── Global model computation (differential FedAvg) ──────────────────────────

/**
 * Agrégation fédérée différentielle :
 * θ_global = Σ_s w(s)·θ_local(s) / Σ_s w(s)
 * w(s) = n_s × (1 − λ(s))
 *
 * Les sites matures (λ→1) contribuent peu au consensus global
 * → préserve leur spécialisation locale tout en enrichissant le global
 */
function computeDifferentialFedAvg(
  localModels: { vector: number[]; weight: number }[],
): number[] {
  if (localModels.length === 0) return uniformPrior();

  const global = new Array(MODEL_DIMS).fill(0);
  const totalWeight = localModels.reduce((s, m) => s + m.weight, 0);

  if (totalWeight === 0) return uniformPrior();

  for (const { vector, weight } of localModels) {
    for (let d = 0; d < MODEL_DIMS; d++) {
      global[d] += (weight / totalWeight) * vector[d];
    }
  }

  return normalizeVector(global);
}

// ─── Main orchestration ────────────────────────────────────────────────────────

/**
 * Construit le profil local d'un site à partir de ses patterns en BDD
 */
/**
 * Construit, signe et vérifie le ParametersDelta représentant la mise à jour
 * du vecteur local d'un site (Brevet 3, rev. 1c/15) — seul artefact qui
 * franchirait une frontière site→agrégation globale dans une architecture
 * distribuée réelle. Persiste le vecteur courant comme référence pour le
 * prochain delta. Best-effort : n'interrompt jamais le calcul d'agrégation.
 */
async function syncLocalVectorViaParametersDelta(
  tenantId: string,
  currentVector: number[]
): Promise<ParametersDelta | null> {
  try {
    const [existing] = await db
      .select()
      .from(federatedSyncState)
      .where(eq(federatedSyncState.tenantId, tenantId))
      .limit(1);

    const previousVector = (existing?.lastSentVector as number[] | undefined) ?? null;
    const delta = buildParametersDelta(previousVector, currentVector);

    // Propriété d'exclusion structurelle vérifiée à l'exécution, pas seulement au typage.
    if (!verifyParametersDelta(delta) || !ParametersDeltaSchema.safeParse(delta).success) {
      throw new Error("ParametersDelta invalide ou signature incorrecte — synchronisation refusée");
    }

    await db
      .insert(federatedSyncState)
      .values({ tenantId, lastSentVector: currentVector })
      .onConflictDoUpdate({
        target: federatedSyncState.tenantId,
        set: { lastSentVector: currentVector, updatedAt: new Date() },
      });

    return delta;
  } catch (err) {
    console.error(`[ParametersDelta] Synchronisation échouée pour ${tenantId} (best-effort):`, err);
    return null;
  }
}

async function buildSiteProfile(
  tenant: { id: string; name: string },
): Promise<SiteProfile> {
  const maturity = await computeSiteMaturityScore(tenant.id);
  const lambda = computeMixingCoefficient(maturity.maturityScore);

  // Récupérer les patterns locaux
  const patterns = await db
    .select({
      problemPattern: federatedLearning.problemPattern,
      solutionEffectiveness: federatedLearning.solutionEffectiveness,
    })
    .from(federatedLearning)
    .where(eq(federatedLearning.tenantId, tenant.id))
    .limit(200);

  const localModelVector = buildLocalModelFromPatterns(patterns);
  await syncLocalVectorViaParametersDelta(tenant.id, localModelVector);

  // Identifier les dimensions où le site est > moyenne globale (spécialisations)
  const specializations = DIM_LABELS
    .map((lbl, i) => ({ lbl, val: localModelVector[i] }))
    .filter(({ val }) => val > 1.2 / MODEL_DIMS) // 20% au-dessus du prior uniforme
    .sort((a, b) => b.val - a.val)
    .slice(0, 3)
    .map(({ lbl }) => lbl);

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    maturityScore: maturity.maturityScore,
    mixingCoefficient: lambda,
    nCases: maturity.nCases,
    nPatterns: maturity.nPatterns,
    avgSuccessRate: maturity.avgSuccessRate,
    daysActive: maturity.daysActive,
    localModelVector,
    specializations,
  };
}

/**
 * Pipeline complet d'adaptation différentielle pour toute la flotte de sites.
 */
export async function runDifferentialAggregation(): Promise<DifferentialAggregationResult> {
  const allTenants = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.isActive, true))
    .limit(50);

  if (allTenants.length === 0) {
    const uniform = uniformPrior();
    return {
      globalModel: uniform,
      previousGlobalModel: null,
      siteProfiles: [],
      personalizedModels: [],
      aggregationWeights: {},
      fleetMaturityAvg: 0,
      fleetLambdaAvg: 0,
      fleetSPIAvg: 0,
      nSitesMature: 0,
      nSitesSpecialized: 0,
      driftAlerts: [],
      aggregatedAt: new Date().toISOString(),
    };
  }

  // Construire tous les profils de sites en parallèle
  const profiles = await Promise.all(allTenants.map(t => buildSiteProfile(t)));

  // ── Étape 1 : Modèle global différentiel ──────────────────────────────────
  const weightedInputs = profiles.map(p => ({
    vector: p.localModelVector,
    weight: Math.max(1, p.nCases) * (1 - p.mixingCoefficient),
  }));
  const globalModel = computeDifferentialFedAvg(weightedInputs);

  // ── Étape 2 : Modèles personnalisés + SPI ────────────────────────────────
  const personalizedModels: PersonalizedModelResult[] = profiles.map(p => {
    const λ = p.mixingCoefficient;
    const personalizedVector = lerpVector(globalModel, p.localModelVector, λ);
    const spi = Math.max(0, 1 - cosineSimilarity(globalModel, p.localModelVector));
    return {
      tenantId: p.tenantId,
      personalizedVector,
      globalVector: globalModel,
      localVector: p.localModelVector,
      mixingCoefficient: λ,
      spi,
      globalContribution: 1 - λ,
      localContribution: λ,
    };
  });

  // ── Étape 3 : Poids d'agrégation normalisés ──────────────────────────────
  const rawWeights: Record<string, number> = {};
  let totalW = 0;
  for (const { vector, weight } of weightedInputs) {
    const p = profiles.find(pr => JSON.stringify(pr.localModelVector) === JSON.stringify(vector));
    if (p) { rawWeights[p.tenantId] = weight; totalW += weight; }
  }
  const aggregationWeights: Record<string, number> = {};
  for (const [tid, w] of Object.entries(rawWeights)) {
    aggregationWeights[tid] = totalW > 0 ? w / totalW : 0;
  }
  // Fallback propre
  profiles.forEach((p, i) => {
    aggregationWeights[p.tenantId] = totalW > 0 ? weightedInputs[i].weight / totalW : 1 / profiles.length;
  });

  // ── Étape 4 : Métriques flotte ────────────────────────────────────────────
  const fleetMaturityAvg = profiles.reduce((s, p) => s + p.maturityScore, 0) / profiles.length;
  const fleetLambdaAvg   = profiles.reduce((s, p) => s + p.mixingCoefficient, 0) / profiles.length;
  const fleetSPIAvg      = personalizedModels.reduce((s, m) => s + m.spi, 0) / personalizedModels.length;
  const nSitesMature     = profiles.filter(p => p.maturityScore > 0.7).length;
  const nSitesSpecialized = personalizedModels.filter(m => m.spi > 0.3).length;

  // ── Étape 5 : Détection de dérive ─────────────────────────────────────────
  const driftAlerts: DifferentialAggregationResult["driftAlerts"] = [];
  for (const pm of personalizedModels) {
    const sim = cosineSimilarity(pm.localVector, globalModel);
    if (sim < 0.5 && pm.mixingCoefficient < 0.3) {
      // Site peu mature mais très divergent du global = dérive anormale
      driftAlerts.push({
        tenantId: pm.tenantId,
        delta: sim,
        reason: `Site peu mature (λ=${pm.mixingCoefficient.toFixed(2)}) mais fortement divergent (cosine=${sim.toFixed(2)}). Vérifier la qualité des données.`,
      });
    } else if (pm.spi > 0.7 && pm.mixingCoefficient < 0.5) {
      driftAlerts.push({
        tenantId: pm.tenantId,
        delta: sim,
        reason: `SPI élevé (${pm.spi.toFixed(2)}) malgré une faible maturité. Spécialisation potentiellement artefactuelle.`,
      });
    }
  }

  return {
    globalModel,
    previousGlobalModel: null,
    siteProfiles: profiles,
    personalizedModels,
    aggregationWeights,
    fleetMaturityAvg,
    fleetLambdaAvg,
    fleetSPIAvg,
    nSitesMature,
    nSitesSpecialized,
    driftAlerts,
    aggregatedAt: new Date().toISOString(),
  };
}

/**
 * Calcule le modèle personnalisé pour un seul site (tenant).
 * Utilisé par les routes d'API individuelles.
 */
export async function getPersonalizedModelForSite(
  tenantId: string,
  precomputedGlobal?: number[],
): Promise<PersonalizedModelResult & { profile: SiteProfile }> {
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    const uniform = uniformPrior();
    return {
      tenantId, personalizedVector: uniform, globalVector: uniform,
      localVector: uniform, mixingCoefficient: 0, spi: 0,
      globalContribution: 1, localContribution: 0,
      profile: {
        tenantId, tenantName: "Unknown", maturityScore: 0, mixingCoefficient: 0,
        nCases: 0, nPatterns: 0, avgSuccessRate: 0, daysActive: 0,
        localModelVector: uniform, specializations: [],
      },
    };
  }

  const profile = await buildSiteProfile(tenant);

  // Global model : soit précomputed, soit recalculé (approximé via FedAvg simplifié)
  const globalModel = precomputedGlobal ?? uniformPrior();

  const λ = profile.mixingCoefficient;
  const personalizedVector = lerpVector(globalModel, profile.localModelVector, λ);
  const spi = Math.max(0, 1 - cosineSimilarity(globalModel, profile.localModelVector));

  return {
    tenantId,
    personalizedVector,
    globalVector: globalModel,
    localVector: profile.localModelVector,
    mixingCoefficient: λ,
    spi,
    globalContribution: 1 - λ,
    localContribution: λ,
    profile,
  };
}

// ─── Cloisonnement de la vue de flotte ────────────────────────────────────────
//
// ═══════════════════════════════════════════════════════════════════
// CE QUI ÉTAIT DIVULGUÉ, ET POURQUOI CE N'ÉTAIT PAS UN OUBLI DE FILTRE
// ═══════════════════════════════════════════════════════════════════
// `runDifferentialAggregation()` part de TOUS les locataires actifs — c'est sa
// raison d'être : un modèle fédéré se calcule sur la flotte. Le défaut n'était
// donc pas dans la requête, mais dans ce qui en SORTAIT vers un locataire :
// `/api/federated-adapt/sites` et `/specialization` servaient le profil complet
// de chaque pair, nom en clair compris.
//
// Mesuré le 2026-11-07 sur un serveur réel (3 locataires seedés, données
// distinctes par site) : l'administrateur d'Alpha, SON TECHNICIEN et même son
// compte `viewer` — niveau 0, « consulte sans rien modifier » — lisaient le nom
// « Tenant Beta (tests) », son score de maturité, son nombre de cas, son taux
// de succès (0,40 contre 0,90 pour Alpha), ses spécialisations et son vecteur
// de modèle local à 12 dimensions. Un taux de succès de maintenance est une
// donnée commerciale : c'est la fuite, pas le fait d'agréger.
//
// ═══════════════════════════════════════════════════════════════════
// POURQUOI RETIRER LES LIGNES DES PAIRS, ET NON LES RENOMMER
// ═══════════════════════════════════════════════════════════════════
// L'anonymisation par pseudonyme — « Site 2 », « Site 3 » — était l'option la
// plus douce, et elle ne tient pas la mesure : une instance de ce produit
// compte quelques locataires. Avec trois sites, un administrateur qui se
// reconnaît dans la liste identifie les deux autres par élimination, et il
// connaît déjà la composition de sa flotte. Un pseudonyme aurait donc PROMIS
// une anonymisation en ne livrant qu'une pseudonymisation — exactement la
// surpromesse que ce dépôt vient de retirer du filet anti-fuite (lot A4).
//
// La vue de flotte est conservée, mais sous la seule forme qui ne désigne
// personne : la MOYENNE. C'est aussi ce que l'apprentissage fédéré garantit en
// propre — on partage des paramètres agrégés, pas le dossier du voisin.
//
// ═══════════════════════════════════════════════════════════════════
// POURQUOI PAS « RÉSERVER AU SUPER-ADMIN »
// ═══════════════════════════════════════════════════════════════════
// Écartée sur mesure, pas par préférence. L'identité super-admin vit hors des
// locataires : `authenticateSuperAdmin` (server/super-admin-routes.ts) valide
// un jeton opaque en mémoire et pose `req.superAdmin`, sans jamais produire
// `req.user` ni `req.tenantId`. Or `/api/federated-adapt/*` est derrière
// `requireAuthentication`, qui n'accepte qu'un cookie de session de locataire.
// Mesuré : jeton porteur, cookie `superAdminToken`, puis les deux ensemble —
// 401 les trois fois, alors que `/api/super-admin/tenants` répond 200. Déplacer
// ces routes derrière un garde super-admin aurait donc produit une capacité que
// PERSONNE ne peut lire : la panne que ce dépôt a déjà documentée dans
// server/tenant-integration.ts (« la capacité était morte »). Et c'est inutile :
// l'exploitant de la plateforme dispose déjà de `/api/super-admin/tenants` pour
// la liste nominative.

/**
 * Nombre minimal de sites actifs pour qu'un agrégat de flotte puisse être servi
 * à un locataire sans lui livrer la valeur d'un pair.
 *
 * C'est de l'arithmétique, pas une convention de prudence. Le demandeur
 * connaît SA propre valeur ; une moyenne sur N sites lui donne donc la somme
 * des N−1 autres :
 *
 *   • N = 2 (un seul pair) — l'inversion est EXACTE. La moyenne révèle la
 *     valeur du pair au chiffre près.
 *   • N = 3 (deux pairs)   — il reste une somme de deux valeurs. Dès que l'une
 *     est devinable (un site neuf est proche de 0), l'autre tombe.
 *   • N = 4 (trois pairs)  — première taille où la somme ne désigne plus
 *     personne.
 *
 * Le seuil porte sur tout ce qui se calcule SUR LES AUTRES : moyennes,
 * compteurs par classe, maxima — et sur le modèle global lui-même.
 *
 * Le modèle global mérite sa propre démonstration, parce qu'il n'a pas l'air
 * d'une moyenne de données : θ_global = Σ w_s·θ_s / Σ w_s. Avec un seul pair B,
 * le demandeur A connaît θ_A et w_A ; il lui reste 12 équations pour
 * 13 inconnues (θ_B et w_B), et `normalizeVector` impose que θ_B somme à 1 —
 * ce qui ferme le système. Servir θ_global révèle donc θ_B EXACTEMENT. Servir
 * le vecteur personnalisé θ̂ = (1−λ)·θ_global + λ·θ_local revient au même, car
 * θ_global s'en déduit par θ_global = (θ̂ − λ·θ_local) / (1 − λ).
 *
 * À l'inverse, le SPI de son PROPRE site reste servi en dessous du seuil : il
 * ne livre qu'un scalaire, cos(θ_global, θ_local), soit une équation pour
 * treize inconnues. Il contraint θ_global à un cône, il ne le désigne pas.
 * C'est ce qui permet à l'écran de rester utile sur une petite flotte.
 */
export const SITES_MIN_POUR_AGREGAT = 4;

/** Les agrégats de flotte sont-ils servables à un locataire ? */
export function agregatsServables(nSitesActifs: number): boolean {
  return nSitesActifs >= SITES_MIN_POUR_AGREGAT;
}

/**
 * Dit à l'écran POURQUOI les comparaisons de flotte sont absentes, au lieu de
 * le laisser afficher des tirets sans explication. Une absence non motivée
 * passe pour une panne, et c'est ce qui fait rouvrir un défaut déjà traité.
 */
export const MOTIF_AGREGATS_MASQUES =
  `Comparaison de flotte indisponible : il faut au moins ${SITES_MIN_POUR_AGREGAT} ` +
  `sites actifs. En dessous, soustraire sa propre valeur de la moyenne révèle ` +
  `celle des autres sites.`;
