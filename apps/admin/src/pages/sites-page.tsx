import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  ChevronDown,
  History,
  Image as ImageIcon,
  KeyRound,
  LayoutGrid,
  Plus,
  Search,
  Settings,
  Shapes,
  Users,
} from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { colorFromId, SiteAvatar } from "@/features/sites/site-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { SiteFormDialog } from "@/features/sites/site-form-dialog";
import { getSites } from "@/features/sites/site.api";
import type { SiteListItem } from "@/features/sites/site.types";
import { formatSiteDate, formatSiteStatus } from "@/features/sites/site.utils";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-provider";
import {
  getApiErrorMessage,
  isPolicyAcceptanceRequiredError,
} from "@/lib/api";

export function SitesPage() {
  const { user } = useAuth();
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadSitesList() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getSites({ search: deferredSearch });
        if (!isActive) return;
        setSites(response.sites);
      } catch (error) {
        if (!isActive) return;
        if (isPolicyAcceptanceRequiredError(error)) return;
        setErrorMessage(
          getApiErrorMessage(error, "We couldn't load your sites right now."),
        );
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadSitesList();
    return () => {
      isActive = false;
    };
  }, [deferredSearch]);

  const refreshSites = async () => {
    const response = await getSites({ search: deferredSearch });
    setSites(response.sites);
  };

  const handleSiteCreated = async () => {
    await refreshSites();
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
              multi-site workspace
            </p>
            <h1 className="font-serif text-4xl tracking-tight">
              <em className="italic text-(--narah-accent)">Sites</em>
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Each site is an isolated workspace — its own schema, content, and
              API keys.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sites…"
                className="h-9 pl-9 text-sm"
              />
            </div>
            {user?.isSuperAdmin ? (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="size-4" />
                New site
              </Button>
            ) : null}
          </div>
        </header>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Unable to load sites</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {/* Body */}
        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2.5 text-xs text-muted-foreground">
            <Spinner className="size-3.5" />
            Loading sites…
          </div>
        ) : sites.length === 0 ? (
          <EmptyState
            onCreate={user?.isSuperAdmin ? () => setIsCreateDialogOpen(true) : undefined}
          />
        ) : (
          <MasonryGrid
            sites={sites}
            isSuperAdmin={Boolean(user?.isSuperAdmin)}
          />
        )}
      </div>

      <SiteFormDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleSiteCreated}
      />
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────── */
/* Masonry grid — JS-driven so an expanding card only pushes the */
/* cards in its own column. Items are distributed round-robin so */
/* the visual reading order stays close to row-by-row.           */
/* ────────────────────────────────────────────────────────────── */

