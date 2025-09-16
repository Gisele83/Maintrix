import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

// Form schemas
const erpSystemSchema = z.object({
  systemName: z.string().min(2, "Le nom du système doit faire au moins 2 caractères"),
  systemType: z.string().min(1, "Veuillez sélectionner un type de système"),
  connectionUrl: z.string().url("L'URL de connexion doit être valide"),
  authMethod: z.string().min(1, "Veuillez sélectionner une méthode d'authentification"),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  syncInterval: z.coerce.number().min(30).max(86400).optional(),
});

const scadaConnectionSchema = z.object({
  connectionName: z.string().min(2, "Le nom de connexion doit faire au moins 2 caractères"),
  protocol: z.string().min(1, "Veuillez sélectionner un protocole"),
  endpoint: z.string().min(1, "L'endpoint est requis"),
  pollInterval: z.coerce.number().min(1000).max(300000).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

const aiModelSchema = z.object({
  modelName: z.string().min(2, "Le nom du modèle doit faire au moins 2 caractères"),
  modelType: z.string().min(1, "Veuillez sélectionner un type de modèle"),
  algorithmType: z.string().min(1, "Veuillez sélectionner un algorithme"),
  equipmentCategory: z.string().optional(),
  description: z.string().optional(),
});

const powerBiWorkspaceSchema = z.object({
  workspaceName: z.string().min(2, "Le nom du workspace doit faire au moins 2 caractères"),
  workspaceId: z.string().min(1, "L'ID du workspace est requis"),
  description: z.string().optional(),
  tenantDomain: z.string().optional(),
  powerBiAppId: z.string().optional(),
});

export default function AdvancedIntegrationsPage() {
  const { toast } = useToast();
  const [isERPModalOpen, setIsERPModalOpen] = useState(false);
  const [isSCADAModalOpen, setIsSCADAModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isPowerBIModalOpen, setIsPowerBIModalOpen] = useState(false);

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

  // Form hooks
  const erpForm = useForm<z.infer<typeof erpSystemSchema>>({
    resolver: zodResolver(erpSystemSchema),
    defaultValues: {
      systemName: "",
      systemType: "",
      connectionUrl: "",
      authMethod: "",
      syncInterval: 300,
    },
  });

  const scadaForm = useForm<z.infer<typeof scadaConnectionSchema>>({
    resolver: zodResolver(scadaConnectionSchema),
    defaultValues: {
      connectionName: "",
      protocol: "",
      endpoint: "",
      pollInterval: 5000,
    },
  });

  const aiForm = useForm<z.infer<typeof aiModelSchema>>({
    resolver: zodResolver(aiModelSchema),
    defaultValues: {
      modelName: "",
      modelType: "",
      algorithmType: "",
      equipmentCategory: "",
      description: "",
    },
  });

  const powerBiForm = useForm<z.infer<typeof powerBiWorkspaceSchema>>({
    resolver: zodResolver(powerBiWorkspaceSchema),
    defaultValues: {
      workspaceName: "",
      workspaceId: "",
      description: "",
      tenantDomain: "",
      powerBiAppId: "",
    },
  });

  // Create ERP System mutation
  const createERPMutation = useMutation({
    mutationFn: (data: z.infer<typeof erpSystemSchema>) => {
      const credentials = {
        username: data.username,
        password: data.password,
        apiKey: data.apiKey,
      };
      
      return apiRequest('/api/erp-systems', {
        method: 'POST',
        body: {
          systemName: data.systemName,
          systemType: data.systemType,
          connectionUrl: data.connectionUrl,
          authMethod: data.authMethod,
          credentials,
          syncInterval: data.syncInterval,
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Système ERP créé",
        description: "Le système ERP a été créé avec succès"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/erp-systems'] });
      setIsERPModalOpen(false);
      erpForm.reset();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le système ERP",
        variant: "destructive"
      });
    }
  });

  // Create SCADA Connection mutation
  const createSCADAMutation = useMutation({
    mutationFn: (data: z.infer<typeof scadaConnectionSchema>) => {
      const configuration = {
        username: data.username,
        password: data.password,
      };
      
      return apiRequest('/api/scada-connections', {
        method: 'POST',
        body: {
          connectionName: data.connectionName,
          protocol: data.protocol,
          endpoint: data.endpoint,
          pollInterval: data.pollInterval,
          configuration,
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Connexion SCADA créée",
        description: "La connexion SCADA a été créée avec succès"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scada-connections'] });
      setIsSCADAModalOpen(false);
      scadaForm.reset();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la connexion SCADA",
        variant: "destructive"
      });
    }
  });

  const onERPSubmit = (data: z.infer<typeof erpSystemSchema>) => {
    createERPMutation.mutate(data);
  };

  const onSCADASubmit = (data: z.infer<typeof scadaConnectionSchema>) => {
    createSCADAMutation.mutate(data);
  };

  // Create AI Model mutation
  const createAIMutation = useMutation({
    mutationFn: (data: z.infer<typeof aiModelSchema>) => {
      return apiRequest('/api/ai-models', {
        method: 'POST',
        body: {
          modelName: data.modelName,
          modelType: data.modelType,
          algorithmType: data.algorithmType,
          equipmentCategory: data.equipmentCategory,
          trainDataSource: { type: "historical", source: "maintenance_cases" },
          modelParameters: {},
          featureSet: ["vibration", "temperature", "pressure"],
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Modèle IA créé",
        description: "Le modèle d'IA prédictive a été créé avec succès"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-models'] });
      setIsAIModalOpen(false);
      aiForm.reset();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le modèle IA",
        variant: "destructive"
      });
    }
  });

  // Create Power BI Workspace mutation
  const createPowerBIMutation = useMutation({
    mutationFn: (data: z.infer<typeof powerBiWorkspaceSchema>) => {
      return apiRequest('/api/power-bi/workspaces', {
        method: 'POST',
        body: {
          workspaceName: data.workspaceName,
          workspaceId: data.workspaceId,
          description: data.description,
          tenantDomain: data.tenantDomain,
          powerBiAppId: data.powerBiAppId,
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Workspace Power BI connecté",
        description: "Le workspace Power BI a été connecté avec succès"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/power-bi/workspaces'] });
      setIsPowerBIModalOpen(false);
      powerBiForm.reset();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de connecter le workspace Power BI",
        variant: "destructive"
      });
    }
  });

  const onAISubmit = (data: z.infer<typeof aiModelSchema>) => {
    createAIMutation.mutate(data);
  };

  const onPowerBISubmit = (data: z.infer<typeof powerBiWorkspaceSchema>) => {
    createPowerBIMutation.mutate(data);
  };

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
                    <Dialog open={isERPModalOpen} onOpenChange={setIsERPModalOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700" data-testid="button-add-erp">
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Ajouter un système ERP</DialogTitle>
                          <DialogDescription>
                            Configurez une nouvelle connexion vers un système ERP (SAP, Oracle, Maximo, etc.)
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...erpForm}>
                          <form onSubmit={erpForm.handleSubmit(onERPSubmit)} className="space-y-4">
                            <FormField
                              control={erpForm.control}
                              name="systemName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nom du système</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Ex: SAP Production" {...field} data-testid="input-erp-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={erpForm.control}
                              name="systemType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Type de système</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-erp-type">
                                        <SelectValue placeholder="Sélectionnez un type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="erp">ERP</SelectItem>
                                      <SelectItem value="mes">MES</SelectItem>
                                      <SelectItem value="plc">PLC</SelectItem>
                                      <SelectItem value="scada">SCADA</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={erpForm.control}
                              name="connectionUrl"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>URL de connexion</FormLabel>
                                  <FormControl>
                                    <Input placeholder="https://erp.company.com/api" {...field} data-testid="input-erp-url" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={erpForm.control}
                              name="authMethod"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Méthode d'authentification</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-erp-auth">
                                        <SelectValue placeholder="Sélectionnez une méthode" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="basic">Authentification basique</SelectItem>
                                      <SelectItem value="oauth">OAuth 2.0</SelectItem>
                                      <SelectItem value="api_key">Clé API</SelectItem>
                                      <SelectItem value="certificate">Certificat</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={erpForm.control}
                                name="username"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Nom d'utilisateur</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Optionnel" {...field} data-testid="input-erp-username" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={erpForm.control}
                                name="password"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Mot de passe</FormLabel>
                                    <FormControl>
                                      <Input type="password" placeholder="Optionnel" {...field} data-testid="input-erp-password" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <FormField
                              control={erpForm.control}
                              name="apiKey"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Clé API</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Optionnel" {...field} data-testid="input-erp-api-key" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={erpForm.control}
                              name="syncInterval"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Intervalle de synchronisation (secondes)</FormLabel>
                                  <FormControl>
                                    <Input type="number" placeholder="300" {...field} data-testid="input-erp-sync-interval" />
                                  </FormControl>
                                  <FormDescription>
                                    Entre 30 et 86400 secondes (1 jour)
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <div className="flex justify-end space-x-2 pt-4">
                              <Button type="button" variant="outline" onClick={() => setIsERPModalOpen(false)} data-testid="button-cancel-erp">
                                Annuler
                              </Button>
                              <Button type="submit" disabled={createERPMutation.isPending} data-testid="button-save-erp">
                                {createERPMutation.isPending ? "Création..." : "Créer le système"}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
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
                    <Dialog open={isSCADAModalOpen} onOpenChange={setIsSCADAModalOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700" data-testid="button-add-scada">
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Ajouter une connexion SCADA</DialogTitle>
                          <DialogDescription>
                            Configurez une nouvelle connexion SCADA (OPC-UA, Modbus, MQTT, etc.)
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...scadaForm}>
                          <form onSubmit={scadaForm.handleSubmit(onSCADASubmit)} className="space-y-4">
                            <FormField
                              control={scadaForm.control}
                              name="connectionName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nom de la connexion</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Ex: Ligne Production A" {...field} data-testid="input-scada-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={scadaForm.control}
                              name="protocol"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Protocole</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-scada-protocol">
                                        <SelectValue placeholder="Sélectionnez un protocole" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="opcua">OPC-UA</SelectItem>
                                      <SelectItem value="modbus">Modbus</SelectItem>
                                      <SelectItem value="mqtt">MQTT</SelectItem>
                                      <SelectItem value="bacnet">BACnet</SelectItem>
                                      <SelectItem value="ethernet_ip">EtherNet/IP</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={scadaForm.control}
                              name="endpoint"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Endpoint</FormLabel>
                                  <FormControl>
                                    <Input placeholder="opc.tcp://192.168.1.100:4840" {...field} data-testid="input-scada-endpoint" />
                                  </FormControl>
                                  <FormDescription>
                                    Format: protocole://adresse:port
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={scadaForm.control}
                              name="pollInterval"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Intervalle de polling (millisecondes)</FormLabel>
                                  <FormControl>
                                    <Input type="number" placeholder="5000" {...field} data-testid="input-scada-poll-interval" />
                                  </FormControl>
                                  <FormDescription>
                                    Entre 1000 et 300000 ms (5 minutes)
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={scadaForm.control}
                                name="username"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Nom d'utilisateur</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Optionnel" {...field} data-testid="input-scada-username" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={scadaForm.control}
                                name="password"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Mot de passe</FormLabel>
                                    <FormControl>
                                      <Input type="password" placeholder="Optionnel" {...field} data-testid="input-scada-password" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <div className="flex justify-end space-x-2 pt-4">
                              <Button type="button" variant="outline" onClick={() => setIsSCADAModalOpen(false)} data-testid="button-cancel-scada">
                                Annuler
                              </Button>
                              <Button type="submit" disabled={createSCADAMutation.isPending} data-testid="button-save-scada">
                                {createSCADAMutation.isPending ? "Création..." : "Créer la connexion"}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
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
                  <Dialog open={isAIModalOpen} onOpenChange={setIsAIModalOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700" data-testid="button-add-ai-model">
                        <Plus className="h-4 w-4 mr-1" />
                        Nouveau Modèle
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Créer un nouveau modèle IA</DialogTitle>
                        <DialogDescription>
                          Configurez un nouveau modèle d'intelligence artificielle pour la prédiction de pannes
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...aiForm}>
                        <form onSubmit={aiForm.handleSubmit(onAISubmit)} className="space-y-4">
                          <FormField
                            control={aiForm.control}
                            name="modelName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nom du modèle</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: Prédiction Pompes Hydrauliques" {...field} data-testid="input-ai-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={aiForm.control}
                            name="modelType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Type de modèle</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-ai-type">
                                      <SelectValue placeholder="Sélectionnez un type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="predictive">Prédictif</SelectItem>
                                    <SelectItem value="classification">Classification</SelectItem>
                                    <SelectItem value="anomaly_detection">Détection d'anomalies</SelectItem>
                                    <SelectItem value="regression">Régression</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={aiForm.control}
                            name="algorithmType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Algorithme</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-ai-algorithm">
                                      <SelectValue placeholder="Sélectionnez un algorithme" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="random_forest">Random Forest</SelectItem>
                                    <SelectItem value="gradient_boosting">Gradient Boosting</SelectItem>
                                    <SelectItem value="neural_network">Réseau de Neurones</SelectItem>
                                    <SelectItem value="svm">Support Vector Machine</SelectItem>
                                    <SelectItem value="isolation_forest">Isolation Forest</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={aiForm.control}
                            name="equipmentCategory"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Catégorie d'équipement (optionnel)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-ai-equipment">
                                      <SelectValue placeholder="Toutes catégories" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="">Toutes catégories</SelectItem>
                                    <SelectItem value="moteur">Moteurs</SelectItem>
                                    <SelectItem value="pompe">Pompes</SelectItem>
                                    <SelectItem value="compresseur">Compresseurs</SelectItem>
                                    <SelectItem value="grue">Grues</SelectItem>
                                    <SelectItem value="transformateur">Transformateurs</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={aiForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description (optionnel)</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Description du modèle et de son utilisation..." 
                                    {...field} 
                                    data-testid="textarea-ai-description"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="flex justify-end space-x-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsAIModalOpen(false)} data-testid="button-cancel-ai">
                              Annuler
                            </Button>
                            <Button type="submit" disabled={createAIMutation.isPending} data-testid="button-save-ai">
                              {createAIMutation.isPending ? "Création..." : "Créer le modèle"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
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
                  <Dialog open={isPowerBIModalOpen} onOpenChange={setIsPowerBIModalOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700" data-testid="button-add-powerbi">
                        <Plus className="h-4 w-4 mr-1" />
                        Connecter Workspace
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Connecter un workspace Power BI</DialogTitle>
                        <DialogDescription>
                          Configurez la connexion à un workspace Microsoft Power BI pour les rapports avancés
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...powerBiForm}>
                        <form onSubmit={powerBiForm.handleSubmit(onPowerBISubmit)} className="space-y-4">
                          <FormField
                            control={powerBiForm.control}
                            name="workspaceName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nom du workspace</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: GMAO Production Reports" {...field} data-testid="input-powerbi-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={powerBiForm.control}
                            name="workspaceId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ID du workspace Power BI</FormLabel>
                                <FormControl>
                                  <Input placeholder="f089354e-8366-4e18-aea3-4cb4a3a50b48" {...field} data-testid="input-powerbi-id" />
                                </FormControl>
                                <FormDescription>
                                  GUID du workspace disponible dans les paramètres Power BI
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={powerBiForm.control}
                            name="tenantDomain"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Domaine tenant (optionnel)</FormLabel>
                                <FormControl>
                                  <Input placeholder="votreentreprise.onmicrosoft.com" {...field} data-testid="input-powerbi-tenant" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={powerBiForm.control}
                            name="powerBiAppId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ID de l'application Power BI (optionnel)</FormLabel>
                                <FormControl>
                                  <Input placeholder="12345678-1234-1234-1234-123456789abc" {...field} data-testid="input-powerbi-app-id" />
                                </FormControl>
                                <FormDescription>
                                  Pour l'authentification via Azure AD
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={powerBiForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description (optionnel)</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Description du workspace et de son utilisation..." 
                                    {...field} 
                                    data-testid="textarea-powerbi-description"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="flex justify-end space-x-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsPowerBIModalOpen(false)} data-testid="button-cancel-powerbi">
                              Annuler
                            </Button>
                            <Button type="submit" disabled={createPowerBIMutation.isPending} data-testid="button-save-powerbi">
                              {createPowerBIMutation.isPending ? "Connexion..." : "Connecter le workspace"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
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