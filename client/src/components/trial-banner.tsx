import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gift, Clock, Zap, Crown } from "lucide-react";
import { Link } from "wouter";

interface TrialBannerProps {
  daysRemaining?: number;
  planType?: "pro" | "business" | "enterprise";
  diagnosticsUsed?: number;
  diagnosticsLimit?: number;
  isTrialActive?: boolean;
}

export function TrialBanner({
  daysRemaining = 14,
  planType = "pro",
  diagnosticsUsed = 0,
  diagnosticsLimit = 100,
  isTrialActive = true
}: TrialBannerProps) {
  const usagePercentage = (diagnosticsUsed / diagnosticsLimit) * 100;
  
  const planIcons = {
    pro: Zap,
    business: Clock,
    enterprise: Crown
  };
  
  const planColors = {
    pro: "bg-etat-encours-fond dark:bg-blue-950 border-etat-encours-filet dark:border-blue-800",
    business: "bg-etat-nominal-fond dark:bg-green-950 border-etat-nominal-filet dark:border-green-800", 
    enterprise: "bg-paper-deep dark:bg-ink border-rule dark:border-rule"
  };
  
  const PlanIcon = planIcons[planType];
  
  if (!isTrialActive) {
    return (
      <Card className="mb-6 border-etat-critique-filet dark:border-red-800 bg-etat-critique-fond dark:bg-red-950">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-etat-critique-fond dark:bg-etat-critique-vif rounded-lg">
                <Clock className="h-5 w-5 text-etat-critique-texte dark:text-etat-critique-texte" />
              </div>
              <div>
                <h3 className="font-medium text-etat-critique-texte dark:text-red-100">
                  Période d'essai expirée
                </h3>
                <p className="text-sm text-etat-critique-texte dark:text-etat-critique-texte">
                  Contactez l'administrateur pour accéder à Maintrix
                </p>
              </div>
            </div>
            <Button size="sm" className="bg-etat-critique-vif hover:bg-etat-critique-vif" disabled>
              Fonctionnalité désactivée
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={`mb-6 ${planColors[planType]}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-black/20 rounded-lg">
              <Gift className="h-5 w-5 text-etat-nominal-texte dark:text-etat-nominal-texte" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium">Essai gratuit Maintrix</h3>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <PlanIcon className="h-3 w-3" />
                  Plan {planType.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {daysRemaining > 1 
                  ? `${daysRemaining} jours restants sur votre période d'essai de 14 jours`
                  : daysRemaining === 1 
                  ? "Dernier jour de votre période d'essai"
                  : "Période d'essai en cours d'expiration"
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {daysRemaining <= 3 && (
              <Badge variant="destructive" className="animate-pulse">
                Expiration proche
              </Badge>
            )}
            <Button size="sm" variant="outline" disabled>
              Fonctionnalité désactivée
            </Button>
          </div>
        </div>
        
        {/* Barre de progression d'utilisation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Diagnostics utilisés
            </span>
            <span className="font-medium">
              {diagnosticsUsed} / {diagnosticsLimit}
            </span>
          </div>
          <Progress 
            value={usagePercentage} 
            className="h-2"
          />
          {usagePercentage > 80 && (
            <p className="text-xs text-etat-alerte-texte dark:text-etat-alerte-texte">
              Utilisation élevée - Pensez à vous abonner pour ne pas perdre l'accès
            </p>
          )}
        </div>
        
        {/* Fonctionnalités de l'essai */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-1 text-etat-nominal-texte dark:text-etat-nominal-texte">
            Smart Diagnostic
          </div>
          <div className="flex items-center gap-1 text-etat-nominal-texte dark:text-etat-nominal-texte">
            Smart GMAO
          </div>
          <div className="flex items-center gap-1 text-etat-nominal-texte dark:text-etat-nominal-texte">
            IA Avancée
          </div>
          <div className="flex items-center gap-1 text-etat-nominal-texte dark:text-etat-nominal-texte">
            Export données
          </div>
        </div>
      </CardContent>
    </Card>
  );
}