import { 
  MaintenanceCase, 
  InsertMaintenanceCase,
  RepairProcedure,
  InsertRepairProcedure,
  ReportedCase,
  InsertReportedCase,
  DiagnosticSession,
  InsertDiagnosticSession,
  UserProfile,
  InsertUserProfile,
  FeedbackSession,
  InsertFeedbackSession,
  LearningMetrics,
  InsertLearningMetrics,
  ModelPerformance,
  InsertModelPerformance,
  AdaptiveLearning,
  InsertAdaptiveLearning,
  // GMAO types
  EquipmentRegistry,
  InsertEquipmentRegistry,
  WorkOrder,
  InsertWorkOrder,
  PreventiveMaintenancePlan,
  InsertPreventiveMaintenancePlan,
  SparePart,
  InsertSparePart,
  StockMovement,
  InsertStockMovement,
  IotSensorData,
  InsertIotSensorData,
  PredictiveAnalytics,
  InsertPredictiveAnalytics,
  KpiMetrics,
  InsertKpiMetrics,
  IntegrationLog,
  InsertIntegrationLog,
  AlertsNotifications,
  InsertAlertsNotifications,
  // Tables
  maintenanceCases,
  repairProcedures,
  reportedCases,
  diagnosticSessions,
  userProfiles,
  feedbackSessions,
  learningMetrics,
  modelPerformance,
  adaptiveLearning,
  equipmentRegistry,
  workOrders,
  preventiveMaintenancePlans,
  spareParts,
  stockMovements,
  iotSensorData,
  predictiveAnalytics,
  kpiMetrics,
  integrationLog,
  alertsNotifications
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, and, desc, arrayContains, sql } from "drizzle-orm";

export interface IStorage {
  // Maintenance Cases
  getMaintenanceCases(): Promise<MaintenanceCase[]>;
  getMaintenanceCaseById(id: number): Promise<MaintenanceCase | undefined>;
  createMaintenanceCase(data: InsertMaintenanceCase): Promise<MaintenanceCase>;
  searchMaintenanceCases(query: { equipmentType?: string; symptoms?: string[] }): Promise<MaintenanceCase[]>;

  // Repair Procedures
  getRepairProceduresByCaseId(caseId: number): Promise<RepairProcedure[]>;
  createRepairProcedure(data: InsertRepairProcedure): Promise<RepairProcedure>;
  updateRepairProcedureCompletion(id: number, completed: boolean): Promise<RepairProcedure>;

  // Reported Cases
  getReportedCases(): Promise<ReportedCase[]>;
  createReportedCase(data: InsertReportedCase): Promise<ReportedCase>;
  updateReportedCaseStatus(id: number, status: string): Promise<ReportedCase>;

  // Diagnostic Sessions
  getDiagnosticSessions(): Promise<DiagnosticSession[]>;
  createDiagnosticSession(data: InsertDiagnosticSession): Promise<DiagnosticSession>;
  updateDiagnosticSession(id: number, updates: Partial<DiagnosticSession>): Promise<DiagnosticSession>;

  // User Profiles
  getUserProfiles(): Promise<UserProfile[]>;
  getUserProfileById(id: number): Promise<UserProfile | undefined>;
  getUserProfileByUsername(username: string): Promise<UserProfile | undefined>;
  createUserProfile(data: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(id: number, updates: Partial<UserProfile>): Promise<UserProfile>;
  deleteUserProfile(id: number): Promise<boolean>;

  // Continuous Learning System
  createFeedbackSession(data: InsertFeedbackSession): Promise<FeedbackSession>;
  getFeedbackSessions(): Promise<FeedbackSession[]>;
  getFeedbackBySessionId(sessionId: number): Promise<FeedbackSession | undefined>;
  
  // Learning Metrics
  getLearningMetrics(): Promise<LearningMetrics[]>;
  getLearningMetricsByEquipment(equipmentType: string): Promise<LearningMetrics[]>;
  updateLearningMetrics(equipmentType: string, symptomPattern: string, wasSuccessful: boolean): Promise<void>;
  
  // Model Performance Tracking
  getModelPerformance(): Promise<ModelPerformance[]>;
  updateModelPerformance(data: InsertModelPerformance): Promise<ModelPerformance>;
  
  // Adaptive Learning
  getAdaptiveLearning(): Promise<AdaptiveLearning[]>;
  getAdaptiveLearningByEquipment(equipmentType: string): Promise<AdaptiveLearning | undefined>;
  updateAdaptiveLearning(equipmentType: string, learningData: Partial<AdaptiveLearning>): Promise<void>;

  // GMAO - Equipment Registry
  getEquipmentRegistry(): Promise<EquipmentRegistry[]>;
  getEquipmentById(id: number): Promise<EquipmentRegistry | undefined>;
  getEquipmentByEquipmentId(equipmentId: string): Promise<EquipmentRegistry | undefined>;
  createEquipment(data: InsertEquipmentRegistry): Promise<EquipmentRegistry>;
  updateEquipment(id: number, updates: Partial<EquipmentRegistry>): Promise<EquipmentRegistry>;
  searchEquipment(query: { equipmentType?: string; zone?: string; sector?: string }): Promise<EquipmentRegistry[]>;

  // GMAO - Work Orders
  getWorkOrders(): Promise<WorkOrder[]>;
  getWorkOrderById(id: number): Promise<WorkOrder | undefined>;
  getWorkOrdersByEquipment(equipmentId: number): Promise<WorkOrder[]>;
  getWorkOrdersByStatus(status: string): Promise<WorkOrder[]>;
  getWorkOrdersByAssignee(userId: number): Promise<WorkOrder[]>;
  createWorkOrder(data: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: number, updates: Partial<WorkOrder>): Promise<WorkOrder>;

  // GMAO - Preventive Maintenance
  getPreventiveMaintenancePlans(): Promise<PreventiveMaintenancePlan[]>;
  getPreventiveMaintenancePlanById(id: number): Promise<PreventiveMaintenancePlan | undefined>;
  getPreventiveMaintenancePlansByEquipmentType(equipmentType: string): Promise<PreventiveMaintenancePlan[]>;
  createPreventiveMaintenancePlan(data: InsertPreventiveMaintenancePlan): Promise<PreventiveMaintenancePlan>;
  updatePreventiveMaintenancePlan(id: number, updates: Partial<PreventiveMaintenancePlan>): Promise<PreventiveMaintenancePlan>;

  // GMAO - Spare Parts Inventory
  getSpareParts(): Promise<SparePart[]>;
  getSparePartById(id: number): Promise<SparePart | undefined>;
  getSparePartByPartNumber(partNumber: string): Promise<SparePart | undefined>;
  getSparePartsByCategory(category: string): Promise<SparePart[]>;
  getLowStockParts(): Promise<SparePart[]>;
  createSparePart(data: InsertSparePart): Promise<SparePart>;
  updateSparePart(id: number, updates: Partial<SparePart>): Promise<SparePart>;

  // GMAO - Stock Movements
  getStockMovements(): Promise<StockMovement[]>;
  getStockMovementsByPart(sparePartId: number): Promise<StockMovement[]>;
  createStockMovement(data: InsertStockMovement): Promise<StockMovement>;

  // IoT Sensor Data
  getIotSensorData(equipmentId?: number, sensorType?: string, limit?: number): Promise<IotSensorData[]>;
  createIotSensorData(data: InsertIotSensorData): Promise<IotSensorData>;
  getLatestSensorData(equipmentId: number): Promise<IotSensorData[]>;

  // Predictive Analytics
  getPredictiveAnalytics(equipmentId?: number): Promise<PredictiveAnalytics[]>;
  createPredictiveAnalytics(data: InsertPredictiveAnalytics): Promise<PredictiveAnalytics>;
  getLatestPredictions(equipmentId: number): Promise<PredictiveAnalytics | undefined>;

  // KPI Metrics
  getKpiMetrics(equipmentId?: number, metricType?: string): Promise<KpiMetrics[]>;
  createKpiMetrics(data: InsertKpiMetrics): Promise<KpiMetrics>;

  // Integration Log
  getIntegrationLog(systemName?: string): Promise<IntegrationLog[]>;
  createIntegrationLog(data: InsertIntegrationLog): Promise<IntegrationLog>;

  // Alerts and Notifications
  getAlertsNotifications(status?: string): Promise<AlertsNotifications[]>;
  getAlertsByEquipment(equipmentId: number): Promise<AlertsNotifications[]>;
  createAlert(data: InsertAlertsNotifications): Promise<AlertsNotifications>;
  updateAlert(id: number, updates: Partial<AlertsNotifications>): Promise<AlertsNotifications>;
}

export class MemStorage implements IStorage {
  private maintenanceCases: Map<number, MaintenanceCase>;
  private repairProcedures: Map<number, RepairProcedure>;
  private reportedCases: Map<number, ReportedCase>;
  private diagnosticSessions: Map<number, DiagnosticSession>;
  private userProfiles: Map<number, UserProfile>;
  private feedbackSessions: Map<number, FeedbackSession>;
  private learningMetrics: Map<string, LearningMetrics>;
  private modelPerformance: Map<string, ModelPerformance>;
  private adaptiveLearning: Map<string, AdaptiveLearning>;
  private currentId: number;

