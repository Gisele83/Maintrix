/**
 * Asset Lifecycle Management Routes
 * Gestion du cycle de vie complet des actifs industriels
 * Stages: procurement → commissioning → operation → maintenance → degradation → decommission → disposal
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { pool as sharedPool } from "./db";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";
import { z } from "zod";
import { estViolationUnicite } from "./db-errors";

function getPool(): Pool {
  return sharedPool;
}

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

// Traduit une ligne SQL (colonnes snake_case) vers la forme JSON attendue côté client (camelCase) — même
// convention que server/oee-routes.ts / server/budget-routes.ts. asset-lifecycle.tsx lit exclusivement des
// clés camelCase (assetTag, lifecycleStage, purchaseCost...) ; sans traduction chaque valeur arrive `undefined`.
function toApiShape(r: any) {
  return {
    id: r.id,
    assetTag: r.asset_tag,
    name: r.name,
    category: r.category,
    manufacturer: r.manufacturer,
    model: r.model,
    serialNumber: r.serial_number,
    equipmentId: r.equipment_id,
    equipmentName: r.eq_name ?? undefined,
    equipmentLocation: r.eq_loc ?? undefined,
    lifecycleStage: r.lifecycle_stage,
    purchaseDate: r.purchase_date,
    commissioningDate: r.commissioning_date,
    plannedReplacementDate: r.planned_replacement_date,
    actualDisposalDate: r.actual_disposal_date,
    usefulLifeYears: r.useful_life_years != null ? Number(r.useful_life_years) : undefined,
    purchaseCost: r.purchase_cost != null ? Number(r.purchase_cost) : undefined,
    currentValue: r.purchase_cost
      ? computeCurrentValue(Number(r.purchase_cost), r.purchase_date, Number(r.useful_life_years || 10), Number(r.salvage_value || 0), r.depreciation_method || "linear")
      : null,
    salvageValue: r.salvage_value != null ? Number(r.salvage_value) : undefined,
    depreciationMethod: r.depreciation_method,
    location: r.location,
    criticality: r.criticality,
    notes: r.notes,
    lifecycleEvents: safeJson(r.lifecycle_events, []),
    documents: safeJson(r.documents, []),
    conditionScore: r.condition_score,
    mtbfHours: r.mtbf_hours != null ? Number(r.mtbf_hours) : undefined,
    mttrHours: r.mttr_hours != null ? Number(r.mttr_hours) : undefined,
    failureCount: r.failure_count,
    maintenanceCount: r.maintenance_count,
    totalMaintenanceCost: r.total_maintenance_cost != null ? Number(r.total_maintenance_cost) : undefined,
    totalDowntimeHours: r.total_downtime_hours != null ? Number(r.total_downtime_hours) : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
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
  app.get("/api/assets", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const db = getPool();
      const { stage, criticality, category } = req.query;
      let sql = `SELECT a.*, eq.equipment_name AS eq_name, eq.location AS eq_loc FROM asset_lifecycle a LEFT JOIN equipment_registry eq ON eq.id = a.equipment_id WHERE a.tenant_id=$1`;
      const params: any[] = [tenantId];
      let i = 2;
      if (stage) { sql += ` AND a.lifecycle_stage=$${i++}`; params.push(stage); }
      if (criticality) { sql += ` AND a.criticality=$${i++}`; params.push(criticality); }
      if (category) { sql += ` AND a.category=$${i++}`; params.push(category); }
      sql += ` ORDER BY a.updated_at DESC LIMIT 200`;
      const { rows } = await db.query(sql, params);
      res.json(rows.map(toApiShape));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // STATS
  app.get("/api/assets/stats", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
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
        FROM asset_lifecycle WHERE tenant_id=$1`, [tenantId]);
      const { rows: byStage } = await db.query(`SELECT lifecycle_stage, COUNT(*)::int AS count FROM asset_lifecycle WHERE tenant_id=$1 GROUP BY lifecycle_stage ORDER BY count DESC`, [tenantId]);
      const { rows: byCat } = await db.query(`SELECT category, COUNT(*)::int AS count FROM asset_lifecycle WHERE tenant_id=$1 AND category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 10`, [tenantId]);

      // Compute total current value (depreciated)
      const { rows: valueRows } = await db.query(`SELECT purchase_cost, purchase_date, useful_life_years, salvage_value, depreciation_method FROM asset_lifecycle WHERE tenant_id=$1 AND purchase_cost IS NOT NULL`, [tenantId]);
      const totalCurrentValue = valueRows.reduce((sum, r) => sum + computeCurrentValue(Number(r.purchase_cost), r.purchase_date, Number(r.useful_life_years || 10), Number(r.salvage_value || 0), r.depreciation_method || "linear"), 0);

      res.json({
        total: agg[0].total,
        inOperation: agg[0].in_operation,
        decommissioned: agg[0].decommissioned,
        criticalCount: agg[0].critical_count,
        poorCondition: agg[0].poor_condition,
        totalAssetValue: Number(agg[0].total_asset_value || 0),
        totalMaintCost: Number(agg[0].total_maint_cost || 0),
        avgCondition: Number(agg[0].avg_condition || 0),
        avgMtbf: Number(agg[0].avg_mtbf || 0),
        avgMttr: Number(agg[0].avg_mttr || 0),
        byStage: byStage.map(s => ({ lifecycleStage: s.lifecycle_stage, count: s.count })),
        byCat,
        totalCurrentValue: Math.round(totalCurrentValue),
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET ONE
  app.get("/api/assets/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const db = getPool();
      const { rows } = await db.query(`SELECT a.*, eq.equipment_name AS eq_name FROM asset_lifecycle a LEFT JOIN equipment_registry eq ON eq.id = a.equipment_id WHERE a.id=$1 AND a.tenant_id=$2`, [req.params.id, tenantId]);
      if (!rows[0]) return res.status(404).json({ error: "Actif introuvable" });
      res.json(toApiShape(rows[0]));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // CREATE
  app.post("/api/assets", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = CreateAssetSchema.parse(req.body);
      const db = getPool();
      const tag = body.assetTag || genAssetTag();
      const events = (body.lifecycleEvents || []).map((e, i) => ({ ...e, id: e.id || `evt-${i}` }));
      const { rows } = await db.query(
        `INSERT INTO asset_lifecycle (tenant_id, asset_tag, name, category, manufacturer, model, serial_number, equipment_id,
          lifecycle_stage, purchase_date, commissioning_date, planned_replacement_date, useful_life_years,
          purchase_cost, salvage_value, depreciation_method, location, criticality, notes, lifecycle_events)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
        [tenantId, tag, body.name, body.category || null, body.manufacturer || null, body.model || null,
         body.serialNumber || null, body.equipmentId || null, body.lifecycleStage,
         body.purchaseDate || null, body.commissioningDate || null, body.plannedReplacementDate || null,
         body.usefulLifeYears || null, body.purchaseCost || null, body.salvageValue || null,
         body.depreciationMethod, body.location || null, body.criticality, body.notes || null,
         JSON.stringify(events)]
      );
      res.status(201).json(toApiShape(rows[0]));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      if (estViolationUnicite(e)) return res.status(409).json({ error: "Tag actif déjà utilisé" });
      res.status(500).json({ error: e.message });
    }
  });

  // UPDATE
  app.patch("/api/assets/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
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
      params.push(req.params.id, tenantId);
      const { rows } = await db.query(`UPDATE asset_lifecycle SET ${sets.join(",")} WHERE id=$${i++} AND tenant_id=$${i} RETURNING *`, params);
      if (!rows[0]) return res.status(404).json({ error: "Actif introuvable" });
      res.json(toApiShape(rows[0]));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // ADD LIFECYCLE EVENT
  app.post("/api/assets/:id/events", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const event = LifecycleEventSchema.parse(req.body);
      const db = getPool();
      const { rows } = await db.query("SELECT lifecycle_events FROM asset_lifecycle WHERE id=$1 AND tenant_id=$2", [req.params.id, tenantId]);
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
        `UPDATE asset_lifecycle SET lifecycle_events=$1, updated_at=NOW()${costUpdate}${failureUpdate} WHERE id=$2 AND tenant_id=$3 RETURNING *`,
        [JSON.stringify(events), req.params.id, tenantId]
      );
      res.json(toApiShape(updated[0]));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE
  app.delete("/api/assets/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { rowCount } = await getPool().query("DELETE FROM asset_lifecycle WHERE id=$1 AND tenant_id=$2", [req.params.id, tenantId]);
      if (!rowCount) return res.status(404).json({ error: "Actif introuvable" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log("🏭 Asset Lifecycle Management routes registered");
}
