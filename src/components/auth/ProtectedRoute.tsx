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

  if (requireRole && roles.length > 0 && !hasRole(requireRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
