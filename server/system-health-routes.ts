/**
 * System Health Routes — /api/system/health
 * Fournit un état détaillé de la plateforme pour les administrateurs :
 * base de données, modules, espace disque, mémoire, et métriques de code.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { pool as sharedPool } from "./db";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit, requireRole } from "./security-middleware";
import os from "os";
import fs from "fs";
import path from "path";

interface TenantRequest extends Request {
  tenantId?: string;
  user?: any;
}

function getPool(): Pool {
  return sharedPool;
}

// Toutes ces tables sont scopées par tenant (tenant_id) sauf iot_sensor_data (données du simulateur
// IoT partagé, sans tenant_id) — comptées par tenant pour éviter qu'un admin d'un tenant ne voie les
// volumes d'activité des autres tenants via ce endpoint de santé système.
async function getDbHealth(tenantId: string): Promise<Record<string, any>> {
  const db = getPool();
  const start = Date.now();
  try {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM equipment_registry WHERE tenant_id = $1)::int  AS equipment,
        (SELECT COUNT(*) FROM work_orders WHERE tenant_id = $1)::int         AS work_orders,
        (SELECT COUNT(*) FROM oee_records WHERE tenant_id = $1)::int         AS oee_records,
        (SELECT COUNT(*) FROM rca_analyses WHERE tenant_id = $1)::int        AS rca_analyses,
        (SELECT COUNT(*) FROM fmea_analyses WHERE tenant_id = $1)::int       AS fmea_analyses,
        (SELECT COUNT(*) FROM asset_lifecycle WHERE tenant_id = $1)::int     AS assets,
        (SELECT COUNT(*) FROM budget_plans WHERE tenant_id = $1)::int        AS budgets,
        (SELECT COUNT(*) FROM calibration_records WHERE tenant_id = $1)::int AS calibrations,
        (SELECT COUNT(*) FROM maintenance_cases WHERE tenant_id = $1)::int   AS maintenance_cases,
        (SELECT COUNT(*) FROM alerts_notifications WHERE tenant_id = $1)::int AS alerts,
        (SELECT COUNT(*) FROM iot_sensor_data)::int     AS iot_data,
        pg_size_pretty(pg_database_size(current_database())) AS db_size
    `, [tenantId]);
    const latencyMs = Date.now() - start;
    return { status: "ok", latencyMs, tables: rows[0] };
  } catch (e: any) {
    return { status: "error", error: e.message };
  }
}

function getSystemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPct = Math.round((usedMem / totalMem) * 100);

  const cpus = os.cpus();
  const avgLoad = os.loadavg();

  return {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    uptime: Math.round(process.uptime()),
    memory: {
      totalMb: Math.round(totalMem / 1024 / 1024),
      usedMb: Math.round(usedMem / 1024 / 1024),
      freeMb: Math.round(freeMem / 1024 / 1024),
      usedPct: memPct,
    },
    cpu: {
      model: cpus[0]?.model ?? "unknown",
      cores: cpus.length,
      loadAvg1m: Math.round(avgLoad[0] * 100) / 100,
    },
  };
}

function getCodebaseMetrics() {
  const serverDir = path.join(process.cwd(), "server");
  const clientDir = path.join(process.cwd(), "client/src");
  const sharedDir = path.join(process.cwd(), "shared");

  function countFiles(dir: string, ext: string): number {
    try {
      const files = fs.readdirSync(dir, { recursive: true } as any) as string[];
      return files.filter((f: string) => f.endsWith(ext)).length;
    } catch { return 0; }
  }

  const serverFiles = countFiles(serverDir, ".ts");
  const clientFiles = countFiles(clientDir, ".tsx") + countFiles(clientDir, ".ts");
  const sharedFiles = countFiles(sharedDir, ".ts");

  return {
    serverFiles,
    clientFiles,
    sharedFiles,
    totalFiles: serverFiles + clientFiles + sharedFiles,
    pdfGenerators: 3,
    excelProcessors: 4,
    routeModules: 29,
  };
}

function getModuleStatus() {
  const modules = [
    { id: "gmao", name: "GMAO (Ordres de travail, équipements)", status: "active" },
    { id: "diagnostic", name: "Diagnostic IA (Hybride CCTP)", status: "active" },
    { id: "oee", name: "OEE — Disponibilité × Performance × Qualité", status: "active" },
    { id: "rca", name: "RCA — Analyse causes racines", status: "active" },
    { id: "fmea", name: "FMEA / AMDEC", status: "active" },
    { id: "assets", name: "Gestion du cycle de vie des actifs", status: "active" },
    { id: "budget", name: "Budget maintenance", status: "active" },
    { id: "calibration", name: "Étalonnage instruments", status: "active" },
    { id: "ptw", name: "Permis de travail (PTW)", status: "active" },
    { id: "cognitive", name: "Infrastructure cognitive (5 modules)", status: "active" },
    { id: "iot", name: "Connecteur IoT (MQTT + capteurs)", status: "active" },
    { id: "multitenant", name: "Architecture multi-tenant SaaS", status: "active" },
    { id: "mobile", name: "Application mobile React Native", status: "active" },
    { id: "desktop", name: "Application desktop Electron", status: "active" },
  ];
  return modules;
}

export function registerSystemHealthRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  const adminOnly = requireRole(["admin", "owner", "super_admin"]);

  app.get("/api/system/health", generalRateLimit, auth, adminOnly, async (req: TenantRequest, res: Response) => {
    try {
      if (!req.tenantId) return res.status(400).json({ overall: "error", error: "Tenant non résolu pour cette requête" });
      const [db, system, code, modules] = await Promise.all([
        getDbHealth(req.tenantId),
        Promise.resolve(getSystemMetrics()),
        Promise.resolve(getCodebaseMetrics()),
        Promise.resolve(getModuleStatus()),
      ]);

      const overall =
        db.status === "ok" && system.memory.usedPct < 90
          ? "healthy"
          : db.status !== "ok"
          ? "degraded"
          : "warning";

      res.json({
        overall,
        timestamp: new Date().toISOString(),
        version: "2.6.0",
        environment: process.env.NODE_ENV ?? "development",
        database: db,
        system,
        codebase: code,
        modules,
      });
    } catch (e: any) {
      res.status(500).json({ overall: "error", error: e.message });
    }
  });
}
