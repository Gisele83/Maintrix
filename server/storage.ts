import { 
  MaintenanceCase, 
  InsertMaintenanceCase,
  RepairProcedure,
  InsertRepairProcedure,
  ReportedCase,
  InsertReportedCase,
  DiagnosticSession,
  InsertDiagnosticSession 
} from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private maintenanceCases: Map<number, MaintenanceCase>;
  private repairProcedures: Map<number, RepairProcedure>;
  private reportedCases: Map<number, ReportedCase>;
  private diagnosticSessions: Map<number, DiagnosticSession>;
  private currentId: number;

  constructor() {
    this.maintenanceCases = new Map();
    this.repairProcedures = new Map();
    this.reportedCases = new Map();
    this.diagnosticSessions = new Map();
    this.currentId = 1;
    this.initializeData();
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

    this.currentId = 10;
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
}

export const storage = new MemStorage();
