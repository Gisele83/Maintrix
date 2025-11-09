// Access Management System for Maintrix
// Permet au propriétaire de donner l'accès à des tiers sans paiement

export interface AccessGrant {
  id: string;
  grantedBy: string; // ID du propriétaire qui accorde l'accès
  grantedTo: string; // Email de la personne qui reçoit l'accès
  planType: "pro" | "business" | "enterprise";
  duration: number; // Durée en jours
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  features: string[];
  maxDiagnostics: number;
  currentUsage: number;
  reason?: string; // Raison de l'octroi d'accès
  notes?: string;
  createdAt: Date;
  lastUsed?: Date;
}

export interface OwnerSettings {
  ownerId: string;
  companyName: string;
  maxGrantsPerMonth: number;
  currentMonthGrants: number;
  allowedPlans: ("pro" | "business" | "enterprise")[];
  maxDurationDays: number;
  requiresApproval: boolean;
  autoExpire: boolean;
}

export class AccessManager {
  
  // Vérifier si l'utilisateur est propriétaire
  static isOwner(userId: string): boolean {
    // Dans une vraie implémentation, vérifier en base de données
    const ownerIds = ["owner_1", "admin_primary", "superuser"];
    return ownerIds.includes(userId);
  }
  
  // Accorder l'accès à un tiers
  static createAccessGrant(
    ownerId: string,
    granteeEmail: string,
    planType: "pro" | "business" | "enterprise",
    durationDays: number,
    reason?: string,
    notes?: string
  ): AccessGrant {
    if (!this.isOwner(ownerId)) {
      throw new Error("Seul le propriétaire peut accorder l'accès");
    }
    
    const now = new Date();
    const endDate = new Date(now.getTime() + (durationDays * 24 * 60 * 60 * 1000));
    
    const features = this.getPlanFeatures(planType);
    const maxDiagnostics = this.getPlanLimits(planType);
    
    return {
      id: `grant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      grantedBy: ownerId,
      grantedTo: granteeEmail,
      planType,
      duration: durationDays,
      startDate: now,
      endDate,
      isActive: true,
      features,
      maxDiagnostics,
      currentUsage: 0,
      reason,
      notes,
      createdAt: now
    };
  }
  
  // Obtenir les fonctionnalités par plan
  static getPlanFeatures(planType: "pro" | "business" | "enterprise"): string[] {
    const featureMap = {
      pro: [
        "Smart Diagnostic",
        "Multi-équipements", 
        "Export CSV",
        "Support prioritaire",
        "Rapports avancés"
      ],
      business: [
        "Smart Diagnostic",
        "Smart GMAO complet",
        "Planification préventive",
        "IoT / capteurs",
        "API ERP",
        "Dashboard personnalisé",
        "Formation équipe"
      ],
      enterprise: [
        "Toutes fonctionnalités Business",
        "IA prédictive RUL",
        "SLA premium", 
        "Services Data IA",
        "Support 24/7",
        "Intégrations sur mesure",
        "Consulting stratégique"
      ]
    };
    
    return featureMap[planType];
  }
  
  // Obtenir les limites par plan
  static getPlanLimits(planType: "pro" | "business" | "enterprise"): number {
    const limitMap = {
      pro: 200,
      business: 1000,
      enterprise: 5000
    };
    
    return limitMap[planType];
  }
  
  // Vérifier si un accès est valide
  static validateAccess(grant: AccessGrant): {
    isValid: boolean;
    reason?: string;
    daysRemaining: number;
    usagePercentage: number;
  } {
    const now = new Date();
    const timeRemaining = grant.endDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(timeRemaining / (24 * 60 * 60 * 1000)));
    const usagePercentage = (grant.currentUsage / grant.maxDiagnostics) * 100;
    
    if (!grant.isActive) {
      return {
        isValid: false,
        reason: "Accès désactivé par le propriétaire",
        daysRemaining: 0,
        usagePercentage
      };
    }
    
    if (timeRemaining <= 0) {
      return {
        isValid: false,
        reason: "Période d'accès expirée",
        daysRemaining: 0,
        usagePercentage
      };
    }
    
    if (grant.currentUsage >= grant.maxDiagnostics) {
      return {
        isValid: false,
        reason: "Limite d'utilisation atteinte",
        daysRemaining,
        usagePercentage: 100
      };
    }
    
    return {
      isValid: true,
      daysRemaining,
      usagePercentage
    };
  }
  
  // Incrémenter l'utilisation
  static incrementUsage(grant: AccessGrant, feature: string): boolean {
    const validation = this.validateAccess(grant);
    if (!validation.isValid) {
      return false;
    }
    
    if (feature === "diagnostic") {
      grant.currentUsage++;
      grant.lastUsed = new Date();
    }
    
    return true;
  }
  
  // Révoquer un accès
  static revokeAccess(grantId: string, ownerId: string, reason?: string): boolean {
    if (!this.isOwner(ownerId)) {
      throw new Error("Seul le propriétaire peut révoquer l'accès");
    }
    
    // Dans une vraie implémentation, mettre à jour en base de données
    console.log(`Accès ${grantId} révoqué par ${ownerId}. Raison: ${reason || "Non spécifiée"}`);
    return true;
  }
  
  // Étendre la durée d'un accès
  static extendAccess(
    grantId: string, 
    ownerId: string, 
    additionalDays: number
  ): AccessGrant | null {
    if (!this.isOwner(ownerId)) {
      throw new Error("Seul le propriétaire peut étendre l'accès");
    }
    
    // Simulation - dans la réalité, récupérer depuis la base de données
    const mockGrant = this.createAccessGrant(ownerId, "test@example.com", "business", 30);
    mockGrant.endDate = new Date(mockGrant.endDate.getTime() + (additionalDays * 24 * 60 * 60 * 1000));
    mockGrant.duration += additionalDays;
    
    return mockGrant;
  }
  
  // Générer un rapport d'utilisation pour le propriétaire
  static generateUsageReport(ownerId: string, grants: AccessGrant[]): {
    totalGrants: number;
    activeGrants: number;
    expiredGrants: number;
    totalUsage: number;
    averageUsage: number;
    topUsers: Array<{email: string, usage: number}>;
    planBreakdown: Record<string, number>;
  } {
    if (!this.isOwner(ownerId)) {
      throw new Error("Seul le propriétaire peut générer des rapports");
    }
    
    const activeGrants = grants.filter(g => this.validateAccess(g).isValid);
    const expiredGrants = grants.filter(g => !this.validateAccess(g).isValid);
    
    const totalUsage = grants.reduce((sum, g) => sum + g.currentUsage, 0);
    const averageUsage = grants.length > 0 ? totalUsage / grants.length : 0;
    
    const topUsers = grants
      .sort((a, b) => b.currentUsage - a.currentUsage)
      .slice(0, 5)
      .map(g => ({ email: g.grantedTo, usage: g.currentUsage }));
    
    const planBreakdown = grants.reduce((acc, g) => {
      acc[g.planType] = (acc[g.planType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalGrants: grants.length,
      activeGrants: activeGrants.length,
      expiredGrants: expiredGrants.length,
      totalUsage,
      averageUsage,
      topUsers,
      planBreakdown
    };
  }
  
  // Notifications automatiques pour le propriétaire
  static getOwnerNotifications(ownerId: string, grants: AccessGrant[]): string[] {
    if (!this.isOwner(ownerId)) {
      return [];
    }
    
    const notifications = [];
    
    // Accès qui expirent bientôt
    const expiringSoon = grants.filter(g => {
      const validation = this.validateAccess(g);
      return validation.isValid && validation.daysRemaining <= 3;
    });
    
    if (expiringSoon.length > 0) {
      notifications.push(`⚠️ ${expiringSoon.length} accès accordé(s) expire(nt) dans moins de 3 jours`);
    }
    
    // Utilisation élevée
    const highUsage = grants.filter(g => {
      const validation = this.validateAccess(g);
      return validation.usagePercentage > 80;
    });
    
    if (highUsage.length > 0) {
      notifications.push(`📊 ${highUsage.length} utilisateur(s) avec une utilisation élevée (>80%)`);
    }
    
    // Limite mensuelle approchée
    const currentMonth = new Date().getMonth();
    const thisMonthGrants = grants.filter(g => 
      g.createdAt.getMonth() === currentMonth
    ).length;
    
    if (thisMonthGrants >= 8) { // Limite exemple de 10 par mois
      notifications.push(`🚨 Limite mensuelle d'accès accordés bientôt atteinte (${thisMonthGrants}/10)`);
    }
    
    return notifications;
  }
}

// Exemple d'utilisation
export const createAccessExample = () => {
  const ownerId = "owner_1";
  
  // Accorder l'accès à un partenaire
  const partnerAccess = AccessManager.createAccessGrant(
    ownerId,
    "partenaire@entreprise.com",
    "business",
    90, // 3 mois
    "Partenariat commercial",
    "Accès pour évaluation technique pendant la période d'essai commercial"
  );
  
  // Accorder l'accès à un consultant
  const consultantAccess = AccessManager.createAccessGrant(
    ownerId,
    "consultant@expertise.com", 
    "enterprise",
    30, // 1 mois
    "Mission de consulting",
    "Accès complet pour audit et recommandations d'optimisation"
  );
  
  // Vérifier les accès
  const partnerValidation = AccessManager.validateAccess(partnerAccess);
  const consultantValidation = AccessManager.validateAccess(consultantAccess);
  
  // Générer un rapport
  const report = AccessManager.generateUsageReport(ownerId, [partnerAccess, consultantAccess]);
  
  console.log("Accès partenaire:", partnerAccess);
  console.log("Validation partenaire:", partnerValidation);
  console.log("Rapport d'utilisation:", report);
  
  return { partnerAccess, consultantAccess, report };
};