  constructor() {
    this.maintenanceCases = new Map();
    this.repairProcedures = new Map();
    this.reportedCases = new Map();
    this.diagnosticSessions = new Map();
    this.userProfiles = new Map();
    this.feedbackSessions = new Map();
    this.learningMetrics = new Map();
    this.modelPerformance = new Map();
    this.adaptiveLearning = new Map();
    this.currentId = 1;
    this.initializeData();
    this.initializeUserProfiles();
    this.initializeLearningSystem();
  }

  private initializeData() {
    // Initialize with comprehensive maintenance cases based on industrial experience
    const cases: MaintenanceCase[] = [
      {
        id: 1,
        equipmentType: "moteur",
        equipmentId: "MOT-001",
        zone: "production",
        sector: "Ligne 1",
        symptoms: "Bruit anormal et vibrations importantes",
        symptomsChecked: ["bruit_anormal", "vibrations"],
        diagnosis: "Roulement défectueux",
        solution: "Remplacer le roulement côté libre, vérifier l'alignement",
        duration: 135, // 2h 15m
        resolved: true,
        urgency: "medium",
        confidence: 0.92,
        createdAt: new Date("2024-01-15T14:30:00Z"),
      },
      {
        id: 2,
        equipmentType: "pompe",
        equipmentId: "PUMP-A23",
        zone: "production",
        sector: "Hydraulique",
        symptoms: "Fuite hydraulique et pression faible",
        symptomsChecked: ["fuite", "performance_degradee"],
        diagnosis: "Joint d'étanchéité usé",
        solution: "Remplacer les joints d'étanchéité et vérifier la pression",
        duration: 105, // 1h 45m
        resolved: true,
        urgency: "high",
        confidence: 0.89,
        createdAt: new Date("2024-01-14T09:15:00Z"),
      },
      {
        id: 3,
        equipmentType: "convoyeur",
        equipmentId: "CONV-B12",
        zone: "conditionnement",
        sector: "Secteur B",
        symptoms: "Arrêt intempestif, capteur défaillant",
        symptomsChecked: ["panne_electrique"],
        diagnosis: "Capteur de position HS",
        solution: "Remplacer le capteur de position et recalibrer",
        duration: 45,
        resolved: true,
        urgency: "medium",
        confidence: 0.95,
        createdAt: new Date("2024-01-13T16:45:00Z"),
      },
      {
        id: 4,
        equipmentType: "moteur",
        equipmentId: "MOT-005",
        zone: "production",
        sector: "Ligne 2",
        symptoms: "Surchauffe moteur, température élevée",
        symptomsChecked: ["surchauffe"],
        diagnosis: "Problème de ventilation",
        solution: "Nettoyer le système de refroidissement, remplacer le ventilateur",
        duration: 90,
        resolved: true,
        urgency: "high",
        confidence: 0.87,
        createdAt: new Date("2024-01-12T11:20:00Z"),
      },
      {
        id: 5,
        equipmentType: "variateur",
        equipmentId: "VAR-001",
        zone: "production",
        sector: "Automatisme",
        symptoms: "Défaut F001 affichage, moteur ne démarre pas",
        symptomsChecked: ["panne_electrique"],
        diagnosis: "Erreur de paramétrage",
        solution: "Reprogrammer les paramètres par défaut, vérifier les connexions",
        duration: 60,
        resolved: true,
        urgency: "medium",
        confidence: 0.91,
        createdAt: new Date("2024-01-11T08:45:00Z"),
      },
      {
        id: 6,
        equipmentType: "compresseur",
        equipmentId: "COMP-A1",
        zone: "utilites",
        sector: "Air comprimé",
        symptoms: "Pression instable, fuite d'air audible",
        symptomsChecked: ["fuite", "performance_degradee"],
        diagnosis: "Clapet anti-retour défaillant",
        solution: "Remplacer le clapet anti-retour, purger le circuit",
        duration: 120,
        resolved: true,
        urgency: "medium",
        confidence: 0.85,
        createdAt: new Date("2024-01-10T15:30:00Z"),
      },
      {
        id: 7,
        equipmentType: "capteur",
        equipmentId: "TEMP-01",
        zone: "production",
        sector: "Four",
        symptoms: "Lecture de température incohérente",
        symptomsChecked: ["panne_electrique"],
        diagnosis: "Sonde de température défaillante",
        solution: "Remplacer la sonde PT100, étalonner le système",
        duration: 75,
        resolved: true,
        urgency: "high",
        confidence: 0.93,
        createdAt: new Date("2024-01-09T13:15:00Z"),
      },
      {
        id: 8,
        equipmentType: "pompe",
        equipmentId: "PUMP-B15",
        zone: "stockage",
        sector: "Transfert",
        symptoms: "Débit réduit, bruit de cavitation",
        symptomsChecked: ["bruit_anormal", "performance_degradee"],
        diagnosis: "Amorçage déficient",
        solution: "Vérifier l'aspiration, purger l'air, contrôler le niveau",
        duration: 50,
        resolved: true,
        urgency: "medium",
        confidence: 0.88,
        createdAt: new Date("2024-01-08T10:00:00Z"),
      },

      // === ÉQUIPEMENTS DE LEVAGE PORTUAIRE ===

      // Grue STS (Ship to Shore) - Cas 9
      {
        id: 9,
        equipmentType: "sts",
        equipmentId: "STS-003",
        zone: "exterieur",
        sector: "Terminal à conteneurs",
        symptoms: "Désalignement du trolley et balancement excessif du bloc de charge lors des opérations de levage",
        symptomsChecked: ["trolley_misalignment", "load_block_swing"],
        diagnosis: "Défaut d'alignement des rails du trolley et usure des guides anti-balancement",
        solution: "1. Arrêter immédiatement les opérations. 2. Contrôler l'alignement des rails avec un théodolite. 3. Ajuster les rails et remplacer les guides anti-balancement. 4. Calibrer le système de positionnement du trolley. 5. Test complet avant remise en service.",
        duration: 480, // 8h - intervention lourde
        resolved: true,
        urgency: "high",
        confidence: 0.94,
        createdAt: new Date("2024-01-20T06:00:00Z"),
      },

      // Grue RTG (Rubber Tired Gantry) - Cas 10
      {
        id: 10,
        equipmentType: "rtg",
        equipmentId: "RTG-012",
        zone: "stockage",
        sector: "Parc à conteneurs Zone A",
        symptoms: "Moteur diesel qui cale fréquemment et consommation de carburant anormalement élevée",
        symptomsChecked: ["diesel_engine_fault", "fuel_consumption_high"],
        diagnosis: "Encrassement du système d'injection et filtre à air colmaté",
        solution: "1. Nettoyer ou remplacer le filtre à air. 2. Nettoyer les injecteurs diesel. 3. Vérifier et nettoyer le circuit d'admission d'air. 4. Contrôler la qualité du carburant. 5. Réglage paramètres injection. 6. Test de performance moteur.",
        duration: 240, // 4h
        resolved: true,
        urgency: "medium",
        confidence: 0.88,
        createdAt: new Date("2024-01-19T08:30:00Z"),
      },

      // Reach Stacker - Cas 11
      {
        id: 11,
        equipmentType: "reach_stacker",
        equipmentId: "RS-007",
        zone: "stockage",
        sector: "Zone stockage vides",
        symptoms: "Défaut d'inclinaison du mât et fuite hydraulique importante au niveau du circuit de portée",
        symptomsChecked: ["mast_tilt_fault", "reach_hydraulic_leak"],
        diagnosis: "Vérin d'inclinaison défaillant et fuite sur flexible hydraulique haute pression",
        solution: "1. Sécuriser la zone et abaisser complètement le mât. 2. Remplacer le vérin d'inclinaison du mât. 3. Remplacer le flexible hydraulique défaillant. 4. Purger le circuit hydraulique. 5. Calibrer les capteurs d'inclinaison. 6. Test fonctionnel complet.",
        duration: 360, // 6h
        resolved: true,
        urgency: "high",
        confidence: 0.91,
        createdAt: new Date("2024-01-18T10:15:00Z"),
      },

      // Grue Mobile Portuaire - Cas 12
      {
        id: 12,
        equipmentType: "grue_mobile",
        equipmentId: "GMH-005",
        zone: "reception",
        sector: "Quai de déchargement",
        symptoms: "Défaillance des stabilisateurs et alerte constante du système de moment de charge",
        symptomsChecked: ["outrigger_malfunction", "load_moment_warning"],
        diagnosis: "Capteur de pression stabilisateur défectueux et calibrage système LMI (Load Moment Indicator) incorrect",
        solution: "1. Arrêt immédiat des opérations de levage. 2. Vérifier l'extension complète des stabilisateurs. 3. Remplacer le capteur de pression défaillant. 4. Recalibrer le système LMI avec charges d'étalonnage. 5. Test de tous les dispositifs de sécurité. 6. Formation opérateur sur nouveaux paramètres.",
        duration: 300, // 5h
        resolved: true,
        urgency: "high",
        confidence: 0.93,
        createdAt: new Date("2024-01-17T07:45:00Z"),
      },

      // Straddle Carrier - Cas 13
      {
        id: 13,
        equipmentType: "straddle_carrier",
        equipmentId: "SC-009",
        zone: "stockage",
        sector: "Terminal intermodal",
        symptoms: "Problème d'alignement des jambes et dérive en direction lors des déplacements",
        symptomsChecked: ["leg_alignment_issue", "steering_drift"],
        diagnosis: "Usure des articulations des jambes et déréglage du système de direction",
        solution: "1. Immobiliser l'équipement en position sécurisée. 2. Remplacer les articulations usées des jambes. 3. Contrôler et ajuster la géométrie de direction. 4. Vérifier l'usure des pneumatiques et pression. 5. Calibrer le système de direction assistée. 6. Test de manœuvrabilité.",
        duration: 420, // 7h
        resolved: true,
        urgency: "medium",
        confidence: 0.87,
        createdAt: new Date("2024-01-16T09:00:00Z"),
      },

      // Spreader Automatique - Cas 14
      {
        id: 14,
        equipmentType: "spreader",
        equipmentId: "SPR-004",
        zone: "production",
        sector: "Poste de manutention",
        symptoms: "Coincement des twist-locks et fissure détectée sur le châssis du spreader",
        symptomsChecked: ["twist_lock_jam", "spreader_frame_crack"],
        diagnosis: "Usure excessive des mécanismes twist-lock et fatigue structurelle du châssis",
        solution: "1. Mise hors service immédiate pour sécurité. 2. Démontage complet des twist-locks pour nettoyage et remplacement des pièces usées. 3. Soudure réparatrice de la fissure châssis par soudeur certifié. 4. Contrôle non destructif de la soudure. 5. Test de fonctionnement et certification. 6. Mise à jour du carnet de maintenance.",
        duration: 600, // 10h - intervention critique
        resolved: true,
        urgency: "high",
        confidence: 0.96,
        createdAt: new Date("2024-01-15T06:30:00Z"),
      },

      // Grue STS - Cas de capteur vent - Cas 15
      {
        id: 15,
        equipmentType: "sts",
        equipmentId: "STS-001",
        zone: "exterieur",
        sector: "Terminal principal",
        symptoms: "Défaut du capteur de vent et désactivation du système anti-collision",
        symptomsChecked: ["wind_sensor_fault", "anti_collision_fault"],
        diagnosis: "Capteur anémométrique défaillant et perte de communication système anti-collision",
        solution: "1. Restriction des opérations par vent fort. 2. Remplacer le capteur anémométrique. 3. Vérifier le câblage du système anti-collision. 4. Tester la communication entre grues. 5. Calibrage des seuils de vent. 6. Formation équipes sécurité.",
        duration: 180, // 3h
        resolved: true,
        urgency: "high",
        confidence: 0.89,
        createdAt: new Date("2024-01-14T14:20:00Z"),
      },

      // RTG - Cas pneumatiques et spreader - Cas 16
      {
        id: 16,
        equipmentType: "rtg",
        equipmentId: "RTG-008",
        zone: "stockage",
        sector: "Parc conteneurs Zone B",
        symptoms: "Usure avancée des pneumatiques et blocage des twist-locks du spreader",
        symptomsChecked: ["tire_wear", "spreader_twist_lock"],
        diagnosis: "Pneumatiques en fin de vie et mécanisme twist-lock encrassé",
        solution: "1. Immobilisation pour sécurité. 2. Remplacement des 8 pneumatiques. 3. Démontage et nettoyage complet des twist-locks. 4. Lubrification des mécanismes. 5. Vérification géométrie roues. 6. Test de manutention conteneur.",
        duration: 480, // 8h
        resolved: true,
        urgency: "medium",
        confidence: 0.92,
        createdAt: new Date("2024-01-13T11:00:00Z"),
      }
    ];

    cases.forEach(maintenanceCase => {
      this.maintenanceCases.set(maintenanceCase.id, maintenanceCase);
    });

    // Initialize repair procedures
    const procedures: RepairProcedure[] = [
      {
        id: 1,
        caseId: 1,
        stepNumber: 1,
        title: "Consignation électrique",
        titleEn: "Electrical lockout",
        description: "Couper l'alimentation principale et apposer les étiquettes de consignation.",
        descriptionEn: "Cut main power supply and apply lockout tags.",
        safetyWarning: "Vérifier l'absence de tension avant toute intervention",
        safetyWarningEn: "Verify absence of voltage before any intervention",
        toolsRequired: ["Voltmètre", "Étiquettes de consignation"],
        toolsRequiredEn: ["Voltmeter", "Lockout tags"],
        estimatedTime: 15,
        isCompleted: true,
      },
      {
        id: 2,
        caseId: 1,
        stepNumber: 2,
        title: "Dépose du capot moteur",
        titleEn: "Remove motor cover",
        description: "Retirer les vis de fixation du capot et accéder au roulement côté libre.",
        descriptionEn: "Remove cover fixing screws and access the free-end bearing.",
        toolsRequired: ["Clés Allen", "Tournevis cruciforme"],
        toolsRequiredEn: ["Allen keys", "Phillips screwdriver"],
        estimatedTime: 20,
        isCompleted: true,
      },
      {
        id: 3,
        caseId: 1,
        stepNumber: 3,
        title: "Extraction du roulement défaillant",
        titleEn: "Extract faulty bearing",
        description: "Utiliser l'extracteur de roulement pour retirer le roulement côté libre de l'arbre moteur.",
        descriptionEn: "Use bearing puller to remove the free-end bearing from motor shaft.",
        toolsRequired: ["Extracteur de roulement", "Marteau en plastique", "Dégrippant"],
        toolsRequiredEn: ["Bearing puller", "Plastic hammer", "Penetrating oil"],
        estimatedTime: 30,
        isCompleted: false,
      }
    ];

    procedures.forEach(procedure => {
      this.repairProcedures.set(procedure.id, procedure);
    });

    this.currentId = 20;
  }

