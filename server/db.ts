import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const connectionString = process.env.DATABASE_URL || "";

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

export const db = drizzle({ client: pool, schema });
