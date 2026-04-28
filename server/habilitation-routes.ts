/**
 * Technician Habilitation Management Routes
 * Gestion des habilitations, certifications et compétences des techniciens
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

function genHabNumber() {
  return `HAB-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;
}

function safeJson(v: any, fb: any) {
  if (!v) return fb;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return fb; }
}

function computeStatus(expiryDate: string | null, isPermanent: boolean, alertDays: number): string {
  if (isPermanent) return "valid";
  if (!expiryDate) return "valid";
  const now = Date.now();
  const exp = new Date(expiryDate).getTime();
  const diffDays = Math.ceil((exp - now) / (1000 * 86400));
  if (diffDays < 0) return "expired";
  if (diffDays <= alertDays) return "expiring_soon";
  return "valid";
}

const CreateHabSchema = z.object({
  technicianName: z.string().min(2),
  technicianId: z.number().optional(),
  technicianEmail: z.string().email().optional().or(z.literal("")),
  department: z.string().optional(),
  habilitationType: z.string().min(2),
  category: z.string().optional(),
  level: z.string().optional(),
  title: z.string().min(3),
  issuingBody: z.string().optional(),
  certificateNumber: z.string().optional(),
  issueDate: z.string(),
  expiryDate: z.string().optional(),
  isPermanent: z.boolean().default(false),
  renewalAlertDays: z.number().int().default(60),
  trainingDurationHours: z.number().optional(),
  trainingLocation: z.string().optional(),
  assessor: z.string().optional(),
  scope: z.string().optional(),
  restrictions: z.string().optional(),
});

const UpdateHabSchema = CreateHabSchema.partial();

const RenewalSchema = z.object({
  issueDate: z.string(),
  expiryDate: z.string().optional(),
  certificateNumber: z.string().optional(),
  issuingBody: z.string().optional(),
  assessor: z.string().optional(),
  notes: z.string().optional(),
});

export function registerHabilitationRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  // LIST
  app.get("/api/habilitations", generalRateLimit, auth, async (req, res) => {
    try {
      const db = getPool();
      const { technicianName, type, status, department } = req.query;
      let sql = `SELECT * FROM technician_habilitations WHERE 1=1`;
      const params: any[] = [];
      let i = 1;
      if (technicianName) { sql += ` AND LOWER(technician_name) LIKE $${i++}`; params.push(`%${String(technicianName).toLowerCase()}%`); }
      if (type) { sql += ` AND habilitation_type=$${i++}`; params.push(type); }
      if (department) { sql += ` AND department=$${i++}`; params.push(department); }
      sql += ` ORDER BY technician_name ASC, expiry_date ASC`;
      const { rows } = await db.query(sql, params);
      const enriched = rows.map(r => ({
        ...r,
        documents: safeJson(r.documents, []),
        renewalHistory: safeJson(r.renewal_history, []),
        computedStatus: computeStatus(r.expiry_date, r.is_permanent, r.renewal_alert_days),
        daysUntilExpiry: r.expiry_date ? Math.ceil((new Date(r.expiry_date).getTime() - Date.now()) / (1000 * 86400)) : null,
      }));
      const filtered = status && status !== "all" ? enriched.filter(r => r.computedStatus === status) : enriched;
      res.json(filtered);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // STATS
  app.get("/api/habilitations/stats", generalRateLimit, auth, async (req, res) => {
    try {
      const db = getPool();
      const { rows: s } = await db.query(`SELECT
        COUNT(*)::int AS total,
        COUNT(DISTINCT technician_name)::int AS total_technicians,
        COUNT(*) FILTER (WHERE is_permanent=TRUE)::int AS permanent_count,
        COUNT(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date < NOW())::int AS expired_count,
        COUNT(*) FILTER (WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '60 days')::int AS expiring_60d,
        COUNT(*) FILTER (WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days')::int AS expiring_30d
        FROM technician_habilitations`);
      const { rows: byType } = await db.query(`SELECT habilitation_type, COUNT(*)::int AS count FROM technician_habilitations GROUP BY habilitation_type ORDER BY count DESC LIMIT 15`);
      const { rows: byTech } = await db.query(`SELECT technician_name, COUNT(*)::int AS count FROM technician_habilitations GROUP BY technician_name ORDER BY count DESC LIMIT 10`);
      const { rows: expiringSoon } = await db.query(`SELECT technician_name, title, habilitation_type, expiry_date FROM technician_habilitations WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '60 days' ORDER BY expiry_date ASC LIMIT 10`);
      res.json({ ...s[0], byType, byTech, expiringSoon });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET ONE
  app.get("/api/habilitations/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const { rows } = await getPool().query("SELECT * FROM technician_habilitations WHERE id=$1", [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: "Habilitation introuvable" });
      const r = rows[0];
      res.json({
        ...r, documents: safeJson(r.documents, []), renewalHistory: safeJson(r.renewal_history, []),
        computedStatus: computeStatus(r.expiry_date, r.is_permanent, r.renewal_alert_days),
        daysUntilExpiry: r.expiry_date ? Math.ceil((new Date(r.expiry_date).getTime() - Date.now()) / (1000 * 86400)) : null,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // CREATE
  app.post("/api/habilitations", generalRateLimit, auth, async (req, res) => {
    try {
      const body = CreateHabSchema.parse(req.body);
      const db = getPool();
      const status = computeStatus(body.expiryDate || null, body.isPermanent, body.renewalAlertDays);
      const { rows } = await db.query(
        `INSERT INTO technician_habilitations (habilitation_number, technician_name, technician_id, technician_email, department,
          habilitation_type, category, level, title, issuing_body, certificate_number, issue_date, expiry_date,
          is_permanent, status, renewal_alert_days, training_duration_hours, training_location, assessor, scope, restrictions)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
        [genHabNumber(), body.technicianName, body.technicianId||null, body.technicianEmail||null, body.department||null,
         body.habilitationType, body.category||null, body.level||null, body.title, body.issuingBody||null,
         body.certificateNumber||null, body.issueDate, body.expiryDate||null, body.isPermanent, status,
         body.renewalAlertDays, body.trainingDurationHours||null, body.trainingLocation||null,
         body.assessor||null, body.scope||null, body.restrictions||null]
      );
      res.status(201).json({ ...rows[0], computedStatus: status, renewalHistory: [], documents: [] });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      if (e.code === "23505") return res.status(409).json({ error: "Numéro d'habilitation déjà utilisé" });
      res.status(500).json({ error: e.message });
    }
  });

  // UPDATE
  app.patch("/api/habilitations/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const body = UpdateHabSchema.parse(req.body);
      const db = getPool();
      const { rows: old } = await db.query("SELECT * FROM technician_habilitations WHERE id=$1", [req.params.id]);
      if (!old[0]) return res.status(404).json({ error: "Habilitation introuvable" });
      const sets: string[] = [];
      const params: any[] = [];
      let i = 1;
      const add = (col: string, v: any) => { sets.push(`${col}=$${i++}`); params.push(v); };
      const map: Record<string, string> = {
        technicianName:"technician_name", technicianId:"technician_id", technicianEmail:"technician_email",
        department:"department", habilitationType:"habilitation_type", category:"category", level:"level",
        title:"title", issuingBody:"issuing_body", certificateNumber:"certificate_number",
        issueDate:"issue_date", expiryDate:"expiry_date", isPermanent:"is_permanent",
        renewalAlertDays:"renewal_alert_days", trainingDurationHours:"training_duration_hours",
        trainingLocation:"training_location", assessor:"assessor", scope:"scope", restrictions:"restrictions",
      };
      for (const [js, col] of Object.entries(map)) {
        if ((body as any)[js] !== undefined) add(col, (body as any)[js]);
      }
      const newExpiry = body.expiryDate ?? old[0].expiry_date;
      const newPermanent = body.isPermanent ?? old[0].is_permanent;
      const newAlert = body.renewalAlertDays ?? old[0].renewal_alert_days;
      add("status", computeStatus(newExpiry, newPermanent, newAlert));
      add("updated_at", new Date());
      if (!sets.length) return res.json({ message: "Rien à mettre à jour" });
      params.push(req.params.id);
      const { rows } = await db.query(`UPDATE technician_habilitations SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, params);
      const r = rows[0];
      res.json({
        ...r, renewalHistory: safeJson(r.renewal_history, []), documents: safeJson(r.documents, []),
        computedStatus: computeStatus(r.expiry_date, r.is_permanent, r.renewal_alert_days),
        daysUntilExpiry: r.expiry_date ? Math.ceil((new Date(r.expiry_date).getTime() - Date.now()) / (1000 * 86400)) : null,
      });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // RENEW
  app.post("/api/habilitations/:id/renew", generalRateLimit, auth, async (req, res) => {
    try {
      const renewal = RenewalSchema.parse(req.body);
      const db = getPool();
      const { rows: old } = await db.query("SELECT * FROM technician_habilitations WHERE id=$1", [req.params.id]);
      if (!old[0]) return res.status(404).json({ error: "Habilitation introuvable" });
      const history = safeJson(old[0].renewal_history, []);
      history.push({ date: new Date().toISOString(), previousExpiry: old[0].expiry_date, ...renewal });
      const newStatus = computeStatus(renewal.expiryDate || null, old[0].is_permanent, old[0].renewal_alert_days);
      const { rows } = await db.query(
        `UPDATE technician_habilitations SET issue_date=$1, expiry_date=$2, certificate_number=$3,
          issuing_body=$4, assessor=$5, renewal_history=$6, status=$7, updated_at=NOW()
         WHERE id=$8 RETURNING *`,
        [renewal.issueDate, renewal.expiryDate||null, renewal.certificateNumber||old[0].certificate_number,
         renewal.issuingBody||old[0].issuing_body, renewal.assessor||old[0].assessor,
         JSON.stringify(history), newStatus, req.params.id]
      );
      const r = rows[0];
      res.json({
        ...r, renewalHistory: history, computedStatus: newStatus,
        daysUntilExpiry: r.expiry_date ? Math.ceil((new Date(r.expiry_date).getTime() - Date.now()) / (1000 * 86400)) : null,
      });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE
  app.delete("/api/habilitations/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const { rowCount } = await getPool().query("DELETE FROM technician_habilitations WHERE id=$1", [req.params.id]);
      if (!rowCount) return res.status(404).json({ error: "Habilitation introuvable" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log("🏅 Habilitation Management routes registered");
}
