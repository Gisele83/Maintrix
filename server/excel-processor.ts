import * as XLSX from 'xlsx';
import { storage } from './storage';
import { gmaoStorage } from './gmao-storage';
import fs from 'fs';
import path from 'path';
import type { InsertMaintenanceCase, InsertEquipmentRegistry, InsertWorkOrder, InsertSparePart } from '../shared/schema';

export interface ProcessedExcelData {
  maintenanceCases: number;
  equipment: number;
  workOrders: number;
  spareParts: number;
  success: boolean;
  message: string;
}

export class ExcelHistoryProcessor {
  private tenantId?: string;

  constructor(tenantId?: string) {
    this.tenantId = tenantId;
  }
  
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
    if (!this.tenantId) {
      console.log(`ℹ️  Skipping ${data.length} equipment rows — no tenantId provided`);
      return 0;
    }
    let count = 0;
    for (const row of data) {
      try {
        const eq = this.extractEquipmentFromRow(row);
        if (eq) {
          const record: InsertEquipmentRegistry = {
            tenantId: this.tenantId,
            equipmentId: eq.equipmentId || `EQ-${Date.now()}-${count}`,
            equipmentName: eq.equipmentName,
            equipmentType: eq.equipmentType,
            manufacturer: eq.manufacturer,
            model: eq.model,
            serialNumber: eq.serialNumber,
            location: eq.location,
            zone: eq.zone,
            sector: eq.sector,
            criticalityLevel: eq.criticalityLevel || 'medium',
            operationalState: eq.operationalState || 'operational',
          };
          await gmaoStorage.createEquipment(record);
          count++;
        }
      } catch (error: any) {
        if (!error?.message?.includes('unique')) {
          console.error('Error importing equipment row:', error?.message?.substring(0, 80));
        }
      }
    }
    console.log(`✅ Imported ${count}/${data.length} equipment rows`);
    return count;
  }

  private async processWorkOrders(data: any[]): Promise<number> {
    if (!this.tenantId) {
      console.log(`ℹ️  Skipping ${data.length} work order rows — no tenantId provided`);
      return 0;
    }
    let count = 0;
    for (const row of data) {
      try {
        const wo = this.extractWorkOrderFromRowFull(row);
        if (wo) {
          const record: InsertWorkOrder = {
            tenantId: this.tenantId,
            orderType: wo.orderType || 'corrective',
            title: wo.title,
            description: wo.description,
            priority: wo.priority || 'medium',
            status: wo.status || 'pending',
            notes: wo.notes,
            estimatedDuration: wo.estimatedDuration,
          };
          await gmaoStorage.createWorkOrder(record);
          count++;
        }
      } catch (error: any) {
        console.error('Error importing work order row:', error?.message?.substring(0, 80));
      }
    }
    console.log(`✅ Imported ${count}/${data.length} work order rows`);
    return count;
  }

  private async processSpareParts(data: any[]): Promise<number> {
    if (!this.tenantId) {
      console.log(`ℹ️  Skipping ${data.length} spare parts rows — no tenantId provided`);
      return 0;
    }
    let count = 0;
    for (const row of data) {
      try {
        const sp = this.extractSparePartFromRowFull(row);
        if (sp) {
          const record: InsertSparePart = {
            tenantId: this.tenantId,
            partNumber: sp.partNumber || `PN-${Date.now()}-${count}`,
            partName: sp.partName,
            description: sp.description,
            category: sp.category,
            manufacturer: sp.manufacturer,
            supplier: sp.supplier,
            unitPrice: sp.unitPrice,
            currentStock: sp.currentStock ?? 0,
            minStock: sp.minStock ?? 0,
            maxStock: sp.maxStock ?? 100,
          };
          await gmaoStorage.createSparePart(record);
          count++;
        }
      } catch (error: any) {
        if (!error?.message?.includes('unique')) {
          console.error('Error importing spare part row:', error?.message?.substring(0, 80));
        }
      }
    }
    console.log(`✅ Imported ${count}/${data.length} spare parts rows`);
    return count;
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
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const found = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
        if (found && row[found] !== undefined && row[found] !== '') return String(row[found]).trim();
      }
      return '';
    };

    const equipmentName = get('equipment_name', 'equipmentname', 'name', 'nom', 'designation');
    const equipmentType = get('equipment_type', 'type', 'type_equipement', 'categorie');
    if (!equipmentName && !equipmentType) return null;

    return {
      equipmentId: get('equipment_id', 'equipmentid', 'id', 'ref', 'reference') || undefined,
      equipmentName: equipmentName || equipmentType || 'Équipement importé',
      equipmentType: this.normalizeEquipmentType(equipmentType) || equipmentType || 'Générique',
      manufacturer: get('manufacturer', 'fabricant', 'marque', 'constructeur') || undefined,
      model: get('model', 'modele', 'modèle', 'type_modele') || undefined,
      serialNumber: get('serial_number', 'serialnumber', 'serie', 'num_serie') || undefined,
      location: get('location', 'localisation', 'site', 'lieu') || undefined,
      zone: get('zone', 'atelier', 'secteur_zone') || undefined,
      sector: get('sector', 'secteur', 'service', 'departement') || undefined,
      criticalityLevel: this.normalizeCriticality(get('criticality', 'criticite', 'priorite', 'critical')),
      operationalState: 'operational',
    };
  }

  private extractWorkOrderFromRowFull(row: any): any | null {
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const found = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
        if (found && row[found] !== undefined && row[found] !== '') return String(row[found]).trim();
      }
      return '';
    };

    const title = get('title', 'titre', 'description_courte', 'libelle', 'intervention');
    const description = get('description', 'detail', 'details', 'note', 'observation');
    if (!title && !description) return null;

    const orderTypeRaw = get('order_type', 'type', 'type_intervention', 'type_ot').toLowerCase();
    let orderType = 'corrective';
    if (orderTypeRaw.includes('prev') || orderTypeRaw.includes('pm')) orderType = 'preventive';
    if (orderTypeRaw.includes('pred')) orderType = 'predictive';
    if (orderTypeRaw.includes('urg') || orderTypeRaw.includes('emerg')) orderType = 'emergency';

    const priorityRaw = get('priority', 'priorite', 'urgence').toLowerCase();
    let priority = 'medium';
    if (priorityRaw.includes('haut') || priorityRaw.includes('high') || priorityRaw === '3') priority = 'high';
    if (priorityRaw.includes('urg') || priorityRaw === '4') priority = 'urgent';
    if (priorityRaw.includes('bas') || priorityRaw.includes('low') || priorityRaw === '1') priority = 'low';

    const durationRaw = get('duration', 'duree', 'temps', 'hours');
    const estimatedDuration = durationRaw ? this.extractDuration(durationRaw) : undefined;

    return {
      title: title || description.substring(0, 100) || 'Ordre de travail importé',
      description: description || title || 'Importé depuis Excel',
      orderType,
      priority,
      status: 'pending',
      estimatedDuration,
      notes: get('notes', 'commentaires', 'remarques') || undefined,
    };
  }

  private extractSparePartFromRowFull(row: any): any | null {
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const found = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
        if (found && row[found] !== undefined && row[found] !== '') return String(row[found]).trim();
      }
      return '';
    };

    const partName = get('part_name', 'partname', 'designation', 'nom', 'libelle', 'name');
    const partNumber = get('part_number', 'partnumber', 'reference', 'ref', 'code');
    if (!partName && !partNumber) return null;

    const priceRaw = get('unit_price', 'unitprice', 'prix', 'prix_unitaire', 'price');
    const unitPrice = priceRaw ? parseFloat(priceRaw.replace(',', '.')) || undefined : undefined;

    return {
      partName: partName || partNumber || 'Pièce importée',
      partNumber: partNumber || undefined,
      description: get('description', 'detail', 'details') || undefined,
      category: get('category', 'categorie', 'famille', 'type') || undefined,
      manufacturer: get('manufacturer', 'fabricant', 'marque') || undefined,
      supplier: get('supplier', 'fournisseur', 'provider') || undefined,
      unitPrice: unitPrice ? String(unitPrice) : undefined,
      currentStock: parseInt(get('current_stock', 'stock', 'quantite', 'qty')) || 0,
      minStock: parseInt(get('min_stock', 'stock_min', 'minimum')) || 0,
      maxStock: parseInt(get('max_stock', 'stock_max', 'maximum')) || 100,
    };
  }

  private normalizeCriticality(value: string): string {
    const v = value.toLowerCase();
    if (v.includes('crit') || v.includes('4')) return 'critical';
    if (v.includes('haut') || v.includes('high') || v.includes('3')) return 'high';
    if (v.includes('bas') || v.includes('low') || v.includes('1')) return 'low';
    return 'medium';
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