/**
 * Service de gestion des fonctionnalités ERP par tenant
 * Contrôle l'accès aux modules selon la configuration tenant
 */

import { db } from "./db.js";
import { tenants, moduleCatalog } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { ModuleCatalog, TenantModuleConfig } from "@shared/schema";

interface CachedTenantConfig {
  enabledModules: string[];
  moduleSettings: Record<string, any>;
  lastUpdated: Date;
}

export class FeatureService {
  private cache = new Map<string, CachedTenantConfig>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Vérifie si un module est activé pour un tenant
   */
  async isModuleEnabled(tenantId: string, moduleKey: string): Promise<boolean> {
    const config = await this.getTenantConfig(tenantId);
    return config.enabledModules.includes(moduleKey);
  }

  /**
   * Vérifie si une route est accessible pour un tenant
   */
  async isRouteAccessible(tenantId: string, routePath: string): Promise<boolean> {
    try {
      // Récupérer tous les modules avec leurs routes
      const modules = await db
        .select()
        .from(moduleCatalog);

      // Trouver le module qui contient cette route
      const moduleForRoute = modules.find(module => {
        const routes = Array.isArray(module.routePaths) ? module.routePaths as string[] : [];
        return routes.some(route => routePath.startsWith(route));
      });

      if (!moduleForRoute) {
        // Route non associée à un module = accessible (routes core)
        return true;
      }

      // Vérifier si le module est activé pour ce tenant
      return await this.isModuleEnabled(tenantId, moduleForRoute.key);
    } catch (error) {
      console.error("Error checking route access:", error);
      return false;
    }
  }

  /**
   * Vérifie si un endpoint API est accessible pour un tenant
   */
  async isApiEndpointAccessible(tenantId: string, apiPath: string): Promise<boolean> {
    try {
      // Récupérer tous les modules avec leurs API endpoints
      const modules = await db
        .select()
        .from(moduleCatalog);

      // Trouver le module qui contient cet endpoint
      const moduleForEndpoint = modules.find(module => {
        const endpoints = Array.isArray(module.apiEndpoints) ? module.apiEndpoints as string[] : [];
        return endpoints.some(endpoint => apiPath.startsWith(endpoint));
      });

      if (!moduleForEndpoint) {
        // Endpoint non associé à un module = accessible (endpoints core)
        return true;
      }

      // Vérifier si le module est activé pour ce tenant
      return await this.isModuleEnabled(tenantId, moduleForEndpoint.key);
    } catch (error) {
      console.error("Error checking API endpoint access:", error);
      return false;
    }
  }

  /**
   * Récupère la configuration complète d'un tenant
   */
  async getTenantConfig(tenantId: string): Promise<TenantModuleConfig> {
    // Vérifier le cache d'abord
    const cached = this.cache.get(tenantId);
    if (cached && (Date.now() - cached.lastUpdated.getTime()) < this.cacheTimeout) {
      return {
        enabledModules: cached.enabledModules,
        moduleSettings: cached.moduleSettings,
        workflows: {},
        sector: undefined
      };
    }

    try {
      // Récupérer depuis la base de données
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      // Parser la configuration depuis les champs JSONB
      const features = tenant.features as any || {};
      const settings = tenant.settings as any || {};

      const config: TenantModuleConfig = {
        enabledModules: features.enabledModules || this.getDefaultEnabledModules(),
        moduleSettings: settings.moduleSettings || {},
        workflows: settings.workflows || {},
        sector: settings.sector
      };

      // Mettre en cache
      this.cache.set(tenantId, {
        enabledModules: config.enabledModules,
        moduleSettings: config.moduleSettings,
        lastUpdated: new Date()
      });

      return config;
    } catch (error) {
      console.error(`Error getting tenant config for ${tenantId}:`, error);
      // Retourner une configuration par défaut en cas d'erreur
      return {
        enabledModules: this.getDefaultEnabledModules(),
        moduleSettings: {},
        workflows: {},
        sector: undefined
      };
    }
  }

  /**
   * Met à jour la configuration d'un tenant
   */
  async updateTenantConfig(tenantId: string, config: Partial<TenantModuleConfig>): Promise<void> {
    try {
      const currentConfig = await this.getTenantConfig(tenantId);
      
      const updatedFeatures = {
        enabledModules: config.enabledModules || currentConfig.enabledModules
      };

      const updatedSettings = {
        moduleSettings: config.moduleSettings || currentConfig.moduleSettings,
        workflows: config.workflows || currentConfig.workflows,
        sector: config.sector || currentConfig.sector
      };

      await db
        .update(tenants)
        .set({
          features: updatedFeatures,
          settings: updatedSettings,
          updatedAt: new Date()
        })
        .where(eq(tenants.id, tenantId));

      // Invalider le cache
      this.cache.delete(tenantId);
    } catch (error) {
      console.error(`Error updating tenant config for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les modules par défaut activés pour un nouveau tenant
   */
  private getDefaultEnabledModules(): string[] {
    return [
      "equipment-management",
      "work-orders", 
      "preventive-maintenance",
      "inventory-simple",
      "smart-diagnostic",
      "maintenance-dashboard"
    ];
  }

  /**
   * Invalide le cache pour un tenant (utile après mise à jour)
   */
  invalidateCache(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  /**
   * Invalide tout le cache (utile après mise à jour globale)
   */
  invalidateAllCache(): void {
    this.cache.clear();
  }

  /**
   * Récupère la liste de tous les modules disponibles
   */
  async getAvailableModules(): Promise<ModuleCatalog[]> {
    try {
      return await db
        .select()
        .from(moduleCatalog);
    } catch (error) {
      console.error("Error getting available modules:", error);
      return [];
    }
  }
}

// Instance singleton
export const featureService = new FeatureService();