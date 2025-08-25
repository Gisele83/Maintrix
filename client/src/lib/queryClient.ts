import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
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
  
  // 🚀 SUPER-ADMIN AUTH: Use superAdminToken for super-admin routes
  if (url.includes('/api/super-admin')) {
    const superAdminToken = localStorage.getItem("superAdminToken");
    if (superAdminToken) {
      headers["Authorization"] = `Bearer ${superAdminToken}`;
    }
  } else {
    // ✅ ENTERPRISE AUTH: Use sessionToken for regular routes
    const token = localStorage.getItem("sessionToken");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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
    
    // 🚀 SUPER-ADMIN AUTH: Use superAdminToken for super-admin routes
    if (url.includes('/api/super-admin')) {
      const superAdminToken = localStorage.getItem("superAdminToken");
      if (superAdminToken) {
        headers["Authorization"] = `Bearer ${superAdminToken}`;
      }
    } else {
      // ✅ ENTERPRISE AUTH: Use sessionToken for regular routes
      const token = localStorage.getItem("sessionToken");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    
    const res = await fetch(url, {
      headers,
      credentials: "include",
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
