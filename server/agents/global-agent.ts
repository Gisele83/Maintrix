import { EventEmitter } from 'events';
import { AgentType } from '../cognitive-layers/layer-contracts.js';
import { getCognitiveKernel } from '../cognitive-kernel/index.js';
import { SiteAgent } from './site-agent.js';
import { EquipmentAgent } from './equipment-agent.js';

export interface GlobalLearning {
  patternId: string;
  equipmentType: string;
  symptomPattern: string;
  rootCause: string;
  resolution: string;
  occurrences: number;
  avgConfidence: number;
  contributingSites: string[];
  lastSeen: Date;
}

export class GlobalAgent extends EventEmitter {
  private sites: Map<string, SiteAgent> = new Map();
  private globalPatterns: GlobalLearning[] = [];
  private crossSiteCorrelations: Map<string, any> = new Map();
  private learningInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    const kernel = getCognitiveKernel();
    kernel.registerAgent(AgentType.GLOBAL, 'global-learning');

    this.learningInterval = setInterval(() => this.globalLearningCycle(), 30000);
    console.log('🌐 Global Agent initialized — cross-site learning active');
  }

  registerSite(siteId: string, siteName: string, tenantId: string): SiteAgent {
    const siteAgent = new SiteAgent(siteId, siteName, tenantId);
    this.sites.set(siteId, siteAgent);
    siteAgent.initialize();
    return siteAgent;
  }

  private globalLearningCycle(): void {
    this.aggregatePatterns();
    this.detectCrossSiteCorrelations();
    this.updateGlobalKnowledge();
  }

  private aggregatePatterns(): void {
    for (const [siteId, site] of this.sites) {
      const status = site.getSiteStatus();
      for (const eq of status.equipmentHealth) {
        if (eq.healthScore < 60) {
          const existingPattern = this.globalPatterns.find(
            p => p.equipmentType === eq.type && p.symptomPattern === 'degradation'
          );

          if (existingPattern) {
            existingPattern.occurrences++;
            existingPattern.lastSeen = new Date();
            if (!existingPattern.contributingSites.includes(siteId)) {
              existingPattern.contributingSites.push(siteId);
            }
          } else {
            this.globalPatterns.push({
              patternId: `gp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
              equipmentType: eq.type,
              symptomPattern: 'degradation',
              rootCause: 'Under investigation',
              resolution: 'Preventive maintenance recommended',
              occurrences: 1,
              avgConfidence: 0.7,
              contributingSites: [siteId],
              lastSeen: new Date()
            });
          }
        }
      }
    }
  }

  private detectCrossSiteCorrelations(): void {
    const siteStatuses = Array.from(this.sites.entries()).map(([id, site]) => ({
      siteId: id,
      ...site.getSiteStatus()
    }));

    const degradedSites = siteStatuses.filter(s => s.productionStatus !== 'normal');
    if (degradedSites.length >= 2) {
      const correlationKey = degradedSites.map(s => s.siteId).sort().join('-');
      this.crossSiteCorrelations.set(correlationKey, {
        sites: degradedSites.map(s => s.siteId),
        detectedAt: new Date(),
        description: `${degradedSites.length} sites experiencing simultaneous degradation`,
        possibleCauses: ['Shared supplier issue', 'Environmental condition', 'Common equipment batch']
      });
    }
  }

  private updateGlobalKnowledge(): void {
    if (this.globalPatterns.length > 0) {
      const kernel = getCognitiveKernel();
      const nodes = this.globalPatterns.map(p => ({
        nodeId: `gp-node-${p.patternId}`,
        nodeType: 'cause' as const,
        label: `${p.equipmentType}: ${p.rootCause}`,
        properties: {
          occurrences: p.occurrences,
          sites: p.contributingSites.length,
          confidence: p.avgConfidence
        },
        tenantId: 'global'
      }));

      const edges = this.globalPatterns
        .filter(p => p.occurrences >= 2)
        .map(p => ({
          edgeId: `gp-edge-${p.patternId}`,
          sourceNodeId: `gp-node-${p.patternId}`,
          targetNodeId: `resolution-${p.patternId}`,
          relationType: 'resolves' as const,
          weight: p.avgConfidence,
          confidence: p.avgConfidence,
          occurrences: p.occurrences,
          metadata: { contributingSites: p.contributingSites }
        }));

      if (nodes.length > 0) {
        kernel.updateKnowledgeGraph(nodes, edges);
      }
    }
  }

  getGlobalStatus(): {
    siteCount: number;
    totalEquipment: number;
    globalHealthScore: number;
    patternsDiscovered: number;
    crossSiteCorrelations: number;
    sites: { siteId: string; healthScore: number; productionStatus: string; equipmentCount: number }[];
    topPatterns: GlobalLearning[];
  } {
    const siteStatuses = Array.from(this.sites.entries()).map(([id, site]) => {
      const status = site.getSiteStatus();
      return {
        siteId: id,
        healthScore: status.overallHealthScore,
        productionStatus: status.productionStatus,
        equipmentCount: status.equipmentCount
      };
    });

    const totalEquipment = siteStatuses.reduce((sum, s) => sum + s.equipmentCount, 0);
    const avgHealth = siteStatuses.length > 0
      ? Math.round(siteStatuses.reduce((sum, s) => sum + s.healthScore, 0) / siteStatuses.length)
      : 100;

    return {
      siteCount: this.sites.size,
      totalEquipment,
      globalHealthScore: avgHealth,
      patternsDiscovered: this.globalPatterns.length,
      crossSiteCorrelations: this.crossSiteCorrelations.size,
      sites: siteStatuses,
      topPatterns: this.globalPatterns
        .sort((a, b) => b.occurrences - a.occurrences)
        .slice(0, 10)
    };
  }

  getSite(siteId: string): SiteAgent | undefined {
    return this.sites.get(siteId);
  }

  /** Retrouve l'EquipmentAgent d'un équipement sans connaître son site — utilisé par
   * le Predictive Maintenance Engine unifié pour la détection d'anomalie à la demande. */
  findEquipmentAgent(equipmentId: number): EquipmentAgent | undefined {
    for (const site of this.sites.values()) {
      const agent = site.getEquipmentAgent(equipmentId);
      if (agent) return agent;
    }
    return undefined;
  }

  async shutdown(): Promise<void> {
    if (this.learningInterval) {
      clearInterval(this.learningInterval);
    }
    for (const site of this.sites.values()) {
      await site.shutdown();
    }
  }
}

let globalAgentInstance: GlobalAgent | null = null;

export function getGlobalAgent(): GlobalAgent {
  if (!globalAgentInstance) {
    globalAgentInstance = new GlobalAgent();
  }
  return globalAgentInstance;
}
