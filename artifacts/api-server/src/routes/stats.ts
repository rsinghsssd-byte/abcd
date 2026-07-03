import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { initDb, detectionsTable } from "@workspace/db";

const router: IRouter = Router();

async function getDb() {
  const { db } = await initDb();
  return db;
}

router.get("/stats", async (req, res): Promise<void> => {
  const db = await getDb();
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
    const c = d.counts as { pothole: number; plastic_waste: number; other_litter: number; total: number };
    classBreakdown.pothole += c.pothole;
    classBreakdown.plastic_waste += c.plastic_waste;
    classBreakdown.other_litter += c.other_litter;
    classBreakdown.total += c.total;
    totalObjects += c.total;

    severityBreakdown[d.severity as keyof typeof severityBreakdown]++;
    sumProcessingMs += d.processingTimeMs;

    const objs = d.objects as Array<{ confidence: number }>;
    for (const obj of objs) {
      sumConfidence += obj.confidence;
      confCount++;
    }

    const dateKey = new Date(d.createdAt).toISOString().split("T")[0];
    const existing = activityMap.get(dateKey) ?? { scans: 0, objects: 0 };
    activityMap.set(dateKey, {
      scans: existing.scans + 1,
      objects: existing.objects + c.total,
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
});

router.get("/recent", async (req, res): Promise<void> => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(detectionsTable)
    .orderBy(desc(detectionsTable.createdAt))
    .limit(5);

  res.json(rows);
});

export default router;
