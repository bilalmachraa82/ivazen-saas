import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import ErrorBoundary from '@/components/ErrorBoundary';
import PageLoader from '@/components/ui/PageLoader';

// Mirror the literal union from useAuth so we don't re-export a private type
type AppRole = 'client' | 'accountant' | 'admin';

interface PageRouteProps {
  children: ReactNode;
  requireRole?: AppRole;
}

/**
 * PageRoute — composes ErrorBoundary + ProtectedRoute + Suspense for every
 * authenticated page route.
 *
 * Usage (protected, any authenticated user):
 *   <Route path="/dashboard" element={<PageRoute><Dashboard /></PageRoute>} />
 *
 * Usage (role-gated):
 *   <Route path="/admin/super" element={<PageRoute requireRole="admin"><SuperAdminDashboard /></PageRoute>} />
 */
export default function PageRoute({ children, requireRole }: PageRouteProps) {
  return (
    <ErrorBoundary>
      <ProtectedRoute requireRole={requireRole}>
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </ProtectedRoute>
    </ErrorBoundary>
  );
}
