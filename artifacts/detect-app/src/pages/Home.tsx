import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { UploadCloud, FileImage, Trash2, ChevronRight, Zap, ScanLine, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getListDetectionsQueryKey, getGetStatsQueryKey, getGetRecentDetectionsQueryKey } from "@workspace/api-client-react";
import type { Detection } from "@workspace/api-zod";
import { Link } from "wouter";
import { CircularGauge } from "@/components/ui/CircularGauge";
import { safeCounts } from "@/lib/counts";

const CLASS_COLORS = {
  pothole:       { color: "#b91c1c", bg: "bg-red-50",     border: "border-red-300", label: "Potholes",     chip: "border-red-300 text-red-700 bg-red-50/80" },
  plastic_waste: { color: "#92400e", bg: "bg-amber-50",   border: "border-amber-300", label: "Plastic Waste", chip: "border-amber-300 text-amber-700 bg-amber-50/80" },
  other_litter:  { color: "#7c2d12", bg: "bg-orange-50",  border: "border-orange-300", label: "Other Litter",  chip: "border-orange-300 text-orange-700 bg-orange-50/80" },
};

const SEV_CONFIG = {
  low:      { color: "#22c55e", label: "LOW",      glow: "rgba(34,197,94,0.4)"   },
  medium:   { color: "#f59e0b", label: "MEDIUM",   glow: "rgba(245,158,11,0.4)"  },
  high:     { color: "#f97316", label: "HIGH",     glow: "rgba(249,115,22,0.4)"  },
  critical: { color: "#ef4444", label: "CRITICAL", glow: "rgba(239,68,68,0.5)"   },
};

