import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppLoadingScreen } from "@/components/app/app-loading-screen";
import { useAuth } from "@/features/auth/auth-provider";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
