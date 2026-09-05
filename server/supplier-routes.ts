/**
 * Supplier & Contractor Portal Routes
 * Portail fournisseurs, sous-traitants et prestataires
 *
 * Réutilise la table "suppliers" déjà existante (partagée avec purchase_orders/reorder_rules,
 * voir shared/schema.ts) plutôt que d'en dupliquer une seconde — colonnes de contact mappées sur
 * les noms réels (company_name/contact_person/email/phone), colonnes spécifiques au portail
 * (contrat, assurance, KPI de performance) ajoutées à cette même table (migration 0019).
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { pool as sharedPool } from "./db";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";
import { z } from "zod";

const getPool = (): Pool => sharedPool;
const safeJson = (v: any, fb: any) => { if (!v) return fb; if (typeof v === "object") return v; try { return JSON.parse(v); } catch { return fb; } };
const genCode = () => `SUP-${Date.now().toString(36).toUpperCase().slice(-6)}`;

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

// Traduit une ligne SQL (colonnes réelles de la table, snake_case) vers la forme JSON camelCase attendue
// côté client (supplier-portal.tsx) — la version précédente ne surchargeait qu'une poignée de champs
// après le spread `...r`, laissant tous les champs composés (supplierCode, supplierType, paymentTermsDays,
// totalOrders, totalSpend, onTimeDeliveryPct, qualityScore, contractStart/End, insuranceExpiry/Amount,
// lastOrderDate...) à `undefined` côté frontend. supplier-portal.tsx appelle même
// `s.supplierCode.toLowerCase()` dans son filtre de recherche : avec l'ancienne forme, ça plantait la page
// dès qu'une recherche ne correspondait pas au nom.
function toApiShape(r: any) {
  return {
    id: r.id,
    supplierCode: r.supplier_code,
    name: r.company_name,
    supplierType: r.supplier_type,
    contactName: r.contact_person,
    contactEmail: r.email,
    contactPhone: r.phone,
    address: r.address,
    city: r.city,
    country: r.country,
    rating: r.rating,
    certifications: safeJson(r.certifications, []),
    notes: r.notes,
    siret: r.siret,
    vatNumber: r.vat_number,
    website: r.website,
    paymentTermsDays: r.payment_terms_days,
    currency: r.currency,
    specialties: safeJson(r.specialties, []),
    contractStart: r.contract_start,
    contractEnd: r.contract_end,
    contractNumber: r.contract_number,
    insuranceExpiry: r.insurance_expiry,
    insuranceAmount: r.insurance_amount != null ? Number(r.insurance_amount) : undefined,
    status: r.status,
    onTimeDeliveryPct: r.on_time_delivery_pct != null ? Number(r.on_time_delivery_pct) : undefined,
    qualityScore: r.quality_score != null ? Number(r.quality_score) : undefined,
    totalOrders: r.total_orders,
    totalSpend: r.total_spend != null ? Number(r.total_spend) : undefined,
    lastOrderDate: r.last_order_date,
    documents: safeJson(r.documents, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const CreateSupplierSchema = z.object({
  name: z.string().min(2),
  supplierCode: z.string().optional(),
  supplierType: z.enum(["supplier", "contractor", "subcontractor", "consultant", "manufacturer"]).default("supplier"),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default("France"),
  siret: z.string().optional(),
  vatNumber: z.string().optional(),
  website: z.string().optional(),
  paymentTermsDays: z.number().int().default(30),
  currency: z.string().default("EUR"),
  certifications: z.array(z.string()).default([]),
  specialties: z.array(z.string()).default([]),
  contractStart: z.string().optional(),
  contractEnd: z.string().optional(),
  contractNumber: z.string().optional(),
  insuranceExpiry: z.string().optional(),
  insuranceAmount: z.number().optional(),
  notes: z.string().optional(),
});

const UpdateSupplierSchema = CreateSupplierSchema.partial().extend({
  status: z.enum(["active", "inactive", "blacklisted", "pending_approval"]).optional(),
  rating: z.number().min(0).max(5).optional(),
  onTimeDeliveryPct: z.number().optional(),
  qualityScore: z.number().optional(),
  totalOrders: z.number().int().optional(),
  totalSpend: z.number().optional(),
  lastOrderDate: z.string().optional(),
});

export function registerSupplierRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  app.get("/api/suppliers", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { type, status, search } = req.query;
      let sql = `SELECT * FROM suppliers WHERE tenant_id=$1`;
      const params: any[] = [tenantId]; let i = 2;
      if (type) { sql += ` AND supplier_type=$${i++}`; params.push(type); }
      if (status) { sql += ` AND status=$${i++}`; params.push(status); }
      if (search) { sql += ` AND (LOWER(company_name) LIKE $${i++} OR supplier_code LIKE $${i++})`; const s = `%${String(search).toLowerCase()}%`; params.push(s, s); i--; }
      sql += ` ORDER BY company_name ASC`;
      const { rows } = await getPool().query(sql, params);
      res.json(rows.map(toApiShape));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/suppliers/stats", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { rows: s } = await getPool().query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='active')::int AS active,
        COUNT(*) FILTER (WHERE status='blacklisted')::int AS blacklisted,
        COUNT(*) FILTER (WHERE supplier_type='contractor' OR supplier_type='subcontractor')::int AS contractors,
        COALESCE(AVG(rating) FILTER (WHERE rating IS NOT NULL),0) AS avg_rating,
        COALESCE(SUM(total_spend),0) AS total_spend,
        COUNT(*) FILTER (WHERE contract_end BETWEEN NOW() AND NOW()+INTERVAL '60 days')::int AS contracts_expiring
        FROM suppliers WHERE tenant_id=$1`, [tenantId]);
      const { rows: byType } = await getPool().query(`SELECT supplier_type, COUNT(*)::int AS count FROM suppliers WHERE tenant_id=$1 GROUP BY supplier_type ORDER BY count DESC`, [tenantId]);
      const { rows: top } = await getPool().query(`SELECT company_name AS name, total_spend, rating, supplier_type FROM suppliers WHERE tenant_id=$1 AND total_spend>0 ORDER BY total_spend DESC LIMIT 5`, [tenantId]);
      res.json({
        total: s[0].total,
        active: s[0].active,
        blacklisted: s[0].blacklisted,
        contractors: s[0].contractors,
        avgRating: Number(s[0].avg_rating || 0),
        totalSpend: Number(s[0].total_spend || 0),
        contractsExpiring: s[0].contracts_expiring,
        byType, topSuppliers: top,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/suppliers/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { rows } = await getPool().query("SELECT * FROM suppliers WHERE id=$1 AND tenant_id=$2", [req.params.id, tenantId]);
      if (!rows[0]) return res.status(404).json({ error: "Fournisseur introuvable" });
      res.json(toApiShape(rows[0]));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/suppliers", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = CreateSupplierSchema.parse(req.body);
      const code = body.supplierCode || genCode();
      const { rows } = await getPool().query(
        `INSERT INTO suppliers (tenant_id,supplier_code,company_name,supplier_type,contact_person,email,phone,address,city,country,siret,vat_number,website,payment_terms_days,currency,certifications,specialties,contract_start,contract_end,contract_number,insurance_expiry,insurance_amount,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
        [tenantId, code, body.name, body.supplierType, body.contactName||null, body.contactEmail||null, body.contactPhone||null, body.address||null, body.city||null, body.country, body.siret||null, body.vatNumber||null, body.website||null, body.paymentTermsDays, body.currency, JSON.stringify(body.certifications), JSON.stringify(body.specialties), body.contractStart||null, body.contractEnd||null, body.contractNumber||null, body.insuranceExpiry||null, body.insuranceAmount||null, body.notes||null]
      );
      res.status(201).json(toApiShape(rows[0]));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      if (e.code === "23505") return res.status(409).json({ error: "Code fournisseur déjà utilisé" });
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/suppliers/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = UpdateSupplierSchema.parse(req.body);
      const sets: string[] = []; const params: any[] = []; let i = 1;
      const add = (c: string, v: any) => { sets.push(`${c}=$${i++}`); params.push(v); };
      const map: Record<string, string> = {
        name:"company_name", supplierType:"supplier_type", status:"status", contactName:"contact_person", contactEmail:"email", contactPhone:"phone",
        address:"address", city:"city", country:"country", siret:"siret", vatNumber:"vat_number", website:"website", paymentTermsDays:"payment_terms_days",
        currency:"currency", contractStart:"contract_start", contractEnd:"contract_end", contractNumber:"contract_number", insuranceExpiry:"insurance_expiry",
        insuranceAmount:"insurance_amount", notes:"notes", rating:"rating", onTimeDeliveryPct:"on_time_delivery_pct", qualityScore:"quality_score",
        totalOrders:"total_orders", totalSpend:"total_spend", lastOrderDate:"last_order_date",
      };
      for (const [js, col] of Object.entries(map)) if ((body as any)[js] !== undefined) add(col, (body as any)[js]);
      if (body.certifications !== undefined) add("certifications", JSON.stringify(body.certifications));
      if (body.specialties !== undefined) add("specialties", JSON.stringify(body.specialties));
      add("updated_at", new Date());
      if (!sets.length) return res.json({ message: "Rien à mettre à jour" });
      params.push(req.params.id, tenantId);
      const { rows } = await getPool().query(`UPDATE suppliers SET ${sets.join(",")} WHERE id=$${i++} AND tenant_id=$${i} RETURNING *`, params);
      if (!rows[0]) return res.status(404).json({ error: "Fournisseur introuvable" });
      res.json(toApiShape(rows[0]));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/suppliers/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { rowCount } = await getPool().query("DELETE FROM suppliers WHERE id=$1 AND tenant_id=$2", [req.params.id, tenantId]);
      if (!rowCount) return res.status(404).json({ error: "Fournisseur introuvable" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log("🏢 Supplier Portal routes registered");
}
