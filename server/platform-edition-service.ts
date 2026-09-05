/**
 * Service de licence par capacité — 3e couche indépendante de `plan` (facturation) et
 * `licenseType` (taille client). Détermine quels domaines fonctionnels un tenant peut
 * réellement utiliser dans MAINTRIX, via tenants.platformEdition.
 *
 * Volontairement séparé de FeatureService (server/feature-service.ts) : granularité différente
 * (domaine vs module fin), modèle d'écriture différent (super-admin uniquement vs self-service
 * tenant-admin via /api/tenant/modules), et FeatureService.updateTenantConfig écrase entièrement
 * tenants.features/settings à chaque sauvegarde — y stocker quoi que ce soit lié à l'édition
 * serait silencieusement perdu à la prochaine modification de la page ERP Configuration.
 */

import { db } from "./db.js";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { DOMAIN_CATALOG, type PlatformDomain } from "./domain-catalog.js";

export interface PlatformEditionDef {
  key: string;
  displayName: string;
  description: string;
  /** Clés de DOMAIN_CATALOG incluses dans cette édition. */
  domains: string[];
  highlighted?: boolean;
}

// Mapping éditions → domaines. Proposition initiale basée sur la matrice du brouillon utilisateur
// (Maintenance Platform / Engineering Hub / AI & Multi-Agent / Digital Twin / Asset Intelligence /
// Governance & Trust) transposée sur les 8 domaines réels — à ajuster librement, c'est une simple
// constante de configuration, pas une décision figée dans le code.
//
// Clé interne "complete" pour le palier le plus large (pas "enterprise") pour éviter une 3e
// collision avec plan="enterprise" et licenseType="enterprise_l" — seul le displayName affiché
// à l'utilisateur reste "Enterprise".
export const PLATFORM_EDITIONS: PlatformEditionDef[] = [
  {
    key: "starter",
    displayName: "Starter",
    description: "Le socle GMAO — actifs et ordres de travail.",
    domains: ["actifs", "gmao"],
  },
  {
    key: "professional",
    displayName: "Professional",
    description: "+ qualité, base de connaissances, analytics.",
    domains: ["actifs", "gmao", "smm", "knowledge_hub", "analytics"],
    highlighted: true,
  },
  {
    key: "industrial_ai",
    displayName: "Industrial AI",
    description: "+ performance des actifs, jumeau numérique, IA diagnostique.",
    domains: ["actifs", "gmao", "smm", "knowledge_hub", "analytics", "apm", "digital_twin", "ia"],
  },
  {
    key: "complete",
    displayName: "Enterprise",
    description: "Toutes les capacités disponibles.",
    domains: ["actifs", "gmao", "smm", "knowledge_hub", "analytics", "apm", "digital_twin", "ia"],
  },
];

const DEFAULT_EDITION_KEY = "complete";

class PlatformEditionService {
  private cache = new Map<string, { edition: string; lastUpdated: Date }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes, même convention que FeatureService

  async getPlatformEdition(tenantId: string): Promise<string> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.lastUpdated.getTime() < this.cacheTimeout) {
      return cached.edition;
    }

    try {
      const [tenant] = await db
        .select({ platformEdition: tenants.platformEdition })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      const edition = tenant?.platformEdition && PLATFORM_EDITIONS.some(e => e.key === tenant.platformEdition)
        ? tenant.platformEdition
        : DEFAULT_EDITION_KEY;

      this.cache.set(tenantId, { edition, lastUpdated: new Date() });
      return edition;
    } catch (error) {
      console.error(`Error getting platform edition for tenant ${tenantId}:`, error);
      return DEFAULT_EDITION_KEY;
    }
  }

  async getEnabledDomains(tenantId: string): Promise<string[]> {
    const edition = await this.getPlatformEdition(tenantId);
    return this.getEditionDef(edition)?.domains
      ?? this.getEditionDef(DEFAULT_EDITION_KEY)!.domains;
  }

  async isDomainEnabled(tenantId: string, domainKey: string): Promise<boolean> {
    const domains = await this.getEnabledDomains(tenantId);
    return domains.includes(domainKey);
  }

  getEditionDef(editionKey: string): PlatformEditionDef | undefined {
    return PLATFORM_EDITIONS.find(e => e.key === editionKey);
  }

  getAllEditions(): PlatformEditionDef[] {
    return PLATFORM_EDITIONS;
  }

  getAllDomains(): PlatformDomain[] {
    return DOMAIN_CATALOG;
  }

  /** Réservé à un futur outillage super-admin — aucune route tenant-facing ne doit appeler ceci. */
  async setPlatformEdition(tenantId: string, editionKey: string): Promise<void> {
    await db.update(tenants).set({ platformEdition: editionKey, updatedAt: new Date() }).where(eq(tenants.id, tenantId));
    this.cache.delete(tenantId);
  }

  invalidateCache(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  invalidateAllCache(): void {
    this.cache.clear();
  }
}

export const platformEditionService = new PlatformEditionService();
