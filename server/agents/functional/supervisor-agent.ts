import { FUNCTIONAL_AGENTS } from "./functional-agents";
import { FunctionalDomain, type FunctionalAgentAssessment } from "./types";

export interface SupervisorArbitration {
  computedAt: string;
  agents: FunctionalAgentAssessment[];
  domainsInAlert: FunctionalDomain[];
  domainsNeedingAttention: FunctionalDomain[];
  priorities: { domain: FunctionalDomain; agentName: string; reason: string; recommendation: string }[];
}

const severityRank: Record<FunctionalAgentAssessment["status"], number> = {
  alert: 3,
  attention: 2,
  not_instrumented: 1,
  nominal: 0,
};

// Évolution du rôle aujourd'hui tenu par cognitive-kernel/index.ts (registerAgent /
// processingLoop / policyEngine, portée topologique Equipment-Site-Global) : ici
// l'arbitrage porte sur la dimension fonctionnelle (les 11 domaines métier), pas sur les
// remontées capteur. Les deux orchestrateurs coexistent — voir section 10 du document
// d'architecture cible — celui-ci ne remplace pas le kernel, il consomme ses agents pairs.
export async function runSupervisorArbitration(tenantId: string): Promise<SupervisorArbitration> {
  const agents = await Promise.all(FUNCTIONAL_AGENTS.map((a) => a.assess(tenantId)));

  const sorted = [...agents].sort((a, b) => severityRank[b.status] - severityRank[a.status]);

  const priorities = sorted
    .filter((a) => a.status === "alert" || a.status === "attention")
    .slice(0, 5)
    .map((a) => ({
      domain: a.domain,
      agentName: a.name,
      reason: a.summary,
      recommendation: a.recommendations[0] ?? "Examiner ce domaine",
    }));

  return {
    computedAt: new Date().toISOString(),
    agents,
    domainsInAlert: agents.filter((a) => a.status === "alert").map((a) => a.domain),
    domainsNeedingAttention: agents.filter((a) => a.status === "attention").map((a) => a.domain),
    priorities,
  };
}
