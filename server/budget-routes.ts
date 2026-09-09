/**
 * Budget Management Routes
 * Gestion des budgets de maintenance et suivi des dépenses
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { pool as sharedPool } from "./db";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";
import { z } from "zod";

const getPool = (): Pool => sharedPool;
const safeJson = (v: any, fb: any) => { if (!v) return fb; if (typeof v === "object") return v; try { return JSON.parse(v); } catch { return fb; } };
const genNum = () => `BUD-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;

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

const BudgetLineSchema = z.object({
  id: z.string().optional(),
  category: z.string(),
  description: z.string(),
  allocated: z.number().default(0),
  spent: z.number().default(0),
  committed: z.number().default(0),
  unit: z.string().optional(),
  quantity: z.number().optional(),
  unitCost: z.number().optional(),
});

const CreateBudgetSchema = z.object({
  title: z.string().min(3),
  fiscalYear: z.number().int(),
  department: z.string().optional(),
  budgetType: z.enum(["maintenance", "capex", "opex", "emergency", "project"]).default("maintenance"),
  totalAllocated: z.number().default(0),
  contingencyPct: z.number().default(10),
  currency: z.string().default("EUR"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  lines: z.array(BudgetLineSchema).default([]),
  notes: z.string().optional(),
});

const TransactionSchema = z.object({
  transactionType: z.enum(["expense", "commitment", "adjustment", "refund"]),
  amount: z.number(),
  description: z.string().min(2),
  reference: z.string().optional(),
  supplierName: z.string().optional(),
  workOrderId: z.number().optional(),
  transactionDate: z.string(),
  category: z.string().optional(),
  budgetLineId: z.string().optional(),
});

// Traduit une ligne SQL (colonnes snake_case) vers la forme JSON attendue côté client (camelCase) — même
// convention que server/supplier-routes.ts et server/oee-routes.ts. budget.tsx lit exclusivement des clés
// camelCase (fiscalYear, budgetType, budgetNumber...) ; sans cette traduction chaque valeur arrive `undefined`.
function enrichBudget(r: any) {
  const lines = safeJson(r.lines, []);
  const totalSpent = Number(r.total_spent || 0);
  const totalAllocated = Number(r.total_allocated || 0);
  const totalCommitted = Number(r.total_committed || 0);
  const contingencyPct = Number(r.contingency_pct || 10);
  const contingency = totalAllocated * (contingencyPct / 100);
  const availableBudget = totalAllocated - totalSpent - totalCommitted;
  const consumptionPct = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;
  return {
    id: r.id,
    budgetNumber: r.budget_number,
    title: r.title,
    fiscalYear: r.fiscal_year,
    department: r.department,
    budgetType: r.budget_type,
    status: r.status,
    totalAllocated, totalSpent, totalCommitted, contingencyPct,
    currency: r.currency,
    startDate: r.start_date,
    endDate: r.end_date,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    lines, notes: r.notes,
    availableBudget, contingency, consumptionPct,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toTxShape(r: any) {
  return {
    id: r.id,
    budgetId: r.budget_id,
    budgetLineId: r.budget_line_id,
    transactionType: r.transaction_type,
    amount: Number(r.amount),
    description: r.description,
    reference: r.reference,
    supplierName: r.supplier_name,
    workOrderId: r.work_order_id,
    transactionDate: r.transaction_date,
    category: r.category,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function registerBudgetRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  app.get("/api/budgets", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { year, type, status } = req.query;
      let sql = `SELECT * FROM budget_plans WHERE tenant_id=$1`;
      const params: any[] = [tenantId]; let i = 2;
      if (year) { sql += ` AND fiscal_year=$${i++}`; params.push(year); }
      if (type) { sql += ` AND budget_type=$${i++}`; params.push(type); }
      if (status) { sql += ` AND status=$${i++}`; params.push(status); }
      sql += ` ORDER BY fiscal_year DESC, created_at DESC`;
      const { rows } = await getPool().query(sql, params);
      res.json(rows.map(enrichBudget));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/budgets/stats", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const year = req.query.year || new Date().getFullYear();
      const { rows: s } = await getPool().query(`SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(total_allocated),0) AS total_allocated,
        COALESCE(SUM(total_spent),0) AS total_spent,
        COALESCE(SUM(total_committed),0) AS total_committed,
        COUNT(*) FILTER (WHERE status='approved')::int AS approved,
        COUNT(*) FILTER (WHERE status='draft')::int AS draft
        FROM budget_plans WHERE tenant_id=$1 AND fiscal_year=$2`, [tenantId, year]);
      const { rows: byType } = await getPool().query(`SELECT budget_type, COALESCE(SUM(total_allocated),0) AS allocated, COALESCE(SUM(total_spent),0) AS spent FROM budget_plans WHERE tenant_id=$1 AND fiscal_year=$2 GROUP BY budget_type`, [tenantId, year]);
      const { rows: monthly } = await getPool().query(`SELECT TO_CHAR(bt.transaction_date,'MM') AS month, COALESCE(SUM(bt.amount),0) AS total FROM budget_transactions bt WHERE bt.tenant_id=$1 AND EXTRACT(YEAR FROM bt.transaction_date)=$2 AND bt.transaction_type='expense' GROUP BY month ORDER BY month`, [tenantId, year]);
      res.json({
        total: s[0].total,
        totalAllocated: Number(s[0].total_allocated || 0),
        totalSpent: Number(s[0].total_spent || 0),
        totalCommitted: Number(s[0].total_committed || 0),
        approved: s[0].approved,
        draft: s[0].draft,
        byType, monthly,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/budgets/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { rows } = await getPool().query("SELECT * FROM budget_plans WHERE id=$1 AND tenant_id=$2", [req.params.id, tenantId]);
      if (!rows[0]) return res.status(404).json({ error: "Budget introuvable" });
      const { rows: txns } = await getPool().query("SELECT * FROM budget_transactions WHERE budget_id=$1 AND tenant_id=$2 ORDER BY transaction_date DESC", [req.params.id, tenantId]);
      res.json({ ...enrichBudget(rows[0]), transactions: txns.map(toTxShape) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/budgets", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = CreateBudgetSchema.parse(req.body);
      const lines = body.lines.map((l, i) => ({ ...l, id: l.id || `line-${i}` }));
      const { rows } = await getPool().query(
        `INSERT INTO budget_plans (tenant_id,budget_number,title,fiscal_year,department,budget_type,total_allocated,contingency_pct,currency,start_date,end_date,lines,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [tenantId, genNum(), body.title, body.fiscalYear, body.department||null, body.budgetType, body.totalAllocated, body.contingencyPct, body.currency, body.startDate||null, body.endDate||null, JSON.stringify(lines), body.notes||null]
      );
      res.status(201).json(enrichBudget(rows[0]));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/budgets/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const db = getPool();
      const body = CreateBudgetSchema.partial().extend({ status: z.string().optional(), approvedBy: z.string().optional() }).parse(req.body);
      const sets: string[] = []; const params: any[] = []; let i = 1;
      const add = (c: string, v: any) => { sets.push(`${c}=$${i++}`); params.push(v); };
      const map: Record<string,string> = { title:"title", fiscalYear:"fiscal_year", department:"department", budgetType:"budget_type", totalAllocated:"total_allocated", contingencyPct:"contingency_pct", currency:"currency", startDate:"start_date", endDate:"end_date", notes:"notes", status:"status", approvedBy:"approved_by" };
      for (const [js, col] of Object.entries(map)) if ((body as any)[js] !== undefined) add(col, (body as any)[js]);
      if (body.lines !== undefined) add("lines", JSON.stringify(body.lines.map((l, j) => ({ ...l, id: l.id || `line-${j}` }))));
      if (body.status === "approved") add("approved_at", new Date());
      add("updated_at", new Date());
      if (!sets.length) return res.json({ message: "Rien à mettre à jour" });
      params.push(req.params.id, tenantId);
      const { rows } = await db.query(`UPDATE budget_plans SET ${sets.join(",")} WHERE id=$${i++} AND tenant_id=$${i} RETURNING *`, params);
      if (!rows[0]) return res.status(404).json({ error: "Budget introuvable" });
      res.json(enrichBudget(rows[0]));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/budgets/:id/transactions", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = TransactionSchema.parse(req.body);

      // 🔒 F04 — TRANSACTION ATOMIQUE.
      //
      // Cette opération écrit à DEUX endroits : la ligne de mouvement dans
      // `budget_transactions`, puis l'imputation sur les totaux de
      // `budget_plans`. Sans transaction, un échec de la seconde étape laissait
      // la dépense enregistrée SANS être imputée : le budget sous-estimait
      // durablement les dépenses, sans erreur visible ni mécanisme de
      // réconciliation. Défaut reproduit en F04
      // (tests/integration/transaction-integrity.test.ts).
      //
      // Ce fichier utilise `pg.Pool` et non Drizzle : on réserve donc un client
      // dédié et on pilote BEGIN/COMMIT/ROLLBACK à la main. Le client DOIT être
      // rendu au pool dans tous les cas, d'où le `finally`.
      const client = await getPool().connect();
      try {
        await client.query("BEGIN");

        // `FOR UPDATE` verrouille la ligne de budget jusqu'au COMMIT : deux
        // dépenses concurrentes sur le même budget s'appliquent l'une après
        // l'autre au lieu de s'écraser (lecture-modification-écriture perdue).
        const { rows: bRows } = await client.query(
          "SELECT * FROM budget_plans WHERE id=$1 AND tenant_id=$2 FOR UPDATE",
          [req.params.id, tenantId],
        );
        if (!bRows[0]) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Budget introuvable" });
        }

        const { rows } = await client.query(
          `INSERT INTO budget_transactions (tenant_id,budget_id,budget_line_id,transaction_type,amount,description,reference,supplier_name,work_order_id,transaction_date,category,status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'posted') RETURNING *`,
          [tenantId, req.params.id, body.budgetLineId||null, body.transactionType, body.amount, body.description, body.reference||null, body.supplierName||null, body.workOrderId||null, body.transactionDate, body.category||null]
        );

        // Imputation sur les totaux du budget.
        if (body.transactionType === "expense") {
          await client.query(`UPDATE budget_plans SET total_spent=COALESCE(total_spent,0)+$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, [body.amount, req.params.id, tenantId]);
        } else if (body.transactionType === "commitment") {
          await client.query(`UPDATE budget_plans SET total_committed=COALESCE(total_committed,0)+$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, [body.amount, req.params.id, tenantId]);
        } else if (body.transactionType === "refund") {
          await client.query(`UPDATE budget_plans SET total_spent=GREATEST(0,COALESCE(total_spent,0)-$1), updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, [body.amount, req.params.id, tenantId]);
        }

        await client.query("COMMIT");
        res.status(201).json(toTxShape(rows[0]));
      } catch (txErr) {
        await client.query("ROLLBACK").catch(() => { /* connexion déjà perdue */ });
        throw txErr;
      } finally {
        client.release();
      }
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/budgets/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { rowCount } = await getPool().query("DELETE FROM budget_plans WHERE id=$1 AND tenant_id=$2", [req.params.id, tenantId]);
      if (!rowCount) return res.status(404).json({ error: "Budget introuvable" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log("💰 Budget Management routes registered");
}
