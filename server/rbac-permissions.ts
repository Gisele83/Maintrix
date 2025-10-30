/**
 * RBAC - Role-Based Access Control
 * Définition des permissions par rôle pour Maintrix
 */

export type UserRole =
  | "technician"          // Technicien de maintenance
  | "team_leader"         // Chef d'équipe
  | "planner"            // Planificateur
  | "maintenance_manager" // Responsable de maintenance
  | "procurement"        // Service achats/magasin
  | "technical_director" // Directeur technique
  | "admin";             // Administrateur système

export type Permission =
  // Interventions
  | "view_own_work_orders"
  | "view_team_work_orders"
  | "view_all_work_orders"
  | "create_work_orders"
  | "edit_own_work_orders"
  | "edit_team_work_orders"
  | "edit_all_work_orders"
  | "delete_work_orders"
  | "validate_work_orders"
  
  // Équipements
  | "view_equipment"
  | "create_equipment"
  | "edit_equipment"
  | "delete_equipment"
  
  // Maintenance Préventive
  | "view_preventive_maintenance"
  | "create_preventive_maintenance"
  | "edit_preventive_maintenance"
  | "delete_preventive_maintenance"
  
  // Stock & Achats
  | "view_inventory"
  | "manage_inventory"
  | "create_purchase_orders"
  | "validate_purchase_orders"
  | "view_purchase_orders"
  
  // Planification
  | "view_planning"
  | "manage_planning"
  | "view_history"
  
  // Diagnostic IA
  | "use_diagnostic_ai"
  | "view_diagnostic_history"
  
  // Rapports & KPIs
  | "view_own_reports"
  | "view_team_reports"
  | "view_all_reports"
  | "export_reports"
  
  // Budget
  | "view_budget"
  | "manage_budget"
  
  // Administration
  | "manage_users"
  | "manage_settings"
  | "view_audit_logs";

/**
 * Matrice des permissions par rôle
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // TECHNICIEN - Accès limité à ses propres interventions
  technician: [
    "view_own_work_orders",
    "edit_own_work_orders",
    "view_equipment",
    "use_diagnostic_ai",
    "view_diagnostic_history",
    "view_own_reports",
    "view_inventory", // Peut consulter le stock pour ses interventions
  ],

  // CHEF D'ÉQUIPE - Accès à son secteur/équipe
  team_leader: [
    "view_own_work_orders",
    "view_team_work_orders",
    "edit_own_work_orders",
    "edit_team_work_orders",
    "create_work_orders",
    "view_equipment",
    "create_equipment",
    "edit_equipment",
    "use_diagnostic_ai",
    "view_diagnostic_history",
    "view_own_reports",
    "view_team_reports",
    "view_inventory",
    "view_preventive_maintenance",
  ],

  // PLANIFICATEUR - Accès planification et historique
  planner: [
    "view_all_work_orders",
    "create_work_orders",
    "edit_all_work_orders",
    "view_equipment",
    "create_equipment",
    "edit_equipment",
    "view_preventive_maintenance",
    "create_preventive_maintenance",
    "edit_preventive_maintenance",
    "view_planning",
    "manage_planning",
    "view_history",
    "view_all_reports",
    "use_diagnostic_ai",
    "view_diagnostic_history",
    "view_inventory",
  ],

  // RESPONSABLE DE MAINTENANCE - Vue globale maintenance
  maintenance_manager: [
    "view_all_work_orders",
    "create_work_orders",
    "edit_all_work_orders",
    "delete_work_orders",
    "validate_work_orders",
    "view_equipment",
    "create_equipment",
    "edit_equipment",
    "delete_equipment",
    "view_preventive_maintenance",
    "create_preventive_maintenance",
    "edit_preventive_maintenance",
    "delete_preventive_maintenance",
    "view_planning",
    "manage_planning",
    "view_history",
    "use_diagnostic_ai",
    "view_diagnostic_history",
    "view_all_reports",
    "export_reports",
    "view_inventory",
    "view_purchase_orders",
    "view_budget",
  ],

  // SERVICE ACHATS/MAGASIN - Gestion stock et achats
  procurement: [
    "view_inventory",
    "manage_inventory",
    "create_purchase_orders",
    "validate_purchase_orders",
    "view_purchase_orders",
    "view_all_work_orders", // Pour connaître les besoins
    "view_equipment",
    "view_own_reports",
    "view_budget",
  ],

  // DIRECTEUR TECHNIQUE - Accès complet
  technical_director: [
    "view_all_work_orders",
    "create_work_orders",
    "edit_all_work_orders",
    "delete_work_orders",
    "validate_work_orders",
    "view_equipment",
    "create_equipment",
    "edit_equipment",
    "delete_equipment",
    "view_preventive_maintenance",
    "create_preventive_maintenance",
    "edit_preventive_maintenance",
    "delete_preventive_maintenance",
    "view_planning",
    "manage_planning",
    "view_history",
    "use_diagnostic_ai",
    "view_diagnostic_history",
    "view_all_reports",
    "export_reports",
    "view_inventory",
    "manage_inventory",
    "create_purchase_orders",
    "validate_purchase_orders",
    "view_purchase_orders",
    "view_budget",
    "manage_budget",
    "manage_users",
    "manage_settings",
    "view_audit_logs",
  ],

  // ADMIN - Accès total (super-admin tenant)
  admin: [
    "view_all_work_orders",
    "create_work_orders",
    "edit_all_work_orders",
    "delete_work_orders",
    "validate_work_orders",
    "view_equipment",
    "create_equipment",
    "edit_equipment",
    "delete_equipment",
    "view_preventive_maintenance",
    "create_preventive_maintenance",
    "edit_preventive_maintenance",
    "delete_preventive_maintenance",
    "view_planning",
    "manage_planning",
    "view_history",
    "use_diagnostic_ai",
    "view_diagnostic_history",
    "view_all_reports",
    "export_reports",
    "view_inventory",
    "manage_inventory",
    "create_purchase_orders",
    "validate_purchase_orders",
    "view_purchase_orders",
    "view_budget",
    "manage_budget",
    "manage_users",
    "manage_settings",
    "view_audit_logs",
  ],
};

/**
 * Hiérarchie des rôles (du plus bas au plus élevé)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  technician: 1,
  team_leader: 2,
  planner: 3,
  procurement: 3,
  maintenance_manager: 4,
  technical_director: 5,
  admin: 6,
};

/**
 * Vérifier si un rôle possède une permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes(permission);
}

/**
 * Vérifier si un rôle possède au moins une des permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Vérifier si un rôle possède toutes les permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Obtenir toutes les permissions d'un rôle
 */