  private initializeUserProfiles() {
    // Initialize with sample user profiles for development
    const profiles: UserProfile[] = [
      {
        id: 1,
        username: "marc.dupont",
        firstName: "Marc",
        lastName: "Dupont",
        email: "marc.dupont@entreprise.fr",
        role: "supervisor",
        department: "Maintenance",
        phoneNumber: "+33 1 23 45 67 89",
        preferredLanguage: "fr",
        specializations: ["Moteurs électriques", "Systèmes hydrauliques", "Automatisation"],
        experienceLevel: "expert",
        isActive: true,
        lastLogin: new Date("2024-07-15T08:30:00Z"),
        createdAt: new Date("2024-01-15T09:00:00Z"),
        updatedAt: new Date("2024-07-15T08:30:00Z"),
      },
      {
        id: 2,
        username: "sarah.martin",
        firstName: "Sarah",
        lastName: "Martin",
        email: "sarah.martin@entreprise.fr",
        role: "technician",
        department: "Production",
        phoneNumber: "+33 1 23 45 67 90",
        preferredLanguage: "fr",
        specializations: ["Convoyeurs", "Emballage", "Contrôle qualité"],
        experienceLevel: "intermediate",
        isActive: true,
        lastLogin: new Date("2024-07-16T07:45:00Z"),
        createdAt: new Date("2024-02-01T10:00:00Z"),
        updatedAt: new Date("2024-07-16T07:45:00Z"),
      },
      {
        id: 3,
        username: "thomas.bernard",
        firstName: "Thomas",
        lastName: "Bernard",
        email: "thomas.bernard@entreprise.fr",
        role: "technician",
        department: "Maintenance",
        phoneNumber: "+33 1 23 45 67 91",
        preferredLanguage: "fr",
        specializations: ["Pneumatique", "Mécanique générale"],
        experienceLevel: "beginner",
        isActive: true,
        lastLogin: new Date("2024-07-16T06:00:00Z"),
        createdAt: new Date("2024-06-01T08:00:00Z"),
        updatedAt: new Date("2024-07-16T06:00:00Z"),
      },
    ];

    profiles.forEach(profile => {
      this.userProfiles.set(profile.id, profile);
    });

    // Update currentId to be higher than existing IDs
    this.currentId = Math.max(this.currentId, ...profiles.map(p => p.id)) + 1;
  }

