/**
 * OEE (Overall Equipment Effectiveness) Routes
 * Calcul Disponibilité × Performance × Qualité
 * OEE = A × P × Q
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { pool as sharedPool } from "./db";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";
import { z } from "zod";

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

// Traduit une ligne SQL (colonnes snake_case) vers la forme JSON attendue côté client (camelCase) — même
// convention que server/supplier-routes.ts. oee.tsx lit exclusivement des clés camelCase (recordDate,
// equipmentName, avgOee, etc.) ; sans cette traduction chaque valeur arrive `undefined` côté frontend.
function toApiShape(r: any) {
  return {
    id: r.id,
    equipmentId: r.equipment_id,
    equipmentName: r.equipment_name || r.eq_name || null,
    equipmentLocation: r.eq_location ?? undefined,
    recordDate: r.record_date,
    shift: r.shift,
    plannedTime: Number(r.planned_time),
    downtime: Number(r.downtime),
    speedLoss: Number(r.speed_loss),
    plannedProduction: r.planned_production,
    actualProduction: r.actual_production,
    defectiveUnits: r.defective_units,
    availability: Number(r.availability),
    performance: Number(r.performance),
    quality: Number(r.quality),
    oee: Number(r.oee),
    notes: r.notes,
    createdAt: r.created_at,
  };
}

function toStatsShape(agg: any, byEquip: any[], trend: any[]) {
  return {
    totalRecords: agg.total_records ?? 0,
    avgOee: Number(agg.avg_oee ?? 0),
    avgAvailability: Number(agg.avg_availability ?? 0),
    avgPerformance: Number(agg.avg_performance ?? 0),
    avgQuality: Number(agg.avg_quality ?? 0),
    worldClassCount: agg.world_class_count ?? 0,
    criticalCount: agg.critical_count ?? 0,
    totalProduction: Number(agg.total_production ?? 0),
    totalDefects: Number(agg.total_defects ?? 0),
    totalDowntime: Number(agg.total_downtime ?? 0),
    byEquipment: byEquip.map(e => ({
      equipmentId: e.equipment_id,
      equipmentName: e.equipment_name,
      avgOee: Number(e.avg_oee ?? 0),
      avgAvailability: Number(e.avg_availability ?? 0),
      avgPerformance: Number(e.avg_performance ?? 0),
      avgQuality: Number(e.avg_quality ?? 0),
      recordCount: e.record_count,
    })),
    trend: trend.map(t => ({ recordDate: t.record_date, avgOee: Number(t.avg_oee ?? 0) })),
  };
}

function computeOEE(planned: number, downtime: number, speedLoss: number, actualProd: number, plannedProd: number, defects: number) {
  const operatingTime = planned - downtime;
  const availability = planned > 0 ? operatingTime / planned : 0;
  const performance = (operatingTime - speedLoss) > 0 && plannedProd > 0
    ? Math.min(actualProd / (plannedProd * (operatingTime / planned)), 1)
    : (actualProd > 0 && plannedProd > 0 ? Math.min(actualProd / plannedProd, 1) : 0);
  const quality = actualProd > 0 ? Math.max((actualProd - defects) / actualProd, 0) : 1;
  const oee = availability * performance * quality;
  return {
    availability: Math.round(availability * 10000) / 10000,
    performance: Math.round(performance * 10000) / 10000,
    quality: Math.round(quality * 10000) / 10000,
    oee: Math.round(oee * 10000) / 10000,
  };
}

const CreateOeeSchema = z.object({
  equipmentId: z.number(),
  equipmentName: z.string().optional(),
  recordDate: z.string(),
  shift: z.enum(["day", "evening", "night", "all"]).default("day"),
  plannedTime: z.number().min(0).default(480),
  downtime: z.number().min(0).default(0),
  speedLoss: z.number().min(0).default(0),
  plannedProduction: z.number().int().min(0).default(0),
  actualProduction: z.number().int().min(0).default(0),
  defectiveUnits: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

export function registerOeeRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  // ── GET /api/oee ──────────────────────────────────────────────────────────
  app.get("/api/oee", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const db = getPool();
      const { equipmentId, from, to, shift } = req.query;
      let sql = `SELECT o.*, eq.equipment_name AS eq_name, eq.location AS eq_location
        FROM oee_records o
        LEFT JOIN equipment_registry eq ON eq.id = o.equipment_id
        WHERE o.tenant_id = $1`;
      const params: any[] = [tenantId];
      let idx = 2;
      if (equipmentId) { sql += ` AND o.equipment_id = $${idx++}`; params.push(equipmentId); }
      if (from) { sql += ` AND o.record_date >= $${idx++}`; params.push(from); }
      if (to) { sql += ` AND o.record_date <= $${idx++}`; params.push(to); }
      if (shift) { sql += ` AND o.shift = $${idx++}`; params.push(shift); }
      sql += ` ORDER BY o.record_date DESC, o.created_at DESC LIMIT 500`;
      const { rows } = await db.query(sql, params);
      res.json(rows.map(toApiShape));
    } catch (e: any) {
      console.error("OEE list error:", e.message);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── GET /api/oee/stats ────────────────────────────────────────────────────
  app.get("/api/oee/stats", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { from, to } = req.query;
      let dateFilter = "";
      const params: any[] = [tenantId];
      if (from) { dateFilter += ` AND record_date >= $${params.length + 1}`; params.push(from); }
      if (to) { dateFilter += ` AND record_date <= $${params.length + 1}`; params.push(to); }

      const [agg, byEquip, trend] = await Promise.all([
        getPool().query(`SELECT
          COUNT(*)::int AS total_records,
          ROUND(AVG(oee)::numeric, 4) AS avg_oee,
          ROUND(AVG(availability)::numeric, 4) AS avg_availability,
          ROUND(AVG(performance)::numeric, 4) AS avg_performance,
          ROUND(AVG(quality)::numeric, 4) AS avg_quality,
          COUNT(*) FILTER (WHERE oee >= 0.85)::int AS world_class_count,
          COUNT(*) FILTER (WHERE oee < 0.65)::int AS critical_count,
          SUM(actual_production)::bigint AS total_production,
          SUM(defective_units)::bigint AS total_defects,
          SUM(downtime)::numeric AS total_downtime
          FROM oee_records WHERE tenant_id = $1 ${dateFilter}`, params),
        getPool().query(`SELECT equipment_id, equipment_name,
          ROUND(AVG(oee)::numeric, 4) AS avg_oee,
          ROUND(AVG(availability)::numeric, 4) AS avg_availability,
          ROUND(AVG(performance)::numeric, 4) AS avg_performance,
          ROUND(AVG(quality)::numeric, 4) AS avg_quality,
          COUNT(*)::int AS record_count
          FROM oee_records WHERE tenant_id = $1 ${dateFilter}
          GROUP BY equipment_id, equipment_name ORDER BY avg_oee ASC LIMIT 20`, params),
        getPool().query(`SELECT record_date::text, ROUND(AVG(oee)::numeric, 4) AS avg_oee
          FROM oee_records WHERE tenant_id = $1 ${dateFilter}
          GROUP BY record_date ORDER BY record_date DESC LIMIT 30`, params),
      ]);

      res.json(toStatsShape(agg.rows[0], byEquip.rows, trend.rows.reverse()));
    } catch (e: any) {
      console.error("OEE stats error:", e.message);
      res.status(500).json({ error: "Erreur stats" });
    }
  });

  // ── GET /api/oee/equipment/:id ────────────────────────────────────────────
  app.get("/api/oee/equipment/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { rows } = await getPool().query(`
        SELECT * FROM oee_records WHERE equipment_id = $1 AND tenant_id = $2
        ORDER BY record_date DESC LIMIT 90`, [req.params.id, tenantId]);
      res.json(rows.map(toApiShape));
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── POST /api/oee ─────────────────────────────────────────────────────────
  app.post("/api/oee", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = CreateOeeSchema.parse(req.body);
      const { availability, performance, quality, oee } = computeOEE(
        body.plannedTime, body.downtime, body.speedLoss,
        body.actualProduction, body.plannedProduction, body.defectiveUnits
      );
      const db = getPool();
      const { rows } = await db.query(`
        INSERT INTO oee_records
          (tenant_id, equipment_id, equipment_name, record_date, shift, planned_time, downtime, speed_loss,
           planned_production, actual_production, defective_units,
           availability, performance, quality, oee, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *`,
        [
          tenantId, body.equipmentId, body.equipmentName || null,
          body.recordDate, body.shift,
          body.plannedTime, body.downtime, body.speedLoss,
          body.plannedProduction, body.actualProduction, body.defectiveUnits,
          availability, performance, quality, oee,
          body.notes || null,
        ]
      );
      res.status(201).json(toApiShape(rows[0]));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      console.error("OEE create error:", e.message);
      res.status(500).json({ error: "Erreur création" });
    }
  });

  // ── DELETE /api/oee/:id ───────────────────────────────────────────────────
  app.delete("/api/oee/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { rowCount } = await getPool().query("DELETE FROM oee_records WHERE id = $1 AND tenant_id = $2", [req.params.id, tenantId]);
      if (!rowCount) return res.status(404).json({ error: "Enregistrement introuvable" });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Erreur suppression" });
    }
  });

  // ── GET /api/oee/calculate (simulation sans persistence) ──────────────────
  app.post("/api/oee/calculate", generalRateLimit, auth, (req, res) => {
    try {
      const { plannedTime = 480, downtime = 0, speedLoss = 0, plannedProduction = 100, actualProduction = 0, defectiveUnits = 0 } = req.body;
      const result = computeOEE(Number(plannedTime), Number(downtime), Number(speedLoss), Number(actualProduction), Number(plannedProduction), Number(defectiveUnits));
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: "Paramètres invalides" });
    }
  });

  console.log("📊 OEE routes registered");
}
