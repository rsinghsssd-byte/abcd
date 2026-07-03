import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Zap, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type DetectedObject = {
  id: string;
  className: "pothole" | "plastic_waste" | "other_litter";
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
};

type ScanResult = {
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
  }, []);

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
      <div>
        <h1 className="text-3xl font-bold font-mono tracking-tight">Live Camera</h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">
          Real-time detection from device camera feed
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div ref={videoContainerRef} className="border border-border bg-card relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
            {!cameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background">
                <div className="w-16 h-16 border-2 border-border flex items-center justify-center">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="font-mono text-sm text-muted-foreground">Camera inactive</p>
                {error && (
                  <p className="font-mono text-xs text-red-500 max-w-xs text-center px-4">{error}</p>
                )}
                <button
                  onClick={startCamera}
                  className="border border-border px-4 py-2 font-mono text-sm hover:bg-accent transition-colors"
                >
                  ENABLE CAMERA
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

            {cameraOn && result && result.counts.total > 0 && (
              <div className="absolute bottom-3 right-3 bg-black/70 border border-white/20 px-3 py-2">
                <p className="font-mono text-xs text-white">
                  {result.counts.total} object{result.counts.total !== 1 ? "s" : ""} detected
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {!cameraOn ? (
              <button
                onClick={startCamera}
                className="flex items-center gap-2 border border-border px-4 py-2 font-mono text-sm hover:bg-accent transition-colors"
              >
                <Camera className="w-4 h-4" />
                START CAMERA
              </button>
            ) : (
              <>
                {!scanning ? (
                  <button
                    onClick={startScanning}
                    className="flex items-center gap-2 bg-foreground text-background px-4 py-2 font-mono text-sm hover:opacity-90 transition-opacity"
                  >
                    <Zap className="w-4 h-4" />
                    START SCANNING
                  </button>
                ) : (
                  <button
                    onClick={stopScanning}
                    className="flex items-center gap-2 border border-red-500 text-red-600 px-4 py-2 font-mono text-sm hover:bg-red-50 transition-colors"
                  >
                    <CameraOff className="w-4 h-4" />
                    STOP SCANNING
                  </button>
                )}
                <button
                  onClick={stopCamera}
                  className="flex items-center gap-2 border border-border px-4 py-2 font-mono text-sm hover:bg-accent transition-colors"
                >
                  CLOSE CAMERA
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="border border-border bg-card p-4">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
              Detection Engine
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center font-mono text-sm">
                <span className="text-muted-foreground">Model</span>
                <span className="font-medium">
                  {result?.aiPowered ? "ONNX Models" : "Active"}
                </span>
              </div>
              <div className="flex justify-between items-center font-mono text-sm">
                <span className="text-muted-foreground">Interval</span>
                <span className="font-medium">2.0s</span>
              </div>
              <div className="flex justify-between items-center font-mono text-sm">
                <span className="text-muted-foreground">Frames analyzed</span>
                <motion.span
                  key={frameCount}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="font-medium tabular-nums"
                >
                  {frameCount}
                </motion.span>
              </div>
              {result && (
                <div className="flex justify-between items-center font-mono text-sm">
                  <span className="text-muted-foreground">Last latency</span>
                  <span className="font-medium tabular-nums">{result.processingTimeMs}ms</span>
                </div>
              )}
            </div>
          </div>

          {!result?.aiPowered && cameraOn && (
            <div className="border border-stone-300 bg-stone-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                <p className="font-serif text-xs text-stone-600 italic">
                  Running local ONNX models for detection.
                </p>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                key={frameCount}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Last Frame
                  </h3>
                  <span className={cn("font-mono text-xs border px-2 py-0.5 uppercase", SEVERITY_STYLE[result.severity])}>
                    {result.severity}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(["pothole", "plastic_waste", "other_litter"] as const).map((cls) => (
                    <div key={cls} className="border border-border p-2">
                      <div className="font-mono text-xs text-muted-foreground uppercase">{cls.replace("_", " ")}</div>
                      <div
                        className="font-mono text-xl font-bold"
                        style={{ color: CLASS_COLORS[cls] }}
                      >
                        {result.counts[cls]}
                      </div>
                    </div>
                  ))}
                  <div className="border border-border p-2">
                    <div className="font-mono text-xs text-muted-foreground uppercase">Total</div>
                    <div className="font-mono text-xl font-bold">{result.counts.total}</div>
                  </div>
                </div>

                {result.objects.length > 0 && (
                  <div className="space-y-1">
                    {result.objects.map((obj) => (
                      <div key={obj.id} className="flex items-center justify-between font-mono text-xs py-1 border-b border-border last:border-0">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: CLASS_COLORS[obj.className] }}
                          />
                          <span className="text-muted-foreground">{obj.className.replace(/_/g, " ")}</span>
                        </div>
                        <span className="font-medium">{Math.round(obj.confidence * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!result && cameraOn && !scanning && (
            <div className="border border-dashed border-border p-6 text-center">
              <RefreshCw className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="font-mono text-xs text-muted-foreground">
                Start scanning to see live detections
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