export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Vérifier si un rôle peut accéder à une intervention selon le contexte
 */
export function canAccessWorkOrder(
  userRole: UserRole,
  userId: number,
  workOrder: {
    assignedTo?: number;
    createdBy?: number;
    sector?: string;
    department?: string;
  },
  userDepartment?: string,
  userSector?: string
): boolean {
  // Directeur technique et admin ont accès à tout
  if (userRole === "technical_director" || userRole === "admin") {
    return true;
  }

  // Responsable de maintenance a accès à tout
  if (userRole === "maintenance_manager") {
    return true;
  }

  // Planificateur a accès à tout
  if (userRole === "planner") {
    return true;
  }

  // Chef d'équipe a accès à son secteur/département
  if (userRole === "team_leader") {
    if (workOrder.department && userDepartment && workOrder.department === userDepartment) {
      return true;
    }
    if (workOrder.sector && userSector && workOrder.sector === userSector) {
      return true;
    }
  }

  // Technicien a accès uniquement à ses propres interventions
  if (userRole === "technician") {
    return workOrder.assignedTo === userId || workOrder.createdBy === userId;
  }

  return false;
}

/**
 * Filtrer les rubriques de navigation selon le rôle
 */
export interface NavigationItem {
  key: string;
  label: string;
  requiredPermissions: Permission[];
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    key: "diagnostic",
    label: "Smart Diagnostic",
    requiredPermissions: ["use_diagnostic_ai"],
  },
  {
    key: "interventions",
    label: "Interventions",
    requiredPermissions: ["view_own_work_orders"],
  },
  {
    key: "equipments",
    label: "Équipements",
    requiredPermissions: ["view_equipment"],
  },
  {
    key: "preventive",
    label: "Maintenance Préventive",
    requiredPermissions: ["view_preventive_maintenance"],
  },
  {
    key: "planning",
    label: "Planification",
    requiredPermissions: ["view_planning"],
  },
  {
    key: "inventory",
    label: "Stock & Achats",
    requiredPermissions: ["view_inventory"],
  },
  {
    key: "reports",
    label: "Rapports",
    requiredPermissions: ["view_own_reports"],
  },
  {
    key: "budget",
    label: "Budget",
    requiredPermissions: ["view_budget"],
  },
  {
    key: "users",
    label: "Utilisateurs",
    requiredPermissions: ["manage_users"],
  },
  {
    key: "settings",
    label: "Paramètres",
    requiredPermissions: ["manage_settings"],
  },
];

/**
 * Obtenir les rubriques de navigation accessibles pour un rôle
 */
export function getAccessibleNavigation(role: UserRole): NavigationItem[] {
  return NAVIGATION_ITEMS.filter(item =>
    hasAnyPermission(role, item.requiredPermissions)
  );
}
