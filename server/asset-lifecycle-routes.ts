/**
 * Asset Lifecycle Management Routes
 * Gestion du cycle de vie complet des actifs industriels
 * Stages: procurement → commissioning → operation → maintenance → degradation → decommission → disposal
 */

import type { Express } from "express";
import { Pool } from "pg";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";
import { z } from "zod";

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    const conn = (global as any).__localDbUrl || process.env.DATABASE_URL || "postgresql://runner@localhost:5433/maintrix?host=/tmp";
    pool = new Pool({ connectionString: conn });
  }
  return pool;
}

function genAssetTag() {
  const year = new Date().getFullYear().toString().slice(-2);
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `AST-${year}-${rand}`;
}

function safeJson(v: any, fb: any) {
  if (!v) return fb;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return fb; }
}

function computeCurrentValue(purchaseCost: number, purchaseDate: string | null, usefulLifeYears: number, salvageValue: number, method: string): number {
  if (!purchaseCost || !purchaseDate || !usefulLifeYears) return purchaseCost || 0;
  const ageDays = (Date.now() - new Date(purchaseDate).getTime()) / (1000 * 86400);
  const ageYears = ageDays / 365;
  const depreciable = purchaseCost - salvageValue;
  if (method === "linear") {
    const depreciated = (depreciable / usefulLifeYears) * ageYears;
    return Math.max(salvageValue, purchaseCost - depreciated);
  }
  if (method === "declining") {
    const rate = 2 / usefulLifeYears;
    return Math.max(salvageValue, purchaseCost * Math.pow(1 - rate, ageYears));
  }
  return purchaseCost;
}

const LifecycleEventSchema = z.object({
  id: z.string().optional(),
  date: z.string(),
  type: z.enum(["purchase", "commissioning", "maintenance", "repair", "inspection", "upgrade", "incident", "decommission", "disposal", "other"]),
  description: z.string(),
  cost: z.number().optional(),
  performedBy: z.string().optional(),
});

const CreateAssetSchema = z.object({
  name: z.string().min(2),
  assetTag: z.string().optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  equipmentId: z.number().optional(),
  lifecycleStage: z.enum(["procurement", "commissioning", "operation", "maintenance", "degradation", "decommission", "disposal"]).default("operation"),
  purchaseDate: z.string().optional(),
  commissioningDate: z.string().optional(),
  plannedReplacementDate: z.string().optional(),
  usefulLifeYears: z.number().optional(),
  purchaseCost: z.number().optional(),
  salvageValue: z.number().optional(),
  depreciationMethod: z.enum(["linear", "declining", "units_of_production"]).default("linear"),
  location: z.string().optional(),
  criticality: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  notes: z.string().optional(),
  lifecycleEvents: z.array(LifecycleEventSchema).default([]),
});

const UpdateAssetSchema = CreateAssetSchema.partial().extend({
  conditionScore: z.number().int().min(0).max(100).optional(),
  mtbfHours: z.number().optional(),
  mttrHours: z.number().optional(),
  failureCount: z.number().int().optional(),
  maintenanceCount: z.number().int().optional(),
  totalMaintenanceCost: z.number().optional(),
  totalDowntimeHours: z.number().optional(),
  actualDisposalDate: z.string().optional(),
});

