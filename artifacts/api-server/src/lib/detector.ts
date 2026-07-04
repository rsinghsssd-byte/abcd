import sharp, { type OverlayOptions } from "sharp";
import { v4 as uuidv4 } from "uuid";
import fs from "node:fs";
import path from "node:path";
import type { DetectedObject, DetectionCounts } from "@workspace/db";

type Severity = "low" | "medium" | "high" | "critical";

const MODELS_DIR = path.resolve(
  import.meta.dirname ?? __dirname,
  "../models",
);

const POTHOLENET_PATH = path.join(MODELS_DIR, "potholenet.onnx");
const POTHOLENET_LABELS = ["pothole", "road_damage", "garbage"];
const POTHOLENET_INPUT_SIZE = 768;
const POTHOLENET_CONF_THRESHOLD = 0.25;
const POTHOLENET_IOU_THRESHOLD = 0.45;

const LITTERCAM_PATH = path.join(MODELS_DIR, "littercam.onnx");
const LITTERCAM_LABELS = [
  "cigarette_butt", "plastic_bottle", "drinks_can", "fast_food_packaging",
  "plastic_bag", "coffee_cup", "glass_bottle", "paper_waste",
  "food_wrapper", "general_litter",
];
const LITTERCAM_INPUT_SIZE = 640;
const LITTERCAM_CONF_THRESHOLD = 0.25;
const LITTERCAM_IOU_THRESHOLD = 0.45;

function loadLabels(path: string, fallback: string[]): string[] {
  try {
    if (fs.existsSync(path)) return JSON.parse(fs.readFileSync(path, "utf-8"));
  } catch {}
  return fallback;
}

const CLASS_COLORS: Record<string, { r: number; g: number; b: number }> = {
  pothole:       { r: 220, g: 38, b: 38 },
  plastic_waste: { r: 234, g: 179, b: 8 },
  other_litter:  { r: 249, g: 115, b: 22 },
};

function mapPotholeNetLabel(rawLabel: string): DetectedObject["className"] | null {
  const n = rawLabel.toLowerCase().replace(/[\s-]+/g, "_");
  if (n === "pothole") return "pothole";
  if (n === "road_damage") return "other_litter";
  if (n === "garbage") return "plastic_waste";
  return null;
}

function mapLitterCamLabel(rawLabel: string): DetectedObject["className"] | null {
  const n = rawLabel.toLowerCase().replace(/[\s-]+/g, "_");
  if (["plastic_bottle", "plastic_bag"].includes(n)) return "plastic_waste";
  if ([
    "cigarette_butt", "drinks_can", "fast_food_packaging", "coffee_cup",
    "glass_bottle", "paper_waste", "food_wrapper", "general_litter",
  ].includes(n)) return "other_litter";
  return null;
}

type ModelConfig = {
  path: string;
  defaultLabels: string[];
  inputSize: number;
  confThreshold: number;
  iouThreshold: number;
  labelMapper: (label: string) => DetectedObject["className"] | null;
};

const POTHOLENET_CFG: ModelConfig = {
  path: POTHOLENET_PATH,
  defaultLabels: loadLabels(path.join(MODELS_DIR, "potholenet_labels.json"), POTHOLENET_LABELS),
  inputSize: POTHOLENET_INPUT_SIZE,
  confThreshold: POTHOLENET_CONF_THRESHOLD,
  iouThreshold: POTHOLENET_IOU_THRESHOLD,
  labelMapper: mapPotholeNetLabel,
};

const LITTERCAM_CFG: ModelConfig = {
  path: LITTERCAM_PATH,
  defaultLabels: loadLabels(path.join(MODELS_DIR, "littercam_labels.json"), LITTERCAM_LABELS),
  inputSize: LITTERCAM_INPUT_SIZE,
  confThreshold: LITTERCAM_CONF_THRESHOLD,
  iouThreshold: LITTERCAM_IOU_THRESHOLD,
  labelMapper: mapLitterCamLabel,
};

function isModelAvailable(cfg: ModelConfig): boolean {
  return fs.existsSync(cfg.path);
}

