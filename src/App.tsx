import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { UpdateProvider } from "@/contexts/UpdateContext";

// Lazy load pages with one-time auto-reload on stale chunk errors (post-deploy hash mismatch)
function lazyWithReload<T extends { default: React.ComponentType<any> }>(
  factory: () => Promise<T>,
  key: string,
) {
  return lazy(() =>
    factory().catch((err) => {
      const msg = String(err?.message || err);
      const isChunkError =
        /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i.test(
          msg,
        );
      if (!isChunkError) throw err;
      const flag = `chunk-reload:${key}`;
      try {
        if (sessionStorage.getItem(flag)) throw err;
        sessionStorage.setItem(flag, String(Date.now()));
      } catch {}
      console.warn(`[App] Stale chunk for ${key}, reloading...`, msg);
      window.location.reload();
      return new Promise<T>(() => {}) as Promise<T>;
    }),
  );
}

// Lazy load pages for better code splitting
const Index = lazyWithReload(() => import("./pages/Index"), "Index");
const Auth = lazyWithReload(() => import("./pages/Auth"), "Auth");
const AuthConfirm = lazyWithReload(() => import("./pages/AuthConfirm"), "AuthConfirm");
const NotFound = lazyWithReload(() => import("./pages/NotFound"), "NotFound");
const KioskPickup = lazyWithReload(() => import("./pages/KioskPickup"), "KioskPickup");
const KioskKitchen = lazyWithReload(() => import("./pages/KioskKitchen"), "KioskKitchen");

const queryClient = new QueryClient();

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center">
    <LoadingSpinner size="xl" text="Učitavanje..." />
  </div>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <UpdateProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <UpdatePrompt />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Kiosk routes - outside AuthProvider, no auth required */}
              <Route path="/kiosk/pickup" element={<KioskPickup />} />
              <Route path="/kiosk/kitchen" element={<KioskKitchen />} />
              
              {/* Main app routes - wrapped in AuthProvider */}
              <Route path="/*" element={
                <AuthProvider>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/auth/confirm" element={<AuthConfirm />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AuthProvider>
              } />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
      </UpdateProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