function useColumnCount(): number {
  const compute = () => {
    if (typeof window === "undefined") return 4;
    const w = window.innerWidth;
    if (w >= 1280) return 4; // xl
    if (w >= 1024) return 3; // lg
    if (w >= 640) return 2; // sm
    return 1;
  };

  const [cols, setCols] = useState(compute);

  useEffect(() => {
    const update = () => setCols(compute());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return cols;
}

function MasonryGrid({
  sites,
  isSuperAdmin,
}: {
  sites: SiteListItem[];
  isSuperAdmin: boolean;
}) {
  const cols = useColumnCount();

  // Round-robin distribute: item i goes to column (i % cols).
  const columns: SiteListItem[][] = Array.from({ length: cols }, () => []);
  sites.forEach((site, i) => {
    columns[i % cols].push(site);
  });

  return (
    <div className="flex w-full items-start gap-4">
      {columns.map((column, i) => (
        // min-w-0 + flex-1 + basis-0 forces equal-width columns regardless of
        // intrinsic content size (e.g. very long site names), preventing
        // horizontal overflow and per-row width drift.
        <div key={i} className="flex min-w-0 flex-1 basis-0 flex-col gap-4">
          {column.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              isSuperAdmin={isSuperAdmin}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SiteCard({
  site,
  isSuperAdmin,
}: {
  site: SiteListItem;
  isSuperAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const base = `/s/${site.id}`;
  const { hue } = colorFromId(site.id);
  const accentColor = `hsl(${hue} 70% 55%)`;
  const isArchived = site.status === "ARCHIVED";

  return (
    <div
      className={cn(
        "narah-glass relative isolate flex flex-col overflow-hidden rounded-2xl",
        "transition-transform duration-200 hover:-translate-y-0.5",
        isArchived && "opacity-70",
      )}
    >
      {/* Primary content (always visible) */}
      <div className="flex flex-col p-5">
        {/* Top row: avatar + identity, action buttons right */}
        <div className="flex items-start gap-3">
          <SiteAvatar name={site.name} id={site.id} size={40} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold tracking-tight">
              {site.name}
            </h3>
            <p className="truncate font-mono text-[0.7rem] text-muted-foreground">
              /{site.slug}
            </p>
          </div>
          <Link
            to={base}
            aria-label="Open site"
            title="Open site"
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/5"
          >
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* Status row with subtle accent dot */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{
                background: isArchived ? "currentColor" : accentColor,
              }}
            />
            <span className={isArchived ? "text-muted-foreground" : "text-foreground"}>
              {formatSiteStatus(site.status)}
            </span>
          </span>
        </div>

        {/* Description — min-h matches 2× line-height (text-sm 14px +
            leading-6 24px → 48px) so short/missing descriptions still
            reserve two lines of vertical space. Keeps cards in the same
            column at consistent heights. */}
        <p
          className={cn(
            "mt-3 min-h-12 text-sm leading-6",
            site.description
              ? "line-clamp-2 text-muted-foreground"
              : "italic text-muted-foreground/60",
          )}
        >
          {site.description ?? "No description."}
        </p>

        {/* Meta line */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" />
            {site.memberCount} {site.memberCount === 1 ? "member" : "members"}
          </span>
          <span aria-hidden>·</span>
          <span>Updated {formatSiteDate(site.updatedAt)}</span>
        </div>
      </div>

      {/* Full-width expand bar — sits at the bottom of the card. Border-top
          serves as the divider between primary content and the (optional)
          detail panel below. */}
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        aria-expanded={expanded}
        className={cn(
          "flex w-full items-center justify-center gap-1.5 border-t border-border/40 py-2.5",
          "font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground transition-colors",
          "hover:bg-foreground/3 hover:text-foreground dark:hover:bg-white/3",
        )}
      >
        <span>{expanded ? "Hide details" : "Show details"}</span>
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform duration-200 ease-out",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* Expandable detail panel — pure CSS height animation via the
          grid-template-rows: 0fr → 1fr trick. No JS layout work, no grid
          reflow, no motion.layout fighting CSS transitions. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        aria-hidden={!expanded}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "border-t border-border/40 bg-foreground/2 p-5 transition-opacity duration-200 dark:bg-white/2",
              expanded ? "opacity-100" : "opacity-0",
            )}
          >
            <SiteDetail
              site={site}
              base={base}
              isSuperAdmin={isSuperAdmin}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Detail panel — quick stats + jump links into the site         */
/* ────────────────────────────────────────────────────────────── */

function SiteDetail({
  site,
  base,
  isSuperAdmin,
}: {
  site: SiteListItem;
  base: string;
  isSuperAdmin: boolean;
}) {
  const quickLinks = [
    { label: "Overview", icon: LayoutGrid, to: base },
    { label: "Content", icon: Shapes, to: `${base}/content` },
    { label: "Media", icon: ImageIcon, to: `${base}/media` },
    { label: "Members", icon: Users, to: `${base}/members` },
    { label: "API Keys", icon: KeyRound, to: `${base}/api-keys` },
    { label: "Audit log", icon: History, to: `${base}/audit-log` },
  ];
  // Settings (edit + archive) lives inside the site itself — surface it
  // here so super admins know where to go after the card stopped carrying
  // those actions directly.
  if (isSuperAdmin) {
    quickLinks.push({ label: "Settings", icon: Settings, to: `${base}/settings` });
  }

  return (
    <div className="space-y-4">
      <DetailSection title="Identity">
        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="truncate font-mono">/{site.slug}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Status</dt>
            <dd>{formatSiteStatus(site.status)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Members</dt>
            <dd>{site.memberCount}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Updated</dt>
            <dd>{formatSiteDate(site.updatedAt)}</dd>
          </div>
        </dl>
      </DetailSection>

      <DetailSection title="Jump to">
        <div className="grid grid-cols-2 gap-1.5">
          {quickLinks.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="group flex items-center gap-2 rounded-md border border-(--narah-accent)/25 bg-(--narah-accent)/8 px-2.5 py-1.5 text-xs font-medium text-foreground transition-all hover:-translate-y-px hover:border-(--narah-accent)/50 hover:bg-(--narah-accent)/15 hover:text-(--narah-accent)"
            >
              <l.icon className="size-3.5 text-(--narah-accent)" />
              <span className="truncate">{l.label}</span>
            </Link>
          ))}
        </div>
      </DetailSection>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center">
      <div className="grid size-12 place-items-center rounded-xl border border-border bg-muted">
        <Building2 className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">No sites yet</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Create your first site to start modeling content and inviting members.
        </p>
      </div>
      {onCreate ? (
        <Button size="sm" onClick={onCreate} className="mt-1">
          <Plus className="size-4" />
          Create site
        </Button>
      ) : null}
    </div>
  );
}
