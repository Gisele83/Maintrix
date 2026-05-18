/**
 * Warranty Management Routes
 * Gestion des garanties équipements / pièces
 */
import type { Express } from "express";
import { Pool } from "pg";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";
import { z } from "zod";

let pool: Pool | null = null;
const getPool = (): Pool => {
  if (!pool) pool = new Pool({ connectionString: (global as any).__localDbUrl || process.env.DATABASE_URL || "postgresql://runner@localhost:5433/maintrix?host=/tmp" });
  return pool;
};
const safeJson = (v: any, fb: any) => { if (!v) return fb; if (typeof v === "object") return v; try { return JSON.parse(v); } catch { return fb; } };
const genNum = () => `GAR-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;

function computeStatus(warrantyEnd: string, extEnd?: string | null): string {
  const effectiveEnd = extEnd || warrantyEnd;
  const now = Date.now();
  const end = new Date(effectiveEnd).getTime();
  const diffDays = Math.ceil((end - now) / (1000 * 86400));
  if (diffDays < 0) return "expired";
  if (diffDays <= 60) return "expiring_soon";
  return "active";
}

const ClaimSchema = z.object({
  id: z.string().optional(),
  date: z.string(),
  description: z.string(),
  claimNumber: z.string().optional(),
  status: z.enum(["open", "in_progress", "approved", "rejected", "closed"]).default("open"),
  amount: z.number().optional(),
  resolution: z.string().optional(),
  resolvedAt: z.string().optional(),
});

const CreateWarrantySchema = z.object({
  title: z.string().min(3),
  equipmentId: z.number().optional(),
  equipmentName: z.string().optional(),
  assetId: z.number().optional(),
  supplierId: z.number().optional(),
  supplierName: z.string().optional(),
  warrantyType: z.enum(["manufacturer", "extended", "parts", "service", "performance"]).default("manufacturer"),
  purchaseDate: z.string().optional(),
  installationDate: z.string().optional(),
  warrantyStart: z.string(),
  warrantyEnd: z.string(),
  extendedWarrantyEnd: z.string().optional(),
  coverageDescription: z.string().optional(),
  exclusions: z.string().optional(),
  maxCoverageAmount: z.number().optional(),
  deductible: z.number().default(0),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  contractNumber: z.string().optional(),
  alertDaysBefore: z.number().int().default(60),
  notes: z.string().optional(),
  claims: z.array(ClaimSchema).default([]),
});

export function registerWarrantyRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  app.get("/api/warranties", generalRateLimit, auth, async (req, res) => {
    try {
      const { status, type } = req.query;
      let sql = `SELECT w.*, s.company_name AS sup_name FROM warranties w LEFT JOIN suppliers s ON s.id=w.supplier_id WHERE 1=1`;
      const params: any[] = []; let i = 1;
      if (type) { sql += ` AND w.warranty_type=$${i++}`; params.push(type); }
      sql += ` ORDER BY w.warranty_end ASC`;
      const { rows } = await getPool().query(sql, params);
      const enriched = rows.map(r => ({
        ...r, claims: safeJson(r.claims, []), documents: safeJson(r.documents, []),
        computedStatus: computeStatus(r.warranty_end, r.extended_warranty_end),
        daysUntilExpiry: Math.ceil((new Date(r.extended_warranty_end || r.warranty_end).getTime() - Date.now()) / (1000 * 86400)),
        openClaims: (safeJson(r.claims, []) as any[]).filter((c: any) => c.status === "open" || c.status === "in_progress").length,
      }));
      const filtered = status && status !== "all" ? enriched.filter(r => r.computedStatus === status) : enriched;
      res.json(filtered);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/warranties/stats", generalRateLimit, auth, async (req, res) => {
    try {
      const { rows: s } = await getPool().query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE warranty_end > NOW() OR extended_warranty_end > NOW())::int AS active_count,
        COUNT(*) FILTER (WHERE (COALESCE(extended_warranty_end,warranty_end)) < NOW())::int AS expired_count,
        COUNT(*) FILTER (WHERE COALESCE(extended_warranty_end,warranty_end) BETWEEN NOW() AND NOW()+INTERVAL '60 days')::int AS expiring_60d,
        COALESCE(SUM(max_coverage_amount),0) AS total_coverage
        FROM warranties`);
      const { rows: expiring } = await getPool().query(`SELECT title, equipment_name, warranty_end, extended_warranty_end FROM warranties WHERE COALESCE(extended_warranty_end,warranty_end) BETWEEN NOW() AND NOW()+INTERVAL '90 days' ORDER BY COALESCE(extended_warranty_end,warranty_end) ASC LIMIT 10`);
      res.json({ ...s[0], expiring });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/warranties/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const { rows } = await getPool().query("SELECT * FROM warranties WHERE id=$1", [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: "Garantie introuvable" });
      const r = rows[0];
      res.json({ ...r, claims: safeJson(r.claims, []), documents: safeJson(r.documents, []), computedStatus: computeStatus(r.warranty_end, r.extended_warranty_end) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/warranties", generalRateLimit, auth, async (req, res) => {
    try {
      const body = CreateWarrantySchema.parse(req.body);
      const status = computeStatus(body.warrantyEnd, body.extendedWarrantyEnd);
      const claims = body.claims.map((c, i) => ({ ...c, id: c.id || `clm-${i}` }));
      const { rows } = await getPool().query(
        `INSERT INTO warranties (warranty_number,title,equipment_id,equipment_name,asset_id,supplier_id,supplier_name,warranty_type,status,purchase_date,installation_date,warranty_start,warranty_end,extended_warranty_end,coverage_description,exclusions,max_coverage_amount,deductible,contact_name,contact_email,contact_phone,contract_number,alert_days_before,notes,claims)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING *`,
        [genNum(), body.title, body.equipmentId||null, body.equipmentName||null, body.assetId||null, body.supplierId||null, body.supplierName||null, body.warrantyType, status, body.purchaseDate||null, body.installationDate||null, body.warrantyStart, body.warrantyEnd, body.extendedWarrantyEnd||null, body.coverageDescription||null, body.exclusions||null, body.maxCoverageAmount||null, body.deductible, body.contactName||null, body.contactEmail||null, body.contactPhone||null, body.contractNumber||null, body.alertDaysBefore, body.notes||null, JSON.stringify(claims)]
      );
      const r = rows[0];
      res.status(201).json({ ...r, claims: safeJson(r.claims, []), computedStatus: status });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/warranties/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const body = CreateWarrantySchema.partial().parse(req.body);
      const sets: string[] = []; const params: any[] = []; let i = 1;
      const add = (c: string, v: any) => { sets.push(`${c}=$${i++}`); params.push(v); };
      const map: Record<string,string> = { title:"title", equipmentId:"equipment_id", equipmentName:"equipment_name", assetId:"asset_id", supplierId:"supplier_id", supplierName:"supplier_name", warrantyType:"warranty_type", purchaseDate:"purchase_date", installationDate:"installation_date", warrantyStart:"warranty_start", warrantyEnd:"warranty_end", extendedWarrantyEnd:"extended_warranty_end", coverageDescription:"coverage_description", exclusions:"exclusions", maxCoverageAmount:"max_coverage_amount", deductible:"deductible", contactName:"contact_name", contactEmail:"contact_email", contactPhone:"contact_phone", contractNumber:"contract_number", alertDaysBefore:"alert_days_before", notes:"notes" };
      for (const [js, col] of Object.entries(map)) if ((body as any)[js] !== undefined) add(col, (body as any)[js]);
      if (body.claims !== undefined) add("claims", JSON.stringify(body.claims.map((c, j) => ({ ...c, id: c.id || `clm-${j}` }))));
      const { rows: old } = await getPool().query("SELECT warranty_end, extended_warranty_end FROM warranties WHERE id=$1", [req.params.id]);
      if (!old[0]) return res.status(404).json({ error: "Garantie introuvable" });
      add("status", computeStatus(body.warrantyEnd || old[0].warranty_end, body.extendedWarrantyEnd || old[0].extended_warranty_end));
      add("updated_at", new Date());
      if (!sets.length) return res.json({ message: "Rien à mettre à jour" });
      params.push(req.params.id);
      const { rows } = await getPool().query(`UPDATE warranties SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, params);
      const r = rows[0];
      res.json({ ...r, claims: safeJson(r.claims, []), computedStatus: computeStatus(r.warranty_end, r.extended_warranty_end) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Add claim
  app.post("/api/warranties/:id/claims", generalRateLimit, auth, async (req, res) => {
    try {
      const claim = ClaimSchema.parse(req.body);
      const { rows } = await getPool().query("SELECT claims FROM warranties WHERE id=$1", [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: "Garantie introuvable" });
      const claims = safeJson(rows[0].claims, []);
      claims.push({ ...claim, id: claim.id || `clm-${Date.now()}` });
      const { rows: updated } = await getPool().query("UPDATE warranties SET claims=$1, updated_at=NOW() WHERE id=$2 RETURNING *", [JSON.stringify(claims), req.params.id]);
      res.json({ ...updated[0], claims });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/warranties/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const { rowCount } = await getPool().query("DELETE FROM warranties WHERE id=$1", [req.params.id]);
      if (!rowCount) return res.status(404).json({ error: "Garantie introuvable" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log("🛡️  Warranty Management routes registered");
}
