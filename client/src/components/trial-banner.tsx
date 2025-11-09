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
    pro: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
    business: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800", 
    enterprise: "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800"
  };
  
  const PlanIcon = planIcons[planType];
  
  if (!isTrialActive) {
    return (
      <Card className="mb-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                <Clock className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-medium text-red-900 dark:text-red-100">
                  Période d'essai expirée
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Contactez l'administrateur pour accéder à Maintrix
                </p>
              </div>
            </div>
            <Button size="sm" className="bg-red-600 hover:bg-red-700" disabled>
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
            <div className="p-2 bg-white/50 dark:bg-black/20 rounded-lg">
              <Gift className="h-5 w-5 text-green-600 dark:text-green-400" />
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
                ⚠️ Expiration proche
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
            <p className="text-xs text-orange-600 dark:text-orange-400">
              ⚡ Utilisation élevée - Pensez à vous abonner pour ne pas perdre l'accès
            </p>
          )}
        </div>
        
        {/* Fonctionnalités de l'essai */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            ✓ Smart Diagnostic
          </div>
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            ✓ Smart GMAO
          </div>
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            ✓ IA Avancée
          </div>
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            ✓ Export données
          </div>
        </div>
      </CardContent>
    </Card>
  );
}