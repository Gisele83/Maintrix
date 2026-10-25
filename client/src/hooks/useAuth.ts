import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/**
 * Ce que `/api/enterprise-auth/profile` renvoie RÉELLEMENT.
 *
 * ⚠️ Ce type déclarait `validationLevel`, `canValidateWorkOrders` et
 * `canValidatePurchaseOrders` alors que la route ne les envoyait PAS : ils
 * valaient `undefined` à l'exécution sans que rien ne le signale. La route les
 * renvoie désormais (server/enterprise-auth-routes.ts), mais les champs restent
 * notés optionnels là où la colonne est nullable en base — un `undefined`
 * traité comme « aucun droit » est sûr, un `0` affiché comme « niveau 0 » est
 * juste.
 */
export interface User {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: string;
  department?: string;
  tenantId?: string;
  validationLevel?: number | null;
  canValidateWorkOrders?: boolean | null;
  canValidatePurchaseOrders?: boolean | null;
  /** Plafond d'approbation, en décimal sérialisé ; `null` = aucun plafond fixé. */
  maxPurchaseAmount?: string | null;
  isActive: boolean;
}

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // ✅ ENTERPRISE AUTH: Use enterprise profile endpoint and sessionToken
  // Le générique `<User>` est explicite : `apiRequest` rend `Promise<any>`,
  // donc sans lui `user` est `any` et aucun consommateur n'est averti quand il
  // lit un champ que la route n'envoie pas — exactement ce qui s'est produit
  // avec les droits de validation.
  const { data: user, isLoading: queryLoading } = useQuery<User>({
    queryKey: ["/api/enterprise-auth/profile"],
    queryFn: async () => {
      const token = localStorage.getItem("sessionToken");
      if (!token) {
        throw new Error("No session token");
      }
      return apiRequest("/api/enterprise-auth/profile");
    },
    retry: false,
    enabled: !!localStorage.getItem("sessionToken"),
  });

  useEffect(() => {
    const token = localStorage.getItem("sessionToken");
    if (!token && !queryLoading) {
      setIsLoading(false);
    } else if (token && !queryLoading) {
      setIsLoading(false);
    }
  }, [queryLoading]);

  const login = (token: string, userData: User) => {
    localStorage.setItem("sessionToken", token);
    localStorage.setItem("user_data", JSON.stringify(userData));
    queryClient.setQueryData(["/api/enterprise-auth/profile"], userData);
  };

  const logout = async () => {
    try {
      await apiRequest("/api/enterprise-auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("sessionToken");
      localStorage.removeItem("user_data");
      localStorage.removeItem("guestSession");
      queryClient.clear();
      window.location.href = "/login";
    }
  };

  // ✅ ENTERPRISE AUTH: Plus de guest session - authentification obligatoire
  const isAuthenticated = !!user && !!localStorage.getItem("sessionToken");

  return {
    user,
    isAuthenticated,
    isLoading: isLoading || queryLoading,
    login,
    logout,
  };
}