const SCAN_STEPS = [
  "Uploading file...",
  "Running AI vision model...",
  "Mapping bounding boxes...",
  "Computing severity score...",
  "Saving to database...",
];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<Detection | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelection(f);
  };

  const handleFileSelection = (selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/") && !selectedFile.type.startsWith("video/")) {
      toast({ title: "Invalid file", description: "Please select an image or video file.", variant: "destructive" });
      return;
    }
    setFile(selectedFile);
    setResult(null);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setProgress(0);
    setIsProcessing(false);
    setStepIndex(0);
  };

  const startAnalysis = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(0);
    setStepIndex(0);

    let p = 0;
    let step = 0;
    const iv = setInterval(() => {
      p += Math.random() * 14 + 4;
      step = Math.min(4, Math.floor(p / 22));
      setProgress(Math.min(p, 90));
      setStepIndex(step);
      if (p >= 90) clearInterval(iv);
    }, 600);

    try {
      const endpoint = file.type.startsWith("video/") ? "/api/analyze/video" : "/api/analyze/image";
      const form = new FormData();
      form.append("file", file);

      const username = localStorage.getItem("x-username");
      const headers: Record<string, string> = {};
      if (username) headers["X-Username"] = username;

      const response = await fetch(endpoint, { method: "POST", body: form, headers });
      clearInterval(iv);
      setProgress(100);
      setStepIndex(4);

      if (!response.ok) throw new Error("Analysis failed");
      const data = await response.json();

      setTimeout(() => {
        setResult(data);
        setIsProcessing(false);
        queryClient.invalidateQueries({ queryKey: getListDetectionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentDetectionsQueryKey() });
      }, 700);
    } catch {
      clearInterval(iv);
      setIsProcessing(false);
      toast({ title: "Analysis Failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-0.5 h-7" style={{ background: "hsl(30 10% 50%)" }} />
          <h1 className="text-3xl font-serif font-bold text-stone-800 tracking-tight">
            Upload &amp; Analyze
          </h1>
        </div>
        <p className="text-stone-500 font-serif text-sm ml-4 italic">
          Deploy AI vision on road captures — detect potholes, plastic waste, and litter.
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
            {/* Drop zone */}
            <motion.div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              className={`relative overflow-hidden cursor-pointer transition-all duration-300
                ${file ? "cursor-default" : ""}
                ${isDragging ? "paper-card-stitch !border-stone-500" : "paper-card-stitch"}`}
              style={{ minHeight: 280 }}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])} />

              <div className="flex flex-col items-center justify-center p-12 text-center">
                {!file ? (
                  <>
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      className="w-20 h-20 flex items-center justify-center mb-6"
                      style={{ background: "hsl(40 30% 94%)", border: "1px solid hsl(30 10% 78%)" }}
                    >
                      <UploadCloud className="w-10 h-10 text-stone-500" />
                    </motion.div>
                    <h3 className="text-xl font-serif font-bold text-stone-800 mb-2">Drop road media here</h3>
                    <p className="text-stone-500 text-sm mb-6 max-w-sm font-serif italic">
                      Dashboard footage, mobile captures, or static images — JPEG, PNG, MP4 supported
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      className="px-6 py-2.5 font-serif text-sm font-semibold text-stone-100"
                      style={{ background: "hsl(30 10% 25%)" }}
                    >
                      Browse Files
                    </motion.button>
                  </>
                ) : (
                  <div className="w-full max-w-md">
                    {/* File info */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-4 mb-6 text-left paper-card-vintage">
                      <div className="w-10 h-10 flex items-center justify-center" style={{ background: "hsl(40 30% 92%)", border: "1px solid hsl(30 10% 78%)" }}>
                        <FileImage className="w-5 h-5 text-stone-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-serif font-semibold text-stone-800 truncate">{file.name}</p>
                        <p className="text-xs font-mono text-stone-500">{(file.size / 1024 / 1024).toFixed(2)} MB · {file.type.split("/")[1].toUpperCase()}</p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); reset(); }} disabled={isProcessing}
                        className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </motion.div>

                    {isProcessing ? (
                      <div className="space-y-4">
                        {/* Progress bar */}
                        <div className="h-1.5 bg-stone-200 overflow-hidden">
                          <motion.div
                            className="h-full relative overflow-hidden"
                            style={{ width: `${progress}%`, background: "hsl(30 10% 40%)" }}
                          >
                            <motion.div
                              className="absolute inset-0 opacity-40"
                              animate={{ x: ["-100%", "200%"] }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                              style={{ background: "linear-gradient(90deg, transparent, hsl(40 30% 92%), transparent)", width: "50%" }}
                            />
                          </motion.div>
                        </div>
                        <div className="flex justify-between text-xs">
                          <motion.span
                            key={stepIndex}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="font-serif text-stone-600 italic"
                          >
                            {SCAN_STEPS[stepIndex]}
                          </motion.span>
                          <span className="font-mono text-stone-500">{Math.round(progress)}%</span>
                        </div>
                      </div>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={(e) => { e.stopPropagation(); startAnalysis(); }}
                        className="w-full py-3 font-serif font-semibold text-stone-100 flex items-center justify-center gap-2"
                        style={{ background: "hsl(30 10% 25%)" }}
                      >
                        <Zap className="w-4 h-4" />
                        Run AI Analysis
                        <ChevronRight className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Feature chips */}
            {!file && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-2 mt-4"
              >
                {[
                  { label: "ONNX Models", color: "#78716c" },
                  { label: "Bounding Boxes", color: "#78716c" },
                  { label: "Pothole Detection", color: "#b91c1c" },
                  { label: "Litter Classification", color: "#92400e" },
                ].map((chip) => (
                  <span key={chip.label} className="tag-vintage">{chip.label}</span>
                ))}
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div key="results" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Annotated image */}
            <div className="lg:col-span-2 space-y-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="paper-card-vintage overflow-hidden"
              >
                <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5"
                  style={{ background: "rgba(255,255,255,0.9)", border: "1px solid hsl(30 10% 75%)" }}>
                  <ScanLine className="w-3.5 h-3.5 text-stone-600" />
                  <span className="font-mono text-[10px] text-stone-700 tracking-wider uppercase font-bold">Analyzed</span>
                </div>
                <div className="relative aspect-video bg-stone-900/10 overflow-hidden paper-card-stitch p-0.5">
                  <img src={result.annotatedUrl} alt="Analyzed" className="w-full h-full object-contain" />
                  <motion.div
                    initial={{ top: "-5%" }} animate={{ top: "105%" }}
                    transition={{ duration: 2.5, ease: "linear" }}
                    className="absolute left-0 right-0 h-[1px] z-20 pointer-events-none opacity-60"
                    style={{ background: "linear-gradient(90deg, transparent, #78716c, transparent)" }}
                  />
                </div>
              </motion.div>

              {/* Circular gauges row */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="paper-card-vintage p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-stone-500" />
                    <h3 className="font-serif text-sm font-semibold text-stone-700">Detection Summary</h3>
                  </div>
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 250, damping: 14, delay: 0.4 }}
                    className="font-mono text-[10px] border px-2.5 py-0.5 uppercase font-bold tracking-wider"
                    style={{
                      borderColor: `${SEV_CONFIG[result.severity as keyof typeof SEV_CONFIG]?.color}60`,
                      color: SEV_CONFIG[result.severity as keyof typeof SEV_CONFIG]?.color,
                      background: `${SEV_CONFIG[result.severity as keyof typeof SEV_CONFIG]?.color}15`,
                    }}
                  >
                    {result.severity}
                  </motion.span>
                </div>

                <div className="flex justify-center gap-6 flex-wrap">
                  {(Object.entries(CLASS_COLORS) as [keyof typeof CLASS_COLORS, typeof CLASS_COLORS[keyof typeof CLASS_COLORS]][]).map(([key, cfg], i) => {
                    const counts = safeCounts(result.counts);
                    const count = counts[key as keyof typeof counts] ?? result.objects.filter((o) => o.className === key).length;
                    const objectsForClass = result.objects.filter((o) => o.className === key);
                    const avgConf = objectsForClass.length > 0
                      ? objectsForClass.reduce((sum, o) => sum + o.confidence, 0) / objectsForClass.length * 100
                      : 0;
                    return (
                      <CircularGauge
                        key={key}
                        value={avgConf}
                        size={90}
                        strokeWidth={5}
                        color={cfg.color}
                        label={cfg.label}
                        count={count}
                        delay={i * 0.12}
                      />
                    );
                  })}
                  <CircularGauge
                    value={result.objects.reduce((s, o) => s + o.confidence, 0) / Math.max(result.objects.length, 1) * 100}
                    size={90}
                    strokeWidth={5}
                    color="#78716c"
                    label="Total Detections"
                    count={result.objects.length}
                    delay={0.48}
                  />
                </div>
              </motion.div>
            </div>

            {/* Right column — object breakdown */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="paper-card-vintage flex flex-col"
            >
              <div className="px-5 py-4 border-b border-dashed border-stone-300/60 flex items-center justify-between">
                <h3 className="font-serif text-sm font-semibold text-stone-700">Detections</h3>
                <span className="font-mono text-[10px] text-stone-500 bg-stone-100 border border-stone-300/60 px-2 py-0.5">
                  {result.processingTimeMs}ms
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {result.objects.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="h-full flex flex-col items-center justify-center text-center py-8"
                  >
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-stone-300 flex items-center justify-center mb-4">
                      <ScanLine className="w-6 h-6 text-stone-400" />
                    </div>
                    <p className="font-serif font-medium text-stone-600 text-sm">Clean Frame</p>
                    <p className="font-serif text-xs text-stone-400 italic mt-1">No anomalies detected</p>
                  </motion.div>
                ) : (
                  result.objects.map((obj: Detection["objects"][number], i: number) => {
                    const cfg = CLASS_COLORS[obj.className as keyof typeof CLASS_COLORS];
                    const pct = (obj.confidence * 100).toFixed(1);
                    return (
                      <motion.div key={obj.id}
                        initial={{ opacity: 0, x: 20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{ delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="paper-card-vintage p-3 flex items-center gap-3"
                      >
                        <div className="relative shrink-0" style={{ width: 40, height: 40 }}>
                          <svg width={40} height={40} className="rotate-[-90deg]">
                            <circle cx={20} cy={20} r={16} fill="none" stroke="#e7e5e4" strokeWidth={3} />
                            <motion.circle
                              cx={20} cy={20} r={16} fill="none"
                              stroke={cfg?.color || "#78716c"}
                              strokeWidth={3}
                              strokeLinecap="round"
                              strokeDasharray={Math.PI * 32}
                              initial={{ strokeDashoffset: Math.PI * 32 }}
                              animate={{ strokeDashoffset: Math.PI * 32 * (1 - obj.confidence) }}
                              transition={{ duration: 1, delay: i * 0.07 + 0.3, ease: [0.22, 1, 0.36, 1] }}
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold tabular-nums"
                            style={{ color: cfg?.color }}>
                            {i + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-serif font-semibold text-stone-700 capitalize truncate">
                            {obj.className.replace(/_/g, " ")}
                          </p>
                          <p className="text-[10px] font-mono text-stone-500">{pct}% confidence</p>
                        </div>
                        <span className="text-xs font-mono font-bold" style={{ color: cfg?.color }}>
                          {pct}%
                        </span>
                      </motion.div>
                    );
                  })
                )}
              </div>

              <div className="p-4 border-t border-dashed border-stone-300/60 flex gap-3">
                <motion.button onClick={reset}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-2.5 font-serif text-xs font-semibold text-stone-600 border border-stone-300/70 hover:bg-stone-100 transition-colors">
                  NEW SCAN
                </motion.button>
                <Link href={`/detection/${result.id}`} className="flex-1">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-2.5 font-serif text-xs font-semibold text-stone-100"
                    style={{ background: "hsl(30 10% 25%)" }}>
                    FULL REPORT
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
