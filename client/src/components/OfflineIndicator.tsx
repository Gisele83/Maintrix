import { Wifi, WifiOff, Loader2, Clock } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Indicateur de statut offline/online avec informations détaillées
 */
export function OfflineIndicator() {
  const { isOffline, syncInProgress, storageStats } = useOfflineSync();

  const handleManualSync = async () => {
    if (!isOffline) {
      // Forcer une synchronisation manuelle
      window.location.reload();
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {syncInProgress ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isOffline ? (
            <WifiOff className="h-4 w-4 text-destructive" />
          ) : (
            <Wifi className="h-4 w-4 text-green-500" />
          )}
          
          <Badge 
            variant={isOffline ? "destructive" : "default"}
            className="text-xs"
          >
            {syncInProgress ? "Sync..." : isOffline ? "Offline" : "Online"}
          </Badge>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80" align="end">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              {isOffline ? (
                <WifiOff className="h-4 w-4 text-destructive" />
              ) : (
                <Wifi className="h-4 w-4 text-green-500" />
              )}
              État de la connexion
            </CardTitle>
            <CardDescription>
              {isOffline 
                ? "Application en mode offline - Les données sont sauvegardées localement"
                : "Connecté au serveur - Toutes les fonctionnalités disponibles"
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Statistiques de stockage offline */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Données disponibles offline</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span>Équipements:</span>
                  <span className="font-mono">{storageStats.equipmentCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cas maintenance:</span>
                  <span className="font-mono">{storageStats.maintenanceCasesCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Diagnostics:</span>
                  <span className="font-mono">{storageStats.diagnosticSessionsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ordres de travail:</span>
                  <span className="font-mono">{storageStats.workOrdersCount}</span>
                </div>
              </div>
            </div>

            {/* Actions en attente */}
            {storageStats.pendingActionsCount > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Actions en attente
                </h4>
                <Badge variant="outline" className="text-xs">
                  {storageStats.pendingActionsCount} action(s) à synchroniser
                </Badge>
              </div>
            )}

            {/* Dernière synchronisation */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Dernière synchronisation</h4>
              <p className="text-xs text-muted-foreground">
                {storageStats.lastSyncDate.toLocaleString('fr-FR')}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {!isOffline && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleManualSync}
                  disabled={syncInProgress}
                >
                  {syncInProgress ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Actualiser
                </Button>
              )}
              
              {isOffline && (
                <Badge variant="secondary" className="text-xs">
                  Mode hors ligne actif
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}