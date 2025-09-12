import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Settings, 
  Package, 
  Layers, 
  Factory, 
  Truck, 
  Zap, 
  Building, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  ArrowRight,
  Users,
  Brain,
  BarChart3,
  ShoppingCart,
  FileText
} from 'lucide-react';
import { ModernNavigation } from '@/components/modern-navigation';

interface Module {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  version: string;
  dependencies: string[];
  defaultEnabled: boolean;
  isCore: boolean;
  routePaths: string[];
  apiEndpoints: string[];
  permissions: string[];
  configuration: Record<string, any>;
}

interface SectorTemplate {
  id: string;
  key: string;
  name: string;
  description: string;
  enabledModules: string[];
  defaultWorkflows: Record<string, any>;
  defaultSettings: Record<string, any>;
  kpiConfig: Record<string, any>;
  complianceRequirements: string[];
  industrySpecifics: Record<string, any>;
}

interface TenantConfig {
  enabledModules: string[];
  moduleSettings: Record<string, any>;
  sector?: string;
}

const sectorIcons = {
  industry: Factory,
  transport: Truck,
  energy: Zap,
  facilities: Building
};

const moduleIcons = {
  'equipment-management': Package,
  'work-orders': Settings,
  'preventive-maintenance': CheckCircle2,
  'inventory-simple': Package,
  'smart-diagnostic': Brain,
  'maintenance-dashboard': BarChart3,
  'procurement': ShoppingCart,
  'reporting': FileText,
  'iot-integration': Zap
};

