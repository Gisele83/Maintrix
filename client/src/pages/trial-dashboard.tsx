import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/header";
import { 
  Gift, 
  Clock, 
  Zap, 
  Crown, 
  CheckCircle, 
  AlertCircle, 
  BarChart3,
  Users,
  Settings,
  Wifi,
  Database,
  TrendingUp,
  Calendar,
  Activity
} from "lucide-react";
import { Link } from "wouter";

export default function TrialDashboard() {
  // Mock trial data - in real implementation this would come from API
  const trialData = {
    planType: "business" as const,
    daysRemaining: 12,
    totalDays: 14,
    isActive: true,
    diagnosticsUsed: 47,
    diagnosticsLimit: 500,
    workOrdersCreated: 8,
    equipmentMonitored: 5,
    featuresUsed: [
      "Smart Diagnostic",
      "Smart GMAO", 
      "IA Avancée",
      "Export données",
      "Intégration IoT"
    ],
    recommendations: [
      "Forte utilisation des diagnostics IA - Plan Business recommandé",
      "Intégration IoT utilisée - Fonctionnalité Business détectée", 
      "Export de données fréquent - Optimisez avec un abonnement"
    ]
  };

  const usagePercentage = (trialData.diagnosticsUsed / trialData.diagnosticsLimit) * 100;
  const trialProgress = ((trialData.totalDays - trialData.daysRemaining) / trialData.totalDays) * 100;

  const planFeatures = {
    pro: [
      { name: "Smart Diagnostic IA", included: true },
      { name: "Multi-équipements", included: true },
      { name: "Export CSV", included: true },
      { name: "Support prioritaire", included: true },
      { name: "Planification préventive", included: false },
      { name: "IoT / capteurs", included: false }
    ],
    business: [
      { name: "Planification préventive", included: true },
      { name: "Suivi pièces détachées", included: true },
      { name: "IoT / capteurs", included: true },
      { name: "API ERP", included: true },
      { name: "Dashboard personnalisé", included: true },
      { name: "Formation équipe", included: true }
    ],
    enterprise: [
      { name: "IA prédictive RUL", included: true },
      { name: "Dashboard personnalisé", included: true },
      { name: "SLA premium", included: true },
      { name: "Services Data IA", included: true },
      { name: "Support 24/7", included: true },
      { name: "Intégrations sur mesure", included: true }
    ]
  };

  const planIcons = {
    pro: Zap,
    business: Settings, 
    enterprise: Crown
  };

  const PlanIcon = planIcons[trialData.planType];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Gift className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                Tableau de bord d'essai gratuit
              </h1>
              <p className="text-muted-foreground">
                Suivi de votre période d'essai Smart GMAO DiagFix
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Statut de l'essai */}
          <div className="lg:col-span-2 space-y-6">
            {/* Carte de statut principal */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PlanIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                    <div>
                      <CardTitle className="text-xl">
                        Essai Plan {trialData.planType.toUpperCase()}
                      </CardTitle>
                      <CardDescription>
                        {trialData.daysRemaining} jours restants sur 14 jours
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Actif
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Progression temporelle */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progression de l'essai</span>
                    <span>{Math.round(trialProgress)}% complété</span>
                  </div>
                  <Progress value={trialProgress} className="h-3" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {trialData.daysRemaining} jours pour explorer toutes les fonctionnalités
                  </p>
                </div>

                {/* Statistiques d'utilisation */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <BarChart3 className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                    <div className="text-lg font-bold">{trialData.diagnosticsUsed}</div>
                    <div className="text-xs text-muted-foreground">Diagnostics</div>
                  </div>
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <Activity className="h-5 w-5 mx-auto mb-1 text-purple-600" />
                    <div className="text-lg font-bold">{trialData.workOrdersCreated}</div>
                    <div className="text-xs text-muted-foreground">OT créés</div>
                  </div>
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <Wifi className="h-5 w-5 mx-auto mb-1 text-green-600" />
                    <div className="text-lg font-bold">{trialData.equipmentMonitored}</div>
                    <div className="text-xs text-muted-foreground">Équipements</div>
                  </div>
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <TrendingUp className="h-5 w-5 mx-auto mb-1 text-orange-600" />
                    <div className="text-lg font-bold">{trialData.featuresUsed.length}</div>
                    <div className="text-xs text-muted-foreground">Fonctionnalités</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Utilisation des diagnostics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Utilisation des diagnostics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Diagnostics utilisés</span>
                    <span className="font-medium">
                      {trialData.diagnosticsUsed} / {trialData.diagnosticsLimit}
                    </span>
                  </div>
                  <Progress value={usagePercentage} className="h-2" />
                  {usagePercentage > 80 ? (
                    <div className="flex items-center gap-2 text-orange-600 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      Utilisation élevée - Pensez à vous abonner
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Excellent ! Vous explorez bien la plateforme
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Fonctionnalités utilisées */}
            <Card>
              <CardHeader>
                <CardTitle>Fonctionnalités explorées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {trialData.featuresUsed.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions rapides */}
            <Card>
              <CardHeader>
                <CardTitle>Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" disabled>
                  Fonctionnalité désactivée
                </Button>
                <Link href="/dashboard">
                  <Button variant="outline" className="w-full">
                    Continuer l'essai
                  </Button>
                </Link>
                <Link href="/documentation">
                  <Button variant="ghost" className="w-full">
                    Documentation
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Fonctionnalités du plan */}
            <Card>
              <CardHeader>
                <CardTitle>Plan {trialData.planType.toUpperCase()}</CardTitle>
                <CardDescription>Fonctionnalités incluses dans votre essai</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {planFeatures[trialData.planType].map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{feature.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recommandations */}
            <Card>
              <CardHeader>
                <CardTitle>Recommandations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {trialData.recommendations.map((rec, index) => (
                  <div key={index} className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">{rec}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}