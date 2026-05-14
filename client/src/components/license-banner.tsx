import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, CheckCircle, XCircle, Zap, X } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface LicenseStatus {
  status: "trial" | "active" | "grace" | "expired" | "suspended";
  isTrialActive: boolean;
  trialDaysRemaining: number;
  isGracePeriodActive: boolean;
  gracePeriodDaysRemaining: number;
  canOperate: boolean;
  warningMessage: string | null;
  plan: string;
}

export function LicenseBanner() {
  const [dismissed, setDismissed] = useState(false);
  const queryClient = useQueryClient();

  const { data: licenseData } = useQuery<LicenseStatus>({
    queryKey: ["/api/license/status"],
    refetchInterval: 5 * 60 * 1000, // refresh every 5 minutes
    retry: false,
  });

  const startTrialMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/trial/start"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/license/status"] }),
  });

  if (!licenseData || dismissed) return null;

  const { status, isTrialActive, trialDaysRemaining, isGracePeriodActive, gracePeriodDaysRemaining } = licenseData;

  // Active subscription: no banner needed
  if (status === "active") return null;

  // Trial with plenty of days left (> 7): no banner
  if (isTrialActive && trialDaysRemaining > 7) return null;

  // Determine banner style
  const getBannerConfig = () => {
    if (status === "expired" || status === "suspended") {
      return {
        bg: "bg-red-600 dark:bg-red-800",
        text: "text-white",
        icon: <XCircle className="h-4 w-4 flex-shrink-0" />,
        message: "Votre accès a expiré. Souscrivez pour continuer à utiliser Maintrix.",
        cta: "S'abonner maintenant",
        urgent: true,
      };
    }
    if (isGracePeriodActive) {
      return {
        bg: "bg-orange-500 dark:bg-orange-700",
        text: "text-white",
        icon: <AlertTriangle className="h-4 w-4 flex-shrink-0" />,
        message: `Période de grâce — ${gracePeriodDaysRemaining} jour(s) restant(s) avant interruption du service.`,
        cta: "Renouveler",
        urgent: true,
      };
    }
    if (isTrialActive && trialDaysRemaining <= 3) {
      return {
        bg: "bg-red-500 dark:bg-red-700",
        text: "text-white",
        icon: <Clock className="h-4 w-4 flex-shrink-0" />,
        message: `Essai gratuit — expire dans ${trialDaysRemaining} jour(s). Passez à un abonnement pour ne pas perdre l'accès.`,
        cta: "Voir les plans",
        urgent: true,
      };
    }
    if (isTrialActive && trialDaysRemaining <= 7) {
      return {
        bg: "bg-amber-500 dark:bg-amber-700",
        text: "text-white",
        icon: <Clock className="h-4 w-4 flex-shrink-0" />,
        message: `Période d'essai — ${trialDaysRemaining} jour(s) restant(s) sur 30.`,
        cta: "Voir les plans",
        urgent: false,
      };
    }
    return null;
  };

  const config = getBannerConfig();
  if (!config) return null;

  return (
    <div className={`${config.bg} ${config.text} px-4 py-2.5 flex items-center justify-between gap-4 text-sm font-medium`}>
      <div className="flex items-center gap-2 min-w-0">
        {config.icon}
        <span className="truncate">{config.message}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href="/subscription">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs border-white/50 bg-white/20 hover:bg-white/30 text-white hover:text-white"
          >
            <Zap className="h-3 w-3 mr-1" />
            {config.cta}
          </Button>
        </Link>
        {!config.urgent && (
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded hover:bg-white/20 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// Compact widget for the sidebar or header
export function LicenseStatusWidget() {
  const { data: licenseData } = useQuery<LicenseStatus>({
    queryKey: ["/api/license/status"],
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });

  if (!licenseData) return null;

  const { status, isTrialActive, trialDaysRemaining, plan } = licenseData;

  const statusConfig = {
    active: { icon: <CheckCircle className="h-3.5 w-3.5 text-green-500" />, label: `Actif · ${plan}`, color: "text-green-600 dark:text-green-400" },
    trial: { icon: <Clock className="h-3.5 w-3.5 text-blue-500" />, label: `Essai · J-${trialDaysRemaining}`, color: "text-blue-600 dark:text-blue-400" },
    grace: { icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />, label: "Grâce", color: "text-orange-600 dark:text-orange-400" },
    expired: { icon: <XCircle className="h-3.5 w-3.5 text-red-500" />, label: "Expiré", color: "text-red-600 dark:text-red-400" },
    suspended: { icon: <XCircle className="h-3.5 w-3.5 text-red-500" />, label: "Suspendu", color: "text-red-600 dark:text-red-400" },
  };

  const cfg = statusConfig[status] || statusConfig.trial;

  return (
    <Link href="/subscription">
      <div className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${cfg.color}`}>
        {cfg.icon}
        <span>{cfg.label}</span>
      </div>
    </Link>
  );
}
