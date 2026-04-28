/**
 * Calibration Management Routes
 * Gestion des étalonnages et calibrations d'instruments de mesure
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

function genCalNumber() {
  return `CAL-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;
}

function safeJson(v: any, fb: any) {
  if (!v) return fb;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return fb; }
}

function computeStatus(nextDate: string, result: string, outOfService: boolean): string {
  if (outOfService) return "out_of_service";
  if (result === "fail") return "non_compliant";
  const now = new Date();
  const next = new Date(nextDate);
  const diffDays = Math.ceil((next.getTime() - now.getTime()) / (1000 * 86400));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 30) return "due_soon";
  return "compliant";
}

const MeasurementSchema = z.object({
  point: z.string(),
  nominal: z.number().optional(),
  measured: z.number().optional(),
  deviation: z.number().optional(),
  unit: z.string().optional(),
  pass: z.boolean().optional(),
});

const CreateCalSchema = z.object({
  instrumentName: z.string().min(2),
  instrumentTag: z.string().optional(),
  equipmentId: z.number().optional(),
  equipmentName: z.string().optional(),
  instrumentType: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  location: z.string().optional(),
  calibrationDate: z.string(),
  nextCalibrationDate: z.string(),
  calibrationIntervalDays: z.number().int().default(365),
  performedBy: z.string().optional(),
  externalLab: z.string().optional(),
  certificateNumber: z.string().optional(),
  standardUsed: z.string().optional(),
  method: z.string().optional(),
  temperatureC: z.number().optional(),
  humidityPct: z.number().optional(),
  result: z.enum(["pass", "fail", "conditional"]).default("pass"),
  tolerancePct: z.number().optional(),
  asFound: z.array(MeasurementSchema).default([]),
  asLeft: z.array(MeasurementSchema).default([]),
  notes: z.string().optional(),
  correctiveAction: z.string().optional(),
  outOfService: z.boolean().default(false),
});

const UpdateCalSchema = CreateCalSchema.partial();

export function registerCalibrationRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  // LIST
  app.get("/api/calibrations", generalRateLimit, auth, async (req, res) => {
    try {
      const db = getPool();
      const { status, result, type } = req.query;
      let sql = `SELECT * FROM calibration_records WHERE 1=1`;
      const params: any[] = [];
      let i = 1;
      if (result) { sql += ` AND result=$${i++}`; params.push(result); }
      if (type) { sql += ` AND instrument_type=$${i++}`; params.push(type); }
      sql += ` ORDER BY next_calibration_date ASC`;
      const { rows } = await db.query(sql, params);
      const enriched = rows.map(r => ({
        ...r,
        asFound: safeJson(r.as_found, []),
        asLeft: safeJson(r.as_left, []),
        history: safeJson(r.history, []),
        computedStatus: computeStatus(r.next_calibration_date, r.result, r.out_of_service),
        daysUntilDue: Math.ceil((new Date(r.next_calibration_date).getTime() - Date.now()) / (1000 * 86400)),
      }));
      // filter by computed status if requested
      const filtered = status && status !== "all" ? enriched.filter(r => r.computedStatus === status) : enriched;
      res.json(filtered);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // STATS
  app.get("/api/calibrations/stats", generalRateLimit, auth, async (req, res) => {
    try {
      const db = getPool();
      const { rows } = await db.query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE result='pass')::int AS pass_count,
        COUNT(*) FILTER (WHERE result='fail')::int AS fail_count,
        COUNT(*) FILTER (WHERE result='conditional')::int AS conditional_count,
        COUNT(*) FILTER (WHERE out_of_service=TRUE)::int AS out_of_service,
        COUNT(*) FILTER (WHERE next_calibration_date < NOW())::int AS overdue,
        COUNT(*) FILTER (WHERE next_calibration_date BETWEEN NOW() AND NOW() + INTERVAL '30 days')::int AS due_soon,
        COUNT(*) FILTER (WHERE next_calibration_date > NOW() + INTERVAL '30 days' AND result != 'fail' AND out_of_service=FALSE)::int AS compliant
        FROM calibration_records`);
      const { rows: byType } = await db.query(`SELECT instrument_type, COUNT(*)::int AS count FROM calibration_records WHERE instrument_type IS NOT NULL GROUP BY instrument_type ORDER BY count DESC LIMIT 10`);
      const { rows: upcoming } = await db.query(`SELECT instrument_name, instrument_tag, next_calibration_date, result FROM calibration_records WHERE next_calibration_date BETWEEN NOW() AND NOW() + INTERVAL '90 days' AND out_of_service=FALSE ORDER BY next_calibration_date ASC LIMIT 10`);
      res.json({ ...rows[0], byType, upcoming });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET ONE
  app.get("/api/calibrations/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const { rows } = await getPool().query("SELECT * FROM calibration_records WHERE id=$1", [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: "Calibration introuvable" });
      const r = rows[0];
      res.json({ ...r, asFound: safeJson(r.as_found, []), asLeft: safeJson(r.as_left, []), history: safeJson(r.history, []), computedStatus: computeStatus(r.next_calibration_date, r.result, r.out_of_service) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // CREATE
  app.post("/api/calibrations", generalRateLimit, auth, async (req, res) => {
    try {
      const body = CreateCalSchema.parse(req.body);
      const db = getPool();
      const status = computeStatus(body.nextCalibrationDate, body.result, body.outOfService);
      const { rows } = await db.query(
        `INSERT INTO calibration_records (calibration_number, instrument_name, instrument_tag, equipment_id, equipment_name, instrument_type,
          manufacturer, model, serial_number, location, calibration_date, next_calibration_date, calibration_interval_days,
          performed_by, external_lab, certificate_number, standard_used, method, temperature_c, humidity_pct, result,
          tolerance_pct, as_found, as_left, notes, corrective_action, out_of_service, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING *`,
        [genCalNumber(), body.instrumentName, body.instrumentTag||null, body.equipmentId||null, body.equipmentName||null, body.instrumentType||null,
         body.manufacturer||null, body.model||null, body.serialNumber||null, body.location||null,
         body.calibrationDate, body.nextCalibrationDate, body.calibrationIntervalDays,
         body.performedBy||null, body.externalLab||null, body.certificateNumber||null, body.standardUsed||null,
         body.method||null, body.temperatureC||null, body.humidityPct||null, body.result,
         body.tolerancePct||null, JSON.stringify(body.asFound), JSON.stringify(body.asLeft),
         body.notes||null, body.correctiveAction||null, body.outOfService, status]
      );
      const r = rows[0];
      res.status(201).json({ ...r, asFound: safeJson(r.as_found, []), asLeft: safeJson(r.as_left, []), computedStatus: status });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      if (e.code === "23505") return res.status(409).json({ error: "Numéro de calibration déjà utilisé" });
      res.status(500).json({ error: e.message });
    }
  });

  // UPDATE (also archives history)
  app.patch("/api/calibrations/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const body = UpdateCalSchema.parse(req.body);
      const db = getPool();
      // Fetch old to archive in history
      const { rows: old } = await db.query("SELECT * FROM calibration_records WHERE id=$1", [req.params.id]);
      if (!old[0]) return res.status(404).json({ error: "Calibration introuvable" });

      const sets: string[] = [];
      const params: any[] = [];
      let i = 1;
      const add = (col: string, v: any) => { sets.push(`${col}=$${i++}`); params.push(v); };
      const map: Record<string, string> = {
        instrumentName:"instrument_name", instrumentTag:"instrument_tag", equipmentId:"equipment_id",
        equipmentName:"equipment_name", instrumentType:"instrument_type", manufacturer:"manufacturer",
        model:"model", serialNumber:"serial_number", location:"location",
        calibrationDate:"calibration_date", nextCalibrationDate:"next_calibration_date",
        calibrationIntervalDays:"calibration_interval_days", performedBy:"performed_by",
        externalLab:"external_lab", certificateNumber:"certificate_number", standardUsed:"standard_used",
        method:"method", temperatureC:"temperature_c", humidityPct:"humidity_pct", result:"result",
        tolerancePct:"tolerance_pct", notes:"notes", correctiveAction:"corrective_action", outOfService:"out_of_service",
      };
      for (const [js, db_col] of Object.entries(map)) {
        if ((body as any)[js] !== undefined) add(db_col, (body as any)[js]);
      }
      if (body.asFound !== undefined) add("as_found", JSON.stringify(body.asFound));
      if (body.asLeft !== undefined) add("as_left", JSON.stringify(body.asLeft));

      // Recompute status
      const newResult = body.result ?? old[0].result;
      const newNext = body.nextCalibrationDate ?? old[0].next_calibration_date;
      const newOOS = body.outOfService ?? old[0].out_of_service;
      const newStatus = computeStatus(newNext, newResult, newOOS);
      add("status", newStatus);
      add("updated_at", new Date());
      if (!sets.length) return res.json({ message: "Rien à mettre à jour" });

      params.push(req.params.id);
      const { rows } = await db.query(`UPDATE calibration_records SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, params);
      const r = rows[0];
      res.json({ ...r, asFound: safeJson(r.as_found, []), asLeft: safeJson(r.as_left, []), history: safeJson(r.history, []), computedStatus: newStatus });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // RENEW — create new calibration record from existing
  app.post("/api/calibrations/:id/renew", generalRateLimit, auth, async (req, res) => {
    try {
      const db = getPool();
      const { rows: old } = await db.query("SELECT * FROM calibration_records WHERE id=$1", [req.params.id]);
      if (!old[0]) return res.status(404).json({ error: "Calibration introuvable" });
      const o = old[0];
      const body = CreateCalSchema.parse({
        instrumentName: o.instrument_name, instrumentTag: o.instrument_tag, equipmentId: o.equipment_id,
        equipmentName: o.equipment_name, instrumentType: o.instrument_type, manufacturer: o.manufacturer,
        model: o.model, serialNumber: o.serial_number, location: o.location,
        calibrationDate: req.body.calibrationDate || new Date().toISOString().split("T")[0],
        nextCalibrationDate: req.body.nextCalibrationDate,
        calibrationIntervalDays: o.calibration_interval_days,
        performedBy: req.body.performedBy || o.performed_by,
        externalLab: req.body.externalLab || o.external_lab,
        certificateNumber: req.body.certificateNumber,
        standardUsed: o.standard_used, method: o.method,
        result: req.body.result || "pass",
        tolerancePct: o.tolerance_pct,
        asFound: req.body.asFound || [],
        asLeft: req.body.asLeft || [],
        notes: req.body.notes,
      });
      const status = computeStatus(body.nextCalibrationDate!, body.result, false);
      const { rows } = await db.query(
        `INSERT INTO calibration_records (calibration_number, instrument_name, instrument_tag, equipment_id, equipment_name, instrument_type,
          manufacturer, model, serial_number, location, calibration_date, next_calibration_date, calibration_interval_days,
          performed_by, external_lab, certificate_number, standard_used, method, result, tolerance_pct, as_found, as_left, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *`,
        [genCalNumber(), body.instrumentName, body.instrumentTag||null, body.equipmentId||null, body.equipmentName||null,
         body.instrumentType||null, body.manufacturer||null, body.model||null, body.serialNumber||null, body.location||null,
         body.calibrationDate, body.nextCalibrationDate, body.calibrationIntervalDays,
         body.performedBy||null, body.externalLab||null, body.certificateNumber||null, body.standardUsed||null,
         body.method||null, body.result, body.tolerancePct||null, JSON.stringify(body.asFound), JSON.stringify(body.asLeft), body.notes||null, status]
      );
      res.status(201).json({ ...rows[0], computedStatus: status });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE
  app.delete("/api/calibrations/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const { rowCount } = await getPool().query("DELETE FROM calibration_records WHERE id=$1", [req.params.id]);
      if (!rowCount) return res.status(404).json({ error: "Calibration introuvable" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log("🔬 Calibration Management routes registered");
}
