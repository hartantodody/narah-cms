import { Building2, LogOut, Plus, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { NarahLogo } from "@/components/app/brand";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { SiteAvatar } from "@/features/sites/site-avatar";
import { SiteFormDialog } from "@/features/sites/site-form-dialog";
import type { SiteMembershipRole } from "@/features/auth/auth.types";
import { cn } from "@/lib/utils";

export function SitePickerPage() {
  const { user, memberships, logout, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Free tier rule: limit is on OWNED sites (role === OWNER). Free users can
  // still be invited as EDITOR/ADMIN to other sites with no cap. Super admin
  // bypasses the limit entirely.
  const ownedCount = memberships.filter((m) => m.role === "OWNER").length;
  const isFreeTier = user?.tier === "FREE" && !user?.isSuperAdmin;
  const canCreateSite = !isFreeTier || ownedCount < 1;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return memberships;
    return memberships.filter(
      (m) =>
        m.siteName.toLowerCase().includes(q) ||
        m.siteSlug.toLowerCase().includes(q),
    );
  }, [memberships, search]);

  if (user?.isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  // Auto-jump if the user only has access to a single site. Skipped during
  // the create-site dialog so the redirect doesn't fight the dialog state.
  if (memberships.length === 1 && !isCreateOpen) {
    return <Navigate to={`/s/${memberships[0].siteId}`} replace />;
  }

  const greetingName = user?.name?.split(" ")[0] ?? "there";
  const showSearch = memberships.length > 4;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-2.5">
          <NarahLogo className="size-7 rounded-md" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tracking-tight">Narah</span>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
              cms
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
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

      {/* Body */}
      <main className="flex flex-1 items-start justify-center px-6 py-12">
        <div className="w-full max-w-2xl space-y-8">
          {/* Greeting */}
          <header className="space-y-1.5">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
              workspace picker
            </p>
            <h1 className="font-serif text-4xl tracking-tight">
              Hi{" "}
              <em className="italic text-(--narah-accent)">{greetingName}</em>,
              {memberships.length === 0 ? " let's start" : " pick a site"}
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              {memberships.length === 0
                ? "You don't have any sites yet. Create your first one to get going."
                : `You have access to ${memberships.length} sites. Choose one to enter — you can switch later from the workspace menu.`}
            </p>
            <TierBanner
              tier={user?.tier ?? "FREE"}
              ownedCount={ownedCount}
              isFreeTier={isFreeTier}
            />
          </header>

          {/* Create site action — always rendered when there are existing
              sites. The empty state has its own primary CTA below. */}
          {memberships.length > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {isFreeTier
                  ? canCreateSite
                    ? "Free tier — you can create 1 site."
                    : "Free tier limit reached (1 site)."
                  : null}
              </p>
              <Button
                type="button"
                size="sm"
                disabled={!canCreateSite}
                onClick={() => setIsCreateOpen(true)}
                className="gap-1.5"
              >
                <Plus className="size-3.5" />
                Create site
              </Button>
            </div>
          ) : null}

          {memberships.length === 0 ? (
            <EmptyState
              canCreate={canCreateSite}
              onCreate={() => setIsCreateOpen(true)}
            />
          ) : (
            <>
              {showSearch ? (
                <div className="relative w-full sm:max-w-sm">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search sites…"
                    className="h-9 pl-9 text-sm"
                  />
                </div>
              ) : null}

              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  No sites match &ldquo;{search}&rdquo;.
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {filtered.map((m) => (
                    <li key={m.siteId}>
                      <button
                        type="button"
                        onClick={() => navigate(`/s/${m.siteId}`)}
                        className="narah-neon-hover group relative flex w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-(--narah-shadow-xs) transition-all hover:-translate-y-0.5"
                      >
                        <div className="flex items-start gap-3">
                          <SiteAvatar
                            name={m.siteName}
                            id={m.siteId}
                            size={42}
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-semibold">
                              {m.siteName}
                            </h3>
                            <p className="truncate font-mono text-[0.7rem] text-muted-foreground">
                              {m.siteSlug}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-border pt-3">
                          <RoleBadge role={m.role} />
                          <span className="font-mono text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                            enter →
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Need access to another site? Ask the owner for an invitation.
          </p>
        </div>
      </main>

      <SiteFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={async (site) => {
          await refreshMe();
          setIsCreateOpen(false);
          navigate(`/s/${site.id}`, { replace: true });
        }}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function EmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-xl border border-border bg-muted">
        <Building2 className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold">No sites yet</h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Create your first site to start modeling content. You'll be its
          owner.
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={!canCreate}
        onClick={onCreate}
        className="gap-1.5"
      >
        <Plus className="size-3.5" />
        Create your first site
      </Button>
      <p className="text-xs text-muted-foreground">
        Or wait for an invitation from a site owner to join an existing site.
      </p>
    </div>
  );
}

function TierBanner({
  tier,
  ownedCount,
  isFreeTier,
}: {
  tier: "FREE" | "PRO";
  ownedCount: number;
  isFreeTier: boolean;
}) {
  if (!isFreeTier) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-violet-700 dark:text-violet-300">
        <Sparkles className="size-3" />
        {tier === "PRO" ? "pro tier" : "unlimited"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-foreground/5 px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground dark:bg-white/5">
      free tier · {ownedCount}/1 sites owned
    </span>
  );
}

function RoleBadge({ role }: { role: SiteMembershipRole }) {
  const styles: Record<SiteMembershipRole, string> = {
    OWNER:
      "border-(--narah-accent)/30 bg-(--narah-accent)/10 text-(--narah-accent)",
    ADMIN:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    EDITOR:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    VIEWER:
      "border-zinc-400/30 bg-zinc-400/10 text-zinc-600 dark:text-zinc-400",
  };
  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-[0.6rem] uppercase", styles[role])}
    >
      {role.toLowerCase()}
    </Badge>
  );
}

