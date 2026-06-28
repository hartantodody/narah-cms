import { BarChart3, ExternalLink, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Spinner } from "@/components/ui/spinner";
import {
  getAnalyticsConfig,
  getAnalyticsOverview,
} from "@/features/analytics/analytics.api";
import type {
  AnalyticsConfigResponse,
  AnalyticsDailyPoint,
  AnalyticsOverview,
} from "@/features/analytics/analytics.types";
import { getApiErrorMessage } from "@/lib/api";

type Props = {
  siteId: string;
  // Path to the site settings analytics tab so the empty-state CTA can deep-link.
  settingsHref: string;
};

export function AnalyticsOverviewWidget({ siteId, settingsHref }: Props) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AnalyticsConfigResponse | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const { config: cfg } = await getAnalyticsConfig(siteId);
        if (!active) return;
        setConfig(cfg);
        if (cfg.connected) {
          const data = await getAnalyticsOverview(siteId);
          if (!active) return;
          setOverview(data);
        }
      } catch (err) {
        if (!active) return;
        setError(getApiErrorMessage(err, t("analytics.errorLoad")));
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [siteId, t]);

  if (isLoading) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 shadow-(--narah-shadow-xs)">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner className="size-3.5" />
          {t("analytics.loading")}
        </div>
      </section>
    );
  }

  // Not connected → CTA card
  if (!config || !config.connected) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card p-6 shadow-(--narah-shadow-xs)">
        <div className="flex items-start gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-foreground/5 text-foreground dark:bg-white/5">
            <BarChart3 className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {t("analytics.notConnectedTitle")}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("analytics.notConnectedDescription")}
            </p>
            <Link
              to={settingsHref}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("analytics.connectCta")}
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (error || !overview) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 shadow-(--narah-shadow-xs)">
        <p className="text-xs text-destructive">{error ?? t("analytics.errorLoad")}</p>
        <Link
          to={settingsHref}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("analytics.reviewConfig")}
          <ExternalLink className="size-3" />
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">
            {t("analytics.title")}
            <span className="ml-2 font-mono text-[0.65rem] text-muted-foreground">
              {t("analytics.range", { days: overview.range.days })}
            </span>
          </h2>
        </div>
        <Link
          to={settingsHref}
          className="text-[0.65rem] text-muted-foreground hover:text-foreground"
        >
          {t("analytics.manage")}
        </Link>
      </div>

      {/* Trend chart */}
      <TrendChart series={overview.dailySeries} />

      {/* Summary cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Users className="size-4" />}
          label={t("analytics.metrics.users")}
          value={overview.summary.activeUsers.toLocaleString()}
        />
        <SummaryCard
          icon={<TrendingUp className="size-4" />}
          label={t("analytics.metrics.pageViews")}
          value={overview.summary.pageViews.toLocaleString()}
        />
        <SummaryCard
          icon={<BarChart3 className="size-4" />}
          label={t("analytics.metrics.sessions")}
          value={overview.summary.sessions.toLocaleString()}
        />
        <SummaryCard
          icon={<TrendingUp className="size-4" />}
          label={t("analytics.metrics.bounceRate")}
          value={`${(overview.summary.bounceRate * 100).toFixed(1)}%`}
        />
      </div>

      {/* Top pages + Sources */}
      <div className="grid gap-3 md:grid-cols-2">
        <BreakdownCard
          title={t("analytics.topPages")}
          rows={overview.topPages}
          emptyLabel={t("analytics.noData")}
        />
        <BreakdownCard
          title={t("analytics.trafficSources")}
          rows={overview.sources}
          emptyLabel={t("analytics.noData")}
        />
      </div>
    </section>
  );
}

function TrendChart({ series }: { series: AnalyticsDailyPoint[] }) {
  const { t } = useTranslation();
  // Empty / single-point series can't make a meaningful chart.
  if (series.length < 2) {
    return null;
  }

  const totalUsers = series.reduce((sum, d) => sum + d.users, 0);
  const totalPageViews = series.reduce((sum, d) => sum + d.pageViews, 0);

  const chartConfig = {
    users: {
      label: t("analytics.metrics.users"),
      color: "var(--narah-accent)",
    },
    pageViews: {
      label: t("analytics.metrics.pageViews"),
      color: "var(--narah-primary-soft)",
    },
  } satisfies ChartConfig;

  // Short labels for the X axis — "Jun 17" style.
  const data = series.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-(--narah-shadow-xs)">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium">{t("analytics.trendTitle")}</p>
          <p className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
            {t("analytics.trendSubtitle", {
              users: totalUsers.toLocaleString(),
              views: totalPageViews.toLocaleString(),
            })}
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-[0.6rem] text-muted-foreground">
          <span>{series[0]?.date}</span>
          <span>→</span>
          <span>{series[series.length - 1]?.date}</span>
        </div>
      </div>
      <ChartContainer config={chartConfig} className="h-48 w-full">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="narah-fill-users" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-users)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-users)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="narah-fill-views" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-pageViews)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--color-pageViews)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            className="text-[0.65rem]"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            width={28}
            className="text-[0.65rem]"
            allowDecimals={false}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
            content={<ChartTooltipContent indicator="line" />}
          />
          <Area
            type="monotone"
            dataKey="pageViews"
            stroke="var(--color-pageViews)"
            strokeWidth={1.5}
            fill="url(#narah-fill-views)"
            stackId="1"
          />
          <Area
            type="monotone"
            dataKey="users"
            stroke="var(--color-users)"
            strokeWidth={1.8}
            fill="url(#narah-fill-users)"
            stackId="2"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-(--narah-shadow-xs)">
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-foreground/5 text-foreground dark:bg-white/5">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold leading-tight">{value}</p>
        </div>
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: { label: string; value: number }[];
  emptyLabel: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-(--narah-shadow-xs)">
      <p className="mb-3 text-xs font-medium">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const pct = Math.max(2, (row.value / max) * 100);
            return (
              <li key={row.label} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-mono text-muted-foreground">
                    {row.label}
                  </span>
                  <span className="font-medium tabular-nums">
                    {row.value.toLocaleString()}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-border/60">
                  <div
                    className="h-full bg-(--narah-accent)/80"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
