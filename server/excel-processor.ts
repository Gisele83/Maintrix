import * as XLSX from 'xlsx';
import { storage } from './storage';
import fs from 'fs';
import path from 'path';
import type { InsertMaintenanceCase } from '../shared/schema';

export interface ProcessedExcelData {
  maintenanceCases: number;
  equipment: number;
  workOrders: number;
  spareParts: number;
  success: boolean;
  message: string;
}

export class ExcelHistoryProcessor {
  
  async processUserExcelFile(filePath: string): Promise<ProcessedExcelData> {
    try {
      console.log(`Processing Excel file: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;
      console.log(`Found ${sheetNames.length} sheets:`, sheetNames);

      let processedData: ProcessedExcelData = {
        maintenanceCases: 0,
        equipment: 0,
        workOrders: 0,
        spareParts: 0,
        success: false,
        message: ''
      };

      // Process each sheet
      for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        console.log(`Processing sheet "${sheetName}" with ${data.length} rows`);
        
        if (data.length === 0) continue;

        // Analyze column headers to determine sheet type
        const headers = Object.keys(data[0] as object).map(h => h.toLowerCase());
        console.log(`Headers in ${sheetName}:`, headers);

        // Process based on detected content type
        if (this.isMaintenanceCaseSheet(headers)) {
          const cases = await this.processMaintenanceCases(data);
          processedData.maintenanceCases += cases;
        } else if (this.isEquipmentSheet(headers)) {
          const equipment = await this.processEquipment(data);
          processedData.equipment += equipment;
        } else if (this.isWorkOrderSheet(headers)) {
          const workOrders = await this.processWorkOrders(data);
          processedData.workOrders += workOrders;
        } else if (this.isSparePartsSheet(headers)) {
          const spareParts = await this.processSpareParts(data);
          processedData.spareParts += spareParts;
        } else {
          // Try to extract maintenance cases from any sheet with relevant data
          const extractedCases = await this.extractMaintenanceCasesFromGenericData(data);
          processedData.maintenanceCases += extractedCases;
        }
      }

      processedData.success = true;
      processedData.message = `Fichier Excel traité avec succès: ${processedData.maintenanceCases} cas de maintenance, ${processedData.equipment} équipements, ${processedData.workOrders} ordres de travail, ${processedData.spareParts} pièces détachées`;
      
      return processedData;
    } catch (error: any) {
      console.error('Error processing Excel file:', error);
      return {
        maintenanceCases: 0,
        equipment: 0,
        workOrders: 0,
        spareParts: 0,
        success: false,
        message: `Erreur lors du traitement: ${error?.message || 'Erreur inconnue'}`
      };
    }
  }

  async processDefaultHistoricalFile(): Promise<ProcessedExcelData> {
    const defaultFilePath = path.join(process.cwd(), 'attached_assets', 'Base_Industrie_120_Cas_Enrichie_1754588437015.xlsx');
    return await this.processUserExcelFile(defaultFilePath);
  }

  private isMaintenanceCaseSheet(headers: string[]): boolean {
    const maintenanceKeywords = ['symptom', 'diagnostic', 'solution', 'maintenance', 'panne', 'reparation', 'intervention'];
    return maintenanceKeywords.some(keyword => 
      headers.some(header => header.includes(keyword))
    );
  }

  private isEquipmentSheet(headers: string[]): boolean {
    const equipmentKeywords = ['equipment', 'equipement', 'machine', 'type', 'model', 'marque'];
    return equipmentKeywords.some(keyword => 
      headers.some(header => header.includes(keyword))
    );
  }

  private isWorkOrderSheet(headers: string[]): boolean {
    const workOrderKeywords = ['order', 'ordre', 'travail', 'work', 'intervention', 'ticket'];
    return workOrderKeywords.some(keyword => 
      headers.some(header => header.includes(keyword))
    );
  }

  private isSparePartsSheet(headers: string[]): boolean {
    const sparePartKeywords = ['part', 'piece', 'spare', 'rechange', 'composant', 'reference'];
    return sparePartKeywords.some(keyword => 
      headers.some(header => header.includes(keyword))
    );
  }

  private async processMaintenanceCases(data: any[]): Promise<number> {
    let processedCount = 0;
    
    for (const row of data) {
      try {
        const maintenanceCase = this.extractMaintenanceCaseFromRow(row);
        if (maintenanceCase) {
          await storage.createMaintenanceCase(maintenanceCase);
          processedCount++;
        }
      } catch (error: any) {
        console.error('Error processing maintenance case:', error);
      }
    }
    
    return processedCount;
  }

  private async processEquipment(data: any[]): Promise<number> {
    // For now, we'll skip equipment processing since storage doesn't have this method
    console.log(`Skipping ${data.length} equipment rows - not implemented yet`);
    return 0;
  }

  private async processWorkOrders(data: any[]): Promise<number> {
    // For now, we'll skip work order processing since storage doesn't have this method
    console.log(`Skipping ${data.length} work order rows - not implemented yet`);
    return 0;
  }

  private async processSpareParts(data: any[]): Promise<number> {
    // For now, we'll skip spare parts processing since storage doesn't have this method
    console.log(`Skipping ${data.length} spare parts rows - not implemented yet`);
    return 0;
  }

  private async extractMaintenanceCasesFromGenericData(data: any[]): Promise<number> {
    let processedCount = 0;
    
    for (const row of data) {
      try {
        const maintenanceCase = this.extractMaintenanceCaseFromGenericRow(row);
        if (maintenanceCase) {
          await storage.createMaintenanceCase(maintenanceCase);
          processedCount++;
        }
      } catch (error: any) {
        console.error('Error extracting maintenance case from generic data:', error);
      }
    }
    
    return processedCount;
  }

  private extractMaintenanceCaseFromRow(row: any): InsertMaintenanceCase | null {
    const keys = Object.keys(row);
    
    // Find relevant columns by content matching
    let equipmentType = '';
    let symptoms = '';
    let diagnosis = '';
    let solution = '';
    let duration = 60;
    let confidence = 80;
    let zone = '';
    let sector = '';

    for (const key of keys) {
      const value = String(row[key] || '').trim();
      const lowerKey = key.toLowerCase();
      const lowerValue = value.toLowerCase();

      if (lowerKey.includes('type') || lowerKey.includes('equipement') || lowerKey.includes('machine')) {
        equipmentType = this.normalizeEquipmentType(value);
      } else if (lowerKey.includes('symptom') || lowerKey.includes('panne') || lowerKey.includes('probleme')) {
        symptoms = value;
      } else if (lowerKey.includes('diagnostic') || lowerKey.includes('cause')) {
        diagnosis = value;
      } else if (lowerKey.includes('solution') || lowerKey.includes('reparation') || lowerKey.includes('action')) {
        solution = value;
      } else if (lowerKey.includes('duree') || lowerKey.includes('temps') || lowerKey.includes('time')) {
        duration = this.extractDuration(value);
      } else if (lowerKey.includes('zone') || lowerKey.includes('lieu')) {
        zone = value;
      } else if (lowerKey.includes('secteur') || lowerKey.includes('service')) {
        sector = value;
      }
    }

    if (equipmentType && (symptoms || diagnosis)) {
      return {
        equipmentType,
        symptoms: symptoms || diagnosis,
        urgency: 'medium', // Default urgency
        diagnosis: diagnosis || `Diagnostic pour ${equipmentType}`,
        solution: solution || `Solution pour ${equipmentType}`,
        duration,
        confidence,
        zone: zone || 'production',
        sector: sector || 'maintenance',
        symptomsChecked: this.extractSymptomsList(symptoms)
      };
    }

    return null;
  }

  private extractMaintenanceCaseFromGenericRow(row: any): InsertMaintenanceCase | null {
    // More flexible extraction for generic data
    const values = Object.values(row).map(v => String(v || '').trim()).filter(v => v.length > 0);
    
    if (values.length < 2) return null;

    // Try to identify equipment type from any field
    let equipmentType = '';
    let symptoms = '';
    let diagnosis = '';

    for (const value of values) {
      const normalized = this.normalizeEquipmentType(value);
      if (normalized && !equipmentType) {
        equipmentType = normalized;
      } else if (value.length > 10 && !symptoms) {
        symptoms = value;
      } else if (value.length > 5 && !diagnosis) {
        diagnosis = value;
      }
    }

    if (equipmentType && symptoms) {
      return {
        equipmentType,
        symptoms,
        urgency: 'medium', // Default urgency
        diagnosis: diagnosis || `Diagnostic pour ${equipmentType}`,
        solution: `Solution pour ${equipmentType} - ${symptoms}`,
        duration: 60,
        confidence: 70,
        zone: 'production',
        sector: 'maintenance',
        symptomsChecked: this.extractSymptomsList(symptoms)
      };
    }

    return null;
  }

  private extractEquipmentFromRow(row: any): any | null {
    // Implementation for equipment extraction
    return null; // Simplified for now
  }

  private extractWorkOrderFromRow(row: any): any | null {
    // Implementation for work order extraction
    return null; // Simplified for now
  }

  private extractSparePartFromRow(row: any): any | null {
    // Implementation for spare part extraction
    return null; // Simplified for now
  }

  private normalizeEquipmentType(value: string): string {
    const normalized = value.toLowerCase().trim();
    
    if (normalized.includes('moteur') || normalized.includes('motor')) return 'moteur';
    if (normalized.includes('pompe') || normalized.includes('pump')) return 'pompe';
    if (normalized.includes('compresseur') || normalized.includes('compressor')) return 'compresseur';
    if (normalized.includes('convoyeur') || normalized.includes('conveyor')) return 'convoyeur';
    if (normalized.includes('turbine')) return 'turbine';
    if (normalized.includes('generateur') || normalized.includes('generator')) return 'generateur';
    if (normalized.includes('transformateur') || normalized.includes('transformer')) return 'transformateur';
    
    return '';
  }

  private extractDuration(value: string): number {
    const match = value.match(/(\d+)/);
    return match ? parseInt(match[1]) : 60;
  }

  private extractSymptomsList(symptoms: string): string[] {
    if (!symptoms) return [];
    
    const commonSymptoms = ['vibration', 'bruit', 'chauffe', 'fuite', 'panne', 'arret', 'lenteur'];
    const found: string[] = [];
    
    const lowerSymptoms = symptoms.toLowerCase();
    for (const symptom of commonSymptoms) {
      if (lowerSymptoms.includes(symptom)) {
        found.push(symptom);
      }
    }
    
    return found;
  }
}