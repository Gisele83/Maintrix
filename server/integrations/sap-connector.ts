/**
 * SAP ERP Integration Connector
 * Provides bidirectional synchronization with SAP systems for work orders, equipment, and maintenance data
 */

import { gmaoStorage } from "../gmao-storage";
import { InsertWorkOrder, InsertEquipmentRegistry, InsertIntegrationLog } from "@shared/schema";

export interface SAPConfig {
  baseUrl: string;
  username: string;
  password: string;
  client: string;
  language: string;
}

export interface SAPWorkOrder {
  OrderNumber: string;
  OrderType: string;
  Description: string;
  Equipment: string;
  Priority: string;
  Status: string;
  PlannedStartDate: string;
  PlannedEndDate: string;
  ActualStartDate?: string;
  ActualEndDate?: string;
  EstimatedCost: number;
  ActualCost?: number;
}

export interface SAPEquipment {
  EquipmentNumber: string;
  Description: string;
  TechnicalIdentNo: string;
  ManufacturerPartNo: string;
  SerialNumber: string;
  Model: string;
  PlantSection: string;
  WorkCenter: string;
  InstallationDate: string;
  WarrantyDate: string;
}

export class SAPConnector {
  private config: SAPConfig;
  private authToken?: string;
  private lastSync?: Date;

  constructor(config: SAPConfig) {
    this.config = config;
  }

