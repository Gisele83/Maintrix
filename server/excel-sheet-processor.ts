import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { storage } from './storage';
import type { 
  InsertMaintenanceCase, 
  InsertEquipmentRegistry, 
  InsertRepairProcedure 
} from '../shared/schema';

interface ExcelData {
  equipements: any[];
  diagnostics: any[];
  interventions: any[];
  techniciens: any[];
  reglesSymptomes: any[];
  proceduresReparation: any[];
}

export class ExcelSheetProcessor {
  
  async processMultiTableExcel(filePath: string): Promise<{
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
      console.log('📊 Processing Excel file with 6 sheets...');
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Read Excel file
      const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
      
      // Extract data from all sheets
      const data = await this.extractAllSheets(workbook);
      
      console.log(`📋 Extracted data:
        - Équipements: ${data.equipements.length}
        - Diagnostics: ${data.diagnostics.length}
        - Interventions: ${data.interventions.length}
        - Techniciens: ${data.techniciens.length}
        - Règles Symptômes: ${data.reglesSymptomes.length}
        - Procédures Réparation: ${data.proceduresReparation.length}`);
      
      // Process cross-references and store in database
      const crossReferences = await this.processCrossReferencedData(data);
      
      return {
        success: true,
        message: `Traitement terminé: ${data.equipements.length} équipements, ${data.diagnostics.length} diagnostics, ${data.proceduresReparation.length} procédures`,
        data: {
          equipments: data.equipements.length,
          diagnostics: data.diagnostics.length,
          procedures: data.proceduresReparation.length,
          crossReferences
        }
      };
      
    } catch (error: any) {
      console.error('❌ Excel processing failed:', error);
      return {
        success: false,
        message: `Erreur lors du traitement Excel: ${error.message}`,
        data: { equipments: 0, diagnostics: 0, procedures: 0, crossReferences: 0 }
      };
    }
  }
  
  private async extractAllSheets(workbook: XLSX.WorkBook): Promise<ExcelData> {
    const data: ExcelData = {
      equipements: [],
      diagnostics: [],
      interventions: [],
      techniciens: [],
      reglesSymptomes: [],
      proceduresReparation: []
    };
    
    // Sheet 1: Équipements
    if (workbook.Sheets['Equipements']) {
      data.equipements = XLSX.utils.sheet_to_json(workbook.Sheets['Equipements']);
    }
    
    // Sheet 2: Diagnostics
    if (workbook.Sheets['Diagnostics']) {
      data.diagnostics = XLSX.utils.sheet_to_json(workbook.Sheets['Diagnostics']);
    }
    
    // Sheet 3: Interventions
    if (workbook.Sheets['Interventions']) {
      data.interventions = XLSX.utils.sheet_to_json(workbook.Sheets['Interventions']);
    }
    
    // Sheet 4: Techniciens
    if (workbook.Sheets['Techniciens']) {
      data.techniciens = XLSX.utils.sheet_to_json(workbook.Sheets['Techniciens']);
    }
    
    // Sheet 5: Règles_Symptomes
    if (workbook.Sheets['Regles_Symptomes']) {
      data.reglesSymptomes = XLSX.utils.sheet_to_json(workbook.Sheets['Regles_Symptomes']);
    }
    
    // Sheet 6: Procedures_Reparation
    if (workbook.Sheets['Procedures_Reparation']) {
      data.proceduresReparation = XLSX.utils.sheet_to_json(workbook.Sheets['Procedures_Reparation']);
    }
    
    return data;
  }
  
  private async processCrossReferencedData(data: ExcelData): Promise<number> {
    let crossReferences = 0;
    
    try {
      // 1. Store equipment data first
      const equipmentMap = new Map<string, any>();
      
      for (const equip of data.equipements) {
        const equipmentData: InsertEquipmentRegistry = {
          equipmentId: equip.ID,
          equipmentName: `${equip.Marque} ${equip.Modèle}`.trim(),
          equipmentType: this.normalizeEquipmentType(equip.Type),
          zone: equip.Localisation || 'Unknown',
          status: 'active',
          manufacturer: equip.Marque,
          model: equip.Modèle,
          installationDate: equip['Date mise en service'] ? new Date(equip['Date mise en service']) : new Date()
        };
        
        try {
          const created = await storage.createEquipment(equipmentData);
          equipmentMap.set(equip.ID, { ...equip, dbId: created.id });
        } catch (error) {
          console.log(`Equipment ${equip.ID} might already exist`);
          equipmentMap.set(equip.ID, equip);
        }
      }
      
      // 2. Process diagnostics with cross-references to equipment
      for (const diagnostic of data.diagnostics) {
        const equipmentId = diagnostic['Équipement ID'];
        const equipment = equipmentMap.get(equipmentId);
        
        if (equipment) {
          // Create maintenance case from diagnostic
          const maintenanceCase: InsertMaintenanceCase = {
            equipmentType: this.normalizeEquipmentType(equipment.Type),
            equipmentId: equipmentId,
            zone: equipment.Localisation || 'Unknown',
            symptoms: diagnostic['Symptômes détectés'] || 'Symptôme non spécifié',
            diagnosis: `${diagnostic['Type diagnostic']} - ${diagnostic['Criticité']}`,
            solution: diagnostic['Résultat'] || 'Solution à déterminer',
            urgency: this.mapCriticalityToUrgency(diagnostic['Criticité']),
            confidence: 0.95, // High confidence for real historical data
            duration: this.estimateDurationFromType(diagnostic['Type diagnostic'], diagnostic['Criticité'])
          };
          
          const createdCase = await storage.createMaintenanceCase(maintenanceCase);
          
          // 3. Add procedures from Procedures_Reparation sheet
          const relatedProcedures = data.proceduresReparation.filter(proc => 
            proc['Équipement ID'] === equipmentId
          );
          
          let stepNumber = 1;
          for (const procedure of relatedProcedures) {
            const repairProcedure: InsertRepairProcedure = {
              caseId: createdCase.id,
              stepNumber: stepNumber++,
              title: `Procédure ${procedure.ID}`,
              titleEn: `Procedure ${procedure.ID}`,
              description: procedure['Procédure détaillée'] || 'Procédure détaillée non disponible',
              descriptionEn: procedure['Procédure détaillée'] || 'Detailed procedure not available',
              safetyWarning: 'Suivre les consignes de sécurité standard',
              safetyWarningEn: 'Follow standard safety guidelines',
              toolsRequired: ['Outils standards de maintenance'],
              toolsRequiredEn: ['Standard maintenance tools'],
              estimatedTime: 30
            };
            
            await storage.createRepairProcedure(repairProcedure);
          }
          
          crossReferences++;
        }
      }
      
      console.log(`✅ Created ${crossReferences} cross-referenced maintenance cases from real Excel data`);
      return crossReferences;
      
    } catch (error) {
      console.error('❌ Error processing cross-references:', error);
      return crossReferences;
    }
  }
  
  private normalizeEquipmentType(type: string): string {
    const typeMap: { [key: string]: string } = {
      'RTG': 'grue',
      'STS': 'grue',
      'Grue portuaire': 'grue',
      'Reachtaker': 'chariot',
      'Groupe électrogène': 'generateur',
      'Serveur Huawei': 'serveur',
      'Onduleur industriel': 'onduleur',
      'Variateur de puissance': 'variateur',
      'Transformateur HT/MT': 'transformateur',
      'Tableau de distribution électrique': 'tableau'
    };
    
    return typeMap[type] || type.toLowerCase();
  }
  
  private mapCriticalityToUrgency(criticite: string): string {
    if (!criticite) return 'medium';
    
    const crit = criticite.toLowerCase();
    if (crit.includes('critique') || crit.includes('élevée') || crit.includes('high')) return 'high';
    if (crit.includes('moyenne') || crit.includes('medium') || crit.includes('moderate')) return 'medium';
    return 'low';
  }
  
  private estimateDurationFromType(typeDiagnostic: string, criticite: string): number {
    const baseTime = typeDiagnostic && typeDiagnostic.toLowerCase().includes('correctif') ? 180 : 120;
    
    if (criticite && criticite.toLowerCase().includes('critique')) {
      return baseTime + 120; // Add 2 hours for critical issues
    }
    
    return baseTime;
  }
}