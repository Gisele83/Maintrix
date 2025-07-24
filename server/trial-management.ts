// Trial Management System for Smart GMAO DiagFix
// Gestion de la période d'essai gratuite de 14 jours

export interface TrialUser {
  userId: string;
  email: string;
  trialStartDate: Date;
  trialEndDate: Date;
  isTrialActive: boolean;
  planType: "pro" | "business" | "enterprise";
  featuresUsed: string[];
  diagnosticsCount: number;
  maxDiagnostics: number;
}

export interface TrialStatus {
  isActive: boolean;
  daysRemaining: number;
  featuresAccess: {
    smartDiagnostic: boolean;
    smartGMAO: boolean;
    advancedML: boolean;
    iotIntegration: boolean;
    apiAccess: boolean;
    exportData: boolean;
  };
  usageStats: {
    diagnosticsUsed: number;
    diagnosticsLimit: number;
    equipmentCount: number;
    workOrdersCreated: number;
  };
}

export class TrialManager {
  
  // Créer un nouveau compte d'essai
  static createTrialUser(email: string, planType: "pro" | "business" | "enterprise"): TrialUser {
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 jours
    
    const maxDiagnostics = planType === "pro" ? 100 : planType === "business" ? 500 : 1000;
    
    return {
      userId: `trial_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      trialStartDate: now,
      trialEndDate,
      isTrialActive: true,
      planType,
      featuresUsed: [],
      diagnosticsCount: 0,
      maxDiagnostics
    };
  }
  
  // Vérifier le statut de l'essai
  static getTrialStatus(trialUser: TrialUser): TrialStatus {
    const now = new Date();
    const timeRemaining = trialUser.trialEndDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(timeRemaining / (24 * 60 * 60 * 1000)));
    const isActive = timeRemaining > 0 && trialUser.isTrialActive;
    
    // Définir les fonctionnalités disponibles selon le plan d'essai
    const featuresAccess = {
      smartDiagnostic: true,
      smartGMAO: true,
      advancedML: trialUser.planType !== "pro",
      iotIntegration: trialUser.planType === "business" || trialUser.planType === "enterprise",
      apiAccess: trialUser.planType === "business" || trialUser.planType === "enterprise",
      exportData: true
    };
    
    return {
      isActive,
      daysRemaining,
      featuresAccess,
      usageStats: {
        diagnosticsUsed: trialUser.diagnosticsCount,
        diagnosticsLimit: trialUser.maxDiagnostics,
        equipmentCount: 5, // Limite d'essai
        workOrdersCreated: 0
      }
    };
  }
  
  // Incrémenter l'utilisation
  static incrementUsage(trialUser: TrialUser, feature: string): boolean {
    if (!this.getTrialStatus(trialUser).isActive) {
      return false;
    }
    
    if (feature === "diagnostic") {
      if (trialUser.diagnosticsCount >= trialUser.maxDiagnostics) {
        return false;
      }
      trialUser.diagnosticsCount++;
    }
    
    if (!trialUser.featuresUsed.includes(feature)) {
      trialUser.featuresUsed.push(feature);
    }
    
    return true;
  }
  
  // Générer un rapport d'utilisation de l'essai
  static generateTrialReport(trialUser: TrialUser): {
    summary: string;
    recommendations: string[];
    suggestedPlan: string;
  } {
    const status = this.getTrialStatus(trialUser);
    const usagePercentage = (trialUser.diagnosticsCount / trialUser.maxDiagnostics) * 100;
    
    let summary = `Essai ${trialUser.planType.toUpperCase()} - ${status.daysRemaining} jours restants. `;
    summary += `Utilisation: ${trialUser.diagnosticsCount}/${trialUser.maxDiagnostics} diagnostics (${usagePercentage.toFixed(1)}%)`;
    
    const recommendations = [];
    
    if (usagePercentage > 80) {
      recommendations.push("Forte utilisation détectée - Abonnement recommandé pour continuer");
    }
    
    if (trialUser.featuresUsed.includes("advancedML")) {
      recommendations.push("Fonctionnalités IA avancées utilisées - Plan Business ou Enterprise recommandé");
    }
    
    if (trialUser.featuresUsed.includes("iotIntegration")) {
      recommendations.push("Intégration IoT utilisée - Plan Business minimum requis");
    }
    
    let suggestedPlan = "pro";
    if (trialUser.featuresUsed.includes("iotIntegration") || usagePercentage > 60) {
      suggestedPlan = "business";
    }
    if (trialUser.featuresUsed.length > 5 || usagePercentage > 90) {
      suggestedPlan = "enterprise";
    }
    
    return {
      summary,
      recommendations,
      suggestedPlan
    };
  }
  
  // Notifications automatiques d'expiration
  static getTrialNotifications(trialUser: TrialUser): string[] {
    const status = this.getTrialStatus(trialUser);
    const notifications = [];
    
    if (status.daysRemaining <= 3 && status.daysRemaining > 0) {
      notifications.push(`⚠️ Votre essai expire dans ${status.daysRemaining} jour(s). Souscrivez maintenant pour continuer.`);
    }
    
    if (status.daysRemaining === 0) {
      notifications.push("🔒 Votre période d'essai de 14 jours a expiré. Abonnez-vous pour continuer à utiliser Smart GMAO DiagFix.");
    }
    
    const usagePercentage = (trialUser.diagnosticsCount / trialUser.maxDiagnostics) * 100;
    if (usagePercentage > 90) {
      notifications.push(`📊 Vous avez utilisé ${usagePercentage.toFixed(1)}% de vos diagnostics d'essai.`);
    }
    
    return notifications;
  }
}

// Exemple d'utilisation
export const createTrialExample = () => {
  // Création d'un compte d'essai Business
  const trialUser = TrialManager.createTrialUser("utilisateur@exemple.com", "business");
  
  // Simulation d'utilisation
  TrialManager.incrementUsage(trialUser, "diagnostic");
  TrialManager.incrementUsage(trialUser, "smartGMAO");
  TrialManager.incrementUsage(trialUser, "iotIntegration");
  
  // Vérification du statut
  const status = TrialManager.getTrialStatus(trialUser);
  console.log("Statut d'essai:", status);
  
  // Génération du rapport
  const report = TrialManager.generateTrialReport(trialUser);
  console.log("Rapport d'essai:", report);
  
  // Notifications
  const notifications = TrialManager.getTrialNotifications(trialUser);
  console.log("Notifications:", notifications);
  
  return { trialUser, status, report, notifications };
};