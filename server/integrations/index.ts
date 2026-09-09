/**
 * Enterprise Integration Hub
 * Centralized management for all external system integrations
 */

import { SAPConnector, SAPConfig } from './sap-connector';
import { IoTConnector, IoTConfig } from './iot-connector';
import { MaximoConnector, createMaximoConnector } from './maximo-connector';
import { ScadaConnector, createScadaConnector } from './scada-connector';
import { gmaoStorage } from '../gmao-storage';
import { registerBackgroundTask } from "../background-tasks";

export interface IntegrationConfig {
  sap?: SAPConfig;
  iot?: IoTConfig;
}

export class IntegrationHub {
  private sapConnector?: SAPConnector;
  private iotConnector?: IoTConnector;
  private maximoConnector?: MaximoConnector;
  private scadaConnector?: ScadaConnector;
  private config: IntegrationConfig;
  private isInitialized = false;

  constructor(config: IntegrationConfig) {
    this.config = config;
  }

  /**
   * Initialize all configured integrations
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing enterprise integrations...');

      // Initialize SAP connector
      if (this.config.sap) {
        this.sapConnector = new SAPConnector(this.config.sap);
        console.log('✓ SAP connector initialized');
      }

      // Initialize IoT connector
      if (this.config.iot) {
        this.iotConnector = new IoTConnector(this.config.iot);
        await this.iotConnector.initialize();
        console.log('✓ IoT connector initialized');
      }

      // Initialize Maximo connector (env-driven, optional)
      const maximo = createMaximoConnector();
      if (maximo) {
        this.maximoConnector = maximo;
        const test = await maximo.testConnection();
        console.log(`✓ Maximo connector initialized — ${test.message}`);
      } else {
        console.log('ℹ️  Maximo connector not configured (set MAXIMO_BASE_URL / MAXIMO_USERNAME / MAXIMO_PASSWORD to enable)');
      }

      // Initialize SCADA connector (env-driven, optional)
      const scada = createScadaConnector();
      if (scada) {
        this.scadaConnector = scada;
        const test = await scada.testConnection();
        console.log(`✓ SCADA connector initialized — ${test.message}`);
        // Start polling if PLC addresses are configured
        const plcAddresses = process.env.SCADA_PLC_ADDRESSES?.split(',').map(s => s.trim()) || [];
        if (plcAddresses.length > 0) {
          scada.startPolling(plcAddresses);
        }
      } else {
        console.log('ℹ️  SCADA connector not configured (set SCADA_ENDPOINT to enable)');
      }

      this.isInitialized = true;
      console.log('✓ All enterprise integrations initialized successfully');

      // Start periodic synchronization
      this.startPeriodicSync();

    } catch (error) {
      console.error('Failed to initialize integrations:', error);
      throw error;
    }
  }

  /**
   * Start periodic synchronization with external systems
   */
  private startPeriodicSync(): void {
    // Tâches B-6, B-7 et C-5. Les try/catch locaux sont supprimés : le
    // superviseur les remplace et ajoute ce qui manquait — backoff, circuit
    // ouvert et arrêt propre. Le compteur ad hoc `iotErrorCount` de la boucle
    // IoT (qui s'arrêtait DÉFINITIVEMENT après 5 erreurs, sans jamais reprendre
    // même une fois la base revenue) est remplacé par le circuit du superviseur,
    // qui lui se referme tout seul au premier tick réussi.

    // Synchronisation SAP toutes les 15 minutes (réseau sortant).
    if (this.sapConnector) {
      registerBackgroundTask({
        name: 'integrations:sap-sync',
        intervalMs: 15 * 60 * 1000,
        criticality: 'B',
        run: async () => {
          const r = await this.syncWithSAP();
          if (!r.success) throw new Error(r.message);
        },
      });
    }

    // Synchronisation Maximo toutes les 30 minutes (réseau sortant).
    if (this.maximoConnector) {
      registerBackgroundTask({
        name: 'integrations:maximo-sync',
        intervalMs: 30 * 60 * 1000,
        criticality: 'B',
        run: async () => {
          const r = await this.syncWithMaximo();
          if (!r.success) throw new Error(r.message);
        },
      });
    }

    // Simulation IoT toutes les 30 secondes (lecture DB + écriture DB).
    if (this.iotConnector) {
      let validEquipmentIds: number[] = [];
      let lastEquipmentCheck = 0;

      registerBackgroundTask({
        name: 'integrations:iot-simulation',
        intervalMs: 30 * 1000,
        criticality: 'C',
        run: async () => {
          const now = Date.now();
          if (now - lastEquipmentCheck > 60000 || validEquipmentIds.length === 0) {
            const { db } = await import('../db.js');
            const { equipmentRegistry } = await import('@shared/schema.js');
            const equipments = await db.select({ id: equipmentRegistry.id }).from(equipmentRegistry).limit(10);
            validEquipmentIds = equipments.map(e => e.id);
            lastEquipmentCheck = now;
          }
          if (validEquipmentIds.length === 0) return;
          for (const eqId of validEquipmentIds.slice(0, 5)) {
            await this.iotConnector!.simulateSensorData(eqId);
          }
        },
      });
    }
  }

