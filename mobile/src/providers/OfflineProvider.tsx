import React, { createContext, useContext, useState, useEffect } from 'react';
// import NetInfo from '@react-native-netinfo/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDatabase } from './DatabaseProvider';

interface OfflineContextType {
  isConnected: boolean;
  isOnlineMode: boolean;
  pendingSyncCount: number;
  syncData: () => Promise<void>;
  downloadOfflineData: () => Promise<void>;
  getPendingSyncItems: () => Promise<any[]>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isOnlineMode, setIsOnlineMode] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const { db, isReady } = useDatabase();

  useEffect(() => {
    // For demo purposes, simulate connection state
    // In a real app, uncomment NetInfo code above
    // const unsubscribe = NetInfo.addEventListener(state => {
    //   setIsConnected(state.isConnected ?? false);
    // });
    // return () => unsubscribe();
    
    // Simulate periodic connection check for demo
    const interval = setInterval(() => {
      // Randomly simulate connection changes for demo
      const randomConnection = Math.random() > 0.2; // 80% chance of being connected
      setIsConnected(randomConnection);
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isReady) {
      updatePendingSyncCount();
      loadOfflineMode();
    }
  }, [isReady]);

  const loadOfflineMode = async () => {
    try {
      const mode = await AsyncStorage.getItem('offline_mode');
      setIsOnlineMode(mode !== 'true');
    } catch (error) {
      console.error('Error loading offline mode:', error);
    }
  };

  const updatePendingSyncCount = () => {
    if (!db) return;

    db.transaction((tx) => {
      tx.executeSql(
        'SELECT COUNT(*) as count FROM work_orders WHERE synced = 0',
        [],
        (_, { rows }) => {
          const workOrdersCount = rows.item(0).count;
          
          tx.executeSql(
            'SELECT COUNT(*) as count FROM diagnostic_sessions WHERE synced = 0',
            [],
            (_, { rows }) => {
              const diagnosticCount = rows.item(0).count;
              setPendingSyncCount(workOrdersCount + diagnosticCount);
            }
          );
        }
      );
    });
  };

  const downloadOfflineData = async (): Promise<void> => {
    if (!isConnected || !db) {
      throw new Error('No internet connection or database not ready');
    }

    try {
      // Download maintenance cases and repair procedures
      const maintenanceResponse = await fetch('https://your-server.com/api/maintenance-cases');
      const maintenanceCases = await maintenanceResponse.json();

      const proceduresResponse = await fetch('https://your-server.com/api/repair-procedures');
      const procedures = await proceduresResponse.json();

      // Store data in local database
      db.transaction((tx) => {
        // Clear existing data
        tx.executeSql('DELETE FROM maintenance_cases');
        tx.executeSql('DELETE FROM repair_procedures');

        // Insert maintenance cases
        maintenanceCases.forEach((item: any) => {
          tx.executeSql(
            'INSERT INTO maintenance_cases (equipment_type, symptoms, diagnosis, solution, urgency, confidence) VALUES (?, ?, ?, ?, ?, ?)',
            [item.equipmentType, item.symptoms, item.diagnosis, item.solution, item.urgency, item.confidence]
          );
        });

        // Insert repair procedures
        procedures.forEach((item: any) => {
          tx.executeSql(
            'INSERT INTO repair_procedures (case_id, step_number, title, description, safety_warning, tools_required, estimated_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [item.caseId, item.stepNumber, item.title, item.description, item.safetyWarning, item.toolsRequired, item.estimatedTime]
          );
        });
      });

      await AsyncStorage.setItem('last_sync', new Date().toISOString());
    } catch (error) {
      console.error('Error downloading offline data:', error);
      throw error;
    }
  };

  const syncData = async (): Promise<void> => {
    if (!isConnected || !db) {
      throw new Error('No internet connection or database not ready');
    }

    try {
      const pendingItems = await getPendingSyncItems();
      
      for (const item of pendingItems) {
        if (item.table === 'work_orders') {
          await fetch('https://your-server.com/api/work-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data)
          });
        } else if (item.table === 'diagnostic_sessions') {
          await fetch('https://your-server.com/api/diagnostic-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data)
          });
        }

        // Mark as synced
        db.transaction((tx) => {
          tx.executeSql(
            `UPDATE ${item.table} SET synced = 1 WHERE id = ?`,
            [item.id]
          );
        });
      }

      updatePendingSyncCount();
    } catch (error) {
      console.error('Error syncing data:', error);
      throw error;
    }
  };

  const getPendingSyncItems = async (): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error('Database not ready'));
        return;
      }

      const pendingItems: any[] = [];

      db.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM work_orders WHERE synced = 0',
          [],
          (_, { rows }) => {
            for (let i = 0; i < rows.length; i++) {
              pendingItems.push({
                table: 'work_orders',
                id: rows.item(i).id,
                data: rows.item(i)
              });
            }

            tx.executeSql(
              'SELECT * FROM diagnostic_sessions WHERE synced = 0',
              [],
              (_, { rows }) => {
                for (let i = 0; i < rows.length; i++) {
                  pendingItems.push({
                    table: 'diagnostic_sessions',
                    id: rows.item(i).id,
                    data: rows.item(i)
                  });
                }
                resolve(pendingItems);
              }
            );
          }
        );
      });
    });
  };

  const value = {
    isConnected,
    isOnlineMode,
    pendingSyncCount,
    syncData,
    downloadOfflineData,
    getPendingSyncItems,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}