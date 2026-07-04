export interface DetectionCounts {
  pothole: number;
  plastic_waste: number;
  other_litter: number;
  total: number;
}

const EMPTY_COUNTS: DetectionCounts = { pothole: 0, plastic_waste: 0, other_litter: 0, total: 0 };

export function safeCounts(raw: unknown): DetectionCounts {
  if (!raw) return EMPTY_COUNTS;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { return EMPTY_COUNTS; }
  }
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    return {
      pothole: Number(o.pothole) || 0,
      plastic_waste: Number(o.plastic_waste) || 0,
      other_litter: Number(o.other_litter) || 0,
      total: Number(o.total) || 0,
    };
  }
  return EMPTY_COUNTS;
}
