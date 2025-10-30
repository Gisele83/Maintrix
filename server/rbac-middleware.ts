/**
 * Middleware RBAC pour Maintrix
 * Contrôle d'accès basé sur les rôles et permissions
 */

import { Request, Response, NextFunction } from "express";
import {
  UserRole,
  Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessWorkOrder,
} from "./rbac-permissions";

// Interface étendue pour les requêtes authentifiées
export interface RBACRequest extends Request {
  user?: {
    id: number;
    username: string;
    email: string;
    role: UserRole;
    tenantId: string;
    department?: string;
    sector?: string;
  };
  tenantId?: string;
}

/**
 * Middleware: Vérifier qu'un utilisateur possède une permission spécifique
 */
export function requirePermission(permission: Permission) {
  return (req: RBACRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "Authentification requise"
      });
    }

    const userRole = req.user.role;
    
    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({
        error: "PERMISSION_DENIED",
        message: `Permission refusée. Rôle "${userRole}" ne possède pas la permission "${permission}"`,
        requiredPermission: permission,
        userRole: userRole
      });
    }

    next();
  };
}

/**
 * Middleware: Vérifier qu'un utilisateur possède AU MOINS UNE des permissions
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: RBACRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "Authentification requise"
      });
    }

    const userRole = req.user.role;
    
    if (!hasAnyPermission(userRole, permissions)) {
      return res.status(403).json({
        error: "PERMISSION_DENIED",
        message: `Permission refusée. Rôle "${userRole}" ne possède aucune des permissions requises`,
        requiredPermissions: permissions,
        userRole: userRole
      });
    }

    next();
  };
}

/**
 * Middleware: Vérifier qu'un utilisateur possède TOUTES les permissions
 */
export function requireAllPermissions(...permissions: Permission[]) {
  return (req: RBACRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "Authentification requise"
      });
    }

    const userRole = req.user.role;
    
    if (!hasAllPermissions(userRole, permissions)) {
      return res.status(403).json({
        error: "PERMISSION_DENIED",
        message: `Permission refusée. Rôle "${userRole}" ne possède pas toutes les permissions requises`,
        requiredPermissions: permissions,
        userRole: userRole
      });
    }

    next();
  };
}

/**
 * Middleware: Vérifier qu'un utilisateur a un des rôles autorisés
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: RBACRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "Authentification requise"
      });
    }

    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: "ROLE_NOT_AUTHORIZED",
        message: `Accès refusé. Rôle "${userRole}" non autorisé pour cette ressource`,
        allowedRoles: allowedRoles,
        userRole: userRole
      });
    }

    next();
  };
}

/**
 * Middleware: Filtrer les interventions selon les permissions de l'utilisateur
 * Ajoute un filtre SQL à la requête selon le rôle
 */
export function filterWorkOrdersByRole() {
  return (req: RBACRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "Authentification requise"
      });
    }

    const userRole = req.user.role;
    const userId = req.user.id;
    const userDepartment = req.user.department;
    const userSector = req.user.sector;

    // Ajouter des filtres selon le rôle
    switch (userRole) {
      case "technician":
        // Technicien: Uniquement ses propres interventions
        req.query.assignedTo = userId.toString();
        req.query.scope = "own";
        break;

      case "team_leader":
        // Chef d'équipe: Son département/secteur
        if (userDepartment) req.query.department = userDepartment;
        if (userSector) req.query.sector = userSector;
        req.query.scope = "team";
        break;

      case "planner":
      case "maintenance_manager":
      case "technical_director":
      case "admin":
        // Vue complète
        req.query.scope = "all";
        break;

      case "procurement":
        // Service achats: Vue lecture seule de toutes les interventions
        req.query.scope = "all";
        req.query.readonly = "true";
        break;

      default:
        return res.status(403).json({
          error: "INVALID_ROLE",
          message: "Rôle utilisateur invalide"
        });
    }

    next();
  };
}

/**
 * Middleware: Vérifier l'accès à une intervention spécifique
 * À utiliser sur les routes /:id (GET, PUT, DELETE)
 */
