import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Circle,
  Files,
  Image as ImageIcon,
  Shapes,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/features/auth/auth-provider";
import { getSite, getSites } from "@/features/sites/site.api";
import { cn } from "@/lib/utils";

type ModuleStatus = "available" | "soon";

type ModuleKey = "sites" | "contentTypes" | "entries" | "media";

/** Accent uses one of the twilight palette anchors (rgb triplets). */
type Accent = "indigo" | "violet" | "magenta" | "rose";

type ModuleCard = {
  key: ModuleKey;
  title: string;
  description: string;
  icon: typeof Building2;
  status: ModuleStatus;
  href: string;
  cta: string;
  accent: Accent;
};

const modules: ModuleCard[] = [
  {
    key: "sites",
    title: "Sites",
    description: "Provision sites, manage members, send invitations.",
    icon: Building2,
    status: "available",
    href: "/admin/sites",
    cta: "Open sites",
    accent: "indigo",
  },
  {
    key: "contentTypes",
    title: "Content Types",
    description: "Model reusable schemas and fields per site.",
    icon: Shapes,
    status: "available",
    href: "/admin/sites",
    cta: "Choose a site",
    accent: "violet",
  },
  {
    key: "entries",
    title: "Entries",
    description: "Author, draft, and publish structured content.",
    icon: Files,
    status: "available",
    href: "/admin/sites",
    cta: "Choose a site",
    accent: "magenta",
  },
  {
    key: "media",
    title: "Media",
    description: "Upload, organize, and attach images to entries.",
    icon: ImageIcon,
    status: "available",
    href: "/admin/sites",
    cta: "Choose a site",
    accent: "rose",
  },
];

const ACCENT_VAR: Record<Accent, string> = {
  rose: "var(--narah-twilight-1)",
  magenta: "var(--narah-twilight-2)",
  violet: "var(--narah-twilight-3)",
  indigo: "var(--narah-twilight-4)",
};

const phases = [
  { label: "Foundation", status: "done" as const },
  { label: "Auth & sites", status: "done" as const },
  { label: "Schema builder", status: "done" as const },
  { label: "Entries CRUD", status: "done" as const },
  { label: "Rich text editor", status: "done" as const },
  { label: "Media library", status: "done" as const },
  { label: "Public delivery API + API keys", status: "done" as const },
  { label: "Audit log + per-key CORS allowlist", status: "done" as const },
  { label: "Polish (RELATION picker, populate, API explorer, preview tokens)", status: "done" as const },
  { label: "LSPMICE web integration (replace hardcoded data with /public/v1)", status: "next" as const },
  { label: "Visitor analytics (GA4)", status: "planned" as const },
];

