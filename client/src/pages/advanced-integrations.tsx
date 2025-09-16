import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Database, 
  Zap, 
  Brain, 
  BarChart3, 
  Wifi, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Activity,
  Server,
  TrendingUp,
  Shield,
  Link,
  Play,
  Pause,
  RefreshCw,
  Eye,
  Plus,
  Download,
  Upload,
  MoreVertical
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';

// Types
interface ERPSystem {
  id: string;
  systemName: string;
  systemType: string;
  connectionUrl: string;
  authMethod: string;
  syncInterval: number;
  lastSyncAt: string | null;
  isActive: boolean;
}

interface SCADAConnection {
  id: string;
  connectionName: string;
  protocol: string;
  endpoint: string;
  isConnected: boolean;
  lastHeartbeat: string | null;
  errorCount: number;
}

interface AIModel {
  id: string;
  modelName: string;
  modelType: string;
  algorithmType: string;
  accuracy: number;
  precision: number;
  isActive: boolean;
  lastTrainingDate: string | null;
  version: string;
}

interface PowerBiWorkspace {
  id: string;
  workspaceName: string;
  workspaceId: string;
  isActive: boolean;
  lastSyncAt: string | null;
  syncStatus: string;
}

export default function AdvancedIntegrationsPage() {
  const { toast } = useToast();

  // Queries for data
  const { data: erpSystems, isLoading: erpLoading } = useQuery({
    queryKey: ['/api/erp-systems'],
    queryFn: () => apiRequest('/api/erp-systems', { method: 'GET' })
  });

  const { data: scadaConnections, isLoading: scadaLoading } = useQuery({
    queryKey: ['/api/scada-connections'],
    queryFn: () => apiRequest('/api/scada-connections', { method: 'GET' })
  });

  const { data: aiModels, isLoading: aiLoading } = useQuery({
    queryKey: ['/api/ai-models'],
    queryFn: () => apiRequest('/api/ai-models', { method: 'GET' })
  });

  const { data: powerBiWorkspaces, isLoading: powerBiLoading } = useQuery({
    queryKey: ['/api/power-bi/workspaces'],
    queryFn: () => apiRequest('/api/power-bi/workspaces', { method: 'GET' })
  });

  // Mutations for actions
  const testERPMutation = useMutation({
    mutationFn: (systemId: string) => 
      apiRequest(`/api/erp-systems/${systemId}/test`, { method: 'POST' }),
    onSuccess: (data) => {
      toast({
        title: "Test de connexion ERP",
        description: data.message,
        variant: data.success ? "default" : "destructive"
      });
    }
  });

  const syncERPMutation = useMutation({
    mutationFn: ({ systemId, entityTypes }: { systemId: string; entityTypes: string[] }) => 
      apiRequest(`/api/erp-systems/${systemId}/sync`, { 
        method: 'POST',
        body: { entityTypes }
      }),
    onSuccess: (data) => {
      toast({
        title: "Synchronisation ERP",
        description: `${data.successfulRecords} enregistrements synchronisés avec succès`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/erp-systems'] });
    }
  });

  const testSCADAMutation = useMutation({
    mutationFn: (connectionId: string) => 
      apiRequest(`/api/scada-connections/${connectionId}/test`, { method: 'POST' }),
    onSuccess: (data) => {
      toast({
        title: "Test de connexion SCADA",
        description: data.message,
        variant: data.success ? "default" : "destructive"
      });
    }
  });

  const trainAIMutation = useMutation({
    mutationFn: ({ modelId, hyperParameters }: { modelId: string; hyperParameters: any }) => 
      apiRequest(`/api/ai-models/${modelId}/train`, { 
        method: 'POST',
        body: { hyperParameters }
      }),
    onSuccess: (data) => {
      toast({
        title: "Entraînement du modèle IA",
        description: `Entraînement démarré. Durée estimée: ${Math.floor(data.estimatedDuration / 60)} minutes`
      });
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl shadow-lg">
              <Settings className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 bg-clip-text text-transparent dark:from-white dark:via-gray-100 dark:to-gray-200">
                Intégrations Avancées
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Connecteurs ERP/SCADA, IA Prédictive Avancée et Reporting Power BI
              </p>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-white/50 dark:border-gray-700/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Systèmes ERP</p>
                    <p className="text-xl font-bold">{erpSystems?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-white/50 dark:border-gray-700/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Connexions SCADA</p>
                    <p className="text-xl font-bold">{scadaConnections?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-white/50 dark:border-gray-700/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Modèles IA</p>
                    <p className="text-xl font-bold">{aiModels?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-white/50 dark:border-gray-700/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Workspaces Power BI</p>
                    <p className="text-xl font-bold">{powerBiWorkspaces?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="erp-scada" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-1 rounded-xl">
            <TabsTrigger value="erp-scada" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              ERP/SCADA
            </TabsTrigger>
            <TabsTrigger value="ai-predictive" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              IA Prédictive
            </TabsTrigger>
            <TabsTrigger value="power-bi" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Power BI
            </TabsTrigger>
          </TabsList>

          {/* ERP/SCADA Tab */}
          <TabsContent value="erp-scada" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ERP Systems */}
              <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-white/50 dark:border-gray-700/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <CardTitle>Systèmes ERP</CardTitle>
                    </div>
                    <Button size="sm" className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700">
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  </div>
                  <CardDescription>
                    Connecteurs vers SAP, Oracle, Maximo et autres systèmes ERP
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {erpLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {erpSystems?.map((system: ERPSystem) => (
                        <div key={system.id} className="p-4 bg-white/50 dark:bg-gray-700/50 rounded-lg border border-gray-200/50 dark:border-gray-600/50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{system.systemName}</h4>
                              <Badge variant={system.isActive ? "default" : "secondary"}>
                                {system.isActive ? "Actif" : "Inactif"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => testERPMutation.mutate(system.id)}
                                disabled={testERPMutation.isPending}
                                data-testid={`button-test-erp-${system.id}`}
                              >
                                <Activity className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => syncERPMutation.mutate({ 
                                  systemId: system.id, 
                                  entityTypes: ['work_orders', 'equipment', 'spare_parts'] 
                                })}
                                disabled={syncERPMutation.isPending}
                                data-testid={`button-sync-erp-${system.id}`}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            <div>Type: {system.systemType}</div>
                            <div>Méthode d'auth: {system.authMethod}</div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              Dernière sync: {system.lastSyncAt ? new Date(system.lastSyncAt).toLocaleDateString('fr-FR') : 'Jamais'}
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!erpSystems || erpSystems.length === 0) && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          Aucun système ERP configuré
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SCADA Connections */}
              <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-white/50 dark:border-gray-700/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      <CardTitle>Connexions SCADA</CardTitle>
                    </div>
                    <Button size="sm" className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  </div>
                  <CardDescription>
                    Connexions OPC-UA, Modbus, MQTT et autres protocoles industriels
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {scadaLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {scadaConnections?.map((connection: SCADAConnection) => (
                        <div key={connection.id} className="p-4 bg-white/50 dark:bg-gray-700/50 rounded-lg border border-gray-200/50 dark:border-gray-600/50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{connection.connectionName}</h4>
                              <Badge variant={connection.isConnected ? "default" : "destructive"}>
                                <div className="flex items-center gap-1">
                                  {connection.isConnected ? <Wifi className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                  {connection.isConnected ? "Connecté" : "Déconnecté"}
                                </div>
                              </Badge>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => testSCADAMutation.mutate(connection.id)}
                              disabled={testSCADAMutation.isPending}
                              data-testid={`button-test-scada-${connection.id}`}
                            >
                              <Activity className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            <div>Protocole: {connection.protocol}</div>
                            <div>Endpoint: {connection.endpoint}</div>
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-3 w-3" />
                              Erreurs: {connection.errorCount}
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!scadaConnections || scadaConnections.length === 0) && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          Aucune connexion SCADA configurée
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AI Predictive Tab */}
          <TabsContent value="ai-predictive" className="space-y-6">
            <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-white/50 dark:border-gray-700/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <CardTitle>Modèles IA Prédictive</CardTitle>
                  </div>
                  <Button size="sm" className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700">
                    <Plus className="h-4 w-4 mr-1" />
                    Nouveau Modèle
                  </Button>
                </div>
                <CardDescription>
                  Modèles d'apprentissage automatique pour la prédiction de pannes et l'optimisation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {aiLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {aiModels?.map((model: AIModel) => (
                      <div key={model.id} className="p-4 bg-white/50 dark:bg-gray-700/50 rounded-lg border border-gray-200/50 dark:border-gray-600/50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{model.modelName}</h4>
                            <Badge variant={model.isActive ? "default" : "secondary"}>
                              {model.isActive ? "Actif" : "Inactif"}
                            </Badge>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => trainAIMutation.mutate({ 
                              modelId: model.id, 
                              hyperParameters: {} 
                            })}
                            disabled={trainAIMutation.isPending}
                            data-testid={`button-train-ai-${model.id}`}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-sm">
                            <span>Type: {model.modelType}</span>
                            <span>v{model.version}</span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Algorithme: {model.algorithmType}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Précision</span>
                            <span>{(model.accuracy * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={model.accuracy * 100} className="h-2" />
                          
                          <div className="flex justify-between text-sm">
                            <span>Précision</span>
                            <span>{(model.precision * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={model.precision * 100} className="h-2" />
                        </div>

                        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                          Dernier entraînement: {model.lastTrainingDate ? new Date(model.lastTrainingDate).toLocaleDateString('fr-FR') : 'Jamais'}
                        </div>
                      </div>
                    ))}
                    
                    {(!aiModels || aiModels.length === 0) && (
                      <div className="col-span-2 text-center py-8 text-gray-500 dark:text-gray-400">
                        Aucun modèle IA configuré
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Power BI Tab */}
          <TabsContent value="power-bi" className="space-y-6">
            <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-white/50 dark:border-gray-700/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <CardTitle>Workspaces Power BI</CardTitle>
                  </div>
                  <Button size="sm" className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
                    <Plus className="h-4 w-4 mr-1" />
                    Connecter Workspace
                  </Button>
                </div>
                <CardDescription>
                  Intégration avec Microsoft Power BI pour les rapports et tableaux de bord avancés
                </CardDescription>
              </CardHeader>
              <CardContent>
                {powerBiLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {powerBiWorkspaces?.map((workspace: PowerBiWorkspace) => (
                      <div key={workspace.id} className="p-4 bg-white/50 dark:bg-gray-700/50 rounded-lg border border-gray-200/50 dark:border-gray-600/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{workspace.workspaceName}</h4>
                            <Badge variant={workspace.isActive ? "default" : "secondary"}>
                              {workspace.isActive ? "Actif" : "Inactif"}
                            </Badge>
                            <Badge variant={
                              workspace.syncStatus === 'completed' ? 'default' : 
                              workspace.syncStatus === 'syncing' ? 'secondary' : 
                              workspace.syncStatus === 'failed' ? 'destructive' : 'outline'
                            }>
                              {workspace.syncStatus === 'completed' ? <CheckCircle className="h-3 w-3 mr-1" /> : 
                               workspace.syncStatus === 'syncing' ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : 
                               workspace.syncStatus === 'failed' ? <AlertTriangle className="h-3 w-3 mr-1" /> : 
                               <Clock className="h-3 w-3 mr-1" />}
                              {workspace.syncStatus}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              size="sm" 
                              variant="outline"
                              data-testid={`button-view-powerbi-${workspace.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              data-testid={`button-sync-powerbi-${workspace.id}`}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              data-testid={`button-more-powerbi-${workspace.id}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <div>ID Workspace: {workspace.workspaceId}</div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            Dernière sync: {workspace.lastSyncAt ? new Date(workspace.lastSyncAt).toLocaleDateString('fr-FR') : 'Jamais'}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {(!powerBiWorkspaces || powerBiWorkspaces.length === 0) && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        Aucun workspace Power BI connecté
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}