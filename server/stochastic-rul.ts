/**
 * Stochastic RUL (Remaining Useful Life) Engine
 * Brevet N°1 MAINTRIX-SCA-IMCA — Extension processus stochastiques
 *
 * Deux modèles de projection RUL avec intervalles de confiance :
 *
 *  1. Processus de Wiener (Brownian Motion avec dérive)
 *     X(t) = X₀ + μt + σW(t)
 *     → RUL ~ Inverse Gaussienne IG(m, λ)  — distribution analytique exacte
 *     → IC analytiques via CDF Inverse Gaussienne
 *
 *  2. Processus Gamma
 *     ΔX(t) ~ Gamma(α·Δt, β)  — incréments i.i.d. monotones
 *     → IC via simulation Monte Carlo (10 000 trajectoires)
 *     → Adapté aux dégradations cumulatives irréversibles (usure, corrosion)
 *
 * Estimation des paramètres par MLE sur l'historique IMCA.
 * Dégradation : d(t) = 100 − IMCA(t)  (transformation monotone)
 */

// ─── Normal distribution utilities ───────────────────────────────────────────

/**
 * Approximation haute précision de Φ(x) (CDF normale standard)
 * Hart (1968) — erreur < 1.5×10⁻⁷
 */
export function normalCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422820 * Math.exp(-0.5 * x * x);
  const poly =
    t * (0.3193815302 +
    t * (-0.3565637910 +
    t * (1.7814779372 +
    t * (-1.8212559978 +
    t * 1.3302744929))));
  const p = 1 - d * poly;
  return x >= 0 ? p : 1 - p;
}

/** Inverse de Φ — approximation Beasley-Springer-Moro */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  const a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
  const b = [-8.47351093090, 23.08336743743, -21.06224101826, 3.13082909833];
  const c = [0.3374754822726147, 0.9761690190917186, 0.1607979714918209,
             0.0276438810333863, 0.0038405729373609, 0.0003951896511349,
             0.0000321767881768, 0.0000002888167364, 0.0000003960315187];
  const q = p - 0.5;
  if (Math.abs(q) <= 0.42) {
    const r = q * q;
    return q * (((a[3] * r + a[2]) * r + a[1]) * r + a[0]) /
              ((((b[3] * r + b[2]) * r + b[1]) * r + b[0]) * r + 1);
  }
  const r = p < 0.5 ? p : 1 - p;
  const s = Math.log(-Math.log(r));
  let t = c[0];
  let sk = 1;
  for (let i = 1; i <= 8; i++) { sk *= s; t += c[i] * sk; }
  return p < 0.5 ? -t : t;
}

// ─── Inverse Gaussian distribution ───────────────────────────────────────────

/**
 * CDF de la distribution Inverse Gaussienne IG(m, λ)
 * m = moyenne, λ = paramètre de forme (Tweedie-Wald)
 *
 * F(t; m, λ) = Φ(√(λ/t) × (t/m − 1)) + exp(2λ/m) × Φ(−√(λ/t) × (t/m + 1))
 */
export function inverseGaussianCDF(t: number, m: number, lambda: number): number {
  if (t <= 0 || m <= 0 || lambda <= 0) return 0;
  const sqrtLT = Math.sqrt(lambda / t);
  const z1 = sqrtLT * (t / m - 1);
  const z2 = -sqrtLT * (t / m + 1);
  return normalCDF(z1) + Math.exp(2 * lambda / m) * normalCDF(z2);
}

/**
 * Quantile de la distribution Inverse Gaussienne par bisection
 * Tolère des paramètres larges/petits avec bornes adaptatives
 */
