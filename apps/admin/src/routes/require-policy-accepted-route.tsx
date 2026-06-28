import { Navigate, Outlet } from "react-router-dom";
import { AppLoadingScreen } from "@/components/app/app-loading-screen";
import { useAuth } from "@/features/auth/auth-provider";

export function RequirePolicyAcceptedRoute() {
  const { isAuthenticated, isLoading, requiresPolicyAcceptance } = useAuth();

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiresPolicyAcceptance) {
    return <Navigate to="/onboarding/policies" replace />;
  }

  return <Outlet />;
}
