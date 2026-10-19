import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ModernNavigation } from "@/components/modern-navigation";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Gift, Clock, Zap, Crown, CheckCircle, AlertCircle, BarChart3,
  Users, Settings, Wifi, Database, TrendingUp, Calendar, Activity,
  RefreshCw, ArrowRight, Shield
} from "lucide-react";
import { Link } from "wouter";
import { ETAT } from "@/lib/etats";

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

const TRIAL_TOTAL_DAYS = 30;

const planFeatures: Record<string, Array<{ name: string; included: boolean }>> = {
  pro: [
    { name: "Smart Diagnostic IA", included: true },
    { name: "Multi-équipements", included: true },
    { name: "Export CSV/PDF", included: true },
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

export default function TrialDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: license, isLoading } = useQuery<LicenseStatus>({
    queryKey: ["/api/license/status"],
    refetchInterval: 60 * 1000,
  });

  const startTrialMutation = useMutation({
    mutationFn: () => apiRequest("/api/trial/start", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/license/status"] });
      toast({ title: "Essai démarré !", description: "Votre période d'essai gratuite de 30 jours a commencé." });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de démarrer l'essai.", variant: "destructive" }),
  });

  const validateMutation = useMutation({
    mutationFn: () => apiRequest("/api/license/validate", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/license/status"] });
      toast({ title: "Cache mis à jour", description: "La licence a été validée en ligne. Cache offline rechargé." });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de valider.", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper-deep">
        <ModernNavigation />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-etat-encours-filet border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Chargement du statut de licence...</p>
          </div>
        </div>
      </div>
    );
  }

  const plan = license?.plan || "pro";
  const features = planFeatures[plan] || planFeatures.pro;
  const trialDaysRemaining = license?.trialDaysRemaining ?? 0;
  const trialUsed = TRIAL_TOTAL_DAYS - trialDaysRemaining;
  const trialProgress = Math.min(100, Math.max(0, (trialUsed / TRIAL_TOTAL_DAYS) * 100));
  const isTrialActive = license?.isTrialActive ?? false;

  const StatusIcon = license?.status === "active" ? CheckCircle
    : license?.status === "expired" ? AlertCircle
    : license?.status === "grace" ? AlertCircle
    : Gift;

  const statusColor = license?.status === "active" ? "text-etat-nominal-texte"
    : license?.status === "expired" || license?.status === "suspended" ? "text-etat-critique-texte"
    : license?.status === "grace" ? "text-etat-alerte-texte"
    : "text-etat-encours-texte";

  /**
   * ⚠️ Ce fond était à l'origine une paire de fragments de dégradé —
   * `from-green-50 to-emerald-50` — sans le `bg-gradient-to-*` qui les
   * aurait activés : aucun fond n'était donc posé, quel que soit le statut
   * de la licence. La passe d'harmonisation a retiré les fragments morts
   * mais a laissé les préfixes `dark:` orphelins, si bien que la chaîne
   * valait littéralement « dark: dark: ». Deux défauts successifs au même
   * endroit, et aucun des deux ne lève d'erreur : une classe absente laisse
   * simplement hériter du fond parent.
   */
  const statusBg = license?.status === "active" ? ETAT.nominal.fond
    : license?.status === "expired" || license?.status === "suspended" ? ETAT.critique.fond
    : license?.status === "grace" ? ETAT.alerte.fond
    : ETAT.encours.fond;

  return (
    <div className="min-h-screen bg-paper-deep">
      <ModernNavigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-etat-encours-fond rounded-lg">
              <Gift className="h-6 w-6 text-etat-encours-texte" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-ink">
                Tableau de bord — Période d'essai
              </h1>
              <p className="text-muted-foreground">
                Suivi de votre licence et de votre accès Maintrix
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status card */}
            <Card className={`border-0 bg-paper-deep ${statusBg}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-8 w-8 ${statusColor}`} />
                    <div>
                      <CardTitle className="text-xl">
                        {license?.status === "active" ? `Abonnement actif — ${plan.toUpperCase()}`
                          : license?.status === "grace" ? "Période de grâce"
                          : license?.status === "expired" ? "Accès expiré"
                          : `Essai gratuit — Plan ${plan.toUpperCase()}`}
                      </CardTitle>
                      <CardDescription>
                        {isTrialActive
                          ? `${trialDaysRemaining} jour(s) restant(s) sur ${TRIAL_TOTAL_DAYS}`
                          : license?.status === "grace"
                          ? `Période de grâce : ${license.gracePeriodDaysRemaining} jour(s) restant(s)`
                          : license?.status === "active"
                          ? "Accès complet à toutes les fonctionnalités"
                          : "Votre période d'accès est terminée"}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={license?.status === "active" ? "default"
                      : license?.status === "expired" || license?.status === "suspended" ? "destructive"
                      : "secondary"}
                  >
                    {license?.status === "active" ? "Actif"
                      : license?.status === "grace" ? "Grâce"
                      : license?.status === "expired" ? "Expiré"
                      : "Essai"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Trial progress bar */}
                {isTrialActive && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progression de l'essai</span>
                      <span>{Math.round(trialProgress)}% utilisé</span>
                    </div>
                    <Progress value={trialProgress} className="h-3" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>
                        Début : {license?.trialStartDate
                          ? new Date(license.trialStartDate).toLocaleDateString("fr-FR")
                          : "—"}
                      </span>
                      <span>
                        Fin : {license?.trialEndDate
                          ? new Date(license.trialEndDate).toLocaleDateString("fr-FR")
                          : "—"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Grace period bar */}
                {license?.isGracePeriodActive && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-etat-alerte-texte font-medium">Période de grâce</span>
                      <span className="text-etat-alerte-texte">{license.gracePeriodDaysRemaining} / {license.gracePeriodDays} jours</span>
                    </div>
                    <Progress
                      value={((license.gracePeriodDays - license.gracePeriodDaysRemaining) / license.gracePeriodDays) * 100}
                      className="h-3"
                    />
                  </div>
                )}

                {/* Warning message */}
                {license?.warningMessage && (
                  <div className="flex items-center gap-2 p-3 bg-etat-alerte-fond border border-etat-alerte-filet rounded-lg text-sm text-etat-alerte-texte">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{license.warningMessage.replace(/^[]\s*/, "")}</span>
                  </div>
                )}

                {/* Stat boxes */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-white rounded-lg">
                    <Users className="h-5 w-5 mx-auto mb-1 text-etat-encours-texte" />
                    <div className="text-lg font-bold">{license?.currentUsers ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Utilisateurs</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <Shield className="h-5 w-5 mx-auto mb-1 text-signal-deep" />
                    <div className="text-lg font-bold">{license?.maxUsers && license.maxUsers > 10000 ? "∞" : (license?.maxUsers ?? "—")}</div>
                    <div className="text-xs text-muted-foreground">Max autorisés</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <Wifi className="h-5 w-5 mx-auto mb-1 text-etat-nominal-texte" />
                    <div className="text-lg font-bold">{license?.gracePeriodDays ?? 7}j</div>
                    <div className="text-xs text-muted-foreground">Grâce offline</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <Calendar className="h-5 w-5 mx-auto mb-1 text-etat-alerte-texte" />
                    <div className="text-lg font-bold">
                      {license?.lastLicenseCheckAt
                        ? new Date(license.lastLicenseCheckAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
                        : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">Dernière vérif.</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Offline cache */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-5 w-5" />
                  Cache de licence hors-ligne
                </CardTitle>
                <CardDescription>
                  Maintrix peut fonctionner sans internet pendant {license?.gracePeriodDays ?? 7} jours après la dernière validation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Dernière validation en ligne</p>
                    <p className="text-xs text-muted-foreground">
                      {license?.lastLicenseCheckAt
                        ? new Date(license.lastLicenseCheckAt).toLocaleString("fr-FR")
                        : "Jamais validée"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => validateMutation.mutate()}
                    disabled={validateMutation.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${validateMutation.isPending ? "animate-spin" : ""}`} />
                    Valider maintenant
                  </Button>
                </div>
                {license?.gracePeriodEnd && (
                  <p className="text-xs text-muted-foreground">
                    Cache valide jusqu'au : {new Date(license.gracePeriodEnd).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* License key */}
            {license?.licenseKey && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Database className="h-4 w-4" />
                    Clé de licence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-sm bg-muted px-3 py-2 rounded-lg select-all break-all">
                    {license.licenseKey}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Conservez cette clé pour les déploiements locaux ou hors-ligne.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/subscription">
                  <Button className="w-full">
                    <Crown className="h-4 w-4 mr-2" />
                    Voir les plans & tarifs
                  </Button>
                </Link>
                {!isTrialActive && license?.status !== "active" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => startTrialMutation.mutate()}
                    disabled={startTrialMutation.isPending}
                  >
                    <Gift className="h-4 w-4 mr-2" />
                    {startTrialMutation.isPending ? "Démarrage..." : "Démarrer l'essai 30 jours"}
                  </Button>
                )}
                <Link href="/dashboard">
                  <Button variant="outline" className="w-full">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Continuer l'utilisation
                  </Button>
                </Link>
                <Link href="/documentation">
                  <Button variant="ghost" className="w-full">
                    Documentation
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Plan features */}
            <Card>
              <CardHeader>
                <CardTitle>Plan {plan.toUpperCase()}</CardTitle>
                <CardDescription>Fonctionnalités incluses dans votre accès</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {feature.included ? (
                        <CheckCircle className="h-4 w-4 text-etat-nominal-texte flex-shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                      )}
                      <span className={`text-sm ${!feature.included ? "text-muted-foreground" : ""}`}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Upgrade CTA */}
            {license?.status !== "active" && (
              <Card className="bg-ink border-0 text-paper">
                <CardHeader className="pb-3">
                  <CardTitle className="text-paper">Passez à un plan complet</CardTitle>
                  <CardDescription className="text-paper/80">
                    Accès illimité à toutes les fonctionnalités industrielles.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/subscription">
                    <Button
                      variant="outline"
                      className="w-full border-rule bg-white hover:bg-white text-ink hover:text-ink"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Voir les offres
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
