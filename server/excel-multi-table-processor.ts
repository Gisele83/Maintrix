import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { storage } from './storage';
import type { 
  InsertMaintenanceCase, 
  InsertEquipmentRegistry, 
  InsertRepairProcedure 
} from '../shared/schema';

interface EquipmentRecord {
  id: string;
  type: string;
  marque?: string;
  modele?: string;
  dateService?: string;
  localisation?: string;
}

interface DiagnosticRecord {
  id: string;
  date: string;
  equipmentId: string;
  symptomes: string;
  typeDiagnostic: string;
  criticite: string;
  resultat: string;
  technicienId: string;
}

interface ProcedureRecord {
  diagnosticId: string;
  etape: string;
  description: string;
  securite?: string;
  outils?: string;
}

export class ExcelMultiTableProcessor {
  
  async processExcelWithSheets(filePath: string): Promise<{
    success: boolean;
    message: string;
    data: {
      equipments: number;
      diagnostics: number;
      procedures: number;
      crossReferences: number;
    };
  }> {
    try {
      console.log('📊 Processing Excel file with multiple tables...');
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Read Excel file
      const workbook = XLSX.readFile(filePath);
      
      // Try to identify the three tables from different sheets or sections
      const equipments = await this.extractEquipmentTable(workbook);
      const diagnostics = await this.extractDiagnosticTable(workbook);
      const procedures = await this.extractProcedureTable(workbook);
      
      console.log(`✅ Extracted: ${equipments.length} equipments, ${diagnostics.length} diagnostics, ${procedures.length} procedures`);
      
      // Process cross-references and store in database
      const crossReferences = await this.processCrossReferences(equipments, diagnostics, procedures);
      
      return {
        success: true,
        message: `Processed ${equipments.length} equipments, ${diagnostics.length} diagnostics, ${procedures.length} procedures`,
        data: {
          equipments: equipments.length,
          diagnostics: diagnostics.length,
          procedures: procedures.length,
          crossReferences
        }
      };
      
    } catch (error: any) {
      console.error('❌ Excel processing failed:', error);
      return {
        success: false,
        message: `Error processing Excel file: ${error.message}`,
        data: { equipments: 0, diagnostics: 0, procedures: 0, crossReferences: 0 }
      };
    }
  }
  
  private async extractEquipmentTable(workbook: XLSX.WorkBook): Promise<EquipmentRecord[]> {
    const equipments: EquipmentRecord[] = [];
    
    // Try to find equipment data in different sheets
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      // Check if this sheet contains equipment data
      if (data.length > 0) {
        const firstRow = data[0] as any;
        const hasEquipmentCols = Object.keys(firstRow).some(key => 
          key.toLowerCase().includes('equip') || 
          key.toLowerCase().includes('id') || 
          key.toLowerCase().includes('type')
        );
        
        if (hasEquipmentCols) {
          console.log(`📋 Found equipment table in sheet: ${sheetName}`);
          
          for (const row of data as any[]) {
            const equipment: EquipmentRecord = {
              id: this.extractValue(row, ['ID', 'Id', 'Identifiant', 'Equipment_ID', 'EquipmentId']),
              type: this.extractValue(row, ['Type', 'Type_Equipement', 'Equipment_Type', 'TypeEquipement']),
              marque: this.extractValue(row, ['Marque', 'Brand', 'Manufacturer']),
              modele: this.extractValue(row, ['Modèle', 'Model', 'Modele']),
              dateService: this.extractValue(row, ['Date mise en service', 'Date_Service', 'ServiceDate']),
              localisation: this.extractValue(row, ['Localisation', 'Location', 'Zone'])
            };
            
            if (equipment.id && equipment.type) {
              equipments.push(equipment);
            }
          }
        }
      }
    }
    
