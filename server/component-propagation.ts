/**
 * Graphe de dépendances fonctionnelles à coefficients de transmission de défaut
 * — Brevet MAINTRIX-SCA-IMCA, revendications 1c et 4.
 *
 * Le jumeau comportemental d'un équipement (cf. imca-engine.ts pour le modèle
 * nominal ISD/Mahalanobis) est complété ici par un graphe de ses composants
 * élémentaires (ex. Moteur → Accouplement → Pompe → Vanne), où chaque arête
 * porte un coefficient de transmission de défaut ∈ [0,1]. Lorsqu'une anomalie
 * est détectée sur un composant source, l'intensité de surveillance à appliquer
 * aux composants avals est le produit cumulé des coefficients le long du chemin.
 */

import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  equipmentRegistry,
  equipmentDependencyTemplates,
  equipmentDependencyOverrides,
} from "@shared/schema";

export interface DependencyEdge {
  from: string;
  to: string;
  transmissionCoefficient: number; // [0,1]
}

export interface DependencyGraph {
  nodes: string[];
  edges: DependencyEdge[];
}

export interface PropagatedMonitoring {
  component: string;
  monitoringIntensity: number; // [0,1], produit cumulé des coefficients depuis la source
  hops: number;
}

/** Templates par défaut, seedés pour les types d'équipement industriels courants. */
export const DEFAULT_DEPENDENCY_TEMPLATES: Record<string, DependencyGraph> = {
  pompe_centrifuge: {
    nodes: ["Moteur", "Accouplement", "Pompe", "Vanne aval"],
    edges: [
      { from: "Moteur", to: "Accouplement", transmissionCoefficient: 0.9 },
      { from: "Accouplement", to: "Pompe", transmissionCoefficient: 0.8 },
      { from: "Pompe", to: "Vanne aval", transmissionCoefficient: 0.3 },
    ],
  },
  moteur_electrique: {
    nodes: ["Moteur", "Roulement", "Arbre de sortie"],
    edges: [
      { from: "Moteur", to: "Roulement", transmissionCoefficient: 0.7 },
      { from: "Roulement", to: "Arbre de sortie", transmissionCoefficient: 0.6 },
    ],
  },
  compresseur: {
    nodes: ["Moteur", "Vilebrequin", "Cylindre", "Circuit de refoulement"],
    edges: [
      { from: "Moteur", to: "Vilebrequin", transmissionCoefficient: 0.85 },
      { from: "Vilebrequin", to: "Cylindre", transmissionCoefficient: 0.75 },
      { from: "Cylindre", to: "Circuit de refoulement", transmissionCoefficient: 0.4 },
    ],
  },
  convoyeur: {
    nodes: ["Moteur", "Réducteur", "Tambour", "Bande"],
    edges: [
      { from: "Moteur", to: "Réducteur", transmissionCoefficient: 0.8 },
      { from: "Réducteur", to: "Tambour", transmissionCoefficient: 0.7 },
      { from: "Tambour", to: "Bande", transmissionCoefficient: 0.5 },
    ],
  },
  ventilateur: {
    nodes: ["Moteur", "Roulement", "Turbine"],
    edges: [
      { from: "Moteur", to: "Roulement", transmissionCoefficient: 0.75 },
      { from: "Roulement", to: "Turbine", transmissionCoefficient: 0.65 },
    ],
  },
};

const FALLBACK_GRAPH: DependencyGraph = { nodes: ["Équipement"], edges: [] };

function normalizeType(equipmentType: string): string {
  return equipmentType
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retirer les diacritiques (accents)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Résout le graphe de dépendances applicable à un équipement : override
 * spécifique à l'actif si présent, sinon template de son type, sinon un
 * graphe à un seul nœud (aucune propagation) pour les types non seedés.
 */
export async function getDependencyGraph(equipmentId: number): Promise<DependencyGraph> {
  const [override] = await db
    .select()
    .from(equipmentDependencyOverrides)
    .where(eq(equipmentDependencyOverrides.equipmentId, equipmentId))
    .limit(1);

  if (override) {
    return { nodes: override.nodes as string[], edges: override.edges as DependencyEdge[] };
  }

  const [equipment] = await db
    .select({ equipmentType: equipmentRegistry.equipmentType })
    .from(equipmentRegistry)
    .where(eq(equipmentRegistry.id, equipmentId))
    .limit(1);

  if (!equipment) return FALLBACK_GRAPH;

  const normalizedType = normalizeType(equipment.equipmentType);

  const [template] = await db
    .select()
    .from(equipmentDependencyTemplates)
    .where(eq(equipmentDependencyTemplates.equipmentType, normalizedType))
    .limit(1);

  if (template) {
    return { nodes: template.nodes as string[], edges: template.edges as DependencyEdge[] };
  }

  return DEFAULT_DEPENDENCY_TEMPLATES[normalizedType] ?? FALLBACK_GRAPH;
}

/**
 * Propage l'intensité de surveillance depuis un composant source en anomalie
 * vers ses composants avals, par produit cumulé des coefficients de
 * transmission le long de chaque chemin (parcours en largeur, cf. exemple
 * du brevet : Moteur →0,9→ Accouplement →0,8→ Pompe →0,3→ Vanne aval, soit
 * des intensités avales de 0,9 puis 0,72 puis ≈0,22).
 */
export async function propagateAnomalyMonitoring(
  equipmentId: number,
  sourceComponent: string
): Promise<PropagatedMonitoring[]> {
  const graph = await getDependencyGraph(equipmentId);
  const results: PropagatedMonitoring[] = [];

  const queue: { component: string; intensity: number; hops: number }[] = [
    { component: sourceComponent, intensity: 1, hops: 0 },
  ];
  const visited = new Set<string>([sourceComponent]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const outgoing = graph.edges.filter(e => e.from === current.component);

    for (const edge of outgoing) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      const intensity = current.intensity * edge.transmissionCoefficient;
      results.push({ component: edge.to, monitoringIntensity: intensity, hops: current.hops + 1 });
      queue.push({ component: edge.to, intensity, hops: current.hops + 1 });
    }
  }

  return results;
}

/**
 * Seed initial des templates par défaut en base — idempotent, ignore les
 * types déjà présents. À appeler une fois au démarrage ou via une route
 * d'administration.
 */
export async function seedDefaultDependencyTemplates(): Promise<void> {
  for (const [equipmentType, graph] of Object.entries(DEFAULT_DEPENDENCY_TEMPLATES)) {
    await db
      .insert(equipmentDependencyTemplates)
      .values({ equipmentType, nodes: graph.nodes, edges: graph.edges })
      .onConflictDoNothing({ target: equipmentDependencyTemplates.equipmentType });
  }
}
