import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import NetInfo from '@react-native-netinfo/netinfo';
import { apiService } from '../services/ApiService';
import { OfflineStorage } from '../services/OfflineStorage';

interface OfflineContextType {
  isOnline: boolean;
  isConnecting: boolean;
  syncPending: boolean;
  pendingCount: number;
  syncOfflineData: () => Promise<void>;
  getStorageInfo: () => Promise<any>;
  clearCache: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function useOffline(): OfflineContextType {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}

interface OfflineProviderProps {
  children: React.ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [offlineStorage] = useState(() => new OfflineStorage());

  // Monitor network connection
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOnline = isOnline;
      const nowOnline = state.isConnected ?? false;
      
      setIsOnline(nowOnline);
      setIsConnecting(false);

      // If we just came online, auto-sync
      if (!wasOnline && nowOnline) {
        syncOfflineData();
      }
    });

    return unsubscribe;
  }, [isOnline]);

  // Update pending count periodically
  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const info = await offlineStorage.getStorageInfo();
        setPendingCount(info.pendingFeedback + info.pendingDiagnostics);
      } catch (error) {
        console.error('Error updating pending count:', error);
      }
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [offlineStorage]);

  const syncOfflineData = useCallback(async (): Promise<void> => {
    if (!isOnline || syncPending) return;

    setSyncPending(true);
    try {
      await apiService.syncOfflineData();
      
      // Update pending count after sync
      const info = await offlineStorage.getStorageInfo();
      setPendingCount(info.pendingFeedback + info.pendingDiagnostics);
      
      console.log('Offline data synced successfully');
    } catch (error) {
      console.error('Error syncing offline data:', error);
    } finally {
      setSyncPending(false);
    }
  }, [isOnline, syncPending, offlineStorage]);

  const getStorageInfo = useCallback(async () => {
    return await offlineStorage.getStorageInfo();
  }, [offlineStorage]);

  const clearCache = useCallback(async (): Promise<void> => {
    try {
      await offlineStorage.clearCache();
      setPendingCount(0);
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }, [offlineStorage]);

  const value: OfflineContextType = {
    isOnline,
    isConnecting,
    syncPending,
    pendingCount,
    syncOfflineData,
    getStorageInfo,
    clearCache,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}