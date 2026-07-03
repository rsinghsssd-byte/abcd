import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import dns from "node:dns";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function resolveIPv4(host: string): Promise<string> {
  return new Promise((resolve, reject) => {
    dns.lookup(host, { family: 4, all: false }, (err, address) => {
      if (err) {
        console.warn(`DB IPv4 resolve failed for ${host}: ${err.message}`);
        return reject(err);
      }
      console.log(`DB: ${host} → ${address} (IPv4)`);
      resolve(address);
    });
  });
}

async function createPool(): Promise<Pool> {
  const url = new URL(process.env.DATABASE_URL!);
  const originalHost = url.hostname;

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(originalHost)) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }

  let ipv4: string | null = null;
  try {
    ipv4 = await resolveIPv4(originalHost);
  } catch {
    // fallback to original hostname
  }

  const connStr = ipv4
    ? process.env.DATABASE_URL!.replace(originalHost, ipv4)
    : process.env.DATABASE_URL;
  return new Pool({ connectionString: connStr });
}

let dbInit: Promise<{ pool: Pool; db: ReturnType<typeof drizzle> }>;

export function initDb() {
  if (!dbInit) {
    dbInit = createPool().then((pool) => {
      const db = drizzle(pool, { schema });
      return { pool, db };
    });
  }
  return dbInit;
}

export * from "./schema";