  // Maintenance Cases
  async getMaintenanceCases(): Promise<MaintenanceCase[]> {
    return Array.from(this.maintenanceCases.values());
  }

  async getMaintenanceCaseById(id: number): Promise<MaintenanceCase | undefined> {
    return this.maintenanceCases.get(id);
  }

  async createMaintenanceCase(data: InsertMaintenanceCase): Promise<MaintenanceCase> {
    const id = this.currentId++;
    const maintenanceCase: MaintenanceCase = {
      ...data,
      id,
      createdAt: new Date(),
    };
    this.maintenanceCases.set(id, maintenanceCase);
    return maintenanceCase;
  }

  async searchMaintenanceCases(query: { equipmentType?: string; symptoms?: string[] }): Promise<MaintenanceCase[]> {
    const cases = Array.from(this.maintenanceCases.values());
    
    return cases.filter(maintenanceCase => {
      if (query.equipmentType && maintenanceCase.equipmentType !== query.equipmentType) {
        return false;
      }
      
      if (query.symptoms && query.symptoms.length > 0) {
        const caseSymptoms = maintenanceCase.symptomsChecked || [];
        const matchingSymptoms = query.symptoms.filter(symptom => 
          caseSymptoms.includes(symptom) || 
          maintenanceCase.symptoms.toLowerCase().includes(symptom.toLowerCase())
        );
        return matchingSymptoms.length > 0;
      }
      
      return true;
    });
  }

