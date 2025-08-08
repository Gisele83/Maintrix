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

  // Check if user is authenticated by checking token
  const { data: user, isLoading: queryLoading } = useQuery({
    queryKey: ["/api/auth/profile"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        throw new Error("No token");
      }
      return apiRequest("/api/auth/profile");
    },
    retry: false,
    enabled: !!localStorage.getItem("auth_token"),
  });

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token && !queryLoading) {
      setIsLoading(false);
    } else if (token && !queryLoading) {
      setIsLoading(false);
    }
  }, [queryLoading]);

  const login = (token: string, userData: User) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("user_data", JSON.stringify(userData));
    queryClient.setQueryData(["/api/auth/profile"], userData);
  };

  const logout = async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_data");
      queryClient.clear();
      window.location.href = "/login";
    }
  };

  const isAuthenticated = !!user && !!localStorage.getItem("auth_token");

  return {
    user,
    isAuthenticated,
    isLoading: isLoading || queryLoading,
    login,
    logout,
  };
}