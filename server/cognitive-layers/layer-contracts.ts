export enum CognitiveLayerType {
  PHYSICAL = 'physical',
  EDGE_INTELLIGENCE = 'edge-intelligence',
  COGNITIVE_CORE = 'cognitive-core',
  ORCHESTRATION = 'orchestration-execution',
  LEARNING_KNOWLEDGE = 'learning-knowledge',
  GOVERNANCE_TRUST = 'governance-trust'
}

export enum AutonomyLevel {
  MONITORING = 0,
  ASSISTED_DIAGNOSTIC = 1,
  AUTO_RECOMMENDATION = 2,
  SUPERVISED_EXECUTION = 3,
  PARTIAL_AUTONOMY = 4,
  FULL_AUTONOMY = 5
}

export enum DecisionOutcome {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ESCALATED = 'escalated',
  DEFERRED = 'deferred',
  AUTO_EXECUTED = 'auto-executed'
}

export enum AgentType {
  EQUIPMENT = 'equipment',
  SITE = 'site',
  GLOBAL = 'global'
}

export enum AgentStatus {
  ACTIVE = 'active',
  IDLE = 'idle',
  PROCESSING = 'processing',
  ERROR = 'error',
  OFFLINE = 'offline'
}

export enum ClosedLoopPhase {
  DETECTION = 'detection',
  DIAGNOSTIC = 'diagnostic',
  DECISION = 'decision',
  ACTION = 'action',
  FEEDBACK = 'feedback',
  LEARNING = 'learning'
}

export interface SensorSignal {
  signalId: string;
  equipmentId: number;
  sensorType: string;
  value: number;
  unit: string;
  timestamp: Date;
  quality: number;
  source: 'mqtt' | 'modbus' | 'opcua' | 'lorawan' | 'simulation';
}

export interface AnomalyDetection {
  anomalyId: string;
  equipmentId: number;
  signalIds: string[];
  anomalyType: 'threshold_breach' | 'trend_deviation' | 'pattern_anomaly' | 'correlation_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  detectedAt: Date;
  description: string;
  rawData: Record<string, any>;
}

export interface CognitiveDiagnosis {
  diagnosisId: string;
  equipmentId: number;
  anomalyIds: string[];
  rootCause: string;
  rootCauseConfidence: number;
  contributingFactors: string[];
  evidenceChain: EvidenceItem[];
  suggestedActions: SuggestedAction[];
  riskAssessment: RiskAssessment;
  knowledgeGraphPath: string[];
  physicsModelValidation?: PhysicsValidation;
  autonomyLevel: AutonomyLevel;
  timestamp: Date;
}

export interface EvidenceItem {
  type: 'sensor_data' | 'rule_match' | 'historical_case' | 'knowledge_graph' | 'physics_model' | 'agent_report';
  source: string;
  description: string;
  confidence: number;
  data: Record<string, any>;
}

export interface SuggestedAction {
  actionId: string;
  type: 'maintenance' | 'replacement' | 'adjustment' | 'inspection' | 'shutdown' | 'parameter_change';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration: number;
  requiredSkills: string[];
  requiredParts: string[];
  estimatedCost: number;
  riskIfDelayed: string;
  automatable: boolean;
  autonomyLevelRequired: AutonomyLevel;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  failureProbability: number;
  estimatedTimeToFailure: number;
  impactIfFailure: string;
  financialImpact: number;
  safetyImpact: 'none' | 'minor' | 'major' | 'catastrophic';
  environmentalImpact: 'none' | 'minor' | 'major' | 'catastrophic';
}

export interface PhysicsValidation {
  modelType: string;
  modelConfidence: number;
  simulatedBehavior: string;
  deviationFromNormal: number;
  physicalExplanation: string;
}

export interface OrchestratedAction {
  executionId: string;
  diagnosisId: string;
  actionId: string;
  targetSystem: 'plc' | 'scada' | 'dcs' | 'erp' | 'gmao' | 'manual';
  command: Record<string, any>;
  autonomyLevel: AutonomyLevel;
  approvalStatus: DecisionOutcome;
  approvedBy?: string;
  executedAt?: Date;
  result?: string;
  feedback?: ActionFeedback;
}

export interface ActionFeedback {
  feedbackId: string;
  executionId: string;
  technicianId?: string;
  success: boolean;
  effectiveness: number;
  actualDuration: number;
  notes: string;
  correctiveDiagnosis?: string;
  timestamp: Date;
}

export interface PolicyRule {
  policyId: string;
  name: string;
  description: string;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  maxAutonomyLevel: AutonomyLevel;
  requiresApproval: boolean;
  approvalRoles: string[];
  priority: number;
  enabled: boolean;
}

export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
  value: any;
}

export interface PolicyAction {
  type: 'create_work_order' | 'send_alert' | 'adjust_parameter' | 'trigger_shutdown' | 'escalate' | 'log';
  parameters: Record<string, any>;
}

export interface KnowledgeNode {
  nodeId: string;
  nodeType: 'equipment' | 'symptom' | 'cause' | 'intervention' | 'part' | 'context' | 'effect';
  label: string;
  properties: Record<string, any>;
  tenantId: string;
}

export interface KnowledgeEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: 'causes' | 'indicates' | 'resolves' | 'requires' | 'affects' | 'preceded_by' | 'correlates_with';
  weight: number;
  confidence: number;
  occurrences: number;
  metadata: Record<string, any>;
}

export interface ModelVersion {
  modelId: string;
  version: string;
  modelType: 'anomaly_detection' | 'failure_prediction' | 'rul_estimation' | 'classification' | 'physics_hybrid';
  equipmentType?: string;
  performance: ModelPerformanceMetrics;
  trainingData: { count: number; dateRange: string };
  deployedAt?: Date;
  status: 'training' | 'validating' | 'deployed' | 'retired';
}

export interface ModelPerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  meanTimeToDetection: number;
}

export interface DecisionAuditEntry {
  auditId: string;
  timestamp: Date;
  diagnosisId: string;
  decision: DecisionOutcome;
  autonomyLevel: AutonomyLevel;
  decisionReason: string;
  evidenceSummary: string;
  riskLevel: string;
  policyApplied: string;
  humanOverride: boolean;
  overrideReason?: string;
  outcome?: string;
  tenantId: string;
}

export interface AgentMessage {
  messageId: string;
  fromAgent: string;
  toAgent: string;
  messageType: 'sensor_update' | 'anomaly_alert' | 'diagnosis_request' | 'diagnosis_result' |
               'action_command' | 'feedback_report' | 'knowledge_update' | 'model_sync' | 'heartbeat';
  payload: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timestamp: Date;
  requiresAck: boolean;
  acknowledged: boolean;
}

export interface WhatsIfScenario {
  scenarioId: string;
  name: string;
  description: string;
  equipmentId: number;
  hypotheticalConditions: Record<string, any>;
  simulatedOutcome: {
    failureProbability: number;
    estimatedTimeToFailure: number;
    recommendedActions: string[];
    costImplication: number;
  };
  createdAt: Date;
  createdBy: string;
}

export interface CognitiveLayerInterface {
  layerType: CognitiveLayerType;
  initialize(): Promise<void>;
  getStatus(): LayerStatus;
  processInput(input: any): Promise<any>;
  shutdown(): Promise<void>;
}

export interface LayerStatus {
  layer: CognitiveLayerType;
  healthy: boolean;
  activeAgents: number;
  processedEvents: number;
  lastActivity: Date;
  errors: number;
  metrics: Record<string, number>;
}
