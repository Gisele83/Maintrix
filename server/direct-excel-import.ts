import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { storage } from './storage';
import type { 
  InsertMaintenanceCase, 
  InsertEquipmentRegistry, 
  InsertRepairProcedure 
} from '../shared/schema';

const execAsync = promisify(exec);

export class DirectExcelImport {
  
  async importRealData(): Promise<{
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
      console.log('📊 Starting direct Excel import of real industrial data...');
      
      // Read the Excel data using Python subprocess
      const pythonScript = `
import pandas as pd
import json

file_path = 'attached_assets/Base_Industrie_120_Cas_Enrichie_1754590391833.xlsx'

# Read all sheets
equipments = pd.read_excel(file_path, sheet_name='Equipements').to_dict('records')
diagnostics = pd.read_excel(file_path, sheet_name='Diagnostics').to_dict('records')
procedures = pd.read_excel(file_path, sheet_name='Procedures_Reparation').to_dict('records')
regles = pd.read_excel(file_path, sheet_name='Regles_Symptomes').to_dict('records')

result = {
    'equipments': equipments,
    'diagnostics': diagnostics, 
    'procedures': procedures,
    'regles': regles
}

print(json.dumps(result, default=str))
      `;
      
      const { stdout } = await execAsync(`python3 -c "${pythonScript}"`);
      const data = JSON.parse(stdout);
      
      console.log(`📋 Extracted data: ${data.equipments.length} équipements, ${data.diagnostics.length} diagnostics, ${data.procedures.length} procédures, ${data.regles.length} règles`);
      
      // Process the extracted data
      const crossReferences = await this.processIndustrialData(data);
      
      return {
        success: true,
        message: `Import réussi: ${crossReferences} cas industriels réels intégrés avec succès`,
        data: {
          equipments: data.equipments.length,
          diagnostics: data.diagnostics.length, 
          procedures: data.procedures.length,
          crossReferences
        }
      };
      
    } catch (error: any) {
      console.error('❌ Direct Excel import failed:', error.message);
      return {
        success: false,
        message: `Erreur import direct: ${error.message}`,
        data: { equipments: 0, diagnostics: 0, procedures: 0, crossReferences: 0 }
      };
    }
  }
  
  private async processIndustrialData(data: any): Promise<number> {
    let processed = 0;
    
    try {
      console.log('🔄 Processing industrial maintenance data...');
      
      const { equipments, diagnostics, procedures, regles } = data;
      
      // 1. Create equipment registry from Excel file
      const equipmentMap = new Map();
      console.log(`📦 Processing ${equipments.length} equipment entries from Excel...`);
      
      for (const eq of equipments) {
        try {
          const equipmentData: InsertEquipmentRegistry = {
            equipmentId: eq.ID?.toString() || `EQ-${processed}`,
            equipmentName: `${eq.Marque || 'Marque'} ${eq.Modèle || 'Modèle'}`,
            equipmentType: this.normalizeType(eq.Type),
            zone: eq.Localisation || 'Zone industrielle',
            manufacturer: eq.Marque || 'Fabricant',
            model: eq.Modèle || 'Modèle',
            installationDate: new Date(eq['Date mise en service'] || new Date())
          };
          
          // Import directly to database
          const { db } = await import('./db');
          const { equipmentRegistry } = await import('@shared/schema');
          const [created] = await db.insert(equipmentRegistry).values(equipmentData).returning();
          console.log(`✅ Equipment created: ${created.equipmentId} - ${created.equipmentName}`);
          equipmentMap.set(eq.ID, { ...eq, dbId: created.id });
        } catch (error: any) {
          console.error(`❌ Failed to create equipment ${eq.ID}:`, error.message);
          equipmentMap.set(eq.ID, eq); // Keep processing
        }
      }
      
      // 2. Create maintenance cases from diagnostics
      for (const diag of diagnostics) {
        const equipment = equipmentMap.get(diag['Équipement ID']);
        if (equipment) {
          
          // Find related rules
          const relatedRules = regles.filter((rule: any) => 
            rule['Équipement ID'] === diag['Équipement ID']
          );
          
          const symptoms = diag['Symptômes détectés'] || 
                          relatedRules.map((r: any) => r.Symptôme).join(', ') || 
                          'Symptômes industriels détectés';
          
          const diagnosis = relatedRules.length > 0 ? 
                           relatedRules[0]['Diagnostic proposé'] || diag['Type diagnostic'] :
                           diag['Type diagnostic'] || 'Diagnostic industriel';
          
          const maintenanceCase: InsertMaintenanceCase = {
            equipmentType: this.normalizeType(equipment.Type),
            equipmentId: diag['Équipement ID']?.toString(),
            zone: equipment.Localisation || 'Zone industrielle',
            symptoms,
            diagnosis,
            solution: diag['Action recommandée'] || diag['Résultat'] || 'Solution industrielle adaptée',
            urgency: this.mapCriticality(diag['Criticité']),
            confidence: 0.98,
            duration: parseInt(diag['Temps intervention estimé']) || 120
          };
          
          const createdCase = await storage.createMaintenanceCase(maintenanceCase);
          
          // 3. Add repair procedures
          const relatedProcedures = procedures.filter((proc: any) => 
            proc['Équipement ID'] === diag['Équipement ID']
          );
          
          let stepNum = 1;
          for (const proc of relatedProcedures.slice(0, 3)) {
            const procedure: InsertRepairProcedure = {
              caseId: createdCase.id,
              stepNumber: stepNum++,
              title: `Procédure réparation ${proc.ID}`,
              titleEn: `Repair procedure ${proc.ID}`,
              description: proc['Procédure détaillée'] || 'Procédure de maintenance industrielle',
              descriptionEn: proc['Procédure détaillée'] || 'Industrial maintenance procedure',
              safetyWarning: 'Respecter les consignes de sécurité',
              safetyWarningEn: 'Follow safety guidelines',
              toolsRequired: ['Outillage spécialisé'],
              toolsRequiredEn: ['Specialized tools'],
              estimatedTime: 45
            };
            
            await storage.createRepairProcedure(procedure);
          }
          
          processed++;
        }
      }
      
      console.log(`✅ Successfully processed ${processed} industrial maintenance cases`);
      return processed;
      
    } catch (error) {
      console.error('❌ Processing error:', error);
      return processed;
    }
  }
  
  private normalizeType(type: string): string {
    if (!type) return 'equipement';
    
    const normalized = type.toLowerCase();
    if (normalized.includes('grue') || normalized.includes('rtg') || normalized.includes('sts')) return 'grue';
    if (normalized.includes('moteur')) return 'moteur';
    if (normalized.includes('pompe')) return 'pompe';
    if (normalized.includes('compresseur')) return 'compresseur';
    if (normalized.includes('transformateur')) return 'transformateur';
    if (normalized.includes('variateur')) return 'variateur';
    if (normalized.includes('convoyeur')) return 'convoyeur';
    
    return normalized.replace(/[^a-z]/g, '');
  }
  
  private mapCriticality(criticite: string): string {
    if (!criticite) return 'medium';
    
    const c = criticite.toLowerCase();
    if (c.includes('critique') || c.includes('urgent') || c.includes('élevé')) return 'high';
    if (c.includes('moyen')) return 'medium';
    return 'low';
  }
}