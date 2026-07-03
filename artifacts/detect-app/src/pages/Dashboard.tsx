import { motion } from "framer-motion";
import { useGetStats, useGetRecentDetections } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Target, TrendingUp, Timer, ChevronRight, AlertTriangle } from "lucide-react";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar, Cell,
} from "recharts";
import { Link } from "wouter";

const SEVERITY_CONFIG = {
  low:      { bg: "from-emerald-500/10 to-green-600/5",   border: "border-emerald-300",  text: "text-emerald-700",  dot: "#22c55e" },
  medium:   { bg: "from-amber-500/10 to-yellow-600/5",    border: "border-amber-300",    text: "text-amber-700",    dot: "#f59e0b" },
  high:     { bg: "from-orange-500/10 to-red-600/5",      border: "border-orange-300",   text: "text-orange-700",   dot: "#f97316" },
  critical: { bg: "from-red-500/10 to-rose-700/5",        border: "border-red-300",      text: "text-red-700",      dot: "#ef4444" },
};

const STAT_CARDS = [
  { key: "totalScans",     label: "Total Scans",      icon: Activity,   gradient: "from-cyan-50 via-cyan-50/50 to-transparent",  border: "border-cyan-300",   accent: "#0891b2" },
  { key: "totalObjects",   label: "Objects Detected", icon: Target,     gradient: "from-purple-50 via-purple-50/50 to-transparent", border: "border-purple-300", accent: "#9333ea" },
  { key: "avgConfidence",  label: "Avg Confidence",   icon: TrendingUp, gradient: "from-green-50 via-green-50/50 to-transparent",  border: "border-green-300",  accent: "#16a34a" },
  { key: "avgProcessingMs",label: "Avg Processing",   icon: Timer,      gradient: "from-amber-50 via-amber-50/50 to-transparent",  border: "border-amber-300",  accent: "#d97706" },
];

const CLASS_CONFIG = [
  { key: "pothole",       label: "Potholes",      color: "#ef4444", bg: "from-red-500/20 to-red-900/5",    border: "border-red-500/30"    },
  { key: "plastic_waste", label: "Plastic Waste", color: "#f59e0b", bg: "from-amber-500/20 to-amber-900/5", border: "border-amber-500/30"  },
  { key: "other_litter",  label: "Other Litter",  color: "#a855f7", bg: "from-purple-500/20 to-purple-900/5", border: "border-purple-500/30" },
];

