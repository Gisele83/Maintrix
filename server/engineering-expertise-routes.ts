/**
 * Engineering Expertise Routes
 * Consolide l'accès aux briques d'ingénierie déjà réelles mais dispersées :
 * Expert Rules (diagnostic-rules-engine.ts), RCA (5 Why/Fishbone/Fault Tree),
 * FMEA/AMDEC, RCM. "Ce n'est pas de l'IA. C'est de l'ingénierie."
 * Voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md, section 9.
 */

import type { Express, Request, Response } from "express";
import { pool as sharedPool } from "./db";
import { diagnosticRulesEngine } from "./diagnostic-rules-engine";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";

interface TenantRequest extends Request {
  tenantId?: string;
  user?: any;
}

function requireTenant(req: TenantRequest, res: Response): string | null {
  if (!req.tenantId) {
    res.status(400).json({ error: "Tenant non résolu pour cette requête" });
    return null;
  }
  return req.tenantId;
}

export function registerEngineeringExpertiseRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  // Catalogue des règles expertes déterministes — consultation, pas d'IA générative.
  app.get("/api/engineering-expertise/rules", generalRateLimit, auth, async (_req, res) => {
    try {
      const rules = diagnosticRulesEngine.getAllRules();
      res.json(rules);
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Vue d'ensemble consolidée — agrège des compteurs déjà existants (RCA, FMEA, RCM, Expert Rules)
  // pour donner une entrée unique à la couche, sans dupliquer leur logique respective.
  app.get("/api/engineering-expertise/overview", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const db = sharedPool;
      const [rcaCount, fmeaCount, rcmCount] = await Promise.all([
        db.query(`SELECT COUNT(*)::int AS count FROM rca_analyses WHERE tenant_id = $1`, [tenantId]),
        db.query(`SELECT COUNT(*)::int AS count FROM fmea_analyses WHERE tenant_id = $1`, [tenantId]),
        db.query(`SELECT COUNT(*)::int AS count FROM rcm_analyses WHERE tenant_id = $1`, [tenantId]).catch(() => ({ rows: [{ count: 0 }] })),
      ]);

      res.json({
        expertRules: { count: diagnosticRulesEngine.getAllRules().length, description: "Règles déterministes (moteur de règles), consultées par le pipeline diagnostic" },
        rca: { count: rcaCount.rows[0]?.count ?? 0, methodologies: ["5_whys", "fishbone", "fmea", "fault_tree"] },
        fmea: { count: fmeaCount.rows[0]?.count ?? 0, description: "AMDEC — criticité RPN = Sévérité × Occurrence × Détectabilité" },
        rcm: { count: rcmCount.rows[0]?.count ?? 0, description: "Reliability Centered Maintenance — arbre de décision de stratégie de maintenance" },
      });
    } catch (e: any) {
      console.error("Engineering expertise overview error:", e.message);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });
}
