import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { execSync } from "child_process";
import { existsSync } from "fs";
import * as schema from "@shared/schema";

const PGDATA = "/home/runner/workspace/.pgdata";
const LOCAL_PGPORT = "5433";

/** Attend que le socket PostgreSQL soit disponible (max ~10s) */
function waitForSocket(maxAttempts = 20, delayMs = 500): boolean {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      execSync(
        `PGHOST=/tmp PGPORT=${LOCAL_PGPORT} PGUSER=runner psql -d postgres -c "SELECT 1" -q`,
        { stdio: 'pipe' }
      );
      return true;
    } catch {
      if (i < maxAttempts - 1) {
        execSync(`sleep 0.5`);
      }
    }
  }
  return false;
}

function startLocalPostgres(): string {
  try {
    if (!existsSync(PGDATA)) {
      console.log("📦 Initializing local PostgreSQL data directory...");
      execSync(`initdb -D "${PGDATA}" --no-locale --encoding=UTF8`, { stdio: 'pipe' });
    }

    try {
      execSync(`pg_ctl -D "${PGDATA}" status`, { stdio: 'pipe' });
      console.log("✅ Local PostgreSQL is already running");
    } catch {
      console.log(`🚀 Starting local PostgreSQL on port ${LOCAL_PGPORT}...`);
      execSync(`pg_ctl -D "${PGDATA}" -l "${PGDATA}/logfile" -o "-p ${LOCAL_PGPORT} -k /tmp" start`, { stdio: 'pipe' });
    }

    // ⏳ Attendre que le socket soit réellement prêt (évite la race condition)
    console.log("⏳ Waiting for PostgreSQL socket...");
    if (!waitForSocket()) {
      throw new Error("PostgreSQL socket not available after 10s");
    }
    console.log("✅ PostgreSQL socket ready");

    try {
      const result = execSync(`PGHOST=/tmp PGPORT=${LOCAL_PGPORT} PGUSER=runner psql -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'maintrix'"`, { encoding: 'utf-8', stdio: 'pipe' });
      if (!result.trim().includes('1')) {
        throw new Error('DB not found');
      }
    } catch {
      console.log("📦 Creating maintrix database...");
      execSync(`PGHOST=/tmp PGPORT=${LOCAL_PGPORT} PGUSER=runner createdb maintrix`, { stdio: 'pipe' });
    }

    const localUrl = `postgresql://runner@localhost:${LOCAL_PGPORT}/maintrix?host=/tmp`;
    console.log("✅ Local PostgreSQL ready");
    return localUrl;
  } catch (err: any) {
    console.error("⚠️ Failed to start local PostgreSQL:", err.message);
    return "";
  }
}

let connectionString = process.env.DATABASE_URL || "";

const isNeonDisabled = connectionString.includes("neon.tech");
if (isNeonDisabled) {
  console.log("⚠️ Neon endpoint detected, switching to local PostgreSQL...");
  const localUrl = startLocalPostgres();
  if (localUrl) {
    connectionString = localUrl;
  }
}

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new pg.Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Database pool error:', err.message);
});

let dbReady = false;

async function testConnection(retries = 5, delay = 3000): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('✅ Database connection established successfully');
      dbReady = true;
      return true;
    } catch (err: any) {
      console.error(`⚠️ Database connection attempt ${i + 1}/${retries} failed: ${err.message}`);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('❌ Database connection failed after all retries. App will start without DB.');
  dbReady = false;
  return false;
}

export function isDatabaseReady(): boolean {
  return dbReady;
}

export async function initDatabase(): Promise<boolean> {
  const dbHost = connectionString?.replace(/^.*@/, '').replace(/\/.*$/, '') || 'unknown';
  console.log(`🔌 Database host: ${dbHost}`);
  return testConnection();
}

export { connectionString as databaseUrl };

// Rendre l'URL locale disponible pour les modules qui utilisent getPool()
(global as any).__localDbUrl = connectionString;

export const db = drizzle({ client: pool, schema });
