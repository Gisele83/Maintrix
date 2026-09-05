/**
 * Warranty Management Routes
 * Gestion des garanties équipements / pièces
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { pool as sharedPool } from "./db";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";
import { z } from "zod";

const getPool = (): Pool => sharedPool;
const safeJson = (v: any, fb: any) => { if (!v) return fb; if (typeof v === "object") return v; try { return JSON.parse(v); } catch { return fb; } };
const genNum = () => `GAR-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;

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
// convention que les autres modules reconstruits cette session. warranty.tsx lit exclusivement des clés
// camelCase (warrantyNumber, warrantyEnd, maxCoverageAmount...) ; sans traduction, undefined.
function toApiShape(r: any) {
  const claims = safeJson(r.claims, []);
  return {
    id: r.id,
    warrantyNumber: r.warranty_number,
    title: r.title,
    equipmentId: r.equipment_id,
    equipmentName: r.equipment_name,
    assetId: r.asset_id,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name || r.sup_name || undefined,
    warrantyType: r.warranty_type,
    status: r.status,
    purchaseDate: r.purchase_date,
    installationDate: r.installation_date,
    warrantyStart: r.warranty_start,
    warrantyEnd: r.warranty_end,
    extendedWarrantyEnd: r.extended_warranty_end,
    coverageDescription: r.coverage_description,
    exclusions: r.exclusions,
    maxCoverageAmount: r.max_coverage_amount != null ? Number(r.max_coverage_amount) : undefined,
    deductible: r.deductible != null ? Number(r.deductible) : undefined,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    contractNumber: r.contract_number,
    alertDaysBefore: r.alert_days_before,
    notes: r.notes,
    claims,
    documents: safeJson(r.documents, []),
    computedStatus: computeStatus(r.warranty_end, r.extended_warranty_end),
    daysUntilExpiry: Math.ceil((new Date(r.extended_warranty_end || r.warranty_end).getTime() - Date.now()) / (1000 * 86400)),
    openClaims: claims.filter((c: any) => c.status === "open" || c.status === "in_progress").length,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

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

  app.get("/api/warranties", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { status, type } = req.query;
      let sql = `SELECT w.*, s.company_name AS sup_name FROM warranties w LEFT JOIN suppliers s ON s.id=w.supplier_id WHERE w.tenant_id=$1`;
      const params: any[] = [tenantId]; let i = 2;
      if (type) { sql += ` AND w.warranty_type=$${i++}`; params.push(type); }
      sql += ` ORDER BY w.warranty_end ASC`;
      const { rows } = await getPool().query(sql, params);
      const enriched = rows.map(toApiShape);
      const filtered = status && status !== "all" ? enriched.filter(r => r.computedStatus === status) : enriched;
      res.json(filtered);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/warranties/stats", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { rows: s } = await getPool().query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE warranty_end > NOW() OR extended_warranty_end > NOW())::int AS active_count,
        COUNT(*) FILTER (WHERE (COALESCE(extended_warranty_end,warranty_end)) < NOW())::int AS expired_count,
        COUNT(*) FILTER (WHERE COALESCE(extended_warranty_end,warranty_end) BETWEEN NOW() AND NOW()+INTERVAL '60 days')::int AS expiring_60d,
        COALESCE(SUM(max_coverage_amount),0) AS total_coverage
        FROM warranties WHERE tenant_id=$1`, [tenantId]);
      const { rows: expiring } = await getPool().query(`SELECT title, equipment_name, warranty_end, extended_warranty_end FROM warranties WHERE tenant_id=$1 AND COALESCE(extended_warranty_end,warranty_end) BETWEEN NOW() AND NOW()+INTERVAL '90 days' ORDER BY COALESCE(extended_warranty_end,warranty_end) ASC LIMIT 10`, [tenantId]);
      res.json({
        total: s[0].total,
        activeCount: s[0].active_count,
        expiredCount: s[0].expired_count,
        expiring60d: s[0].expiring_60d,
        totalCoverage: Number(s[0].total_coverage || 0),
        expiring,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/warranties/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { rows } = await getPool().query("SELECT * FROM warranties WHERE id=$1 AND tenant_id=$2", [req.params.id, tenantId]);
      if (!rows[0]) return res.status(404).json({ error: "Garantie introuvable" });
      res.json(toApiShape(rows[0]));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/warranties", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = CreateWarrantySchema.parse(req.body);
      const status = computeStatus(body.warrantyEnd, body.extendedWarrantyEnd);
      const claims = body.claims.map((c, i) => ({ ...c, id: c.id || `clm-${i}` }));
      const { rows } = await getPool().query(
        `INSERT INTO warranties (tenant_id,warranty_number,title,equipment_id,equipment_name,asset_id,supplier_id,supplier_name,warranty_type,status,purchase_date,installation_date,warranty_start,warranty_end,extended_warranty_end,coverage_description,exclusions,max_coverage_amount,deductible,contact_name,contact_email,contact_phone,contract_number,alert_days_before,notes,claims)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26) RETURNING *`,
        [tenantId, genNum(), body.title, body.equipmentId||null, body.equipmentName||null, body.assetId||null, body.supplierId||null, body.supplierName||null, body.warrantyType, status, body.purchaseDate||null, body.installationDate||null, body.warrantyStart, body.warrantyEnd, body.extendedWarrantyEnd||null, body.coverageDescription||null, body.exclusions||null, body.maxCoverageAmount||null, body.deductible, body.contactName||null, body.contactEmail||null, body.contactPhone||null, body.contractNumber||null, body.alertDaysBefore, body.notes||null, JSON.stringify(claims)]
      );
      res.status(201).json(toApiShape(rows[0]));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/warranties/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = CreateWarrantySchema.partial().parse(req.body);
      const sets: string[] = []; const params: any[] = []; let i = 1;
      const add = (c: string, v: any) => { sets.push(`${c}=$${i++}`); params.push(v); };
      const map: Record<string,string> = { title:"title", equipmentId:"equipment_id", equipmentName:"equipment_name", assetId:"asset_id", supplierId:"supplier_id", supplierName:"supplier_name", warrantyType:"warranty_type", purchaseDate:"purchase_date", installationDate:"installation_date", warrantyStart:"warranty_start", warrantyEnd:"warranty_end", extendedWarrantyEnd:"extended_warranty_end", coverageDescription:"coverage_description", exclusions:"exclusions", maxCoverageAmount:"max_coverage_amount", deductible:"deductible", contactName:"contact_name", contactEmail:"contact_email", contactPhone:"contact_phone", contractNumber:"contract_number", alertDaysBefore:"alert_days_before", notes:"notes" };
      for (const [js, col] of Object.entries(map)) if ((body as any)[js] !== undefined) add(col, (body as any)[js]);
      if (body.claims !== undefined) add("claims", JSON.stringify(body.claims.map((c, j) => ({ ...c, id: c.id || `clm-${j}` }))));
      const { rows: old } = await getPool().query("SELECT warranty_end, extended_warranty_end FROM warranties WHERE id=$1 AND tenant_id=$2", [req.params.id, tenantId]);
      if (!old[0]) return res.status(404).json({ error: "Garantie introuvable" });
      add("status", computeStatus(body.warrantyEnd || old[0].warranty_end, body.extendedWarrantyEnd || old[0].extended_warranty_end));
      add("updated_at", new Date());
      if (!sets.length) return res.json({ message: "Rien à mettre à jour" });
      params.push(req.params.id, tenantId);
      const { rows } = await getPool().query(`UPDATE warranties SET ${sets.join(",")} WHERE id=$${i++} AND tenant_id=$${i} RETURNING *`, params);
      res.json(toApiShape(rows[0]));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Add claim
  app.post("/api/warranties/:id/claims", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const claim = ClaimSchema.parse(req.body);
      const { rows } = await getPool().query("SELECT claims FROM warranties WHERE id=$1 AND tenant_id=$2", [req.params.id, tenantId]);
      if (!rows[0]) return res.status(404).json({ error: "Garantie introuvable" });
      const claims = safeJson(rows[0].claims, []);
      claims.push({ ...claim, id: claim.id || `clm-${Date.now()}` });
      const { rows: updated } = await getPool().query("UPDATE warranties SET claims=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING *", [JSON.stringify(claims), req.params.id, tenantId]);
      res.json(toApiShape(updated[0]));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/warranties/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { rowCount } = await getPool().query("DELETE FROM warranties WHERE id=$1 AND tenant_id=$2", [req.params.id, tenantId]);
      if (!rowCount) return res.status(404).json({ error: "Garantie introuvable" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log("🛡️  Warranty Management routes registered");
}
