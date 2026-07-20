/**
 * Annual Maintenance Plan Routes
 * Plan de maintenance annuel (PMA) - Planification et suivi des tâches
 */
import type { Express } from "express";
import type { Pool } from "pg";
import { pool as sharedPool } from "./db";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";
import { z } from "zod";

const getPool = (): Pool => sharedPool;
const safeJson = (v: any, fb: any) => { if (!v) return fb; if (typeof v === "object") return v; try { return JSON.parse(v); } catch { return fb; } };
const genNum = () => `PMA-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

const TaskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  equipmentId: z.number().optional(),
  equipmentName: z.string().optional(),
  taskType: z.enum(["preventive", "corrective", "inspection", "calibration", "lubrication", "cleaning", "replacement", "overhaul"]).default("preventive"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["planned", "in_progress", "completed", "cancelled", "postponed"]).default("planned"),
  plannedMonth: z.number().int().min(1).max(12),
  plannedWeek: z.number().int().min(1).max(53).optional(),
  plannedDate: z.string().optional(),
  completedDate: z.string().optional(),
  estimatedHours: z.number().optional(),
  actualHours: z.number().optional(),
  estimatedCost: z.number().optional(),
  actualCost: z.number().optional(),
  assignedTo: z.string().optional(),
  supplierId: z.number().optional(),
  supplierName: z.string().optional(),
  requiredSkills: z.string().optional(),
  spareParts: z.string().optional(),
  frequency: z.string().optional(),
  notes: z.string().optional(),
});

const CreatePlanSchema = z.object({
  title: z.string().min(3),
  fiscalYear: z.number().int(),
  department: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budgetAllocated: z.number().default(0),
  approvedBy: z.string().optional(),
  tasks: z.array(TaskSchema).default([]),
  notes: z.string().optional(),
});

function enrichPlan(r: any) {
  const tasks: any[] = safeJson(r.tasks, []);
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t: any) => t.status === "completed").length;
  const inProgressTasks = tasks.filter((t: any) => t.status === "in_progress").length;
  const overdueTasks = tasks.filter((t: any) => t.status === "planned" && t.plannedDate && new Date(t.plannedDate) < new Date()).length;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const budgetSpent = tasks.filter(t => t.actualCost).reduce((s: number, t: any) => s + Number(t.actualCost || 0), 0);
  // Month breakdown
  const byMonth: Record<number, { planned: number; completed: number }> = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = { planned: 0, completed: 0 };
  tasks.forEach((t: any) => {
    if (t.plannedMonth) { byMonth[t.plannedMonth].planned++; if (t.status === "completed") byMonth[t.plannedMonth].completed++; }
  });
  const monthlyData = Object.entries(byMonth).map(([m, v]) => ({ month: MONTHS[Number(m) - 1], monthNum: Number(m), ...v }));
  return { ...r, tasks, totalTasks, completedTasks, inProgressTasks, overdueTasks, completionPct, budgetSpent, monthlyData };
}

export function registerMaintenancePlanRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  app.get("/api/maintenance-plans", generalRateLimit, auth, async (req, res) => {
    try {
      const { year, status } = req.query;
      let sql = `SELECT * FROM maintenance_plans WHERE 1=1`;
      const params: any[] = []; let i = 1;
      if (year) { sql += ` AND fiscal_year=$${i++}`; params.push(year); }
      if (status) { sql += ` AND status=$${i++}`; params.push(status); }
      sql += ` ORDER BY fiscal_year DESC, created_at DESC`;
      const { rows } = await getPool().query(sql, params);
      res.json(rows.map(enrichPlan));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/maintenance-plans/stats", generalRateLimit, auth, async (req, res) => {
    try {
      const year = req.query.year || new Date().getFullYear();
      const { rows: s } = await getPool().query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='approved')::int AS approved,
        COALESCE(SUM(total_tasks),0) AS total_tasks,
        COALESCE(SUM(completed_tasks),0) AS completed_tasks,
        COALESCE(SUM(budget_allocated),0) AS budget_allocated,
        COALESCE(SUM(budget_spent),0) AS budget_spent
        FROM maintenance_plans WHERE fiscal_year=$1`, [year]);
      res.json(s[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/maintenance-plans/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const { rows } = await getPool().query("SELECT * FROM maintenance_plans WHERE id=$1", [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: "Plan introuvable" });
      res.json(enrichPlan(rows[0]));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/maintenance-plans", generalRateLimit, auth, async (req, res) => {
    try {
      const body = CreatePlanSchema.parse(req.body);
      const tasks = body.tasks.map((t, i) => ({ ...t, id: t.id || `task-${i}` }));
      const { rows } = await getPool().query(
        `INSERT INTO maintenance_plans (plan_number,title,fiscal_year,department,start_date,end_date,budget_allocated,approved_by,tasks,notes,total_tasks,completed_tasks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0) RETURNING *`,
        [genNum(), body.title, body.fiscalYear, body.department||null, body.startDate||null, body.endDate||null, body.budgetAllocated, body.approvedBy||null, JSON.stringify(tasks), body.notes||null, tasks.length]
      );
      res.status(201).json(enrichPlan(rows[0]));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/maintenance-plans/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const body = CreatePlanSchema.partial().extend({ status: z.string().optional() }).parse(req.body);
      const sets: string[] = []; const params: any[] = []; let i = 1;
      const add = (c: string, v: any) => { sets.push(`${c}=$${i++}`); params.push(v); };
      const map: Record<string,string> = { title:"title", fiscalYear:"fiscal_year", department:"department", startDate:"start_date", endDate:"end_date", budgetAllocated:"budget_allocated", approvedBy:"approved_by", notes:"notes", status:"status" };
      for (const [js, col] of Object.entries(map)) if ((body as any)[js] !== undefined) add(col, (body as any)[js]);
      if (body.tasks !== undefined) {
        const tasks = body.tasks.map((t, j) => ({ ...t, id: t.id || `task-${j}` }));
        add("tasks", JSON.stringify(tasks));
        add("total_tasks", tasks.length);
        add("completed_tasks", tasks.filter(t => t.status === "completed").length);
        const spent = tasks.filter(t => t.actualCost).reduce((s, t) => s + Number(t.actualCost || 0), 0);
        add("budget_spent", spent);
      }
      add("updated_at", new Date());
      if (!sets.length) return res.json({ message: "Rien à mettre à jour" });
      params.push(req.params.id);
      const { rows } = await getPool().query(`UPDATE maintenance_plans SET ${sets.join(",")} WHERE id=$${i} RETURNING *`, params);
      if (!rows[0]) return res.status(404).json({ error: "Plan introuvable" });
      res.json(enrichPlan(rows[0]));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/maintenance-plans/:id", generalRateLimit, auth, async (req, res) => {
    try {
      const { rowCount } = await getPool().query("DELETE FROM maintenance_plans WHERE id=$1", [req.params.id]);
      if (!rowCount) return res.status(404).json({ error: "Plan introuvable" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log("📅 Annual Maintenance Plan routes registered");
}
