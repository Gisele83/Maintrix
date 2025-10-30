/**
 * Hook React pour gérer les permissions utilisateur (RBAC)
 */

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export type Permission =
  | "view_own_work_orders"
  | "view_team_work_orders"
  | "view_all_work_orders"
  | "create_work_orders"
  | "edit_own_work_orders"
  | "edit_team_work_orders"
  | "edit_all_work_orders"
  | "delete_work_orders"
  | "validate_work_orders"
  | "view_equipment"
  | "create_equipment"
  | "edit_equipment"
  | "delete_equipment"
  | "view_preventive_maintenance"
  | "create_preventive_maintenance"
  | "edit_preventive_maintenance"
  | "delete_preventive_maintenance"
  | "view_inventory"
  | "manage_inventory"
  | "create_purchase_orders"
  | "validate_purchase_orders"
  | "view_purchase_orders"
  | "view_planning"
  | "manage_planning"
  | "view_history"
  | "use_diagnostic_ai"
  | "view_diagnostic_history"
  | "view_own_reports"
  | "view_team_reports"
  | "view_all_reports"
  | "export_reports"
  | "view_budget"
  | "manage_budget"
  | "manage_users"
  | "manage_settings"
  | "view_audit_logs";

export interface NavigationItem {
  key: string;
  label: string;
  accessible: boolean;
}

export interface UserPermissions {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    department?: string;
    sector?: string;
  };
  permissions: Permission[];
  navigation: NavigationItem[];
}

/**
 * Hook pour récupérer les permissions de l'utilisateur connecté
 */
export function usePermissions() {
  const { data, isLoading, error } = useQuery<UserPermissions>({
    queryKey: ["/api/rbac/permissions"],
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
  });

  /**
   * Vérifier si l'utilisateur a une permission spécifique
   */
  const hasPermission = (permission: Permission): boolean => {
    if (!data) return false;
    return data.permissions.includes(permission);
  };

  /**
   * Vérifier si l'utilisateur a au moins une des permissions
   */
  const hasAnyPermission = (...permissions: Permission[]): boolean => {
    if (!data) return false;
    return permissions.some(p => data.permissions.includes(p));
  };

  /**
   * Vérifier si l'utilisateur a toutes les permissions
   */
  const hasAllPermissions = (...permissions: Permission[]): boolean => {
    if (!data) return false;
    return permissions.every(p => data.permissions.includes(p));
  };

  /**
   * Vérifier si une rubrique de navigation est accessible
   */
  const canAccessRoute = (routeKey: string): boolean => {
    if (!data) return false;
    const navItem = data.navigation.find(n => n.key === routeKey);
    return navItem?.accessible || false;
  };

  /**
   * Obtenir toutes les rubriques accessibles
   */
  const getAccessibleRoutes = (): NavigationItem[] => {
    if (!data) return [];
    return data.navigation.filter(n => n.accessible);
  };

  return {
    permissions: data?.permissions || [],
    navigation: data?.navigation || [],
    user: data?.user,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,
    getAccessibleRoutes,
  };
}

/**
 * Hook pour vérifier une permission spécifique
 * Utile pour des vérifications conditionnelles simples
 */
export function useHasPermission(permission: Permission): boolean {
  const { hasPermission } = usePermissions();
  return hasPermission(permission);
}

/**
 * Hook pour obtenir le rôle de l'utilisateur
 */
export function useUserRole(): string | undefined {
  const { user } = usePermissions();
  return user?.role;
}
