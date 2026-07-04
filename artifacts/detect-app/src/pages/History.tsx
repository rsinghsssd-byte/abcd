import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useListDetections, useDeleteDetection, getListDetectionsQueryKey, getGetStatsQueryKey, getGetRecentDetectionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Image as ImageIcon, Video, FolderSearch } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { CircularGauge } from "@/components/ui/CircularGauge";
import { safeCounts } from "@/lib/counts";

const SEV_CONFIG = {
  low:      { color: "#22c55e", border: "border-green-500/40",  bg: "from-green-500/15",  text: "text-green-400",  glow: "rgba(34,197,94,0.3)"   },
  medium:   { color: "#f59e0b", border: "border-amber-500/40",  bg: "from-amber-500/15",  text: "text-amber-400",  glow: "rgba(245,158,11,0.3)"  },
  high:     { color: "#f97316", border: "border-orange-500/40", bg: "from-orange-500/15", text: "text-orange-400", glow: "rgba(249,115,22,0.3)"  },
  critical: { color: "#ef4444", border: "border-red-500/40",    bg: "from-red-500/15",    text: "text-red-400",    glow: "rgba(239,68,68,0.4)"   },
};

const CLASS_GAUGES = {
  pothole:       { color: "#ef4444", label: "Potholes" },
  plastic_waste: { color: "#f59e0b", label: "Plastic"  },
  other_litter:  { color: "#a855f7", label: "Litter"   },
};

export default function History() {
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [brokenImages, setBrokenImages] = useState<Set<number>>(new Set());
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
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-0.5 h-7" style={{ background: "hsl(30 10% 50%)" }} />
            <h1 className="text-3xl font-serif font-bold text-stone-800 tracking-tight">
              Scan History
            </h1>
          </div>
          <p className="text-stone-500 font-serif text-sm ml-4 italic">
            Complete log of all field scans — {data?.total ?? 0} records
          </p>
        </motion.div>

        <div className="flex items-center gap-2">
          {[
            { key: "all" as const,   icon: FolderSearch, label: "All"    },
            { key: "image" as const, icon: ImageIcon,    label: "Images" },
            { key: "video" as const, icon: Video,        label: "Video"  },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={filter === key ? "tag-vintage font-bold" : "tag-vintage opacity-60 hover:opacity-100 transition-opacity"}>
              <Icon className="w-3 h-3 mr-1" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="paper-card-vintage h-[280px]" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="paper-card-stitch py-24 flex flex-col items-center justify-center text-center">
          <FolderSearch className="w-10 h-10 text-stone-400 mb-3" />
          <h3 className="text-lg font-serif font-bold text-stone-700 mb-1">No Records Found</h3>
          <p className="text-stone-500 font-serif text-sm italic mb-5 max-w-md">
            No detections match the current filter. Upload media to generate records.
          </p>
          <Link href="/">
            <button className="px-5 py-2 font-serif text-sm font-semibold text-stone-100"
              style={{ background: "hsl(30 10% 25%)" }}>
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
                    <div className="paper-card-vintage group cursor-pointer">
                      {/* Image */}
                      <div className="relative aspect-video overflow-hidden"
                        style={{ background: "hsl(40 30% 90%)" }}>
                        {item.thumbnailUrl && !brokenImages.has(item.id) ? (
                          <img src={item.thumbnailUrl} alt={item.filename}
                            onError={() => setBrokenImages((prev) => new Set(prev).add(item.id))}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400 font-serif text-xs italic">
                            No Preview
                          </div>
                        )}
                        {/* Severity badge */}
                        <div className="absolute top-2 right-2">
                          <span className="tag-vintage text-[10px] uppercase font-bold"
                            style={{ background: `${sev?.color}15`, color: sev?.color, borderColor: `${sev?.color}40` }}>
                            {item.severity}
                          </span>
                        </div>
                        {/* Media type */}
                        <div className="absolute bottom-2 left-2 tag-vintage text-[10px]">
                          {item.mediaType.toUpperCase()}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-3">
                        <h3 className="font-serif text-sm font-semibold text-stone-800 truncate mb-0.5" title={item.filename}>
                          {item.filename}
                        </h3>
                        <p className="text-xs font-mono text-stone-500 mb-2">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>

                        {safeCounts(item.counts).total > 0 ? (
                          <div className="flex items-center justify-center gap-3">
                            {(Object.entries(CLASS_GAUGES) as [keyof typeof CLASS_GAUGES, typeof CLASS_GAUGES[keyof typeof CLASS_GAUGES]][]).map(([key, cfg]) => {
                              const counts = safeCounts(item.counts);
                              const count = counts[key as keyof typeof counts] ?? (item.objects ?? []).filter((o: { className: string }) => o.className === key).length;
                              if (!count) return null;
                              const objectsForClass = (item.objects ?? []).filter((o: { className: string }) => o.className === key);
                              const avgConf = objectsForClass.length > 0
                                ? objectsForClass.reduce((sum: number, o: { confidence: number }) => sum + o.confidence, 0) / objectsForClass.length * 100
                                : 0;
                              return (
                                <CircularGauge
                                  key={key}
                                  value={avgConf}
                                  size={52}
                                  strokeWidth={4}
                                  color={cfg.color}
                                  label={cfg.label}
                                  count={count}
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <span className="font-serif text-xs text-stone-400 italic">Clean scan</span>
                        )}
                      </div>

                      {/* Delete */}
                      <div className="px-3 pb-3 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          disabled={deleteDetection.isPending}
                          className="text-xs font-serif text-stone-400 hover:text-red-600 transition-colors px-2 py-0.5 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3 inline mr-1" />Delete
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
