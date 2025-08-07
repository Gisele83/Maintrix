import * as fs from 'fs';
import { storage } from './storage';
import type { 
  InsertMaintenanceCase, 
  InsertEquipmentRegistry, 
  InsertRepairProcedure 
} from '../shared/schema';

export class ExcelRealProcessor {
  
  async processRealExcelData(): Promise<{
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
      console.log('📊 Processing Real Excel Data from attached file...');
      
      // Use Python to process the Excel file
      const { exec } = require('child_process');
      const result = await new Promise<string>((resolve, reject) => {
        exec(`python3 -c "
import pandas as pd
import json

try:
    # Read all sheets
    xl_file = pd.ExcelFile('attached_assets/Base_Industrie_120_Cas_Enrichie_1754590391833.xlsx')
    
    data = {}
    for sheet_name in xl_file.sheet_names:
        df = pd.read_excel(xl_file, sheet_name=sheet_name)
        data[sheet_name] = df.to_dict('records')
    
    # Output JSON
    print(json.dumps(data, default=str))
    
except Exception as e:
    print(json.dumps({'error': str(e)}))
"`, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout.trim());
          }
        });
      });
      
      const excelData = JSON.parse(result);
      
      if (excelData.error) {
        throw new Error(excelData.error);
      }
      
      console.log('📋 Extracted real Excel data:', Object.keys(excelData).map(key => `${key}: ${excelData[key].length} records`));
      
      // Process the real data
      const crossReferences = await this.processRealData(excelData);
      
      return {
        success: true,
        message: `Traitement réel terminé: ${crossReferences} cas industriels importés`,
        data: {
          equipments: excelData.Equipements?.length || 0,
          diagnostics: excelData.Diagnostics?.length || 0,
          procedures: excelData.Procedures_Reparation?.length || 0,
          crossReferences
        }
      };
      
    } catch (error: any) {
      console.error('❌ Real Excel processing failed:', error);
      return {
        success: false,
        message: `Erreur traitement Excel réel: ${error.message}`,
        data: { equipments: 0, diagnostics: 0, procedures: 0, crossReferences: 0 }
      };
    }
  }
  
  private async processRealData(excelData: any): Promise<number> {
    let crossReferences = 0;
    
    try {
      const equipments = excelData.Equipements || [];
      const diagnostics = excelData.Diagnostics || [];
      const procedures = excelData.Procedures_Reparation || [];
      
      console.log(`🔄 Processing cross-references: ${equipments.length} équipements, ${diagnostics.length} diagnostics, ${procedures.length} procédures`);
      
      // 1. Store real equipment data
      const equipmentMap = new Map<string, any>();
      
      for (const equip of equipments) {
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
          // Equipment might already exist
          equipmentMap.set(equip.ID, equip);
        }
      }
      
      // 2. Process real diagnostics with full cross-references
      for (const diagnostic of diagnostics) {
        const equipmentId = diagnostic['Équipement ID'];
        const equipment = equipmentMap.get(equipmentId);
        
        if (equipment) {
          // Create maintenance case from real diagnostic data
          const maintenanceCase: InsertMaintenanceCase = {
            equipmentType: this.normalizeEquipmentType(equipment.Type),
            equipmentId: equipmentId,
            zone: equipment.Localisation || 'Unknown',
            symptoms: diagnostic['Symptômes détectés'] || 'Symptôme non spécifié',
            diagnosis: `${diagnostic['Type diagnostic']} - ${diagnostic['Criticité']} - ${diagnostic['Résultat']}`,
            solution: diagnostic['Résultat'] || 'Solution à déterminer',
            urgency: this.mapCriticalityToUrgency(diagnostic['Criticité']),
            confidence: 0.98, // Very high confidence for real industrial data
            duration: this.estimateDurationFromType(diagnostic['Type diagnostic'], diagnostic['Criticité'])
          };
          
          const createdCase = await storage.createMaintenanceCase(maintenanceCase);
          
          // 3. Add real procedures from Procedures_Reparation
          const relatedProcedures = procedures.filter(proc => 
            proc['Équipement ID'] === equipmentId
          );
          
          let stepNumber = 1;
          for (const procedure of relatedProcedures) {
            const repairProcedure: InsertRepairProcedure = {
              caseId: createdCase.id,
              stepNumber: stepNumber++,
              title: `Procédure réparation ${procedure.ID}`,
              titleEn: `Repair procedure ${procedure.ID}`,
              description: procedure['Procédure détaillée'] || 'Procédure détaillée industrielle',
              descriptionEn: procedure['Procédure détaillée'] || 'Industrial detailed procedure',
              safetyWarning: 'Respecter les procédures de sécurité industrielle',
              safetyWarningEn: 'Follow industrial safety procedures',
              toolsRequired: ['Outillage spécialisé maintenance industrielle'],
              toolsRequiredEn: ['Specialized industrial maintenance tools'],
              estimatedTime: 45
            };
            
            await storage.createRepairProcedure(repairProcedure);
          }
          
          crossReferences++;
        }
      }
      
      console.log(`✅ Successfully processed ${crossReferences} real industrial maintenance cases`);
      return crossReferences;
      
    } catch (error) {
      console.error('❌ Error processing real cross-references:', error);
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
      return baseTime + 120;
    }
    
    return baseTime;
  }
}