import { useGetDetection } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Calendar, FileType, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SeverityBadge } from "./Dashboard";

export default function DetectionDetail() {
  const params = useParams();
  const id = params.id ? parseInt(params.id, 10) : null;
  
  const { data: detection, isLoading } = useGetDetection(id as number, {
    query: { enabled: Number.isFinite(id as number) && (id as number) > 0 } as { enabled: boolean; queryKey: readonly unknown[] },
  });

  if (isLoading) {
    return <div className="animate-pulse h-screen bg-accent/20" />;
  }

  if (!detection) {
    return (
      <div className="py-24 text-center">
        <h2 className="text-2xl font-bold">Record Not Found</h2>
        <Link href="/history">
          <Button className="mt-4 font-mono">Return to History</Button>
        </Link>
      </div>
    );
  }

  const counts = detection.counts ?? { total: 0 };
  const objects = detection.objects ?? [];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <Link href="/history">
          <Button variant="ghost" className="font-mono text-xs uppercase tracking-wider hover:bg-accent/50 pl-0">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Log
          </Button>
        </Link>
        <div className="font-mono text-xs text-muted-foreground">
          ID: {String(detection.id).padStart(6, '0')}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Image */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-border p-1 bg-white rounded-none">
            <div className="relative bg-muted overflow-hidden group">
              <img 
                src={detection.annotatedUrl || detection.originalUrl} 
                alt={detection.filename} 
                className="w-full h-auto"
              />
              {/* Optional: Add custom crosshairs overlay */}
              <div className="absolute inset-0 pointer-events-none border border-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-foreground/30" />
                <div className="absolute left-1/2 top-0 w-[1px] h-full bg-foreground/30" />
              </div>
            </div>
          </Card>
          
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetaBox icon={FileType} label="Media Type" value={(detection.mediaType ?? "unknown").toUpperCase()} />
        <MetaBox icon={Clock} label="Processing" value={`${detection.processingTimeMs ?? 0}ms`} />
        <MetaBox icon={Calendar} label="Date" value={detection.createdAt ? new Date(detection.createdAt).toLocaleDateString() : "—"} />
      </div>
    </div>

      {/* Sidebar Data */}
      <div className="space-y-6">
        <Card className="border border-border rounded-none shadow-none bg-card p-6">
          <h2 className="font-bold text-xl mb-6 flex items-center justify-between">
            Analysis Report
            <SeverityBadge severity={detection.severity ?? "low"} />
          </h2>
          
          <div className="space-y-4 mb-8">
            <div className="flex justify-between py-2 border-b border-border/50 text-sm">
              <span className="text-muted-foreground font-mono">Filename</span>
              <span className="font-semibold truncate max-w-[150px]" title={detection.filename ?? ""}>{detection.filename ?? "—"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50 text-sm">
              <span className="text-muted-foreground font-mono">Total Objects</span>
              <span className="font-semibold font-mono">{counts.total}</span>
            </div>
          </div>

          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Detected Entities</h3>
          
          {objects.length === 0 ? (
            <div className="text-sm font-mono text-muted-foreground p-4 bg-accent/20 border border-dashed border-border text-center">
              Clean frame. No entities detected.
            </div>
          ) : (
            <div className="space-y-3">
              {objects.map((obj, i) => {
                const bbox = obj.bbox ?? { x: 0, y: 0, width: 0, height: 0 };
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={obj.id} 
                    className="p-3 border border-border bg-background"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3 h-3 text-muted-foreground" />
                        <span className="font-semibold text-sm capitalize">
                          {(obj.className ?? "unknown").replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="font-mono text-xs">{(obj.confidence ?? 0) * 100}%</span>
                    </div>
                    <Progress value={(obj.confidence ?? 0) * 100} className="h-1 bg-accent rounded-none mb-2" />
                    <div className="text-[10px] font-mono text-muted-foreground">
                      BBOX: [{bbox.x.toFixed(2)}, {bbox.y.toFixed(2)}, {bbox.width.toFixed(2)}, {bbox.height.toFixed(2)}]
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      </div>
    </div>
  );
}

function MetaBox({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="border border-border p-3 bg-card flex flex-col justify-between">
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        <Icon className="w-3 h-3" />
        <span className="text-[10px] font-mono uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-bold text-sm truncate" title={value}>{value}</div>
    </div>
  );
}
