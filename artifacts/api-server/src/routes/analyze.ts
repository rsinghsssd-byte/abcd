import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { db, detectionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { runDetection } from "../lib/detector";
import { logger } from "../lib/logger";

const apiServerDir = path.resolve(import.meta.dirname ?? __dirname, "..");
const uploadsDir = path.resolve(apiServerDir, "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(uploadsDir, "originals"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|bmp|webp|mp4|mov|avi|mkv|webm)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router: IRouter = Router();

function fileUrl(filename: string, subdir: string): string {
  return `/api/uploads/${subdir}/${filename}`;
}

router.post("/analyze/image", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const originalName = req.file.filename;
  const base = originalName.replace(/\.[^.]+$/, "");
  const annotatedName = `annotated-${base}.jpg`;
  const thumbnailName = `thumb-${base}.jpg`;

  const inputPath = path.join(uploadsDir, "originals", originalName);
  const annotatedPath = path.join(uploadsDir, "annotated", annotatedName);
  const thumbnailPath = path.join(uploadsDir, "thumbnails", thumbnailName);

  try {
    const result = await runDetection(inputPath, annotatedPath, thumbnailPath, "image");

    const username = req.headers["x-username"] as string | undefined;
    let userId: number | null = null;
    if (username) {
      const user = await db.select().from(usersTable).where(eq(usersTable.username, username.toLowerCase().trim())).limit(1);
      if (user.length > 0) userId = user[0].id;
    }

    const [detection] = await db
      .insert(detectionsTable)
      .values({
        userId,
        filename: req.file.originalname,
        mediaType: "image",
        originalUrl: fileUrl(originalName, "originals"),
        annotatedUrl: fileUrl(annotatedName, "annotated"),
        thumbnailUrl: fileUrl(thumbnailName, "thumbnails"),
        objects: result.objects,
        counts: result.counts,
        processingTimeMs: result.processingTimeMs,
        severity: result.severity,
      })
      .returning();

    req.log.info({ id: detection.id, objects: result.counts.total, aiPowered: result.aiPowered }, "Image analyzed");
    res.json(detection);
  } catch (err) {
    req.log.error({ err }, "Image analysis failed");
    res.status(500).json({ error: "Analysis failed" });
  }
});

router.post("/analyze/video", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const originalName = req.file.filename;
  const base = originalName.replace(/\.[^.]+$/, "");
  const annotatedName = `annotated-${base}.jpg`;
  const thumbnailName = `thumb-${base}.jpg`;

  const inputPath = path.join(uploadsDir, "originals", originalName);
  const annotatedPath = path.join(uploadsDir, "annotated", annotatedName);
  const thumbnailPath = path.join(uploadsDir, "thumbnails", thumbnailName);

  try {
    const result = await runDetection(inputPath, annotatedPath, thumbnailPath, "video");

    const username = req.headers["x-username"] as string | undefined;
    let userId: number | null = null;
    if (username) {
      const user = await db.select().from(usersTable).where(eq(usersTable.username, username.toLowerCase().trim())).limit(1);
      if (user.length > 0) userId = user[0].id;
    }

    const [detection] = await db
      .insert(detectionsTable)
      .values({
        userId,
        filename: req.file.originalname,
        mediaType: "video",
        originalUrl: fileUrl(originalName, "originals"),
        annotatedUrl: fileUrl(annotatedName, "annotated"),
        thumbnailUrl: fileUrl(thumbnailName, "thumbnails"),
        objects: result.objects,
        counts: result.counts,
        processingTimeMs: result.processingTimeMs,
        severity: result.severity,
      })
      .returning();

    req.log.info({ id: detection.id, objects: result.counts.total, aiPowered: result.aiPowered }, "Video analyzed");
    res.json(detection);
  } catch (err) {
    req.log.error({ err }, "Video analysis failed");
    res.status(500).json({ error: "Analysis failed" });
  }
});

router.post("/analyze/frame", memUpload.single("frame"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No frame data" });
    return;
  }

  try {
    const frameName = `frame-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const base = frameName.replace(/\.[^.]+$/, "");
    const annotatedName = `annotated-${base}.jpg`;
    const thumbnailName = `thumb-${base}.jpg`;

    const inputPath = path.join(uploadsDir, "originals", frameName);
    const annotatedPath = path.join(uploadsDir, "annotated", annotatedName);
    const thumbnailPath = path.join(uploadsDir, "thumbnails", thumbnailName);

    const fs = await import("node:fs/promises");
    await fs.writeFile(inputPath, req.file.buffer);

    const result = await runDetection(inputPath, annotatedPath, thumbnailPath, "image");

    const username = req.headers["x-username"] as string | undefined;
    let userId: number | null = null;
    if (username) {
      const user = await db.select().from(usersTable).where(eq(usersTable.username, username.toLowerCase().trim())).limit(1);
      if (user.length > 0) userId = user[0].id;
    }

    const [detection] = await db
      .insert(detectionsTable)
      .values({
        userId,
        filename: `camera-${new Date().toISOString().slice(0, 19).replace("T", "-")}.jpg`,
        mediaType: "image",
        originalUrl: fileUrl(frameName, "originals"),
        annotatedUrl: fileUrl(annotatedName, "annotated"),
        thumbnailUrl: fileUrl(thumbnailName, "thumbnails"),
        objects: result.objects,
        counts: result.counts,
        processingTimeMs: result.processingTimeMs,
        severity: result.severity,
      })
      .returning();

    req.log.info({ id: detection.id, objects: result.counts.total, source: "camera" }, "Frame saved");
    res.json(detection);
  } catch (err) {
    logger.error({ err }, "Frame analysis failed");
    res.status(500).json({ error: "Frame analysis failed" });
  }
});

export default router;
