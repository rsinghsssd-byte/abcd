import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { initDb, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "roadscan-dev-secret-change-in-prod";
const SALT_ROUNDS = 10;

async function getDb() {
  const { db } = await initDb();
  return db;
}

router.post("/auth/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || typeof username !== "string" || username.trim().length === 0) {
    res.status(400).json({ error: "Username is required" }); return;
  }
  if (!password || typeof password !== "string" || password.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters" }); return;
  }

  const trimmed = username.trim().toLowerCase().slice(0, 32);
  const db = await getDb();
  const existing = await db.select().from(usersTable).where(eq(usersTable.username, trimmed)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Username already taken" }); return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [user] = await db.insert(usersTable).values({
    username: trimmed,
    passwordHash,
    displayName: username.trim(),
  }).returning();

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ user, token });
});

router.post("/auth/signin", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" }); return;
  }

  const trimmed = username.trim().toLowerCase();
  const db = await getDb();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, trimmed)).limit(1);
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid username or password" }); return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" }); return;
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ user, token });
});

router.get("/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" }); return;
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number };
    const db = await getDb();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ user });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
