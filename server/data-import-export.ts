import { Request, Response } from "express";
import { db } from "./db";
import { equipmentRegistry, workOrders, spareParts, iotSensorData, preventiveMaintenancePlans } from "@shared/schema";
import { eq, gte } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { z } from "zod";

// Schemas de validation pour l'import
const ImportEquipmentSchema = z.object({
  equipmentId: z.string().min(1),
  equipmentName: z.string().min(1),
  equipmentType: z.string().min(1),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  zone: z.string().optional(),
  sector: z.string().optional(),
  criticalityLevel: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  operationalState: z.enum(["operational", "maintenance", "offline", "decommissioned"]).default("operational"),
});

const ImportMaintenanceHistorySchema = z.object({
  orderNumber: z.string().min(1),
  equipmentId: z.string().optional(),
  equipmentName: z.string().optional(),
  equipmentType: z.string().optional(),
  orderType: z.enum(["preventive", "corrective", "predictive", "emergency"]),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["pending", "assigned", "in_progress", "paused", "completed", "cancelled"]).default("pending"),
  assignedTo: z.string().optional(),
  scheduledStart: z.string().optional(),
  actualDuration: z.number().optional(),
  cost: z.number().optional(),
  notes: z.string().optional(),
});

const ImportSparePartsSchema = z.object({
  partNumber: z.string().min(1),
  partName: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  supplier: z.string().optional(),
  unitPrice: z.number().optional(),
  currentStock: z.number().default(0),
  minStock: z.number().default(0),
  maxStock: z.number().default(100),
  location: z.string().optional(),
});

export class DataImportExportService {
  
