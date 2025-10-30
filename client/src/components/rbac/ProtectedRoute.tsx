/**
 * Composant pour protéger des routes selon les permissions
 * Usage: <ProtectedRoute permission="manage_users"><UserManagement /></ProtectedRoute>
 */

import { ReactNode } from "react";
import { usePermissions, Permission } from "@/hooks/use-permissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

interface ProtectedRouteProps {
  /** Permission requise (une seule) */
  permission?: Permission;
  /** Permissions requises (au moins une) */
  anyPermission?: Permission[];
  /** Permissions requises (toutes) */
  allPermissions?: Permission[];
  /** Contenu à afficher si autorisé */
  children: ReactNode;
  /** Composant à afficher si non autorisé (optionnel) */
  fallback?: ReactNode;
}

/**
 * Composant ProtectedRoute - Protège une route complète selon les permissions
 */
export function ProtectedRoute({
  permission,
  anyPermission,
  allPermissions,
  children,
  fallback
}: ProtectedRouteProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading, user } = usePermissions();

  // Afficher un loader pendant le chargement des permissions
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  let isAuthorized = false;

  if (permission) {
    isAuthorized = hasPermission(permission);
  } else if (anyPermission) {
    isAuthorized = hasAnyPermission(...anyPermission);
  } else if (allPermissions) {
    isAuthorized = hasAllPermissions(...allPermissions);
  }

  if (!isAuthorized) {
    // Afficher le fallback personnalisé ou un message par défaut
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert className="max-w-md border-red-200 bg-red-50">
          <ShieldAlert className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-900 font-semibold">
            Accès Refusé
          </AlertTitle>
          <AlertDescription className="text-red-800">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
            <br />
            <br />
            <span className="text-sm text-red-700">
              Votre rôle actuel : <strong>{user?.role || "Inconnu"}</strong>
            </span>
            <br />
            <span className="text-sm text-red-600">
              Contactez votre administrateur si vous pensez avoir besoin d'accéder à cette fonctionnalité.
            </span>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
