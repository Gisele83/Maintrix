/**
 * Enterprise Integration Hub
 * Centralized management for all external system integrations
 */

import { SAPConnector, SAPConfig } from './sap-connector';
import { IoTConnector, IoTConfig } from './iot-connector';
import { gmaoStorage } from '../gmao-storage';

export interface IntegrationConfig {
  sap?: SAPConfig;
  iot?: IoTConfig;
  maximo?: {
    baseUrl: string;
    username: string;
    password: string;
    maxvarName: string;
  };
  scada?: {
    opcuaEndpoint: string;
    plcAddresses: string[];
  };
}

export class IntegrationHub {
  private sapConnector?: SAPConnector;
  private iotConnector?: IoTConnector;
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

      // TODO: Initialize other connectors
      // - Maximo connector
      // - SCADA connector
      // - Universal REST API gateway

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
    // SAP synchronization every 15 minutes
    if (this.sapConnector) {
      setInterval(async () => {
        try {
          await this.syncWithSAP();
        } catch (error) {
          console.error('SAP sync error:', error);
        }
      }, 15 * 60 * 1000);
    }

    // IoT simulation every 30 seconds (for demo) - only when DB is available
    if (this.iotConnector) {
      let iotErrorCount = 0;
      setInterval(async () => {
        if (iotErrorCount > 5) return;
        try {
          for (let i = 1; i <= 5; i++) {
            await this.iotConnector.simulateSensorData(i);
          }
          iotErrorCount = 0;
        } catch (error: any) {
          iotErrorCount++;
          if (iotErrorCount <= 2) {
            console.error('IoT simulation error:', error?.message?.substring(0, 80));
          }
          if (iotErrorCount === 3) {
            console.warn('⚠️ IoT simulation paused - database unavailable. Will retry silently.');
          }
        }
      }, 30 * 1000);
    }
  }

  /**
   * Synchronize with SAP system
   */
  async syncWithSAP(): Promise<{ success: boolean; message: string }> {
    if (!this.sapConnector) {
      return { success: false, message: 'SAP connector not initialized' };
    }

    try {
      // Sync work orders from SAP
      await this.sapConnector.syncWorkOrdersFromSAP();
      
      // Sync equipment from SAP
      await this.sapConnector.syncEquipmentFromSAP();
      
      // Push completed work orders back to SAP
      await this.sapConnector.pushCompletedWorkOrdersToSAP();

      return { success: true, message: 'SAP synchronization completed successfully' };
    } catch (error) {
      return { success: false, message: `SAP sync failed: ${error}` };
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
   * Test all integration connections
   */
  async testAllConnections(): Promise<{ [key: string]: { success: boolean; message: string } }> {
    const results: { [key: string]: { success: boolean; message: string } } = {};

    // Test SAP connection
    if (this.sapConnector) {
      results.sap = await this.sapConnector.testConnection();
    }

    // Test IoT connection
    if (this.iotConnector) {
      results.iot = await this.iotConnector.testConnection();
    }

    // Test database connection
    try {
      await gmaoStorage.getEquipmentRegistry();
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
      scada: boolean;
    };
  } {
    return {
      initialized: this.isInitialized,
      connectors: {
        sap: !!this.sapConnector,
        iot: !!this.iotConnector,
        maximo: false, // TODO: Implement
        scada: false   // TODO: Implement
      }
    };
  }

  /**
   * Force manual synchronization
   */
  async forceSyncAll(): Promise<{ [key: string]: { success: boolean; message: string } }> {
    const results: { [key: string]: { success: boolean; message: string } } = {};

    // Force SAP sync
    if (this.sapConnector) {
      results.sap = await this.syncWithSAP();
    }

    // Force IoT data collection
    if (this.iotConnector) {
      try {
        for (let i = 1; i <= 10; i++) {
          await this.iotConnector.simulateSensorData(i);
        }
        results.iot = { success: true, message: 'IoT data simulation completed' };
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