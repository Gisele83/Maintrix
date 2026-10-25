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
import { useAuth } from "@/hooks/useAuth";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

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

  /**
   * ⚠️ CET ÉCRAN ÉTAIT ENTIÈREMENT BLANC, ET DEPUIS LONGTEMPS.
   *
   * L'identifiant d'organisation valait la chaîne littérale
   * `"default-tenant"`, laissée avec son commentaire « à adapter selon votre
   * système d'auth ». Mesuré le 19/10/2026 :
   * `/api/cctp/tenant/default-tenant/purchase-order-config` répond
   * **200 avec `{}`** — pas une erreur, un objet vide. Le composant lisait
   * alors `poConfig.companyHeader.name` sur un `companyHeader` absent, levait
   * une exception, et l'arbre React entier disparaissait : écran blanc, sans
   * message. Avec le véritable identifiant, la même route renvoie la
   * configuration complète.
   *
   * Conséquence plus grave que l'affichage : l'écran ÉCRIVAIT aussi sa
   * configuration sous cet identifiant fictif. Les seuils de bon de commande
   * et l'entête d'entreprise d'un client n'arrivaient donc jamais chez lui.
   *
   * On prend l'organisation réellement authentifiée. Les requêtes attendent
   * qu'elle soit connue — sans quoi on repartirait interroger une
   * organisation inexistante le temps du chargement du profil.
   */
  const { user } = useAuth();
  const tenantId = (user as { tenantId?: string } | undefined)?.tenantId;

  // =====================================================
  // QUERIES POUR RÉCUPÉRER LES CONFIGURATIONS
  // =====================================================

  const { data: purchaseOrderConfig, isLoading: loadingPOConfig } = useQuery({
    queryKey: ["/api/cctp/tenant", tenantId, "purchase-order-config"],
    queryFn: () => apiRequest(`/api/cctp/tenant/${tenantId}/purchase-order-config`),
    enabled: !!tenantId
  });

  const { data: reportingConfig, isLoading: loadingReportingConfig } = useQuery({
    queryKey: ["/api/cctp/tenant", tenantId, "reporting-config"],
    queryFn: () => apiRequest(`/api/cctp/tenant/${tenantId}/reporting-config`),
    enabled: !!tenantId
  });

  /**
   * ⚠️ `overallScore` et `score` sont NULLABLES, et c'est le point.
   *
   * Le serveur rendait un score global dilué par deux exigences notées 100 en
   * dur (`validationWorkflow`, `tenantIsolation`). Il ne note plus que ce
   * qu'il mesure, et marque les autres `non_mesure` / `score: null`. Le type
   * doit donc l'admettre, sinon l'écran affiche « null% » sur les exigences
   * que le serveur refuse désormais de noter.
   */
  const { data: compliance, isLoading: loadingCompliance } = useQuery<{
    overallScore: number | null;
    exigencesMesurees?: number;
    exigencesNonMesurees?: number;
    requirements: Record<string, {
      libelle?: string;
      status: string;
      score: number | null;
      details: string;
      verifiePar?: string;
    }>;
  }>({
    queryKey: ["/api/cctp/tenant", tenantId, "cctp-compliance"],
    queryFn: () => apiRequest(`/api/cctp/tenant/${tenantId}/cctp-compliance`),
    enabled: !!tenantId
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
    if (score >= 90) return "text-etat-nominal-texte";
    if (score >= 70) return "text-etat-alerte-texte";
    return "text-etat-critique-texte";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'compliant':
        return <Badge className="bg-etat-nominal-fond text-etat-nominal-texte">Conforme</Badge>;
      case 'partial':
        return <Badge className="bg-etat-alerte-fond text-etat-alerte-texte">Partiel</Badge>;
      case 'missing':
        return <Badge className="bg-etat-critique-fond text-etat-critique-texte">Manquant</Badge>;
      case 'non_mesure':
        // Une exigence que le relevé n'observe pas. Elle tombait jusqu'ici dans
        // le cas par défaut, et s'affichait « 🆕 Nouveau » — ce qui la faisait
        // passer pour une nouveauté plutôt que pour une absence de mesure.
        return <Badge className="bg-paper-deep text-ink-soft">Non mesuré ici</Badge>;
      default:
        return <Badge className="bg-etat-encours-fond text-etat-encours-texte">État inconnu</Badge>;
    }
  };

  if (loadingPOConfig || loadingReportingConfig || loadingCompliance) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-paper-deep rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-paper-deep rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <AppShell filAriane={[{ libelle: "Conformité" }, { libelle: "CCTP" }]} largeur="large">
    <div className="space-y-6">
      <EnTetePage
        surTitre="Conformité"
        titre="Conformité CCTP"
        phrase="Suivi des exigences du cahier des charges techniques particulières."
        action={
          <ActionPrincipale onClick={openComplianceReport}>
            <Download className="w-4 h-4" />
            Rapport PDF
          </ActionPrincipale>
        }
      />

      {/* ⚠️ « 8/9 exigences conformes » et « 1 configuration requise » étaient
          écrits en dur, à côté d'un score global, lui, bien calculé. Mesuré
          le 19/10/2026 sur ce locataire : l'API renvoie CINQ exigences, dont
          trois conformes et deux partielles. L'écran affichait donc neuf
          exigences là où il y en a cinq — sur un écran de conformité
          réglementaire, c'est-à-dire exactement là où un industriel vérifie
          ce qu'il peut opposer à un donneur d'ordre. On compte désormais ce
          que le serveur rapporte. */}
      {(() => {
        // Les exigences NON MESURÉES sortent des deux compteurs : elles ne
        // sont ni satisfaites ni « à configurer ». Les compter parmi les
        // secondes aurait donné au locataire une liste de tâches dont trois
        // ne lui appartiennent pas — le chiffrement du volume ou le
        // cloisonnement de la plateforme ne se règlent pas depuis cet écran.
        const toutes = Object.values(compliance?.requirements ?? {});
        const exigences = toutes.filter((e) => e.status !== 'non_mesure');
        const nonMesurees = toutes.length - exigences.length;
        const conformes = exigences.filter((e) => e.status === 'compliant').length;
        const aConfigurer = exigences.filter((e) => e.status !== 'compliant').length;
        return (
          <RangeeIndicateurs colonnes={3}>
            <Indicateur
              libelle="Score global"
              valeur={compliance?.overallScore != null ? `${compliance.overallScore} %` : '—'}
              precision={compliance?.overallScore != null
                ? `sur ${exigences.length} exigence(s) mesurée(s)`
                : 'aucune exigence mesurable'}
              icone={Shield}
            />
            <Indicateur
              libelle="Exigences conformes"
              valeur={exigences.length > 0 ? `${conformes}/${exigences.length}` : '—'}
              precision={nonMesurees > 0
                ? `${nonMesurees} exigence(s) non mesurée(s) ici, hors décompte`
                : exigences.length > 0 ? 'exigences du CCTP satisfaites' : 'aucune exigence évaluée'}
              icone={CheckCircle}
            />
            <Indicateur
              libelle="À configurer"
              valeur={exigences.length > 0 ? aConfigurer : '—'}
              precision={aConfigurer > 0 ? 'exigences partielles ou manquantes' : 'rien à configurer'}
              icone={AlertCircle}
              alerte={aConfigurer > 0}
            />
          </RangeeIndicateurs>
        );
      })()}

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
                          value={poConfig.companyHeader?.name ?? ""}
                          onChange={(e) => setPOConfig({
                            ...poConfig,
                            companyHeader: { ...(poConfig.companyHeader ?? {}), name: e.target.value } as PurchaseOrderConfig["companyHeader"]
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={poConfig.companyHeader?.email ?? ""}
                          onChange={(e) => setPOConfig({
                            ...poConfig,
                            companyHeader: { ...(poConfig.companyHeader ?? {}), email: e.target.value } as PurchaseOrderConfig["companyHeader"]
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Adresse</Label>
                        <Textarea
                          value={poConfig.companyHeader?.address ?? ""}
                          onChange={(e) => setPOConfig({
                            ...poConfig,
                            companyHeader: { ...(poConfig.companyHeader ?? {}), address: e.target.value } as PurchaseOrderConfig["companyHeader"]
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Téléphone</Label>
                        <Input
                          value={poConfig.companyHeader?.phone ?? ""}
                          onChange={(e) => setPOConfig({
                            ...poConfig,
                            companyHeader: { ...(poConfig.companyHeader ?? {}), phone: e.target.value } as PurchaseOrderConfig["companyHeader"]
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
                      <p className="text-sm text-ink-soft">
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
                        <p className="text-sm text-ink-soft">
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
                        <p className="text-sm text-ink-soft">
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
                        <p className="text-sm text-ink-soft">
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
                <div key={key} className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    {/* Le serveur fournit un libellé lisible ; le repli sur la
                        clé technique découpée reste utile si une exigence
                        nouvelle n'en porte pas encore. */}
                    <div className="font-medium">
                      {req.libelle ?? key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                    <div className="text-sm text-ink-soft">
                      {req.details}
                    </div>
                    {req.verifiePar && (
                      <div className="text-xs text-ink-soft">
                        Vérifié par : {req.verifiePar}
                      </div>
                    )}
                  </div>
                  <div className="text-right space-y-2 shrink-0">
                    {getStatusBadge(req.status)}
                    {/* Pas de « null% » : une exigence non notée n'affiche pas
                        de note. C'est la règle du dépôt — une donnée absente
                        s'affiche comme absente. */}
                    {req.score != null && (
                      <div className={`text-sm font-semibold ${getComplianceColor(req.score)}`}>
                        {req.score}%
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </AppShell>
  );
}