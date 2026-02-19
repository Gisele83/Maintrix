import { EventEmitter } from 'events';
import {
  CognitiveLayerType, AutonomyLevel, AgentType, AgentStatus,
  AgentMessage, CognitiveDiagnosis, OrchestratedAction, DecisionAuditEntry,
  DecisionOutcome, ClosedLoopPhase, PolicyRule, PolicyCondition, SuggestedAction,
  RiskAssessment, LayerStatus, ModelVersion
} from '../cognitive-layers/layer-contracts.js';

export interface CognitiveAgent {
  agentId: string;
  agentType: AgentType;
  targetId: number | string;
  status: AgentStatus;
  autonomyLevel: AutonomyLevel;
  localMemory: Map<string, any>;
  modelVersions: string[];
  lastHeartbeat: Date;
  processedEvents: number;
  errors: number;
}

export class CognitiveKernel extends EventEmitter {
  private agents: Map<string, CognitiveAgent> = new Map();
  private messageQueue: AgentMessage[] = [];
  private decisionAuditLog: DecisionAuditEntry[] = [];
  private policyEngine: PolicyRule[] = [];
  private globalMemory: Map<string, any> = new Map();
  private modelRegistry: Map<string, ModelVersion> = new Map();
  private layerStatuses: Map<CognitiveLayerType, LayerStatus> = new Map();
  private closedLoopState: Map<string, ClosedLoopPhase> = new Map();
  private systemAutonomyLevel: AutonomyLevel = AutonomyLevel.ASSISTED_DIAGNOSTIC;
  private isRunning: boolean = false;
  private processInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeDefaultPolicies();
  }

  async initialize(): Promise<void> {
    console.log('🧠 Initializing Cognitive Kernel...');

    for (const layer of Object.values(CognitiveLayerType)) {
      this.layerStatuses.set(layer, {
        layer,
        healthy: true,
        activeAgents: 0,
        processedEvents: 0,
        lastActivity: new Date(),
        errors: 0,
        metrics: {}
      });
    }

    this.isRunning = true;
    this.processInterval = setInterval(() => this.processingLoop(), 5000);
    console.log('✅ Cognitive Kernel initialized — Autonomy Level:', this.systemAutonomyLevel);
  }

  registerAgent(agentType: AgentType, targetId: number | string): CognitiveAgent {
    const agentId = `${agentType}-${targetId}-${Date.now()}`;
    const agent: CognitiveAgent = {
      agentId,
      agentType,
      targetId,
      status: AgentStatus.ACTIVE,
      autonomyLevel: this.systemAutonomyLevel,
      localMemory: new Map(),
      modelVersions: [],
      lastHeartbeat: new Date(),
      processedEvents: 0,
      errors: 0
    };
    this.agents.set(agentId, agent);
    this.emit('agent:registered', agent);

    const layerType = this.getLayerForAgentType(agentType);
    const status = this.layerStatuses.get(layerType);
    if (status) {
      status.activeAgents++;
    }

    console.log(`🤖 Agent registered: ${agentId} (${agentType}) → target ${targetId}`);
    return agent;
  }

  unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = AgentStatus.OFFLINE;
      this.agents.delete(agentId);
      this.emit('agent:unregistered', agent);
    }
  }

  sendMessage(message: Omit<AgentMessage, 'messageId' | 'timestamp' | 'acknowledged'>): string {
    const fullMessage: AgentMessage = {
      ...message,
      messageId: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false
    };
    this.messageQueue.push(fullMessage);
    this.emit('message:queued', fullMessage);

    if (fullMessage.priority === 'critical') {
      this.processMessage(fullMessage);
    }

    return fullMessage.messageId;
  }

  async processClosedLoop(equipmentId: number, triggerSignal: any): Promise<{
    phase: ClosedLoopPhase;
    diagnosis?: CognitiveDiagnosis;
    action?: OrchestratedAction;
    auditEntry?: DecisionAuditEntry;
  }> {
    const loopId = `loop-${equipmentId}-${Date.now()}`;
    this.closedLoopState.set(loopId, ClosedLoopPhase.DETECTION);

    this.closedLoopState.set(loopId, ClosedLoopPhase.DETECTION);
    const anomalies = await this.detectAnomalies(equipmentId, triggerSignal);
    if (anomalies.length === 0) {
      return { phase: ClosedLoopPhase.DETECTION };
    }

    this.closedLoopState.set(loopId, ClosedLoopPhase.DIAGNOSTIC);
    const diagnosis = await this.performDiagnosis(equipmentId, anomalies);

    this.closedLoopState.set(loopId, ClosedLoopPhase.DECISION);
    const decision = await this.makeDecision(diagnosis);

    if (decision.outcome === DecisionOutcome.APPROVED || decision.outcome === DecisionOutcome.AUTO_EXECUTED) {
      this.closedLoopState.set(loopId, ClosedLoopPhase.ACTION);
      const action = await this.executeAction(diagnosis, decision);

      this.closedLoopState.set(loopId, ClosedLoopPhase.FEEDBACK);
      const auditEntry = this.createAuditEntry(diagnosis, decision, action);
      this.decisionAuditLog.push(auditEntry);

      this.closedLoopState.set(loopId, ClosedLoopPhase.LEARNING);
      await this.learnFromOutcome(diagnosis, action, auditEntry);

      return { phase: ClosedLoopPhase.LEARNING, diagnosis, action, auditEntry };
    }

    const auditEntry = this.createAuditEntry(diagnosis, decision);
    this.decisionAuditLog.push(auditEntry);
    return { phase: ClosedLoopPhase.DECISION, diagnosis, auditEntry };
  }

  private async detectAnomalies(equipmentId: number, signal: any): Promise<any[]> {
    const anomalies: any[] = [];
    const equipmentAgent = this.findAgentForEquipment(equipmentId);

    if (equipmentAgent) {
      const localAnomalies = equipmentAgent.localMemory.get('anomalies') || [];
      anomalies.push(...localAnomalies);
    }

    if (signal && signal.value !== undefined) {
      const thresholds = this.globalMemory.get(`thresholds-${equipmentId}`) || {};
      const sensorThreshold = thresholds[signal.sensorType];
      if (sensorThreshold) {
        if (signal.value > sensorThreshold.critical) {
          anomalies.push({
            anomalyId: `anomaly-${Date.now()}`,
            equipmentId,
            anomalyType: 'threshold_breach',
            severity: 'critical',
            confidence: 0.95,
            description: `${signal.sensorType} critical threshold exceeded: ${signal.value} ${signal.unit} (threshold: ${sensorThreshold.critical})`,
            rawData: signal
          });
        } else if (signal.value > sensorThreshold.warning) {
          anomalies.push({
            anomalyId: `anomaly-${Date.now()}`,
            equipmentId,
            anomalyType: 'threshold_breach',
            severity: 'high',
            confidence: 0.85,
            description: `${signal.sensorType} warning threshold exceeded: ${signal.value} ${signal.unit}`,
            rawData: signal
          });
        }
      }
    }

    return anomalies;
  }

  private async performDiagnosis(equipmentId: number, anomalies: any[]): Promise<CognitiveDiagnosis> {
    const evidenceChain = anomalies.map((a: any) => ({
      type: 'sensor_data' as const,
      source: `anomaly-detector`,
      description: a.description,
      confidence: a.confidence,
      data: a.rawData || {}
    }));

    const knowledgePath = this.queryKnowledgeGraph(equipmentId, anomalies);

    const diagnosis: CognitiveDiagnosis = {
      diagnosisId: `diag-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      equipmentId,
      anomalyIds: anomalies.map((a: any) => a.anomalyId),
      rootCause: this.inferRootCause(anomalies, knowledgePath),
      rootCauseConfidence: this.calculateConfidence(anomalies, knowledgePath),
      contributingFactors: this.identifyContributingFactors(anomalies),
      evidenceChain,
      suggestedActions: this.generateActions(anomalies, knowledgePath),
      riskAssessment: this.assessRisk(anomalies),
      knowledgeGraphPath: knowledgePath,
      autonomyLevel: this.systemAutonomyLevel,
      timestamp: new Date()
    };

    this.emit('diagnosis:completed', diagnosis);
    return diagnosis;
  }

  private async makeDecision(diagnosis: CognitiveDiagnosis): Promise<{ outcome: DecisionOutcome; reason: string }> {
    const matchingPolicies = this.evaluatePolicies(diagnosis);

    if (matchingPolicies.length === 0) {
      return { outcome: DecisionOutcome.ESCALATED, reason: 'No matching policy found — escalating to human' };
    }

    const bestPolicy = matchingPolicies.sort((a, b) => b.priority - a.priority)[0];

    if (this.systemAutonomyLevel >= AutonomyLevel.SUPERVISED_EXECUTION && !bestPolicy.requiresApproval) {
      return { outcome: DecisionOutcome.AUTO_EXECUTED, reason: `Auto-executed per policy: ${bestPolicy.name}` };
    }

    if (bestPolicy.requiresApproval) {
      return { outcome: DecisionOutcome.DEFERRED, reason: `Awaiting approval per policy: ${bestPolicy.name}` };
    }

    return { outcome: DecisionOutcome.APPROVED, reason: `Approved per policy: ${bestPolicy.name}` };
  }

  private async executeAction(diagnosis: CognitiveDiagnosis, decision: { outcome: DecisionOutcome; reason: string }): Promise<OrchestratedAction> {
    const topAction = diagnosis.suggestedActions[0];
    const action: OrchestratedAction = {
      executionId: `exec-${Date.now()}`,
      diagnosisId: diagnosis.diagnosisId,
      actionId: topAction?.actionId || 'manual',
      targetSystem: topAction?.automatable ? 'gmao' : 'manual',
      command: { type: topAction?.type, description: topAction?.description },
      autonomyLevel: this.systemAutonomyLevel,
      approvalStatus: decision.outcome,
      executedAt: new Date()
    };

    this.emit('action:executed', action);

    const equipmentAgent = this.findAgentForEquipment(diagnosis.equipmentId);
    if (equipmentAgent) {
      const history = equipmentAgent.localMemory.get('actionHistory') || [];
      history.push(action);
      equipmentAgent.localMemory.set('actionHistory', history);
    }

    return action;
  }

  private async learnFromOutcome(diagnosis: CognitiveDiagnosis, action: OrchestratedAction, audit: DecisionAuditEntry): Promise<void> {
    const learningEntry = {
      diagnosisId: diagnosis.diagnosisId,
      rootCause: diagnosis.rootCause,
      confidence: diagnosis.rootCauseConfidence,
      actionTaken: action.actionId,
      outcome: audit.outcome,
      timestamp: new Date()
    };

    const learningData = this.globalMemory.get('learningHistory') || [];
    learningData.push(learningEntry);
    this.globalMemory.set('learningHistory', learningData);

    this.broadcastToAgents({
      fromAgent: 'cognitive-kernel',
      toAgent: 'all',
      messageType: 'knowledge_update',
      payload: learningEntry,
      priority: 'normal',
      requiresAck: false
    });

    this.emit('learning:updated', learningEntry);
  }

  private inferRootCause(anomalies: any[], knowledgePath: string[]): string {
    if (knowledgePath.length > 0) {
      return `Root cause identified via knowledge graph: ${knowledgePath.join(' → ')}`;
    }
    const critical = anomalies.find((a: any) => a.severity === 'critical');
    if (critical) return critical.description;
    return anomalies.map((a: any) => a.description).join('; ');
  }

  private calculateConfidence(anomalies: any[], knowledgePath: string[]): number {
    let baseConfidence = anomalies.reduce((sum: number, a: any) => sum + (a.confidence || 0.5), 0) / anomalies.length;
    if (knowledgePath.length > 0) baseConfidence = Math.min(baseConfidence + 0.15, 1.0);
    return Math.round(baseConfidence * 100) / 100;
  }

  private identifyContributingFactors(anomalies: any[]): string[] {
    return anomalies.map((a: any) => `${a.anomalyType}: ${a.description}`);
  }

  private generateActions(anomalies: any[], _knowledgePath: string[]): SuggestedAction[] {
    const actions: SuggestedAction[] = [];
    const hasCritical = anomalies.some((a: any) => a.severity === 'critical');

    if (hasCritical) {
      actions.push({
        actionId: `action-${Date.now()}-1`,
        type: 'inspection',
        description: 'Immediate inspection required — critical anomaly detected',
        priority: 'critical',
        estimatedDuration: 60,
        requiredSkills: ['mechanical', 'diagnostic'],
        requiredParts: [],
        estimatedCost: 500,
        riskIfDelayed: 'Equipment failure within 24-48 hours',
        automatable: false,
        autonomyLevelRequired: AutonomyLevel.ASSISTED_DIAGNOSTIC
      });
    }

    actions.push({
      actionId: `action-${Date.now()}-2`,
      type: 'maintenance',
      description: 'Preventive maintenance recommended based on detected anomalies',
      priority: hasCritical ? 'high' : 'medium',
      estimatedDuration: 120,
      requiredSkills: ['mechanical'],
      requiredParts: [],
      estimatedCost: 1200,
      riskIfDelayed: 'Progressive degradation of equipment performance',
      automatable: true,
      autonomyLevelRequired: AutonomyLevel.AUTO_RECOMMENDATION
    });

    return actions;
  }

  private assessRisk(anomalies: any[]): RiskAssessment {
    const hasCritical = anomalies.some((a: any) => a.severity === 'critical');
    const hasHigh = anomalies.some((a: any) => a.severity === 'high');

    return {
      overallRisk: hasCritical ? 'critical' : hasHigh ? 'high' : 'medium',
      failureProbability: hasCritical ? 0.85 : hasHigh ? 0.55 : 0.25,
      estimatedTimeToFailure: hasCritical ? 24 : hasHigh ? 72 : 168,
      impactIfFailure: hasCritical ? 'Complete production line shutdown' : 'Reduced output and quality',
      financialImpact: hasCritical ? 50000 : hasHigh ? 15000 : 5000,
      safetyImpact: hasCritical ? 'major' : 'minor',
      environmentalImpact: 'none'
    };
  }

  private queryKnowledgeGraph(equipmentId: number, anomalies: any[]): string[] {
    const knowledgeBase = this.globalMemory.get('knowledgeGraph') || { nodes: [], edges: [] };
    const equipmentNode = knowledgeBase.nodes?.find((n: any) => n.nodeType === 'equipment' && n.properties?.equipmentId === equipmentId);
    if (!equipmentNode) return [];

    const path: string[] = [equipmentNode.label];
    for (const anomaly of anomalies) {
      const symptomNode = knowledgeBase.nodes?.find((n: any) =>
        n.nodeType === 'symptom' && anomaly.description?.toLowerCase().includes(n.label?.toLowerCase())
      );
      if (symptomNode) {
        path.push(symptomNode.label);
        const causeEdge = knowledgeBase.edges?.find((e: any) =>
          e.sourceNodeId === symptomNode.nodeId && e.relationType === 'indicates'
        );
        if (causeEdge) {
          const causeNode = knowledgeBase.nodes?.find((n: any) => n.nodeId === causeEdge.targetNodeId);
          if (causeNode) path.push(causeNode.label);
        }
      }
    }
    return path;
  }

  private evaluatePolicies(diagnosis: CognitiveDiagnosis): PolicyRule[] {
    return this.policyEngine.filter(policy => {
      if (!policy.enabled) return false;
      return policy.conditions.every(condition => {
        const value = this.resolveConditionField(diagnosis, condition.field);
        return this.evaluateCondition(value, condition);
      });
    });
  }

  private resolveConditionField(diagnosis: CognitiveDiagnosis, field: string): any {
    const fieldMap: Record<string, any> = {
      'risk.overallRisk': diagnosis.riskAssessment.overallRisk,
      'risk.failureProbability': diagnosis.riskAssessment.failureProbability,
      'risk.safetyImpact': diagnosis.riskAssessment.safetyImpact,
      'confidence': diagnosis.rootCauseConfidence,
      'autonomyLevel': diagnosis.autonomyLevel,
      'anomalyCount': diagnosis.anomalyIds.length
    };
    return fieldMap[field];
  }

  private evaluateCondition(value: any, condition: PolicyCondition): boolean {
    switch (condition.operator) {
      case 'eq': return value === condition.value;
      case 'neq': return value !== condition.value;
      case 'gt': return value > condition.value;
      case 'lt': return value < condition.value;
      case 'gte': return value >= condition.value;
      case 'lte': return value <= condition.value;
      case 'contains': return String(value).includes(String(condition.value));
      case 'in': return Array.isArray(condition.value) && condition.value.includes(value);
      default: return false;
    }
  }

  private createAuditEntry(
    diagnosis: CognitiveDiagnosis,
    decision: { outcome: DecisionOutcome; reason: string },
    action?: OrchestratedAction
  ): DecisionAuditEntry {
    return {
      auditId: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date(),
      diagnosisId: diagnosis.diagnosisId,
      decision: decision.outcome,
      autonomyLevel: this.systemAutonomyLevel,
      decisionReason: decision.reason,
      evidenceSummary: diagnosis.evidenceChain.map(e => e.description).join('; '),
      riskLevel: diagnosis.riskAssessment.overallRisk,
      policyApplied: decision.reason,
      humanOverride: false,
      outcome: action?.result,
      tenantId: 'default'
    };
  }

  private findAgentForEquipment(equipmentId: number): CognitiveAgent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.agentType === AgentType.EQUIPMENT && agent.targetId === equipmentId) {
        return agent;
      }
    }
    return undefined;
  }

  private broadcastToAgents(message: Omit<AgentMessage, 'messageId' | 'timestamp' | 'acknowledged'>): void {
    for (const agent of this.agents.values()) {
      if (agent.status === AgentStatus.ACTIVE) {
        this.sendMessage({ ...message, toAgent: agent.agentId });
      }
    }
  }

  private processingLoop(): void {
    const pendingMessages = this.messageQueue.splice(0, 10);
    for (const msg of pendingMessages) {
      this.processMessage(msg);
    }

    const now = Date.now();
    for (const agent of this.agents.values()) {
      if (now - agent.lastHeartbeat.getTime() > 60000) {
        agent.status = AgentStatus.OFFLINE;
        this.emit('agent:offline', agent);
      }
    }
  }

  private processMessage(message: AgentMessage): void {
    const targetAgent = this.agents.get(message.toAgent);
    if (targetAgent) {
      targetAgent.processedEvents++;
      targetAgent.lastHeartbeat = new Date();
    }

    const layerType = this.messageTypeToLayer(message.messageType);
    const status = this.layerStatuses.get(layerType);
    if (status) {
      status.processedEvents++;
      status.lastActivity = new Date();
    }

    message.acknowledged = true;
    this.emit(`message:${message.messageType}`, message);
  }

  private messageTypeToLayer(type: string): CognitiveLayerType {
    const mapping: Record<string, CognitiveLayerType> = {
      'sensor_update': CognitiveLayerType.PHYSICAL,
      'anomaly_alert': CognitiveLayerType.EDGE_INTELLIGENCE,
      'diagnosis_request': CognitiveLayerType.COGNITIVE_CORE,
      'diagnosis_result': CognitiveLayerType.COGNITIVE_CORE,
      'action_command': CognitiveLayerType.ORCHESTRATION,
      'feedback_report': CognitiveLayerType.LEARNING_KNOWLEDGE,
      'knowledge_update': CognitiveLayerType.LEARNING_KNOWLEDGE,
      'model_sync': CognitiveLayerType.LEARNING_KNOWLEDGE,
      'heartbeat': CognitiveLayerType.GOVERNANCE_TRUST
    };
    return mapping[type] || CognitiveLayerType.COGNITIVE_CORE;
  }

  private getLayerForAgentType(agentType: AgentType): CognitiveLayerType {
    switch (agentType) {
      case AgentType.EQUIPMENT: return CognitiveLayerType.EDGE_INTELLIGENCE;
      case AgentType.SITE: return CognitiveLayerType.ORCHESTRATION;
      case AgentType.GLOBAL: return CognitiveLayerType.LEARNING_KNOWLEDGE;
    }
  }

  private initializeDefaultPolicies(): void {
    this.policyEngine = [
      {
        policyId: 'policy-critical-safety',
        name: 'Critical Safety Response',
        description: 'Immediate escalation for safety-critical anomalies',
        conditions: [
          { field: 'risk.safetyImpact', operator: 'in', value: ['major', 'catastrophic'] }
        ],
        actions: [
          { type: 'send_alert', parameters: { urgency: 'immediate', channels: ['sms', 'email', 'push'] } },
          { type: 'escalate', parameters: { to: 'safety_officer' } }
        ],
        maxAutonomyLevel: AutonomyLevel.ASSISTED_DIAGNOSTIC,
        requiresApproval: true,
        approvalRoles: ['admin', 'safety_officer'],
        priority: 100,
        enabled: true
      },
      {
        policyId: 'policy-critical-equipment',
        name: 'Critical Equipment Failure Prevention',
        description: 'Auto-create work order for critical equipment risks',
        conditions: [
          { field: 'risk.overallRisk', operator: 'eq', value: 'critical' },
          { field: 'confidence', operator: 'gte', value: 0.8 }
        ],
        actions: [
          { type: 'create_work_order', parameters: { priority: 'critical', type: 'corrective' } },
          { type: 'send_alert', parameters: { urgency: 'high' } }
        ],
        maxAutonomyLevel: AutonomyLevel.AUTO_RECOMMENDATION,
        requiresApproval: false,
        approvalRoles: [],
        priority: 90,
        enabled: true
      },
      {
        policyId: 'policy-high-risk-maintenance',
        name: 'High Risk Maintenance Scheduling',
        description: 'Schedule preventive maintenance for high-risk situations',
        conditions: [
          { field: 'risk.overallRisk', operator: 'in', value: ['high', 'critical'] },
          { field: 'risk.failureProbability', operator: 'gt', value: 0.5 }
        ],
        actions: [
          { type: 'create_work_order', parameters: { priority: 'high', type: 'preventive' } },
          { type: 'log', parameters: { category: 'predictive_maintenance' } }
        ],
        maxAutonomyLevel: AutonomyLevel.SUPERVISED_EXECUTION,
        requiresApproval: false,
        approvalRoles: [],
        priority: 70,
        enabled: true
      },
      {
        policyId: 'policy-medium-monitoring',
        name: 'Medium Risk Enhanced Monitoring',
        description: 'Increase monitoring frequency for medium risk situations',
        conditions: [
          { field: 'risk.overallRisk', operator: 'eq', value: 'medium' }
        ],
        actions: [
          { type: 'log', parameters: { category: 'enhanced_monitoring' } },
          { type: 'send_alert', parameters: { urgency: 'normal' } }
        ],
        maxAutonomyLevel: AutonomyLevel.FULL_AUTONOMY,
        requiresApproval: false,
        approvalRoles: [],
        priority: 30,
        enabled: true
      }
    ];
  }

  setSystemAutonomyLevel(level: AutonomyLevel): void {
    const previousLevel = this.systemAutonomyLevel;
    this.systemAutonomyLevel = level;
    this.emit('autonomy:changed', { previous: previousLevel, current: level });
    console.log(`🎚️ System autonomy level changed: ${AutonomyLevel[previousLevel]} → ${AutonomyLevel[level]}`);
  }

  addPolicy(policy: PolicyRule): void {
    this.policyEngine.push(policy);
    this.emit('policy:added', policy);
  }

  removePolicy(policyId: string): void {
    this.policyEngine = this.policyEngine.filter(p => p.policyId !== policyId);
  }

  updateKnowledgeGraph(nodes: any[], edges: any[]): void {
    const currentGraph = this.globalMemory.get('knowledgeGraph') || { nodes: [], edges: [] };
    currentGraph.nodes.push(...nodes);
    currentGraph.edges.push(...edges);
    this.globalMemory.set('knowledgeGraph', currentGraph);
    this.emit('knowledge:updated', { nodesAdded: nodes.length, edgesAdded: edges.length });
  }

  registerModel(model: ModelVersion): void {
    this.modelRegistry.set(model.modelId, model);
    this.emit('model:registered', model);
  }

  getSystemStatus(): {
    isRunning: boolean;
    autonomyLevel: AutonomyLevel;
    autonomyLevelName: string;
    agents: { total: number; active: number; offline: number; byType: Record<string, number> };
    layers: LayerStatus[];
    messageQueueSize: number;
    decisionAuditCount: number;
    policyCount: number;
    modelCount: number;
    knowledgeGraph: { nodes: number; edges: number };
    globalMemoryKeys: number;
  } {
    const agentsByType: Record<string, number> = {};
    let activeCount = 0;
    let offlineCount = 0;

    for (const agent of this.agents.values()) {
      agentsByType[agent.agentType] = (agentsByType[agent.agentType] || 0) + 1;
      if (agent.status === AgentStatus.ACTIVE) activeCount++;
      if (agent.status === AgentStatus.OFFLINE) offlineCount++;
    }

    const kg = this.globalMemory.get('knowledgeGraph') || { nodes: [], edges: [] };

    return {
      isRunning: this.isRunning,
      autonomyLevel: this.systemAutonomyLevel,
      autonomyLevelName: AutonomyLevel[this.systemAutonomyLevel],
      agents: {
        total: this.agents.size,
        active: activeCount,
        offline: offlineCount,
        byType: agentsByType
      },
      layers: Array.from(this.layerStatuses.values()),
      messageQueueSize: this.messageQueue.length,
      decisionAuditCount: this.decisionAuditLog.length,
      policyCount: this.policyEngine.length,
      modelCount: this.modelRegistry.size,
      knowledgeGraph: { nodes: kg.nodes?.length || 0, edges: kg.edges?.length || 0 },
      globalMemoryKeys: this.globalMemory.size
    };
  }

  getDecisionAuditLog(limit: number = 50): DecisionAuditEntry[] {
    return this.decisionAuditLog.slice(-limit);
  }

  getPolicies(): PolicyRule[] {
    return [...this.policyEngine];
  }

  getAgents(): CognitiveAgent[] {
    return Array.from(this.agents.values()).map(a => ({
      ...a,
      localMemory: new Map()
    }));
  }

  getKnowledgeGraphStats(): { nodes: any[]; edges: any[]; nodesByType: Record<string, number>; edgesByType: Record<string, number> } {
    const kg = this.globalMemory.get('knowledgeGraph') || { nodes: [], edges: [] };
    const nodesByType: Record<string, number> = {};
    const edgesByType: Record<string, number> = {};

    for (const node of kg.nodes || []) {
      nodesByType[node.nodeType] = (nodesByType[node.nodeType] || 0) + 1;
    }
    for (const edge of kg.edges || []) {
      edgesByType[edge.relationType] = (edgesByType[edge.relationType] || 0) + 1;
    }

    return { nodes: kg.nodes || [], edges: kg.edges || [], nodesByType, edgesByType };
  }

  async simulateWhatIf(equipmentId: number, hypotheticalConditions: Record<string, any>): Promise<{
    scenarioId: string;
    failureProbability: number;
    estimatedTimeToFailure: number;
    recommendedActions: string[];
    costImplication: number;
    riskChange: string;
  }> {
    const baseRisk = this.assessRisk([{
      severity: hypotheticalConditions.severity || 'medium',
      confidence: hypotheticalConditions.confidence || 0.7
    }]);

    const tempModifier = hypotheticalConditions.temperatureIncrease ? hypotheticalConditions.temperatureIncrease * 0.02 : 0;
    const vibrationModifier = hypotheticalConditions.vibrationIncrease ? hypotheticalConditions.vibrationIncrease * 0.03 : 0;
    const ageModifier = hypotheticalConditions.additionalHours ? hypotheticalConditions.additionalHours / 10000 * 0.1 : 0;

    const adjustedProbability = Math.min(baseRisk.failureProbability + tempModifier + vibrationModifier + ageModifier, 1.0);
    const adjustedTTF = Math.max(baseRisk.estimatedTimeToFailure * (1 - tempModifier - vibrationModifier), 4);

    return {
      scenarioId: `whatif-${Date.now()}`,
      failureProbability: Math.round(adjustedProbability * 100) / 100,
      estimatedTimeToFailure: Math.round(adjustedTTF),
      recommendedActions: adjustedProbability > 0.7
        ? ['Immediate maintenance intervention', 'Reduce operational load', 'Order replacement parts']
        : ['Schedule preventive maintenance', 'Increase monitoring frequency'],
      costImplication: Math.round(adjustedProbability * baseRisk.financialImpact),
      riskChange: adjustedProbability > baseRisk.failureProbability ? 'INCREASED' : 'STABLE'
    };
  }

  async shutdown(): Promise<void> {
    this.isRunning = false;
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }

    for (const agent of this.agents.values()) {
      agent.status = AgentStatus.OFFLINE;
    }

    console.log('🧠 Cognitive Kernel shut down');
  }
}

let kernelInstance: CognitiveKernel | null = null;

export function getCognitiveKernel(): CognitiveKernel {
  if (!kernelInstance) {
    kernelInstance = new CognitiveKernel();
  }
  return kernelInstance;
}
