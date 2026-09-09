import { EventEmitter } from 'events';
import { AgentType } from '../cognitive-layers/layer-contracts.js';
import { getCognitiveKernel } from '../cognitive-kernel/index.js';
import { EquipmentAgent } from './equipment-agent.js';
import { registerBackgroundTask } from "../background-tasks";

export interface SiteState {
  siteId: string;
  siteName: string;
  tenantId: string;
  equipmentAgents: Map<number, EquipmentAgent>;
  overallHealthScore: number;
  activeAlerts: number;
  productionStatus: 'normal' | 'degraded' | 'critical' | 'shutdown';
  coordinationLog: CoordinationEntry[];
}

export interface CoordinationEntry {
  timestamp: Date;
  type: 'alert_correlation' | 'resource_allocation' | 'production_adjustment' | 'cascade_prevention';
  description: string;
  equipmentIds: number[];
  action: string;
}

export class SiteAgent extends EventEmitter {
  private state: SiteState;
  private taskHandle: { stop: () => Promise<void> } | null = null;

  constructor(siteId: string, siteName: string, tenantId: string) {
    super();
    this.state = {
      siteId,
      siteName,
      tenantId,
      equipmentAgents: new Map(),
      overallHealthScore: 100,
      activeAlerts: 0,
      productionStatus: 'normal',
      coordinationLog: []
    };
  }

  async initialize(): Promise<void> {
    const kernel = getCognitiveKernel();
    kernel.registerAgent(AgentType.SITE, this.state.siteId);

    // Tâche B-2 — une instance par site enregistré.
    this.taskHandle = registerBackgroundTask({
      name: `agents:site-coordination:${this.state.siteId}`,
      intervalMs: 15000,
      criticality: 'B',
      run: () => this.coordinationCycle(),
    });
  }

  registerEquipment(equipmentId: number, equipmentType: string): EquipmentAgent {
    const agent = new EquipmentAgent(equipmentId, equipmentType);
    this.state.equipmentAgents.set(equipmentId, agent);
    agent.initialize();
    return agent;
  }

  unregisterEquipment(equipmentId: number): void {
    const agent = this.state.equipmentAgents.get(equipmentId);
    if (agent) {
      agent.shutdown();
      this.state.equipmentAgents.delete(equipmentId);
    }
  }

  private coordinationCycle(): void {
    this.correlateAlerts();
    this.updateSiteHealth();
    this.detectCascadeRisks();
  }

  private correlateAlerts(): void {
    const activeAnomalies: { equipmentId: number; anomaly: any }[] = [];

    for (const [eqId, agent] of this.state.equipmentAgents) {
      const agentState = agent.getState();
      for (const anomaly of agentState.anomalyHistory) {
        if (Date.now() - new Date(anomaly.detectedAt).getTime() < 300000) {
          activeAnomalies.push({ equipmentId: eqId, anomaly });
        }
      }
    }

    this.state.activeAlerts = activeAnomalies.length;

    if (activeAnomalies.length >= 3) {
      const sensorTypes = new Set(activeAnomalies.map(a => a.anomaly.rawData?.sensorType));
      if (sensorTypes.size <= 2) {
        this.state.coordinationLog.push({
          timestamp: new Date(),
          type: 'alert_correlation',
          description: `Correlated anomaly pattern detected: ${activeAnomalies.length} equipment affected by ${Array.from(sensorTypes).join(', ')}`,
          equipmentIds: activeAnomalies.map(a => a.equipmentId),
          action: 'Investigate common root cause (power supply, ambient conditions, shared infrastructure)'
        });
      }
    }
  }

  private updateSiteHealth(): void {
    if (this.state.equipmentAgents.size === 0) {
      this.state.overallHealthScore = 100;
      this.state.productionStatus = 'normal';
      return;
    }

    let totalScore = 0;
    let criticalCount = 0;

    for (const agent of this.state.equipmentAgents.values()) {
      const agentState = agent.getState();
      totalScore += agentState.healthScore;
      if (agentState.healthScore < 30) criticalCount++;
    }

    this.state.overallHealthScore = Math.round(totalScore / this.state.equipmentAgents.size);

    if (this.state.overallHealthScore < 30 || criticalCount >= 3) {
      this.state.productionStatus = 'critical';
    } else if (this.state.overallHealthScore < 60 || criticalCount >= 1) {
      this.state.productionStatus = 'degraded';
    } else {
      this.state.productionStatus = 'normal';
    }
  }

  private detectCascadeRisks(): void {
    const degradedEquipment: number[] = [];

    for (const [eqId, agent] of this.state.equipmentAgents) {
      const agentState = agent.getState();
      if (agentState.healthScore < 50) {
        degradedEquipment.push(eqId);
      }
    }

    if (degradedEquipment.length >= 2) {
      this.state.coordinationLog.push({
        timestamp: new Date(),
        type: 'cascade_prevention',
        description: `${degradedEquipment.length} equipment units degraded — cascade failure risk`,
        equipmentIds: degradedEquipment,
        action: 'Prioritize maintenance on most critical equipment first; consider load redistribution'
      });

      if (this.state.coordinationLog.length > 100) {
        this.state.coordinationLog = this.state.coordinationLog.slice(-50);
      }
    }
  }

  getSiteStatus(): {
    siteId: string;
    siteName: string;
    tenantId: string;
    overallHealthScore: number;
    productionStatus: string;
    activeAlerts: number;
    equipmentCount: number;
    equipmentHealth: { equipmentId: number; healthScore: number; type: string }[];
    recentCoordination: CoordinationEntry[];
  } {
    const equipmentHealth: { equipmentId: number; healthScore: number; type: string }[] = [];
    for (const [eqId, agent] of this.state.equipmentAgents) {
      const agentState = agent.getState();
      equipmentHealth.push({
        equipmentId: eqId,
        healthScore: agentState.healthScore,
        type: agentState.equipmentType
      });
    }

    return {
      siteId: this.state.siteId,
      siteName: this.state.siteName,
      tenantId: this.state.tenantId,
      overallHealthScore: this.state.overallHealthScore,
      productionStatus: this.state.productionStatus,
      activeAlerts: this.state.activeAlerts,
      equipmentCount: this.state.equipmentAgents.size,
      equipmentHealth,
      recentCoordination: this.state.coordinationLog.slice(-10)
    };
  }

  getEquipmentAgent(equipmentId: number): EquipmentAgent | undefined {
    return this.state.equipmentAgents.get(equipmentId);
  }

  async shutdown(): Promise<void> {
    await this.taskHandle?.stop();
    this.taskHandle = null;
    for (const agent of this.state.equipmentAgents.values()) {
      await agent.shutdown();
    }
  }
}
