import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, Zap, AlertTriangle, RefreshCw, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getListDetectionsQueryKey, getGetStatsQueryKey, getGetRecentDetectionsQueryKey } from "@workspace/api-client-react";
import { CircularGauge } from "@/components/ui/CircularGauge";
import { safeCounts } from "@/lib/counts";

type DetectedObject = {
  id: string;
  className: "pothole" | "plastic_waste" | "other_litter";
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
};

type ScanResult = {
  id: number;
  objects: DetectedObject[];
  counts: { pothole: number; plastic_waste: number; other_litter: number; total: number };
  processingTimeMs: number;
  severity: "low" | "medium" | "high" | "critical";
  aiPowered: boolean;
};

const CLASS_COLORS = {
  pothole: "#ef4444",
  plastic_waste: "#f59e0b",
  other_litter: "#f97316",
} as const;

const CLASS_LABELS = {
  pothole: "POTHOLE",
  plastic_waste: "PLASTIC",
  other_litter: "LITTER",
} as const;

const SEVERITY_STYLE = {
  low: "border-zinc-400 text-zinc-600",
  medium: "border-amber-500 text-amber-600",
  high: "border-orange-500 text-orange-600",
  critical: "border-red-600 text-red-700",
} as const;

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [scanning, setScanning] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning_in_progress, setScanningInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      setError("Camera access denied. Please allow camera permissions and try again.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    setScanning(false);
    setScanningInProgress(false);
    clearOverlay();
  }, []);

  const clearOverlay = () => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
  };

  const drawOverlay = useCallback((objects: DetectedObject[], w: number, h: number) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.width = w;
    overlay.height = h;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    for (const obj of objects) {
      const x = obj.bbox.x * w;
      const y = obj.bbox.y * h;
      const bw = obj.bbox.width * w;
      const bh = obj.bbox.height * h;
      const color = CLASS_COLORS[obj.className];
      const pct = Math.round(obj.confidence * 100);
      const label = `${CLASS_LABELS[obj.className]} ${pct}%`;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, bw, bh);

      const fontSize = Math.max(12, Math.round(w / 55));
      ctx.font = `bold ${fontSize}px monospace`;
      const textW = ctx.measureText(label).width;
      const boxH = fontSize + 8;
      const boxY = Math.max(0, y - boxH);

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.88;
      ctx.fillRect(x, boxY, textW + 12, boxH);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.fillText(label, x + 6, boxY + boxH - 4);
    }
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    if (scanning_in_progress) return;

    setScanningInProgress(true);
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    canvas.width = vw;
    canvas.height = vh;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, vw, vh);

    canvas.toBlob(async (blob) => {
      if (!blob) { setScanningInProgress(false); return; }
      const form = new FormData();
      form.append("frame", blob, "frame.jpg");

      try {
        const res = await fetch("/api/analyze/frame", { method: "POST", body: form });
        if (!res.ok) throw new Error("Analysis failed");
        const data: ScanResult = await res.json();
        setResult(data);
        setFrameCount((n) => n + 1);
        drawOverlay(data.objects, vw, vh);
      } catch {
        toast({ title: "Frame analysis failed", description: "Check server connection", variant: "destructive" });
      } finally {
        setScanningInProgress(false);
      }
    }, "image/jpeg", 0.85);
  }, [scanning_in_progress, drawOverlay]);

  const startScanning = useCallback(() => {
    setScanning(true);
    captureAndAnalyze();
    intervalRef.current = setInterval(() => captureAndAnalyze(), 2000);
  }, [captureAndAnalyze]);

  const stopScanning = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setScanning(false);
    setScanningInProgress(false);
    clearOverlay();
    queryClient.invalidateQueries({ queryKey: getListDetectionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetRecentDetectionsQueryKey() });
  }, [queryClient]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!cameraOn) return;
    const video = videoRef.current;
    if (!video) return;

    const positionOverlay = () => {
      const canvas = overlayRef.current;
      const container = videoContainerRef.current;
      if (!canvas || !container) return;

      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const cw = container.clientWidth;
      const ch = container.clientHeight;

      const scale = Math.max(cw / vw, ch / vh);
      const renderedW = vw * scale;
      const renderedH = vh * scale;

      canvas.style.left = `${-(renderedW - cw) / 2}px`;
      canvas.style.top = `${-(renderedH - ch) / 2}px`;
      canvas.style.width = `${renderedW}px`;
      canvas.style.height = `${renderedH}px`;
    };

    video.addEventListener("loadedmetadata", positionOverlay, { once: true });
    window.addEventListener("resize", positionOverlay);
    requestAnimationFrame(positionOverlay);

    return () => {
      video.removeEventListener("loadedmetadata", positionOverlay);
      window.removeEventListener("resize", positionOverlay);
    };
  }, [cameraOn]);

  return (
    <div className="space-y-6 h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-0.5 h-7" style={{ background: "hsl(30 10% 50%)" }} />
          <h1 className="text-3xl font-serif font-bold text-stone-800 tracking-tight">
            Live Camera
          </h1>
        </div>
        <p className="text-stone-500 font-serif text-sm ml-4 italic">
          Real-time detection from device camera feed
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div ref={videoContainerRef} className="paper-card-vintage relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
            {!cameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-50">
                <div className="w-16 h-16 flex items-center justify-center" style={{ border: "1px solid hsl(30 10% 78%)", background: "hsl(40 30% 94%)" }}>
                  <Camera className="w-8 h-8 text-stone-400" />
                </div>
                <p className="font-serif text-sm text-stone-500">Camera inactive</p>
                {error && (
                  <p className="font-serif text-xs text-red-600 max-w-xs text-center px-4 italic">{error}</p>
                )}
                <button
                  onClick={startCamera}
                  className="px-4 py-2 font-serif text-sm font-semibold text-stone-100"
                  style={{ background: "hsl(30 10% 25%)" }}
                >
                  Enable Camera
                </button>
              </div>
            )}

            <video
              ref={videoRef}
              className={cn("w-full h-full object-cover", !cameraOn && "hidden")}
              muted
              playsInline
            />

            {cameraOn && (
              <canvas
                ref={overlayRef}
                className="absolute top-0 left-0 pointer-events-none"
              />
            )}

            <canvas ref={canvasRef} className="hidden" />

            {cameraOn && scanning && (
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <motion.div
                  className="w-3 h-3 rounded-full bg-red-500"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="font-mono text-xs text-white bg-black/60 px-2 py-1">
                  SCANNING
                </span>
              </div>
            )}

            {cameraOn && scanning && scanning_in_progress && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{ opacity: [0, 0.15, 0] }}
                transition={{ duration: 0.3 }}
                style={{ background: "rgba(0, 200, 80, 0.3)" }}
              />
            )}

            {cameraOn && result && safeCounts(result.counts).total > 0 && (
              <div className="absolute bottom-3 right-3 bg-black/70 border border-white/20 px-3 py-2">
                <p className="font-mono text-xs text-white">
                  {safeCounts(result.counts).total} object{safeCounts(result.counts).total !== 1 ? "s" : ""} detected
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {!cameraOn ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={startCamera}
                className="flex items-center gap-2 px-4 py-2 font-serif text-sm font-semibold text-stone-100"
                style={{ background: "hsl(30 10% 25%)" }}
              >
                <Camera className="w-4 h-4" />
                Enable Camera
              </motion.button>
            ) : (
              <>
                {!scanning ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={startScanning}
                    className="flex items-center gap-2 px-4 py-2 font-serif text-sm font-semibold text-stone-100"
                    style={{ background: "hsl(30 10% 25%)" }}
                  >
                    <Zap className="w-4 h-4" />
                    Start Scanning
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={stopScanning}
                    className="flex items-center gap-2 px-4 py-2 font-serif text-sm font-semibold"
                    style={{ color: "#b91c1c", border: "1px solid #b91c1c40", background: "#b91c1c10" }}
                  >
                    <CameraOff className="w-4 h-4" />
                    Stop Scanning
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={stopCamera}
                  className="flex items-center gap-2 px-4 py-2 font-serif text-sm text-stone-600 border border-stone-300/70 hover:bg-stone-100 transition-colors"
                >
                  Close Camera
                </motion.button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="paper-card-vintage p-4"
          >
            <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500 mb-4">
              Detection Engine
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-serif text-stone-500">Model</span>
                <span className="text-xs font-mono font-medium text-stone-700">
                  {result?.aiPowered ? "ONNX Models" : "Active"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-serif text-stone-500">Interval</span>
                <span className="text-xs font-mono font-medium text-stone-700">2.0s</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-serif text-stone-500">Frames analyzed</span>
                <motion.span
                  key={frameCount}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-xs font-mono font-medium tabular-nums text-stone-700"
                >
                  {frameCount}
                </motion.span>
              </div>
              {result && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-serif text-stone-500">Last latency</span>
                  <span className="text-xs font-mono font-medium tabular-nums text-stone-700">{result.processingTimeMs}ms</span>
                </div>
              )}
            </div>
          </motion.div>

          {!result?.aiPowered && cameraOn && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="stitch-border p-3 bg-stone-50/80"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                <p className="font-serif text-xs text-stone-500 italic">
                  Running local ONNX models for detection.
                </p>
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                key={frameCount}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="paper-card-vintage p-4"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <ScanLine className="w-4 h-4 text-stone-500" />
                    <h3 className="font-serif text-sm font-semibold text-stone-700">
                      Last Frame
                    </h3>
                  </div>
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }}
                    className={cn("font-mono text-[10px] border px-2.5 py-0.5 uppercase font-bold tracking-wider", SEVERITY_STYLE[result.severity])}
                  >
                    {result.severity}
                  </motion.span>
                </div>

                <div className="flex justify-center gap-6 flex-wrap">
                  {(["pothole", "plastic_waste", "other_litter"] as const).map((cls, i) => {
                    const counts = safeCounts(result.counts);
                    const count = counts[cls] ?? result.objects.filter((o) => o.className === cls).length;
                    const objectsForClass = result.objects.filter((o) => o.className === cls);
                    const avgConf = objectsForClass.length > 0
                      ? objectsForClass.reduce((sum, o) => sum + o.confidence, 0) / objectsForClass.length * 100
                      : 0;
                    return (
                      <CircularGauge
                        key={cls}
                        value={avgConf}
                        size={80}
                        strokeWidth={5}
                        color={CLASS_COLORS[cls]}
                        label={cls.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                        count={count}
                        delay={i * 0.12}
                      />
                    );
                  })}
                  <CircularGauge
                    value={safeCounts(result.counts).total > 0 ? 100 : 0}
                    size={80}
                    strokeWidth={5}
                    color="#78716c"
                    label="Total"
                    count={safeCounts(result.counts).total}
                    delay={0.36}
                  />
                </div>

                {result.objects.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 pt-4 border-t border-dashed border-stone-300/60"
                  >
                    <p className="font-serif text-[10px] text-stone-400 italic mb-2 text-center">
                      {result.objects.length} object{result.objects.length !== 1 ? "s" : ""} detected · avg confidence {(result.objects.reduce((s, o) => s + o.confidence, 0) / result.objects.length * 100).toFixed(0)}%
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!result && cameraOn && !scanning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="stitch-border p-6 text-center bg-stone-50/50"
            >
              <RefreshCw className="w-6 h-6 text-stone-400 mx-auto mb-2" />
              <p className="font-serif text-xs text-stone-500 italic">
                Start scanning to see live detections
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
