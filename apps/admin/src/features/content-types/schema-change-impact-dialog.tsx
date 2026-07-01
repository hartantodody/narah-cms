import { AlertTriangle, Info, ShieldCheck } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import type { FieldImpactAnalysis } from "@/features/content-types/content-type.api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  analysis: FieldImpactAnalysis | null;
  errorMessage: string | null;
  onConfirm: () => void;
  actionLabel?: string;
  /** Short description of the change ("Rename apiId → headline", "Delete field",
   *  "Change type to NUMBER"). Rendered in the dialog header. */
  changeSummary: string;
  submitting?: boolean;
};

const SAMPLE_LIMIT_HINT = 20;

/**
 * Preview dialog shown before any risky schema change is committed.
 * Renders the impact-analysis response and either asks the user to
 * confirm, or hard-blocks the action when the API says the change
 * can't be made safely.
 */
export function SchemaChangeImpactDialog({
  open,
  onOpenChange,
  loading,
  analysis,
  errorMessage,
  onConfirm,
  actionLabel = "Apply change",
  changeSummary,
  submitting,
}: Props) {
  const isBlocked = Boolean(analysis?.blockingReason);
  const hasRisk = !!analysis && analysis.entriesAtRisk > 0;
  const isSafe = !!analysis && !hasRisk && !isBlocked;
  const hiddenCount =
    analysis && analysis.sample.length < analysis.entriesWithValue
      ? Math.max(0, analysis.entriesWithValue - analysis.sample.length)
      : 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isBlocked ? (
              <AlertTriangle className="size-4 text-destructive" />
            ) : hasRisk ? (
              <AlertTriangle className="size-4 text-amber-500" />
            ) : (
              <ShieldCheck className="size-4 text-emerald-500" />
            )}
            {isBlocked
              ? "This change is blocked"
              : hasRisk
                ? "Review data-loss risk"
                : "Change is safe"}
          </AlertDialogTitle>
          <AlertDialogDescription>{changeSummary}</AlertDialogDescription>
        </AlertDialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Checking existing entries…
          </div>
        ) : errorMessage ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {errorMessage}
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            {/* Summary counts */}
            <div className="grid grid-cols-3 gap-2">
              <SummaryTile label="Entries" value={analysis.totalEntries} />
              <SummaryTile
                label="With value"
                value={analysis.entriesWithValue}
              />
              <SummaryTile
                label="At risk"
                value={analysis.entriesAtRisk}
                tone={analysis.entriesAtRisk > 0 ? "danger" : "neutral"}
              />
            </div>

            {analysis.blockingReason ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
                <p className="font-medium text-destructive">
                  Blocked by the API
                </p>
                <p className="mt-1 leading-5 text-destructive/90">
                  {analysis.blockingReason}
                </p>
              </div>
            ) : isSafe ? (
              <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-200">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <p className="leading-5">
                  No entries will lose data. A snapshot of every affected
                  entry is taken before the change is applied — restorable
                  from the revisions panel if you need it.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <p className="leading-5">
                  {analysis.entriesAtRisk} of {analysis.totalEntries} entries
                  may lose data or become invalid to publish. A snapshot of
                  every affected entry is still taken before the change so
                  you can restore later from the revisions panel.
                </p>
              </div>
            )}

            {analysis.sample.length > 0 ? (
              <div className="space-y-2">
                <p className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                  Affected entries
                  {analysis.sample.length >= SAMPLE_LIMIT_HINT
                    ? ` · showing first ${SAMPLE_LIMIT_HINT}`
                    : ""}
                </p>
                <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border/60 bg-muted/30 p-2 text-xs">
                  {analysis.sample.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded px-2 py-1"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono">
                          {s.slug ?? s.id.slice(0, 8)}
                        </p>
                        <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                          {s.status.toLowerCase()}
                          {s.hasValue ? " · has value" : ""}
                        </p>
                      </div>
                      {s.willLoseData ? (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          at risk
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {hiddenCount > 0 ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    …and {hiddenCount} more.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={hasRisk ? "destructive" : undefined}
            disabled={loading || isBlocked || submitting}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {submitting ? "Applying…" : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SummaryTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "danger";
}) {
  return (
    <div
      className={
        tone === "danger" && value > 0
          ? "rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-center"
          : "rounded-md border border-border/60 bg-muted/40 p-3 text-center"
      }
    >
      <p className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={
          tone === "danger" && value > 0
            ? "text-lg font-semibold text-amber-700 dark:text-amber-400"
            : "text-lg font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}
