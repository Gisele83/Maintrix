import { storage } from "./storage";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { z } from "zod";

// Schema pour valider les données d'importation
const ImportMaintenanceCaseSchema = z.object({
  equipmentType: z.string().min(1),
  equipmentId: z.string().optional(),
  zone: z.string().optional(),
  sector: z.string().optional(),
  symptoms: z.string().min(1),
  symptomsChecked: z.array(z.string()).optional(),
  diagnosis: z.string().min(1),
  solution: z.string().min(1),
  duration: z.number().min(1).optional(),
  urgency: z.enum(["low", "medium", "high"]).default("medium"),
  riskLevel: z.string().optional(),
  costEstimate: z.string().optional(),
  dateOccurred: z.string().optional(), // Format ISO date
  technician: z.string().optional(),
  notes: z.string().optional(),
});

const ImportReportedCaseSchema = z.object({
  equipmentType: z.string().min(1),
  equipmentId: z.string().optional(),
  zone: z.string().optional(),
  sector: z.string().optional(),
  description: z.string().min(1),
  urgency: z.enum(["low", "medium", "high"]).default("medium"),
  reportedBy: z.string().min(1),
  dateReported: z.string().optional(),
  status: z.enum(["pending", "in_progress", "resolved", "rejected"]).default("pending"),
});

export class DataImporter {
  constructor() {}

  /**
   * Importe des cas de maintenance depuis un fichier CSV
   */
  async importMaintenanceCasesFromCSV(csvContent: string): Promise<{
    success: number;
    errors: Array<{ line: number; error: string; data: any }>;
  }> {
    const results: { success: number; errors: Array<{ line: number; error: string; data: any }> } = { success: 0, errors: [] };

    try {
      const records = parse<Record<string, any>>(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        try {
          // Transformation des données pour correspondre au schéma
          const transformedData = {
            equipmentType: record.equipmentType || record['Type d\'équipement'] || record['Equipment Type'],
            equipmentId: record.equipmentId || record['ID Équipement'] || record['Equipment ID'],
            zone: record.zone || record['Zone'],
            sector: record.sector || record['Secteur'] || record['Sector'],
            symptoms: record.symptoms || record['Symptômes'] || record['Symptoms'],
            symptomsChecked: this.parseSymptomsList(record.symptomsChecked || record['Symptômes Cochés']),
            diagnosis: record.diagnosis || record['Diagnostic'] || record['Diagnosis'],
            solution: record.solution || record['Solution'],
            duration: this.parseNumber(record.duration || record['Durée'] || record['Duration']),
            urgency: this.parseUrgency(record.urgency || record['Urgence'] || record['Urgency']),
            riskLevel: record.riskLevel || record['Niveau Risque'] || record['Risk Level'],
            costEstimate: record.costEstimate || record['Coût Estimé'] || record['Cost Estimate'],
            dateOccurred: record.dateOccurred || record['Date'] || record['Date Occurred'],
            technician: record.technician || record['Technicien'] || record['Technician'],
            notes: record.notes || record['Notes'],
          };

          // Validation des données
          const validatedData = ImportMaintenanceCaseSchema.parse(transformedData);

          // Création du cas de maintenance
          await storage.createMaintenanceCase({
            equipmentType: validatedData.equipmentType,
            equipmentId: validatedData.equipmentId || `EQ-${Date.now()}-${i}`,
            zone: validatedData.zone || "unknown",
            sector: validatedData.sector || "unknown",
            symptoms: validatedData.symptoms,
            diagnosis: validatedData.diagnosis,
            solution: validatedData.solution,
            duration: validatedData.duration || 60,
            urgency: validatedData.urgency,
          });

          results.success++;
        } catch (error: any) {
          results.errors.push({
            line: i + 2, // +2 car ligne 1 = headers et index commence à 0
            error: error.message,
            data: record,
          });
        }
      }
    } catch (error: any) {
      results.errors.push({
        line: 0,
        error: `Erreur de parsing CSV: ${error.message}`,
        data: null,
      });
    }

    return results;
  }

  /**
   * Importe des cas de maintenance depuis un fichier Excel
   */
  async importMaintenanceCasesFromExcel(excelBuffer: Buffer): Promise<{
    success: number;
    errors: Array<{ line: number; error: string; data: any }>;
  }> {
    const results: { success: number; errors: Array<{ line: number; error: string; data: any }> } = { success: 0, errors: [] };

    try {
      const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Conversion en JSON
      const records = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        try {
          const transformedData = {
            equipmentType: record['Type d\'équipement'] || record['Equipment Type'] || record.equipmentType,
            equipmentId: record['ID Équipement'] || record['Equipment ID'] || record.equipmentId,
            zone: record['Zone'] || record.zone,
            sector: record['Secteur'] || record['Sector'] || record.sector,
            symptoms: record['Symptômes'] || record['Symptoms'] || record.symptoms,
            symptomsChecked: this.parseSymptomsList(record['Symptômes Cochés'] || record['Checked Symptoms']),
            diagnosis: record['Diagnostic'] || record['Diagnosis'] || record.diagnosis,
            solution: record['Solution'] || record.solution,
            duration: this.parseNumber(record['Durée (min)'] || record['Duration'] || record.duration),
            urgency: this.parseUrgency(record['Urgence'] || record['Urgency'] || record.urgency),
            riskLevel: record['Niveau Risque'] || record['Risk Level'] || record.riskLevel,
            costEstimate: record['Coût Estimé'] || record['Cost Estimate'] || record.costEstimate,
            dateOccurred: record['Date'] || record['Date Occurred'] || record.dateOccurred,
            technician: record['Technicien'] || record['Technician'] || record.technician,
            notes: record['Notes'] || record.notes,
          };

          const validatedData = ImportMaintenanceCaseSchema.parse(transformedData);

          await storage.createMaintenanceCase({
            equipmentType: validatedData.equipmentType,
            equipmentId: validatedData.equipmentId || `EQ-${Date.now()}-${i}`,
            zone: validatedData.zone || "unknown",
            sector: validatedData.sector || "unknown",
            symptoms: validatedData.symptoms,
            diagnosis: validatedData.diagnosis,
            solution: validatedData.solution,
            duration: validatedData.duration || 60,
            urgency: validatedData.urgency,
          });

          results.success++;
        } catch (error: any) {
          results.errors.push({
            line: i + 2,
            error: error.message,
            data: record,
          });
        }
      }
    } catch (error: any) {
      results.errors.push({
        line: 0,
        error: `Erreur de lecture Excel: ${error.message}`,
        data: null,
      });
    }