  // Repair Procedures
  async getRepairProceduresByCaseId(caseId: number): Promise<RepairProcedure[]> {
    const procedures = Array.from(this.repairProcedures.values());
    return procedures.filter(proc => proc.caseId === caseId).sort((a, b) => a.stepNumber - b.stepNumber);
  }

  async createRepairProcedure(data: InsertRepairProcedure): Promise<RepairProcedure> {
    const id = this.currentId++;
    const procedure: RepairProcedure = { ...data, id };
    this.repairProcedures.set(id, procedure);
    return procedure;
  }

  async updateRepairProcedureCompletion(id: number, completed: boolean): Promise<RepairProcedure> {
    const procedure = this.repairProcedures.get(id);
    if (!procedure) {
      throw new Error(`Repair procedure with id ${id} not found`);
    }
    procedure.isCompleted = completed;
    this.repairProcedures.set(id, procedure);
    return procedure;
  }

  // Reported Cases
  async getReportedCases(): Promise<ReportedCase[]> {
    return Array.from(this.reportedCases.values());
  }

  async createReportedCase(data: InsertReportedCase): Promise<ReportedCase> {
    const id = this.currentId++;
    const reportedCase: ReportedCase = {
      ...data,
      id,
      status: "pending",
      createdAt: new Date(),
    };
    this.reportedCases.set(id, reportedCase);
    return reportedCase;
  }

  async updateReportedCaseStatus(id: number, status: string): Promise<ReportedCase> {
    const reportedCase = this.reportedCases.get(id);
    if (!reportedCase) {
      throw new Error(`Reported case with id ${id} not found`);
    }
    reportedCase.status = status;
    this.reportedCases.set(id, reportedCase);
    return reportedCase;
  }

  // Diagnostic Sessions
  async getDiagnosticSessions(): Promise<DiagnosticSession[]> {
    return Array.from(this.diagnosticSessions.values());
  }

  async createDiagnosticSession(data: InsertDiagnosticSession): Promise<DiagnosticSession> {
    const id = this.currentId++;
    const session: DiagnosticSession = {
      ...data,
      id,
      status: "pending",
      createdAt: new Date(),
    };
    this.diagnosticSessions.set(id, session);
    return session;
  }

  async updateDiagnosticSession(id: number, updates: Partial<DiagnosticSession>): Promise<DiagnosticSession> {
    const session = this.diagnosticSessions.get(id);
    if (!session) {
      throw new Error(`Diagnostic session with id ${id} not found`);
    }
    Object.assign(session, updates);
    this.diagnosticSessions.set(id, session);
    return session;
  }

  // User Profile Methods
  async getUserProfiles(): Promise<UserProfile[]> {
    return Array.from(this.userProfiles.values());
  }

  async getUserProfileById(id: number): Promise<UserProfile | undefined> {
    return this.userProfiles.get(id);
  }

  async getUserProfileByUsername(username: string): Promise<UserProfile | undefined> {
    return Array.from(this.userProfiles.values()).find(profile => profile.username === username);
  }

  async createUserProfile(data: InsertUserProfile): Promise<UserProfile> {
    const id = this.currentId++;
    const userProfile: UserProfile = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
    };
    this.userProfiles.set(id, userProfile);
    return userProfile;
  }

  async updateUserProfile(id: number, updates: Partial<UserProfile>): Promise<UserProfile> {
    const existing = this.userProfiles.get(id);
    if (!existing) {
      throw new Error("User profile not found");
    }
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.userProfiles.set(id, updated);
    return updated;
  }

