import { useGetDetection } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Calendar, FileType, Target } from "lucide-react";
import { CircularGauge } from "@/components/ui/CircularGauge";
import { safeCounts } from "@/lib/counts";
import { SeverityBadge } from "./Dashboard";

const CLASS_COLORS: Record<string, string> = {
  pothole: "#b91c1c",
  plastic_waste: "#92400e",
  other_litter: "#7c2d12",
};

const CLASS_LABELS: Record<string, string> = {
  pothole: "Potholes",
  plastic_waste: "Plastic",
  other_litter: "Litter",
};

export default function DetectionDetail() {
  const params = useParams();
  const id = params.id ? parseInt(params.id, 10) : null;
  
  const { data: detection, isLoading } = useGetDetection(id as number, {
    query: { enabled: Number.isFinite(id as number) && (id as number) > 0 } as { enabled: boolean; queryKey: readonly unknown[] },
  });

  if (isLoading) {
    return <div className="paper-card-vintage h-screen" />;
  }

  if (!detection) {
    return (
      <div className="py-24 text-center">
        <h2 className="text-2xl font-serif font-bold text-stone-700">Record Not Found</h2>
        <Link href="/history" className="inline-block mt-4 px-4 py-2 font-serif text-sm text-stone-100" style={{ background: "hsl(30 10% 25%)" }}>
          Return to History
        </Link>
      </div>
    );
  }

  const counts = safeCounts(detection.counts);
  const objects = detection.objects ?? [];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between border-b border-dashed border-stone-300/60 pb-4">
        <Link href="/history">
          <span className="font-serif text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Log
          </span>
        </Link>
        <span className="font-mono text-xs text-stone-400">
          ID: {String(detection.id).padStart(6, '0')}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Image */}
        <div className="lg:col-span-2 space-y-4">
          <div className="paper-card-vintage p-0">
            <div className="relative bg-stone-100 overflow-hidden">
              <img 
                src={detection.annotatedUrl || detection.originalUrl} 
                alt={detection.filename} 
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Gauge summary row */}
          {counts.total > 0 && (
            <div className="paper-card-vintage p-3 sm:p-4">
              <div className="flex items-center justify-center gap-3 sm:gap-5 flex-wrap">
                {(Object.entries(CLASS_COLORS) as [string, string][]).map(([key, color], i) => {
                  const c = counts[key as keyof typeof counts] as number;
                  const objs = objects.filter((o) => o.className === key);
                  const avgConf = objs.length > 0 ? objs.reduce((s, o) => s + o.confidence, 0) / objs.length * 100 : 0;
                  if (!c) return null;
                  return (
                    <CircularGauge key={key} value={avgConf} size={64} strokeWidth={4} color={color}
                      label={CLASS_LABELS[key] || key} count={c} delay={i * 0.1} />
                  );
                })}
                <CircularGauge value={objects.reduce((s, o) => s + o.confidence, 0) / Math.max(objects.length, 1) * 100}
                  size={64} strokeWidth={4} color="#78716c" label="Total" count={objects.length} delay={0.4} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <MetaBox icon={FileType} label="Media Type" value={(detection.mediaType ?? "unknown").toUpperCase()} />
            <MetaBox icon={Clock} label="Processing" value={`${detection.processingTimeMs ?? 0}ms`} />
            <MetaBox icon={Calendar} label="Date" value={detection.createdAt ? new Date(detection.createdAt).toLocaleDateString() : "—"} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="paper-card-vintage p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif font-bold text-stone-800">Analysis Report</h2>
              <SeverityBadge severity={detection.severity ?? "low"} />
            </div>
            
            <div className="space-y-3 mb-5">
              <div className="flex justify-between py-1.5 border-b border-dashed border-stone-300/40 text-sm">
                <span className="font-serif text-stone-500 text-xs">Filename</span>
                <span className="font-serif font-semibold text-stone-700 text-xs truncate max-w-[180px]" title={detection.filename ?? ""}>{detection.filename ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-dashed border-stone-300/40 text-sm">
                <span className="font-serif text-stone-500 text-xs">Total Objects</span>
                <span className="font-serif font-bold text-stone-700 text-sm">{counts.total}</span>
              </div>
            </div>

            <h3 className="font-serif text-xs font-semibold text-stone-600 uppercase tracking-wider mb-3">Detected Entities</h3>
            
            {objects.length === 0 ? (
              <p className="font-serif text-xs text-stone-400 italic text-center py-4">Clean frame. No entities detected.</p>
            ) : (
              <div className="space-y-2">
                {objects.map((obj, i) => {
                  const color = CLASS_COLORS[obj.className] || "#78716c";
                  const pct = ((obj.confidence ?? 0) * 100).toFixed(1);
                  return (
                    <motion.div key={obj.id}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-center gap-3 p-2.5 paper-card-vintage"
                    >
                      <div className="relative shrink-0" style={{ width: 36, height: 36 }}>
                        <svg width={36} height={36} className="rotate-[-90deg]">
                          <circle cx={18} cy={18} r={14} fill="none" stroke="#e7e5e4" strokeWidth={3} />
                          <motion.circle cx={18} cy={18} r={14} fill="none" stroke={color} strokeWidth={3}
                            strokeLinecap="round" strokeDasharray={Math.PI * 28}
                            initial={{ strokeDashoffset: Math.PI * 28 }}
                            animate={{ strokeDashoffset: Math.PI * 28 * (1 - (obj.confidence ?? 0)) }}
                            transition={{ duration: 1, delay: i * 0.06 + 0.3, ease: [0.22, 1, 0.36, 1] }} />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold tabular-nums" style={{ color }}>
                          {i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-serif font-semibold text-stone-700 capitalize truncate">
                          {(obj.className ?? "unknown").replace(/_/g, " ")}
                        </p>
                        <p className="text-[10px] font-mono text-stone-500">{pct}% confidence</p>
                      </div>
                      <span className="text-xs font-mono font-bold" style={{ color }}>{pct}%</span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaBox({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="paper-card-vintage p-3 flex flex-col items-center justify-center text-center">
      <Icon className="w-3.5 h-3.5 text-stone-400 mb-1" />
      <span className="text-[9px] font-serif text-stone-500 uppercase tracking-wider">{label}</span>
      <span className="font-serif font-semibold text-stone-700 text-xs mt-0.5">{value}</span>
    </div>
  );
}
