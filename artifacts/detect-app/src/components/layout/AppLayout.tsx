import { useState } from "react";
import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ScanLine, Activity, History as HistoryIcon, Camera, Menu, X, PanelLeft, PanelLeftClose, LogOut, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: "/", label: "Upload & Analyze", icon: ScanLine },
  { href: "/camera", label: "Live Camera", icon: Camera },
  { href: "/map", label: "Detection Map", icon: MapPin },
  { href: "/dashboard", label: "Dashboard", icon: Activity },
  { href: "/history", label: "Scan History", icon: HistoryIcon },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const { user, logout } = useAuth();

  const NavItem = ({ href, label, icon: Icon, onNavigate }: { href: string; label: string; icon: any; onNavigate?: () => void }) => {
    const isActive = location === href || (href !== "/" && location.startsWith(href));
    return (
      <Link key={href} href={href}>
        <div
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-all cursor-pointer font-serif whitespace-nowrap",
            isActive
              ? "bg-stone-200/70 text-stone-800"
              : "text-stone-500 hover:text-stone-700 hover:bg-stone-200/30"
          )}
          onClick={(e) => {
            if (onNavigate) onNavigate();
          }}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span>{label}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-amber-50/60 blue-ink paper-scratches paper-stains">
      {/* Hamburger button — mobile only */}
      <button
        onClick={() => setMobileOpen((v) => !v)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-white border border-stone-300 shadow-sm"
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X className="w-5 h-5 text-stone-700" /> : <Menu className="w-5 h-5 text-stone-700" />}
      </button>

      {/* Mobile backdrop */}
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

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="md:hidden fixed inset-y-0 left-0 z-40 w-56 paper-card-deep paper-texture border-r border-stone-300/50 flex flex-col"
          >
            <div className="h-14 flex items-center px-4 border-b border-dashed border-stone-300/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-stone-200 border border-stone-300 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 90 L70 70 L90 90 L110 70 L130 90" stroke="#78716c" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <circle cx="90" cy="90" r="8" fill="#78716c"/>
                    <path d="M50 120 H130" stroke="#78716c" strokeWidth="6" strokeLinecap="round"/>
                  </svg>
                </div>
                <span className="font-serif font-bold text-sm text-stone-700">RoadScan</span>
              </div>
            </div>
            <nav className="flex-1 py-4 px-2 space-y-0.5">
              {navItems.map((item) => (
                <NavItem key={item.href} {...item} onNavigate={() => setMobileOpen(false)} />
              ))}
            </nav>
            <div className="p-3 border-t border-dashed border-stone-300/50 shrink-0">
              <p className="text-[10px] text-stone-400 font-serif italic text-center">RoadScan v2.0</p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar — always visible, toggle collapse via footer button */}
      <AnimatePresence>
        {desktopOpen && (
          <motion.aside
            initial={{ x: -224 }}
            animate={{ x: 0 }}
            exit={{ x: -224 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="hidden md:flex fixed inset-y-0 left-0 z-40 w-56 paper-card-deep paper-texture border-r border-stone-300/50 flex-col"
          >
            <div className="h-14 flex items-center px-4 border-b border-dashed border-stone-300/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-stone-200 border border-stone-300 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 90 L70 70 L90 90 L110 70 L130 90" stroke="#78716c" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <circle cx="90" cy="90" r="8" fill="#78716c"/>
                    <path d="M50 120 H130" stroke="#78716c" strokeWidth="6" strokeLinecap="round"/>
                  </svg>
                </div>
                <span className="font-serif font-bold text-sm text-stone-700">RoadScan</span>
              </div>
            </div>
            <nav className="flex-1 py-4 px-2 space-y-0.5">
              {navItems.map((item) => (
                <NavItem key={item.href} {...item} />
              ))}
            </nav>
            <div className="p-3 border-t border-dashed border-stone-300/50 shrink-0 space-y-1">
              {user && (
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-2 py-1.5 rounded text-xs font-mono text-stone-500 hover:text-red-700 hover:bg-red-100/50 transition-colors whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sign Out</span>
                </button>
              )}
              <button
                onClick={() => setDesktopOpen(false)}
                className="hidden md:flex w-full items-center gap-2 px-2 py-1.5 rounded text-xs font-mono text-stone-500 hover:text-stone-700 hover:bg-stone-200/50 transition-colors whitespace-nowrap"
              >
                <PanelLeftClose className="w-4 h-4 shrink-0" />
                <span>Collapse Menu</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop expand button */}
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

      {/* Main content — always full width */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-full relative">
        {/* Blurred background image for all pages after login */}
        <div 
          className="absolute inset-0 bg-cover bg-center pointer-events-none filter blur-sm scale-105 opacity-25" 
          style={{ backgroundImage: "url('/scribble_bg.jpg')" }}
        />
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 px-4 pt-14 pb-4 md:px-8 md:pt-8 md:pb-8">
          <div className="w-full h-full">{children}</div>
        </div>
      </main>
    </div>
  );
}
