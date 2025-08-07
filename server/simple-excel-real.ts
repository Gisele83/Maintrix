import * as fs from 'fs';
import { storage } from './storage';
import type { 
  InsertMaintenanceCase, 
  InsertEquipmentRegistry, 
  InsertRepairProcedure 
} from '../shared/schema';

export class SimpleExcelReal {
  
  async processSimpleExcelData(): Promise<{
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
      console.log('📊 Processing Real Excel Data (Simple Method)...');
      
      // Use direct Python processing with subprocess  
      const { spawn } = await import('child_process');
      const pythonProcess = spawn('python3', ['-c', `
import pandas as pd
import json
import sys

try:
    # Read Excel file with all sheets
    file_path = 'attached_assets/Base_Industrie_120_Cas_Enrichie_1754590391833.xlsx'
    
    # Read each sheet separately
    equipments = pd.read_excel(file_path, sheet_name='Equipements')
    diagnostics = pd.read_excel(file_path, sheet_name='Diagnostics')  
    procedures = pd.read_excel(file_path, sheet_name='Procedures_Reparation')
    interventions = pd.read_excel(file_path, sheet_name='Interventions')
    regles = pd.read_excel(file_path, sheet_name='Regles_Symptomes')
    techniciens = pd.read_excel(file_path, sheet_name='Techniciens')
    
    # Convert to dict and output
    result = {
        'equipments': equipments.to_dict('records'),
        'diagnostics': diagnostics.to_dict('records'),
        'procedures': procedures.to_dict('records'),
        'interventions': interventions.to_dict('records'),
        'regles': regles.to_dict('records'),
        'techniciens': techniciens.to_dict('records')
    }
    
    print(json.dumps(result, default=str))
    
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
`]);
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      
      const result = await new Promise<any>((resolve, reject) => {
        pythonProcess.on('close', (code: number) => {
          if (code === 0) {
            try {
              const data = JSON.parse(stdout);
              resolve(data);
            } catch (e) {
              reject(new Error(`Failed to parse JSON: ${e}`));
            }
          } else {
            reject(new Error(`Python process exited with code ${code}: ${stderr}`));
          }
        });
      });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      console.log('📋 Successfully extracted Excel data:');
      console.log(`  - Équipements: ${result.equipments?.length || 0}`);
      console.log(`  - Diagnostics: ${result.diagnostics?.length || 0}`);
      console.log(`  - Procédures: ${result.procedures?.length || 0}`);
      console.log(`  - Interventions: ${result.interventions?.length || 0}`);
      console.log(`  - Règles: ${result.regles?.length || 0}`);
      console.log(`  - Techniciens: ${result.techniciens?.length || 0}`);
      
      // Process the real industrial data
      const crossReferences = await this.processRealIndustrialData(result);
      
      return {
        success: true,
        message: `Traitement réussi: ${crossReferences} cas industriels réels intégrés`,
        data: {
          equipments: result.equipments?.length || 0,
          diagnostics: result.diagnostics?.length || 0,
          procedures: result.procedures?.length || 0,
          crossReferences
        }
      };
      
    } catch (error: any) {
      console.error('❌ Simple Excel processing failed:', error.message);
      return {
        success: false,
        message: `Erreur traitement Excel: ${error.message}`,
        data: { equipments: 0, diagnostics: 0, procedures: 0, crossReferences: 0 }
      };
    }
  }
  
  private async processRealIndustrialData(data: any): Promise<number> {
    let processedCases = 0;
    
    try {
      const { equipments, diagnostics, procedures, interventions, regles } = data;
      
      console.log('🔄 Processing real industrial maintenance data...');
      
      // Create equipment registry from real data
      const equipmentMap = new Map<string, any>();
      
      if (equipments && Array.isArray(equipments)) {
        for (const equip of equipments) {
          try {
            const equipmentData: InsertEquipmentRegistry = {
              equipmentId: equip.ID?.toString() || `EQ-${Date.now()}`,
              equipmentName: `${equip.Marque || 'Unknown'} ${equip.Modèle || 'Model'}`.trim(),
              equipmentType: this.normalizeEquipmentType(equip.Type),
              zone: equip.Localisation || 'Zone industrielle',
              status: 'active',
              manufacturer: equip.Marque || 'Manufacturer',
              model: equip.Modèle || 'Model',
              installationDate: this.parseDate(equip['Date mise en service']) || new Date()
            };
            
            const created = await storage.createEquipment(equipmentData);
            equipmentMap.set(equip.ID?.toString(), { ...equip, dbId: created.id });
          } catch (error) {
            console.log(`Equipment ${equip.ID} may already exist, skipping...`);
            equipmentMap.set(equip.ID?.toString(), equip);
          }
        }
      }
      
      // Process diagnostic cases with cross-references
      if (diagnostics && Array.isArray(diagnostics)) {
        for (const diagnostic of diagnostics) {
          const equipmentId = diagnostic['Équipement ID']?.toString();
          const equipment = equipmentMap.get(equipmentId);
          
          if (equipment) {
            // Create enriched maintenance case
            const maintenanceCase: InsertMaintenanceCase = {
              equipmentType: this.normalizeEquipmentType(equipment.Type) || 'Moteur électrique',
              equipmentId: equipmentId,
              zone: equipment.Localisation || 'Zone industrielle',
              symptoms: diagnostic['Symptômes détectés'] || diagnostic.Symptomes || 'Symptômes industriels',
              diagnosis: this.buildDiagnosis(diagnostic),
              solution: diagnostic['Solution recommandée'] || diagnostic.Solution || 'Solution industrielle à appliquer',
              urgency: this.mapCriticalityToUrgency(diagnostic['Criticité'] || diagnostic.Urgence),
              confidence: 0.98, // High confidence for real industrial data
              duration: this.estimateDurationFromDiagnostic(diagnostic)
            };
            
            const createdCase = await storage.createMaintenanceCase(maintenanceCase);
            
            // Add repair procedures if available
            const relatedProcedures = procedures?.filter((proc: any) => 
              proc['Équipement ID']?.toString() === equipmentId ||
              proc['Diagnostic ID']?.toString() === diagnostic.ID?.toString()
            );
            
            if (relatedProcedures && relatedProcedures.length > 0) {
              let stepNumber = 1;
              for (const procedure of relatedProcedures.slice(0, 5)) { // Max 5 steps
                const repairProcedure: InsertRepairProcedure = {
                  caseId: createdCase.id,
                  stepNumber: stepNumber++,
                  title: `Étape réparation ${procedure.ID || stepNumber}`,
                  titleEn: `Repair step ${procedure.ID || stepNumber}`,
                  description: procedure['Procédure détaillée'] || procedure.Description || 'Procédure de réparation industrielle',
                  descriptionEn: procedure['Procédure détaillée'] || procedure.Description || 'Industrial repair procedure',
                  safetyWarning: 'Respecter les consignes de sécurité industrielle',
                  safetyWarningEn: 'Follow industrial safety guidelines',
                  toolsRequired: this.extractTools(procedure),
                  toolsRequiredEn: this.extractTools(procedure),
                  estimatedTime: parseInt(procedure['Durée estimée']?.toString()) || 30
                };
                
                await storage.createRepairProcedure(repairProcedure);
              }
            }
            
            processedCases++;
          }
        }
      }
      
      console.log(`✅ Successfully processed ${processedCases} real industrial maintenance cases`);
      return processedCases;
      
    } catch (error) {
      console.error('❌ Error processing real industrial data:', error);
      return processedCases;
    }
  }
  
  private normalizeEquipmentType(type: string): string {
    if (!type) return 'equipement';
    
    const typeMap: { [key: string]: string } = {
      'RTG': 'grue',
      'STS': 'grue', 
      'Grue portuaire': 'grue',
      'Grue': 'grue',
      'Reachtaker': 'chariot',
      'Chariot élévateur': 'chariot',
      'Groupe électrogène': 'generateur',
      'Générateur': 'generateur',
      'Serveur Huawei': 'serveur',
      'Serveur': 'serveur',
      'Onduleur industriel': 'onduleur',
      'Onduleur': 'onduleur',
      'Variateur de puissance': 'variateur',
      'Variateur': 'variateur',
      'Transformateur HT/MT': 'transformateur',
      'Transformateur': 'transformateur',
      'Tableau de distribution électrique': 'tableau',
      'Tableau électrique': 'tableau',
      'Moteur': 'moteur',
      'Pompe': 'pompe',
      'Compresseur': 'compresseur',
      'Convoyeur': 'convoyeur'
    };
    
    return typeMap[type] || type.toLowerCase().replace(/[^a-z]/g, '');
  }
  
  private buildDiagnosis(diagnostic: any): string {
    const parts = [];
    if (diagnostic['Type diagnostic']) parts.push(diagnostic['Type diagnostic']);
    if (diagnostic['Criticité']) parts.push(`Criticité: ${diagnostic['Criticité']}`);
    if (diagnostic['Résultat']) parts.push(diagnostic['Résultat']);
    if (diagnostic.Diagnostic) parts.push(diagnostic.Diagnostic);
    
    return parts.length > 0 ? parts.join(' - ') : 'Diagnostic industriel';
  }
  
  private mapCriticalityToUrgency(criticite: string): string {
    if (!criticite) return 'medium';
    
    const crit = criticite.toLowerCase();
    if (crit.includes('critique') || crit.includes('élevée') || crit.includes('high') || crit.includes('urgent')) return 'high';
    if (crit.includes('moyenne') || crit.includes('medium') || crit.includes('moderate')) return 'medium';
    return 'low';
  }
  
  private estimateDurationFromDiagnostic(diagnostic: any): number {
    // Base duration
    let duration = 120; // 2 hours default
    
    if (diagnostic['Durée estimée']) {
      const parsed = parseInt(diagnostic['Durée estimée'].toString());
      if (!isNaN(parsed)) return parsed;
    }
    
    if (diagnostic['Type diagnostic']) {
      const type = diagnostic['Type diagnostic'].toLowerCase();
      if (type.includes('correctif') || type.includes('repair')) duration = 180;
      if (type.includes('préventif') || type.includes('preventive')) duration = 90;
    }
    
    if (diagnostic['Criticité']) {
      const crit = diagnostic['Criticité'].toLowerCase();
      if (crit.includes('critique')) duration += 120;
      else if (crit.includes('élevée')) duration += 60;
    }
    
    return Math.min(duration, 480); // Max 8 hours
  }
  
  private extractTools(procedure: any): string[] {
    const defaultTools = ['Outillage standard maintenance', 'EPI obligatoires'];
    
    if (procedure.Outils) {
      return procedure.Outils.split(',').map((tool: string) => tool.trim());
    }
    
    if (procedure['Matériel requis']) {
      return procedure['Matériel requis'].split(',').map((tool: string) => tool.trim());
    }
    
    return defaultTools;
  }
  
  private parseDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }
}