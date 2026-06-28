import { ArrowLeft, LogOut } from "lucide-react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { LocaleToggle } from "@/components/app/locale-toggle";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";

export function ProfileLayout() {
  const { user, memberships, logout } = useAuth();
  const navigate = useNavigate();

  const backHref = user?.isSuperAdmin
    ? "/admin"
    : memberships.length === 1
      ? `/s/${memberships[0].siteId}`
      : "/sites";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur-md">
        <Link
          to={backHref}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to workspace
        </Link>

        <div className="flex items-center gap-1">
          <LocaleToggle />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