export function registerAssetLifecycleRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  // LIST
  app.get("/api/assets", generalRateLimit, auth, async (req, res) => {
    try {
      const db = getPool();
      const { stage, criticality, category } = req.query;
      let sql = `SELECT a.*, eq.name AS eq_name, eq.location AS eq_loc FROM asset_lifecycle a LEFT JOIN equipment_registry eq ON eq.id = a.equipment_id WHERE 1=1`;
      const params: any[] = [];
      let i = 1;
      if (stage) { sql += ` AND a.lifecycle_stage=$${i++}`; params.push(stage); }
      if (criticality) { sql += ` AND a.criticality=$${i++}`; params.push(criticality); }
      if (category) { sql += ` AND a.category=$${i++}`; params.push(category); }
      sql += ` ORDER BY a.updated_at DESC LIMIT 200`;
      const { rows } = await db.query(sql, params);
      res.json(rows.map(r => ({
        ...r,
        lifecycleEvents: safeJson(r.lifecycle_events, []),
        documents: safeJson(r.documents, []),
        currentValue: r.purchase_cost ? computeCurrentValue(Number(r.purchase_cost), r.purchase_date, Number(r.useful_life_years || 10), Number(r.salvage_value || 0), r.depreciation_method || "linear") : null,
      })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // STATS
  app.get("/api/assets/stats", generalRateLimit, auth, async (req, res) => {
    try {
      const db = getPool();
      const { rows: agg } = await db.query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE lifecycle_stage='operation')::int AS in_operation,
        COUNT(*) FILTER (WHERE lifecycle_stage='decommission')::int AS decommissioned,
        COUNT(*) FILTER (WHERE criticality='critical')::int AS critical_count,
        COUNT(*) FILTER (WHERE condition_score < 50)::int AS poor_condition,
        COALESCE(SUM(purchase_cost),0) AS total_asset_value,
        COALESCE(SUM(total_maintenance_cost),0) AS total_maint_cost,
        COALESCE(AVG(condition_score),0) AS avg_condition,
        COALESCE(AVG(mtbf_hours) FILTER (WHERE mtbf_hours IS NOT NULL), 0) AS avg_mtbf,
        COALESCE(AVG(mttr_hours) FILTER (WHERE mttr_hours IS NOT NULL), 0) AS avg_mttr
        FROM asset_lifecycle`);
      const { rows: byStage } = await db.query(`SELECT lifecycle_stage, COUNT(*)::int AS count FROM asset_lifecycle GROUP BY lifecycle_stage ORDER BY count DESC`);
      const { rows: byCat } = await db.query(`SELECT category, COUNT(*)::int AS count FROM asset_lifecycle WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 10`);

      // Compute total current value (depreciated)
      const { rows: valueRows } = await db.query(`SELECT purchase_cost, purchase_date, useful_life_years, salvage_value, depreciation_method FROM asset_lifecycle WHERE purchase_cost IS NOT NULL`);
      const totalCurrentValue = valueRows.reduce((sum, r) => sum + computeCurrentValue(Number(r.purchase_cost), r.purchase_date, Number(r.useful_life_years || 10), Number(r.salvage_value || 0), r.depreciation_method || "linear"), 0);

      res.json({ ...agg[0], byStage, byCat, totalCurrentValue: Math.round(totalCurrentValue) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET ONE
  app.get("/api/assets/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const db = getPool();
      const { rows } = await db.query(`SELECT a.*, eq.name AS eq_name FROM asset_lifecycle a LEFT JOIN equipment_registry eq ON eq.id = a.equipment_id WHERE a.id=$1`, [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: "Actif introuvable" });
      const r = rows[0];
      res.json({
        ...r,
        lifecycleEvents: safeJson(r.lifecycle_events, []),
        documents: safeJson(r.documents, []),
        currentValue: r.purchase_cost ? computeCurrentValue(Number(r.purchase_cost), r.purchase_date, Number(r.useful_life_years || 10), Number(r.salvage_value || 0), r.depreciation_method || "linear") : null,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // CREATE
  app.post("/api/assets", generalRateLimit, auth, async (req, res) => {
    try {
      const body = CreateAssetSchema.parse(req.body);
      const db = getPool();
      const tag = body.assetTag || genAssetTag();
      const events = (body.lifecycleEvents || []).map((e, i) => ({ ...e, id: e.id || `evt-${i}` }));
      const { rows } = await db.query(
        `INSERT INTO asset_lifecycle (asset_tag, name, category, manufacturer, model, serial_number, equipment_id,
          lifecycle_stage, purchase_date, commissioning_date, planned_replacement_date, useful_life_years,
          purchase_cost, salvage_value, depreciation_method, location, criticality, notes, lifecycle_events)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
        [tag, body.name, body.category || null, body.manufacturer || null, body.model || null,
         body.serialNumber || null, body.equipmentId || null, body.lifecycleStage,
         body.purchaseDate || null, body.commissioningDate || null, body.plannedReplacementDate || null,
         body.usefulLifeYears || null, body.purchaseCost || null, body.salvageValue || null,
         body.depreciationMethod, body.location || null, body.criticality, body.notes || null,
         JSON.stringify(events)]
      );
      const r = rows[0];
      res.status(201).json({ ...r, lifecycleEvents: safeJson(r.lifecycle_events, []) });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      if (e.code === "23505") return res.status(409).json({ error: "Tag actif déjà utilisé" });
      res.status(500).json({ error: e.message });
    }
  });

  // UPDATE
  app.patch("/api/assets/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const body = UpdateAssetSchema.parse(req.body);
      const db = getPool();
      const sets: string[] = [];
      const params: any[] = [];
      let i = 1;
      const add = (col: string, v: any) => { sets.push(`${col}=$${i++}`); params.push(v); };
      const map: Record<string, string> = {
        name: "name", category: "category", manufacturer: "manufacturer", model: "model",
        serialNumber: "serial_number", equipmentId: "equipment_id", lifecycleStage: "lifecycle_stage",
        purchaseDate: "purchase_date", commissioningDate: "commissioning_date",
        plannedReplacementDate: "planned_replacement_date", actualDisposalDate: "actual_disposal_date",
        usefulLifeYears: "useful_life_years", purchaseCost: "purchase_cost",
        salvageValue: "salvage_value", depreciationMethod: "depreciation_method",
        location: "location", criticality: "criticality", notes: "notes",
        conditionScore: "condition_score", mtbfHours: "mtbf_hours", mttrHours: "mttr_hours",
        failureCount: "failure_count", maintenanceCount: "maintenance_count",
        totalMaintenanceCost: "total_maintenance_cost", totalDowntimeHours: "total_downtime_hours",
      };
      for (const [jsKey, dbCol] of Object.entries(map)) {
        if ((body as any)[jsKey] !== undefined) add(dbCol, (body as any)[jsKey]);
      }
      if (body.lifecycleEvents !== undefined) {
        const events = body.lifecycleEvents.map((e, j) => ({ ...e, id: e.id || `evt-${j}` }));
        add("lifecycle_events", JSON.stringify(events));
      }
      add("updated_at", new Date());
      if (!sets.length) return res.json({ message: "Rien à mettre à jour" });
      params.push(req.params.id);
      const { rows } = await db.query(`UPDATE asset_lifecycle SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, params);
      if (!rows[0]) return res.status(404).json({ error: "Actif introuvable" });
      const r = rows[0];
      res.json({
        ...r,
        lifecycleEvents: safeJson(r.lifecycle_events, []),
        currentValue: r.purchase_cost ? computeCurrentValue(Number(r.purchase_cost), r.purchase_date, Number(r.useful_life_years || 10), Number(r.salvage_value || 0), r.depreciation_method || "linear") : null,
      });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // ADD LIFECYCLE EVENT
  app.post("/api/assets/:id/events", generalRateLimit, auth, async (req, res) => {
    try {
      const event = LifecycleEventSchema.parse(req.body);
      const db = getPool();
      const { rows } = await db.query("SELECT lifecycle_events FROM asset_lifecycle WHERE id=$1", [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: "Actif introuvable" });
      const events = safeJson(rows[0].lifecycle_events, []);
      const newEvent = { ...event, id: event.id || `evt-${Date.now()}` };
      events.push(newEvent);
      // Update maintenance cost & count if applicable
      const costUpdate = (event.type === "maintenance" || event.type === "repair") && event.cost
        ? `, total_maintenance_cost = COALESCE(total_maintenance_cost,0) + ${Number(event.cost)}, maintenance_count = COALESCE(maintenance_count,0) + 1`
        : event.type === "maintenance" || event.type === "repair"
        ? `, maintenance_count = COALESCE(maintenance_count,0) + 1` : "";
      const failureUpdate = event.type === "incident" ? `, failure_count = COALESCE(failure_count,0) + 1` : "";
      const { rows: updated } = await db.query(
        `UPDATE asset_lifecycle SET lifecycle_events=$1, updated_at=NOW()${costUpdate}${failureUpdate} WHERE id=$2 RETURNING *`,
        [JSON.stringify(events), req.params.id]
      );
      res.json({ ...updated[0], lifecycleEvents: events });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE
  app.delete("/api/assets/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const { rowCount } = await getPool().query("DELETE FROM asset_lifecycle WHERE id=$1", [req.params.id]);
      if (!rowCount) return res.status(404).json({ error: "Actif introuvable" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log("🏭 Asset Lifecycle Management routes registered");
}