  // Mappings pour la compatibilité multi-ERP (SAGE, SAP, Oracle, Dynamics, Maximo, etc.)
  private getERPColumnMappings(): Record<string, Record<string, Record<string, string>>> {
    return {
      // SAGE X3 / 100
      sage: {
        equipment: {
          'Code Article': 'equipmentId',
          'Désignation': 'equipmentName',
          'Type': 'equipmentType',
          'Famille': 'category',
          'Fabricant': 'manufacturer',
          'Modèle': 'model',
          'N° Série': 'serialNumber',
          'Zone': 'zone',
          'Secteur': 'sector',
          'Criticité': 'criticalityLevel',
          'État': 'operationalState',
          'Emplacement': 'location'
        },
        spareParts: {
          'Code Article': 'partNumber',
          'Désignation': 'partName',
          'Description': 'description',
          'Famille': 'category',
          'Fabricant': 'manufacturer',
          'Fournisseur': 'supplier',
          'Prix Unitaire': 'unitPrice',
          'Stock Actuel': 'currentStock',
          'Stock Min': 'minStock',
          'Stock Max': 'maxStock',
          'Emplacement': 'location'
        },
        maintenance: {
          'N° OT': 'orderNumber',
          'Code Équipement': 'equipmentId',
          'Type Intervention': 'orderType',
          'Titre': 'title',
          'Description': 'description',
          'Priorité': 'priority',
          'Statut': 'status',
          'Technicien': 'assignedTo',
          'Date Début': 'scheduledStart',
          'Durée': 'actualDuration',
          'Coût': 'cost',
          'Notes': 'notes'
        }
      },
      
      // SAP ECC / S/4HANA
      sap: {
        equipment: {
          'Equipment': 'equipmentId',
          'EquipmentDescr': 'equipmentName',
          'TechnicalObjectType': 'equipmentType',
          'EquipmentCategory': 'category',
          'Manufacturer': 'manufacturer',
          'Model': 'model',
          'SerialNumber': 'serialNumber',
          'FunctionalLocation': 'zone',
          'PlannerGroup': 'sector',
          'ABCIndicator': 'criticalityLevel',
          'SystemStatus': 'operationalState',
          'Room': 'location'
        },
        spareParts: {
          'Material': 'partNumber',
          'MaterialDescription': 'partName',
          'MaterialType': 'category',
          'Manufacturer': 'manufacturer',
          'Vendor': 'supplier',
          'StandardPrice': 'unitPrice',
          'UnrestrictedStock': 'currentStock',
          'SafetyStock': 'minStock',
          'MaximumStock': 'maxStock',
          'StorageLocation': 'location'
        },
        maintenance: {
          'OrderNumber': 'orderNumber',
          'Equipment': 'equipmentId',
          'OrderType': 'orderType',
          'ShortText': 'title',
          'LongText': 'description',
          'Priority': 'priority',
          'UserStatus': 'status',
          'ResponsiblePerson': 'assignedTo',
          'BasicStartDate': 'scheduledStart',
          'ActualWork': 'actualDuration',
          'ActualCosts': 'cost',
          'SystemStatus': 'notes'
        }
      },
      
      // Oracle ERP Cloud / JD Edwards
      oracle: {
        equipment: {
          'AssetNumber': 'equipmentId',
          'Description': 'equipmentName',
          'AssetType': 'equipmentType',
          'AssetCategory': 'category',
          'ManufacturerName': 'manufacturer',
          'ModelNumber': 'model',
          'SerialNumber': 'serialNumber',
          'Location': 'zone',
          'Department': 'sector',
          'Criticality': 'criticalityLevel',
          'Status': 'operationalState',
          'Room': 'location'
        },
        spareParts: {
          'ItemNumber': 'partNumber',
          'ItemDescription': 'partName',
          'ItemType': 'category',
          'SupplierName': 'supplier',
          'UnitCost': 'unitPrice',
          'QuantityOnHand': 'currentStock',
          'MinimumQuantity': 'minStock',
          'MaximumQuantity': 'maxStock',
          'Warehouse': 'location'
        },
        maintenance: {
          'WorkOrderNumber': 'orderNumber',
          'AssetNumber': 'equipmentId',
          'WorkOrderType': 'orderType',
          'Description': 'title',
          'Priority': 'priority',
          'Status': 'status',
          'AssignedTo': 'assignedTo',
          'ScheduledStartDate': 'scheduledStart',
          'ActualHours': 'actualDuration',
          'ActualCost': 'cost',
          'Comments': 'notes'
        }
      },
      
      // Microsoft Dynamics 365
      dynamics: {
        equipment: {
          'FixedAssetId': 'equipmentId',
          'Name': 'equipmentName',
          'FixedAssetGroup': 'equipmentType',
          'Make': 'manufacturer',
          'Model': 'model',
          'SerialNumber': 'serialNumber',
          'Location': 'zone',
          'Department': 'sector',
          'CriticalityLevel': 'criticalityLevel',
          'Status': 'operationalState'
        },
        spareParts: {
          'ItemNumber': 'partNumber',
          'ProductName': 'partName',
          'ItemGroup': 'category',
          'VendorAccount': 'supplier',
          'Price': 'unitPrice',
          'AvailPhysical': 'currentStock',
          'MinimumInventory': 'minStock',
          'MaximumInventory': 'maxStock',
          'WarehouseId': 'location'
        },
        maintenance: {
          'MaintenanceRequestId': 'orderNumber',
          'FixedAssetId': 'equipmentId',
          'MaintenanceRequestType': 'orderType',
          'Subject': 'title',
          'Description': 'description',
          'Priority': 'priority',
          'StateCode': 'status',
          'OwnerId': 'assignedTo',
          'ScheduledStart': 'scheduledStart',
          'ActualDurationMinutes': 'actualDuration',
          'TotalCost': 'cost',
          'Notes': 'notes'
        }
      },
      
      // IBM Maximo
      maximo: {
        equipment: {
          'AssetNum': 'equipmentId',
          'Description': 'equipmentName',
          'AssetType': 'equipmentType',
          'Manufacturer': 'manufacturer',
          'Model': 'model',
          'SerialNum': 'serialNumber',
          'Location': 'zone',
          'Parent': 'sector',
          'Priority': 'criticalityLevel',
          'Status': 'operationalState'
        },
        spareParts: {
          'ItemNum': 'partNumber',
          'Description': 'partName',
          'ItemType': 'category',
          'Manufacturer': 'manufacturer',
          'Vendor': 'supplier',
          'AvgCost': 'unitPrice',
          'CurBal': 'currentStock',
          'MinLevel': 'minStock',
          'MaxLevel': 'maxStock',
          'Location': 'location'
        },
        maintenance: {
          'WONum': 'orderNumber',
          'AssetNum': 'equipmentId',
          'WorkType': 'orderType',
          'Description': 'title',
          'Priority': 'priority',
          'Status': 'status',
          'Lead': 'assignedTo',
          'ScheduledStart': 'scheduledStart',
          'ActLaborHrs': 'actualDuration',
          'ActLaborCost': 'cost',
          'LongDescription': 'notes'
        }
      }
    };
  }

