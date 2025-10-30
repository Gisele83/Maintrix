/**
 * Composant pour afficher conditionnellement du contenu selon les permissions
 * Usage: <Can permission="create_work_orders">...</Can>
 */

import { ReactNode } from "react";
import { usePermissions, Permission } from "@/hooks/use-permissions";

interface CanProps {
  /** Permission requise (une seule) */
  permission?: Permission;
  /** Permissions requises (au moins une) */
  anyPermission?: Permission[];
  /** Permissions requises (toutes) */
  allPermissions?: Permission[];
  /** Contenu à afficher si autorisé */
  children: ReactNode;
  /** Contenu à afficher si non autorisé (optionnel) */
  fallback?: ReactNode;
}

/**
 * Composant Can - Affiche le contenu uniquement si l'utilisateur a les permissions requises
 */
export function Can({
  permission,
  anyPermission,
  allPermissions,
  children,
  fallback = null
}: CanProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  let isAuthorized = false;

  if (permission) {
    isAuthorized = hasPermission(permission);
  } else if (anyPermission) {
    isAuthorized = hasAnyPermission(...anyPermission);
  } else if (allPermissions) {
    isAuthorized = hasAllPermissions(...allPermissions);
  }

  return isAuthorized ? <>{children}</> : <>{fallback}</>;
}

/**
 * Composant Cannot - Affiche le contenu uniquement si l'utilisateur N'A PAS les permissions
 */
export function Cannot({
  permission,
  anyPermission,
  allPermissions,
  children,
  fallback = null
}: CanProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  let isAuthorized = false;

  if (permission) {
    isAuthorized = hasPermission(permission);
  } else if (anyPermission) {
    isAuthorized = hasAnyPermission(...anyPermission);
  } else if (allPermissions) {
    isAuthorized = hasAllPermissions(...allPermissions);
  }

  return !isAuthorized ? <>{children}</> : <>{fallback}</>;
}