export function checkWorkOrderAccess(getWorkOrder: (id: number) => Promise<any>) {
  return async (req: RBACRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "Authentification requise"
      });
    }

    const workOrderId = parseInt(req.params.id);
    if (isNaN(workOrderId)) {
      return res.status(400).json({
        error: "INVALID_ID",
        message: "ID d'intervention invalide"
      });
    }

    try {
      const workOrder = await getWorkOrder(workOrderId);
      
      if (!workOrder) {
        return res.status(404).json({
          error: "WORK_ORDER_NOT_FOUND",
          message: "Intervention introuvable"
        });
      }

      // Vérifier l'accès selon le rôle et le contexte
      const hasAccess = canAccessWorkOrder(
        req.user.role,
        req.user.id,
        {
          assignedTo: workOrder.assignedTo,
          createdBy: workOrder.createdBy,
          department: workOrder.department,
          sector: workOrder.sector,
        },
        req.user.department,
        req.user.sector
      );

      if (!hasAccess) {
        return res.status(403).json({
          error: "ACCESS_DENIED",
          message: "Vous n'avez pas accès à cette intervention",
          workOrderId: workOrderId,
          userRole: req.user.role
        });
      }

      // Stocker l'intervention dans req pour éviter de la recharger
      (req as any).workOrder = workOrder;
      next();
    } catch (error) {
      console.error("Erreur vérification accès intervention:", error);
      return res.status(500).json({
        error: "ACCESS_CHECK_ERROR",
        message: "Erreur lors de la vérification des droits d'accès"
      });
    }
  };
}

/**
 * Middleware: Vérifier que l'utilisateur peut modifier une ressource
 * (doit être propriétaire OU avoir le bon rôle)
 */
export function canModifyResource(
  resourceType: "work_order" | "equipment" | "preventive_maintenance",
  getResource: (id: number) => Promise<any>
) {
  return async (req: RBACRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "Authentification requise"
      });
    }

    const resourceId = parseInt(req.params.id);
    if (isNaN(resourceId)) {
      return res.status(400).json({
        error: "INVALID_ID",
        message: "ID invalide"
      });
    }

    try {
      const resource = await getResource(resourceId);
      
      if (!resource) {
        return res.status(404).json({
          error: "RESOURCE_NOT_FOUND",
          message: "Ressource introuvable"
        });
      }

      const userRole = req.user.role;
      const userId = req.user.id;

      // Vérifier les permissions de modification
      let canModify = false;

      switch (resourceType) {
        case "work_order":
          canModify =
            hasPermission(userRole, "edit_all_work_orders") ||
            (hasPermission(userRole, "edit_own_work_orders") &&
              (resource.assignedTo === userId || resource.createdBy === userId)) ||
            (hasPermission(userRole, "edit_team_work_orders") &&
              (resource.department === req.user.department ||
                resource.sector === req.user.sector));
          break;

        case "equipment":
          canModify = hasPermission(userRole, "edit_equipment");
          break;

        case "preventive_maintenance":
          canModify = hasPermission(userRole, "edit_preventive_maintenance");
          break;
      }

      if (!canModify) {
        return res.status(403).json({
          error: "MODIFICATION_DENIED",
          message: `Vous n'avez pas le droit de modifier cette ressource`,
          resourceType: resourceType,
          userRole: userRole
        });
      }

      // Stocker la ressource dans req
      (req as any)[resourceType] = resource;
      next();
    } catch (error) {
      console.error("Erreur vérification modification:", error);
      return res.status(500).json({
        error: "MODIFICATION_CHECK_ERROR",
        message: "Erreur lors de la vérification des droits de modification"
      });
    }
  };
}

/**
 * Helper: Obtenir les permissions de l'utilisateur connecté
 */
export function getUserPermissionsMiddleware() {
  return (req: RBACRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "Authentification requise"
      });
    }

    const userRole = req.user.role;
    const permissions = require("./rbac-permissions").getPermissions(userRole);
    const navigation = require("./rbac-permissions").getAccessibleNavigation(userRole);

    res.json({
      userId: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: userRole,
      permissions: permissions,
      accessibleNavigation: navigation
    });
  };
}
