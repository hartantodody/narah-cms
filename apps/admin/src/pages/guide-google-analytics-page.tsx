import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Copy,
  ExternalLink,
  Info,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Long-form setup guide for connecting Google Analytics 4 to a site.
 * Lives at /s/:siteId/guides/google-analytics so editors can deep-link to
 * it and the in-settings widget can link out for the full walkthrough.
 */
export function GuideGoogleAnalyticsPage() {
  const { t } = useTranslation();
  const { siteId } = useParams<{ siteId: string }>();
  const settingsHref = `/s/${siteId}/settings#analytics`;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      {/* Header */}
      <div className="space-y-3">
        <Link
          to={settingsHref}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t("guides.ga.backToSettings")}
        </Link>
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-foreground/5 text-foreground dark:bg-white/5">
            <BarChart3 className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
              {t("guides.ga.breadcrumb")}
            </p>
            <h1 className="mt-0.5 font-serif text-3xl tracking-tight">
              {t("guides.ga.title")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("guides.ga.lead")}
            </p>
          </div>
        </div>
      </div>

      {/* Prereqs */}
      <Alert>
        <Info className="size-4" />
        <AlertTitle>{t("guides.ga.prereqTitle")}</AlertTitle>
        <AlertDescription>
          <ul className="ml-4 list-disc space-y-1 text-xs leading-6">
            <li>{t("guides.ga.prereq1")}</li>
            <li>{t("guides.ga.prereq2")}</li>
            <li>{t("guides.ga.prereq3")}</li>
          </ul>
        </AlertDescription>
      </Alert>

      <Step
        number={1}
        title={t("guides.ga.step1.title")}
        description={t("guides.ga.step1.description")}
        bullets={[
          t("guides.ga.step1.b1"),
          t("guides.ga.step1.b2"),
          t("guides.ga.step1.b3"),
          t("guides.ga.step1.b4"),
        ]}
        externalLink={{ href: "https://analytics.google.com", label: "analytics.google.com" }}
        tip={
          <TipRow label={t("guides.ga.step1.example")}>
            <Code>542450506</Code>{" "}
            <span className="text-muted-foreground">
              ({t("guides.ga.step1.exampleNote")})
            </span>
          </TipRow>
        }
      />

      <Step
        number={2}
        title={t("guides.ga.step2.title")}
        description={t("guides.ga.step2.description")}
        bullets={[
          t("guides.ga.step2.b1"),
          t("guides.ga.step2.b2"),
          t("guides.ga.step2.b3"),
        ]}
        externalLink={{
          href: "https://console.cloud.google.com",
          label: "console.cloud.google.com",
        }}
      />

      <Step
        number={3}
        title={t("guides.ga.step3.title")}
        description={t("guides.ga.step3.description")}
        bullets={[
          t("guides.ga.step3.b1"),
          t("guides.ga.step3.b2"),
          t("guides.ga.step3.b3"),
        ]}
        externalLink={{
          href: "https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com",
          label: t("guides.ga.step3.link"),
        }}
      />

      <Step
        number={4}
        title={t("guides.ga.step4.title")}
        description={t("guides.ga.step4.description")}
        bullets={[
          t("guides.ga.step4.b1"),
          t("guides.ga.step4.b2"),
          t("guides.ga.step4.b3"),
          t("guides.ga.step4.b4"),
        ]}
        warning={t("guides.ga.step4.warning")}
      />

      <Step
        number={5}
        title={t("guides.ga.step5.title")}
        description={t("guides.ga.step5.description")}
        bullets={[
          t("guides.ga.step5.b1"),
          t("guides.ga.step5.b2"),
          t("guides.ga.step5.b3"),
          t("guides.ga.step5.b4"),
        ]}
        critical={t("guides.ga.step5.critical")}
        tip={
          <TipRow label={t("guides.ga.step5.emailFormat")}>
            <Code>narah-cms-analytics@your-project.iam.gserviceaccount.com</Code>
          </TipRow>
        }
      />

      <Step
        number={6}
        title={t("guides.ga.step6.title")}
        description={t("guides.ga.step6.description")}
        bullets={[
          t("guides.ga.step6.b1"),
          t("guides.ga.step6.b2"),
          t("guides.ga.step6.b3"),
          t("guides.ga.step6.b4"),
        ]}
      />

      {/* CTA */}
      <div className="rounded-xl border border-(--narah-accent)/30 bg-(--narah-accent)/5 p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-(--narah-accent)/15 text-(--narah-accent)">
            <CheckCircle2 className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t("guides.ga.doneTitle")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("guides.ga.doneDescription")}
            </p>
            <Button asChild size="sm" className="mt-3">
              <Link to={settingsHref}>
                {t("guides.ga.openSettings")}
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-(--narah-shadow-xs)">
        <h2 className="text-sm font-semibold">
          {t("guides.ga.troubleshootTitle")}
        </h2>
        <div className="space-y-3 text-xs leading-6">
          <TroubleshootRow
            symptom={t("guides.ga.t1.symptom")}
            fix={t("guides.ga.t1.fix")}
          />
          <TroubleshootRow
            symptom={t("guides.ga.t2.symptom")}
            fix={t("guides.ga.t2.fix")}
          />
          <TroubleshootRow
            symptom={t("guides.ga.t3.symptom")}
            fix={t("guides.ga.t3.fix")}
          />
          <TroubleshootRow
            symptom={t("guides.ga.t4.symptom")}
            fix={t("guides.ga.t4.fix")}
          />
        </div>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Local building blocks                                          */
