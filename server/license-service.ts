import { db } from "./db";
import { tenants, licenseTypes, licenseHistory, userProfiles } from "@shared/schema";
import { eq, count } from "drizzle-orm";

// ─── Constants ─────────────────────────────────────────────────────────────
export const TRIAL_DURATION_DAYS = 30;
export const DEFAULT_GRACE_PERIOD_DAYS = 7;

// ─── Types ─────────────────────────────────────────────────────────────────
export interface LicenseInfo {
  type: string;
  displayName: string;
  description: string;
  minUsers: number;
  maxUsers: number | null;
  licensedUsers: number;
}

export interface LicenseStatus {
  tenantId: string;
  status: "trial" | "active" | "grace" | "expired" | "suspended";
  plan: string;                    // free, pro, business, enterprise
  licenseType: string;             // solo, team, enterprise_s, enterprise_m, enterprise_l
  licenseKey: string | null;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  trialEndDate: Date | null;
  trialStartDate: Date | null;
  isGracePeriodActive: boolean;
  gracePeriodDaysRemaining: number;
  gracePeriodEnd: Date | null;
  gracePeriodDays: number;
  lastLicenseCheckAt: Date | null;
  subscriptionId: string | null;
  currentUsers: number;
  maxUsers: number;
  licensedUsers: number;
  canOperate: boolean;             // true when trial/active/grace
  warningMessage: string | null;   // shown to user when near expiry
}

// ─── License Tiers ─────────────────────────────────────────────────────────
const LICENSE_TIERS = [
  {
    name: "solo",
    displayName: "Licence Solo",
    description: "Parfaite pour un utilisateur unique",
    minUsers: 1,
    maxUsers: 1,
    monthlyPrice: 29.99,
    yearlyPrice: 299.99,
    features: { basicSupport: true, standardFeatures: true },
  },
  {
    name: "team",
    displayName: "Licence Équipe",
    description: "Idéale pour les petites équipes (2–5 utilisateurs)",
    minUsers: 2,
    maxUsers: 5,
    monthlyPrice: 89.99,
    yearlyPrice: 899.99,
    features: { basicSupport: true, standardFeatures: true, teamCollaboration: true },
  },
  {
    name: "enterprise_s",
    displayName: "Licence Entreprise S",
    description: "Pour les équipes moyennes (6–11 utilisateurs)",
    minUsers: 6,
    maxUsers: 11,
    monthlyPrice: 189.99,
    yearlyPrice: 1899.99,
    features: { basicSupport: true, standardFeatures: true, teamCollaboration: true, advancedReporting: true, prioritySupport: true },
  },
  {
    name: "enterprise_m",
    displayName: "Licence Entreprise M",
    description: "Pour les entreprises moyennes (12–20 utilisateurs)",
    minUsers: 12,
    maxUsers: 20,
    monthlyPrice: 349.99,
    yearlyPrice: 3499.99,
    features: { basicSupport: true, standardFeatures: true, teamCollaboration: true, advancedReporting: true, prioritySupport: true, customIntegrations: true },
  },
  {
    name: "enterprise_l",
    displayName: "Licence Entreprise L",
    description: "Pour les grandes entreprises (21+ utilisateurs)",
    minUsers: 21,
    maxUsers: null,
    monthlyPrice: 599.99,
    yearlyPrice: 5999.99,
    features: { basicSupport: true, standardFeatures: true, teamCollaboration: true, advancedReporting: true, prioritySupport: true, customIntegrations: true, dedicatedSupport: true, whiteLabeling: true },
  },
];

// Subscription plans (for display / pricing page)
export const SUBSCRIPTION_PLANS = [
  {
    id: "pro",
    name: "Pro",
    description: "Pour les techniciens indépendants et petites équipes",
    monthlyPrice: 49,
    yearlyPrice: 490,
    maxUsers: 5,
    features: [
      "Smart Diagnostic IA",
      "GMAO complète",
      "Export PDF/CSV",
      "Historique 12 mois",
      "Support email",
      "5 utilisateurs",
    ],
    highlighted: false,
  },
  {
    id: "business",
    name: "Business",
    description: "Pour les équipes de maintenance industrielle",
    monthlyPrice: 149,
    yearlyPrice: 1490,
    maxUsers: 20,
    features: [
      "Tout le plan Pro",
      "IA prédictive avancée",
      "Intégration IoT / MQTT",
      "API ERP (SAP, Maximo)",
      "Multi-sites",
      "Support prioritaire 8h–18h",
      "20 utilisateurs",
    ],
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Entreprise",
    description: "Pour les grandes organisations multi-sites",
    monthlyPrice: 399,
    yearlyPrice: 3990,
    maxUsers: null,
    features: [
      "Tout le plan Business",
      "Déploiement local/cloud hybride",
      "SLA 99.9% garanti",
      "Support dédié 24/7",
      "Formation incluse",
      "Utilisateurs illimités",
      "White-labeling",
    ],
    highlighted: false,
  },
];

