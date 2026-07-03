import { Pool } from "pg";
import dns from "node:dns";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.log("No DATABASE_URL, skipping migration");
  process.exit(0);
}

console.log(">>> migrate.ts started <<<");
console.log("DATABASE_URL host =", new URL(DATABASE_URL).hostname);

function resolveIPv4(host: string): Promise<string> {
  return new Promise((resolve, reject) => {
    dns.lookup(host, { family: 4, all: false }, (err, address) => {
      if (err) return reject(new Error(`DNS failed for ${host}: ${err.message}`));
      console.log(`Resolved ${host} => ${address} (IPv4)`);
      resolve(address);
    });
  });
}

async function buildPoolOptions(): Promise<{ connectionString: string }> {
  const url = new URL(DATABASE_URL);
  const originalHost = url.hostname;

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(originalHost)) {
    console.log("Host is already an IPv4 address, using as-is");
    return { connectionString: DATABASE_URL };
  }

  try {
    const ipv4 = await resolveIPv4(originalHost);
    url.hostname = ipv4;
    console.log("Pool connection URL host =", url.hostname);
    return { connectionString: url.toString() };
  } catch (dnsErr) {
    console.warn(`IPv4 resolution failed: ${(dnsErr as Error).message}`);
    console.warn("Falling back to original URL — may connect via IPv6 if available");
    return { connectionString: DATABASE_URL };
  }
}

async function migrate() {
  let pool;
  try {
    const poolOpts = await buildPoolOptions();
    console.log("Creating pg Pool with host:", new URL(poolOpts.connectionString).hostname);
    pool = new Pool(poolOpts);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL DEFAULT '',
          display_name TEXT,
          onboarding_completed BOOLEAN DEFAULT FALSE,
          preferences JSONB DEFAULT '{}',
          theme TEXT DEFAULT 'paper',
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS detections (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          filename TEXT NOT NULL,
          media_type TEXT NOT NULL,
          original_url TEXT NOT NULL,
          annotated_url TEXT NOT NULL,
          thumbnail_url TEXT,
          objects JSONB NOT NULL,
          counts JSONB NOT NULL,
          processing_time_ms INTEGER NOT NULL,
          severity TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `);

      await client.query("COMMIT");
      console.log("Database migration applied successfully");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Migration failed:", err);
      process.exit(1);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Failed to connect to database:", err);
    process.exit(1);
  } finally {
    if (pool) await pool.end();
  }
}

migrate();