  async deleteUserProfile(id: number): Promise<boolean> {
    return this.userProfiles.delete(id);
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  
  // GMAO - Equipment Registry
  async getEquipmentRegistry(): Promise<EquipmentRegistry[]> {
    return await db.select().from(equipmentRegistry).orderBy(desc(equipmentRegistry.createdAt));
  }

  async getEquipmentById(id: number): Promise<EquipmentRegistry | undefined> {
    const [equipment] = await db.select().from(equipmentRegistry).where(eq(equipmentRegistry.id, id));
    return equipment;
  }

  async getEquipmentByEquipmentId(equipmentId: string): Promise<EquipmentRegistry | undefined> {
    const [equipment] = await db.select().from(equipmentRegistry).where(eq(equipmentRegistry.equipmentId, equipmentId));
    return equipment;
  }

  async createEquipment(data: InsertEquipmentRegistry): Promise<EquipmentRegistry> {
    const [equipment] = await db.insert(equipmentRegistry).values(data).returning();
    return equipment;
  }

  async updateEquipment(id: number, updates: Partial<EquipmentRegistry>): Promise<EquipmentRegistry> {
    const [equipment] = await db
      .update(equipmentRegistry)
      .set(updates)
      .where(eq(equipmentRegistry.id, id))
      .returning();
    
    if (!equipment) {
      throw new Error(`Equipment with id ${id} not found`);
    }
    return equipment;
  }

  async getEquipment(): Promise<EquipmentRegistry[]> {
    return await db.select().from(equipmentRegistry).orderBy(desc(equipmentRegistry.createdAt));
  }

  async searchEquipment(query: { equipmentType?: string; zone?: string; sector?: string }): Promise<EquipmentRegistry[]> {
    let baseQuery = db.select().from(equipmentRegistry);

    const conditions = [];
    if (query.equipmentType) {
      conditions.push(ilike(equipmentRegistry.equipmentType, `%${query.equipmentType}%`));
    }
    if (query.zone) {
      conditions.push(ilike(equipmentRegistry.zone, `%${query.zone}%`));
    }
    if (query.sector) {
      conditions.push(ilike(equipmentRegistry.sector, `%${query.sector}%`));
    }

    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions));
    }

    return await baseQuery.orderBy(desc(equipmentRegistry.createdAt));
  }

  // Work Orders - GMAO methods placeholders
  async getWorkOrders(): Promise<WorkOrder[]> {
    return await db.select().from(workOrders).orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrderById(id: number): Promise<WorkOrder | undefined> {
    throw new Error("Method not implemented");
  }

  async getWorkOrdersByEquipment(equipmentId: number): Promise<WorkOrder[]> {
    throw new Error("Method not implemented");
  }

  async createWorkOrder(data: InsertWorkOrder): Promise<WorkOrder> {
    throw new Error("Method not implemented");
  }

  async updateWorkOrder(id: number, updates: Partial<WorkOrder>): Promise<WorkOrder> {
    throw new Error("Method not implemented");
  }

  async updateWorkOrderStatus(id: number, status: string): Promise<WorkOrder> {
    throw new Error("Method not implemented");
  }

  async getPreventiveMaintenancePlans(): Promise<PreventiveMaintenancePlan[]> {
    return await db.select().from(preventiveMaintenancePlans).orderBy(desc(preventiveMaintenancePlans.createdAt));
  }

  async getPreventiveMaintenancePlanById(id: number): Promise<PreventiveMaintenancePlan | undefined> {
    const [plan] = await db.select().from(preventiveMaintenancePlans).where(eq(preventiveMaintenancePlans.id, id));
    return plan || undefined;
  }

  async getPreventiveMaintenancePlansByEquipmentType(equipmentType: string): Promise<PreventiveMaintenancePlan[]> {
    return await db.select().from(preventiveMaintenancePlans)
      .where(eq(preventiveMaintenancePlans.equipmentType, equipmentType))
      .orderBy(desc(preventiveMaintenancePlans.createdAt));
  }

  async createPreventiveMaintenancePlan(data: InsertPreventiveMaintenancePlan): Promise<PreventiveMaintenancePlan> {
    const [plan] = await db
      .insert(preventiveMaintenancePlans)
      .values(data)
      .returning();
    return plan;
  }

  async updatePreventiveMaintenancePlan(id: number, updates: Partial<PreventiveMaintenancePlan>): Promise<PreventiveMaintenancePlan> {
    const [plan] = await db
      .update(preventiveMaintenancePlans)
      .set(updates)
      .where(eq(preventiveMaintenancePlans.id, id))
      .returning();
    
    if (!plan) {
      throw new Error(`Preventive maintenance plan with id ${id} not found`);
    }
    return plan;
  }

  async deletePreventiveMaintenancePlan(id: number): Promise<boolean> {
    const result = await db
      .delete(preventiveMaintenancePlans)
      .where(eq(preventiveMaintenancePlans.id, id));
    return result.rowCount > 0;
  }

  async getSpareParts(): Promise<SparePart[]> {
    throw new Error("Method not implemented");
  }

  async createSparePart(data: InsertSparePart): Promise<SparePart> {
    throw new Error("Method not implemented");
  }

  async getStockMovements(): Promise<StockMovement[]> {
    throw new Error("Method not implemented");
  }

  async createStockMovement(data: InsertStockMovement): Promise<StockMovement> {
    throw new Error("Method not implemented");
  }

  async getIotSensorData(): Promise<IotSensorData[]> {
    throw new Error("Method not implemented");
  }

  async createIotSensorData(data: InsertIotSensorData): Promise<IotSensorData> {
    throw new Error("Method not implemented");
  }

  async getPredictiveAnalytics(): Promise<PredictiveAnalytics[]> {
    throw new Error("Method not implemented");
  }

  async createPredictiveAnalytics(data: InsertPredictiveAnalytics): Promise<PredictiveAnalytics> {
    throw new Error("Method not implemented");
  }

  async getKpiMetrics(): Promise<KpiMetrics[]> {
    throw new Error("Method not implemented");
  }

  async createKpiMetrics(data: InsertKpiMetrics): Promise<KpiMetrics> {
    throw new Error("Method not implemented");
  }

  async getIntegrationLog(): Promise<IntegrationLog[]> {
    throw new Error("Method not implemented");
  }

  async createIntegrationLog(data: InsertIntegrationLog): Promise<IntegrationLog> {
    throw new Error("Method not implemented");
  }

  async getAlerts(): Promise<AlertsNotifications[]> {
    return await db.select().from(alertsNotifications).orderBy(desc(alertsNotifications.createdAt)).limit(500);
  }

  async getAlertsNotifications(): Promise<AlertsNotifications[]> {
    throw new Error("Method not implemented");
  }

  async createAlertsNotifications(data: InsertAlertsNotifications): Promise<AlertsNotifications> {
    throw new Error("Method not implemented");
  }

  async getMaintenanceCases(): Promise<MaintenanceCase[]> {
    return await db.select().from(maintenanceCases).orderBy(desc(maintenanceCases.createdAt));
  }

  async getMaintenanceCaseById(id: number): Promise<MaintenanceCase | undefined> {
    const [case_] = await db.select().from(maintenanceCases).where(eq(maintenanceCases.id, id));
    return case_ || undefined;
  }

  async createMaintenanceCase(data: InsertMaintenanceCase): Promise<MaintenanceCase> {
    const [case_] = await db
      .insert(maintenanceCases)
      .values(data)
      .returning();
    return case_;
  }

  async searchMaintenanceCases(query: { equipmentType?: string; symptoms?: string[] }): Promise<MaintenanceCase[]> {
    let whereConditions = [];

    if (query.equipmentType) {
      whereConditions.push(eq(maintenanceCases.equipmentType, query.equipmentType));
    }

    if (query.symptoms && query.symptoms.length > 0) {
      const symptomConditions = query.symptoms.map(symptom => 
        ilike(maintenanceCases.symptoms, `%${symptom}%`)
      );
      whereConditions.push(or(...symptomConditions));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    return await db
      .select()
      .from(maintenanceCases)
      .where(whereClause)
      .orderBy(desc(maintenanceCases.createdAt));
  }

  // Repair Procedures
  async getRepairProceduresByCaseId(caseId: number): Promise<RepairProcedure[]> {
    return await db
      .select()
      .from(repairProcedures)
      .where(eq(repairProcedures.caseId, caseId))
      .orderBy(repairProcedures.stepNumber);
  }

  async createRepairProcedure(data: InsertRepairProcedure): Promise<RepairProcedure> {
    const [procedure] = await db
      .insert(repairProcedures)
      .values(data)
      .returning();
    return procedure;
  }

  async updateRepairProcedureCompletion(id: number, completed: boolean): Promise<RepairProcedure> {
    const [procedure] = await db
      .update(repairProcedures)
      .set({ isCompleted: completed })
      .where(eq(repairProcedures.id, id))
      .returning();
    
    if (!procedure) {
      throw new Error(`Repair procedure with id ${id} not found`);
    }
    return procedure;
  }

  // Reported Cases
  async getReportedCases(): Promise<ReportedCase[]> {
    return await db.select().from(reportedCases).orderBy(desc(reportedCases.createdAt));
  }

  async createReportedCase(data: InsertReportedCase): Promise<ReportedCase> {
    const [reportedCase] = await db
      .insert(reportedCases)
      .values({ ...data, status: "pending" })
      .returning();
    return reportedCase;
  }

  async updateReportedCaseStatus(id: number, status: string): Promise<ReportedCase> {
    const [reportedCase] = await db
      .update(reportedCases)
      .set({ status })
      .where(eq(reportedCases.id, id))
      .returning();
    
    if (!reportedCase) {
      throw new Error(`Reported case with id ${id} not found`);
    }
    return reportedCase;
  }

  // Diagnostic Sessions
  async getDiagnosticSessions(): Promise<DiagnosticSession[]> {
    return await db.select().from(diagnosticSessions).orderBy(desc(diagnosticSessions.createdAt));
  }

  async createDiagnosticSession(data: InsertDiagnosticSession): Promise<DiagnosticSession> {
    const [session] = await db
      .insert(diagnosticSessions)
      .values({ ...data, status: "pending" })
      .returning();
    return session;
  }

  async updateDiagnosticSession(id: number, updates: Partial<DiagnosticSession>): Promise<DiagnosticSession> {
    const [session] = await db
      .update(diagnosticSessions)
      .set(updates)
      .where(eq(diagnosticSessions.id, id))
      .returning();
    
    if (!session) {
      throw new Error(`Diagnostic session with id ${id} not found`);
    }
    return session;
  }

  // User Profile Methods for DatabaseStorage
  async getUserProfiles(): Promise<UserProfile[]> {
    return await db.select().from(userProfiles).orderBy(desc(userProfiles.createdAt));
  }

  async getUserProfileById(id: number): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.id, id));
    return profile || undefined;
  }

  async getUserProfileByUsername(username: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.username, username));
    return profile || undefined;
  }

  async createUserProfile(data: InsertUserProfile): Promise<UserProfile> {
    const [profile] = await db
      .insert(userProfiles)
      .values(data)
      .returning();
    return profile;
  }

  async updateUserProfile(id: number, updates: Partial<UserProfile>): Promise<UserProfile> {
    const [profile] = await db
      .update(userProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userProfiles.id, id))
      .returning();
    
    if (!profile) {
      throw new Error(`User profile with id ${id} not found`);
    }
    return profile;
  }

  async deleteUserProfile(id: number): Promise<boolean> {
    const result = await db
      .delete(userProfiles)
      .where(eq(userProfiles.id, id));
    return result.rowCount > 0;
  }
}