    return equipments;
  }
  
  private async extractDiagnosticTable(workbook: XLSX.WorkBook): Promise<DiagnosticRecord[]> {
    const diagnostics: DiagnosticRecord[] = [];
    
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      if (data.length > 0) {
        const firstRow = data[0] as any;
        const hasDiagnosticCols = Object.keys(firstRow).some(key => 
          key.toLowerCase().includes('diagnostic') || 
          key.toLowerCase().includes('symptom') || 
          key.toLowerCase().includes('criticite')
        );
        
        if (hasDiagnosticCols) {
          console.log(`🔍 Found diagnostic table in sheet: ${sheetName}`);
          
          for (const row of data as any[]) {
            const diagnostic: DiagnosticRecord = {
              id: this.extractValue(row, ['ID_Diagnostic', 'DiagnosticId', 'ID', 'Diagnostic_ID']),
              date: this.extractValue(row, ['Date', 'Date_Diagnostic', 'Timestamp']),
              equipmentId: this.extractValue(row, ['ID_Equipement', 'Equipment_ID', 'EquipmentId']),
              symptomes: this.extractValue(row, ['Symptômes', 'Symptoms', 'Symptomes', 'Description']),
              typeDiagnostic: this.extractValue(row, ['Type_Diagnostic', 'DiagnosticType', 'Type']),
              criticite: this.extractValue(row, ['Criticité', 'Criticite', 'Severity', 'Priority']),
              resultat: this.extractValue(row, ['Résultat', 'Resultat', 'Result', 'Resolution']),
              technicienId: this.extractValue(row, ['ID_Technicien', 'TechnicienId', 'Technician_ID'])
            };
            
            if (diagnostic.id && diagnostic.symptomes) {
              diagnostics.push(diagnostic);
            }
          }
        }
      }
    }
    
    return diagnostics;
  }
  
  private async extractProcedureTable(workbook: XLSX.WorkBook): Promise<ProcedureRecord[]> {
    const procedures: ProcedureRecord[] = [];
    
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      if (data.length > 0) {
        const firstRow = data[0] as any;
        const hasProcedureCols = Object.keys(firstRow).some(key => 
          key.toLowerCase().includes('procedure') || 
          key.toLowerCase().includes('etape') || 
          key.toLowerCase().includes('securite')
        );
        
        if (hasProcedureCols) {
          console.log(`📝 Found procedure table in sheet: ${sheetName}`);
          
          for (const row of data as any[]) {
            const procedure: ProcedureRecord = {
              diagnosticId: this.extractValue(row, ['ID_Diagnostic', 'DiagnosticId', 'ID']),
              etape: this.extractValue(row, ['Etape', 'Step', 'Procedure_Step']),
              description: this.extractValue(row, ['Description', 'Procedure', 'Instructions']),
              securite: this.extractValue(row, ['Sécurité', 'Securite', 'Safety', 'Warning']),
              outils: this.extractValue(row, ['Outils', 'Tools', 'Equipment_Required'])
            };
            
            if (procedure.diagnosticId && procedure.description) {
              procedures.push(procedure);
            }
          }
        }
      }
    }
    
    return procedures;
  }
  
  private extractValue(row: any, possibleKeys: string[]): string {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null) {
        return String(row[key]).trim();
      }
    }
    return '';
  }
  
  private async processCrossReferences(
    equipments: EquipmentRecord[],
    diagnostics: DiagnosticRecord[],
    procedures: ProcedureRecord[]
  ): Promise<number> {
    let crossReferences = 0;
    
    try {
      // 1. Store equipment data
      for (const equipment of equipments) {
        const equipmentData: InsertEquipmentRegistry = {
          equipmentId: equipment.id,
          equipmentName: `${equipment.marque} ${equipment.modele}`.trim(),
          equipmentType: equipment.type,
          zone: equipment.localisation || 'Unknown',
          status: 'active',
          manufacturer: equipment.marque,
          model: equipment.modele,
          installationDate: equipment.dateService ? new Date(equipment.dateService) : new Date()
        };
        
        try {
          await storage.createEquipment(equipmentData);
        } catch (error) {
          console.log(`Equipment ${equipment.id} might already exist`);
        }
      }
      
      // 2. Process diagnostics with cross-references
      for (const diagnostic of diagnostics) {
        // Find corresponding equipment
        const equipment = equipments.find(eq => eq.id === diagnostic.equipmentId);
        
        if (equipment) {
          const maintenanceCase: InsertMaintenanceCase = {
            equipmentType: equipment.type,
            equipmentId: diagnostic.equipmentId,
            zone: equipment.localisation || 'Unknown',
            symptoms: diagnostic.symptomes,
            diagnosis: `${diagnostic.typeDiagnostic} - Criticité: ${diagnostic.criticite}`,
            solution: diagnostic.resultat,
            urgency: this.mapCriticalityToUrgency(diagnostic.criticite),
            confidence: 0.9, // High confidence for historical data
            duration: this.estimateDurationFromCriticality(diagnostic.criticite)
          };
          
          const createdCase = await storage.createMaintenanceCase(maintenanceCase);
          
          // 3. Add related procedures
          const relatedProcedures = procedures.filter(proc => proc.diagnosticId === diagnostic.id);
          
          let stepNumber = 1;
          for (const procedure of relatedProcedures) {
            const repairProcedure: InsertRepairProcedure = {
              caseId: createdCase.id,
              stepNumber: stepNumber++,
              title: `Étape ${procedure.etape}`,
              titleEn: `Step ${procedure.etape}`,
              description: procedure.description,
              descriptionEn: procedure.description,
              safetyWarning: procedure.securite,
              safetyWarningEn: procedure.securite,
              toolsRequired: procedure.outils ? [procedure.outils] : [],
              toolsRequiredEn: procedure.outils ? [procedure.outils] : [],
              estimatedTime: 30
            };
            
            await storage.createRepairProcedure(repairProcedure);
          }
          
          crossReferences++;
        }
      }
      
      console.log(`✅ Created ${crossReferences} cross-referenced maintenance cases`);
      return crossReferences;
      
    } catch (error) {
      console.error('❌ Error processing cross-references:', error);
      return crossReferences;
    }
  }
  
  private mapCriticalityToUrgency(criticite: string): string {
    const crit = criticite.toLowerCase();
    if (crit.includes('critique') || crit.includes('high') || crit.includes('urgent')) return 'high';
    if (crit.includes('moyen') || crit.includes('medium') || crit.includes('moderate')) return 'medium';
    return 'low';
  }
  
  private estimateDurationFromCriticality(criticite: string): number {
    const crit = criticite.toLowerCase();
    if (crit.includes('critique')) return 240; // 4 hours
    if (crit.includes('high')) return 180; // 3 hours
    if (crit.includes('moyen')) return 120; // 2 hours
    return 60; // 1 hour
  }
}