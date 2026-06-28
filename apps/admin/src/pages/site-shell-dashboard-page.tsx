import {
  ArrowUpRight,
  Clock,
  FileText,
  HardDrive,
  Image as ImageIcon,
  Layers,
  Shapes,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/features/auth/auth-provider";
import { getContentTypes } from "@/features/content-types/content-type.api";
import type { ContentTypeListItem } from "@/features/content-types/content-type.types";
import { getRecentEntries, getSite } from "@/features/sites/site.api";
import type {
  RecentEntrySummary,
  SiteDetail,
} from "@/features/sites/site.types";
import { cn } from "@/lib/utils";

export function SiteShellDashboardPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const { user, memberships } = useAuth();

  const [site, setSite] = useState<SiteDetail | null>(null);
  const [contentTypes, setContentTypes] = useState<ContentTypeListItem[]>([]);
  const [recent, setRecent] = useState<RecentEntrySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      getSite(siteId),
      getContentTypes(siteId),
      getRecentEntries(siteId, 8),
    ])
      .then(([siteRes, ctRes, recentRes]) => {
        if (cancelled) return;
        setSite(siteRes.site);
        setContentTypes(ctRes.contentTypes);
        setRecent(recentRes.entries);
      })
      .catch(() => {
        if (!cancelled) {
          setSite(null);
          setContentTypes([]);
          setRecent([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  if (!siteId) return <Navigate to="/sites" replace />;

  const membership = memberships.find((m) => m.siteId === siteId);
  const greetingName = user?.name?.split(" ")[0] ?? "there";

  if (isLoading) {
    return (
      <div className="flex min-h-60 items-center justify-center gap-2.5 text-xs text-muted-foreground">
        <Spinner className="size-3.5" />
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <header className="space-y-1.5">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
          {membership?.siteName ?? site?.name}
        </p>
        <h1 className="font-serif text-4xl tracking-tight">
          Welcome back,{" "}
          <em className="italic text-(--narah-accent)">{greetingName}</em>
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Here's what's happening in your workspace today.
        </p>
      </header>

      {/* Stat cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={FileText}
          label="Entries"
          value={String(site?.entryCount ?? 0)}
        />
        <StatCard
          icon={Shapes}
          label="Content types"
          value={String(site?.contentTypeCount ?? contentTypes.length)}
        />
        <StatCard
          icon={ImageIcon}
          label="Media assets"
          value={String(site?.mediaAssetCount ?? 0)}
          href={`/s/${siteId}/media`}
        />
        <StatCard
          icon={HardDrive}
          label="Storage"
          value={formatBytes(site?.totalMediaBytes ?? 0)}
        />
        <StatCard
          icon={Users}
          label="Members"
          value={String(site?.memberCount ?? 0)}
          href={
            membership?.role === "OWNER" || membership?.role === "ADMIN"
              ? `/s/${siteId}/members`
              : undefined
          }
        />
      </section>

      {/* Recent activity */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div className="space-y-0.5">
            <h2 className="font-serif text-2xl tracking-tight">
              Recent activity
            </h2>
            <p className="text-xs text-muted-foreground">
              Latest changes across all content types.
            </p>
          </div>
        </div>

        {recent.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-center text-sm text-muted-foreground">
            <Clock className="size-5 text-muted-foreground/60" />
            <p>No activity yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-(--narah-shadow-xs)">
            {recent.map((entry) => (
              <li key={entry.id}>
                <Link
                  to={`/s/${siteId}/content-types/${entry.contentType.id}/entries/${entry.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                >
                  <span className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    {entry.contentType.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {entry.slug ?? (
                      <span className="italic text-muted-foreground">
                        (no slug)
                      </span>
                    )}
                  </span>
                  <StatusBadge status={entry.status} />
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {entry.updatedBy.name ?? entry.updatedBy.email}
                  </span>
                  <span className="font-mono text-[0.65rem] text-muted-foreground">
                    {formatRelativeDate(entry.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Content types */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div className="space-y-0.5">
            <h2 className="font-serif text-2xl tracking-tight">Content</h2>
            <p className="text-xs text-muted-foreground">
              Pick a content type to manage its entries.
            </p>
          </div>
          {contentTypes.length > 0 ? (
            <span className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              {contentTypes.length} type
              {contentTypes.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {contentTypes.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-center text-sm text-muted-foreground">
            <Layers className="size-5 text-muted-foreground/60" />
            <p>No content types yet.</p>
            <p className="text-xs">
              Ask your super admin to set up the content model.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contentTypes.map((ct) => (
              <ContentTypeCard key={ct.id} siteId={siteId} ct={ct} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="mt-3 font-serif text-3xl tracking-tight">{value}</div>
    </>
  );

  const className = cn(
    "rounded-xl border border-border bg-card p-4 shadow-(--narah-shadow-xs)",
    href && "narah-neon-hover block transition-all hover:-translate-y-0.5",
  );

  if (href) {
    return (
      <Link to={href} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

function StatusBadge({ status }: { status: RecentEntrySummary["status"] }) {
  const map = {
    PUBLISHED:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    DRAFT:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    ARCHIVED:
      "border-zinc-400/30 bg-zinc-400/10 text-zinc-600 dark:text-zinc-400",
  } as const;
  return (
    <Badge
      variant="outline"
      className={cn("hidden font-mono text-[0.6rem] sm:inline-flex", map[status])}
    >
      {status.toLowerCase()}
    </Badge>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val < 10 && i > 0 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function ContentTypeCard({
  siteId,
  ct,
}: {
  siteId: string;
  ct: ContentTypeListItem;
}) {
  return (
    <Link
      to={`/s/${siteId}/content-types/${ct.id}/entries`}
      className="narah-neon-hover group relative flex flex-col rounded-xl border border-border bg-card p-4 shadow-(--narah-shadow-xs) transition-all hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{ct.name}</h3>
          <p className="truncate font-mono text-[0.65rem] text-muted-foreground">
            {ct.apiId}
            {ct.isSingleton ? " · singleton" : ""}
          </p>
        </div>
        <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>

      {ct.description ? (
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {ct.description}
        </p>
      ) : (
        <p className="mt-3 line-clamp-2 text-xs italic text-muted-foreground/60">
          No description.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="flex items-center gap-1 font-mono text-[0.65rem] text-muted-foreground">
          <FileText className="size-3" />
          {ct.entryCount} {ct.entryCount === 1 ? "entry" : "entries"}
        </span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">
          {ct.fieldCount} field{ct.fieldCount === 1 ? "" : "s"}
        </span>
      </div>
    </Link>
  );
}