export class MemStorageWithLearning extends MemStorage {
  // Initialize Learning System
  private initializeLearningSystem() {
    // Initialize learning metrics for each equipment type
    const equipmentTypes = ["moteur", "pompe", "compresseur", "convoyeur", "variateur", "capteur", 
                           "sts", "rtg", "grue_mobile", "reach_stacker", "straddle_carrier", "spreader"];
    
    equipmentTypes.forEach(equipmentType => {
      // Learning metrics
      const metrics: LearningMetrics = {
        id: this.currentId++,
        equipmentType,
        symptomPattern: "general",
        successRate: 0.75, // Start with 75% baseline
        avgConfidence: 0.80,
        totalCases: 0,
        successfulCases: 0,
        lastUpdated: new Date(),
        improvementSuggestions: []
      };
      this.learningMetrics.set(`${equipmentType}_general`, metrics);

      // Adaptive learning
      const adaptive: AdaptiveLearning = {
        id: this.currentId++,
        equipmentType,
        symptomKeywords: this.getInitialKeywords(equipmentType),
        commonFailures: this.getCommonFailures(equipmentType),
        seasonalPatterns: {},
        zoneSpecificIssues: {},
        learningWeight: 1.0,
        confidenceAdjustment: 0,
        lastUpdate: new Date()
      };
      this.adaptiveLearning.set(equipmentType, adaptive);
    });
  }

