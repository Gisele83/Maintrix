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
  maintenanceCases,
  repairProcedures,
  reportedCases,
  diagnosticSessions,
  userProfiles
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
}

export class MemStorage implements IStorage {
  private maintenanceCases: Map<number, MaintenanceCase>;
  private repairProcedures: Map<number, RepairProcedure>;
  private reportedCases: Map<number, ReportedCase>;
  private diagnosticSessions: Map<number, DiagnosticSession>;
  private userProfiles: Map<number, UserProfile>;
  private currentId: number;

  constructor() {
    this.maintenanceCases = new Map();
    this.repairProcedures = new Map();
    this.reportedCases = new Map();
    this.diagnosticSessions = new Map();
    this.userProfiles = new Map();
    this.currentId = 1;
    this.initializeData();
    this.initializeUserProfiles();
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

export const storage = new DatabaseStorage();
