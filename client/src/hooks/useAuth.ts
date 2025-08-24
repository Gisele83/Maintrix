import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: string;
  department?: string;
  validationLevel: number;
  canValidateWorkOrders: boolean;
  canValidatePurchaseOrders: boolean;
  isActive: boolean;
}

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  // ✅ ENTERPRISE AUTH: Use enterprise profile endpoint and sessionToken
  const { data: user, isLoading: queryLoading } = useQuery({
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