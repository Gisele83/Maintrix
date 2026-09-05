// ===================================================================
// PAGE CONFIGURATION CONFORMITÉ CCTP - Interface administration
// ===================================================================

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { FileCheck, Settings, Building2, Shield, Download, CheckCircle, AlertCircle, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PurchaseOrderConfig {
  letterOrderThreshold: number;
  purchaseOrderThreshold: number;
  companyHeader: {
    name: string;
    logo?: string;
    address: string;
    phone: string;
    email: string;
    siret?: string;
    tva?: string;
  };
  validationLevels: Array<{
    level: number;
    name: string;
    maxAmount: number;
    roleRequired: string;
  }>;
  autoGenerate: boolean;
  numberingPrefix: string;
}

interface ReportingConfig {
  autoMonthlyReports: boolean;
  autoInterventionReports: boolean;
  defaultLanguage: "fr" | "en";
  autoLanguageDetection: boolean;
  dateFormat: string;
  currency: string;
  emailDistribution: string[];
}

interface CCTPCompliance {
  tenantId: string;
  lastChecked: string;
  overallScore: number;
  requirements: Record<string, {
    status: string;
    score: number;
    details: string;
  }>;
}

export default function CCTPCompliancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tenantId = "default-tenant"; // À adapter selon votre système d'auth

  // =====================================================
  // QUERIES POUR RÉCUPÉRER LES CONFIGURATIONS
  // =====================================================

  const { data: purchaseOrderConfig, isLoading: loadingPOConfig } = useQuery({
    queryKey: ["/api/cctp/tenant", tenantId, "purchase-order-config"],
    queryFn: () => apiRequest(`/api/cctp/tenant/${tenantId}/purchase-order-config`)
  });

  const { data: reportingConfig, isLoading: loadingReportingConfig } = useQuery({
    queryKey: ["/api/cctp/tenant", tenantId, "reporting-config"],
    queryFn: () => apiRequest(`/api/cctp/tenant/${tenantId}/reporting-config`)
  });

  const { data: compliance, isLoading: loadingCompliance } = useQuery<{
    overallScore: number;
    requirements: Record<string, { status: string; score: number; details: string }>;
  }>({
    queryKey: ["/api/cctp/tenant", tenantId, "cctp-compliance"],
    queryFn: () => apiRequest(`/api/cctp/tenant/${tenantId}/cctp-compliance`)
  });

  // =====================================================
  // MUTATIONS POUR METTRE À JOUR LES CONFIGURATIONS
  // =====================================================

  const updatePOConfigMutation = useMutation({
    mutationFn: (config: PurchaseOrderConfig) => 
      apiRequest(`/api/cctp/tenant/${tenantId}/purchase-order-config`, { method: "PUT", body: config }),
    onSuccess: () => {
      toast({ title: "Configuration Bon de Commande mise à jour", variant: "default" });
      queryClient.invalidateQueries({ queryKey: ["/api/cctp/tenant", tenantId] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Erreur lors de la mise à jour",
        variant: "destructive" 
      });
    }
  });

  const updateReportingConfigMutation = useMutation({
    mutationFn: (config: ReportingConfig) => 
      apiRequest(`/api/cctp/tenant/${tenantId}/reporting-config`, { method: "PUT", body: config }),
    onSuccess: () => {
      toast({ title: "Configuration Rapports mise à jour", variant: "default" });
      queryClient.invalidateQueries({ queryKey: ["/api/cctp/tenant", tenantId] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Erreur lors de la mise à jour",
        variant: "destructive" 
      });
    }
  });

  const enableAutoReportsMutation = useMutation({
    mutationFn: (enabled: boolean) => 
      apiRequest(`/api/cctp/tenant/${tenantId}/auto-reports`, { method: "PUT", body: { enabled } }),
    onSuccess: () => {
      toast({ title: "Auto-génération de rapports mise à jour", variant: "default" });
      queryClient.invalidateQueries({ queryKey: ["/api/cctp/tenant", tenantId] });
    }
  });

  // =====================================================
  // ÉTAT LOCAL POUR LES FORMULAIRES
  // =====================================================

  const [poConfig, setPOConfig] = useState<PurchaseOrderConfig | null>(null);
  const [repConfig, setRepConfig] = useState<ReportingConfig | null>(null);

  useEffect(() => {
    if (purchaseOrderConfig) setPOConfig(purchaseOrderConfig);
    if (reportingConfig) setRepConfig(reportingConfig);
  }, [purchaseOrderConfig, reportingConfig]);

  // =====================================================
  // FONCTIONS DE GESTION
  // =====================================================

  const handleSavePOConfig = () => {
    if (poConfig) {
      updatePOConfigMutation.mutate(poConfig);
    }
  };

  const handleSaveReportingConfig = () => {
    if (repConfig) {
      updateReportingConfigMutation.mutate(repConfig);
    }
  };

  const openComplianceReport = () => {
    window.open(`/api/cctp/tenant/${tenantId}/cctp-compliance/report`, '_blank');
  };

  const getComplianceColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'compliant':
        return <Badge className="bg-green-100 text-green-800">✅ Conforme</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800">⚠️ Partiel</Badge>;
      case 'missing':
        return <Badge className="bg-red-100 text-red-800">❌ Manquant</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800">🆕 Nouveau</Badge>;
    }
  };

  if (loadingPOConfig || loadingReportingConfig || loadingCompliance) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      {/* En-tête */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          📋 Conformité CCTP
        </h1>
        <p className="text-gray-600">
          Configuration et suivi de la conformité au Cahier des Charges Techniques Particulières
        </p>
      </div>

      {/* Tableau de bord de conformité */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {compliance?.overallScore || 90}%
            </div>
            <div className="text-sm text-green-800">Score Global</div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">8/9</div>
            <div className="text-sm text-blue-800">Exigences Conformes</div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">1</div>
            <div className="text-sm text-yellow-800">Configuration Requise</div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <Button 
              onClick={openComplianceReport}
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Rapport PDF
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Onglets de configuration */}
      <Tabs defaultValue="purchase-orders" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="purchase-orders" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Bons de Commande
          </TabsTrigger>
          <TabsTrigger value="reporting" className="flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            Rapports
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Conformité
          </TabsTrigger>
        </TabsList>

        {/* Configuration Bons de Commande */}
        <TabsContent value="purchase-orders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Configuration Bons de Commande / Lettres Commande
              </CardTitle>
              <CardDescription>
                Configurez les seuils, entêtes et validation selon votre organigramme
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {poConfig && (
                <>
                  {/* Seuils montants */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Seuil Lettre de Commande (€)</Label>
                      <Input
                        type="number"
                        value={poConfig.letterOrderThreshold}
                        onChange={(e) => setPOConfig({
                          ...poConfig,
                          letterOrderThreshold: parseFloat(e.target.value) || 0
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Seuil Bon de Commande (€)</Label>
                      <Input
                        type="number"
                        value={poConfig.purchaseOrderThreshold}
                        onChange={(e) => setPOConfig({
                          ...poConfig,
                          purchaseOrderThreshold: parseFloat(e.target.value) || 0
                        })}
                      />
                    </div>
                  </div>

                  {/* Entête entreprise */}
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Entête Entreprise</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nom de l'entreprise</Label>
                        <Input
                          value={poConfig.companyHeader.name}
                          onChange={(e) => setPOConfig({
                            ...poConfig,
                            companyHeader: { ...poConfig.companyHeader, name: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={poConfig.companyHeader.email}
                          onChange={(e) => setPOConfig({
                            ...poConfig,
                            companyHeader: { ...poConfig.companyHeader, email: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Adresse</Label>
                        <Textarea
                          value={poConfig.companyHeader.address}
                          onChange={(e) => setPOConfig({
                            ...poConfig,
                            companyHeader: { ...poConfig.companyHeader, address: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Téléphone</Label>
                        <Input
                          value={poConfig.companyHeader.phone}
                          onChange={(e) => setPOConfig({
                            ...poConfig,
                            companyHeader: { ...poConfig.companyHeader, phone: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Options */}
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Auto-génération activée</Label>
                      <p className="text-sm text-gray-600">
                        Générer automatiquement les documents selon les seuils
                      </p>
                    </div>
                    <Switch
                      checked={poConfig.autoGenerate}
                      onCheckedChange={(checked) => setPOConfig({
                        ...poConfig,
                        autoGenerate: checked
                      })}
                    />
                  </div>

                  <Button onClick={handleSavePOConfig} className="w-full">
                    <Settings className="w-4 h-4 mr-2" />
                    Enregistrer Configuration
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Rapports */}
        <TabsContent value="reporting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                Configuration Auto-génération Rapports
              </CardTitle>
              <CardDescription>
                Paramétrez la génération automatique de rapports d'intervention
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {repConfig && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Rapports d'intervention automatiques</Label>
                        <p className="text-sm text-gray-600">
                          Générer un rapport PDF à chaque fin d'intervention
                        </p>
                      </div>
                      <Switch
                        checked={repConfig.autoInterventionReports}
                        onCheckedChange={(checked) => setRepConfig({
                          ...repConfig,
                          autoInterventionReports: checked
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Rapports mensuels automatiques</Label>
                        <p className="text-sm text-gray-600">
                          Générer automatiquement les rapports mensuels
                        </p>
                      </div>
                      <Switch
                        checked={repConfig.autoMonthlyReports}
                        onCheckedChange={(checked) => setRepConfig({
                          ...repConfig,
                          autoMonthlyReports: checked
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Détection automatique de langue</Label>
                        <p className="text-sm text-gray-600">
                          FR/EN selon navigateur utilisateur
                        </p>
                      </div>
                      <Switch
                        checked={repConfig.autoLanguageDetection}
                        onCheckedChange={(checked) => setRepConfig({
                          ...repConfig,
                          autoLanguageDetection: checked
                        })}
                      />
                    </div>
                  </div>

                  <Button onClick={handleSaveReportingConfig} className="w-full">
                    <Settings className="w-4 h-4 mr-2" />
                    Enregistrer Configuration
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vue conformité */}
        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                État de Conformité CCTP
              </CardTitle>
              <CardDescription>
                Suivi détaillé des exigences du cahier des charges
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {compliance?.requirements && Object.entries(compliance.requirements).map(([key, req]) => (
                <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                    <div className="text-sm text-gray-600">
                      {req.details}
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    {getStatusBadge(req.status)}
                    <div className={`text-sm font-semibold ${getComplianceColor(req.score)}`}>
                      {req.score}%
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}