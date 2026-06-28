import {
  ArrowRight,
  BadgeCheck,
  Files,
  Image as ImageIcon,
  Layers3,
  Shapes,
  Shield,
  Users,
} from "lucide-react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AnalyticsOverviewWidget } from "@/features/analytics/analytics-overview-widget";
import { useSiteContext } from "@/layouts/site-layout-context";
import {
  formatSiteDate,
  formatSiteStatus,
  getSiteStatusBadgeClassName,
  getSiteStatusBadgeVariant,
} from "@/features/sites/site.utils";

/**
 * Overview page for a site — landing page at `/s/:siteId`.
 * Shows the site hero (name + description + status + role) and a stat
 * dashboard. Everything else (members, schema, etc.) lives in its own
 * route under the sidebar.
 */
const LEGACY_TAB_MAP: Record<string, string> = {
  members: "/members",
  invitations: "/invitations",
  "content-types": "/schema",
  "api-keys": "/api-keys",
};

export function SiteDetailPage() {
  const { site } = useSiteContext();
  const [searchParams] = useSearchParams();
  const base = `/s/${site.id}`;

  // Back-compat: old links used ?tab=members etc. on the overview URL.
  // Redirect those into the proper sub-route.
  const legacyTab = searchParams.get("tab");
  if (legacyTab && LEGACY_TAB_MAP[legacyTab]) {
    return <Navigate to={`${base}${LEGACY_TAB_MAP[legacyTab]}`} replace />;
  }

  const stats = [
    { title: "Members", value: site.memberCount, icon: Users, href: `${base}/members` },
    { title: "Content Types", value: site.contentTypeCount, icon: Layers3, href: `${base}/schema` },
    { title: "Entries", value: site.entryCount, icon: BadgeCheck, href: `${base}/content` },
    { title: "Media Assets", value: site.mediaAssetCount, icon: Shield, href: `${base}/media` },
  ];

  const quickLinks = [
    {
      title: "Schema",
      description: "Define content types, fields, and relations for this site.",
      icon: Shapes,
      href: `${base}/schema`,
    },
    {
      title: "Content",
      description: "Edit entries grouped by content type.",
      icon: Files,
      href: `${base}/content`,
    },
    {
      title: "Media",
      description: "Upload and organize images and other assets.",
      icon: ImageIcon,
      href: `${base}/media`,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={getSiteStatusBadgeVariant(site.status)}
            className={getSiteStatusBadgeClassName(site.status)}
          >
            {formatSiteStatus(site.status)}
          </Badge>
          {site.currentUserRole ? (
            <Badge
              variant="outline"
              className="border-border bg-foreground/5 text-foreground dark:bg-white/5"
            >
              {site.currentUserRole}
            </Badge>
          ) : null}
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{site.name}</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {site.description || "No description has been added yet."}
          </p>
          <div className="flex flex-wrap gap-4 font-mono text-[0.7rem] text-muted-foreground">
            <span>/{site.slug}</span>
            <span>Updated {formatSiteDate(site.updatedAt)}</span>
          </div>
        </div>
      </header>

      {/* Stat cards */}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.title} to={s.href} className="group">
            <Card className="narah-glass-panel rounded-xl py-0 transition-colors group-hover:border-foreground/20 dark:group-hover:border-white/20">
              <CardContent className="flex items-center gap-4 px-5 py-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-foreground/8 text-foreground dark:bg-white/8">
                  <s.icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{s.title}</p>
                  <p className="text-2xl font-semibold leading-tight">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      {/* Quick links */}
      <section className="rounded-2xl border border-(--narah-accent)/20 bg-linear-to-br from-(--narah-accent)/8 via-card to-card p-5 shadow-(--narah-shadow-xs)">
        <div className="mb-3 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-(--narah-accent)" />
          <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-(--narah-accent)">
            Continue working
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {quickLinks.map((l) => (
            <Link
              key={l.title}
              to={l.href}
              className="group rounded-xl border border-border/60 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-(--narah-accent)/40 hover:shadow-(--narah-shadow-sm)"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--narah-accent)/10 text-(--narah-accent) transition-colors group-hover:bg-(--narah-accent)/20">
                  <l.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{l.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{l.description}</p>
                </div>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-(--narah-accent)" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Visitor analytics — empty CTA if not connected, otherwise widget */}
      <AnalyticsOverviewWidget
        siteId={site.id}
        settingsHref={`${base}/settings#analytics`}
      />
    </div>
  );
}
