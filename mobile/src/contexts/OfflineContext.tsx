import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useDatabase } from './DatabaseContext';

interface OfflineContextType {
  isOnline: boolean;
  isOfflineMode: boolean;
  setOfflineMode: (enabled: boolean) => void;
  syncData: () => Promise<void>;
  pendingSyncCount: number;
  lastSyncTime: Date | null;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

interface OfflineProviderProps {
  children: ReactNode;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const { executeQuery, isReady } = useDatabase();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isReady) {
      updatePendingSyncCount();
    }
  }, [isReady]);

  const updatePendingSyncCount = async () => {
    if (!executeQuery) return;

    try {
      const diagnosticsResult = await executeQuery(
        'SELECT COUNT(*) as count FROM diagnostics WHERE synced = 0'
      );
      const feedbackResult = await executeQuery(
        'SELECT COUNT(*) as count FROM feedback WHERE synced = 0'
      );

      const totalPending = (diagnosticsResult.rows._array[0]?.count || 0) +
                          (feedbackResult.rows._array[0]?.count || 0);
      setPendingSyncCount(totalPending);
    } catch (error) {
      console.error('Failed to update pending sync count:', error);
    }
  };

  const syncData = async () => {
    if (!isOnline || !executeQuery) {
      console.log('Cannot sync: offline or database not ready');
      return;
    }

    try {
      // Sync diagnostics
      const unsyncedDiagnostics = await executeQuery(
        'SELECT * FROM diagnostics WHERE synced = 0'
      );

      for (const diagnostic of unsyncedDiagnostics.rows._array) {
        try {
          // Here you would make API calls to sync with the server
          // For now, we'll just mark as synced
          await executeQuery(
            'UPDATE diagnostics SET synced = 1 WHERE id = ?',
            [diagnostic.id]
          );
        } catch (error) {
          console.error('Failed to sync diagnostic:', error);
        }
      }

      // Sync feedback
      const unsyncedFeedback = await executeQuery(
        'SELECT * FROM feedback WHERE synced = 0'
      );

      for (const feedback of unsyncedFeedback.rows._array) {
        try {
          // Here you would make API calls to sync with the server
          await executeQuery(
            'UPDATE feedback SET synced = 1 WHERE id = ?',
            [feedback.id]
          );
        } catch (error) {
          console.error('Failed to sync feedback:', error);
        }
      }

      setLastSyncTime(new Date());
      await updatePendingSyncCount();
      console.log('Data sync completed successfully');
    } catch (error) {
      console.error('Failed to sync data:', error);
    }
  };

  const setOfflineMode = (enabled: boolean) => {
    setIsOfflineMode(enabled);
  };

  return (
    <OfflineContext.Provider value={{
      isOnline: isOnline && !isOfflineMode,
      isOfflineMode,
      setOfflineMode,
      syncData,
      pendingSyncCount,
      lastSyncTime,
    }}>
      {children}
    </OfflineContext.Provider>
  );
};