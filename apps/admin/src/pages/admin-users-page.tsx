import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { listUsers, updateUser } from "@/features/users/user.api";
import type {
  UserListItem,
  UserStatus,
  UserTier,
} from "@/features/users/user.types";
import { useAuth } from "@/features/auth/auth-provider";
import { getApiErrorMessage } from "@/lib/api";
import type { PaginatedData } from "@/lib/api";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type StatusFilter = UserStatus | "ALL";

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageData, setPageData] = useState<PaginatedData<UserListItem> | null>(
    null,
  );
  const [tierBusyId, setTierBusyId] = useState<string | null>(null);

  const handleToggleTier = async (user: UserListItem) => {
    if (user.isSuperAdmin) return; // super admin is uncapped regardless of tier
    setTierBusyId(user.id);
    try {
      const nextTier: UserTier = user.tier === "PRO" ? "FREE" : "PRO";
      const response = await updateUser(user.id, { tier: nextTier });
      setPageData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((u) =>
                u.id === user.id ? { ...u, tier: response.user.tier } : u,
              ),
            }
          : prev,
      );
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Couldn't update user tier."));
    } finally {
      setTierBusyId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    listUsers({
      page,
      pageSize: PAGE_SIZE,
      search: deferredSearch || undefined,
      status: statusFilter === "ALL" ? undefined : statusFilter,
    })
      .then((data) => {
        if (!cancelled) setPageData(data);
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(getApiErrorMessage(error, "Couldn't load users."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, deferredSearch, statusFilter]);

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [deferredSearch, statusFilter]);

  const items = pageData?.items ?? [];
  const total = pageData?.total ?? 0;
  const pageCount = pageData?.pageCount ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          platform / users
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every authenticated account on the platform. Filter by status, search
          by name or email.
        </p>
      </header>

      {/* Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="h-9 pl-9 text-sm"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="h-9 w-full text-sm sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="DISABLED">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground sm:ml-auto">
          {total.toLocaleString()} {total === 1 ? "user" : "users"}
        </div>
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Unable to load users</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-foreground/2 text-left dark:bg-white/2">
              <th className="px-4 py-3 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                User
              </th>
              <th className="px-4 py-3 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                Tier
              </th>
              <th className="px-4 py-3 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                Sites
              </th>
              <th className="px-4 py-3 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                Last login
              </th>
              <th className="px-4 py-3 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                Joined
              </th>
              <th className="px-4 py-3 text-right font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Spinner className="size-3.5" />
                    Loading users…
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-xs text-muted-foreground"
                >
                  No users match the current filter.
                </td>
              </tr>
            ) : (
              items.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isSelf={u.id === currentUser?.id}
                  busy={tierBusyId === u.id}
                  onToggleTier={() => handleToggleTier(u)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={loading || page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function UserRow({
  user,
  isSelf,
  busy,
  onToggleTier,
}: {
  user: UserListItem;
  isSelf: boolean;
  busy: boolean;
  onToggleTier: () => void;
}) {
  const initial = user.name[0]?.toUpperCase() ?? "?";
  // Super admins are uncapped — toggling tier is a no-op for them, so hide
  // the action button entirely. Same for the actor themselves (avoid foot-guns).
  const canToggleTier = !user.isSuperAdmin && !isSelf;

  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-foreground/2 dark:hover:bg-white/2">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground/10 text-xs font-semibold text-foreground dark:bg-white/10">
            {initial}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium">{user.name}</p>
              {user.isSuperAdmin ? (
                <span
                  title="Super admin"
                  className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-300"
                >
                  <ShieldCheck className="size-3" />
                  super
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={user.status} />
      </td>
      <td className="px-4 py-3">
        <TierBadge tier={user.tier} isSuperAdmin={user.isSuperAdmin} />
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
        {user.siteCount}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {user.lastLoginAt ? formatRelative(user.lastLoginAt) : "Never"}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {formatAbsolute(user.createdAt)}
      </td>
      <td className="px-4 py-3 text-right">
        {canToggleTier ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onToggleTier}
            className="h-7 gap-1 text-xs"
          >
            {busy ? (
              <Spinner className="size-3" />
            ) : user.tier === "PRO" ? (
              <ArrowDown className="size-3" />
            ) : (
              <ArrowUp className="size-3" />
            )}
            {user.tier === "PRO" ? "Downgrade" : "Upgrade"}
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

function TierBadge({
  tier,
  isSuperAdmin,
}: {
  tier: UserTier;
  isSuperAdmin: boolean;
}) {
  if (isSuperAdmin) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-300">
        unlimited
      </span>
    );
  }
  if (tier === "PRO") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/15 px-1.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-wider text-violet-600 dark:text-violet-300">
        <Sparkles className="size-3" />
        pro
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-foreground/8 px-1.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-wider text-muted-foreground dark:bg-white/8">
      free
    </span>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const styles: Record<UserStatus, string> = {
    ACTIVE:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
    PENDING:
      "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
    DISABLED: "bg-foreground/8 text-muted-foreground border-border dark:bg-white/8",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[0.6rem] font-medium uppercase tracking-wider",
        styles[status],
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "Today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
