/**
 * Budget Management Routes
 * Gestion des budgets de maintenance et suivi des dépenses
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
const genNum = () => `BUD-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;

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

function enrichBudget(r: any) {
  const lines = safeJson(r.lines, []);
  const totalSpent = Number(r.total_spent || 0);
  const totalAllocated = Number(r.total_allocated || 0);
  const contingency = totalAllocated * (Number(r.contingency_pct || 10) / 100);
  const availableBudget = totalAllocated - totalSpent - Number(r.total_committed || 0);
  const consumptionPct = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;
  return { ...r, lines, totalSpent, totalAllocated, availableBudget, contingency, consumptionPct };
}

export function registerBudgetRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  app.get("/api/budgets", generalRateLimit, auth, async (req, res) => {
    try {
      const { year, type, status } = req.query;
      let sql = `SELECT * FROM budget_plans WHERE 1=1`;
      const params: any[] = []; let i = 1;
      if (year) { sql += ` AND fiscal_year=$${i++}`; params.push(year); }
      if (type) { sql += ` AND budget_type=$${i++}`; params.push(type); }
      if (status) { sql += ` AND status=$${i++}`; params.push(status); }
      sql += ` ORDER BY fiscal_year DESC, created_at DESC`;
      const { rows } = await getPool().query(sql, params);
      res.json(rows.map(enrichBudget));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/budgets/stats", generalRateLimit, auth, async (req, res) => {
    try {
      const year = req.query.year || new Date().getFullYear();
      const { rows: s } = await getPool().query(`SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(total_allocated),0) AS total_allocated,
        COALESCE(SUM(total_spent),0) AS total_spent,
        COALESCE(SUM(total_committed),0) AS total_committed,
        COUNT(*) FILTER (WHERE status='approved')::int AS approved,
        COUNT(*) FILTER (WHERE status='draft')::int AS draft
        FROM budget_plans WHERE fiscal_year=$1`, [year]);
      const { rows: byType } = await getPool().query(`SELECT budget_type, COALESCE(SUM(total_allocated),0) AS allocated, COALESCE(SUM(total_spent),0) AS spent FROM budget_plans WHERE fiscal_year=$1 GROUP BY budget_type`, [year]);
      const { rows: monthly } = await getPool().query(`SELECT TO_CHAR(transaction_date,'MM') AS month, COALESCE(SUM(amount),0) AS total FROM budget_transactions WHERE EXTRACT(YEAR FROM transaction_date)=$1 AND transaction_type='expense' GROUP BY month ORDER BY month`, [year]);
      res.json({ ...s[0], byType, monthly });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/budgets/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const { rows } = await getPool().query("SELECT * FROM budget_plans WHERE id=$1", [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: "Budget introuvable" });
      const { rows: txns } = await getPool().query("SELECT * FROM budget_transactions WHERE budget_id=$1 ORDER BY transaction_date DESC", [req.params.id]);
      res.json({ ...enrichBudget(rows[0]), transactions: txns });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/budgets", generalRateLimit, auth, async (req, res) => {
    try {
      const body = CreateBudgetSchema.parse(req.body);
      const lines = body.lines.map((l, i) => ({ ...l, id: l.id || `line-${i}` }));
      const { rows } = await getPool().query(
        `INSERT INTO budget_plans (budget_number,title,fiscal_year,department,budget_type,total_allocated,contingency_pct,currency,start_date,end_date,lines,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [genNum(), body.title, body.fiscalYear, body.department||null, body.budgetType, body.totalAllocated, body.contingencyPct, body.currency, body.startDate||null, body.endDate||null, JSON.stringify(lines), body.notes||null]
      );
      res.status(201).json(enrichBudget(rows[0]));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/budgets/:id", generalRateLimit, auth, async (req, res) => {
    try {
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
      params.push(req.params.id);
      const { rows } = await db.query(`UPDATE budget_plans SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, params);
      if (!rows[0]) return res.status(404).json({ error: "Budget introuvable" });
      res.json(enrichBudget(rows[0]));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/budgets/:id/transactions", generalRateLimit, auth, async (req, res) => {
    try {
      const body = TransactionSchema.parse(req.body);
      const db = getPool();
      const { rows: bRows } = await db.query("SELECT * FROM budget_plans WHERE id=$1", [req.params.id]);
      if (!bRows[0]) return res.status(404).json({ error: "Budget introuvable" });
      const { rows } = await db.query(
        `INSERT INTO budget_transactions (budget_id,budget_line_id,transaction_type,amount,description,reference,supplier_name,work_order_id,transaction_date,category,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'posted') RETURNING *`,
        [req.params.id, body.budgetLineId||null, body.transactionType, body.amount, body.description, body.reference||null, body.supplierName||null, body.workOrderId||null, body.transactionDate, body.category||null]
      );
      // Update budget spent/committed
      if (body.transactionType === "expense") {
        await db.query(`UPDATE budget_plans SET total_spent=COALESCE(total_spent,0)+$1, updated_at=NOW() WHERE id=$2`, [body.amount, req.params.id]);
      } else if (body.transactionType === "commitment") {
        await db.query(`UPDATE budget_plans SET total_committed=COALESCE(total_committed,0)+$1, updated_at=NOW() WHERE id=$2`, [body.amount, req.params.id]);
      } else if (body.transactionType === "refund") {
        await db.query(`UPDATE budget_plans SET total_spent=GREATEST(0,COALESCE(total_spent,0)-$1), updated_at=NOW() WHERE id=$2`, [body.amount, req.params.id]);
      }
      res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/budgets/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const { rowCount } = await getPool().query("DELETE FROM budget_plans WHERE id=$1", [req.params.id]);
      if (!rowCount) return res.status(404).json({ error: "Budget introuvable" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log("💰 Budget Management routes registered");
}
