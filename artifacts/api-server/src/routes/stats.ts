import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, detectionsTable, type DetectedObject } from "@workspace/db";

const router: IRouter = Router();

router.get("/stats", async (req, res): Promise<void> => {
  try {
    const all = await db
      .select()
      .from(detectionsTable)
      .orderBy(desc(detectionsTable.createdAt));

    const totalScans = all.length;
    let totalObjects = 0;
    const classBreakdown = { pothole: 0, plastic_waste: 0, other_litter: 0, total: 0 };
    const severityBreakdown = { low: 0, medium: 0, high: 0, critical: 0 };
    let sumConfidence = 0;
    let confCount = 0;
    let sumProcessingMs = 0;

    const activityMap = new Map<string, { scans: number; objects: number }>();

    for (const d of all) {
      const c = (d.counts as Record<string, number>) ?? { pothole: 0, plastic_waste: 0, other_litter: 0, total: 0 };
      classBreakdown.pothole += Number(c.pothole) || 0;
      classBreakdown.plastic_waste += Number(c.plastic_waste) || 0;
      classBreakdown.other_litter += Number(c.other_litter) || 0;
      classBreakdown.total += Number(c.total) || 0;
      totalObjects += Number(c.total) || 0;

      const sev = String(d.severity ?? "low") as keyof typeof severityBreakdown;
      severityBreakdown[sev] = (severityBreakdown[sev] || 0) + 1;
      sumProcessingMs += Number(d.processingTimeMs) || 0;

      const objs = (d.objects as DetectedObject[]) ?? [];
      for (const obj of objs) {
        sumConfidence += Number(obj.confidence) || 0;
        confCount++;
      }

      const dateKey = new Date(d.createdAt).toISOString().split("T")[0];
      const existing = activityMap.get(dateKey) ?? { scans: 0, objects: 0 };
      activityMap.set(dateKey, {
        scans: existing.scans + 1,
        objects: existing.objects + Number(c.total) || 0,
      });
    }

    const sortedDates = [...activityMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, val]) => ({ date, ...val }));

    res.json({
      totalScans,
      totalObjects,
      classBreakdown,
      severityBreakdown,
      avgConfidence: confCount > 0 ? parseFloat((sumConfidence / confCount).toFixed(3)) : 0,
      avgProcessingMs: totalScans > 0 ? parseFloat((sumProcessingMs / totalScans).toFixed(1)) : 0,
      recentActivity: sortedDates,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to compute stats");
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/recent", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(detectionsTable)
      .orderBy(desc(detectionsTable.createdAt))
      .limit(5);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to load recent detections");
    res.status(500).json({ error: "Failed to load recent detections" });
  }
});

export default router;