type Candidate = {
  className: DetectedObject["className"];
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

async function detectWithOnnx(
  imageBuffer: Buffer,
  cfg: ModelConfig,
  session?: import("onnxruntime-node").InferenceSession,
): Promise<DetectedObject[]> {
  const ort = await import("onnxruntime-node");
  const s = session ?? await ort.InferenceSession.create(cfg.path, { executionProviders: ["cpu"] });

  const { data, info } = await sharp(imageBuffer)
    .resize(cfg.inputSize, cfg.inputSize, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const numPixels = width * height;
  const chw = new Float32Array(3 * numPixels);
  for (let i = 0; i < numPixels; i++) {
    chw[i] = data[i * 3] / 255;
    chw[numPixels + i] = data[i * 3 + 1] / 255;
    chw[2 * numPixels + i] = data[i * 3 + 2] / 255;
  }

  const inputTensor = new ort.Tensor("float32", chw, [1, 3, height, width]);
  const inputName = s.inputNames[0];
  const outputs = await s.run({ [inputName]: inputTensor });
  const outputName = s.outputNames[0];
  const output = outputs[outputName];

  const [, numAttrs, numBoxes] = output.dims as number[];
  const numClasses = numAttrs - 4;
  const raw = output.data as Float32Array;

  const candidates: Candidate[] = [];

  for (let i = 0; i < numBoxes; i++) {
    let bestClass = -1;
    let bestScore = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = raw[(4 + c) * numBoxes + i];
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }
    if (bestScore < cfg.confThreshold || bestClass === -1) continue;

    const mapped = cfg.labelMapper(cfg.defaultLabels[bestClass] ?? String(bestClass));
    if (!mapped) continue;

    const cx = raw[i];
    const cy = raw[numBoxes + i];
    const w = raw[2 * numBoxes + i];
    const h = raw[3 * numBoxes + i];

    const maxRaw = Math.max(cx, cy, w, h);
    const normalized = maxRaw <= 1.0;

    let nx: number, ny: number, nw: number, nh: number;
    if (normalized) {
      nx = cx - w / 2;
      ny = cy - h / 2;
      nw = w;
      nh = h;
    } else {
      nx = (cx - w / 2) / cfg.inputSize;
      ny = (cy - h / 2) / cfg.inputSize;
      nw = w / cfg.inputSize;
      nh = h / cfg.inputSize;
    }

    candidates.push({
      className: mapped,
      confidence: bestScore,
      x: Math.max(0, Math.min(0.95, nx)),
      y: Math.max(0, Math.min(0.95, ny)),
      w: Math.max(0.02, Math.min(0.98, nw)),
      h: Math.max(0.02, Math.min(0.98, nh)),
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const kept: Candidate[] = [];
  for (const cand of candidates) {
    const overlaps = kept.some(
      (k) => k.className === cand.className && iou(
        { x: cand.x, y: cand.y, width: cand.w, height: cand.h },
        { x: k.x, y: k.y, width: k.w, height: k.h },
      ) > cfg.iouThreshold,
    );
    if (!overlaps) kept.push(cand);
  }

  return kept.slice(0, 30).map((c) => ({
    id: uuidv4(),
    className: c.className,
    confidence: Math.max(0, Math.min(1, c.confidence)),
    bbox: {
      x: Math.max(0, Math.min(0.95, c.x)),
      y: Math.max(0, Math.min(0.95, c.y)),
      width: Math.max(0.02, Math.min(0.98, c.w)),
      height: Math.max(0.02, Math.min(0.98, c.h)),
    },
    frameNumber: null,
  }));
}

function iou(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const ax2 = a.x + a.width, ay2 = a.y + a.height;
  const bx2 = b.x + b.width, by2 = b.y + b.height;
  const ix1 = Math.max(a.x, b.x), iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1), ih = Math.max(0, iy2 - iy1);
  const interArea = iw * ih;
  const unionArea = a.width * a.height + b.width * b.height - interArea;
  return unionArea <= 0 ? 0 : interArea / unionArea;
}

export type DetectionResult = {
  objects: DetectedObject[];
  counts: DetectionCounts;
  severity: Severity;
  processingTimeMs: number;
  aiPowered: boolean;
};

function computeSeverity(counts: DetectionCounts): Severity {
  const { total, pothole } = counts;
  if (total === 0) return "low";
  if (total >= 8 || pothole >= 4) return "critical";
  if (total >= 5 || pothole >= 2) return "high";
  if (total >= 2) return "medium";
  return "low";
}

async function annotateImage(
  inputPath: string,
  outputPath: string,
  objects: DetectedObject[],
  imgW: number,
  imgH: number,
): Promise<void> {
  const image = sharp(inputPath);
  const overlays: OverlayOptions[] = [];

  for (const obj of objects) {
    const color = CLASS_COLORS[obj.className] ?? { r: 255, g: 255, b: 255 };
    const bx = Math.round(obj.bbox.x * imgW);
    const by = Math.round(obj.bbox.y * imgH);
    const bw = Math.max(20, Math.round(obj.bbox.width * imgW));
    const bh = Math.max(10, Math.round(obj.bbox.height * imgH));
    const pct = Math.round(obj.confidence * 100);
    const labelText = `${obj.className.replace(/_/g, " ")} ${pct}%`;
    const labelH = 24;
    const labelW = Math.max(bw, labelText.length * 7 + 12);
    const colorStr = `rgb(${color.r},${color.g},${color.b})`;

    const rectSvg = `<svg width="${bw}" height="${bh}">
      <rect x="0" y="0" width="${bw}" height="${bh}"
        fill="none" stroke="${colorStr}" stroke-width="3" stroke-opacity="0.95"/>
    </svg>`;

    const labelSvg = `<svg width="${labelW}" height="${labelH}">
      <rect x="0" y="0" width="${labelW}" height="${labelH}"
        fill="${colorStr}" fill-opacity="0.92"/>
      <text x="6" y="16" font-family="monospace" font-size="12" fill="white" font-weight="bold">${labelText}</text>
    </svg>`;

    const safeLeft = Math.max(0, Math.min(bx, imgW - bw));
    const safeTop = Math.max(0, Math.min(by, imgH - bh));

    overlays.push({ input: Buffer.from(rectSvg), left: safeLeft, top: safeTop });
    overlays.push({
      input: Buffer.from(labelSvg),
      left: Math.max(0, Math.min(bx, imgW - labelW)),
      top: Math.max(0, by - labelH),
    });
  }

  await image.composite(overlays).jpeg({ quality: 90 }).toFile(outputPath);
}

function buildCounts(objects: DetectedObject[]): DetectionCounts {
  return {
    pothole: objects.filter((o) => o.className === "pothole").length,
    plastic_waste: objects.filter((o) => o.className === "plastic_waste").length,
    other_litter: objects.filter((o) => o.className === "other_litter").length,
    total: objects.length,
  };
}

const CLASS_PRIORITY: Record<string, number> = {
  plastic_waste: 2,
  pothole: 1,
  other_litter: 0,
};

function deduplicateObjects(
  objects: DetectedObject[],
  iouThreshold: number = 0.5,
): DetectedObject[] {
  const kept: DetectedObject[] = [];
  for (const obj of objects) {
    const overlappingIdx = kept.findIndex(
      (k) => iou(obj.bbox, k.bbox) > iouThreshold,
    );
    if (overlappingIdx === -1) {
      kept.push(obj);
    } else {
      const existing = kept[overlappingIdx];
      const existingPri = CLASS_PRIORITY[existing.className] ?? -1;
      const objPri = CLASS_PRIORITY[obj.className] ?? -1;
      if (objPri > existingPri) {
        kept[overlappingIdx] = obj;
      }
    }
  }
  return kept;
}

export async function runDetection(
  inputPath: string,
  annotatedPath: string,
  thumbnailPath: string,
  _mediaType: "image" | "video",
): Promise<DetectionResult> {
  const start = Date.now();
  const hasPotholeNet = isModelAvailable(POTHOLENET_CFG);
  const hasLitterCam = isModelAvailable(LITTERCAM_CFG);

  const original = await sharp(inputPath).toBuffer();
  let objects: DetectedObject[] = [];

  if (hasLitterCam) {
    const lc = await detectWithOnnx(original, LITTERCAM_CFG);
    objects.push(...lc);
  }

  if (hasPotholeNet) {
    const pn = await detectWithOnnx(original, POTHOLENET_CFG);
    objects.push(...pn);
  }

  objects = deduplicateObjects(objects);

  const imgMeta = await sharp(inputPath).metadata();
  const imgW = imgMeta.width ?? 640;
  const imgH = imgMeta.height ?? 480;

  await annotateImage(inputPath, annotatedPath, objects, imgW, imgH);
  await sharp(inputPath).resize(400, 300, { fit: "cover" }).jpeg({ quality: 80 }).toFile(thumbnailPath);

  return {
    objects,
    counts: buildCounts(objects),
    severity: computeSeverity(buildCounts(objects)),
    processingTimeMs: Date.now() - start,
    aiPowered: hasPotholeNet || hasLitterCam,
  };
}

export async function runFrameDetection(
  imageBuffer: Buffer,
): Promise<Omit<DetectionResult, "aiPowered"> & { aiPowered: boolean }> {
  const start = Date.now();
  const hasPotholeNet = isModelAvailable(POTHOLENET_CFG);
  const hasLitterCam = isModelAvailable(LITTERCAM_CFG);

  let objects: DetectedObject[] = [];

  if (hasLitterCam) {
    const lc = await detectWithOnnx(imageBuffer, LITTERCAM_CFG);
    objects.push(...lc);
  }

  if (hasPotholeNet) {
    const pn = await detectWithOnnx(imageBuffer, POTHOLENET_CFG);
    objects.push(...pn);
  }

  objects = deduplicateObjects(objects);

  return {
    objects,
    counts: buildCounts(objects),
    severity: computeSeverity(buildCounts(objects)),
    processingTimeMs: Date.now() - start,
    aiPowered: true,
  };
}
