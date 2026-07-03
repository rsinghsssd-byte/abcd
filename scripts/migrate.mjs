import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.log("No DATABASE_URL, skipping migration");
  process.exit(0);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function migrate() {
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
    await pool.end();
  }
}

migrate();
