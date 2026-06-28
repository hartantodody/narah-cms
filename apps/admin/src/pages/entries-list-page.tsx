import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Code2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-provider";
import { useSiteBasePath } from "@/lib/use-site-base-path";
import {
  deleteContentEntry,
  listContentEntries,
} from "@/features/content-entries/content-entry.api";
import type {
  ContentEntryListItem,
  ContentEntryStatus,
} from "@/features/content-entries/content-entry.types";
import {
  canEditContentEntries,
  contentEntryStatusClass,
  contentEntryStatusLabel,
} from "@/features/content-entries/content-entry.utils";
import { getContentType } from "@/features/content-types/content-type.api";
import type { ContentTypeDetail } from "@/features/content-types/content-type.types";
import { getSite } from "@/features/sites/site.api";
import type { SiteDetail } from "@/features/sites/site.types";
import { getApiErrorMessage } from "@/lib/api";

const STATUS_FILTER_VALUES = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const PAGE_SIZE = 20;

export function EntriesListPage() {
  const { siteId, contentTypeId } = useParams<{
    siteId: string;
    contentTypeId: string;
  }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const basePath = useSiteBasePath();

  const statusLabel = (value: "ALL" | ContentEntryStatus) => {
    switch (value) {
      case "ALL":
        return t("content.entries.status.all");
      case "DRAFT":
        return t("content.entries.status.draft");
      case "PUBLISHED":
        return t("content.entries.status.published");
      case "ARCHIVED":
        return t("content.entries.status.archived");
    }
  };

  const [site, setSite] = useState<SiteDetail | null>(null);
  const [contentType, setContentType] = useState<ContentTypeDetail | null>(null);
  const [items, setItems] = useState<ContentEntryListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ContentEntryStatus>(
    "ALL",
  );
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ContentEntryListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canEdit = useMemo(
    () =>
      canEditContentEntries({
        isSuperAdmin: user?.isSuperAdmin ?? false,
        currentUserRole: site?.currentUserRole ?? null,
      }),
    [user?.isSuperAdmin, site?.currentUserRole],
  );

  const loadEntries = useCallback(async () => {
    if (!siteId || !contentTypeId) return;
    setIsRefreshing(true);
    try {
      const response = await listContentEntries(siteId, contentTypeId, {
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        search: search.trim() || undefined,
      });
      setItems(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load entries."));
    } finally {
      setIsRefreshing(false);
    }
  }, [siteId, contentTypeId, page, statusFilter, search]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      if (!siteId || !contentTypeId) return;
      setIsLoading(true);
      setError(null);
      try {
        const [siteResp, ctResp] = await Promise.all([
          getSite(siteId),
          getContentType(siteId, contentTypeId),
        ]);
        if (cancelled) return;
        setSite(siteResp.site);
        setContentType(ctResp.contentType);
      } catch (err) {
        if (!cancelled) {
          setError(
            getApiErrorMessage(err, "Unable to load this content type."),
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [siteId, contentTypeId]);

  useEffect(() => {
    if (!isLoading) loadEntries();
  }, [isLoading, loadEntries]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (!site || !contentType) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Unable to load</AlertTitle>
        <AlertDescription>{error ?? "Content type not found."}</AlertDescription>
      </Alert>
    );
  }

  const backHref = user?.isSuperAdmin
    ? `${basePath}/content-types/${contentTypeId}`
    : basePath;
  const backLabel = t("content.entries.backToContent");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Link
          to={backHref}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {backLabel}
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
              {site.name} · {contentType.apiId}
              {contentType.isSingleton ? " · singleton" : ""}
            </p>
            <h1 className="font-serif text-3xl tracking-tight">
              {contentType.name}{" "}
              <em className="italic text-(--narah-accent)">
                {t("content.entries.titleSuffix")}
              </em>
            </h1>
            {contentType.description ? (
              <p className="max-w-xl text-sm text-muted-foreground">
                {contentType.description}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  user?.isSuperAdmin
                    ? `${basePath}/content-types/${contentTypeId}`
                    : `${basePath}/content-types/${contentTypeId}/api`,
                )
              }
              title={
                user?.isSuperAdmin
                  ? "Open the schema builder — API explorer is at the bottom"
                  : "Open the API explorer for this content type"
              }
            >
              <Code2 className="size-4" />
              {t("content.entries.viewApi")}
            </Button>
            {canEdit ? (
              <Button
                onClick={() =>
                  navigate(
                    `${basePath}/content-types/${contentTypeId}/entries/new`,
                  )
                }
                disabled={
                  contentType.isSingleton &&
                  items.length > 0 &&
                  page === 1
                }
              >
                <Plus className="size-4" />
                {t("content.entries.newEntry")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTER_VALUES.map((value) => {
            const active = statusFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                className={
                  "rounded-md border px-3 py-1.5 text-xs transition-colors " +
                  (active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground")
                }
              >
                {statusLabel(value)}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("content.entries.searchPlaceholder")}
            className="h-9 rounded-md pl-9 text-sm"
          />
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{t("content.entries.errorTitle")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-(--narah-shadow-xs)">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">{t("content.entries.columns.slug")}</TableHead>
              <TableHead>{t("content.entries.columns.status")}</TableHead>
              <TableHead>{t("content.entries.columns.updated")}</TableHead>
              <TableHead>{t("content.entries.columns.updatedBy")}</TableHead>
              <TableHead className="w-[80px] text-right">{t("content.entries.columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isRefreshing && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center">
                  <Spinner className="size-4" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  {t("content.entries.empty")}
                  {canEdit ? ` ${t("content.entries.emptyHint")}` : ""}
                </TableCell>
              </TableRow>
            ) : (
              items.map((entry) => (
                <TableRow
                  key={entry.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate(
                      `${basePath}/content-types/${contentTypeId}/entries/${entry.id}`,
                    )
                  }
                >
                  <TableCell className="font-mono text-xs">
                    {entry.slug ?? (
                      <span className="text-muted-foreground italic">
                        (no slug)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={contentEntryStatusClass(entry.status)}
                    >
                      {contentEntryStatusLabel(entry.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(entry.updatedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.updatedBy.name || entry.updatedBy.email}
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleting(entry);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Delete entry"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {total} entries
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Delete dialog */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the entry. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleting || !siteId || !contentTypeId) return;
                setIsDeleting(true);
                try {
                  await deleteContentEntry(siteId, contentTypeId, deleting.id);
                  setDeleting(null);
                  await loadEntries();
                } catch (err) {
                  setError(getApiErrorMessage(err, "Unable to delete entry."));
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
