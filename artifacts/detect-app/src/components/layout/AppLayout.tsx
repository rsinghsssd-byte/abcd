import { useState } from "react";
import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ScanLine, Activity, History as HistoryIcon, Camera, Menu, X, PanelLeft, PanelLeftClose } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: "/", label: "Upload & Analyze", icon: ScanLine },
  { href: "/camera", label: "Live Camera", icon: Camera },
  { href: "/dashboard", label: "Dashboard", icon: Activity },
  { href: "/history", label: "Scan History", icon: HistoryIcon },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-amber-50/60">
      {/* Hamburger button — mobile only */}
      <button
        onClick={() => setMobileOpen((v) => !v)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-white border border-stone-300 shadow-sm"
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X className="w-5 h-5 text-stone-700" /> : <Menu className="w-5 h-5 text-stone-700" />}
      </button>

      {/* Backdrop overlay — mobile only */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/40 z-30"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:relative inset-y-0 left-0 z-40 md:z-auto flex flex-col border-r border-stone-300/40 bg-stone-50/80 paper-texture transition-all duration-300",
          "w-56",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          desktopOpen ? "md:translate-x-0" : "md:-translate-x-full md:w-0 md:min-w-0 md:border-r-0 md:overflow-hidden"
        )}
      >
        <div className="h-14 flex items-center px-4 border-b border-dashed border-stone-300/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-stone-200 border border-stone-300 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 90 L70 70 L90 90 L110 70 L130 90" stroke="#78716c" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <circle cx="90" cy="90" r="8" fill="#78716c"/>
                <path d="M50 120 H130" stroke="#78716c" stroke-width="6" stroke-linecap="round"/>
              </svg>
            </div>
            <span className="font-serif font-bold text-sm text-stone-700">RoadScan</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-all cursor-pointer font-serif whitespace-nowrap",
                    isActive
                      ? "bg-stone-200/70 text-stone-800"
                      : "text-stone-500 hover:text-stone-700 hover:bg-stone-200/30"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-dashed border-stone-300/50 shrink-0">
          <button
            onClick={() => setDesktopOpen((v) => !v)}
            className="hidden md:flex w-full items-center gap-2 px-2 py-1.5 rounded text-xs font-mono text-stone-500 hover:text-stone-700 hover:bg-stone-200/50 transition-colors whitespace-nowrap"
          >
            {desktopOpen ? <PanelLeftClose className="w-4 h-4 shrink-0" /> : <PanelLeft className="w-4 h-4 shrink-0" />}
            <span>{desktopOpen ? "Collapse" : "Expand Menu"}</span>
          </button>
          <div className="text-[10px] text-stone-400 font-serif italic text-center md:hidden">
            RoadScan v2.0
          </div>
        </div>
      </aside>

      {/* Toggle button when sidebar is collapsed on desktop */}
      <AnimatePresence>
        {!desktopOpen && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onClick={() => setDesktopOpen(true)}
            className="hidden md:flex fixed top-3 left-3 z-40 p-2 rounded-lg bg-white border border-stone-300 shadow-sm"
            aria-label="Expand sidebar"
          >
            <PanelLeft className="w-4 h-4 text-stone-700" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto relative z-10 p-4 md:p-8">
          <div className="w-full h-full">{children}</div>
        </div>
      </main>
    </div>
  );
}
