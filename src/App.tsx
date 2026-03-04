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

// Lazy load pages for better code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const KioskPickup = lazy(() => import("./pages/KioskPickup"));
const KioskKitchen = lazy(() => import("./pages/KioskKitchen"));

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
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AuthProvider>
              } />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
