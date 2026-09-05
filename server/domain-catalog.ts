// Catalogue des domaines fonctionnels de MAINTRIX — la "carte" de la plateforme composable.
//
// Séparé volontairement de `moduleCatalog` (shared/schema.ts) : moduleCatalog est librement
// activable/désactivable par tout admin tenant via /api/tenant/modules (server/routes.ts,
// gardé seulement par un contrôle de rôle, pas de licence). Un domaine ici ne doit jamais
// être pilotable par cette route — sinon un client pourrait s'auto-débloquer un domaine
// sans upgrade. Le contrôle d'accès aux domaines passe exclusivement par platform-edition-service.ts.
//
// Chaque `key` correspond exactement à un `Pillar.key` dans
// client/src/pages/maintenance-engineering-platform.tsx — ajouter un domaine ici implique
// d'ajouter le pilier correspondant côté frontend (et vice-versa).
export interface PlatformDomain {
  key: string;
  label: string;
  description: string;
  /** Documentaire uniquement — fait le pont avec les modules fins existants, jamais utilisé pour le contrôle d'accès. */
  moduleCatalogKeys: string[];
}

export const DOMAIN_CATALOG: PlatformDomain[] = [
  {
    key: "actifs",
    label: "Gestion des actifs",
    description: "Registre des équipements et cycle de vie (acquisition → exploitation → fin de vie).",
    moduleCatalogKeys: ["equipment-management"],
  },
  {
    key: "gmao",
    label: "GMAO",
    description: "Ordres de travail, planification, exécution terrain.",
    moduleCatalogKeys: ["work-orders", "preventive-maintenance", "inventory-simple", "maintenance-dashboard"],
  },
  {
    key: "apm",
    label: "APM — Asset Performance Management",
    description: "Health Score, RUL, détection d'anomalies, prédiction de panne.",
    moduleCatalogKeys: [],
  },
  {
    key: "smm",
    label: "SMM — Système de Management de Maintenance",
    description: "Procédures, audits, non-conformités, amélioration continue.",
    moduleCatalogKeys: [],
  },
  {
    key: "knowledge_hub",
    label: "Engineering Knowledge Hub",
    description: "Schémas, plans, notices, bulletins techniques, normes.",
    moduleCatalogKeys: [],
  },
  {
    key: "digital_twin",
    label: "Digital Twin",
    description: "Jumeau numérique par équipement.",
    moduleCatalogKeys: [],
  },
  {
    key: "ia",
    label: "IA",
    description: "Pipeline diagnostic hybride, assistant conversationnel.",
    moduleCatalogKeys: ["smart-diagnostic", "ensemble-ai"],
  },
  {
    key: "analytics",
    label: "Analytics",
    description: "KPIs, rapports de maintenance, tableaux de bord consolidés.",
    moduleCatalogKeys: ["maintenance-dashboard", "reporting", "advanced-reporting"],
  },
];