export class LicenseService {

  // ── Initialize license types in DB ─────────────────────────────────────
  static async initializeLicenseTypes(): Promise<void> {
    try {
      console.log("🔄 Initializing license types...");
      for (const tier of LICENSE_TIERS) {
        const existing = await db.select().from(licenseTypes).where(eq(licenseTypes.name, tier.name)).limit(1);
        if (existing.length === 0) {
          await db.insert(licenseTypes).values({
            name: tier.name,
            displayName: tier.displayName,
            description: tier.description,
            minUsers: tier.minUsers,
            maxUsers: tier.maxUsers,
            monthlyPrice: tier.monthlyPrice.toString(),
            yearlyPrice: tier.yearlyPrice.toString(),
            features: tier.features,
          });
        }
      }
      console.log("✅ License types initialization completed");
    } catch (error) {
      console.error("❌ Error initializing license types:", error);
    }
  }

  // ── Start a 30-day trial for a tenant ──────────────────────────────────
  static async startTrial(tenantId: string): Promise<void> {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

    await db.update(tenants).set({
      trialStartDate: now,
      trialEndDate: trialEnd,
      licenseStatus: "trial",
      plan: "pro", // Trial gives access to Pro features
      lastLicenseCheckAt: now,
    }).where(eq(tenants.id, tenantId));

    console.log(`🎯 Trial started for tenant ${tenantId} — expires ${trialEnd.toISOString()}`);
  }

  // ── Compute full license status for a tenant ───────────────────────────
  static async getLicenseStatus(tenantId: string): Promise<LicenseStatus | null> {
    const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (rows.length === 0) return null;

    const t = rows[0];
    const now = new Date();

    // Trial check
    const trialEndDate = t.trialEndDate ? new Date(t.trialEndDate) : null;
    const trialStartDate = t.trialStartDate ? new Date(t.trialStartDate) : null;
    const trialMsLeft = trialEndDate ? trialEndDate.getTime() - now.getTime() : 0;
    const isTrialActive = !!trialEndDate && trialMsLeft > 0;
    const trialDaysRemaining = isTrialActive ? Math.ceil(trialMsLeft / (24 * 60 * 60 * 1000)) : 0;

    // Active subscription check
    const hasActiveSubscription = !!t.subscriptionId && t.plan !== "free";

    // Grace period check
    const gracePeriodEnd = t.gracePeriodEnd ? new Date(t.gracePeriodEnd) : null;
    const graceMsLeft = gracePeriodEnd ? gracePeriodEnd.getTime() - now.getTime() : 0;
    const isGracePeriodActive = !!gracePeriodEnd && graceMsLeft > 0;
    const gracePeriodDaysRemaining = isGracePeriodActive ? Math.ceil(graceMsLeft / (24 * 60 * 60 * 1000)) : 0;

    // Determine effective status
    let status: LicenseStatus["status"];
    if (hasActiveSubscription) {
      status = "active";
    } else if (isTrialActive) {
      status = "trial";
    } else if (isGracePeriodActive) {
      status = "grace";
    } else if (t.licenseStatus === "suspended") {
      status = "suspended";
    } else {
      status = "expired";
    }

    const canOperate = status === "active" || status === "trial" || status === "grace";

    // Warning messages
    let warningMessage: string | null = null;
    if (status === "trial" && trialDaysRemaining <= 7) {
      warningMessage = `⚠️ Votre période d'essai expire dans ${trialDaysRemaining} jour(s). Souscrivez pour continuer.`;
    } else if (status === "grace") {
      warningMessage = `🔶 Votre abonnement a expiré. Vous avez encore ${gracePeriodDaysRemaining} jour(s) de grâce avant l'interruption.`;
    } else if (status === "expired") {
      warningMessage = "🔒 Votre période d'accès a expiré. Veuillez souscrire un abonnement pour continuer.";
    }

    return {
      tenantId,
      status,
      plan: t.plan || "free",
      licenseType: t.licenseType || "solo",
      licenseKey: t.licenseKey || null,
      isTrialActive,
      trialDaysRemaining,
      trialEndDate,
      trialStartDate,
      isGracePeriodActive,
      gracePeriodDaysRemaining,
      gracePeriodEnd,
      gracePeriodDays: t.gracePeriodDays || DEFAULT_GRACE_PERIOD_DAYS,
      lastLicenseCheckAt: t.lastLicenseCheckAt ? new Date(t.lastLicenseCheckAt) : null,
      subscriptionId: t.subscriptionId || null,
      currentUsers: t.currentUsers || 0,
      maxUsers: t.maxUsers || 5,
      licensedUsers: t.licensedUsers || 1,
      canOperate,
      warningMessage,
    };
  }

