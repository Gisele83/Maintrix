import { KnowledgeNode, KnowledgeEdge } from './layer-contracts.js';
import { getCognitiveKernel } from '../cognitive-kernel/index.js';

export class IndustrialKnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: Map<string, KnowledgeEdge> = new Map();
  private adjacencyList: Map<string, string[]> = new Map();

  async initialize(): Promise<void> {
    this.buildFoundationalGraph();
    this.syncWithKernel();
    console.log(`📊 Knowledge Graph initialized: ${this.nodes.size} nodes, ${this.edges.size} edges`);
  }

  private buildFoundationalGraph(): void {
    const equipmentTypes = [
      { id: 'eq-moteur', label: 'Moteur electrique', type: 'equipment' as const },
      { id: 'eq-pompe', label: 'Pompe industrielle', type: 'equipment' as const },
      { id: 'eq-compresseur', label: 'Compresseur', type: 'equipment' as const },
      { id: 'eq-convoyeur', label: 'Convoyeur', type: 'equipment' as const },
      { id: 'eq-turbine', label: 'Turbine', type: 'equipment' as const },
      { id: 'eq-echangeur', label: 'Echangeur thermique', type: 'equipment' as const },
      { id: 'eq-vanne', label: 'Vanne industrielle', type: 'equipment' as const },
      { id: 'eq-broyeur', label: 'Broyeur', type: 'equipment' as const }
    ];

    const symptoms = [
      { id: 'sym-vibration-elevee', label: 'Vibration elevee', type: 'symptom' as const, sensors: ['vibration'] },
      { id: 'sym-surchauffe', label: 'Surchauffe', type: 'symptom' as const, sensors: ['temperature'] },
      { id: 'sym-bruit-anormal', label: 'Bruit anormal', type: 'symptom' as const, sensors: ['vibration', 'acoustic'] },
      { id: 'sym-fuite', label: 'Fuite', type: 'symptom' as const, sensors: ['pressure', 'flow'] },
      { id: 'sym-pression-anormale', label: 'Pression anormale', type: 'symptom' as const, sensors: ['pressure'] },
      { id: 'sym-courant-excessif', label: 'Courant excessif', type: 'symptom' as const, sensors: ['current'] },
      { id: 'sym-demarrage-difficile', label: 'Demarrage difficile', type: 'symptom' as const, sensors: ['current', 'speed'] },
      { id: 'sym-chute-performance', label: 'Chute de performance', type: 'symptom' as const, sensors: ['speed', 'flow', 'pressure'] },
      { id: 'sym-odeur-anormale', label: 'Odeur anormale', type: 'symptom' as const, sensors: [] },
      { id: 'sym-fumee', label: 'Fumee visible', type: 'symptom' as const, sensors: [] },
      { id: 'sym-cavitation', label: 'Cavitation', type: 'symptom' as const, sensors: ['pressure', 'vibration'] },
      { id: 'sym-desalignement', label: 'Desalignement', type: 'symptom' as const, sensors: ['vibration'] }
    ];

    const causes = [
      { id: 'cause-roulement-use', label: 'Usure roulement', type: 'cause' as const, mtbf: 8000 },
      { id: 'cause-lubrification', label: 'Defaut lubrification', type: 'cause' as const, mtbf: 4000 },
      { id: 'cause-desalignement', label: 'Desalignement arbre', type: 'cause' as const, mtbf: 12000 },
      { id: 'cause-desequilibre', label: 'Desequilibre rotatif', type: 'cause' as const, mtbf: 10000 },
      { id: 'cause-surcharge', label: 'Surcharge electrique', type: 'cause' as const, mtbf: 6000 },
      { id: 'cause-joint-defaillant', label: 'Joint defaillant', type: 'cause' as const, mtbf: 5000 },
      { id: 'cause-filtre-colmate', label: 'Filtre colmate', type: 'cause' as const, mtbf: 3000 },
      { id: 'cause-courroie-usee', label: 'Courroie usee', type: 'cause' as const, mtbf: 7000 },
      { id: 'cause-bobinage-defaut', label: 'Defaut bobinage', type: 'cause' as const, mtbf: 15000 },
      { id: 'cause-erosion-cavitation', label: 'Erosion par cavitation', type: 'cause' as const, mtbf: 9000 },
      { id: 'cause-contamination-huile', label: 'Contamination huile', type: 'cause' as const, mtbf: 4000 },
      { id: 'cause-fatigue-metal', label: 'Fatigue metallique', type: 'cause' as const, mtbf: 20000 },
      { id: 'cause-surchauffe', label: 'Surchauffe', type: 'cause' as const, mtbf: 5000 }
    ];

    const interventions = [
      { id: 'int-remplacement-roulement', label: 'Remplacement roulement', type: 'intervention' as const, duration: 120, cost: 800 },
      { id: 'int-relubrification', label: 'Relubrification', type: 'intervention' as const, duration: 30, cost: 100 },
      { id: 'int-alignement', label: 'Realignement', type: 'intervention' as const, duration: 180, cost: 500 },
      { id: 'int-equilibrage', label: 'Equilibrage dynamique', type: 'intervention' as const, duration: 240, cost: 1200 },
      { id: 'int-remplacement-joint', label: 'Remplacement joint', type: 'intervention' as const, duration: 60, cost: 200 },
      { id: 'int-remplacement-filtre', label: 'Remplacement filtre', type: 'intervention' as const, duration: 20, cost: 50 },
      { id: 'int-remplacement-courroie', label: 'Remplacement courroie', type: 'intervention' as const, duration: 90, cost: 300 },
      { id: 'int-rebobinage', label: 'Rebobinage moteur', type: 'intervention' as const, duration: 480, cost: 3000 },
      { id: 'int-vidange-huile', label: 'Vidange et remplacement huile', type: 'intervention' as const, duration: 60, cost: 250 },
      { id: 'int-inspection-complete', label: 'Inspection complete', type: 'intervention' as const, duration: 120, cost: 400 }
    ];

    const contexts = [
      { id: 'ctx-haute-temp-ambiante', label: 'Haute temperature ambiante', type: 'context' as const },
      { id: 'ctx-environnement-poussiereux', label: 'Environnement poussiereux', type: 'context' as const },
      { id: 'ctx-surcharge-production', label: 'Surcharge de production', type: 'context' as const },
      { id: 'ctx-maintenance-retardee', label: 'Maintenance retardee', type: 'context' as const },
      { id: 'ctx-pieces-non-oem', label: 'Pieces non-OEM utilisees', type: 'context' as const },
      { id: 'ctx-instabilite-electrique', label: 'Instabilite electrique', type: 'context' as const }
    ];

    for (const eq of equipmentTypes) {
      this.addNode({ nodeId: eq.id, nodeType: eq.type, label: eq.label, properties: {}, tenantId: 'global' });
    }
    for (const sym of symptoms) {
      this.addNode({ nodeId: sym.id, nodeType: sym.type, label: sym.label, properties: { sensors: sym.sensors }, tenantId: 'global' });
    }
    for (const cause of causes) {
      this.addNode({ nodeId: cause.id, nodeType: cause.type, label: cause.label, properties: { mtbf: cause.mtbf }, tenantId: 'global' });
    }
    for (const intv of interventions) {
      this.addNode({ nodeId: intv.id, nodeType: intv.type, label: intv.label, properties: { duration: intv.duration, cost: intv.cost }, tenantId: 'global' });
    }
    for (const ctx of contexts) {
      this.addNode({ nodeId: ctx.id, nodeType: ctx.type, label: ctx.label, properties: {}, tenantId: 'global' });
    }

    const relationships: { source: string; target: string; type: KnowledgeEdge['relationType']; weight: number }[] = [
      { source: 'sym-vibration-elevee', target: 'cause-roulement-use', type: 'indicates', weight: 0.85 },
      { source: 'sym-vibration-elevee', target: 'cause-desalignement', type: 'indicates', weight: 0.75 },
      { source: 'sym-vibration-elevee', target: 'cause-desequilibre', type: 'indicates', weight: 0.70 },
      { source: 'sym-surchauffe', target: 'cause-lubrification', type: 'indicates', weight: 0.80 },
      { source: 'sym-surchauffe', target: 'cause-surcharge', type: 'indicates', weight: 0.65 },
      { source: 'sym-surchauffe', target: 'cause-roulement-use', type: 'indicates', weight: 0.60 },
      { source: 'sym-bruit-anormal', target: 'cause-roulement-use', type: 'indicates', weight: 0.90 },
      { source: 'sym-bruit-anormal', target: 'cause-desalignement', type: 'indicates', weight: 0.65 },
      { source: 'sym-fuite', target: 'cause-joint-defaillant', type: 'indicates', weight: 0.90 },
      { source: 'sym-pression-anormale', target: 'cause-filtre-colmate', type: 'indicates', weight: 0.75 },
      { source: 'sym-courant-excessif', target: 'cause-surcharge', type: 'indicates', weight: 0.85 },
      { source: 'sym-courant-excessif', target: 'cause-bobinage-defaut', type: 'indicates', weight: 0.70 },
      { source: 'sym-demarrage-difficile', target: 'cause-bobinage-defaut', type: 'indicates', weight: 0.80 },
      { source: 'sym-chute-performance', target: 'cause-courroie-usee', type: 'indicates', weight: 0.65 },
      { source: 'sym-chute-performance', target: 'cause-filtre-colmate', type: 'indicates', weight: 0.60 },
      { source: 'sym-cavitation', target: 'cause-erosion-cavitation', type: 'indicates', weight: 0.95 },
      { source: 'sym-desalignement', target: 'cause-desalignement', type: 'indicates', weight: 0.95 },
      { source: 'sym-surchauffe', target: 'cause-surchauffe', type: 'indicates', weight: 0.55 },

      { source: 'cause-roulement-use', target: 'int-remplacement-roulement', type: 'resolves', weight: 0.95 },
      { source: 'cause-lubrification', target: 'int-relubrification', type: 'resolves', weight: 0.90 },
      { source: 'cause-desalignement', target: 'int-alignement', type: 'resolves', weight: 0.95 },
      { source: 'cause-desequilibre', target: 'int-equilibrage', type: 'resolves', weight: 0.90 },
      { source: 'cause-joint-defaillant', target: 'int-remplacement-joint', type: 'resolves', weight: 0.95 },
      { source: 'cause-filtre-colmate', target: 'int-remplacement-filtre', type: 'resolves', weight: 0.95 },
      { source: 'cause-courroie-usee', target: 'int-remplacement-courroie', type: 'resolves', weight: 0.90 },
      { source: 'cause-bobinage-defaut', target: 'int-rebobinage', type: 'resolves', weight: 0.85 },
      { source: 'cause-contamination-huile', target: 'int-vidange-huile', type: 'resolves', weight: 0.90 },
      { source: 'cause-erosion-cavitation', target: 'int-inspection-complete', type: 'resolves', weight: 0.70 },
      { source: 'cause-surchauffe', target: 'int-inspection-complete', type: 'resolves', weight: 0.70 },

      { source: 'eq-moteur', target: 'sym-vibration-elevee', type: 'affects', weight: 0.80 },
      { source: 'eq-moteur', target: 'sym-surchauffe', type: 'affects', weight: 0.85 },
      { source: 'eq-moteur', target: 'sym-courant-excessif', type: 'affects', weight: 0.75 },
      { source: 'eq-pompe', target: 'sym-fuite', type: 'affects', weight: 0.80 },
      { source: 'eq-pompe', target: 'sym-cavitation', type: 'affects', weight: 0.85 },
      { source: 'eq-pompe', target: 'sym-pression-anormale', type: 'affects', weight: 0.80 },
      { source: 'eq-compresseur', target: 'sym-pression-anormale', type: 'affects', weight: 0.85 },
      { source: 'eq-compresseur', target: 'sym-surchauffe', type: 'affects', weight: 0.75 },
      { source: 'eq-convoyeur', target: 'sym-vibration-elevee', type: 'affects', weight: 0.70 },
      { source: 'eq-convoyeur', target: 'sym-chute-performance', type: 'affects', weight: 0.80 },
      { source: 'eq-turbine', target: 'sym-vibration-elevee', type: 'affects', weight: 0.90 },
      { source: 'eq-turbine', target: 'sym-surchauffe', type: 'affects', weight: 0.80 },

      { source: 'ctx-haute-temp-ambiante', target: 'cause-surchauffe', type: 'correlates_with', weight: 0.70 },
      { source: 'ctx-environnement-poussiereux', target: 'cause-filtre-colmate', type: 'correlates_with', weight: 0.80 },
      { source: 'ctx-surcharge-production', target: 'cause-surcharge', type: 'correlates_with', weight: 0.75 },
      { source: 'ctx-maintenance-retardee', target: 'cause-lubrification', type: 'correlates_with', weight: 0.85 },
      { source: 'ctx-instabilite-electrique', target: 'cause-bobinage-defaut', type: 'correlates_with', weight: 0.70 },

      { source: 'cause-roulement-use', target: 'cause-desalignement', type: 'causes', weight: 0.40 },
      { source: 'cause-lubrification', target: 'cause-roulement-use', type: 'causes', weight: 0.60 },
      { source: 'cause-surcharge', target: 'cause-surchauffe', type: 'causes', weight: 0.55 },
      { source: 'cause-contamination-huile', target: 'cause-roulement-use', type: 'causes', weight: 0.50 }
    ];

    for (const rel of relationships) {
      if (this.nodes.has(rel.source) && this.nodes.has(rel.target)) {
        this.addEdge({
          edgeId: `edge-${rel.source}-${rel.target}`,
          sourceNodeId: rel.source,
          targetNodeId: rel.target,
          relationType: rel.type,
          weight: rel.weight,
          confidence: rel.weight,
          occurrences: 1,
          metadata: {}
        });
      }
    }
  }

  addNode(node: KnowledgeNode): void {
    this.nodes.set(node.nodeId, node);
    if (!this.adjacencyList.has(node.nodeId)) {
      this.adjacencyList.set(node.nodeId, []);
    }
  }

  addEdge(edge: KnowledgeEdge): void {
    this.edges.set(edge.edgeId, edge);
    const adj = this.adjacencyList.get(edge.sourceNodeId) || [];
    adj.push(edge.targetNodeId);
    this.adjacencyList.set(edge.sourceNodeId, adj);
  }

  findCausalPath(symptomId: string): { path: KnowledgeNode[]; edges: KnowledgeEdge[]; totalConfidence: number }[] {
    const paths: { path: KnowledgeNode[]; edges: KnowledgeEdge[]; totalConfidence: number }[] = [];
    const symptomNode = this.nodes.get(symptomId);
    if (!symptomNode) return paths;

    const indicatesEdges = Array.from(this.edges.values()).filter(
      e => e.sourceNodeId === symptomId && e.relationType === 'indicates'
    );

    for (const edge of indicatesEdges) {
      const causeNode = this.nodes.get(edge.targetNodeId);
      if (!causeNode) continue;

      const resolvesEdges = Array.from(this.edges.values()).filter(
        e => e.sourceNodeId === edge.targetNodeId && e.relationType === 'resolves'
      );

      for (const resolveEdge of resolvesEdges) {
        const interventionNode = this.nodes.get(resolveEdge.targetNodeId);
        if (!interventionNode) continue;

        paths.push({
          path: [symptomNode, causeNode, interventionNode],
          edges: [edge, resolveEdge],
          totalConfidence: edge.confidence * resolveEdge.confidence
        });
      }
    }

    return paths.sort((a, b) => b.totalConfidence - a.totalConfidence);
  }

  findRelatedSymptoms(equipmentType: string): { symptom: KnowledgeNode; weight: number }[] {
    const equipmentNode = Array.from(this.nodes.values()).find(
      n => n.nodeType === 'equipment' && n.label.toLowerCase().includes(equipmentType.toLowerCase())
    );
    if (!equipmentNode) return [];

    const affectsEdges = Array.from(this.edges.values()).filter(
      e => e.sourceNodeId === equipmentNode.nodeId && e.relationType === 'affects'
    );

    return affectsEdges
      .map(edge => {
        const symptomNode = this.nodes.get(edge.targetNodeId);
        return symptomNode ? { symptom: symptomNode, weight: edge.weight } : null;
      })
      .filter((r): r is { symptom: KnowledgeNode; weight: number } => r !== null)
      .sort((a, b) => b.weight - a.weight);
  }

  findContextualFactors(causeId: string): { context: KnowledgeNode; correlation: number }[] {
    const correlationEdges = Array.from(this.edges.values()).filter(
      e => e.targetNodeId === causeId && e.relationType === 'correlates_with'
    );

    return correlationEdges
      .map(edge => {
        const contextNode = this.nodes.get(edge.sourceNodeId);
        return contextNode ? { context: contextNode, correlation: edge.weight } : null;
      })
      .filter((r): r is { context: KnowledgeNode; correlation: number } => r !== null);
  }

  findCascadeEffects(causeId: string, depth: number = 3): { cause: KnowledgeNode; probability: number; level: number }[] {
    const effects: { cause: KnowledgeNode; probability: number; level: number }[] = [];
    const visited = new Set<string>();

    const traverse = (nodeId: string, currentProbability: number, level: number) => {
      if (level > depth || visited.has(nodeId)) return;
      visited.add(nodeId);

      const causesEdges = Array.from(this.edges.values()).filter(
        e => e.sourceNodeId === nodeId && e.relationType === 'causes'
      );

      for (const edge of causesEdges) {
        const effectNode = this.nodes.get(edge.targetNodeId);
        if (effectNode) {
          const probability = currentProbability * edge.weight;
          effects.push({ cause: effectNode, probability, level });
          traverse(edge.targetNodeId, probability, level + 1);
        }
      }
    };

    traverse(causeId, 1.0, 1);
    return effects.sort((a, b) => b.probability - a.probability);
  }

  reasonFromSymptoms(symptomLabels: string[], equipmentType?: string): {
    diagnosis: { cause: string; confidence: number; evidence: string[] }[];
    recommendedActions: { action: string; priority: string; cost: number; duration: number }[];
    cascadeRisks: { effect: string; probability: number }[];
    contextualFactors: { context: string; relevance: number }[];
  } {
    const matchedSymptoms = symptomLabels.flatMap(label => {
      const lowerLabel = label.toLowerCase();
      return Array.from(this.nodes.values()).filter(
        n => n.nodeType === 'symptom' && n.label.toLowerCase().includes(lowerLabel)
      );
    });

    const causeScores: Map<string, { confidence: number; baseConfidence: number; symptomCount: number; evidence: string[] }> = new Map();
    const actionSet: Map<string, { action: string; priority: string; cost: number; duration: number }> = new Map();
    const cascadeRisks: { effect: string; probability: number }[] = [];
    const contextualFactors: { context: string; relevance: number }[] = [];

    for (const symptom of matchedSymptoms) {
      const paths = this.findCausalPath(symptom.nodeId);
      for (const path of paths) {
        const causeNode = path.path[1];
        const interventionNode = path.path[2];
        // Poids brut "indicates" (symptôme → cause), distinct de la confiance de chemin
        // (qui inclut aussi le poids "resolves") — c'est ce poids que renforce la règle
        // de convergence multi-symptômes du Brevet N°1, §5.4.3.
        const indicatesConfidence = path.edges[0].confidence;

        const existing = causeScores.get(causeNode.nodeId);
        if (existing) {
          existing.symptomCount += 1;
          existing.baseConfidence = Math.max(existing.baseConfidence, indicatesConfidence);
          // Renforcement croisé multi-symptômes : confiance(c) := min(1,0 ; confiance(c) × (1 + 0,30 × (k − 1)))
          existing.confidence = Math.min(existing.baseConfidence * (1 + 0.30 * (existing.symptomCount - 1)), 1.0);
          existing.evidence.push(`Symptom "${symptom.label}" indicates this cause (${(indicatesConfidence * 100).toFixed(0)}%)`);
        } else {
          causeScores.set(causeNode.nodeId, {
            confidence: indicatesConfidence,
            baseConfidence: indicatesConfidence,
            symptomCount: 1,
            evidence: [`Symptom "${symptom.label}" indicates this cause (${(indicatesConfidence * 100).toFixed(0)}%)`]
          });
        }

        if (!actionSet.has(interventionNode.nodeId)) {
          actionSet.set(interventionNode.nodeId, {
            action: interventionNode.label,
            priority: path.totalConfidence > 0.8 ? 'high' : path.totalConfidence > 0.5 ? 'medium' : 'low',
            cost: interventionNode.properties.cost || 0,
            duration: interventionNode.properties.duration || 0
          });
        }

        const cascades = this.findCascadeEffects(causeNode.nodeId);
        for (const cascade of cascades) {
          cascadeRisks.push({ effect: cascade.cause.label, probability: cascade.probability });
        }

        const contexts = this.findContextualFactors(causeNode.nodeId);
        for (const ctx of contexts) {
          contextualFactors.push({ context: ctx.context.label, relevance: ctx.correlation });
        }
      }
    }

    return {
      diagnosis: Array.from(causeScores.entries())
        .map(([nodeId, data]) => ({
          cause: this.nodes.get(nodeId)?.label || nodeId,
          confidence: Math.round(data.confidence * 100) / 100,
          evidence: data.evidence
        }))
        .sort((a, b) => b.confidence - a.confidence),
      recommendedActions: Array.from(actionSet.values())
        .sort((a, b) => {
          const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        }),
      cascadeRisks: cascadeRisks.filter((v, i, a) => a.findIndex(t => t.effect === v.effect) === i),
      contextualFactors: contextualFactors.filter((v, i, a) => a.findIndex(t => t.context === v.context) === i)
    };
  }

  private syncWithKernel(): void {
    const kernel = getCognitiveKernel();
    kernel.updateKnowledgeGraph(
      Array.from(this.nodes.values()),
      Array.from(this.edges.values())
    );
  }

  learnFromIntervention(symptomLabels: string[], causeLabel: string, interventionLabel: string, success: boolean): void {
    const symptomNodes = symptomLabels.map(label =>
      Array.from(this.nodes.values()).find(n => n.nodeType === 'symptom' && n.label.toLowerCase().includes(label.toLowerCase()))
    ).filter(Boolean);

    const causeNode = Array.from(this.nodes.values()).find(n => n.nodeType === 'cause' && n.label.toLowerCase().includes(causeLabel.toLowerCase()));
    const interventionNode = Array.from(this.nodes.values()).find(n => n.nodeType === 'intervention' && n.label.toLowerCase().includes(interventionLabel.toLowerCase()));

    if (causeNode && interventionNode) {
      for (const symptom of symptomNodes) {
        if (!symptom) continue;
        const edge = Array.from(this.edges.values()).find(
          e => e.sourceNodeId === symptom.nodeId && e.targetNodeId === causeNode.nodeId
        );
        if (edge) {
          edge.occurrences++;
          if (success) {
            edge.confidence = Math.min(edge.confidence + 0.02, 1.0);
          } else {
            edge.confidence = Math.max(edge.confidence - 0.05, 0.1);
          }
        }
      }

      const resolveEdge = Array.from(this.edges.values()).find(
        e => e.sourceNodeId === causeNode.nodeId && e.targetNodeId === interventionNode.nodeId
      );
      if (resolveEdge) {
        resolveEdge.occurrences++;
        if (success) {
          resolveEdge.confidence = Math.min(resolveEdge.confidence + 0.03, 1.0);
        } else {
          resolveEdge.confidence = Math.max(resolveEdge.confidence - 0.05, 0.1);
        }
      }
    }

    this.syncWithKernel();
  }

  getStats(): {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    edgesByType: Record<string, number>;
    avgConfidence: number;
    mostConnectedNodes: { label: string; connections: number }[];
  } {
    const nodesByType: Record<string, number> = {};
    const edgesByType: Record<string, number> = {};
    let totalConfidence = 0;

    for (const node of this.nodes.values()) {
      nodesByType[node.nodeType] = (nodesByType[node.nodeType] || 0) + 1;
    }
    for (const edge of this.edges.values()) {
      edgesByType[edge.relationType] = (edgesByType[edge.relationType] || 0) + 1;
      totalConfidence += edge.confidence;
    }

    const connectionCounts: { label: string; connections: number }[] = [];
    for (const [nodeId, neighbors] of this.adjacencyList) {
      const node = this.nodes.get(nodeId);
      if (node) {
        connectionCounts.push({ label: node.label, connections: neighbors.length });
      }
    }
    connectionCounts.sort((a, b) => b.connections - a.connections);

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      nodesByType,
      edgesByType,
      avgConfidence: this.edges.size > 0 ? Math.round((totalConfidence / this.edges.size) * 100) / 100 : 0,
      mostConnectedNodes: connectionCounts.slice(0, 10)
    };
  }

  getFullGraph(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values())
    };
  }
}

let knowledgeGraphInstance: IndustrialKnowledgeGraph | null = null;

export function getKnowledgeGraph(): IndustrialKnowledgeGraph {
  if (!knowledgeGraphInstance) {
    knowledgeGraphInstance = new IndustrialKnowledgeGraph();
  }
  return knowledgeGraphInstance;
}
