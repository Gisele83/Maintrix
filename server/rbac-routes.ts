/**
 * Routes API pour le contrôle d'accès basé sur les rôles (RBAC)
 */

import { Router } from "express";
import { getPermissions, getAccessibleNavigation, UserRole } from "./rbac-permissions";
import { RBACRequest } from "./rbac-middleware";

const router = Router();

/**
 * GET /api/rbac/permissions
 * Récupérer les permissions de l'utilisateur connecté
 */
router.get("/permissions", (req: RBACRequest, res) => {
  if (!req.user) {
    return res.status(401).json({
      error: "AUTHENTICATION_REQUIRED",
      message: "Authentification requise"
    });
  }

  const userRole = req.user.role as UserRole;
  const permissions = getPermissions(userRole);
  const navigation = getAccessibleNavigation(userRole);

  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: userRole,
      department: req.user.department,
      sector: req.user.sector,
    },
    permissions: permissions,
    navigation: navigation.map(item => ({
      key: item.key,
      label: item.label,
      accessible: true
    }))
  });
});

/**
 * GET /api/rbac/roles
 * Liste tous les rôles disponibles avec leurs descriptions
 */
router.get("/roles", (req: RBACRequest, res) => {
  if (!req.user) {
    return res.status(401).json({
      error: "AUTHENTICATION_REQUIRED",
      message: "Authentification requise"
    });
  }

  const roles = [
    {
      key: "technician",
      label: "Technicien",
      description: "Accès limité à ses propres interventions",
      level: 1
    },
    {
      key: "team_leader",
      label: "Chef d'Équipe",
      description: "Gestion d'une équipe ou d'un secteur",
      level: 2
    },
    {
      key: "planner",
      label: "Planificateur",
      description: "Planification et historique des interventions",
      level: 3
    },
    {
      key: "procurement",
      label: "Achats/Magasin",
      description: "Gestion du stock et des achats",
      level: 3
    },
    {
      key: "maintenance_manager",
      label: "Responsable Maintenance",
      description: "Vue globale sur toutes les activités de maintenance",
      level: 4
    },
    {
      key: "technical_director",
      label: "Directeur Technique",
      description: "Accès complet à toutes les fonctionnalités",
      level: 5
    },
    {
      key: "admin",
      label: "Administrateur",
      description: "Administration complète du système",
      level: 6
    }
  ];

  res.json({
    success: true,
    roles: roles
  });
});

/**
 * GET /api/rbac/check/:permission
 * Vérifier si l'utilisateur a une permission spécifique
 */
router.get("/check/:permission", (req: RBACRequest, res) => {
  if (!req.user) {
    return res.status(401).json({
      error: "AUTHENTICATION_REQUIRED",
      message: "Authentification requise"
    });
  }

  const { permission } = req.params;
  const userRole = req.user.role as UserRole;
  const permissions = getPermissions(userRole);
  const hasPermission = permissions.includes(permission as any);

  res.json({
    success: true,
    permission: permission,
    granted: hasPermission,
    userRole: userRole
  });
});

export default router;
