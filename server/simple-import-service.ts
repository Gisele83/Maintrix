import { Request, Response } from "express";
import { db } from "./db";
import { equipmentRegistry, workOrders, spareParts } from "@shared/schema";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

export class SimpleImportService {
  
  // Service simple d'importation sans validation complexe
  async simpleImportMaintenanceHistory(file: Buffer, format: 'csv' | 'excel', tenantId: string = 'default-tenant'): Promise<{
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
          
          // Créer un ordre de travail simple
          const orderData = {
            tenantId: tenantId,
            orderNumber: record.orderNumber || record['Numéro OT'] || `WO-${Date.now()}-${i}`,
            orderType: this.normalizeOrderType(record.orderType || record['Type OT'] || 'corrective'),
            title: record.title || record['Titre'] || 'Maintenance importée',
            description: record.description || record['Description'] || 'Importé depuis fichier',
            priority: this.normalizePriority(record.priority || record['Priorité'] || 'medium'),
            status: this.normalizeStatus(record.status || record['Statut'] || 'completed'),
          };

          await db.insert(workOrders).values(orderData as any);
          result.imported++;
        } catch (error: any) {
          result.errors.push(`Ligne ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Erreur générale: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  private normalizeOrderType(type: string): string {
    const typeMap: { [key: string]: string } = {
      'préventif': 'preventive',
      'correctif': 'corrective',
      'prédictif': 'predictive',
      'urgence': 'emergency',
      'preventive': 'preventive',
      'corrective': 'corrective',
      'predictive': 'predictive',
      'emergency': 'emergency'
    };
    return typeMap[type?.toLowerCase()] || 'corrective';
  }

  private normalizePriority(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'faible': 'low',
      'normale': 'medium',
      'élevée': 'high',
      'urgente': 'urgent',
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'urgent': 'urgent'
    };
    return priorityMap[priority?.toLowerCase()] || 'medium';
  }

  private normalizeStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      'en attente': 'pending',
      'assigné': 'assigned',
      'en cours': 'in_progress',
      'suspendu': 'paused',
      'terminé': 'completed',
      'annulé': 'cancelled',
      'pending': 'pending',
      'assigned': 'assigned',
      'in_progress': 'in_progress',
      'paused': 'paused',
      'completed': 'completed',
      'cancelled': 'cancelled'
    };
    return statusMap[status?.toLowerCase()] || 'completed';
  }
}

export const simpleImportService = new SimpleImportService();