  // Méthode de compatibility SAGE maintenue pour rétrocompatibilité
  private getSageColumnMapping(): Record<string, Record<string, string>> {
    return {
      equipment: {
        'Code Article': 'equipmentId',
        'Désignation': 'equipmentName',
        'Type': 'equipmentType',
        'Famille': 'category',
        'Fabricant': 'manufacturer',
        'Modèle': 'model',
        'N° Série': 'serialNumber',
        'Zone': 'zone',
        'Secteur': 'sector',
        'Criticité': 'criticalityLevel',
        'État': 'operationalState',
        'Emplacement': 'location'
      },
      spareParts: {
        'Code Article': 'partNumber',
        'Désignation': 'partName',
        'Description': 'description',
        'Famille': 'category',
        'Fabricant': 'manufacturer',
        'Fournisseur': 'supplier',
        'Prix Unitaire': 'unitPrice',
        'Stock Actuel': 'currentStock',
        'Stock Min': 'minStock',
        'Stock Max': 'maxStock',
        'Emplacement': 'location'
      },
      maintenance: {
        'N° OT': 'orderNumber',
        'Code Équipement': 'equipmentId',
        'Type Intervention': 'orderType',
        'Titre': 'title',
        'Description': 'description',
        'Priorité': 'priority',
        'Statut': 'status',
        'Technicien': 'assignedTo',
        'Date Début': 'scheduledStart',
        'Durée': 'actualDuration',
        'Coût': 'cost',
        'Notes': 'notes'
      }
    };
  }

  // Détection automatique du format ERP basé sur les colonnes
  private detectERPFormat(record: any): string {
    const allMappings = this.getERPColumnMappings();
    const columnNames = Object.keys(record);
    
    let maxMatches = 0;
    let detectedERP = 'sage'; // par défaut
    
    for (const [erpName, erpMappings] of Object.entries(allMappings)) {
      for (const [dataType, columnMapping] of Object.entries(erpMappings)) {
        const erpColumns = Object.keys(columnMapping);
        const matches = columnNames.filter(col => erpColumns.includes(col)).length;
        
        if (matches > maxMatches) {
          maxMatches = matches;
          detectedERP = erpName;
        }
      }
    }
    
    console.log(`📊 Format ERP détecté: ${detectedERP.toUpperCase()} (${maxMatches} colonnes correspondantes)`);
    return detectedERP;
  }

  // Normalisation des données pour compatibilité multi-ERP
  private normalizeRecordForImport(record: any, type: 'equipment' | 'spareParts' | 'maintenance'): any {
    // Détecter automatiquement le format ERP
    const detectedERP = this.detectERPFormat(record);
    const allMappings = this.getERPColumnMappings();
    const mapping = allMappings[detectedERP]?.[type] || this.getSageColumnMapping()[type];
    let normalized: any = {};

    // Mapper les colonnes SAGE vers nos champs
    for (const [sageColumn, ourField] of Object.entries(mapping)) {
      if (record[sageColumn] !== undefined) {
        normalized[ourField] = record[sageColumn];
      }
    }

    // Copier les champs qui correspondent déjà
    for (const [key, value] of Object.entries(record)) {
      if (!normalized[key] && Object.values(mapping).includes(key)) {
        normalized[key] = value;
      }
    }

    // Normalisation des valeurs spécifiques selon l'ERP détecté
    normalized = this.normalizeERPValues(normalized, type, detectedERP);
    
    return { ...record, ...normalized };
  }

