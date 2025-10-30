/**
 * Navigation filtrée selon les permissions utilisateur
 */

import { usePermissions } from "@/hooks/use-permissions";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wrench,
  Package,
  Calendar,
  FileText,
  DollarSign,
  Users,
  Settings,
  AlertTriangle,
  Brain
} from "lucide-react";

const NAVIGATION_ICONS: Record<string, any> = {
  diagnostic: Brain,
  interventions: Wrench,
  equipments: Package,
  preventive: Calendar,
  planning: Calendar,
  inventory: Package,
  reports: FileText,
  budget: DollarSign,
  users: Users,
  settings: Settings,
  dashboard: LayoutDashboard,
  alerts: AlertTriangle,
};

interface NavigationItemProps {
  item: {
    key: string;
    label: string;
    accessible: boolean;
  };
  currentPath: string;
}

function NavigationItem({ item, currentPath }: NavigationItemProps) {
  const Icon = NAVIGATION_ICONS[item.key] || Package;
  const isActive = currentPath === `/${item.key}` || currentPath.startsWith(`/${item.key}/`);

  return (
    <Link href={`/${item.key}`}>
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer",
          isActive
            ? "bg-purple-600 text-white shadow-lg"
            : "text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
        )}
      >
        <Icon className={cn("h-5 w-5", isActive ? "text-white" : "text-purple-600")} />
        <span className="font-medium">{item.label}</span>
      </div>
    </Link>
  );
}

/**
 * Composant de navigation basé sur les rôles
 * Affiche uniquement les rubriques accessibles à l'utilisateur
 */
export function RoleBasedNavigation() {
  const { getAccessibleRoutes, isLoading, user } = usePermissions();
  const [currentPath] = useLocation();

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const accessibleRoutes = getAccessibleRoutes();

  return (
    <nav className="p-4 space-y-2">
      {/* Info utilisateur */}
      <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <div className="text-sm font-semibold text-purple-900 dark:text-purple-100">
          {user?.username}
        </div>
        <div className="text-xs text-purple-700 dark:text-purple-300 capitalize">
          {user?.role?.replace(/_/g, " ")}
        </div>
        {user?.department && (
          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            {user.department}
          </div>
        )}
      </div>

      {/* Navigation items */}
      <div className="space-y-1">
        {accessibleRoutes.map((item) => (
          <NavigationItem key={item.key} item={item} currentPath={currentPath} />
        ))}
      </div>

      {/* Message si pas de rubriques */}
      {accessibleRoutes.length === 0 && (
        <div className="p-4 text-center text-sm text-gray-500">
          Aucune rubrique accessible
        </div>
      )}
    </nav>
  );
}