export function inverseGaussianQuantile(p: number, m: number, lambda: number, tol = 1e-6): number {
  if (p <= 0) return 0;
  if (p >= 1) return Infinity;
  if (m <= 0 || lambda <= 0) return NaN;

  // Borne sup adaptative : utiliser approximation normale + grande marge
  let lo = 1e-9;
  let hi = m * 50 + Math.sqrt(m * m * m / lambda) * 20;
  // Sécurité : si p élevé, étendre hi
  while (inverseGaussianCDF(hi, m, lambda) < p && hi < 1e9) hi *= 2;
  if (inverseGaussianCDF(hi, m, lambda) < p) return hi;

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (hi - lo < tol) break;
    if (inverseGaussianCDF(mid, m, lambda) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WienerParams {
  mu: number;       // dérive par heure (μ̂ MLE)
  sigma: number;    // coefficient de diffusion (σ̂ MLE)
  nObs: number;     // nombre d'observations utilisées
  r2: number;       // pseudo-R² de la trajectoire linéaire (qualité de l'ajustement)
}

export interface GammaParams {
  alpha: number;    // shape par heure (α̂ MLE)
  beta: number;     // rate (β̂ MLE = 1/scale)
  nObs: number;
  positiveRatio: number; // fraction d'incréments positifs
}

export interface RULDistribution {
  mean: number;                // espérance RUL (heures)
  median: number;              // médiane RUL
  mode: number;                // mode RUL (Wiener uniquement, sinon approx)
  stdDev: number;              // écart-type
  confidenceIntervals: {
    p05: number;    // 5e percentile
    p10: number;    // 10e percentile  ← "pessimiste"
    p25: number;    // Q1
    p50: number;    // médiane
    p75: number;    // Q3
    p90: number;    // 90e percentile  ← "optimiste"
    p95: number;    // 95e percentile
  };
  unit: "heures";
}

export interface StochasticRULResult {
  model: "wiener" | "gamma" | "fallback";
  currentDegradation: number;      // d_current = 100 − IMCA
  failureThreshold: number;        // θ_fail (en unités de dégradation)
  remainingMargin: number;         // θ_fail − d_current
  wienerParams?: WienerParams;
  gammaParams?: GammaParams;
  wienerRUL?: RULDistribution;
  gammaRUL?: RULDistribution;
  recommended: RULDistribution;    // distribution recommandée (meilleure adéquation)
  recommendedModel: "wiener" | "gamma" | "ensemble";
  ensemble?: RULDistribution;      // fusion bayésienne Wiener + Gamma si les deux disponibles
  warnings: string[];
  explanation: string;
}

// ─── Parameter estimation ─────────────────────────────────────────────────────

/**
 * Estimation MLE Wiener à partir d'une trajectoire de dégradation
 * d(t₀), d(t₁), …, d(tₙ)  — espacement régulier Δt (heures)
 */
export function estimateWienerParams(degradationPath: number[], deltaT: number = 1): WienerParams {
  const n = degradationPath.length;
  if (n < 3) return { mu: 0.001, sigma: 0.1, nObs: n, r2: 0 };

  const increments = [];
  for (let i = 1; i < n; i++) increments.push(degradationPath[i] - degradationPath[i - 1]);

  const muRaw = increments.reduce((a, b) => a + b, 0) / increments.length;
  const mu = muRaw / deltaT;  // MLE dérive par heure

  const varRaw = increments.reduce((a, b) => a + (b - muRaw * deltaT) ** 2, 0) / increments.length;
  const sigma2 = varRaw / deltaT;
  const sigma = Math.sqrt(Math.max(sigma2, 1e-8));

  // R² pour évaluer l'adéquation du modèle linéaire
  const meanD = degradationPath.reduce((a, b) => a + b, 0) / n;
  const ssTot = degradationPath.reduce((a, d) => a + (d - meanD) ** 2, 0);
  let ssRes = 0;
  for (let i = 0; i < n; i++) ssRes += (degradationPath[i] - (degradationPath[0] + mu * i * deltaT)) ** 2;
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  return { mu, sigma, nObs: n, r2 };
}

/**
 * Estimation MLE Gamma à partir d'une trajectoire de dégradation
 * Utilise uniquement les incréments positifs (monotone par hypothèse)
 */
export function estimateGammaParams(degradationPath: number[], deltaT: number = 1): GammaParams {
  const n = degradationPath.length;
  if (n < 3) return { alpha: 0.001, beta: 1, nObs: n, positiveRatio: 0 };

  const increments = [];
  for (let i = 1; i < n; i++) increments.push(degradationPath[i] - degradationPath[i - 1]);

  const positiveIncrements = increments.filter(d => d > 0);
  const positiveRatio = positiveIncrements.length / increments.length;

  // Si trop peu d'incréments positifs, ajouter un petit biais
  const workIncrements = positiveIncrements.length >= 3
    ? positiveIncrements
    : increments.map(d => Math.max(d, 1e-4));

  const meanInc = workIncrements.reduce((a, b) => a + b, 0) / workIncrements.length;
  const varInc = workIncrements.reduce((a, b) => a + (b - meanInc) ** 2, 0) / workIncrements.length;

  // MLE pour Gamma: alpha = mean²/var, beta = mean/var
  const alpha = varInc > 0 ? (meanInc ** 2 / varInc) / deltaT : 0.01;
  const beta = varInc > 0 ? meanInc / varInc : 1;

  return { alpha: Math.max(alpha, 1e-6), beta: Math.max(beta, 1e-6), nObs: n, positiveRatio };
}

// ─── Wiener RUL distribution ──────────────────────────────────────────────────

/**
 * Distribution RUL sous modèle de Wiener (Inverse Gaussienne)
 *
 * X(t) = x_current + μt + σW(t),  premier passage en θ_fail
 * Remaining: D = θ_fail − x_current
 * T_RUL ~ IG(m, λ)  où m = D/μ,  λ = D²/σ²
 */
export function computeWienerRUL(
  currentDegradation: number,
  failureThreshold: number,
  params: WienerParams,
): RULDistribution | null {
  const D = failureThreshold - currentDegradation;

  if (D <= 0) {
    // Déjà en défaillance
    return {
      mean: 0, median: 0, mode: 0, stdDev: 0, unit: "heures",
      confidenceIntervals: { p05: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0 }
    };
  }

  if (params.mu <= 0) {
    // Dérive nulle ou négative — dégradation non progressive
    return null;
  }

  // Paramètres Inverse Gaussienne
  const m = D / params.mu;                  // moyenne (heures)
  const lambda = (D ** 2) / (params.sigma ** 2);  // paramètre de forme

  // Variance : Var(T) = m³/λ
  const variance = (m ** 3) / lambda;
  const stdDev = Math.sqrt(variance);

  // Mode de l'IG
  const mode = m * (Math.sqrt(1 + (9 * m ** 2) / (4 * lambda ** 2)) - (3 * m) / (2 * lambda));

  const percentiles = [0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95];
  const [p05, p10, p25, p50, p75, p90, p95] = percentiles.map(p =>
    Math.round(inverseGaussianQuantile(p, m, lambda))
  );

  return {
    mean: Math.round(m),
    median: p50,
    mode: Math.round(Math.max(0, mode)),
    stdDev: Math.round(stdDev),
    unit: "heures",
    confidenceIntervals: { p05, p10, p25, p50, p75, p90, p95 },
  };
}

// ─── Gamma RUL distribution via Monte Carlo ───────────────────────────────────

/**
 * Générateur de variables aléatoires Gamma via Marsaglia-Tsang (2000)
 * Robuste pour α < 1 via la propriété de scaling
 */
function sampleGamma(alpha: number, beta: number, rng: () => number): number {
  if (alpha <= 0 || beta <= 0) return 0;

  // Pour α < 1: Gamma(α, β) = Gamma(α+1, β) × U^(1/α)
  const a = alpha < 1 ? alpha + 1 : alpha;
  const d = a - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  let x: number, v: number;
  for (;;) {
    do {
      x = normalQuantile(rng());
      v = 1 + c * x;
    } while (v <= 0);
    v = v ** 3;
    const u = rng();
    const xsq = x * x;
    if (u < 1 - 0.0331 * (xsq ** 2)) break;
    if (Math.log(u) < 0.5 * xsq + d * (1 - v + Math.log(v))) break;
  }

  const g = d * v / beta;
  return alpha < 1 ? g * (rng() ** (1 / alpha)) : g;
}

/** Générateur pseudo-aléatoire déterministe (Mulberry32) pour reproductibilité */
function makeMulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Distribution RUL sous modèle Gamma — Monte Carlo (N=15 000 trajectoires)
 *
 * Δd_i ~ Gamma(α·Δt, β)  (incréments positifs)
 * Simuler le temps T tel que Σ Δd_i ≥ D  (premier passage)
 */
export function computeGammaRUL(
  currentDegradation: number,
  failureThreshold: number,
  params: GammaParams,
  nSim: number = 15000,
  deltaT: number = 1,
  maxSteps: number = 50000,
): RULDistribution | null {
  const D = failureThreshold - currentDegradation;
  if (D <= 0) {
    return {
      mean: 0, median: 0, mode: 0, stdDev: 0, unit: "heures",
      confidenceIntervals: { p05: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0 }
    };
  }

  if (params.alpha <= 0 || params.beta <= 0) return null;

  const rng = makeMulberry32(42 + Math.round(D * 1000));
  const rul: number[] = [];

  // Taux de dégradation moyen par heure pour borner la simulation
  const meanRatePerHour = params.alpha / params.beta;
  if (meanRatePerHour <= 0) return null;

  const expectedSteps = Math.ceil(D / (meanRatePerHour * deltaT));
  const stepLimit = Math.min(maxSteps, expectedSteps * 20);

  for (let sim = 0; sim < nSim; sim++) {
    let cumDeg = 0;
    let step = 0;
    while (cumDeg < D && step < stepLimit) {
      cumDeg += sampleGamma(params.alpha * deltaT, params.beta, rng);
      step++;
    }
    rul.push(step < stepLimit ? step * deltaT : stepLimit * deltaT * 2); // capping
  }

  rul.sort((a, b) => a - b);

  const mean = Math.round(rul.reduce((a, b) => a + b, 0) / nSim);
  const variance = rul.reduce((a, b) => a + (b - mean) ** 2, 0) / nSim;
  const stdDev = Math.round(Math.sqrt(variance));

  const idx = (p: number) => Math.round(rul[Math.min(Math.floor(p * nSim), nSim - 1)]);
  const p05 = idx(0.05), p10 = idx(0.10), p25 = idx(0.25), p50 = idx(0.50);
  const p75 = idx(0.75), p90 = idx(0.90), p95 = idx(0.95);

  // Mode approximé (mode de la distribution empirique — bin de 50h)
  const binSize = Math.max(1, Math.round(mean / 20));
  const bins: Record<number, number> = {};
  for (const r of rul) { const b = Math.floor(r / binSize); bins[b] = (bins[b] ?? 0) + 1; }
  const modeBin = parseInt(Object.entries(bins).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "0");
  const mode = modeBin * binSize + binSize / 2;

  return {
    mean, median: p50, mode: Math.round(mode), stdDev, unit: "heures",
    confidenceIntervals: { p05, p10, p25, p50, p75, p90, p95 },
  };
}

// ─── Ensemble fusion (Bayesian mixture) ──────────────────────────────────────

/**
 * Fusion bayésienne des deux distributions RUL
 * Pondération par vraisemblance approximative :
 *   - Wiener : pondération proportionnelle à R² du modèle linéaire
 *   - Gamma : pondération proportionnelle à la fraction d'incréments positifs
 */
export function ensembleRUL(
  wiener: RULDistribution,
  gamma: RULDistribution,
  wienerWeight: number,
  gammaWeight: number,
): RULDistribution {
  const wW = wienerWeight / (wienerWeight + gammaWeight);
  const wG = 1 - wW;

  const blend = (a: number, b: number) => Math.round(wW * a + wG * b);

  return {
    mean: blend(wiener.mean, gamma.mean),
    median: blend(wiener.median, gamma.median),
    mode: blend(wiener.mode, gamma.mode),
    stdDev: blend(wiener.stdDev, gamma.stdDev),
    unit: "heures",
    confidenceIntervals: {
      p05: blend(wiener.confidenceIntervals.p05, gamma.confidenceIntervals.p05),
      p10: blend(wiener.confidenceIntervals.p10, gamma.confidenceIntervals.p10),
      p25: blend(wiener.confidenceIntervals.p25, gamma.confidenceIntervals.p25),
      p50: blend(wiener.confidenceIntervals.p50, gamma.confidenceIntervals.p50),
      p75: blend(wiener.confidenceIntervals.p75, gamma.confidenceIntervals.p75),
      p90: blend(wiener.confidenceIntervals.p90, gamma.confidenceIntervals.p90),
      p95: blend(wiener.confidenceIntervals.p95, gamma.confidenceIntervals.p95),
    },
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Calcule les deux distributions RUL stochastiques à partir d'une série IMCA
 *
 * @param imcaHistory   — tableau de scores IMCA chronologiques [90, 88, 85, …]
 * @param currentIMCA   — score IMCA actuel
 * @param deltaTHours   — intervalle entre mesures (heures), défaut 24h
 * @param failureIMCA   — seuil de défaillance (IMCA < failureIMCA = panne), défaut 30
 */
export function computeStochasticRUL(
  imcaHistory: number[],
  currentIMCA: number,
  deltaTHours: number = 24,
  failureIMCA: number = 30,
): StochasticRULResult {
  const warnings: string[] = [];

  // Transformation : dégradation = 100 − IMCA  (croissante vers défaillance)
  const degradationPath = imcaHistory.map(s => 100 - s);
  const currentDegradation = 100 - currentIMCA;
  const failureThreshold = 100 - failureIMCA;      // ex. 70 si failureIMCA = 30
  const remainingMargin = failureThreshold - currentDegradation;

  if (remainingMargin <= 0) {
    warnings.push("IMCA en dessous du seuil de défaillance — actif en état critique.");
    const zero: RULDistribution = {
      mean: 0, median: 0, mode: 0, stdDev: 0, unit: "heures",
      confidenceIntervals: { p05: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0 },
    };
    return {
      model: "fallback", currentDegradation, failureThreshold, remainingMargin: 0,
      recommended: zero, recommendedModel: "wiener", warnings,
      explanation: "Seuil de défaillance déjà atteint. Intervention immédiate requise.",
    };
  }

  if (degradationPath.length < 3) {
    warnings.push("Historique IMCA insuffisant (< 3 points) — RUL calculé par heuristique simplifiée.");
    const heuristic: RULDistribution = {
      mean: currentIMCA * 10, median: currentIMCA * 9, mode: currentIMCA * 8, stdDev: currentIMCA * 3,
      unit: "heures",
      confidenceIntervals: {
        p05: currentIMCA * 4, p10: currentIMCA * 5, p25: currentIMCA * 7,
        p50: currentIMCA * 9, p75: currentIMCA * 12, p90: currentIMCA * 15, p95: currentIMCA * 18,
      }
    };
    return {
      model: "fallback", currentDegradation, failureThreshold, remainingMargin,
      recommended: heuristic, recommendedModel: "wiener", warnings,
      explanation: "Historique insuffisant pour ajuster un modèle stochastique. Heuristique appliquée.",
    };
  }

  // ── Estimation des paramètres ────────────────────────────────────────────
  const wienerParams = estimateWienerParams(degradationPath, deltaTHours);
  const gammaParams  = estimateGammaParams(degradationPath, deltaTHours);

  if (wienerParams.mu <= 0) {
    warnings.push(`Dérive Wiener négative (μ = ${wienerParams.mu.toFixed(4)}) — IMCA en amélioration ou stable.`);
  }
  if (gammaParams.positiveRatio < 0.4) {
    warnings.push(`Peu d'incréments positifs (${Math.round(gammaParams.positiveRatio * 100)}%) — modèle Gamma moins fiable.`);
  }

  // ── Calcul distributions RUL ─────────────────────────────────────────────
  const wienerRUL = wienerParams.mu > 0
    ? computeWienerRUL(currentDegradation, failureThreshold, wienerParams) ?? undefined
    : undefined;

  const gammaRUL = computeGammaRUL(currentDegradation, failureThreshold, gammaParams, 15000, deltaTHours) ?? undefined;

  // ── Sélection du modèle recommandé ───────────────────────────────────────
  let recommendedModel: "wiener" | "gamma" | "ensemble" = "wiener";
  let recommended: RULDistribution;
  let ensemble: RULDistribution | undefined;

  if (wienerRUL && gammaRUL) {
    // Poids : R² pour Wiener, fraction positive pour Gamma
    const wW = Math.max(0.1, wienerParams.r2);
    const wG = Math.max(0.1, gammaParams.positiveRatio);
    ensemble = ensembleRUL(wienerRUL, gammaRUL, wW, wG);
    recommendedModel = "ensemble";
    recommended = ensemble;
  } else if (wienerRUL) {
    recommendedModel = "wiener";
    recommended = wienerRUL;
  } else if (gammaRUL) {
    recommendedModel = "gamma";
    recommended = gammaRUL;
  } else {
    warnings.push("Aucun modèle stochastique convergé — heuristique appliquée.");
    recommended = {
      mean: Math.round(remainingMargin * 10), median: Math.round(remainingMargin * 9),
      mode: Math.round(remainingMargin * 8), stdDev: Math.round(remainingMargin * 3),
      unit: "heures",
      confidenceIntervals: {
        p05: Math.round(remainingMargin * 3), p10: Math.round(remainingMargin * 4),
        p25: Math.round(remainingMargin * 6), p50: Math.round(remainingMargin * 9),
        p75: Math.round(remainingMargin * 12), p90: Math.round(remainingMargin * 15),
        p95: Math.round(remainingMargin * 18),
      }
    };
    recommendedModel = "wiener";
  }

  // ── Explication ──────────────────────────────────────────────────────────
  const modelLabel: Record<string, string> = {
    wiener: "Processus de Wiener (Inverse Gaussienne)",
    gamma: "Processus Gamma (Monte Carlo 15 000 trajectoires)",
    ensemble: "Fusion bayésienne Wiener + Gamma",
  };
  const explanation =
    `Marge résiduelle : ${remainingMargin.toFixed(1)} pts dégradation (seuil θ = ${failureThreshold}, actuel = ${currentDegradation.toFixed(1)}). ` +
    `Modèle : ${modelLabel[recommendedModel]}. ` +
    `RUL médian = ${recommended.median}h · IC 90% : [${recommended.confidenceIntervals.p05}h – ${recommended.confidenceIntervals.p95}h]. ` +
    (wienerParams.mu > 0
      ? `Dérive Wiener μ̂ = ${wienerParams.mu.toFixed(4)}/h, σ̂ = ${wienerParams.sigma.toFixed(4)}/h. `
      : "") +
    `Gamma α̂ = ${gammaParams.alpha.toFixed(4)}/h, β̂ = ${gammaParams.beta.toFixed(4)}.`;

  return {
    model: wienerRUL && gammaRUL ? "wiener" : wienerRUL ? "wiener" : "gamma",
    currentDegradation,
    failureThreshold,
    remainingMargin,
    wienerParams,
    gammaParams,
    wienerRUL,
    gammaRUL,
    recommended,
    recommendedModel,
    ensemble,
    warnings,
    explanation,
  };
}
