import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getGlobalAuditLogs, getSiteAuditLogs } from "./audit.api";
import type { AuditLogEntry, AuditLogListResponse } from "./audit.types";

type AuditLogViewerProps = {
  /** If provided, fetches /sites/:siteId/audit-logs. Else uses /audit-logs (global, super-admin only). */
  siteId?: string;
};

const PAGE_SIZE = 25;

export function AuditLogViewer({ siteId }: AuditLogViewerProps) {
  const [data, setData] = useState<AuditLogListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetcher = siteId
      ? getSiteAuditLogs(siteId, {
          page,
          pageSize: PAGE_SIZE,
          action: actionFilter || undefined,
        })
      : getGlobalAuditLogs({
          page,
          pageSize: PAGE_SIZE,
          action: actionFilter || undefined,
        });

    fetcher
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load audit log",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [siteId, page, actionFilter]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          placeholder="Filter by action (e.g. content_entry.published)…"
          className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-xs sm:max-w-md"
        />
        {actionFilter ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActionFilter("");
              setPage(1);
            }}
            className="h-9 text-xs"
          >
            Clear
          </Button>
        ) : null}
        {data ? (
          <span className="ml-auto font-mono text-[0.65rem] text-muted-foreground">
            {data.total} {data.total === 1 ? "event" : "events"}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-(--narah-shadow-xs)">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">When</TableHead>
              <TableHead>Action</TableHead>
              {!siteId ? <TableHead>Site</TableHead> : null}
              <TableHead>Actor</TableHead>
              <TableHead>Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={siteId ? 4 : 5}
                  className="py-10 text-center"
                >
                  <Spinner className="size-4" />
                </TableCell>
              </TableRow>
            ) : !data || data.items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={siteId ? 4 : 5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <History className="size-5 text-muted-foreground/60" />
                    No audit events yet.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((event) => (
                <AuditRow key={event.id} event={event} showSite={!siteId} />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <span className="font-mono text-[0.65rem] text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="size-3.5" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage(page + 1)}
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

function AuditRow({
  event,
  showSite,
}: {
  event: AuditLogEntry;
  showSite: boolean;
}) {
  const actorName = event.user?.name ?? event.user?.email ?? "system";
  return (
    <TableRow>
      <TableCell className="font-mono text-[0.65rem] text-muted-foreground">
        {formatDateTime(event.createdAt)}
      </TableCell>
      <TableCell>
        <ActionBadge action={event.action} />
      </TableCell>
      {showSite ? (
        <TableCell className="text-xs">
          {event.site ? (
            <span className="font-medium">{event.site.name}</span>
          ) : (
            <span className="italic text-muted-foreground">—</span>
          )}
        </TableCell>
      ) : null}
      <TableCell className="text-xs">{actorName}</TableCell>
      <TableCell className="font-mono text-[0.65rem] text-muted-foreground">
        <div className="flex flex-col gap-0.5">
          <span>{event.entityType}</span>
          <span className="truncate text-muted-foreground/70">
            {event.entityId.slice(0, 8)}…
          </span>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ActionBadge({ action }: { action: string }) {
  const verb = action.split(".").pop() ?? action;
  const tone = verbTone(verb);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[0.7rem]">{action}</span>
      <Badge
        variant="outline"
        className={cn("self-start font-mono text-[0.55rem] uppercase", tone)}
      >
        {verb.replace(/_/g, " ")}
      </Badge>
    </div>
  );
}

function verbTone(verb: string): string {
  if (verb === "created" || verb === "uploaded" || verb === "published") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  }
  if (
    verb === "deleted" ||
    verb === "removed" ||
    verb === "revoked" ||
    verb === "archived"
  ) {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400";
  }
  if (verb === "updated" || verb === "role_changed" || verb === "reordered") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
  return "border-zinc-400/30 bg-zinc-400/10 text-zinc-600 dark:text-zinc-400";
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