  /**
   * Synchronize with SAP system
   */
  async syncWithSAP(): Promise<{ success: boolean; message: string }> {
    if (!this.sapConnector) {
      return { success: false, message: 'SAP connector not configured' };
    }

    try {
      await this.sapConnector.syncWorkOrdersFromSAP();
      await this.sapConnector.syncEquipmentFromSAP();
      await this.sapConnector.pushCompletedWorkOrdersToSAP();
      return { success: true, message: 'SAP synchronization completed successfully' };
    } catch (error) {
      return { success: false, message: `SAP sync failed: ${error}` };
    }
  }

  /**
   * Synchronize with Maximo system
   */
  async syncWithMaximo(): Promise<{ success: boolean; message: string }> {
    if (!this.maximoConnector) {
      return { success: false, message: 'Maximo connector not configured' };
    }

    try {
      const workOrders = await this.maximoConnector.fetchWorkOrders({ limit: 100 });
      const assets = await this.maximoConnector.fetchAssets({ limit: 100 });
      return {
        success: true,
        message: `Maximo sync: fetched ${workOrders.length} work orders, ${assets.length} assets`
      };
    } catch (error) {
      return { success: false, message: `Maximo sync failed: ${error}` };
    }
  }

  /**
   * Get real-time IoT data for equipment
   */
  async getIoTData(equipmentId: number): Promise<any[]> {
    if (!this.iotConnector) {
      throw new Error('IoT connector not initialized');
    }
    return await this.iotConnector.getRealtimeSensorData(equipmentId);
  }

  /**
   * Get SCADA tag values
   */
  async getScadaTags(nodeIds?: string[]): Promise<any[]> {
    if (!this.scadaConnector) {
      return [];
    }
    return await this.scadaConnector.readTagValues(nodeIds);
  }

  /**
   * Get active SCADA alarms
   */
  async getScadaAlarms(): Promise<any[]> {
    if (!this.scadaConnector) {
      return [];
    }
    return await this.scadaConnector.fetchActiveAlarms();
  }

  /**
   * Test all integration connections
   */
  async testAllConnections(): Promise<{ [key: string]: { success: boolean; message: string } }> {
    const results: { [key: string]: { success: boolean; message: string } } = {};

    if (this.sapConnector) {
      results.sap = await this.sapConnector.testConnection();
    }

    if (this.iotConnector) {
      results.iot = await this.iotConnector.testConnection();
    }

    if (this.maximoConnector) {
      results.maximo = await this.maximoConnector.testConnection();
    } else {
      results.maximo = { success: false, message: 'Not configured (set MAXIMO_BASE_URL to enable)' };
    }

    if (this.scadaConnector) {
      results.scada = await this.scadaConnector.testConnection();
    } else {
      results.scada = { success: false, message: 'Not configured (set SCADA_ENDPOINT to enable)' };
    }

    try {
      await gmaoStorage.getEquipmentRegistry('default-tenant');
      results.database = { success: true, message: 'Database connection successful' };
    } catch (error) {
      results.database = { success: false, message: `Database connection failed: ${error}` };
    }

    return results;
  }

  /**
   * Get integration status
   */
  getStatus(): {
    initialized: boolean;
    connectors: {
      sap: boolean;
      iot: boolean;
      maximo: boolean;
      maximo_config?: any;
      scada: boolean;
      scada_config?: any;
    };
  } {
    return {
      initialized: this.isInitialized,
      connectors: {
        sap: !!this.sapConnector,
        iot: !!this.iotConnector,
        maximo: !!this.maximoConnector,
        maximo_config: this.maximoConnector?.getStatus(),
        scada: !!this.scadaConnector,
        scada_config: this.scadaConnector?.getStatus()
      }
    };
  }

  /**
   * Force manual synchronization of all connectors
   */
  async forceSyncAll(): Promise<{ [key: string]: { success: boolean; message: string } }> {
    const results: { [key: string]: { success: boolean; message: string } } = {};

    if (this.sapConnector) {
      results.sap = await this.syncWithSAP();
    }

    if (this.maximoConnector) {
      results.maximo = await this.syncWithMaximo();
    }

    if (this.scadaConnector) {
      const tags = await this.scadaConnector.readTagValues();
      results.scada = { success: true, message: `SCADA: read ${tags.length} tag values` };
    }

    if (this.iotConnector) {
      try {
        const { db } = await import('../db.js');
        const { equipmentRegistry } = await import('@shared/schema.js');
        const equipments = await db.select({ id: equipmentRegistry.id }).from(equipmentRegistry).limit(10);
        const eqIds = equipments.map(e => e.id);
        if (eqIds.length === 0) {
          results.iot = { success: true, message: 'No equipment in registry, IoT simulation skipped' };
        } else {
          for (const eqId of eqIds) {
            await this.iotConnector!.simulateSensorData(eqId);
          }
          results.iot = { success: true, message: `IoT data collected for ${eqIds.length} equipment(s)` };
        }
      } catch (error) {
        results.iot = { success: false, message: `IoT sync failed: ${error}` };
      }
    }

    return results;
  }

  /**
   * Shutdown all integrations
   */
  async shutdown(): Promise<void> {
    try {
      if (this.iotConnector) {
        await this.iotConnector.disconnect();
      }
      if (this.scadaConnector) {
        await this.scadaConnector.disconnect();
      }
      this.isInitialized = false;
      console.log('All integrations shut down successfully');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}

// Export singleton instance
let integrationHub: IntegrationHub | null = null;

export function initializeIntegrations(config: IntegrationConfig): IntegrationHub {
  integrationHub = new IntegrationHub(config);
  return integrationHub;
}

export function getIntegrationHub(): IntegrationHub | null {
  return integrationHub;
}
