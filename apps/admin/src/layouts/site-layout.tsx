import {
  Archive,
  ArrowLeft,
  FileText,
  History,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Pencil,
  Settings,
  Shapes,
  ShieldAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { AppLoadingScreen } from "@/components/app/app-loading-screen";
import { AppRail } from "@/components/app/app-rail";
import { LocaleToggle } from "@/components/app/locale-toggle";
import { ThemeToggle } from "@/components/app/theme-toggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/features/auth/auth-provider";
import { archiveSite, getSite } from "@/features/sites/site.api";
import type { SiteDetail } from "@/features/sites/site.types";
import { SiteAvatar } from "@/features/sites/site-avatar";
import { SiteFormDialog } from "@/features/sites/site-form-dialog";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api";
import type { SiteLayoutContextValue, SiteRole } from "./site-layout-context";

type NavLeaf = {
  label: string;
  icon: typeof LayoutDashboard;
  to: string;
  end?: boolean;
};

/* ────────────────────────────────────────────────────────────── */
/* Section label resolver for the topbar breadcrumb              */
/* ────────────────────────────────────────────────────────────── */

function resolveSectionLabel(pathname: string, base: string): string | null {
  if (pathname === base) return null;
  const tail = pathname.slice(base.length);
  if (tail.startsWith("/content-types/")) {
    if (tail.includes("/entries/")) return "Edit entry";
    if (tail.endsWith("/entries")) return "Entries";
    if (tail.endsWith("/api")) return "API explorer";
    return "Schema editor";
  }
  if (tail.startsWith("/content")) return "Content";
  if (tail.startsWith("/media")) return "Media";
  if (tail.startsWith("/schema")) return "Schema";
  if (tail.startsWith("/members")) return "Members";
  if (tail.startsWith("/invitations")) return "Invitations";
  if (tail.startsWith("/api-keys")) return "API Keys";
  if (tail.startsWith("/audit-log")) return "Audit log";
  if (tail.startsWith("/settings")) return "Settings";
  return null;
}

/* ────────────────────────────────────────────────────────────── */

export function SiteLayout() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, memberships, isLoading: authLoading, logout } = useAuth();

  const [site, setSite] = useState<SiteDetail | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);
  const [siteError, setSiteError] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const refresh = useCallback(async () => {
    if (!siteId) return;
    try {
      const response = await getSite(siteId);
      setSite(response.site);
    } catch (error) {
      setSiteError(getApiErrorMessage(error, "Failed to refresh site."));
    }
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    setSiteLoading(true);
    setSiteError(null);
    getSite(siteId)
      .then((r) => {
        if (!cancelled) setSite(r.site);
      })
      .catch((error) => {
        if (!cancelled) setSiteError(getApiErrorMessage(error, "Couldn't load this site."));
      })
      .finally(() => {
        if (!cancelled) setSiteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  if (authLoading) return <AppLoadingScreen />;
  if (!siteId) return <Navigate to="/sites" replace />;

  const membership = memberships.find((m) => m.siteId === siteId);
  const isSuperAdmin = !!user?.isSuperAdmin;
  const isImpersonating = isSuperAdmin && !membership;

  if (!membership && !isSuperAdmin) {
    return <Navigate to="/sites" replace />;
  }

  const effectiveRole: SiteRole = isImpersonating
    ? "OWNER"
    : (membership?.role as SiteRole) ?? "VIEWER";
  const canConfigure = effectiveRole === "OWNER" || effectiveRole === "ADMIN";
  const canSettings = effectiveRole === "OWNER";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleArchive = async () => {
    if (!site) return;
    setIsArchiving(true);
    try {
      await archiveSite(site.id);
      navigate(isSuperAdmin ? "/admin/sites" : "/sites", { replace: true });
    } catch (error) {
      setSiteError(getApiErrorMessage(error, "We couldn't archive this site."));
    } finally {
      setIsArchiving(false);
      setIsArchiveOpen(false);
    }
  };

  const displayName = user?.name ?? user?.email ?? "User";
  const userInitial = displayName[0]?.toUpperCase() ?? "?";
  const siteName = site?.name ?? membership?.siteName ?? "Site";
  const siteSlug = site?.slug ?? "";

  const base = `/s/${siteId}`;
  const sectionLabel = resolveSectionLabel(pathname, base);

  const workspaceItems: NavLeaf[] = [
    { label: "Overview", icon: LayoutDashboard, to: base, end: true },
    { label: "Content", icon: FileText, to: `${base}/content` },
    { label: "Media", icon: ImageIcon, to: `${base}/media` },
  ];

  const configureItems: NavLeaf[] = [
    { label: "Schema", icon: Shapes, to: `${base}/schema` },
    { label: "Members", icon: Users, to: `${base}/members` },
    { label: "Invitations", icon: UserPlus, to: `${base}/invitations` },
    { label: "API Keys", icon: KeyRound, to: `${base}/api-keys` },
  ];

  const insightItems: NavLeaf[] = [
    { label: "Audit log", icon: History, to: `${base}/audit-log` },
  ];

  const outletContext: SiteLayoutContextValue | null = useMemo(
    () =>
      site
        ? { site, refresh, effectiveRole, isImpersonating, isSuperAdmin }
        : null,
    [site, refresh, effectiveRole, isImpersonating, isSuperAdmin],
  );

  return (
    <div className="narah-shell-stage h-screen overflow-hidden text-foreground">
      <div className="h-screen p-3">
        <div className="narah-glass flex h-[calc(100vh-1.5rem)] overflow-hidden rounded-2xl">
          {/* Rail — universal items, forced collapsed */}
          <AppRail forceCollapsed />

          {/* Sidebar 2 — site context */}
          <aside className="hidden w-56 shrink-0 flex-col border-r border-border/40 bg-foreground/2.5 dark:bg-white/2 lg:flex">
            <div className="flex h-14 items-center gap-2.5 px-3">
              <SiteAvatar name={siteName} id={siteId} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{siteName}</p>
                <p className="truncate font-mono text-[0.6rem] lowercase text-muted-foreground">
                  {siteSlug ? `/${siteSlug}` : ""}
                  {siteSlug ? " · " : ""}
                  {isImpersonating ? "super admin" : effectiveRole.toLowerCase()}
                </p>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 pb-4">
              <SidebarSection label="Workspace">
                {workspaceItems.map((item) => (
                  <SidebarLink key={item.to} item={item} pathname={pathname} />
                ))}
              </SidebarSection>

              {canConfigure ? (
                <SidebarSection label="Configure">
                  {configureItems.map((item) => (
                    <SidebarLink key={item.to} item={item} pathname={pathname} />
                  ))}
                </SidebarSection>
              ) : null}

              {canConfigure ? (
                <SidebarSection label="Insight">
                  {insightItems.map((item) => (
                    <SidebarLink key={item.to} item={item} pathname={pathname} />
                  ))}
                  {canSettings ? (
                    <SidebarLink
                      item={{ label: "Settings", icon: Settings, to: `${base}/settings` }}
                      pathname={pathname}
                    />
                  ) : null}
                </SidebarSection>
              ) : null}
            </nav>
          </aside>

          {/* Main */}
          <div className="flex min-w-0 flex-1 flex-col">
            {isImpersonating ? (
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-5 text-xs text-amber-900 dark:text-amber-200">
                <span className="flex items-center gap-2">
                  <ShieldAlert className="size-3.5" />
                  Viewing as super admin — you are not a native member of this site.
                </span>
                <Link
                  to="/admin/sites"
                  className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                >
                  <ArrowLeft className="size-3" />
                  Back to /admin/sites
                </Link>
              </div>
            ) : null}

            <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border/40 px-5">
              {/* Breadcrumb */}
              <nav className="flex min-w-0 items-center gap-2 text-sm" aria-label="Breadcrumb">
                <Link
                  to={base}
                  className="truncate font-medium text-foreground transition-colors hover:text-muted-foreground"
                >
                  {siteName}
                </Link>
                {sectionLabel ? (
                  <>
                    <span className="text-muted-foreground/60">›</span>
                    <span className="truncate text-muted-foreground">{sectionLabel}</span>
                  </>
                ) : null}
              </nav>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {canConfigure ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setIsEditOpen(true)}
                  >
                    <Pencil className="size-3.5" />
                    Edit site
                  </Button>
                ) : null}
                {isSuperAdmin ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                    onClick={() => setIsArchiveOpen(true)}
                  >
                    <Archive className="size-3.5" />
                    Archive
                  </Button>
                ) : null}
                <span className="mx-1 h-4 w-px bg-border/60" aria-hidden />
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
                      Profile
                    </DropdownMenuItem>
                    {isSuperAdmin ? (
                      <DropdownMenuItem onClick={() => navigate("/admin")} className="gap-2 text-sm">
                        Back to /admin
                      </DropdownMenuItem>
                    ) : memberships.length > 1 ? (
                      <DropdownMenuItem onClick={() => navigate("/sites")} className="gap-2 text-sm">
                        Switch site
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={handleLogout} className="gap-2 text-sm">
                      <LogOut className="size-3.5" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
              <div className="mx-auto w-full max-w-7xl px-8 py-8">
                {siteLoading ? (
                  <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Spinner className="size-3.5" />
                    Loading site…
                  </div>
                ) : siteError && !site ? (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    {siteError}
                  </div>
                ) : outletContext ? (
                  <Outlet context={outletContext} />
                ) : null}
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Edit dialog */}
      {site ? (
        <SiteFormDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          site={site}
          onSuccess={(next) => {
            setSite(next);
            setIsEditOpen(false);
          }}
        />
      ) : null}

      {/* Archive dialog */}
      <AlertDialog open={isArchiveOpen} onOpenChange={setIsArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this site?</AlertDialogTitle>
            <AlertDialogDescription>
              {site
                ? `"${site.name}" will be archived and hidden from the default sites list.`
                : "This site will be archived."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isArchiving}
              onClick={handleArchive}
            >
              {isArchiving ? "Archiving…" : "Archive site"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function SidebarSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 first:mt-3">
      <div className="px-2.5 pb-1.5">
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarLink({ item, pathname }: { item: NavLeaf; pathname: string }) {
  const Icon = item.icon;
  const active = item.end ? pathname === item.to : pathname.startsWith(item.to);

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-foreground/5 font-medium text-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] dark:bg-white/5"
          : "text-muted-foreground hover:bg-foreground/3 hover:text-foreground dark:hover:bg-white/4",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full transition-opacity",
          active ? "narah-neon-stripe opacity-100" : "opacity-0",
        )}
      />
      <Icon className="size-4" />
      <span className="truncate">{item.label}</span>
    </NavLink>
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
