import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModernNavigation } from "@/components/modern-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Crown, Zap, Building2,
  Users, Shield, Wifi, BarChart3, HeadphonesIcon, Calendar, RefreshCw,
  Star, ArrowRight, Gift
} from "lucide-react";
import { Link } from "wouter";

interface LicenseStatus {
  status: "trial" | "active" | "grace" | "expired" | "suspended";
  plan: string;
  licenseType: string;
  licenseKey: string | null;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  trialEndDate: string | null;
  trialStartDate: string | null;
  isGracePeriodActive: boolean;
  gracePeriodDaysRemaining: number;
  gracePeriodEnd: string | null;
  gracePeriodDays: number;
  lastLicenseCheckAt: string | null;
  subscriptionId: string | null;
  currentUsers: number;
  maxUsers: number;
  licensedUsers: number;
  canOperate: boolean;
  warningMessage: string | null;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxUsers: number | null;
  features: string[];
  highlighted: boolean;
}

const PLAN_ICONS: Record<string, React.ComponentType<any>> = {
  pro: Zap,
  business: Building2,
  enterprise: Crown,
};

const STATUS_CONFIG = {
  trial: { label: "Essai gratuit", variant: "secondary" as const, icon: Gift, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950" },
  active: { label: "Abonnement actif", variant: "default" as const, icon: CheckCircle, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950" },
  grace: { label: "Période de grâce", variant: "outline" as const, icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950" },
  expired: { label: "Expiré", variant: "destructive" as const, icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950" },
  suspended: { label: "Suspendu", variant: "destructive" as const, icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950" },
};

function StatusCard({ license }: { license: LicenseStatus }) {
  const cfg = STATUS_CONFIG[license.status] || STATUS_CONFIG.trial;
  const StatusIcon = cfg.icon;
  const trialTotal = 30;
  const trialUsed = trialTotal - license.trialDaysRemaining;
  const trialProgress = Math.min(100, (trialUsed / trialTotal) * 100);

  return (
    <Card className={`border-2 ${license.status === "active" ? "border-green-200 dark:border-green-800" : license.status === "expired" || license.status === "suspended" ? "border-red-200 dark:border-red-800" : "border-blue-200 dark:border-blue-800"}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${cfg.bg}`}>
              <StatusIcon className={`h-5 w-5 ${cfg.color}`} />
            </div>
            <div>
              <CardTitle className="text-lg">État de votre licence</CardTitle>
              <CardDescription>Informations sur votre accès actuel</CardDescription>
            </div>
          </div>
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Trial info */}
        {license.isTrialActive && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progression de l'essai</span>
              <span className="font-medium">{license.trialDaysRemaining} jours restants sur {trialTotal}</span>
            </div>
            <Progress value={trialProgress} className="h-2.5" />
            {license.trialEndDate && (
              <p className="text-xs text-muted-foreground">
                Expire le {new Date(license.trialEndDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
        )}

        {/* Grace period info */}
        {license.isGracePeriodActive && (
          <div className="p-3 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Période de grâce active</span>
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              {license.gracePeriodDaysRemaining} jour(s) restant(s) avant interruption du service.
              {license.gracePeriodEnd && ` Fin le ${new Date(license.gracePeriodEnd).toLocaleDateString("fr-FR")}.`}
            </p>
          </div>
        )}

        {/* Expired warning */}
        {(license.status === "expired" || license.status === "suspended") && (
          <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Accès interrompu</span>
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              Votre période d'accès est terminée. Souscrivez à un plan pour rétablir l'accès.
            </p>
          </div>
        )}

        {/* Active subscription */}
        {license.status === "active" && (
          <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Abonnement actif — Plan {license.plan.toUpperCase()}</span>
            </div>
            {license.subscriptionId && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">ID : {license.subscriptionId}</p>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-bold">{license.currentUsers}</div>
            <div className="text-xs text-muted-foreground">Utilisateurs</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <Shield className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-bold">{license.maxUsers > 10000 ? "∞" : license.maxUsers}</div>
            <div className="text-xs text-muted-foreground">Max autorisés</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-bold">
              {license.lastLicenseCheckAt
                ? new Date(license.lastLicenseCheckAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
                : "—"}
            </div>
            <div className="text-xs text-muted-foreground">Dernière vérif.</div>
          </div>
        </div>

        {/* Offline cache indicator */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
          <span className="flex items-center gap-1.5">
            <Wifi className="h-3.5 w-3.5" />
            Cache local : {license.gracePeriodDays} jours de grâce offline
          </span>
          {license.lastLicenseCheckAt && (
            <span>Validée le {new Date(license.lastLicenseCheckAt).toLocaleString("fr-FR")}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PlanCard({ plan, current, onSelect }: { plan: Plan; current: boolean; onSelect: (planId: string) => void }) {
  const Icon = PLAN_ICONS[plan.id] || Zap;

  return (
    <Card className={`relative flex flex-col transition-all duration-200 hover:shadow-lg ${
      plan.highlighted
        ? "border-2 border-blue-500 dark:border-blue-400 shadow-blue-100 dark:shadow-blue-900/30 shadow-md"
        : "border hover:border-blue-300 dark:hover:border-blue-700"
    } ${current ? "ring-2 ring-green-400 dark:ring-green-600" : ""}`}>
      {plan.highlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <Badge className="bg-blue-600 text-white shadow-sm px-3">
            <Star className="h-3 w-3 mr-1" /> Recommandé
          </Badge>
        </div>
      )}
      {current && (
        <div className="absolute -top-3.5 right-4">
          <Badge variant="outline" className="bg-green-50 dark:bg-green-950 border-green-400 text-green-700 dark:text-green-400 text-xs px-2">
            Plan actuel
          </Badge>
        </div>
      )}
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-2 rounded-lg ${plan.highlighted ? "bg-blue-100 dark:bg-blue-900" : "bg-muted"}`}>
            <Icon className={`h-5 w-5 ${plan.highlighted ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`} />
          </div>
          <CardTitle className="text-xl">{plan.name}</CardTitle>
        </div>
        <CardDescription className="text-sm">{plan.description}</CardDescription>
        <div className="mt-3">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">{plan.monthlyPrice} €</span>
            <span className="text-muted-foreground text-sm">/mois</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ou {plan.yearlyPrice} €/an (économisez {Math.round(100 - (plan.yearlyPrice / (plan.monthlyPrice * 12)) * 100)}%)
          </p>
          <p className="text-xs text-muted-foreground">
            {plan.maxUsers ? `Jusqu'à ${plan.maxUsers} utilisateurs` : "Utilisateurs illimités"}
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <ul className="space-y-2 flex-1">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5">
          <Button
            className={`w-full ${plan.highlighted ? "bg-blue-600 hover:bg-blue-700" : ""}`}
            variant={plan.highlighted ? "default" : "outline"}
            disabled={current}
            onClick={() => onSelect(plan.id)}
          >
            {current ? "Plan actuel" : (
              <>
                Choisir {plan.name}
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SubscriptionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: licenseStatus, isLoading: licenseLoading } = useQuery<LicenseStatus>({
    queryKey: ["/api/license/status"],
    refetchInterval: 60 * 1000,
  });

  const { data: plansData, isLoading: plansLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ["/api/license/plans"],
  });

  const startTrialMutation = useMutation({
    mutationFn: () => apiRequest("/api/trial/start", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/license/status"] });
      toast({ title: "Essai démarré", description: "Votre période d'essai gratuite de 30 jours a commencé !" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de démarrer l'essai.", variant: "destructive" }),
  });

  const validateMutation = useMutation({
    mutationFn: () => apiRequest("/api/license/validate", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/license/status"] });
      toast({ title: "Licence validée", description: "Le cache local a été mis à jour." });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de valider la licence.", variant: "destructive" }),
  });

  const handleSelectPlan = (planId: string) => {
    // Navigate to payment — for now, open Stripe checkout via payment-test page
    toast({
      title: `Plan ${planId.charAt(0).toUpperCase() + planId.slice(1)} sélectionné`,
      description: "Redirection vers la page de paiement sécurisé...",
    });
    setTimeout(() => window.location.href = "/payment-test", 1500);
  };

  const plans = plansData?.plans || [];
  const currentPlan = licenseStatus?.plan;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <ModernNavigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Page header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm font-medium mb-4">
            <Crown className="h-4 w-4" />
            Abonnements & Licences
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent mb-3">
            Gérez votre abonnement
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Choisissez le plan adapté à votre équipe. Essai gratuit 30 jours — sans engagement, sans carte bancaire.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left: Status + Actions */}
          <div className="xl:col-span-1 space-y-5">
            {/* Current license status */}
            {licenseLoading ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Chargement...</CardContent></Card>
            ) : licenseStatus ? (
              <StatusCard license={licenseStatus} />
            ) : null}

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {licenseStatus && !licenseStatus.isTrialActive && licenseStatus.status !== "active" && (
                  <Button
                    className="w-full"
                    onClick={() => startTrialMutation.mutate()}
                    disabled={startTrialMutation.isPending}
                  >
                    <Gift className="h-4 w-4 mr-2" />
                    {startTrialMutation.isPending ? "Démarrage..." : "Démarrer l'essai gratuit 30j"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => validateMutation.mutate()}
                  disabled={validateMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${validateMutation.isPending ? "animate-spin" : ""}`} />
                  Valider la licence (cache offline)
                </Button>
                <Link href="/dashboard">
                  <Button variant="ghost" className="w-full">
                    Retour au tableau de bord
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* License key */}
            {licenseStatus?.licenseKey && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Clé de licence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-sm bg-muted px-3 py-2 rounded-lg break-all select-all">
                    {licenseStatus.licenseKey}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Cette clé est utilisée pour l'authentification offline.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Offline grace period info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  Mode hors-ligne
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Maintrix fonctionne sans connexion grâce à un cache local de licence. En cas de perte de connectivité, votre accès est maintenu pendant :
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-2 bg-blue-500 rounded-full" style={{ width: "70%" }} />
                  </div>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {licenseStatus?.gracePeriodDays ?? 7} jours
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  La durée de grâce est réinitialisée à chaque validation en ligne.
                  Utilisez "Valider la licence" pour recharger le cache.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right: Plans */}
          <div className="xl:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Choisissez votre plan</h2>
              <Badge variant="outline" className="text-xs">Prix HT · Facturation mensuelle</Badge>
            </div>

            {plansLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="py-16 text-center text-muted-foreground">Chargement...</CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
                {plans.map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    current={currentPlan === plan.id && licenseStatus?.status === "active"}
                    onSelect={handleSelectPlan}
                  />
                ))}
              </div>
            )}

            {/* Trial offer callout */}
            {licenseStatus && licenseStatus.status !== "active" && (
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl text-white flex items-center gap-4">
                <div className="p-2.5 bg-white/20 rounded-lg flex-shrink-0">
                  <Gift className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">Essai gratuit 30 jours</p>
                  <p className="text-sm text-blue-100">Toutes les fonctionnalités Business débloquées, sans carte bancaire.</p>
                </div>
                {!licenseStatus.isTrialActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/50 bg-white/20 hover:bg-white/30 text-white hover:text-white flex-shrink-0"
                    onClick={() => startTrialMutation.mutate()}
                    disabled={startTrialMutation.isPending}
                  >
                    Commencer
                  </Button>
                )}
              </div>
            )}

            <Separator className="my-8" />

            {/* Feature comparison table */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Comparaison détaillée</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Fonctionnalité</th>
                      <th className="text-center py-3 px-3 font-medium">Pro</th>
                      <th className="text-center py-3 px-3 font-medium text-blue-600 dark:text-blue-400">Business</th>
                      <th className="text-center py-3 pl-3 font-medium">Entreprise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      ["Smart Diagnostic IA", true, true, true],
                      ["GMAO complète", true, true, true],
                      ["Export PDF/CSV", true, true, true],
                      ["Intégration IoT / MQTT", false, true, true],
                      ["API ERP (SAP, Maximo)", false, true, true],
                      ["Multi-sites", false, true, true],
                      ["IA prédictive avancée", false, true, true],
                      ["SLA garantie 99.9%", false, false, true],
                      ["Support dédié 24/7", false, false, true],
                      ["White-labeling", false, false, true],
                      ["Utilisateurs illimités", false, false, true],
                    ].map(([feature, pro, biz, ent], i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="py-2.5 pr-4">{feature as string}</td>
                        <td className="text-center py-2.5 px-3">
                          {pro ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="text-center py-2.5 px-3">
                          {biz ? <CheckCircle className="h-4 w-4 text-blue-500 mx-auto" /> : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="text-center py-2.5 pl-3">
                          {ent ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground/40">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* FAQ */}
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-semibold">Questions fréquentes</h3>
              {[
                {
                  q: "Que se passe-t-il à la fin de l'essai ?",
                  a: "Votre compte entre en période de grâce de 7 jours. Vous pouvez continuer à utiliser Maintrix hors-ligne via le cache local de licence pendant cette période."
                },
                {
                  q: "Puis-je utiliser Maintrix sans connexion internet ?",
                  a: "Oui. Maintrix conserve un cache local de licence valide pendant 7 jours après la dernière validation en ligne. Utilisez le bouton 'Valider la licence' régulièrement pour recharger ce cache."
                },
                {
                  q: "Comment changer de plan ?",
                  a: "Vous pouvez passer à un plan supérieur à tout moment. La différence de prix est calculée au prorata."
                },
              ].map((item, i) => (
                <div key={i} className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-sm mb-1">{item.q}</p>
                  <p className="text-sm text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