function formatValue(key: string, val: number): string {
  if (key === "avgConfidence") return `${(val * 100).toFixed(1)}%`;
  if (key === "avgProcessingMs") return `${Math.round(val)}ms`;
  return String(val);
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useGetStats();
  const { data: recent, isLoading: recentLoading, error: recentError } = useGetRecentDetections();

  if (statsLoading || recentLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64 rounded-lg bg-muted" />
          <Skeleton className="h-4 w-96 rounded bg-muted" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl bg-muted" />)}
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl bg-muted" />
      </div>
    );
  }

  if (statsError || recentError) {
    return (
      <div className="py-20 text-center">
        <p className="text-destructive font-mono">Failed to load dashboard data. Please try again later.</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground font-mono">No analytics data available yet. Run some scans first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-8 rounded-full" style={{ background: "linear-gradient(180deg, #00d4ff, #a855f7)" }} />
          <h1 className="text-4xl font-black tracking-tight" style={{ background: "linear-gradient(135deg, #00d4ff, #22c55e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Command Center</h1>
        </div>
        <p className="text-muted-foreground font-mono text-sm ml-4">
          Real-time aggregated analytics — monitoring urban infrastructure across all field scans.
        </p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card, i) => {
          const Icon = card.icon;
          const rawVal = stats[card.key as keyof typeof stats] as number;
          const displayVal = formatValue(card.key, rawVal);
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className={`relative overflow-hidden rounded-xl border ${card.border} bg-gradient-to-br ${card.gradient} p-5 hover:shadow-md transition-shadow`}
            >
              <div className="flex justify-between items-start mb-4">
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{card.label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${card.accent}22`, border: `1px solid ${card.accent}44` }}>
                  <Icon className="w-4 h-4" style={{ color: card.accent }} />
                </div>
              </div>
              <div className="text-3xl font-black tracking-tight mb-1" style={{ color: card.accent }}>
                {displayVal}
              </div>
              <div className="h-0.5 rounded-full mt-3 opacity-40" style={{ background: `linear-gradient(90deg, ${card.accent}, transparent)` }} />
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-xl border border-border overflow-hidden bg-card"
        >
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-600" />
              <span className="font-mono text-sm uppercase tracking-widest text-foreground">Daily Scan Activity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-xs font-mono text-muted-foreground/70">Live</span>
            </div>
          </div>
          <div className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.recentActivity}>
                <defs>
                  <linearGradient id="gradScans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradObjects" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(30 10% 75%)" />
                <XAxis dataKey="date" tickLine={false} axisLine={false}
                  tick={{ fontSize: 11, fontFamily: 'Space Mono', fill: 'hsl(30 10% 50%)' }} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false}
                  tick={{ fontSize: 11, fontFamily: 'Space Mono', fill: 'hsl(30 10% 50%)' }} tickMargin={8} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(40 30% 95%)', border: '1px solid hsl(30 10% 75%)', borderRadius: 8, fontFamily: 'Space Mono', fontSize: 11 }}
                  labelStyle={{ color: 'hsl(30 10% 20%)' }}
                  itemStyle={{ color: '#0891b2' }}
                />
                <Area type="monotone" dataKey="scans" stroke="#00d4ff" strokeWidth={2.5}
                  fill="url(#gradScans)" animationDuration={1200} dot={false} />
                <Area type="monotone" dataKey="objects" stroke="#a855f7" strokeWidth={2}
                  fill="url(#gradObjects)" animationDuration={1400} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Class breakdown */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-xl border border-border overflow-hidden bg-card"
          >
            <div className="px-4 py-3 border-b border-border">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Class Breakdown</span>
            </div>
            <div className="p-4 space-y-3">
              {CLASS_CONFIG.map((cls) => {
                const val = stats.classBreakdown[cls.key as keyof typeof stats.classBreakdown] as number;
                const pct = stats.totalObjects > 0 ? (val / stats.totalObjects) * 100 : 0;
                return (
                  <div key={cls.key}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs font-mono text-muted-foreground">{cls.label}</span>
                      <span className="text-xs font-mono font-bold" style={{ color: cls.color }}>{val}</span>
                    </div>
                    <div className="h-1.5 rounded-full w-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${cls.color}, ${cls.color}88)` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mini bar chart */}
            <div className="px-4 pb-4 h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ name: "Dist", pothole: stats.classBreakdown.pothole, plastic: stats.classBreakdown.plastic_waste, litter: stats.classBreakdown.other_litter }]} barSize={28} barGap={6}>
                  <Bar dataKey="pothole" radius={[4,4,0,0]} fill="#ef4444" />
                  <Bar dataKey="plastic" radius={[4,4,0,0]} fill="#f59e0b" />
                  <Bar dataKey="litter" radius={[4,4,0,0]} fill="#a855f7" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Severity distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-border overflow-hidden bg-card"
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Recent Alerts</span>
              <Link href="/history">
                <span className="text-xs font-mono text-cyan-600 hover:text-cyan-700 flex items-center gap-1 cursor-pointer">
                  All <ChevronRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {(recent ?? []).slice(0, 4).map((item) => {
                const sev = SEVERITY_CONFIG[item.severity as keyof typeof SEVERITY_CONFIG];
                return (
                  <Link key={item.id} href={`/detection/${item.id}`}>
                    <div className="px-4 py-3 hover:bg-muted transition-colors cursor-pointer flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sev?.dot ?? "#6b7280", boxShadow: `0 0 6px ${sev?.dot ?? "#6b7280"}` }} />
                          <p className="text-xs font-medium truncate text-foreground">{item.filename}</p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-bold ${sev?.text ?? ""} ${sev?.border ?? ""}`}>
                        {item.severity}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
  return (
    <span className={`text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded border font-bold ${config?.text ?? "text-muted-foreground"} ${config?.border ?? "border-border"} bg-gradient-to-r ${config?.bg ?? ""}`}>
      {severity}
    </span>
  );
}
