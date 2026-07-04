import { Router, type IRouter } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db, detectionsTable } from "@workspace/db";
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

    const conditions: any[] = [eq(detectionsTable.userId, req.userId)];
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

    res.json({ items: rows, total: totalRow?.count ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to list detections");
    res.status(500).json({ error: "Failed to load detections" });
  }
});

router.get("/detections/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetDetectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [detection] = await db
    .select()
    .from(detectionsTable)
    .where(and(eq(detectionsTable.id, params.data.id), eq(detectionsTable.userId, req.userId)));

  if (!detection) {
    res.status(404).json({ error: "Detection not found" });
    return;
  }

  res.json(detection);
});

router.delete("/detections/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteDetectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(detectionsTable)
    .where(and(eq(detectionsTable.id, params.data.id), eq(detectionsTable.userId, req.userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Detection not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
