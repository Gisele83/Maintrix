/**
 * Root Cause Analysis (RCA) Routes
 * Analyse des causes racines structurée
 * Méthodologies: 5 Pourquoi, Ishikawa (Fishbone), FMEA
 */

import type { Express } from "express";
import { Pool } from "pg";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";
import { z } from "zod";

// Pool direct pour tables non-Drizzle
let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    const connStr = (global as any).__localDbUrl ||
      process.env.DATABASE_URL ||
      "postgresql://runner@localhost:5433/maintrix?host=/tmp";
    pool = new Pool({ connectionString: connStr });
  }
  return pool;
}

function generateRcaNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `RCA-${year}-${rand}`;
}

const CreateRcaSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  methodology: z.enum(["5_whys", "fishbone", "fmea", "fault_tree"]).default("5_whys"),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  failureDate: z.string().optional(),
  detectionDate: z.string().optional(),
  equipmentId: z.number().optional(),
  workOrderId: z.number().optional(),
  failureMode: z.string().optional(),
  estimatedLoss: z.number().optional(),
  currency: z.string().default("EUR"),
});

const UpdateRcaSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  severity: z.string().optional(),
  failureMode: z.string().optional(),
  immediateCause: z.string().optional(),
  rootCause: z.string().optional(),
  contributingFactors: z.array(z.string()).optional(),
  whyChain: z.array(z.object({ why: z.string(), answer: z.string() })).optional(),
  fishbone: z.object({
    manpower: z.array(z.string()),
    machine: z.array(z.string()),
    material: z.array(z.string()),
    method: z.array(z.string()),
    environment: z.array(z.string()),
    measurement: z.array(z.string()),
  }).optional(),
  actionPlans: z.array(z.object({
    id: z.string().optional(),
    action: z.string(),
    responsible: z.string().optional(),
    dueDate: z.string().optional(),
    status: z.enum(["pending", "in_progress", "done"]).default("pending"),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
  })).optional(),
  lessonsLearned: z.string().optional(),
  preventiveMeasures: z.string().optional(),
  recurrenceRisk: z.string().optional(),
  estimatedLoss: z.number().optional(),
  status: z.enum(["open", "in_progress", "closed", "verified"]).optional(),
});