  // Normalisation des valeurs selon le format ERP
  private normalizeERPValues(normalized: any, type: string, erpFormat: string): any {
    if (type === 'equipment') {
      // Mapper les états selon l'ERP
      if (normalized.operationalState) {
        const stateMappings = {
          sage: {
            'En Service': 'operational',
            'En Maintenance': 'maintenance', 
            'Arrêté': 'offline',
            'Décommissionné': 'decommissioned'
          },
          sap: {
            'TECO': 'operational', // Technically Complete
            'MAINT': 'maintenance',
            'INACT': 'offline',
            'DEACT': 'decommissioned'
          },
          oracle: {
            'OPERATING': 'operational',
            'MAINTENANCE': 'maintenance',
            'NOT OPERATING': 'offline',
            'RETIRED': 'decommissioned'
          },
          dynamics: {
            'Active': 'operational',
            'Under maintenance': 'maintenance',
            'Inactive': 'offline',
            'Disposed': 'decommissioned'
          },
          maximo: {
            'OPERATING': 'operational',
            'DOWNMAINT': 'maintenance',
            'NOT READY': 'offline',
            'DECOMMISSIONED': 'decommissioned'
          }
        };
        
        const mapping = stateMappings[erpFormat];
        if (mapping) {
          normalized.operationalState = mapping[normalized.operationalState] || normalized.operationalState;
        }
      }

      // Mapper les niveaux de criticité
      if (normalized.criticalityLevel) {
        const criticalityMappings = {
          sage: { 'Faible': 'low', 'Moyen': 'medium', 'Fort': 'high', 'Critique': 'critical' },
          sap: { 'A': 'critical', 'B': 'high', 'C': 'medium', 'D': 'low' },
          oracle: { 'HIGH': 'critical', 'MEDIUM': 'medium', 'LOW': 'low' },
          dynamics: { '1': 'critical', '2': 'high', '3': 'medium', '4': 'low' },
          maximo: { '1': 'critical', '2': 'high', '3': 'medium', '4': 'low' }
        };
        
        const mapping = criticalityMappings[erpFormat];
        if (mapping) {
          normalized.criticalityLevel = mapping[normalized.criticalityLevel] || normalized.criticalityLevel;
        }
      }
    }

    if (type === 'maintenance') {
      // Mapper les types d'intervention selon l'ERP
      if (normalized.orderType) {
        const typeMappings = {
          sage: {
            'Préventif': 'preventive',
            'Correctif': 'corrective',
            'Prédictif': 'predictive',
            'Urgence': 'emergency'
          },
          sap: {
            'PM01': 'preventive', // Preventive Maintenance
            'PM02': 'corrective', // Corrective Maintenance
            'PM03': 'predictive', // Predictive Maintenance
            'PM05': 'emergency'   // Emergency
          },
          oracle: {
            'PREVENTIVE': 'preventive',
            'CORRECTIVE': 'corrective',
            'PREDICTIVE': 'predictive',
            'EMERGENCY': 'emergency'
          },
          dynamics: {
            'Preventive': 'preventive',
            'Corrective': 'corrective',
            'Predictive': 'predictive',
            'Emergency': 'emergency'
          },
          maximo: {
            'PM': 'preventive',
            'CM': 'corrective',
            'PdM': 'predictive',
            'EM': 'emergency'
          }
        };
        
        const mapping = typeMappings[erpFormat];
        if (mapping) {
          normalized.orderType = mapping[normalized.orderType] || normalized.orderType;
        }
      }

      // Mapper les priorités
      if (normalized.priority) {
        const priorityMappings = {
          sage: { 'Faible': 'low', 'Normale': 'medium', 'Élevée': 'high', 'Urgente': 'urgent' },
          sap: { '1': 'urgent', '2': 'high', '3': 'medium', '4': 'low' },
          oracle: { 'URGENT': 'urgent', 'HIGH': 'high', 'MEDIUM': 'medium', 'LOW': 'low' },
          dynamics: { '1': 'urgent', '2': 'high', '3': 'medium', '4': 'low' },
          maximo: { '1': 'urgent', '2': 'high', '3': 'medium', '4': 'low' }
        };
        
        const mapping = priorityMappings[erpFormat];
        if (mapping) {
          normalized.priority = mapping[normalized.priority] || normalized.priority;
        }
      }

      // Mapper les statuts
      if (normalized.status) {
        const statusMappings = {
          sage: {
            'En Attente': 'pending',
            'Assigné': 'assigned',
            'En Cours': 'in_progress',
            'Suspendu': 'paused',
            'Terminé': 'completed',
            'Annulé': 'cancelled'
          },
          sap: {
            'CRTD': 'pending',      // Created
            'REL': 'assigned',      // Released
            'PREL': 'in_progress',  // Partially Released
            'TECO': 'completed',    // Technically Complete
            'CLSD': 'completed',    // Closed
            'DLT': 'cancelled'      // Deleted
          },
          oracle: {
            'OPEN': 'pending',
            'INWORK': 'in_progress',
            'ONHOLD': 'paused',
            'CLOSE': 'completed',
            'CANCELLED': 'cancelled'
          },
          dynamics: {
            'Active': 'assigned',
            'In Progress': 'in_progress',
            'On Hold': 'paused',
            'Completed': 'completed',
            'Cancelled': 'cancelled'
          },
          maximo: {
            'WAPPR': 'pending',     // Waiting on Approval
            'APPR': 'assigned',     // Approved
            'INPRG': 'in_progress', // In Progress
            'ONHOLD': 'paused',     // On Hold
            'COMP': 'completed',    // Complete
            'CAN': 'cancelled'      // Cancelled
          }
        };
        
        const mapping = statusMappings[erpFormat];
        if (mapping) {
          normalized.status = mapping[normalized.status] || normalized.status;
        }
      }
    }

    return normalized;
  }

