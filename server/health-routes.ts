/**
 * Health Routes — GET /api/health
 *
 * Sonde de santé destinée à l'INFRASTRUCTURE (Docker HEALTHCHECK, docker-compose,
 * ECS, load balancer ALB, scripts de déploiement). Volontairement minimale.
 *
 * Distincte de /api/system/health (server/system-health-routes.ts), qui reste le
 * diagnostic détaillé réservé aux administrateurs authentifiés.
 *
 * Contrat :
 *   200 + {"status":"ok"}          → l'application sert le trafic
 *   503 + {"status":"unavailable"} → une dépendance critique l'en empêche
 *
 * Trois propriétés sont volontaires et ne doivent pas être « améliorées » :
 *
 *  1. AUCUNE INFORMATION SENSIBLE. Pas de version, pas de NODE_ENV, pas de nom
 *     d'hôte, pas de message d'erreur PostgreSQL (il contient l'hôte et
 *     l'utilisateur de la base). Un endpoint non authentifié ne doit rien
 *     apprendre à un attaquant sur la topologie interne.
 *
 *  2. SONDE VIVANTE, PAS DE DRAPEAU EN CACHE. `isDatabaseReady()` de db.ts est
 *     figé au démarrage : il resterait à `true` après une perte de PostgreSQL.
 *     On exécute donc un vrai `SELECT 1` à chaque appel.
 *
 *  3. DÉLAI COURT ET BORNÉ. Le pool est configuré avec
 *     connectionTimeoutMillis=10000 ; sans borne propre, la sonde dépasserait le
 *     `timeout: 10s` du HEALTHCHECK Docker, qui conclurait « unhealthy » sur un
 *     dépassement de délai au lieu du 503 explicite. On répond donc toujours
 *     rapidement, quitte à répondre 503.
 */

import type { Express, Request, Response } from "express";
import { pool } from "./db";

/** Marge confortable sous le `timeout: 10s` des HEALTHCHECK Docker/ECS. */
const DB_PROBE_TIMEOUT_MS = 2500;

/**
 * Vérifie que PostgreSQL répond réellement, sans jamais dépasser
 * DB_PROBE_TIMEOUT_MS ni propager le détail de l'erreur.
 */
async function isDatabaseLive(): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;

  // La requête peut échouer APRÈS l'expiration du délai : on neutralise son
  // rejet ici, sinon Node signale une promesse rejetée non gérée.
  const query = pool.query("SELECT 1").then(
    () => true,
    () => false,
  );

  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), DB_PROBE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([query, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function registerHealthRoutes(app: Express): void {
  app.get("/api/health", async (_req: Request, res: Response) => {
    const databaseLive = await isDatabaseLive();

    // Une sonde ne doit jamais être servie depuis un cache intermédiaire.
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");

    res.status(databaseLive ? 200 : 503).json({
      status: databaseLive ? "ok" : "unavailable",
      checks: {
        database: databaseLive ? "ok" : "unavailable",
      },
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });
}
