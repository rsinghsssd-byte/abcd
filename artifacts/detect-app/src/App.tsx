import React, { useState, useEffect, lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { setGlobalHeader, setAuthTokenGetter } from "@workspace/api-client-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";
import { speak } from "@/lib/tts";

import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import History from "@/pages/History";
import DetectionDetail from "@/pages/DetectionDetail";
import CameraPage from "@/pages/CameraPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function AppContent() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    setGlobalHeader("X-Username", user?.username ?? null);
    setAuthTokenGetter(() => localStorage.getItem("roadscan_token"));
  }, [user?.username]);

  const [greeted, setGreeted] = useState(false);
  useEffect(() => {
    if (greeted || isLoading) return;
    setGreeted(true);
    if (user) {
      const name = user.displayName || user.username;
      speak(`Hi ${name}, welcome back to RoadScan.`);
    }
  }, [user, isLoading, greeted]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    const Login = lazy(() => import("@/pages/Login"));
    return (
      <Suspense fallback={null}>
        <Login />
      </Suspense>
    );
  }

  return (
    <ErrorBoundary>
      <AppShell>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/camera" component={CameraPage} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/history" component={History} />
          <Route path="/detection/:id" component={DetectionDetail} />
          <Route component={NotFound} />
        </Switch>
      </AppShell>
    </ErrorBoundary>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(!user?.onboardingCompleted);
  const OnboardingWizard = lazy(() => import("@/components/onboarding/OnboardingWizard"));
  return (
    <>
      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
        </Suspense>
      )}
      <AppLayout>{children}</AppLayout>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppContent />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
