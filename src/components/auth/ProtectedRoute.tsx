import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ZenLoader } from "@/components/zen";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: "client" | "accountant" | "admin";
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { user, loading, roles, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <ZenLoader text="A verificar autenticação..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If a specific role is required, check that the user has it.
  // Previously `roles.length > 0` allowed users with an empty roles array
  // (e.g. freshly signed-up users whose role hasn't propagated yet) to bypass
  // the check and access role-gated pages. Now we always enforce the check.
  if (requireRole && !hasRole(requireRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