  private getInitialKeywords(equipmentType: string): any {
    const keywords = {
      "moteur": ["vibration", "bruit", "surchauffe", "roulement", "alignement"],
      "pompe": ["cavitation", "joint", "étanchéité", "débit", "pression"],
      "sts": ["trolley", "câble", "spreader", "rail", "collision"],
      "rtg": ["pneumatique", "diesel", "hydraulique", "twist-lock"],
      "grue_mobile": ["stabilisateur", "flèche", "charge", "orientation"],
      "reach_stacker": ["mât", "hydraulique", "transmission", "refroidissement"],
      "straddle_carrier": ["jambe", "direction", "guide", "hydraulique"],
      "spreader": ["twist-lock", "châssis", "télescopage", "vérin"]
    };
    return keywords[equipmentType] || ["général", "panne", "défaut"];
  }

  private getCommonFailures(equipmentType: string): any {
    const failures = {
      "moteur": ["roulement usé", "désalignement", "surcharge thermique"],
      "pompe": ["joint défaillant", "cavitation", "usure rotor"],
      "sts": ["désalignement trolley", "usure câbles", "défaut spreader"],
      "rtg": ["usure pneumatiques", "problème moteur diesel", "fuite hydraulique"],
      "grue_mobile": ["problème stabilisateurs", "usure flèche", "surcharge"],
      "reach_stacker": ["défaut mât", "fuite hydraulique", "surchauffe transmission"],
      "straddle_carrier": ["problème jambes", "défaut direction", "usure guides"],
      "spreader": ["blocage twist-locks", "défaut châssis", "problème télescopage"]
    };
    return failures[equipmentType] || ["panne générale"];
  }

  // Continuous Learning Methods
  async createFeedbackSession(data: InsertFeedbackSession): Promise<FeedbackSession> {
    const id = this.currentId++;
    const feedback: FeedbackSession = { ...data, id, createdAt: new Date() };
    this.feedbackSessions.set(id, feedback);
    
    // Auto-update learning metrics based on feedback
    if (data.sessionId) {
      const session = this.diagnosticSessions.get(data.sessionId);
      if (session) {
        await this.updateLearningMetrics(
          session.equipmentType, 
          session.symptoms, 
          data.wasAccurate || false
        );
      }
    }
    
    return feedback;
  }

  async getFeedbackSessions(): Promise<FeedbackSession[]> {
    return Array.from(this.feedbackSessions.values());
  }

  async getFeedbackBySessionId(sessionId: number): Promise<FeedbackSession | undefined> {
    return Array.from(this.feedbackSessions.values())
      .find(f => f.sessionId === sessionId);
  }

  async getLearningMetrics(): Promise<LearningMetrics[]> {
    return Array.from(this.learningMetrics.values());
  }

  async getLearningMetricsByEquipment(equipmentType: string): Promise<LearningMetrics[]> {
    return Array.from(this.learningMetrics.values())
      .filter(m => m.equipmentType === equipmentType);
  }

  async updateLearningMetrics(equipmentType: string, symptomPattern: string, wasSuccessful: boolean): Promise<void> {
    const key = `${equipmentType}_general`;
    let metrics = this.learningMetrics.get(key);
    
    if (!metrics) {
      metrics = {
        id: this.currentId++,
        equipmentType,
        symptomPattern: "general",
        successRate: 0.75,
        avgConfidence: 0.80,
        totalCases: 0,
        successfulCases: 0,
        lastUpdated: new Date(),
        improvementSuggestions: []
      };
    }

    metrics.totalCases++;
    if (wasSuccessful) {
      metrics.successfulCases++;
    }
    
    metrics.successRate = (metrics.successfulCases / metrics.totalCases) * 100;
    metrics.lastUpdated = new Date();
    
    // Generate improvement suggestions based on performance
    if (metrics.successRate < 70) {
      metrics.improvementSuggestions = [
        "Collecter plus de données historiques pour cet équipement",
        "Améliorer la description des symptômes",
        "Réentraîner le modèle ML avec de nouveaux cas"
      ];
    }
    
    this.learningMetrics.set(key, metrics);
  }

  async getModelPerformance(): Promise<ModelPerformance[]> {
    return Array.from(this.modelPerformance.values());
  }

  async updateModelPerformance(data: InsertModelPerformance): Promise<ModelPerformance> {
    const id = this.currentId++;
    const key = `${data.modelType}_${data.equipmentType}`;
    const performance: ModelPerformance = { ...data, id, trainingDate: new Date() };
    this.modelPerformance.set(key, performance);
    return performance;
  }

  async getAdaptiveLearning(): Promise<AdaptiveLearning[]> {
    return Array.from(this.adaptiveLearning.values());
  }

  async getAdaptiveLearningByEquipment(equipmentType: string): Promise<AdaptiveLearning | undefined> {
    return this.adaptiveLearning.get(equipmentType);
  }

  async updateAdaptiveLearning(equipmentType: string, learningData: Partial<AdaptiveLearning>): Promise<void> {
    let adaptive = this.adaptiveLearning.get(equipmentType);
    
    if (!adaptive) {
      adaptive = {
        id: this.currentId++,
        equipmentType,
        symptomKeywords: this.getInitialKeywords(equipmentType),
        commonFailures: this.getCommonFailures(equipmentType),
        seasonalPatterns: {},
        zoneSpecificIssues: {},
        learningWeight: 1.0,
        confidenceAdjustment: 0,
        lastUpdate: new Date()
      };
    }
    
    // Update with new learning data
    Object.assign(adaptive, learningData, { lastUpdate: new Date() });
    this.adaptiveLearning.set(equipmentType, adaptive);
  }
}

export const storage = new DatabaseStorage();
