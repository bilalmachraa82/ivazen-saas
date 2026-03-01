import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { SelectedClientProvider } from "@/hooks/useSelectedClient";
import ErrorBoundary from "@/components/ErrorBoundary";
import CookieBanner from "@/components/CookieBanner";
import PageLoader from "@/components/ui/PageLoader";
import PageRoute from "@/components/PageRoute";
import { featureFlags } from "@/lib/featureFlags";

// ---------------------------------------------------------------------------
// Lazy page imports — each page becomes its own JS chunk (code splitting).
// Non-page providers/wrappers above stay as static imports.
// ---------------------------------------------------------------------------

// Public pages
const Landing            = lazy(() => import('./pages/Landing'));
const Auth               = lazy(() => import('./pages/Auth'));
const Install            = lazy(() => import('./pages/Install'));
const Terms              = lazy(() => import('./pages/Terms'));
const Privacy            = lazy(() => import('./pages/Privacy'));
const Contact            = lazy(() => import('./pages/Contact'));
const NotFound           = lazy(() => import('./pages/NotFound'));

// Protected pages — any authenticated user
const Dashboard          = lazy(() => import('./pages/Dashboard'));
const VATCalculator      = lazy(() => import('./pages/VATCalculator'));
const Upload             = lazy(() => import('./pages/Upload'));
const Validation         = lazy(() => import('./pages/Validation'));
const Documents          = lazy(() => import('./pages/Documents'));
const SalesValidation    = lazy(() => import('./pages/SalesValidation'));
const Export             = lazy(() => import('./pages/Export'));
const Settings           = lazy(() => import('./pages/Settings'));
const SocialSecurity     = lazy(() => import('./pages/SocialSecurity'));
const Modelo10           = lazy(() => import('./pages/Modelo10'));
const AIMetrics          = lazy(() => import('./pages/AIMetrics'));
const Reports            = lazy(() => import('./pages/Reports'));
const BecomeAccountant   = lazy(() => import('./pages/BecomeAccountant'));
const Glossary           = lazy(() => import('./pages/Glossary'));
const ReconciliationAudit = lazy(() => import('./pages/ReconciliationAudit'));

// Protected pages — accountant role
const AccountantDashboard  = lazy(() => import('./pages/AccountantDashboard'));
const AccountantOnboarding = lazy(() => import('./pages/AccountantOnboarding'));
const EFaturaSync          = lazy(() => import('./pages/EFaturaSync'));
const BulkClientSync       = lazy(() => import('./pages/BulkClientSync'));
const ATControlCenter      = lazy(() => import('./pages/ATControlCenter'));
const AdminCertificates    = lazy(() => import('./pages/AdminCertificates'));

// Protected pages — admin role
const AdminPartners        = lazy(() => import('./pages/AdminPartners'));
const AdminUsers           = lazy(() => import('./pages/AdminUsers'));
const AdminAccountants     = lazy(() => import('./pages/AdminAccountants'));
const SuperAdminDashboard  = lazy(() => import('./pages/SuperAdminDashboard'));

// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <SelectedClientProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                {/* Top-level Suspense as a safety net for any uncaught lazy boundary */}
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* ---- Public routes ---- */}
                    <Route path="/" element={
                      <ErrorBoundary><Suspense fallback={<PageLoader />}><Landing /></Suspense></ErrorBoundary>
                    } />
                    <Route path="/auth" element={
                      <ErrorBoundary><Suspense fallback={<PageLoader />}><Auth /></Suspense></ErrorBoundary>
                    } />
                    <Route path="/install" element={
                      <ErrorBoundary><Suspense fallback={<PageLoader />}><Install /></Suspense></ErrorBoundary>
                    } />
                    <Route path="/terms" element={
                      <ErrorBoundary><Suspense fallback={<PageLoader />}><Terms /></Suspense></ErrorBoundary>
                    } />
                    <Route path="/privacy" element={
                      <ErrorBoundary><Suspense fallback={<PageLoader />}><Privacy /></Suspense></ErrorBoundary>
                    } />
                    <Route path="/contact" element={
                      <ErrorBoundary><Suspense fallback={<PageLoader />}><Contact /></Suspense></ErrorBoundary>
                    } />

                    {/* ---- Protected routes — any authenticated user ---- */}
                    <Route path="/dashboard" element={
                      <PageRoute><Dashboard /></PageRoute>
                    } />
                    <Route path="/iva-calculator" element={
                      <PageRoute><VATCalculator /></PageRoute>
                    } />
                    <Route path="/upload" element={
                      <PageRoute><Upload /></PageRoute>
                    } />
                    <Route path="/validation" element={
                      <PageRoute><Validation /></PageRoute>
                    } />
                    <Route path="/documents" element={
                      <PageRoute><Documents /></PageRoute>
                    } />
                    <Route path="/sales" element={
                      <PageRoute><SalesValidation /></PageRoute>
                    } />
                    <Route path="/export" element={
                      <PageRoute><Export /></PageRoute>
                    } />
                    <Route path="/settings" element={
                      <PageRoute><Settings /></PageRoute>
                    } />
                    <Route path="/seguranca-social" element={
                      <PageRoute><SocialSecurity /></PageRoute>
                    } />
                    {/* Permanent redirect — no lazy loading needed */}
                    <Route path="/social-security" element={<Navigate to="/seguranca-social" replace />} />
                    <Route path="/modelo-10" element={
                      <PageRoute><Modelo10 /></PageRoute>
                    } />
                    <Route path="/ai-metrics" element={
                      <PageRoute><AIMetrics /></PageRoute>
                    } />
                    <Route path="/reports" element={
                      <PageRoute><Reports /></PageRoute>
                    } />
                    <Route path="/become-accountant" element={
                      <PageRoute><BecomeAccountant /></PageRoute>
                    } />
                    <Route path="/glossario" element={
                      <PageRoute><Glossary /></PageRoute>
                    } />
                    <Route path="/reconciliation" element={
                      <PageRoute><ReconciliationAudit /></PageRoute>
                    } />

                    {/* ---- Protected routes — accountant role ---- */}
                    <Route path="/accountant" element={
                      <PageRoute requireRole="accountant"><AccountantDashboard /></PageRoute>
                    } />
                    <Route path="/accountant/onboarding" element={
                      <PageRoute requireRole="accountant"><AccountantOnboarding /></PageRoute>
                    } />
                    <Route path="/efatura" element={
                      <PageRoute requireRole="accountant"><EFaturaSync /></PageRoute>
                    } />
                    <Route path="/bulk-sync" element={
                      <PageRoute requireRole="accountant"><BulkClientSync /></PageRoute>
                    } />
                    {featureFlags.atControlCenterV1 && (
                      <Route path="/at-control-center" element={
                        <PageRoute requireRole="accountant"><ATControlCenter /></PageRoute>
                      } />
                    )}
                    <Route path="/admin/certificates" element={
                      <PageRoute requireRole="accountant"><AdminCertificates /></PageRoute>
                    } />

                    {/* ---- Protected routes — admin role ---- */}
                    <Route path="/admin/partners" element={
                      <PageRoute requireRole="admin"><AdminPartners /></PageRoute>
                    } />
                    <Route path="/admin/users" element={
                      <PageRoute requireRole="admin"><AdminUsers /></PageRoute>
                    } />
                    <Route path="/admin/accountants" element={
                      <PageRoute requireRole="admin"><AdminAccountants /></PageRoute>
                    } />
                    <Route path="/admin/super" element={
                      <PageRoute requireRole="admin"><SuperAdminDashboard /></PageRoute>
                    } />

                    {/* ---- Catch-all ---- */}
                    <Route path="*" element={
                      <ErrorBoundary><Suspense fallback={<PageLoader />}><NotFound /></Suspense></ErrorBoundary>
                    } />
                  </Routes>
                </Suspense>
                <CookieBanner />
              </BrowserRouter>
            </SelectedClientProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