export function registerRcaRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  // ── GET /api/rca ─────────────────────────────────────────────────────────
  app.get("/api/rca", generalRateLimit, auth, async (req, res) => {
    try {
      const db = getPool();
      const { status, severity, methodology } = req.query;
      let sql = `SELECT r.*, 
        eq.equipment_name AS equipment_name,
        eq.location AS equipment_location
        FROM rca_analyses r
        LEFT JOIN equipment_registry eq ON eq.id = r.equipment_id
        WHERE 1=1`;
      const params: any[] = [];
      let idx = 1;
      if (status) { sql += ` AND r.status = $${idx++}`; params.push(status); }
      if (severity) { sql += ` AND r.severity = $${idx++}`; params.push(severity); }
      if (methodology) { sql += ` AND r.methodology = $${idx++}`; params.push(methodology); }
      sql += ` ORDER BY r.created_at DESC`;
      const { rows } = await db.query(sql, params);
      const parsed = rows.map(r => ({
        ...r,
        contributingFactors: safeJson(r.contributing_factors, []),
        whyChain: safeJson(r.why_chain, []),
        fishbone: safeJson(r.fishbone, defaultFishbone()),
        actionPlans: safeJson(r.action_plans, []),
      }));
      res.json(parsed);
    } catch (e: any) {
      console.error("RCA list error:", e.message);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── GET /api/rca/stats ────────────────────────────────────────────────────
  app.get("/api/rca/stats", generalRateLimit, auth, async (req, res) => {
    try {
      const db = getPool();
      const { rows } = await db.query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'open')::int AS open,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE status = 'closed' OR status = 'verified')::int AS closed,
        COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
        COUNT(*) FILTER (WHERE severity = 'high')::int AS high,
        COUNT(*) FILTER (WHERE recurrence_risk = 'high' OR recurrence_risk = 'critical')::int AS high_recurrence,
        COALESCE(SUM(estimated_loss), 0) AS total_loss
        FROM rca_analyses`);
      const byMethodology = await db.query(`SELECT methodology, COUNT(*)::int AS count FROM rca_analyses GROUP BY methodology`);
      res.json({
        ...rows[0],
        byMethodology: Object.fromEntries(byMethodology.rows.map(r => [r.methodology, r.count])),
      });
    } catch (e: any) {
      res.status(500).json({ error: "Erreur stats" });
    }
  });

  // ── GET /api/rca/:id ──────────────────────────────────────────────────────
  app.get("/api/rca/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const db = getPool();
      const { rows } = await db.query(`
        SELECT r.*, eq.equipment_name AS equipment_name, eq.location AS equipment_location
        FROM rca_analyses r
        LEFT JOIN equipment_registry eq ON eq.id = r.equipment_id
        WHERE r.id = $1`, [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: "RCA introuvable" });
      const r = rows[0];
      res.json({
        ...r,
        contributingFactors: safeJson(r.contributing_factors, []),
        whyChain: safeJson(r.why_chain, []),
        fishbone: safeJson(r.fishbone, defaultFishbone()),
        actionPlans: safeJson(r.action_plans, []),
      });
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── POST /api/rca ─────────────────────────────────────────────────────────
  app.post("/api/rca", generalRateLimit, auth, async (req, res) => {
    try {
      const body = CreateRcaSchema.parse(req.body);
      const db = getPool();
      const rcaNumber = generateRcaNumber();
      const whyChain = body.methodology === "5_whys"
        ? [1,2,3,4,5].map(i => ({ why: `Pourquoi ${i} ?`, answer: "" })) : [];
      const { rows } = await db.query(`
        INSERT INTO rca_analyses
          (rca_number, title, description, methodology, severity, failure_date, detection_date,
           equipment_id, work_order_id, failure_mode, estimated_loss, currency,
           why_chain, fishbone, contributing_factors, action_plans)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *`,
        [
          rcaNumber, body.title, body.description || null, body.methodology,
          body.severity, body.failureDate || null, body.detectionDate || null,
          body.equipmentId || null, body.workOrderId || null,
          body.failureMode || null, body.estimatedLoss || null, body.currency,
          JSON.stringify(whyChain), JSON.stringify(defaultFishbone()),
          JSON.stringify([]), JSON.stringify([]),
        ]
      );
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      console.error("RCA create error:", e.message);
      res.status(500).json({ error: "Erreur création" });
    }
  });

  // ── PATCH /api/rca/:id ────────────────────────────────────────────────────
  app.patch("/api/rca/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const body = UpdateRcaSchema.parse(req.body);
      const db = getPool();
      const sets: string[] = [];
      const params: any[] = [];
      let idx = 1;

      const add = (col: string, val: any) => { sets.push(`${col} = $${idx++}`); params.push(val); };

      if (body.title !== undefined) add("title", body.title);
      if (body.description !== undefined) add("description", body.description);
      if (body.severity !== undefined) add("severity", body.severity);
      if (body.failureMode !== undefined) add("failure_mode", body.failureMode);
      if (body.immediateCause !== undefined) add("immediate_cause", body.immediateCause);
      if (body.rootCause !== undefined) add("root_cause", body.rootCause);
      if (body.lessonsLearned !== undefined) add("lessons_learned", body.lessonsLearned);
      if (body.preventiveMeasures !== undefined) add("preventive_measures", body.preventiveMeasures);
      if (body.recurrenceRisk !== undefined) add("recurrence_risk", body.recurrenceRisk);
      if (body.estimatedLoss !== undefined) add("estimated_loss", body.estimatedLoss);
      if (body.contributingFactors !== undefined) add("contributing_factors", JSON.stringify(body.contributingFactors));
      if (body.whyChain !== undefined) add("why_chain", JSON.stringify(body.whyChain));
      if (body.fishbone !== undefined) add("fishbone", JSON.stringify(body.fishbone));
      if (body.actionPlans !== undefined) add("action_plans", JSON.stringify(body.actionPlans));
      if (body.status !== undefined) {
        add("status", body.status);
        if (body.status === "closed" || body.status === "verified") add("closed_at", new Date());
      }
      add("updated_at", new Date());

      if (sets.length === 0) return res.json({ message: "Rien à mettre à jour" });
      params.push(req.params.id);
      const { rows } = await db.query(`UPDATE rca_analyses SET ${sets.join(",")} WHERE id = $${idx} RETURNING *`, params);
      if (!rows[0]) return res.status(404).json({ error: "RCA introuvable" });
      const r = rows[0];
      res.json({
        ...r,
        contributingFactors: safeJson(r.contributing_factors, []),
        whyChain: safeJson(r.why_chain, []),
        fishbone: safeJson(r.fishbone, defaultFishbone()),
        actionPlans: safeJson(r.action_plans, []),
      });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      console.error("RCA update error:", e.message);
      res.status(500).json({ error: "Erreur mise à jour" });
    }
  });

  // ── DELETE /api/rca/:id ───────────────────────────────────────────────────
  app.delete("/api/rca/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const db = getPool();
      const { rowCount } = await db.query("DELETE FROM rca_analyses WHERE id = $1", [req.params.id]);
      if (!rowCount) return res.status(404).json({ error: "RCA introuvable" });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Erreur suppression" });
    }
  });

  console.log("🔍 RCA (Root Cause Analysis) routes registered");
}

function safeJson(val: any, fallback: any) {
  if (!val) return fallback;
  if (typeof val === "object") return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function defaultFishbone() {
  return { manpower: [], machine: [], material: [], method: [], environment: [], measurement: [] };
}
