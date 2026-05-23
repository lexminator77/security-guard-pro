// @ts-nocheck
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Shield } from "lucide-react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Shield className="h-12 w-12 text-primary animate-pulse" />
          <p className="text-muted-foreground text-sm">Chargement…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Formateur → espace formateur uniquement
  if (roles.includes("formateur") && !roles.includes("administrateur") && !roles.includes("secretaire")) {
    return <Navigate to="/espace-formateur" replace />;
  }

  // Stagiaire → espace stagiaire uniquement
  if (roles.includes("stagiaire") && !roles.includes("administrateur") && !roles.includes("secretaire")) {
    return <Navigate to="/espace-stagiaire" replace />;
  }

  // RH → espace RH uniquement
  if (roles.includes("rh") && !roles.includes("administrateur") && !roles.includes("secretaire")) {
    return <Navigate to="/espace-rh" replace />;
  }

  return <>{children}</>;
}