  // ── Record an online license check (resets grace period countdown) ─────
  static async recordLicenseCheck(tenantId: string): Promise<void> {
    const now = new Date();
    const gracePeriodDays = DEFAULT_GRACE_PERIOD_DAYS;
    const gracePeriodEnd = new Date(now.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);

    await db.update(tenants).set({
      lastLicenseCheckAt: now,
      gracePeriodEnd,
      gracePeriodDays,
    }).where(eq(tenants.id, tenantId));
  }

  // ── Activate a subscription (after payment) ────────────────────────────
  static async activateSubscription(
    tenantId: string,
    subscriptionId: string,
    plan: string,
    maxUsers: number | null,
  ): Promise<void> {
    const now = new Date();
    const gracePeriodEnd = new Date(now.getTime() + DEFAULT_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const nextBilling = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await db.update(tenants).set({
      subscriptionId,
      plan,
      licenseStatus: "active",
      maxUsers: maxUsers || 999999,
      lastBillingDate: now,
      nextBillingDate: nextBilling,
      lastLicenseCheckAt: now,
      gracePeriodEnd,
    }).where(eq(tenants.id, tenantId));

    console.log(`✅ Subscription activated for tenant ${tenantId}: plan=${plan}`);
  }

  // ── Enter grace period (subscription payment failed) ───────────────────
  static async enterGracePeriod(tenantId: string, graceDays?: number): Promise<void> {
    const days = graceDays ?? DEFAULT_GRACE_PERIOD_DAYS;
    const gracePeriodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await db.update(tenants).set({
      licenseStatus: "grace",
      gracePeriodDays: days,
      gracePeriodEnd,
    }).where(eq(tenants.id, tenantId));

    console.log(`⚠️ Tenant ${tenantId} entered grace period — expires ${gracePeriodEnd.toISOString()}`);
  }

  // ── Cancel / expire license ────────────────────────────────────────────
  static async expireLicense(tenantId: string): Promise<void> {
    await db.update(tenants).set({
      licenseStatus: "expired",
      subscriptionId: null,
    }).where(eq(tenants.id, tenantId));
  }

  // ── Determine license type from user count ─────────────────────────────
  static determineLicenseType(userCount: number): LicenseInfo {
    for (const tier of LICENSE_TIERS) {
      if (userCount >= tier.minUsers && (tier.maxUsers === null || userCount <= tier.maxUsers)) {
        return {
          type: tier.name,
          displayName: tier.displayName,
          description: tier.description,
          minUsers: tier.minUsers,
          maxUsers: tier.maxUsers,
          licensedUsers: tier.maxUsers || userCount,
        };
      }
    }
    return {
      type: "solo",
      displayName: "Licence Solo",
      description: "Parfaite pour un utilisateur unique",
      minUsers: 1,
      maxUsers: 1,
      licensedUsers: 1,
    };
  }

  // ── Update tenant license when user count changes ──────────────────────
  static async updateTenantLicense(
    tenantId: string,
    reason: "user_added" | "user_removed" | "manual_upgrade" | "tenant_created",
    changedBy?: number,
  ): Promise<void> {
    try {
      const userCountResult = await db.select({ count: count() }).from(userProfiles).where(eq(userProfiles.tenantId, tenantId));
      const currentUserCount = userCountResult[0]?.count || 0;

      const currentTenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      if (currentTenant.length === 0) throw new Error(`Tenant ${tenantId} not found`);
      const tenant = currentTenant[0];

      const newLicense = this.determineLicenseType(currentUserCount);

      if (tenant.licenseType === "custom") {
        const updateData: any = { currentUsers: currentUserCount };
        if (!tenant.licenseKey) updateData.licenseKey = this.generateLicenseKey(tenantId, tenant.maxUsers || tenant.licensedUsers || 1);
        await db.update(tenants).set(updateData).where(eq(tenants.id, tenantId));
      } else {
        if (tenant.licenseType !== newLicense.type) {
          const newLicenseKey = this.generateLicenseKey(tenantId, newLicense.licensedUsers);
          await db.insert(licenseHistory).values({
            tenantId,
            previousLicenseType: tenant.licenseType,
            newLicenseType: newLicense.type,
            userCountAtChange: currentUserCount,
            reason,
            changedBy: changedBy || null,
            automaticUpdate: changedBy === undefined,
          });
          await db.update(tenants).set({
            licenseType: newLicense.type,
            licensedUsers: newLicense.licensedUsers,
            currentUsers: currentUserCount,
            maxUsers: newLicense.maxUsers || 999999,
            licenseKey: newLicenseKey,
            licenseUpdatedAt: new Date(),
          }).where(eq(tenants.id, tenantId));
          console.log(`✅ Updated tenant ${tenantId} license: ${tenant.licenseType} → ${newLicense.type}`);
        } else {
          const updateData: any = { currentUsers: currentUserCount };
          if (!tenant.licenseKey) updateData.licenseKey = this.generateLicenseKey(tenantId, tenant.maxUsers || tenant.licensedUsers || 1);
          await db.update(tenants).set(updateData).where(eq(tenants.id, tenantId));
        }
      }
    } catch (error) {
      console.error(`❌ Error updating tenant license for ${tenantId}:`, error);
      throw error;
    }
  }

  // ── Generate license key (Format: SM + 13 digits) ─────────────────────
  static generateLicenseKey(tenantId: string, maxUsers: number): string {
    const usersPadded = maxUsers.toString().padStart(4, "0");
    const tenantHash = parseInt(tenantId.slice(-8), 16) % 1000000;
    const tenantPadded = tenantHash.toString().padStart(6, "0");
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `SM${usersPadded}${tenantPadded}${randomSuffix}`;
  }

  // ── Enforce user limit ────────────────────────────────────────────────
  static async enforceUserLimit(tenantId: string): Promise<void> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) { const e = new Error("Tenant introuvable"); (e as any).code = "TENANT_NOT_FOUND"; throw e; }

