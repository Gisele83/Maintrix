import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Une session super-admin perdue renvoie-t-elle vers la connexion ?
 *
 * ⚠️ Les jetons super-admin vivent dans une Map EN MÉMOIRE du serveur : recréer
 * le conteneur — donc chaque déploiement — les efface tous. Le navigateur
 * continue d'envoyer le sien, et la console répondait par un bandeau rouge
 * « 401: {"error":"INVALID_SUPER_ADMIN_TOKEN"...} » au milieu d'un écran par
 * ailleurs normal. On croit à une panne de la fonction qu'on vient d'utiliser,
 * alors qu'il suffit de se reconnecter. Constaté le 2026-10-08, juste après un
 * déploiement.
 *
 * Le jeton périmé est maintenant jeté, et la page de connexion reprend la main.
 */
function sessionSuperAdminPerdue(texte: string): boolean {
  return texte.includes('INVALID_SUPER_ADMIN_TOKEN')
    || texte.includes('SUPER_ADMIN_TOKEN_REQUIRED');
}

/**
 * Un refus déguisé en succès.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CETTE VÉRIFICATION EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `antiLeakageValidator` (server/tenant-security-middleware.ts) inspecte
 * chaque réponse et, s'il y repère des données d'un autre locataire,
 * REMPLACE le corps par `{ error: 'CROSS_TENANT_DATA_DETECTED', … }` — mais
 * sans toucher au statut. Le client reçoit donc **HTTP 200** accompagné d'un
 * objet d'erreur, là où il attendait un tableau.
 *
 * Mesuré le 20/10/2026 sur l'environnement de test : il a suffi d'insérer UNE
 * session de diagnostic appartenant à un second locataire pour que
 * `/api/history` et `/api/reports` basculent de `[…]` à cet objet. Les deux
 * écrans qui les lisent vérifiaient `res.ok`, le trouvaient vrai, puis
 * appelaient `.map` dessus : « TypeError: a.map is not a function », et la
 * page /dashboard se rendait ENTIÈREMENT BLANCHE — onglet « Historique »
 * comme onglet « Signalement ».
 *
 * Ce défaut ne se voit pas sur un jeu de données mono-locataire : c'est
 * précisément pourquoi il a survécu. La cause est serveur (des requêtes de
 * lecture non filtrées par locataire) ; mais un écran ne doit JAMAIS rendre
 * une page blanche parce qu'une réponse n'a pas la forme attendue. On traite
 * donc ici le refus comme ce qu'il est : une erreur.
 */
function refusDeguiseEnSucces(donnees: unknown): string | null {
  if (!donnees || typeof donnees !== 'object' || Array.isArray(donnees)) return null;
  const objet = donnees as Record<string, unknown>;
  const code = objet.error;
  if (typeof code !== 'string' || code === '') return null;
  // Forme stricte du contrat d'erreur du serveur : un code, éventuellement un
  // message, et rien d'autre. Un enregistrement métier qui porterait un champ
  // `error` parmi ses colonnes n'est pas concerné.
  const clefs = Object.keys(objet);
  if (clefs.some((c) => c !== 'error' && c !== 'message')) return null;
  return typeof objet.message === 'string' && objet.message ? objet.message : code;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;

    if (res.status === 401 && sessionSuperAdminPerdue(text)) {
      try { localStorage.removeItem('superAdminToken'); } catch { /* navigation privée */ }
      if (!window.location.pathname.startsWith('/super-admin-login')) {
        window.location.assign('/super-admin-login?session=expiree');
      }
      throw new Error('Session de la console expirée — reconnectez-vous.');
    }

    throw new Error(`${res.status}: ${text}`);
  }
}

// 🔒 Read CSRF token from cookies.
// Exporté (F06) : certains appels utilisent `fetch` directement et doivent
// pouvoir poser l'en-tête eux-mêmes. Depuis F06 les routes de paiement ne sont
// plus exemptées de CSRF, un fetch brut sans en-tête reçoit donc un 403.
export function getCsrfToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrfToken') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

export async function apiRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
  }
): Promise<any> {
  const method = options?.method || "GET";
  const body = options?.body;
  
  const headers: Record<string, string> = body ? { "Content-Type": "application/json" } : {};
  
  // 🔒 Add CSRF token for unsafe methods
  const unsafeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (unsafeMethods.includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  }
  
  // 🔒 SECURE AUTH: Only cookies for super-admin routes (if applicable)
  if (url.includes('/api/super-admin')) {
    // Super-admin routes still use Authorization header for now
    const superAdminToken = localStorage.getItem("superAdminToken");
    if (superAdminToken) {
      headers["Authorization"] = `Bearer ${superAdminToken}`;
    }
  }
  // ✅ ENTERPRISE AUTH: Use ONLY secure cookies (no localStorage)
  
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include", // Send secure cookies
  });

  await throwIfResNotOk(res);
  const donnees = await res.json();
  const refus = refusDeguiseEnSucces(donnees);
  if (refus) throw new Error(refus);
  return donnees;
}

// 📎 Upload multipart (FormData) — ne pas utiliser apiRequest() qui force JSON.
export async function uploadFile(url: string, formData: FormData): Promise<any> {
  const headers: Record<string, string> = {};
  const csrfToken = getCsrfToken();
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

  const res = await fetch(url, {
    method: "POST",
    headers, // pas de Content-Type : le navigateur fixe le boundary multipart lui-même
    body: formData,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  const donnees = await res.json();
  const refus = refusDeguiseEnSucces(donnees);
  if (refus) throw new Error(refus);
  return donnees;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};
    const url = queryKey.join("/") as string;
    
    // 🔒 SECURE AUTH: Only Authorization header for super-admin routes
    if (url.includes('/api/super-admin')) {
      const superAdminToken = localStorage.getItem("superAdminToken");
      if (superAdminToken) {
        headers["Authorization"] = `Bearer ${superAdminToken}`;
      }
    }
    // ✅ ENTERPRISE AUTH: Use ONLY secure cookies (no localStorage)
    
    const res = await fetch(url, {
      headers,
      credentials: "include", // Send secure cookies
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const donnees = await res.json();
    const refus = refusDeguiseEnSucces(donnees);
    if (refus) throw new Error(refus);
    return donnees;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 0,
      gcTime: 1000 * 60 * 5, // 5 minutes
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