export default function ERPConfiguration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [moduleConfig, setModuleConfig] = useState<Record<string, boolean>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch available modules
  const { data: moduleData, isLoading: loadingModules } = useQuery<{
    availableModules: Module[];
    enabledModules: string[];
    moduleSettings: Record<string, any>;
    sector?: string;
  }>({
    queryKey: ['/api/tenant/modules'],
  });

  // Fetch sector templates
  const { data: sectorTemplates = [], isLoading: loadingTemplates } = useQuery<SectorTemplate[]>({
    queryKey: ['/api/tenant/sector-templates'],
  });

  // Initialize module configuration from current tenant config
  useEffect(() => {
    if (moduleData) {
      const initialConfig: Record<string, boolean> = {};
      moduleData.availableModules.forEach(module => {
        initialConfig[module.key] = moduleData.enabledModules.includes(module.key);
      });
      setModuleConfig(initialConfig);
      setSelectedSector(moduleData.sector || null);
    }
  }, [moduleData]);

  // Apply sector template mutation
  const applySectorMutation = useMutation({
    mutationFn: (sectorKey: string) => 
      apiRequest('/api/tenant/apply-sector-template', {
        method: 'POST',
        body: { sectorKey }
      }),
    onSuccess: (data) => {
      toast({
        title: "Template appliqué avec succès",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/modules'] });
      setHasUnsavedChanges(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur d'application du template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update modules mutation
  const updateModulesMutation = useMutation({
    mutationFn: (config: { enabledModules: string[]; moduleSettings: Record<string, any>; sector?: string }) =>
      apiRequest('/api/tenant/modules', {
        method: 'PUT',
        body: config
      }),
    onSuccess: () => {
      toast({
        title: "Configuration mise à jour",
        description: "La configuration des modules a été sauvegardée.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/modules'] });
      setHasUnsavedChanges(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de sauvegarde",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApplySectorTemplate = (templateKey: string) => {
    applySectorMutation.mutate(templateKey);
    setSelectedSector(templateKey);
  };

  const handleModuleToggle = (moduleKey: string, enabled: boolean) => {
    setModuleConfig(prev => ({
      ...prev,
      [moduleKey]: enabled
    }));
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = () => {
    if (!moduleData) return;

    const enabledModules = Object.entries(moduleConfig)
      .filter(([key, enabled]) => enabled)
      .map(([key]) => key);

    updateModulesMutation.mutate({
      enabledModules,
      moduleSettings: moduleData.moduleSettings,
      sector: selectedSector || undefined
    });
  };

  const getCategoryModules = (category: string) => {
    if (!moduleData) return [];
    return moduleData.availableModules.filter(module => module.category === category);
  };

  const getEnabledModulesCount = () => {
    return Object.values(moduleConfig).filter(Boolean).length;
  };

  const getTotalModulesCount = () => {
    return moduleData?.availableModules.length || 0;
  };

  if (loadingModules || loadingTemplates) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <ModernNavigation />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-700">Chargement de la configuration...</h2>
            <p className="text-gray-500">Récupération des modules et templates</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <ModernNavigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Configuration ERP</h1>
              <p className="text-gray-600">Personnalisez votre système selon votre secteur d'activité</p>
            </div>
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200">
            <div className="flex items-center gap-6">
              <div className="text-sm">
                <span className="text-gray-500">Modules activés:</span>
                <span className="font-semibold text-blue-600 ml-1">
                  {getEnabledModulesCount()}/{getTotalModulesCount()}
                </span>
              </div>
              {selectedSector && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50">
                    <div className="flex items-center gap-1">
                      {React.createElement(sectorIcons[selectedSector as keyof typeof sectorIcons] || Factory, { className: "w-3 h-3" })}
                      {sectorTemplates.find(t => t.key === selectedSector)?.name}
                    </div>
                  </Badge>
                </div>
              )}
            </div>
            
            {hasUnsavedChanges && (
              <Button 
                onClick={handleSaveChanges}
                disabled={updateModulesMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {updateModulesMutation.isPending ? "Sauvegarde..." : "Sauvegarder les modifications"}
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="sector-templates" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sector-templates" className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Templates Sectoriels
            </TabsTrigger>
            <TabsTrigger value="modules" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Modules ERP
            </TabsTrigger>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Vue d'ensemble
            </TabsTrigger>
          </TabsList>

          {/* Sector Templates Tab */}
          <TabsContent value="sector-templates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5" />
                  Templates par Secteur d'Activité
                </CardTitle>
                <CardDescription>
                  Choisissez un template pré-configuré adapté à votre secteur pour activer automatiquement les modules appropriés
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {sectorTemplates.map((template) => {
                    const Icon = sectorIcons[template.key as keyof typeof sectorIcons] || Factory;
                    const isSelected = selectedSector === template.key;
                    
                    return (
                      <Card 
                        key={template.id}
                        className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                          isSelected 
                            ? 'ring-2 ring-blue-500 bg-blue-50' 
                            : 'hover:shadow-md'
                        }`}
                        onClick={() => setSelectedSector(template.key)}
                      >
                        <CardContent className="p-4">
                          <div className="flex flex-col items-center text-center space-y-3">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                              isSelected 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              <Icon className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{template.name}</h3>
                              <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                            </div>
                            <div className="text-xs text-gray-500">
                              {template.enabledModules.length} modules inclus
                            </div>
                            {isSelected ? (
                              <Button 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApplySectorTemplate(template.key);
                                }}
                                disabled={applySectorMutation.isPending}
                                className="w-full"
                              >
                                {applySectorMutation.isPending ? "Application..." : "Appliquer"}
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApplySectorTemplate(template.key);
                                }}
                                disabled={applySectorMutation.isPending}
                                className="w-full"
                              >
                                Sélectionner
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {selectedSector && (
                  <div className="mt-6">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>Template sélectionné</AlertTitle>
                      <AlertDescription>
                        Le template "{sectorTemplates.find(t => t.key === selectedSector)?.name}" configurera automatiquement {sectorTemplates.find(t => t.key === selectedSector)?.enabledModules.length} modules optimisés pour votre secteur.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Modules Tab */}
          <TabsContent value="modules" className="space-y-6">
            {moduleData && (
              <>
                {/* Core Modules */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      Modules Core GMAO
                    </CardTitle>
                    <CardDescription>
                      Modules essentiels pour la gestion de maintenance (toujours activés)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {getCategoryModules('GMAO').map((module) => {
                        const Icon = moduleIcons[module.key as keyof typeof moduleIcons] || Package;
                        const isEnabled = moduleConfig[module.key] || false;
                        
                        return (
                          <Card key={module.id} className="bg-gradient-to-br from-green-50 to-blue-50">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <Icon className="w-5 h-5 text-green-600" />
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900">{module.name}</h3>
                                    <p className="text-sm text-gray-600 mt-1">{module.description}</p>
                                    <Badge variant="outline" className="mt-2 text-xs">
                                      v{module.version}
                                    </Badge>
                                  </div>
                                </div>
                                <Switch
                                  checked={isEnabled}
                                  disabled={module.isCore}
                                  onCheckedChange={(checked) => handleModuleToggle(module.key, checked)}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* ERP Modules */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-blue-600" />
                      Modules ERP Étendus
                    </CardTitle>
                    <CardDescription>
                      Modules additionnels pour étendre les fonctionnalités selon vos besoins
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {getCategoryModules('ERP_PROCUREMENT').concat(
                        getCategoryModules('ANALYTICS'),
                        getCategoryModules('IOT_AUTOMATION')
                      ).map((module) => {
                        const Icon = moduleIcons[module.key as keyof typeof moduleIcons] || Package;
                        const isEnabled = moduleConfig[module.key] || false;
                        
                        return (
                          <Card key={module.id} className={isEnabled ? "bg-gradient-to-br from-blue-50 to-purple-50" : ""}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                    isEnabled ? 'bg-blue-100' : 'bg-gray-100'
                                  }`}>
                                    <Icon className={`w-5 h-5 ${isEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900">{module.name}</h3>
                                    <p className="text-sm text-gray-600 mt-1">{module.description}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <Badge variant="outline" className="text-xs">
                                        v{module.version}
                                      </Badge>
                                      <Badge variant="secondary" className="text-xs">
                                        {module.category}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => handleModuleToggle(module.key, checked)}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Configuration Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Résumé de Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Secteur d'activité</span>
                    <Badge variant={selectedSector ? "default" : "secondary"}>
                      {selectedSector ? sectorTemplates.find(t => t.key === selectedSector)?.name : "Non défini"}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Modules activés</span>
                    <span className="font-semibold">{getEnabledModulesCount()}/{getTotalModulesCount()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Modules Core</span>
                    <span className="font-semibold text-green-600">
                      {getCategoryModules('GMAO').filter(m => moduleConfig[m.key]).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Modules ERP</span>
                    <span className="font-semibold text-blue-600">
                      {getCategoryModules('ERP_PROCUREMENT').concat(
                        getCategoryModules('ANALYTICS'),
                        getCategoryModules('IOT_AUTOMATION')
                      ).filter(m => moduleConfig[m.key]).length}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Actions Rapides
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {hasUnsavedChanges && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Modifications non sauvegardées</AlertTitle>
                      <AlertDescription>
                        Vous avez des modifications en attente. N'oubliez pas de les sauvegarder.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Button 
                    onClick={handleSaveChanges}
                    disabled={!hasUnsavedChanges || updateModulesMutation.isPending}
                    className="w-full"
                  >
                    {updateModulesMutation.isPending ? "Sauvegarde..." : "Sauvegarder Configuration"}
                  </Button>
                  
                  <Button variant="outline" className="w-full">
                    Exporter Configuration
                  </Button>
                  
                  <Button variant="outline" className="w-full">
                    Restaurer Configuration
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}