type PlatformStats = Record<ModuleKey, number>;

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = (user?.name ?? user?.email ?? "").split(/[\s@]/)[0];

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const sitesResp = await getSites({});
        const details = await Promise.all(
          sitesResp.sites.map((s) =>
            getSite(s.id)
              .then((r) => r.site)
              .catch(() => null),
          ),
        );
        if (cancelled) return;

        const totals = details.reduce<PlatformStats>(
          (acc, d) => {
            if (!d) return acc;
            acc.contentTypes += d.contentTypeCount;
            acc.entries += d.entryCount;
            acc.media += d.mediaAssetCount;
            return acc;
          },
          {
            sites: sitesResp.sites.length,
            contentTypes: 0,
            entries: 0,
            media: 0,
          },
        );
        setStats(totals);
      } catch {
        if (!cancelled) setStatsError(true);
      }
    }

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
            overview
          </p>
          <h1 className="font-serif text-4xl tracking-tight">
            Welcome back
            {firstName ? (
              <>
                ,{" "}
                <em className="italic text-(--narah-accent)">
                  {firstName}
                </em>
              </>
            ) : null}
            .
          </h1>
          <p className="text-sm text-muted-foreground">
            Schema-driven, multi-site headless content. Pick up where the story left off.
          </p>
        </div>
      </header>

      {/* Modules grid — each card carries its platform-wide total */}
      <section className="space-y-3">
        <SectionLabel
          title="Modules"
          hint="Workspace surfaces you can open right now."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m) => (
            <ModuleTile
              key={m.title}
              module={m}
              count={stats?.[m.key]}
              loading={stats === null && !statsError}
            />
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="space-y-3">
        <SectionLabel
          title="Roadmap"
          hint="Phased delivery — what's done, what's next."
        />
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-(--narah-shadow-xs)">
          <ul className="divide-y divide-border">
            {phases.map((phase) => (
              <li
                key={phase.label}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  {phase.status === "done" ? (
                    <CheckCircle2 className="size-4 text-emerald-500" />
                  ) : phase.status === "next" ? (
                    <Circle className="size-4 fill-primary/15 text-primary" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground/40" />
                  )}
                  <span className="text-sm">{phase.label}</span>
                </div>
                <span
                  className={cn(
                    "font-mono text-[0.65rem] uppercase tracking-[0.18em]",
                    phase.status === "done"
                      ? "text-emerald-500"
                      : phase.status === "next"
                        ? "text-primary"
                        : "text-muted-foreground/60",
                  )}
                >
                  {phase.status === "done"
                    ? "shipped"
                    : phase.status === "next"
                      ? "in progress"
                      : "planned"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const SectionLabel = ({
  title,
  hint,
}: {
  title: string;
  hint: string;
}) => (
  <div className="flex items-end justify-between">
    <div className="space-y-0.5">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  </div>
);

const ModuleTile = ({
  module,
  count,
  loading,
}: {
  module: ModuleCard;
  count: number | undefined;
  loading: boolean;
}) => {
  const Icon = module.icon;
  const isAvailable = module.status === "available";
  const accent = ACCENT_VAR[module.accent];

  const inner = (
    <div
      className={cn(
        "narah-glass group relative flex h-full min-h-56 flex-col overflow-hidden rounded-2xl p-5 transition-all",
        isAvailable
          ? "hover:-translate-y-0.5 hover:shadow-(--narah-shadow-md)"
          : "opacity-75",
      )}
      style={
        {
          "--accent": `rgb(${accent})`,
          "--accent-soft": `rgba(${accent}, 0.12)`,
        } as React.CSSProperties
      }
    >
      {/* Decorative blob — bottom-right, subtle, in accent */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -right-12 size-32 rounded-full opacity-50 blur-2xl"
        style={{ background: `rgba(${accent}, 0.25)` }}
      />

      {/* Top row: icon left, soon badge right (if applicable) */}
      <div className="relative flex items-start justify-between">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl text-foreground"
          style={{ background: `var(--accent-soft)`, color: `var(--accent)` }}
        >
          <Icon className="size-5" />
        </span>
        {!isAvailable ? (
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
            soon
          </span>
        ) : null}
      </div>

      {/* Big number — the visual hero */}
      <div className="relative mt-6">
        {loading ? (
          <div className="flex h-12 items-center text-muted-foreground/60">
            <Spinner className="size-3.5" />
          </div>
        ) : count !== undefined ? (
          <p
            className="text-5xl font-semibold leading-none tracking-tight tabular-nums"
            style={{ color: `var(--accent)` }}
          >
            {count.toLocaleString()}
          </p>
        ) : (
          <p className="text-5xl font-semibold leading-none text-muted-foreground/40 tabular-nums">
            —
          </p>
        )}
      </div>

      {/* Title + description */}
      <div className="relative mt-3 space-y-1">
        <h3 className="text-base font-semibold tracking-tight">{module.title}</h3>
        <p className="text-xs leading-5 text-muted-foreground">
          {module.description}
        </p>
      </div>

      {/* Bottom-left CTA link */}
      {isAvailable ? (
        <div className="relative mt-auto pt-4">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium transition-colors",
            )}
            style={{ color: `var(--accent)` }}
          >
            {module.cta}
            <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      ) : null}
    </div>
  );

  return isAvailable ? (
    <Link
      to={module.href}
      className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
};
