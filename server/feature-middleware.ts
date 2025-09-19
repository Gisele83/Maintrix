/**
 * Middleware de contrôle d'accès par module ERP
 * Vérifie que le tenant a accès aux fonctionnalités demandées
 */

import { Request, Response, NextFunction } from "express";
import { featureService } from "./feature-service.js";

interface AuthenticatedRequest extends Request {
  user?: {
    tenantId: string;
    id: number;
    role: string;
    username: string;
  };
  tenantId?: string;
}

/**
 * Middleware pour vérifier l'accès aux routes frontend
 */
export function routeFeatureGuard(requiredModule?: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Si pas de module requis, laisser passer (route core)
      if (!requiredModule) {
        return next();
      }

      const tenantId = req.tenantId || req.user?.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({
          error: "TENANT_REQUIRED",
          message: "Tenant context required for module access"
        });
      }

      // Vérifier si le module est activé pour ce tenant
      const hasAccess = await featureService.isModuleEnabled(tenantId, requiredModule);
      
      if (!hasAccess) {
        return res.status(403).json({
          error: "MODULE_ACCESS_DENIED", 
          message: `Module '${requiredModule}' is not enabled for this tenant`,
          requiredModule,
          availableUpgrade: true
        });
      }

      next();
    } catch (error) {
      console.error("Route feature guard error:", error);
      res.status(500).json({
        error: "FEATURE_CHECK_FAILED",
        message: "Unable to verify module access"
      });
    }
  };
}

/**
 * Middleware pour vérifier l'accès aux endpoints API
 */
export async function apiFeatureGuard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({
        error: "TENANT_REQUIRED",
        message: "Tenant context required for API access"
      });
    }

    // Vérifier si l'endpoint API est accessible pour ce tenant
    const hasAccess = await featureService.isApiEndpointAccessible(tenantId, req.path);
    
    if (!hasAccess) {
      return res.status(403).json({
        error: "API_ACCESS_DENIED",
        message: `API endpoint '${req.path}' is not available for this tenant`,
        endpoint: req.path,
        availableUpgrade: true
      });
    }

    next();
  } catch (error) {
    console.error("API feature guard error:", error);
    res.status(500).json({
      error: "FEATURE_CHECK_FAILED",
      message: "Unable to verify API access"
    });
  }
}

/**
 * Middleware spécialisé pour les routes de configuration admin
 */
export function adminConfigGuard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Vérifier que l'utilisateur a les permissions admin
  const allowedRoles = ["admin", "owner", "Super-admin"];
  const hasPermission = req.user && allowedRoles.includes(req.user.role);
  
  if (!hasPermission) {
    return res.status(403).json({
      error: "ADMIN_ACCESS_REQUIRED",
      message: "Administrator privileges required for configuration access"
    });
  }
  
  next();
}

/**
 * Utilitaire pour vérifier l'accès depuis le code applicatif
 */
export async function checkModuleAccess(tenantId: string, moduleKey: string): Promise<boolean> {
  try {
    return await featureService.isModuleEnabled(tenantId, moduleKey);
  } catch (error) {
    console.error(`Error checking module access for ${tenantId}/${moduleKey}:`, error);
    return false;
  }
}

/**
 * Décorateur pour les contrôleurs de route nécessitant un module spécifique
 */
export function requireModule(moduleKey: string) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(req: AuthenticatedRequest, res: Response, ...args: any[]) {
      const tenantId = req.tenantId || req.user?.tenantId;
      
      if (!tenantId || !(await featureService.isModuleEnabled(tenantId, moduleKey))) {
        return res.status(403).json({
          error: "MODULE_ACCESS_DENIED",
          message: `Module '${moduleKey}' is required for this operation`,
          requiredModule: moduleKey
        });
      }
      
      return method.apply(this, [req, res, ...args]);
    };
  };
}