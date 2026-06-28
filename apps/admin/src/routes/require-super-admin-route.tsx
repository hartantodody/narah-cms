import { Navigate, Outlet } from "react-router-dom";
import { AppLoadingScreen } from "@/components/app/app-loading-screen";
import { useAuth } from "@/features/auth/auth-provider";

export function RequireSuperAdminRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  if (!user?.isSuperAdmin) {
    return <Navigate to="/sites" replace />;
  }

  return <Outlet />;
}
