/**
 * Helpers partagés des tests d'intégration — F05.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI A CHANGÉ, ET POURQUOI
 * ═══════════════════════════════════════════════════════════════════
 * Avant : `const API_BASE = process.env.API_URL || 'http://localhost:5000'`.
 * Le repli codé en dur faisait qu'une suite lancée sans serveur échouait sur
 * des `ECONNREFUSED` incompréhensibles, ou pire, tapait sur le serveur de
 * DÉVELOPPEMENT de la machine et polluait sa base.
 *
 * Désormais `API_URL` est OBLIGATOIRE et fournie par scripts/run-tests.mjs, qui
 * démarre un serveur dédié sur un port choisi à l'exécution. Aucun repli : si
 * la variable manque, on échoue immédiatement avec un message qui dit quoi faire.
 *
 * Les signatures exportées sont inchangées : les quatre suites existantes
 * fonctionnent sans modification de leurs assertions.
 */

import request from 'supertest';

function requireApiUrl(): string {
  const url = process.env.API_URL;
  if (!url) {
    throw new Error(
      'API_URL absente.\n' +
      'Les tests d\'intégration ne se lancent pas directement avec `jest` :\n' +
      "  npm test                 (unitaires + intégration)\n" +
      '  npm run test:integration (intégration seule)\n' +
      "L'orchestrateur provisionne la base et le serveur, puis renseigne API_URL.",
    );
  }
  return url;
}

export const API_BASE = requireApiUrl();

/**
 * Comptes créés par tests/seed.ts. Les suites doivent s'y référer plutôt que
 * de coder des identifiants en dur — c'est ce qui rendait la suite dépendante
 * d'un compte créé à la main.
 */
export const SEEDED = {
  password: 'Maintrix2024!',
  admin: 'admin@maintrix.local',
  technician: 'tech@maintrix.local',
  adminBeta: 'admin-beta@maintrix.local',
  tenantAlpha: '00000000-0000-4000-8000-00000000a1fa',
  tenantBeta: '00000000-0000-4000-8000-00000000be7a',
} as const;

export interface AuthenticatedAgent {
  agent: any;
  cookies: string[];
  csrfToken: string;
  userId?: number;
  tenantId?: number | string;
}

/** Extrait le jeton CSRF d'un en-tête Set-Cookie. */
function extractCsrf(rawCookies: unknown): { csrfToken: string; cookies: string[] } {
  const cookies = Array.isArray(rawCookies) ? (rawCookies as string[]) : [];
  for (const cookie of cookies) {
    const match = cookie.match(/csrfToken=([^;]+)/);
    if (match) return { csrfToken: decodeURIComponent(match[1]), cookies };
  }
  return { csrfToken: '', cookies };
}

export async function getCsrfToken(): Promise<{ csrfToken: string; cookies: string[] }> {
  const response = await request(API_BASE).get('/api/health');
  return extractCsrf(response.headers['set-cookie']);
}

export async function authenticateUser(
  email: string,
  password: string,
  tenantId?: number | string,
): Promise<AuthenticatedAgent> {
  const agent = request.agent(API_BASE);

  const healthResponse = await agent.get('/api/health');
  const { csrfToken, cookies } = extractCsrf(healthResponse.headers['set-cookie']);

  const loginHeaders: Record<string, string> = { 'X-CSRF-Token': csrfToken };
  if (tenantId) loginHeaders['X-Tenant-Id'] = String(tenantId);

  const loginResponse = await agent
    .post('/api/enterprise-auth/login')
    .set(loginHeaders)
    .send({ email, password });

  if (loginResponse.status !== 200) {
    throw new Error(
      `Échec d'authentification pour ${email} — HTTP ${loginResponse.status} : ` +
      `${JSON.stringify(loginResponse.body)}\n` +
      'Le seed a-t-il bien été appliqué ? (tests/seed.ts)',
    );
  }

  const rawSessionCookies = loginResponse.headers['set-cookie'];
  const sessionCookies = Array.isArray(rawSessionCookies) ? rawSessionCookies : cookies;

  return {
    agent,
    cookies: sessionCookies,
    csrfToken,
    userId: loginResponse.body.user?.id,
    tenantId: loginResponse.body.user?.tenantId || tenantId,
  };
}

export function createAuthenticatedRequest(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  auth: AuthenticatedAgent,
): request.Test {
  const req = auth.agent[method](path)
    .set('Cookie', auth.cookies.join('; '))
    .set('X-CSRF-Token', auth.csrfToken);

  if (auth.tenantId) req.set('X-Tenant-Id', String(auth.tenantId));

  return req;
}

/** Requête NON authentifiée — utile aux tests d'authentification et RBAC. */
export function anonymousRequest(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
): request.Test {
  return (request(API_BASE) as any)[method](path);
}

/** Récupère un jeton CSRF frais depuis la sonde de santé. */
export async function freshCsrfToken(): Promise<string> {
  const res = await request(API_BASE).get('/api/health');
  const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
  for (const cookie of cookies) {
    const match = cookie.match(/csrfToken=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  throw new Error("Aucun cookie csrfToken renvoyé par /api/health");
}

/**
 * Requête super-admin correctement formée : jeton porteur ET jeton CSRF.
 *
 * Depuis F06, `/api/super-admin` n'est plus exempté de CSRF en bloc — seule
 * `/api/super-admin/login` l'est. Toute écriture super-admin doit donc porter
 * l'en-tête, exactement comme le fait `apiRequest()` côté client.
 *
 * ⚠️ Volontairement SYNCHRONE. Un `supertest.Test` est lui-même « thenable » :
 * si ce helper était `async`, `await helper(...)` déballerait deux fois et
 * renverrait une `Response` déjà consommée, sur laquelle `.send()` n'existe pas.
 * Le jeton CSRF est donc récupéré en amont par l'appelant, via
 * `freshCsrfToken()`.
 */
export function superAdminRequest(
  method: 'post' | 'put' | 'patch' | 'delete',
  path: string,
  bearerToken: string,
  csrfToken: string,
): request.Test {
  return (request(API_BASE) as any)[method](path)
    .set('Authorization', `Bearer ${bearerToken}`)
    .set('Cookie', `csrfToken=${csrfToken}`)
    .set('X-CSRF-Token', csrfToken);
}
