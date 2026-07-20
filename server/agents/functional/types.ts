// Deuxième dimension d'agents : spécialité fonctionnelle (métier), complémentaire
// aux agents topologiques existants (Equipment/Site/Global, server/agents/*.ts qui
// tournent en boucle réelle avec setInterval). Voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md
// section 10 — les deux dimensions coexistent : les agents topologiques collectent et
// remontent l'information, les agents fonctionnels la consomment pour raisonner par domaine.
export enum FunctionalDomain {
  DIAGNOSTIC = "diagnostic",
  PLANNING = "planning",
  RELIABILITY = "reliability",
  QHSE = "qhse",
  DOCUMENTATION = "documentation",
  PROCUREMENT = "procurement",
  KNOWLEDGE = "knowledge",
  DIGITAL_TWIN = "digital_twin",
  TRAINING = "training",
  CUSTOMER = "customer",
  ENERGY = "energy",
  SUPERVISOR = "supervisor",
}

export type AgentStatus = "nominal" | "attention" | "alert" | "not_instrumented";

export interface AgentSignal {
  label: string;
  value: number | string;
  severity: "info" | "warning" | "high" | "critical";
  detail?: string;
}

export interface FunctionalAgentAssessment {
  domain: FunctionalDomain;
  name: string;
  status: AgentStatus;
  summary: string;
  signals: AgentSignal[];
  recommendations: string[];
  computedAt: string;
}

// Un agent fonctionnel n'est pas un objet autonome à durée de vie propre (contrairement
// aux agents topologiques) : c'est une fonction de raisonnement, invoquée à la demande,
// qui interroge l'état réel du système et produit un verdict. Pas de setInterval par
// agent — le coût de recalcul en continu pour 12 domaines serait injustifié tant qu'aucun
// des 12 n'a de boucle de décision propre à faire tourner (cf. section 10 du document).
export type FunctionalAgentAssessor = (tenantId: string) => Promise<FunctionalAgentAssessment>;

export function worstSeverity(signals: AgentSignal[]): AgentStatus {
  if (signals.some((s) => s.severity === "critical")) return "alert";
  if (signals.some((s) => s.severity === "high" || s.severity === "warning")) return "attention";
  return "nominal";
}
