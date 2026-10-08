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
  return await res.json();
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
  return await res.json();
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
    return await res.json();
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