    const [uc] = await db.select({ count: count() }).from(userProfiles).where(eq(userProfiles.tenantId, tenantId));
    const currentUsers = uc.count || 0;
    const maxUsers = tenant.maxUsers || tenant.licensedUsers || 1;

    if (currentUsers >= maxUsers) {
      const e = new Error("Nombre d'utilisateurs atteint pour votre licence");
      (e as any).code = "USER_LIMIT_REACHED";
      (e as any).details = { currentUsers, maxUsers, licenseType: tenant.licenseType };
      throw e;
    }
  }

  // ── Get license history ───────────────────────────────────────────────
  static async getTenantLicenseHistory(tenantId: string): Promise<any[]> {
    try {
      return await db.select().from(licenseHistory).where(eq(licenseHistory.tenantId, tenantId)).orderBy(licenseHistory.createdAt);
    } catch { return []; }
  }

  // ── Initialize custom tenant license ─────────────────────────────────
  static async initializeTenantLicense(tenantId: string, maxUsers: number, initialUserCount = 1): Promise<void> {
    const licenseKey = this.generateLicenseKey(tenantId, maxUsers);
    await db.update(tenants).set({
      licenseType: "custom",
      licensedUsers: maxUsers,
      currentUsers: initialUserCount,
      maxUsers,
      licenseKey,
      licenseGeneratedAt: new Date(),
      licenseUpdatedAt: new Date(),
    }).where(eq(tenants.id, tenantId));

    await db.insert(licenseHistory).values({
      tenantId,
      previousLicenseType: null,
      newLicenseType: "custom",
      userCountAtChange: initialUserCount,
      reason: "tenant_created",
      changedBy: null,
      automaticUpdate: true,
    });
    console.log(`✅ Initialized custom license for tenant ${tenantId}: ${maxUsers} users`);
  }

  // ── Get tenant license info (basic) ───────────────────────────────────
  static async getTenantLicenseInfo(tenantId: string): Promise<LicenseInfo | null> {
    try {
      const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      if (rows.length === 0) return null;
      const t = rows[0];
      return {
        type: t.licenseType || "solo",
        displayName: LICENSE_TIERS.find(lt => lt.name === t.licenseType)?.displayName || "Licence Solo",
        description: LICENSE_TIERS.find(lt => lt.name === t.licenseType)?.description || "",
        minUsers: LICENSE_TIERS.find(lt => lt.name === t.licenseType)?.minUsers || 1,
        maxUsers: LICENSE_TIERS.find(lt => lt.name === t.licenseType)?.maxUsers || 1,
        licensedUsers: t.licensedUsers || 1,
      };
    } catch { return null; }
  }
}
