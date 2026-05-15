/**
 * License Enforcement Middleware
 * Bloque les appels API si la licence est expirée ou si l'essai est terminé.
 * S'applique à tous les endpoints /api sauf auth, health, payments, et activation.
 */

import type { Request, Response, NextFunction } from "express";
import { LicenseService } from "./license-service";

/** Routes exemptées de la vérification de licence */
const EXEMPT_PATHS = new Set([
  "/api/enterprise-auth/login",
  "/api/enterprise-auth/logout",
  "/api/enterprise-auth/register",
  "/api/enterprise-auth/profile",
  "/api/enterprise-auth/csrf-token",
  "/api/enterprise-auth/mfa",
  "/api/health",
  "/api/license/status",
  "/api/license/activate",
  "/api/license/grace",
  "/api/trial/status",
  "/api/trial/start",
  "/api/payments",
  "/api/paypal",
  "/api/webhooks",
  "/api/system/health",
  "/api-docs",
]);

/** Préfixes exemptés (wildcards) */
const EXEMPT_PREFIXES = [
  "/api/enterprise-auth/",
  "/api/payments/",
  "/api/paypal/",
  "/api/webhooks/",
  "/api/super-admin/",
  "/api-docs",
];

function isExempt(path: string): boolean {
  if (EXEMPT_PATHS.has(path)) return true;
  return EXEMPT_PREFIXES.some(prefix => path.startsWith(prefix));
}

export async function licenseEnforcementMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const path = req.path;

  // Exempt certain routes
  if (isExempt(path)) { next(); return; }

  // Only apply to authenticated sessions
  const user = (req as any).user;
  if (!user) { next(); return; }

  const tenantId = user.tenantId || "default-tenant";

  try {
    const status = await LicenseService.getLicenseStatus(tenantId);

    if (!status) { next(); return; }

    // Allow operations during trial, active, or grace period
    if (status.canOperate) {
      // Attach license info to request for downstream use
      (req as any).licenseStatus = status;

      // Add warning header if trial is running low
      if (status.isTrialActive && status.trialDaysRemaining <= 3) {
        res.setHeader(
          "X-Trial-Warning",
          `Votre essai gratuit expire dans ${status.trialDaysRemaining} jour(s).`
        );
      }
      if (status.isGracePeriodActive) {
        res.setHeader(
          "X-License-Warning",
          `Période de grâce: ${status.gracePeriodDaysRemaining} jour(s) restant(s). Renouvelez votre abonnement.`
        );
      }

      next();
      return;
    }

    // License expired — block and return structured error
    const message = buildBlockMessage(status);
    res.status(402).json({
      error: "LICENSE_EXPIRED",
      code: "PAYMENT_REQUIRED",
      message,
      status: status.status,
      plan: status.plan,
      upgradeUrl: "/subscription",
      contactUrl: "https://maintrix.io/contact",
    });
  } catch (err) {
    // On error, allow access but log — don't block production unexpectedly
    console.error("[LicenseEnforcement] Error checking license:", err);
    next();
  }
}

function buildBlockMessage(status: any): string {
  switch (status.status) {
    case "expired":
      return "Votre licence Maintrix a expiré. Veuillez renouveler votre abonnement pour continuer.";
    case "suspended":
      return "Votre compte a été suspendu. Contactez support@maintrix.io.";
    case "grace":
      return `Votre paiement a échoué. Période de grâce de ${status.gracePeriodDaysRemaining} jour(s) expirée. Renouvelez votre abonnement.`;
    default:
      return "Accès restreint. Vérifiez votre licence ou contactez l'administrateur.";
  }
}

/**
 * Feature-level gating — call this inside specific routes
 * to limit features based on plan.
 */
export function requirePlan(minimumPlan: "pro" | "business" | "enterprise") {
  const PLAN_LEVELS: Record<string, number> = {
    free: 0, trial: 1, pro: 2, business: 3, enterprise: 4,
  };
  return (req: Request, res: Response, next: NextFunction) => {
    const licenseStatus = (req as any).licenseStatus;
    if (!licenseStatus) { next(); return; }

    const userLevel = PLAN_LEVELS[licenseStatus.plan] ?? 0;
    const requiredLevel = PLAN_LEVELS[minimumPlan] ?? 0;

    if (licenseStatus.isTrialActive || userLevel >= requiredLevel) {
      next();
    } else {
      res.status(403).json({
        error: "PLAN_REQUIRED",
        message: `Cette fonctionnalité nécessite le plan ${minimumPlan} ou supérieur.`,
        currentPlan: licenseStatus.plan,
        upgradeUrl: "/subscription",
      });
    }
  };
}