  // Import des équipements
  async importEquipments(file: Buffer, format: 'csv' | 'excel'): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
    warnings: string[];
  }> {
    const result = { success: true, imported: 0, errors: [], warnings: [] };
    
    try {
      let records: any[] = [];
      
      if (format === 'csv') {
        const csvContent = file.toString('utf-8');
        records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
      } else {
        const workbook = XLSX.read(file, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        records = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      }

      for (let i = 0; i < records.length; i++) {
        try {
          const record = records[i];
          
          // Normalisation pour SAGE et autres ERP
          const normalizedRecord = this.normalizeRecordForImport(record, 'equipment');
          
          // Fallback pour les anciens formats
          const equipmentData = {
            equipmentId: normalizedRecord.equipmentId || record.equipmentId || record['ID Équipement'] || record['Equipment ID'],
            equipmentName: normalizedRecord.equipmentName || record.equipmentName || record['Nom Équipement'] || record['Equipment Name'],
            equipmentType: normalizedRecord.equipmentType || record.equipmentType || record['Type Équipement'] || record['Equipment Type'],
            manufacturer: normalizedRecord.manufacturer || record.manufacturer || record['Fabricant'] || record['Manufacturer'],
            model: normalizedRecord.model || record.model || record['Modèle'] || record['Model'],
            serialNumber: normalizedRecord.serialNumber || record.serialNumber || record['Numéro Série'] || record['Serial Number'],
            zone: normalizedRecord.zone || record.zone || record['Zone'],
            sector: normalizedRecord.sector || record.sector || record['Secteur'] || record['Sector'],
            criticalityLevel: normalizedRecord.criticalityLevel || this.parseCriticality(record.criticalityLevel || record['Niveau Criticité'] || record['Criticality Level']),
            operationalState: normalizedRecord.operationalState || this.parseOperationalState(record.operationalState || record['État Opérationnel'] || record['Operational State']),
          };

          const validatedData = ImportEquipmentSchema.parse(equipmentData);
          
          await db.insert(equipmentRegistry).values({
            tenantId: "DEFAULT_TENANT", // TODO: Récupérer le tenant ID du contexte
            equipmentId: validatedData.equipmentId,
            equipmentName: validatedData.equipmentName,
            equipmentType: validatedData.equipmentType,
            manufacturer: validatedData.manufacturer,
            model: validatedData.model,
            serialNumber: validatedData.serialNumber,
            zone: validatedData.zone,
            sector: validatedData.sector,
            criticalityLevel: validatedData.criticalityLevel,
            operationalState: validatedData.operationalState,
          });

          result.imported++;
        } catch (error) {
          result.errors.push(`Ligne ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Erreur générale: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  // Import de l'historique de maintenance
  async importMaintenanceHistory(file: Buffer, format: 'csv' | 'excel'): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
    warnings: string[];
  }> {
    const result = { success: true, imported: 0, errors: [], warnings: [] };
    
    try {
      let records: any[] = [];
      
      if (format === 'csv') {
        const csvContent = file.toString('utf-8');
        records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
      } else {
        const workbook = XLSX.read(file, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        records = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      }

      for (let i = 0; i < records.length; i++) {
        try {
          const record = records[i];
          
          // Rechercher l'équipement correspondant
          const equipment = await db.select().from(equipmentRegistry)
            .where(eq(equipmentRegistry.equipmentId, record.equipmentId || record['ID Équipement'] || record['Equipment ID']))
            .limit(1);

          if (equipment.length === 0) {
            result.warnings.push(`Ligne ${i + 1}: Équipement non trouvé - ${record.equipmentId}`);
            continue;
          }

          const maintenanceData = {
            orderNumber: record.orderNumber || record['Numéro OT'] || record['Order Number'] || `WO-${Date.now()}-${i}`,
            equipmentId: record.equipmentId || record['ID Équipement'] || record['Equipment ID'],
            orderType: this.parseOrderType(record.orderType || record['Type OT'] || record['Order Type']),
            title: record.title || record['Titre'] || record['Title'],
            description: record.description || record['Description'],
            priority: this.parsePriority(record.priority || record['Priorité'] || record['Priority']),
            status: this.parseStatus(record.status || record['Statut'] || record['Status']),
            assignedTo: record.assignedTo || record['Assigné à'] || record['Assigned To'],
            scheduledStart: record.scheduledStart || record['Début Planifié'] || record['Scheduled Start'],
            actualDuration: this.parseNumber(record.actualDuration || record['Durée Réelle'] || record['Actual Duration']),
            cost: this.parseNumber(record.cost || record['Coût'] || record['Cost']),
            notes: record.notes || record['Notes'],
          };

          const validatedData = ImportMaintenanceHistorySchema.parse(maintenanceData);
          
          // Simplification temporaire pour éviter les erreurs TypeScript
          const insertData: any = {
            tenantId: "DEFAULT_TENANT", // TODO: Récupérer le tenant ID du contexte  
            equipmentId: equipment[0].id,
            orderNumber: validatedData.orderNumber,
            orderType: validatedData.orderType,
            title: validatedData.title,
            description: validatedData.description,
            priority: validatedData.priority,
            status: validatedData.status,
            actualDuration: validatedData.actualDuration,
            cost: validatedData.cost?.toString(),
            scheduledStart: validatedData.scheduledStart ? new Date(validatedData.scheduledStart) : null,
          };
          
          await db.insert(workOrders).values(insertData);

          result.imported++;
        } catch (error) {
          result.errors.push(`Ligne ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Erreur générale: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  // Import des pièces détachées
  async importSpareParts(file: Buffer, format: 'csv' | 'excel'): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
    warnings: string[];
  }> {
    const result = { success: true, imported: 0, errors: [], warnings: [] };
    
    try {
      let records: any[] = [];
      
      if (format === 'csv') {
        const csvContent = file.toString('utf-8');
        records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
      } else {
        const workbook = XLSX.read(file, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        records = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      }

      for (let i = 0; i < records.length; i++) {
        try {
          const record = records[i];
          const sparePartData = {
            partNumber: record.partNumber || record['Numéro Pièce'] || record['Part Number'],
            partName: record.partName || record['Nom Pièce'] || record['Part Name'],
            description: record.description || record['Description'],
            category: record.category || record['Catégorie'] || record['Category'],
            manufacturer: record.manufacturer || record['Fabricant'] || record['Manufacturer'],
            supplier: record.supplier || record['Fournisseur'] || record['Supplier'],
            unitPrice: this.parseNumber(record.unitPrice || record['Prix Unitaire'] || record['Unit Price']),
            currentStock: this.parseNumber(record.currentStock || record['Stock Actuel'] || record['Current Stock']) || 0,
            minStock: this.parseNumber(record.minStock || record['Stock Min'] || record['Min Stock']) || 0,
            maxStock: this.parseNumber(record.maxStock || record['Stock Max'] || record['Max Stock']) || 100,
            location: record.location || record['Emplacement'] || record['Location'],
          };

          const validatedData = ImportSparePartsSchema.parse(sparePartData);
          
          await db.insert(spareParts).values({
            partNumber: validatedData.partNumber,
            partName: validatedData.partName,
            description: validatedData.description,
            category: validatedData.category,
            manufacturer: validatedData.manufacturer,
            supplier: validatedData.supplier,
            unitPrice: validatedData.unitPrice?.toString(),
            currentStock: validatedData.currentStock,
            minStock: validatedData.minStock,
            maxStock: validatedData.maxStock,
            location: validatedData.location,
          });

          result.imported++;
        } catch (error) {
          result.errors.push(`Ligne ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Erreur générale: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  // Export des équipements
  async exportEquipments(format: 'csv' | 'excel'): Promise<Buffer> {
    const equipments = await db.select().from(equipmentRegistry).orderBy(equipmentRegistry.equipmentName);
    
    const data = equipments.map(eq => ({
      'ID Équipement': eq.equipmentId,
      'Nom Équipement': eq.equipmentName,
      'Type Équipement': eq.equipmentType,
      'Fabricant': eq.manufacturer || '',
      'Modèle': eq.model || '',
      'Numéro Série': eq.serialNumber || '',
      'Zone': eq.zone || '',
      'Secteur': eq.sector || '',
      'Niveau Criticité': eq.criticalityLevel,
      'État Opérationnel': eq.operationalState,
      'Date Installation': eq.installationDate ? eq.installationDate.toISOString().split('T')[0] : '',
      'Date Création': eq.createdAt.toISOString().split('T')[0],
    }));

    if (format === 'csv') {
      const headers = Object.keys(data[0] || {});
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
      ].join('\n');
      return Buffer.from(csvContent, 'utf-8');
    } else {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Équipements');
      return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    }
  }

  // Export de l'historique de maintenance
  async exportMaintenanceHistory(format: 'csv' | 'excel'): Promise<Buffer> {
    const maintenanceHistory = await db.select({
      orderNumber: workOrders.orderNumber,
      equipmentId: equipmentRegistry.equipmentId,
      equipmentName: equipmentRegistry.equipmentName,
      orderType: workOrders.orderType,
      title: workOrders.title,
      description: workOrders.description,
      priority: workOrders.priority,
      status: workOrders.status,
      scheduledStart: workOrders.scheduledStart,
      actualStart: workOrders.actualStart,
      actualEnd: workOrders.actualEnd,
      actualDuration: workOrders.actualDuration,
      cost: workOrders.cost,
      notes: workOrders.notes,
      createdAt: workOrders.createdAt,
    })
    .from(workOrders)
    .leftJoin(equipmentRegistry, eq(workOrders.equipmentId, equipmentRegistry.id))
    .orderBy(workOrders.createdAt);

    const data = maintenanceHistory.map(mh => ({
      'Numéro OT': mh.orderNumber,
      'ID Équipement': mh.equipmentId || '',
      'Nom Équipement': mh.equipmentName || '',
      'Type OT': mh.orderType,
      'Titre': mh.title,
      'Description': mh.description,
      'Priorité': mh.priority,
      'Statut': mh.status,
      'Début Planifié': mh.scheduledStart ? mh.scheduledStart.toISOString() : '',
      'Début Réel': mh.actualStart ? mh.actualStart.toISOString() : '',
      'Fin Réelle': mh.actualEnd ? mh.actualEnd.toISOString() : '',
      'Durée Réelle (min)': mh.actualDuration || '',
      'Coût': mh.cost || '',
      'Notes': mh.notes || '',
      'Date Création': mh.createdAt.toISOString().split('T')[0],
    }));

    if (format === 'csv') {
      const headers = Object.keys(data[0] || {});
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
      ].join('\n');
      return Buffer.from(csvContent, 'utf-8');
    } else {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Historique Maintenance');
      return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    }
  }

  // Export des pièces détachées
  async exportSpareParts(format: 'csv' | 'excel'): Promise<Buffer> {
    const parts = await db.select().from(spareParts).orderBy(spareParts.partName);
    
    const data = parts.map(part => ({
      'Numéro Pièce': part.partNumber,
      'Nom Pièce': part.partName,
      'Description': part.description || '',
      'Catégorie': part.category || '',
      'Fabricant': part.manufacturer || '',
      'Fournisseur': part.supplier || '',
      'Prix Unitaire': part.unitPrice || '',
      'Stock Actuel': part.currentStock,
      'Stock Min': part.minStock,
      'Stock Max': part.maxStock,
      'Emplacement': part.location || '',
      'Date Création': part.createdAt.toISOString().split('T')[0],
    }));

    if (format === 'csv') {
      const headers = Object.keys(data[0] || {});
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
      ].join('\n');
      return Buffer.from(csvContent, 'utf-8');
    } else {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pièces Détachées');
      return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    }
  }

  // Export des données IoT
  async exportIoTData(format: 'csv' | 'excel', days: number = 30): Promise<Buffer> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const iotData = await db.select({
      equipmentId: equipmentRegistry.equipmentId,
      equipmentName: equipmentRegistry.equipmentName,
      sensorType: iotSensorData.sensorType,
      sensorId: iotSensorData.sensorId,
      value: iotSensorData.value,
      unit: iotSensorData.unit,
      timestamp: iotSensorData.timestamp,
      quality: iotSensorData.quality,
      alarmState: iotSensorData.alarmState,
    })
    .from(iotSensorData)
    .leftJoin(equipmentRegistry, eq(iotSensorData.equipmentId, equipmentRegistry.id))
    .where(gte(iotSensorData.timestamp, cutoffDate))
    .orderBy(iotSensorData.timestamp);

    const data = iotData.map(iot => ({
      'ID Équipement': iot.equipmentId || '',
      'Nom Équipement': iot.equipmentName || '',
      'Type Capteur': iot.sensorType,
      'ID Capteur': iot.sensorId,
      'Valeur': iot.value,
      'Unité': iot.unit,
      'Timestamp': iot.timestamp.toISOString(),
      'Qualité': iot.quality,
      'État Alarme': iot.alarmState,
    }));

    if (format === 'csv') {
      const headers = Object.keys(data[0] || {});
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
      ].join('\n');
      return Buffer.from(csvContent, 'utf-8');
    } else {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Données IoT');
      return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    }
  }

  // Génération de templates
  generateTemplate(type: string, format: 'csv' | 'excel'): Buffer {
    let data: any[] = [];
    let sheetName = '';

    switch (type) {
      case 'equipments':
        data = [{
          'ID Équipement': 'EQ-001',
          'Nom Équipement': 'Pompe hydraulique principale',
          'Type Équipement': 'pompe',
          'Fabricant': 'Grundfos',
          'Modèle': 'CR15-2',
          'Numéro Série': 'GR2024001',
          'Zone': 'production',
          'Secteur': 'ligne1',
          'Niveau Criticité': 'high',
          'État Opérationnel': 'operational',
        }];
        sheetName = 'Template Équipements';
        break;

      case 'maintenance-history':
        data = [{
          'Numéro OT': 'WO-2024-001',
          'ID Équipement': 'EQ-001',
          'Type OT': 'preventive',
          'Titre': 'Maintenance préventive pompe',
          'Description': 'Vérification et entretien routine',
          'Priorité': 'medium',
          'Statut': 'completed',
          'Début Planifié': '2024-01-15T08:00:00',
          'Durée Réelle (min)': '120',
          'Coût': '250',
          'Notes': 'Maintenance effectuée selon procédure'
        }];
        sheetName = 'Template Maintenance';
        break;

      case 'spare-parts':
        data = [{
          'Numéro Pièce': 'SP-001',
          'Nom Pièce': 'Joint d\'étanchéité',
          'Description': 'Joint pour pompe hydraulique',
          'Catégorie': 'étanchéité',
          'Fabricant': 'SKF',
          'Fournisseur': 'Distribear',
          'Prix Unitaire': '25.50',
          'Stock Actuel': '10',
          'Stock Min': '5',
          'Stock Max': '50',
          'Emplacement': 'Magasin-A1-05'
        }];
        sheetName = 'Template Pièces';
        break;

      default:
        throw new Error(`Type de template non supporté: ${type}`);
    }

    if (format === 'csv') {
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
      ].join('\n');
      return Buffer.from(csvContent, 'utf-8');
    } else {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    }
  }

  // Méthodes utilitaires privées
  private parseCriticality(value: any): "low" | "medium" | "high" | "critical" {
    if (!value) return "medium";
    const str = value.toString().toLowerCase();
    if (str.includes('critical') || str.includes('critique')) return "critical";
    if (str.includes('high') || str.includes('élevé') || str.includes('haute')) return "high";
    if (str.includes('low') || str.includes('faible') || str.includes('basse')) return "low";
    return "medium";
  }

  private parseOperationalState(value: any): "operational" | "maintenance" | "offline" | "decommissioned" {
    if (!value) return "operational";
    const str = value.toString().toLowerCase();
    if (str.includes('maintenance') || str.includes('entretien')) return "maintenance";
    if (str.includes('offline') || str.includes('arrêt')) return "offline";
    if (str.includes('decommissioned') || str.includes('désaffecté')) return "decommissioned";
    return "operational";
  }

  private parseOrderType(value: any): "preventive" | "corrective" | "predictive" | "emergency" {
    if (!value) return "corrective";
    const str = value.toString().toLowerCase();
    if (str.includes('preventive') || str.includes('préventif')) return "preventive";
    if (str.includes('predictive') || str.includes('prédictif')) return "predictive";
    if (str.includes('emergency') || str.includes('urgence')) return "emergency";
    return "corrective";
  }

  private parsePriority(value: any): "low" | "medium" | "high" | "urgent" {
    if (!value) return "medium";
    const str = value.toString().toLowerCase();
    if (str.includes('urgent')) return "urgent";
    if (str.includes('high') || str.includes('élevé') || str.includes('haute')) return "high";
    if (str.includes('low') || str.includes('faible') || str.includes('basse')) return "low";
    return "medium";
  }

  private parseStatus(value: any): "pending" | "assigned" | "in_progress" | "paused" | "completed" | "cancelled" {
    if (!value) return "pending";
    const str = value.toString().toLowerCase();
    if (str.includes('assigned') || str.includes('assigné')) return "assigned";
    if (str.includes('progress') || str.includes('cours')) return "in_progress";
    if (str.includes('paused') || str.includes('pausé')) return "paused";
    if (str.includes('completed') || str.includes('terminé') || str.includes('fini')) return "completed";
    if (str.includes('cancelled') || str.includes('annulé')) return "cancelled";
    return "pending";
  }

  private parseNumber(value: any): number | undefined {
    if (!value) return undefined;
    const num = parseFloat(value.toString().replace(',', '.'));
    return isNaN(num) ? undefined : num;
  }
}

export const dataImportExportService = new DataImportExportService();