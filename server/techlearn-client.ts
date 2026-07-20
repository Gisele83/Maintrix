// Client HTTP vers TechLearn (LearnSmartHub) — produit séparé, authentifié par jeton de
// service (voir server/routes/external-integration.ts côté LearnSmartHub). Dégradation
// gracieuse : si TECHLEARN_API_URL n'est pas configurée ou si TechLearn ne répond pas,
// les fonctions retournent connected:false plutôt que de lever — le pont doit rester
// silencieux quand l'autre produit est absent, pas casser le flux Maintrix.
const TECHLEARN_API_URL = process.env.TECHLEARN_API_URL;
const TECHLEARN_SERVICE_TOKEN = process.env.TECHLEARN_SERVICE_TOKEN;
const REQUEST_TIMEOUT_MS = 4000;

export interface TechLearnTpRecommendation {
  tpId: string;
  title: string;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  level: string | null;
  url: string;
}

export interface TechLearnQuizAttempt {
  id: string;
  quizId: string | null;
  score: number;
  passed: boolean;
  attemptedAt: string;
}

async function callExternalApi<T>(path: string): Promise<{ connected: true; data: T } | { connected: false; reason: string }> {
  if (!TECHLEARN_API_URL || !TECHLEARN_SERVICE_TOKEN) {
    return { connected: false, reason: "TECHLEARN_API_URL / TECHLEARN_SERVICE_TOKEN non configurés" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${TECHLEARN_API_URL}${path}`, {
      headers: { "X-Service-Token": TECHLEARN_SERVICE_TOKEN },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { connected: false, reason: `TechLearn a répondu ${response.status}` };
    }
    const data = (await response.json()) as T;
    return { connected: true, data };
  } catch (err: any) {
    return { connected: false, reason: err?.name === "AbortError" ? "délai dépassé" : (err?.message ?? "erreur réseau") };
  } finally {
    clearTimeout(timeout);
  }
}

export async function isTechLearnConfigured(): Promise<boolean> {
  return Boolean(TECHLEARN_API_URL && TECHLEARN_SERVICE_TOKEN);
}

export async function fetchTpRecommendations(
  category: string,
  limit = 5,
): Promise<{ connected: boolean; recommendations: TechLearnTpRecommendation[]; reason?: string }> {
  const result = await callExternalApi<{ results: TechLearnTpRecommendation[] }>(
    `/api/external/tp-recommendations?category=${encodeURIComponent(category)}&limit=${limit}`,
  );
  if (!result.connected) return { connected: false, recommendations: [], reason: result.reason };
  return { connected: true, recommendations: result.data.results ?? [] };
}

export async function fetchQuizResultsForEmail(
  email: string,
  since?: Date,
): Promise<{ connected: boolean; attempts: TechLearnQuizAttempt[]; reason?: string }> {
  const sinceParam = since ? `&since=${encodeURIComponent(since.toISOString())}` : "";
  const result = await callExternalApi<{ found: boolean; attempts: TechLearnQuizAttempt[] }>(
    `/api/external/quiz-results?email=${encodeURIComponent(email)}${sinceParam}`,
  );
  if (!result.connected) return { connected: false, attempts: [], reason: result.reason };
  return { connected: true, attempts: result.data.attempts ?? [] };
}
