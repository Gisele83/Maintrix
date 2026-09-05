import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { offlineStorage } from '@/lib/offline-storage';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook pour gérer la synchronisation offline/online
 */
export function useOfflineSync() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Surveiller l'état de la connexion
  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      setSyncInProgress(true);
      
      toast({
        title: "Connexion rétablie",
        description: "Synchronisation des données en cours...",
      });

      try {
        await offlineStorage.syncPendingActions();
        // Rafraîchir les données depuis le serveur
        await queryClient.refetchQueries();
        
        toast({
          title: "Synchronisation terminée",
          description: "Toutes les données ont été synchronisées avec succès.",
        });
      } catch (error) {
        console.error('Erreur de synchronisation:', error);
        toast({
          title: "Erreur de synchronisation",
          description: "Certaines données n'ont pas pu être synchronisées.",
          variant: "destructive",
        });
      } finally {
        setSyncInProgress(false);
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast({
        title: "Mode offline",
        description: "L'application continue de fonctionner hors ligne.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient, toast]);

  // Sauvegarder automatiquement les données importantes pour usage offline
  const { data: equipment } = useQuery<any[]>({
    queryKey: ['/api/equipment'],
    enabled: !isOffline,
  });

  const { data: maintenanceCases } = useQuery<any[]>({
    queryKey: ['/api/maintenance-cases'],
    enabled: !isOffline,
  });

  // Save data when queries succeed
  useEffect(() => {
    if (equipment) {
      offlineStorage.saveOfflineData({ equipment });
    }
  }, [equipment]);

  useEffect(() => {
    if (maintenanceCases) {
      offlineStorage.saveOfflineData({ maintenanceCases });
    }
  }, [maintenanceCases]);

  return {
    isOffline,
    syncInProgress,
    storageStats: offlineStorage.getStorageStats(),
  };
}

/**
 * Hook pour les requêtes qui fonctionnent offline
 */
export function useOfflineQuery<T>(
  queryKey: string[],
  offlineFallback: () => T,
  options?: any
) {
  const { isOffline } = useOfflineSync();

  return useQuery({
    ...options,
    queryKey,
    enabled: !isOffline && (options?.enabled !== false),
    placeholderData: isOffline ? offlineFallback() : undefined,
  });
}