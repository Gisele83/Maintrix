import type { Request, Response } from "express";

/**
 * Le locataire de la requête, ou un refus net.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CETTE FONCTION EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Une cinquantaine de routes déterminaient le locataire ainsi :
 *
 *     const tenantId = (req as any).tenantId || 'default-tenant';
 *     const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] || 'default-tenant';
 *
 * Deux défauts, du plus grave au moins visible :
 *
 * 1. **L'en-tête `x-tenant-id` était cru sur parole.** Il vient du client :
 *    n'importe qui pouvait désigner le locataire dont il voulait lire — ou
 *    modifier — les données. Le cloisonnement entre entreprises reposait donc
 *    sur la bonne volonté de l'appelant.
 *
 * 2. **Le repli silencieux sur `default-tenant`.** Une requête sans contexte de
 *    session ne provoquait aucune erreur : elle lisait et écrivait dans un
 *    locataire commun. Les données de plusieurs entreprises s'y mélangeaient
 *    sans que rien ne le signale.
 *
 * Le seul locataire digne de confiance est celui que la validation de session a
 * posé sur la requête (`req.tenantId = session.tenant.id`, voir
 * enterprise-auth-middleware.ts). En son absence, on REFUSE — un refus lisible
 * vaut mieux qu'une lecture dans les données d'autrui.
 *
 * Usage :
 *     const tenantId = tenantRequis(req, res);
 *     if (!tenantId) return;
 */
export function tenantRequis(req: Request, res: Response): string | null {
  const tenantId = (req as any).tenantId as string | undefined;

  if (!tenantId) {
    res.status(401).json({
      error: "TENANT_REQUIS",
      message: "Session expirée ou incomplète : reconnectez-vous.",
    });
    return null;
  }

  return tenantId;
}
