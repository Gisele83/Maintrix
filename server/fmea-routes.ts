/**
 * FMEA — Failure Mode and Effects Analysis Routes
 * Analyse des modes de défaillance, de leurs effets et de leur criticité
 * RPN = Sévérité (S) × Occurrence (O) × Détectabilité (D)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { pool as sharedPool } from "./db";
import { coterModeDefaillance } from "@shared/amdec";
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

function genFmeaNumber() {
  return `FMEA-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;
}

const FmeaEntrySchema = z.object({
  id: z.string().optional(),
  processStep: z.string().default(""),
  component: z.string().default(""),
  failureMode: z.string().min(1),
  failureEffect: z.string().default(""),
  failureCause: z.string().default(""),
  currentControls: z.string().default(""),
  severity: z.number().int().min(1).max(10),
  occurrence: z.number().int().min(1).max(10),
  detection: z.number().int().min(1).max(10),
  rpn: z.number().optional(),
  criticalityClass: z.string().optional(),
  recommendedActions: z.string().default(""),
  responsiblePerson: z.string().optional(),
  targetDate: z.string().optional(),
  actionTaken: z.string().optional(),
  newSeverity: z.number().int().min(1).max(10).optional(),
  newOccurrence: z.number().int().min(1).max(10).optional(),
  newDetection: z.number().int().min(1).max(10).optional(),
  newRpn: z.number().optional(),
  status: z.enum(["open", "in_progress", "closed"]).default("open"),
});

const CreateFmeaSchema = z.object({
  title: z.string().min(3),
  scope: z.string().optional(),
  equipmentId: z.number().optional(),
  equipmentName: z.string().optional(),
  processStep: z.string().optional(),
  entries: z.array(FmeaEntrySchema).default([]),
});

const UpdateFmeaSchema = z.object({
  title: z.string().optional(),
  scope: z.string().optional(),
  status: z.enum(["draft", "in_review", "approved", "obsolete"]).optional(),
  entries: z.array(FmeaEntrySchema).optional(),
  revision: z.number().int().optional(),
  reviewedById: z.number().optional(),
});

// La cotation vit dans `shared/amdec.ts` : c est une règle de méthode, pas
// une affaire de route HTTP, et elle doit pouvoir être testée seule.
const computeRpn = coterModeDefaillance;

function enrichEntries(raw: any[]): any[] {
  return (raw || []).map((e, i) => {
    const { rpn, criticalityClass, motifsCriticite } = computeRpn(e.severity, e.occurrence, e.detection);

    // La cotation APRÈS actions se juge avec la même règle : une gravité de 9
    // reste une gravité de 9. Les actions correctives réduisent l occurrence ou
    // améliorent la détection — elles ne changent presque jamais la gravité,
    // qui tient à la nature de la défaillance et non à sa probabilité.
    const apres = e.newSeverity && e.newOccurrence && e.newDetection
      ? computeRpn(e.newSeverity, e.newOccurrence, e.newDetection) : undefined;

    return {
      ...e,
      id: e.id || `entry-${i}`,
      rpn, criticalityClass, motifsCriticite,
      newRpn: apres?.rpn,
      newCriticalityClass: apres?.criticalityClass,
      motifsCriticiteApres: apres?.motifsCriticite,
    };
  });
}

function safeJson(v: any, fb: any) {
  if (!v) return fb;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return fb; }
}

// Traduit une ligne SQL (colonnes snake_case) vers la forme JSON attendue côté client (camelCase) — même
// convention que les autres modules reconstruits cette session. fmea.tsx lit exclusivement des clés
// camelCase (fmeaNumber, equipmentName, processStep...) ; l'ancienne version ne traduisait que `entries`,
// laissant les colonnes réelles en snake_case — le filtre de recherche (`f.fmeaNumber.toLowerCase()`)
// plantait dès qu'une recherche ne matchait pas le titre.
function toApiShape(r: any) {
  return {
    id: r.id,
    fmeaNumber: r.fmea_number,
    title: r.title,
    scope: r.scope,
    equipmentId: r.equipment_id,
    equipmentName: r.equipment_name ?? r.eq_name ?? undefined,
    processStep: r.process_step,
    status: r.status,
    revision: r.revision,
    reviewedById: r.reviewed_by_id,
    entries: enrichEntries(safeJson(r.entries, [])),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function registerFmeaRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  // LIST
  app.get("/api/fmea", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const db = getPool();
      const { status, equipmentId } = req.query;
      let sql = `SELECT f.*, eq.equipment_name AS eq_name FROM fmea_analyses f LEFT JOIN equipment_registry eq ON eq.id = f.equipment_id WHERE f.tenant_id = $1`;
      const params: any[] = [tenantId];
      let i = 2;
      if (status) { sql += ` AND f.status = $${i++}`; params.push(status); }
      if (equipmentId) { sql += ` AND f.equipment_id = $${i++}`; params.push(equipmentId); }
      sql += ` ORDER BY f.updated_at DESC`;
      const { rows } = await db.query(sql, params);
      res.json(rows.map(toApiShape));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // STATS
  app.get("/api/fmea/stats", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const db = getPool();
      const { rows } = await db.query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'draft')::int AS draft,
        COUNT(*) FILTER (WHERE status = 'in_review')::int AS in_review,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved
        FROM fmea_analyses WHERE tenant_id = $1`, [tenantId]);
      // Also aggregate over entries stored as JSON — compute in JS
      const { rows: allRows } = await db.query(`SELECT entries FROM fmea_analyses WHERE tenant_id = $1`, [tenantId]);
      let totalEntries = 0, criticalEntries = 0, highEntries = 0, totalRpn = 0;
      allRows.forEach(r => {
        const entries = enrichEntries(safeJson(r.entries, []));
        totalEntries += entries.length;
        entries.forEach((e: any) => {
          totalRpn += e.rpn || 0;
          if (e.criticalityClass === "critical") criticalEntries++;
          if (e.criticalityClass === "high") highEntries++;
        });
      });
      // ⚠️ `avgRpn` est conservé pour ne pas casser l'affichage existant, mais
      // c'est une statistique trompeuse et elle est désormais nommée comme
      // telle. Le RPN est une grandeur ORDINALE : un RPN de 200 n'est pas
      // « deux fois pire » qu'un RPN de 100, et un écart de 10 entre 20 et 30
      // ne vaut pas celui entre 500 et 510. En faire une moyenne mélange des
      // rangs, et surtout DILUE les modes critiques dans la masse : dix modes
      // anodins font baisser la moyenne autant qu'ils veulent, pendant qu'un
      // mode à gravité 10 reste invisible.
      //
      // Ce sont `criticalEntries` et `rpnMax` qui doivent guider l'action.
      const rpnMax = allRows.reduce((max: number, r: any) => {
        const entries = enrichEntries(safeJson(r.entries, []));
        return entries.reduce((m: number, e: any) => Math.max(m, e.rpn || 0), max);
      }, 0);

      res.json({
        ...rows[0],
        totalEntries,
        criticalEntries,
        highEntries,
        rpnMax: totalEntries > 0 ? rpnMax : undefined,
        avgRpn: totalEntries > 0 ? Math.round(totalRpn / totalEntries) : undefined,
        avertissementAvgRpn:
          "Le RPN est ordinal : sa moyenne dilue les modes critiques et ne doit "
          + "pas servir de pilotage. Suivre le nombre de modes critiques et le RPN maximal.",
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET ONE
  app.get("/api/fmea/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const db = getPool();
      const { rows } = await db.query(`SELECT f.*, eq.equipment_name AS eq_name FROM fmea_analyses f LEFT JOIN equipment_registry eq ON eq.id = f.equipment_id WHERE f.id = $1 AND f.tenant_id = $2`, [req.params.id, tenantId]);
      if (!rows[0]) return res.status(404).json({ error: "FMEA introuvable" });
      res.json(toApiShape(rows[0]));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // CREATE
  app.post("/api/fmea", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = CreateFmeaSchema.parse(req.body);
      const db = getPool();
      const entries = enrichEntries(body.entries.map((e, i) => ({ ...e, id: e.id || `entry-${i}` })));
      const { rows } = await db.query(
        `INSERT INTO fmea_analyses (tenant_id, fmea_number, title, scope, equipment_id, equipment_name, process_step, entries)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [tenantId, genFmeaNumber(), body.title, body.scope || null, body.equipmentId || null, body.equipmentName || null, body.processStep || null, JSON.stringify(entries)]
      );
      res.status(201).json(toApiShape(rows[0]));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // UPDATE
  app.patch("/api/fmea/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = UpdateFmeaSchema.parse(req.body);
      const db = getPool();
      const sets: string[] = [];
      const params: any[] = [];
      let i = 1;
      const add = (col: string, v: any) => { sets.push(`${col}=$${i++}`); params.push(v); };
      if (body.title !== undefined) add("title", body.title);
      if (body.scope !== undefined) add("scope", body.scope);
      if (body.status !== undefined) add("status", body.status);
      if (body.revision !== undefined) add("revision", body.revision);
      if (body.reviewedById !== undefined) add("reviewed_by_id", body.reviewedById);
      if (body.entries !== undefined) {
        const entries = enrichEntries(body.entries.map((e, j) => ({ ...e, id: e.id || `entry-${j}` })));
        add("entries", JSON.stringify(entries));
      }
      add("updated_at", new Date());
      if (!sets.length) return res.json({ message: "Rien à mettre à jour" });
      params.push(req.params.id, tenantId);
      const { rows } = await db.query(`UPDATE fmea_analyses SET ${sets.join(",")} WHERE id=$${i++} AND tenant_id=$${i} RETURNING *`, params);
      if (!rows[0]) return res.status(404).json({ error: "FMEA introuvable" });
      res.json(toApiShape(rows[0]));
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE
  app.delete("/api/fmea/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { rowCount } = await getPool().query("DELETE FROM fmea_analyses WHERE id=$1 AND tenant_id=$2", [req.params.id, tenantId]);
      if (!rowCount) return res.status(404).json({ error: "FMEA introuvable" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log("⚠️  FMEA (Failure Mode & Effects Analysis) routes registered");
}
