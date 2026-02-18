import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { SelectedClientProvider } from "@/hooks/useSelectedClient";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Upload from "./pages/Upload";
import Validation from "./pages/Validation";
import Export from "./pages/Export";
import Settings from "./pages/Settings";
import AccountantDashboard from "./pages/AccountantDashboard";
import AccountantOnboarding from "./pages/AccountantOnboarding";
import SocialSecurity from "./pages/SocialSecurity";
import Modelo10 from "./pages/Modelo10";
import AIMetrics from "./pages/AIMetrics";
import Install from "./pages/Install";
import SalesValidation from "./pages/SalesValidation";
import AdminPartners from "./pages/AdminPartners";
import AdminUsers from "./pages/AdminUsers";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Contact from "./pages/Contact";
import Reports from "./pages/Reports";
import BecomeAccountant from "./pages/BecomeAccountant";
import AdminAccountants from "./pages/AdminAccountants";
import VATCalculator from "./pages/VATCalculator";
import Glossary from "./pages/Glossary";
import Documents from "./pages/Documents";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import ReconciliationAudit from "./pages/ReconciliationAudit";
import EFaturaSync from "./pages/EFaturaSync";
import AdminCertificates from "./pages/AdminCertificates";
import BulkClientSync from "./pages/BulkClientSync";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

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
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/install" element={<Install />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/contact" element={<Contact />} />
                
                {/* Protected routes - require authentication */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/iva-calculator" element={<ProtectedRoute><VATCalculator /></ProtectedRoute>} />
                <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
                <Route path="/validation" element={<ProtectedRoute><Validation /></ProtectedRoute>} />
                <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
                <Route path="/sales" element={<ProtectedRoute><SalesValidation /></ProtectedRoute>} />
                <Route path="/export" element={<ProtectedRoute><Export /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/accountant" element={<ProtectedRoute requireRole="accountant"><AccountantDashboard /></ProtectedRoute>} />
                <Route path="/accountant/onboarding" element={<ProtectedRoute requireRole="accountant"><AccountantOnboarding /></ProtectedRoute>} />
                <Route path="/seguranca-social" element={<ProtectedRoute><SocialSecurity /></ProtectedRoute>} />
                <Route path="/social-security" element={<Navigate to="/seguranca-social" replace />} />
                <Route path="/modelo-10" element={<ProtectedRoute><Modelo10 /></ProtectedRoute>} />
                <Route path="/ai-metrics" element={<ProtectedRoute><AIMetrics /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/admin/partners" element={<ProtectedRoute requireRole="admin"><AdminPartners /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute requireRole="admin"><AdminUsers /></ProtectedRoute>} />
                <Route path="/admin/accountants" element={<ProtectedRoute requireRole="admin"><AdminAccountants /></ProtectedRoute>} />
                <Route path="/admin/super" element={<ProtectedRoute requireRole="admin"><SuperAdminDashboard /></ProtectedRoute>} />
                <Route path="/become-accountant" element={<ProtectedRoute><BecomeAccountant /></ProtectedRoute>} />
                <Route path="/glossario" element={<ProtectedRoute><Glossary /></ProtectedRoute>} />
                <Route path="/efatura" element={<ProtectedRoute requireRole="accountant"><EFaturaSync /></ProtectedRoute>} />
                <Route path="/bulk-sync" element={<ProtectedRoute requireRole="accountant"><BulkClientSync /></ProtectedRoute>} />
                <Route path="/reconciliation" element={<ProtectedRoute><ReconciliationAudit /></ProtectedRoute>} />
                <Route path="/admin/certificates" element={<ProtectedRoute requireRole="accountant"><AdminCertificates /></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              
            </BrowserRouter>
            </SelectedClientProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