/* ────────────────────────────────────────────────────────────── */

function Step({
  number,
  title,
  description,
  bullets,
  externalLink,
  tip,
  warning,
  critical,
}: {
  number: number;
  title: string;
  description: string;
  bullets: string[];
  externalLink?: { href: string; label: string };
  tip?: React.ReactNode;
  warning?: string;
  critical?: string;
}) {
  return (
    <section
      className={
        critical
          ? "rounded-xl border border-(--narah-accent)/40 bg-(--narah-accent)/5 p-6 shadow-(--narah-shadow-xs)"
          : "rounded-xl border border-border bg-card p-6 shadow-(--narah-shadow-xs)"
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            critical
              ? "grid size-8 shrink-0 place-items-center rounded-lg bg-(--narah-accent)/15 font-mono text-sm font-semibold text-(--narah-accent)"
              : "grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-foreground/5 font-mono text-sm font-semibold text-foreground dark:bg-white/5"
          }
        >
          {number}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{title}</h2>
              {critical ? (
                <span className="rounded-full border border-(--narah-accent)/40 bg-(--narah-accent)/15 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-(--narah-accent)">
                  {critical}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          </div>

          <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-6">
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ol>

          {externalLink ? (
            <a
              href={externalLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline-offset-4 hover:underline"
            >
              {externalLink.label}
              <ExternalLink className="size-3" />
            </a>
          ) : null}

          {tip ? <div className="pt-1">{tip}</div> : null}

          {warning ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="leading-5 text-amber-900 dark:text-amber-200">
                {warning}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TipRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs">
      <p className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 leading-5">{children}</p>
    </div>
  );
}

function Code({ children }: { children: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(children).catch(() => {
      /* ignore — clipboard might be unavailable in iframes */
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy"
      className="inline-flex items-center gap-1 rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[0.7rem] hover:bg-foreground/15 dark:bg-white/10 dark:hover:bg-white/15"
    >
      {children}
      <Copy className="size-3 opacity-60" />
    </button>
  );
}

function TroubleshootRow({ symptom, fix }: { symptom: string; fix: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-3">
      <p className="font-medium">{symptom}</p>
      <p className="mt-1 text-muted-foreground">{fix}</p>
    </div>
  );
}
