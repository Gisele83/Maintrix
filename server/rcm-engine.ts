/**
 * RCM Decision Logic — Reliability Centered Maintenance
 * Arbre de décision classique (Moubray, "Reliability-Centered Maintenance II") :
 * pour un mode de défaillance donné, détermine la stratégie de maintenance applicable
 * à partir de 3 questions de conséquence + 1 question de faisabilité technique.
 * C'est de l'ingénierie déterministe, pas un modèle statistique ni de l'IA.
 */

export type RcmTaskType =
  | "condition_based" | "scheduled_restoration" | "scheduled_discard"
  | "failure_finding" | "run_to_failure" | "redesign";

export type RcmConsequenceCategory = "hidden" | "safety_environmental" | "operational" | "non_operational";

export interface RcmDecisionInput {
  evident: boolean;                    // Q1 — la panne est-elle évidente pour l'exploitant en fonctionnement normal ?
  safetyOrEnvironmental: boolean;      // Q2 — conséquence sécurité/environnement ?
  operationalImpact: boolean;          // Q3 — conséquence opérationnelle (production/qualité) ?
  conditionMonitoringPossible: boolean; // un intervalle P-F (potentiel→défaillance) est-il détectable ?
}

export interface RcmDecisionResult {
  consequenceCategory: RcmConsequenceCategory;
  recommendedTaskType: RcmTaskType;
  reasoning: string;
}

export function determineRcmStrategy(input: RcmDecisionInput): RcmDecisionResult {
  const consequenceCategory: RcmConsequenceCategory = !input.evident
    ? "hidden"
    : input.safetyOrEnvironmental
    ? "safety_environmental"
    : input.operationalImpact
    ? "operational"
    : "non_operational";

  // Panne cachée : ni l'opérateur ni un instrument ne la détecte en fonctionnement normal —
  // seul un test périodique dédié (failure-finding) peut la révéler avant qu'elle ne se combine
  // à une seconde défaillance (ex: détecteur d'incendie jamais testé).
  if (consequenceCategory === "hidden") {
    return {
      consequenceCategory,
      recommendedTaskType: "failure_finding",
      reasoning: "Panne cachée (non détectable en exploitation normale) — un test périodique de recherche de panne est requis, faute de quoi la défaillance ne serait révélée qu'en cas de sollicitation réelle (souvent en situation dégradée).",
    };
  }

  // Si un intervalle P-F exploitable existe, la maintenance conditionnelle est toujours
  // préférable (coût minimal, intervention seulement quand un signe précurseur est détecté).
  if (input.conditionMonitoringPossible) {
    return {
      consequenceCategory,
      recommendedTaskType: "condition_based",
      reasoning: "Un intervalle P-F (potentiel→défaillance) est détectable par surveillance — la maintenance conditionnelle est la stratégie RCM la plus efficiente quand elle est techniquement applicable.",
    };
  }

  if (consequenceCategory === "safety_environmental") {
    return {
      consequenceCategory,
      recommendedTaskType: "scheduled_restoration",
      reasoning: "Conséquence sécurité/environnement sans surveillance conditionnelle possible — une restauration programmée est obligatoire pour rester sous le seuil de risque acceptable ; si aucune tâche proactive n'est efficace, la reconception (redesign) devient la seule option RCM valide.",
    };
  }

  if (consequenceCategory === "operational") {
    return {
      consequenceCategory,
      recommendedTaskType: "scheduled_discard",
      reasoning: "Impact opérationnel (production/qualité) sans détection conditionnelle possible — un remplacement programmé à intervalle fixe limite l'exposition au risque de panne en service.",
    };
  }

  return {
    consequenceCategory,
    recommendedTaskType: "run_to_failure",
    reasoning: "Conséquence non-opérationnelle (coût économique de réparation uniquement) — la logique RCM standard recommande de laisser fonctionner jusqu'à défaillance : le coût de la maintenance préventive dépasserait le coût de la panne elle-même.",
  };
}
