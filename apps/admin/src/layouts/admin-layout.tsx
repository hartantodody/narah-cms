import {
  Building2,
  Gauge,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import { AppRail, type RailSection } from "@/components/app/app-rail";
import { LocaleToggle } from "@/components/app/locale-toggle";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { useAuth } from "@/features/auth/auth-provider";

/* ────────────────────────────────────────────────────────────── */

/**
 * Admin shell — super-admin only. Platform-level navigation lives in the
 * rail itself (no secondary panel), since the site context panel is
 * reserved for when the user is actually inside a site.
 */

const adminSections: RailSection[] = [
  {
    label: "Platform",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard, to: "/admin", end: true },
      { id: "sites", label: "Sites", icon: Building2, to: "/admin/sites", end: true },
      { id: "users", label: "Users", icon: Users, to: "/admin/users", end: true },
      { id: "audit", label: "Audit log", icon: History, to: "/admin/audit-log", end: true },
    ],
  },
  {
    label: "System",
    items: [
      { id: "settings", label: "Settings", icon: Settings, to: "/admin/settings", end: true },
      { id: "health", label: "API health", icon: Gauge, to: "/admin/health", end: true, badge: "soon" },
    ],
  },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { t } = useTranslation();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const displayName = user?.name ?? user?.email ?? "User";
  const userInitial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <div className="narah-shell-stage h-screen overflow-hidden text-foreground">
      <div className="h-screen p-3">
        <div className="narah-glass flex h-[calc(100vh-1.5rem)] overflow-hidden rounded-2xl">
          {/* Rail — admin items inline, expanded by default */}
          <AppRail defaultExpanded sections={adminSections} />

          {/* Main */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 px-5">
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                platform · admin
              </span>

              <div className="flex items-center gap-1">
                <LocaleToggle />
                <ThemeToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-2 px-2 text-xs">
                      <Avatar initial={userInitial} />
                      <span className="hidden max-w-35 truncate sm:inline">{displayName}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="flex flex-col gap-0.5">
                      <span className="text-sm">{displayName}</span>
                      <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-2 text-sm">
                      {t("topbar.profile")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} className="gap-2 text-sm">
                      <LogOut className="size-3.5" />
                      {t("topbar.signOut")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
              <div className="mx-auto w-full max-w-7xl px-8 py-8">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

const Avatar = ({ initial }: { initial: string }) => (
  <span
    className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground text-[0.65rem] font-semibold text-background"
    aria-hidden
  >
    {initial}
  </span>
);
