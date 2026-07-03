import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, detectionsTable } from "@workspace/db";
import {
  ListDetectionsQueryParams,
  GetDetectionParams,
  DeleteDetectionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/detections", async (req, res): Promise<void> => {
  try {
    const parsed = ListDetectionsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { limit = 20, offset = 0, mediaType = "all" } = parsed.data;

    const whereClause =
      mediaType !== "all"
        ? eq(detectionsTable.mediaType, mediaType as "image" | "video")
        : undefined;

    const [rows, [totalRow]] = await Promise.all([
      db
        .select()
        .from(detectionsTable)
        .where(whereClause as any)
        .orderBy(desc(detectionsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(detectionsTable)
        .where(whereClause as any),
    ]);

    res.json({ items: rows, total: totalRow?.count ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to list detections");
    res.status(500).json({ error: "Failed to load detections" });
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

  res.json(detection);
});

router.delete("/detections/:id", async (req, res): Promise<void> => {
  const params = DeleteDetectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(detectionsTable)
    .where(eq(detectionsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Detection not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