  /**
   * Authenticate with SAP system
   */
  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/sap/opu/odata/sap/API_ENTERPRISE_PROJECT_SRV/`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`,
          'Content-Type': 'application/json',
          'sap-client': this.config.client,
          'Accept-Language': this.config.language
        }
      });

      if (response.ok) {
        this.authToken = response.headers.get('x-csrf-token') || undefined;
        await this.logIntegration('SAP', 'authenticate', 'auth', 0, 'success', 'Authentication successful');
        return true;
      } else {
        await this.logIntegration('SAP', 'authenticate', 'auth', 0, 'failed', `Authentication failed: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      await this.logIntegration('SAP', 'authenticate', 'auth', 0, 'failed', `Authentication error: ${error}`);
      return false;
    }
  }

  /**
   * Synchronize work orders from SAP to GMAO
   */
  async syncWorkOrdersFromSAP(): Promise<void> {
    try {
      if (!await this.authenticate()) {
        throw new Error('SAP authentication failed');
      }

      // Fetch work orders from SAP
      const response = await fetch(`${this.config.baseUrl}/sap/opu/odata/sap/API_MAINTENANCE_ORDER_SRV/MaintenanceOrder`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`,
          'Content-Type': 'application/json',
          'sap-client': this.config.client,
          'x-csrf-token': this.authToken || ''
        }
      });

      if (!response.ok) {
        throw new Error(`SAP API error: ${response.statusText}`);
      }

      const data = await response.json();
      const sapWorkOrders: SAPWorkOrder[] = data.d?.results || [];

      // Convert and sync each work order
      for (const sapWO of sapWorkOrders) {
        const gmaoWorkOrder: InsertWorkOrder = {
          orderNumber: sapWO.OrderNumber,
          orderType: this.mapSAPOrderType(sapWO.OrderType),
          title: sapWO.Description,
          description: sapWO.Description,
          priority: this.mapSAPPriority(sapWO.Priority),
          status: this.mapSAPStatus(sapWO.Status),
          equipmentId: await this.getEquipmentIdByNumber(sapWO.Equipment),
          scheduledStart: sapWO.PlannedStartDate ? new Date(sapWO.PlannedStartDate) : undefined,
          scheduledEnd: sapWO.PlannedEndDate ? new Date(sapWO.PlannedEndDate) : undefined,
          actualStart: sapWO.ActualStartDate ? new Date(sapWO.ActualStartDate) : undefined,
          actualEnd: sapWO.ActualEndDate ? new Date(sapWO.ActualEndDate) : undefined,
          cost: sapWO.EstimatedCost ? parseFloat(sapWO.EstimatedCost.toString()) : undefined,
          notes: `Synchronized from SAP - Order: ${sapWO.OrderNumber}`
        };

        await gmaoStorage.createWorkOrder(gmaoWorkOrder);
      }

      await this.logIntegration('SAP', 'sync', 'work_order', sapWorkOrders.length, 'success', 
        `Synchronized ${sapWorkOrders.length} work orders from SAP`);

    } catch (error) {
      await this.logIntegration('SAP', 'sync', 'work_order', 0, 'failed', `Sync error: ${error}`);
      throw error;
    }
  }

  /**
   * Synchronize equipment from SAP to GMAO
   */
  async syncEquipmentFromSAP(): Promise<void> {
    try {
      if (!await this.authenticate()) {
        throw new Error('SAP authentication failed');
      }

      // Fetch equipment from SAP
      const response = await fetch(`${this.config.baseUrl}/sap/opu/odata/sap/API_EQUIPMENT_SRV/Equipment`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`,
          'Content-Type': 'application/json',
          'sap-client': this.config.client,
          'x-csrf-token': this.authToken || ''
        }
      });

      if (!response.ok) {
        throw new Error(`SAP API error: ${response.statusText}`);
      }

      const data = await response.json();
      const sapEquipment: SAPEquipment[] = data.d?.results || [];

      // Convert and sync each equipment
      for (const sapEq of sapEquipment) {
        const gmaoEquipment: InsertEquipmentRegistry = {
          equipmentId: sapEq.EquipmentNumber,
          equipmentName: sapEq.Description,
          equipmentType: this.detectEquipmentType(sapEq.Description),
          manufacturer: this.extractManufacturer(sapEq.ManufacturerPartNo),
          model: sapEq.Model,
          serialNumber: sapEq.SerialNumber,
          location: `${sapEq.PlantSection} - ${sapEq.WorkCenter}`,
          zone: sapEq.PlantSection,
          sector: sapEq.WorkCenter,
          installationDate: sapEq.InstallationDate ? new Date(sapEq.InstallationDate) : undefined,
          warrantyExpiry: sapEq.WarrantyDate ? new Date(sapEq.WarrantyDate) : undefined,
          criticalityLevel: 'medium',
          operationalState: 'operational',
          technicalSpecs: {
            sapTechnicalId: sapEq.TechnicalIdentNo,
            sapManufacturerPartNo: sapEq.ManufacturerPartNo,
            syncedFromSAP: true,
            lastSAPSync: new Date().toISOString()
          }
        };

        await gmaoStorage.createEquipment(gmaoEquipment);
      }

      await this.logIntegration('SAP', 'sync', 'equipment', sapEquipment.length, 'success', 
        `Synchronized ${sapEquipment.length} equipment records from SAP`);

    } catch (error) {
      await this.logIntegration('SAP', 'sync', 'equipment', 0, 'failed', `Sync error: ${error}`);
      throw error;
    }
  }

  /**
   * Push completed work orders back to SAP
   */
  async pushCompletedWorkOrdersToSAP(): Promise<void> {
    try {
      if (!await this.authenticate()) {
        throw new Error('SAP authentication failed');
      }

      // Get completed work orders that need to be synced back
      const completedOrders = await gmaoStorage.getWorkOrdersByStatus('completed');
      let syncedCount = 0;

      for (const order of completedOrders) {
        // Skip if already synced back to SAP
        if (order.notes?.includes('SAP_SYNCED')) continue;

        const sapUpdateData = {
          OrderNumber: order.orderNumber,
          Status: 'COMPLETED',
          ActualStartDate: order.actualStart?.toISOString(),
          ActualEndDate: order.actualEnd?.toISOString(),
          ActualCost: order.cost?.toString(),
          CompletionNotes: order.completionNotes
        };

        const response = await fetch(`${this.config.baseUrl}/sap/opu/odata/sap/API_MAINTENANCE_ORDER_SRV/MaintenanceOrder('${order.orderNumber}')`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`,
            'Content-Type': 'application/json',
            'sap-client': this.config.client,
            'x-csrf-token': this.authToken || ''
          },
          body: JSON.stringify(sapUpdateData)
        });

        if (response.ok) {
          // Mark as synced
          await gmaoStorage.updateWorkOrder(order.id, {
            notes: `${order.notes || ''} - SAP_SYNCED: ${new Date().toISOString()}`
          });
          syncedCount++;
        } else {
          console.error(`Failed to sync work order ${order.orderNumber} to SAP:`, response.statusText);
        }
      }

      await this.logIntegration('SAP', 'push', 'work_order', syncedCount, 'success', 
        `Pushed ${syncedCount} completed work orders to SAP`);

    } catch (error) {
      await this.logIntegration('SAP', 'push', 'work_order', 0, 'failed', `Push error: ${error}`);
      throw error;
    }
  }

  // Helper methods
  private mapSAPOrderType(sapType: string): string {
    const typeMap: Record<string, string> = {
      'PM01': 'preventive',
      'PM02': 'corrective',
      'PM03': 'predictive',
      'PM99': 'emergency'
    };
    return typeMap[sapType] || 'corrective';
  }

  private mapSAPPriority(sapPriority: string): string {
    const priorityMap: Record<string, string> = {
      '1': 'urgent',
      '2': 'high',
      '3': 'medium',
      '4': 'low'
    };
    return priorityMap[sapPriority] || 'medium';
  }

  private mapSAPStatus(sapStatus: string): string {
    const statusMap: Record<string, string> = {
      'CREATED': 'pending',
      'RELEASED': 'pending',
      'STARTED': 'in_progress',
      'COMPLETED': 'completed',
      'CANCELLED': 'cancelled'
    };
    return statusMap[sapStatus] || 'pending';
  }

  private detectEquipmentType(description: string): string {
    const desc = description.toLowerCase();
    if (desc.includes('motor') || desc.includes('moteur')) return 'moteur';
    if (desc.includes('pump') || desc.includes('pompe')) return 'pompe';
    if (desc.includes('compressor') || desc.includes('compresseur')) return 'compresseur';
    if (desc.includes('conveyor') || desc.includes('convoyeur')) return 'convoyeur';
    return 'autre';
  }

  private extractManufacturer(manufacturerPartNo: string): string {
    // Extract manufacturer from part number pattern
    return manufacturerPartNo?.split('-')[0] || 'Unknown';
  }

  private async getEquipmentIdByNumber(equipmentNumber: string): Promise<number | undefined> {
    try {
      const equipment = await gmaoStorage.getEquipmentByEquipmentId(equipmentNumber);
      return equipment?.id;
    } catch {
      return undefined;
    }
  }

  private async logIntegration(
    systemName: string,
    operationType: string,
    entityType: string,
    entityId: number,
    status: string,
    message: string
  ): Promise<void> {
    try {
      const logData: InsertIntegrationLog = {
        systemName,
        operationType,
        entityType,
        entityId,
        status,
        message,
        requestData: null,
        responseData: null
      };
      await gmaoStorage.createIntegrationLog(logData);
    } catch (error) {
      console.error('Failed to log integration:', error);
    }
  }

  /**
   * Get last synchronization date
   */
  getLastSync(): Date | undefined {
    return this.lastSync;
  }

  /**
   * Test SAP connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const success = await this.authenticate();
      return {
        success,
        message: success ? 'SAP connection successful' : 'SAP connection failed'
      };
    } catch (error) {
      return {
        success: false,
        message: `SAP connection error: ${error}`
      };
    }
  }
}