import { Router, type IRouter } from "express";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { db, detectionsTable, usersTable } from "@workspace/db";
import {
  ListDetectionsQueryParams,
  GetDetectionParams,
  DeleteDetectionParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/detections", requireAuth, async (req, res): Promise<void> => {
  try {
    const parsed = ListDetectionsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { limit = 20, offset = 0, mediaType = "all" } = parsed.data;

    const conditions: any[] = [eq(detectionsTable.userId, req.userId as number)];
    if (mediaType !== "all") {
      conditions.push(eq(detectionsTable.mediaType, mediaType as "image" | "video"));
    }
    const whereClause = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(detectionsTable)
        .where(whereClause)
        .orderBy(desc(detectionsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(detectionsTable)
        .where(whereClause),
    ]);

    res.json({
      items: rows.map(r => ({ ...r, lat: r.latitude, lon: r.longitude })),
      total: totalRow?.count ?? 0
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list detections");
    res.status(500).json({ error: "Failed to load detections" });
  }
});

router.get("/detections/map", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        detection: detectionsTable,
        reporterName: usersTable.displayName,
        reporterUsername: usersTable.username,
      })
      .from(detectionsTable)
      .leftJoin(usersTable, eq(detectionsTable.userId, usersTable.id))
      .where(sql`${detectionsTable.latitude} IS NOT NULL`)
      .orderBy(desc(detectionsTable.createdAt));

    res.json(rows.map(r => ({ 
      ...r.detection, 
      lat: r.detection.latitude, 
      lon: r.detection.longitude,
      reporterName: r.reporterName || r.reporterUsername || 'Anonymous'
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to load map detections");
    res.status(500).json({ error: "Failed to load map detections" });
  }
});

router.get("/detections/:id", async (req, res): Promise<void> => {
  const params = GetDetectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [detection] = await db
    .select()
    .from(detectionsTable)
    .where(eq(detectionsTable.id, params.data.id));

  if (!detection) {
    res.status(404).json({ error: "Detection not found" });
    return;
  }

  res.json({ ...detection, lat: detection.latitude, lon: detection.longitude });
});

router.delete("/detections/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteDetectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(detectionsTable)
    .where(and(eq(detectionsTable.id, params.data.id), eq(detectionsTable.userId, req.userId as number)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Detection not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