    return results;
  }

  /**
   * Importe des cas signalés depuis un fichier CSV
   */
  async importReportedCasesFromCSV(csvContent: string): Promise<{
    success: number;
    errors: Array<{ line: number; error: string; data: any }>;
  }> {
    const results: { success: number; errors: Array<{ line: number; error: string; data: any }> } = { success: 0, errors: [] };

    try {
      const records = parse<Record<string, any>>(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        try {
          const transformedData = {
            equipmentType: record.equipmentType || record['Type d\'équipement'] || record['Equipment Type'],
            equipmentId: record.equipmentId || record['ID Équipement'] || record['Equipment ID'],
            zone: record.zone || record['Zone'],
            sector: record.sector || record['Secteur'] || record['Sector'],
            description: record.description || record['Description'],
            urgency: this.parseUrgency(record.urgency || record['Urgence'] || record['Urgency']),
            reportedBy: record.reportedBy || record['Signalé par'] || record['Reported By'],
            dateReported: record.dateReported || record['Date Signalé'] || record['Date Reported'],
            status: this.parseStatus(record.status || record['Statut'] || record['Status']),
          };

          const validatedData = ImportReportedCaseSchema.parse(transformedData);

          await storage.createReportedCase({
            equipmentType: validatedData.equipmentType,
            equipmentId: validatedData.equipmentId || `EQ-${Date.now()}-${i}`,
            zone: validatedData.zone || "unknown",
            description: validatedData.description,
            impact: validatedData.urgency,
            contact: validatedData.reportedBy,
          });

          results.success++;
        } catch (error: any) {
          results.errors.push({
            line: i + 2,
            error: error.message,
            data: record,
          });
        }
      }
    } catch (error: any) {
      results.errors.push({
        line: 0,
        error: `Erreur de parsing CSV: ${error.message}`,
        data: null,
      });
    }

    return results;
  }

  /**
   * Génère un template CSV pour l'importation de cas de maintenance
   */
  generateMaintenanceTemplate(): string {
    const headers = [
      'Type d\'équipement',
      'ID Équipement',
      'Zone',
      'Secteur',
      'Symptômes',
      'Symptômes Cochés',
      'Diagnostic',
      'Solution',
      'Durée (min)',
      'Urgence',
      'Niveau Risque',
      'Coût Estimé',
      'Date',
      'Technicien',
      'Notes'
    ];

    const exampleData = [
      'moteur',
      'MOT-001',
      'production',
      'ligne1',
      'Surchauffe anormale du moteur',
      'surchauffe;vibrations',
      'Problème de ventilation',
      'Nettoyer les ailettes de refroidissement et vérifier le ventilateur',
      '90',
      'high',
      'Élevé',
      '150€',
      '2024-01-15',
      'Jean Dupont',
      'Intervention en urgence'
    ];

    return [headers.join(','), exampleData.join(',')].join('\n');
  }

  /**
   * Génère un template CSV pour l'importation de cas signalés
   */
  generateReportedCasesTemplate(): string {
    const headers = [
      'Type d\'équipement',
      'ID Équipement',
      'Zone',
      'Secteur',
      'Description',
      'Urgence',
      'Signalé par',
      'Date Signalé',
      'Statut'
    ];

    const exampleData = [
      'pompe',
      'PUMP-A1',
      'production',
      'ligne2',
      'Bruit anormal et vibrations importantes',
      'medium',
      'Marie Martin',
      '2024-01-16',
      'pending'
    ];

    return [headers.join(','), exampleData.join(',')].join('\n');
  }

  // Méthodes utilitaires privées
  private parseSymptomsList(symptomsStr: string): string[] {
    if (!symptomsStr) return [];
    return symptomsStr.split(';').map(s => s.trim()).filter(Boolean);
  }

  private parseNumber(value: any): number | undefined {
    if (!value) return undefined;
    const num = parseInt(value.toString());
    return isNaN(num) ? undefined : num;
  }

  private parseUrgency(value: any): "low" | "medium" | "high" {
    if (!value) return "medium";
    const str = value.toString().toLowerCase();
    if (str.includes('high') || str.includes('élevé') || str.includes('urgent')) return "high";
    if (str.includes('low') || str.includes('faible') || str.includes('bas')) return "low";
    return "medium";
  }

  private parseStatus(value: any): "pending" | "in_progress" | "resolved" | "rejected" {
    if (!value) return "pending";
    const str = value.toString().toLowerCase();
    if (str.includes('progress') || str.includes('cours')) return "in_progress";
    if (str.includes('resolved') || str.includes('résolu') || str.includes('terminé')) return "resolved";
    if (str.includes('rejected') || str.includes('rejeté')) return "rejected";
    return "pending";
  }
}

export const dataImporter = new DataImporter();