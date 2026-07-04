import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useListDetections, useDeleteDetection, getListDetectionsQueryKey, getGetStatsQueryKey, getGetRecentDetectionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Image as ImageIcon, Video, FolderSearch } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const SEV_CONFIG = {
  low:      { color: "#22c55e", border: "border-green-500/40",  bg: "from-green-500/15",  text: "text-green-400",  glow: "rgba(34,197,94,0.3)"   },
  medium:   { color: "#f59e0b", border: "border-amber-500/40",  bg: "from-amber-500/15",  text: "text-amber-400",  glow: "rgba(245,158,11,0.3)"  },
  high:     { color: "#f97316", border: "border-orange-500/40", bg: "from-orange-500/15", text: "text-orange-400", glow: "rgba(249,115,22,0.3)"  },
  critical: { color: "#ef4444", border: "border-red-500/40",    bg: "from-red-500/15",    text: "text-red-400",    glow: "rgba(239,68,68,0.4)"   },
};

const CLASS_CHIPS = {
  pothole:       { color: "#ef4444", label: "PTH" },
  plastic_waste: { color: "#f59e0b", label: "PLS" },
  other_litter:  { color: "#a855f7", label: "LTR" },
};

export default function History() {
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const { data, isLoading, error } = useListDetections({ mediaType: filter });
  const deleteDetection = useDeleteDetection();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (error) {
    return (
      <div className="py-20 text-center">
        <p className="text-destructive font-mono text-sm">Failed to load scan history: {error?.message ?? "Unknown error"}</p>
      </div>
    );
  }

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Permanently delete this record?")) {
      deleteDetection.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDetectionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentDetectionsQueryKey() });
          toast({ title: "Deleted", description: "Detection record removed." });
        },
      });
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1 h-8 rounded-full" style={{ background: "linear-gradient(180deg, #f59e0b, #ef4444)" }} />
            <h1 className="text-4xl font-black tracking-tight" style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Scan History
            </h1>
          </div>
          <p className="text-muted-foreground font-mono text-sm ml-4">
            Complete log of all field scans — {data?.total ?? 0} records
          </p>
        </motion.div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted border border-border">
          {[
            { key: "all" as const,   icon: FolderSearch, label: "All"    },
            { key: "image" as const, icon: ImageIcon,    label: "Images" },
            { key: "video" as const, icon: Video,        label: "Video"  },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                filter === key
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={filter === key ? { background: "linear-gradient(135deg, hsl(189 100% 93%), hsl(271 91% 93%))", border: "1px solid hsl(189 100% 80%)" } : {}}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-[300px] rounded-xl bg-muted" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="py-24 rounded-2xl flex flex-col items-center justify-center text-center border-2 border-dashed border-border">
          <FolderSearch className="w-12 h-12 text-stone-400 mb-4" />
          <h3 className="text-xl font-bold text-stone-700 mb-2">No Records Found</h3>
          <p className="text-stone-500 font-mono text-sm mb-6 max-w-md">
            No detections match the current filter. Upload media to generate records.
          </p>
          <Link href="/">
            <button className="px-5 py-2.5 rounded-xl font-mono font-bold text-background"
              style={{ background: "linear-gradient(135deg, hsl(30 10% 25%), hsl(30 10% 20%))" }}>
              Run New Scan
            </button>
          </Link>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {data.items.map((item, i) => {
              const sev = SEV_CONFIG[item.severity as keyof typeof SEV_CONFIG];
              return (
                <motion.div key={item.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                >
                  <Link href={`/detection/${item.id}`}>
                    <div className={`group cursor-pointer rounded-2xl overflow-hidden border ${sev?.border} bg-card`}
                      style={{ boxShadow: `0 4px 24px ${sev?.glow}` }}>
                      {/* Image */}
                      <div className="relative aspect-video overflow-hidden"
                        style={{ background: "hsl(222 47% 7%)" }}>
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt={item.filename}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 font-mono text-xs">
                            NO PREVIEW
                          </div>
                        )}
                        {/* Severity badge */}
                        <div className="absolute top-2.5 right-2.5">
                          <span className={`text-[10px] font-mono uppercase font-black px-2.5 py-1 rounded-lg border ${sev?.text} ${sev?.border}`}
                            style={{ background: `${sev?.color}22`, backdropFilter: "blur(8px)" }}>
                            {item.severity}
                          </span>
                        </div>
                        {/* Media type */}
                        <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md font-mono text-[10px] text-white/60"
                          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          {item.mediaType.toUpperCase()}
                        </div>
                        {/* Scan line on hover */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                          style={{ background: `linear-gradient(180deg, transparent 40%, ${sev?.color}20 100%)` }} />
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <h3 className="font-bold text-sm truncate text-foreground mb-1" title={item.filename}>
                          {item.filename}
                        </h3>
                        <div className="text-xs font-mono text-muted-foreground/70 mb-3">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {(Object.entries(CLASS_CHIPS) as [keyof typeof CLASS_CHIPS, typeof CLASS_CHIPS[keyof typeof CLASS_CHIPS]][]).map(([key, cfg]) => {
                            const count = item.counts[key as keyof typeof item.counts];
                            if (!count) return null;
                            return (
                              <div key={key} className="flex items-center rounded-lg overflow-hidden text-[10px] font-mono font-bold"
                                style={{ border: `1px solid ${cfg.color}40` }}>
                                <span className="px-2 py-0.5" style={{ background: `${cfg.color}20`, color: cfg.color }}>{cfg.label}</span>
                                  <span className="px-2 py-0.5 text-muted-foreground" style={{ background: "hsl(40 30% 90%)" }}>{count}</span>
                              </div>
                            );
                          })}
                          {item.counts.total === 0 && (
                            <span className="text-[10px] font-mono text-green-400/70 px-2 py-0.5 rounded border border-green-500/20 bg-green-500/10">
                              CLEAN
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete */}
                      <div className="px-4 pb-3 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          disabled={deleteDetection.isPending}
                          className="flex items-center gap-1.5 text-[11px] font-mono text-destructive/70 hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
