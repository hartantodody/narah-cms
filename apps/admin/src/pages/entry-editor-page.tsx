import {
  AlertCircle,
  ArrowLeft,
  Globe,
  History,
  Info,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/features/auth/auth-provider";
import { useSiteBasePath } from "@/lib/use-site-base-path";
import {
  createContentEntry,
  deleteContentEntry,
  getContentEntry,
  getContentEntryRevision,
  publishContentEntry,
  restoreContentEntryRevision,
  unpublishContentEntry,
  updateContentEntry,
} from "@/features/content-entries/content-entry.api";
import { DynamicFieldInput } from "@/features/content-entries/dynamic-field-input";
import { EntryRevisionsPanel } from "@/features/content-entries/entry-revisions-panel";
import type {
  ContentEntryDetail,
  ContentEntryRevisionListItem,
  ContentEntryStatus,
} from "@/features/content-entries/content-entry.types";
import {
  canEditContentEntries,
  contentEntryStatusClass,
  contentEntryStatusLabel,
} from "@/features/content-entries/content-entry.utils";
import { getContentType } from "@/features/content-types/content-type.api";
import type {
  ContentField,
  ContentTypeDetail,
} from "@/features/content-types/content-type.types";
import { getSite } from "@/features/sites/site.api";
import type { SiteDetail } from "@/features/sites/site.types";
import { ApiError, getApiErrorMessage } from "@/lib/api";

const initialValueForField = (field: ContentField, existing: unknown) => {
  if (existing !== undefined) return existing;
  if (field.defaultValue !== undefined && field.defaultValue !== null) {
    return field.defaultValue;
  }
  if (field.isList || field.type === "MULTI_SELECT") return [];
  if (field.type === "BOOLEAN") return false;
  return null;
};

export function EntryEditorPage() {
  const { siteId, contentTypeId, entryId } = useParams<{
    siteId: string;
    contentTypeId: string;
    entryId: string;
  }>();
  const isCreate = entryId === "new" || entryId === undefined;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const basePath = useSiteBasePath();

  const [site, setSite] = useState<SiteDetail | null>(null);
  const [contentType, setContentType] = useState<ContentTypeDetail | null>(null);
  const [entry, setEntry] = useState<ContentEntryDetail | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [slug, setSlug] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldIssues, setFieldIssues] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Bumped after every save/publish so the revisions panel knows to refetch.
  const [revisionsReloadKey, setRevisionsReloadKey] = useState(0);

  // Inline revision preview: when set, the form renders this snapshot's data
  // (read-only) and the normal action bar is replaced with a Restore / Close
  // banner. We keep this state at the editor level (not the panel) so the
  // form fields themselves swap to the preview without a separate dialog.
  const [previewRevision, setPreviewRevision] =
    useState<ContentEntryRevisionListItem | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(
    null,
  );
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const isPreviewing = previewRevision !== null;

  const canEdit = useMemo(
    () =>
      canEditContentEntries({
        isSuperAdmin: user?.isSuperAdmin ?? false,
        currentUserRole: site?.currentUserRole ?? null,
      }),
    [user?.isSuperAdmin, site?.currentUserRole],
  );

  const initData = useCallback(
    (ct: ContentTypeDetail, existing: Record<string, unknown> | null) => {
      const next: Record<string, unknown> = {};
      for (const field of ct.fields) {
        next[field.apiId] = initialValueForField(
          field,
          existing ? existing[field.apiId] : undefined,
        );
      }
      return next;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      if (!siteId || !contentTypeId) return;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [siteResp, ctResp] = await Promise.all([
          getSite(siteId),
          getContentType(siteId, contentTypeId),
        ]);
        if (cancelled) return;
        setSite(siteResp.site);
        setContentType(ctResp.contentType);

        if (!isCreate && entryId) {
          const { entry: existingEntry } = await getContentEntry(
            siteId,
            contentTypeId,
            entryId,
          );
          if (cancelled) return;
          setEntry(existingEntry);
          setSlug(existingEntry.slug ?? "");
          setData(initData(ctResp.contentType, existingEntry.data));
        } else {
          setData(initData(ctResp.contentType, null));
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(getApiErrorMessage(err, "Unable to load this entry."));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [siteId, contentTypeId, entryId, isCreate, initData]);

  const updateField = (apiId: string, value: unknown) => {
    setData((prev) => ({ ...prev, [apiId]: value }));
  };

  const handleSaveDraft = async () => {
    if (!siteId || !contentTypeId) return;
    setIsSaving(true);
    setErrorMessage(null);
    setFieldIssues([]);
    try {
      if (isCreate) {
        const { entry: created } = await createContentEntry(
          siteId,
          contentTypeId,
          {
            data,
            slug: slug.trim() || null,
            status: "DRAFT",
          },
        );
        navigate(
          `${basePath}/content-types/${contentTypeId}/entries/${created.id}`,
          { replace: true },
        );
      } else if (entryId) {
        const { entry: updated } = await updateContentEntry(
          siteId,
          contentTypeId,
          entryId,
          {
            data,
            slug: slug.trim() || null,
          },
        );
        setEntry(updated);
        setData(initData(contentType!, updated.data));
        setSlug(updated.slug ?? "");
      }
      setRevisionsReloadKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError && err.issues) setFieldIssues(err.issues);
      setErrorMessage(getApiErrorMessage(err, "Unable to save this entry."));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!siteId || !contentTypeId || !entryId || isCreate) return;
    setIsPublishing(true);
    setErrorMessage(null);
    setFieldIssues([]);
    try {
      // Save current data first so publish uses latest
      const { entry: saved } = await updateContentEntry(
        siteId,
        contentTypeId,
        entryId,
        { data, slug: slug.trim() || null },
      );
      const { entry: published } = await publishContentEntry(
        siteId,
        contentTypeId,
        saved.id,
      );
      setEntry(published);
      setRevisionsReloadKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError && err.issues) setFieldIssues(err.issues);
      setErrorMessage(getApiErrorMessage(err, "Unable to publish this entry."));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!siteId || !contentTypeId || !entryId || isCreate) return;
    setIsPublishing(true);
    setErrorMessage(null);
    try {
      const { entry: updated } = await unpublishContentEntry(
        siteId,
        contentTypeId,
        entryId,
      );
      setEntry(updated);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, "Unable to unpublish this entry."));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!siteId || !contentTypeId || !entryId || isCreate) return;
    setIsDeleting(true);
    try {
      await deleteContentEntry(siteId, contentTypeId, entryId);
      navigate(
        `${basePath}/content-types/${contentTypeId}/entries`,
      );
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, "Unable to delete this entry."));
      setIsDeleting(false);
    }
  };

  // ── Revision preview ────────────────────────────────────────────────────
  const handleSelectRevision = async (rev: ContentEntryRevisionListItem) => {
    if (!siteId || !contentTypeId || !entryId) return;
    setPreviewRevision(rev);
    setPreviewData(null);
    setIsLoadingPreview(true);
    setErrorMessage(null);
    setFieldIssues([]);
    try {
      const { revision } = await getContentEntryRevision(
        siteId,
        contentTypeId,
        entryId,
        rev.id,
      );
      setPreviewData(
        contentType ? initData(contentType, revision.data) : revision.data,
      );
    } catch (err) {
      setErrorMessage(
        getApiErrorMessage(err, t("content.editor.revisions.errorRevision")),
      );
      setPreviewRevision(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewRevision(null);
    setPreviewData(null);
  };

  const handleRestorePreview = async () => {
    if (!siteId || !contentTypeId || !entryId || !previewRevision) return;
    setIsRestoring(true);
    setErrorMessage(null);
    try {
      const { entry: restored } = await restoreContentEntryRevision(
        siteId,
        contentTypeId,
        entryId,
        previewRevision.id,
      );
      setEntry(restored);
      setData(contentType ? initData(contentType, restored.data) : restored.data);
      setSlug(restored.slug ?? "");
      setPreviewRevision(null);
      setPreviewData(null);
      setRevisionsReloadKey((k) => k + 1);
    } catch (err) {
      setErrorMessage(
        getApiErrorMessage(err, t("content.editor.revisions.errorRestore")),
      );
    } finally {
      setIsRestoring(false);
    }
  };

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
        <AlertDescription>{errorMessage ?? "Not found."}</AlertDescription>
      </Alert>
    );
  }

  const status: ContentEntryStatus = entry?.status ?? "DRAFT";
  const entriesHref = `${basePath}/content-types/${contentTypeId}/entries`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Link
          to={entriesHref}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t("content.editor.backToEntries")}
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
              {site.name} · {contentType.apiId}
            </p>
            <h1 className="font-serif text-3xl tracking-tight">
              {isCreate ? (
                <>
                  {t("content.editor.newPrefix")}{" "}
                  <em className="italic text-(--narah-accent)">
                    {contentType.name}
                  </em>
                </>
              ) : (
                <>
                  {t("content.editor.editPrefix")}{" "}
                  <em className="italic text-(--narah-accent)">
                    {entry?.slug ?? contentType.name}
                  </em>
                </>
              )}
            </h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Badge variant="outline" className={contentEntryStatusClass(status)}>
                {contentEntryStatusLabel(status)}
              </Badge>
              {entry ? (
                <span className="font-mono">
                  v{entry.version} · updated{" "}
                  {new Date(entry.updatedAt).toLocaleString()}
                </span>
              ) : null}
            </div>
          </div>

          {canEdit && !isPreviewing ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isSaving}
              >
                <Save className="size-4" />
                {isSaving
                  ? t("content.editor.saving")
                  : t("content.editor.saveDraft")}
              </Button>
              {!isCreate && entry ? (
                status === "PUBLISHED" ? (
                  <Button
                    variant="outline"
                    onClick={handleUnpublish}
                    disabled={isPublishing}
                  >
                    {t("content.editor.unpublish")}
                  </Button>
                ) : (
                  <Button onClick={handlePublish} disabled={isPublishing}>
                    <Globe className="size-4" />
                    {isPublishing
                      ? t("content.editor.publishing")
                      : t("content.editor.publish")}
                  </Button>
                )
              ) : null}

              {/* Slug + audit details — collapsed into a popover so the right
                  rail can stay focused on revisions. */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t("content.editor.detailsButton")}
                    title={t("content.editor.detailsButton")}
                  >
                    <Info className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="slug" className="text-xs font-medium">
                        {t("content.editor.slugLabel")}
                      </Label>
                      <Input
                        id="slug"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder={t("content.editor.slugPlaceholder")}
                        className="h-9 font-mono text-xs"
                        disabled={!canEdit || isPreviewing}
                      />
                      <p className="text-[0.7rem] text-muted-foreground">
                        {t("content.editor.slugHint")}
                      </p>
                    </div>

                    <div className="space-y-1.5 border-t border-border pt-3">
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                        {t("content.editor.audit")}
                      </p>
                      {entry ? (
                        <dl className="space-y-1 text-xs">
                          <Row label={t("content.editor.auditCreatedBy")} value={entry.createdBy.name || entry.createdBy.email} />
                          <Row label={t("content.editor.auditCreatedAt")} value={new Date(entry.createdAt).toLocaleString()} />
                          <Row label={t("content.editor.auditUpdatedBy")} value={entry.updatedBy.name || entry.updatedBy.email} />
                          <Row label={t("content.editor.auditUpdatedAt")} value={new Date(entry.updatedAt).toLocaleString()} />
                          <Row
                            label={t("content.editor.auditPublished")}
                            value={
                              entry.publishedAt
                                ? new Date(entry.publishedAt).toLocaleString()
                                : "—"
                            }
                          />
                        </dl>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {t("content.editor.auditEmpty")}
                        </p>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {!isCreate && entry ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmDelete(true)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={t("content.editor.deleteEntry")}
                  title={t("content.editor.deleteEntry")}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Revision preview banner */}
      {isPreviewing && previewRevision ? (() => {
        // A revision matching the entry's current version is "the current
        // state" — restoring it is a no-op and would be confusing. Switch
        // the banner copy and disable the Restore button in that case.
        const isCurrent = entry?.version === previewRevision.version;
        return (
          <div
            className={
              isCurrent
                ? "flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                : "flex flex-col gap-3 rounded-xl border border-(--narah-accent)/30 bg-(--narah-accent)/5 p-4 sm:flex-row sm:items-center sm:justify-between"
            }
          >
            <div className="flex items-start gap-3">
              <div
                className={
                  isCurrent
                    ? "mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-foreground/10 text-foreground dark:bg-white/10"
                    : "mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-(--narah-accent)/15 text-(--narah-accent)"
                }
              >
                <History className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {isCurrent
                    ? t("content.editor.revisions.previewBannerCurrentTitle", {
                        version: previewRevision.version,
                      })
                    : t("content.editor.revisions.previewBannerTitle", {
                        version: previewRevision.version,
                      })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isCurrent
                    ? t("content.editor.revisions.previewBannerCurrentDescription", {
                        when: new Date(previewRevision.createdAt).toLocaleString(),
                        author:
                          previewRevision.author.name ||
                          previewRevision.author.email,
                      })
                    : t("content.editor.revisions.previewBannerDescription", {
                        when: new Date(previewRevision.createdAt).toLocaleString(),
                        author:
                          previewRevision.author.name ||
                          previewRevision.author.email,
                      })}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClosePreview}
                disabled={isRestoring}
              >
                <X className="size-3.5" />
                {t("content.editor.revisions.previewBannerClose")}
              </Button>
              {canEdit && !isCurrent ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleRestorePreview}
                  disabled={isRestoring || isLoadingPreview}
                >
                  <RotateCcw className="size-3.5" />
                  {isRestoring
                    ? t("content.editor.revisions.restoring")
                    : t("content.editor.revisions.previewBannerRestore")}
                </Button>
              ) : null}
            </div>
          </div>
        );
      })() : null}

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{t("content.editor.cantSaveTitle")}</AlertTitle>
          <AlertDescription>
            {errorMessage}
            {fieldIssues.length > 0 ? (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
                {fieldIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Layout: main form + sidebar */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-(--narah-shadow-xs)">
          {contentType.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("content.editor.noFields")}{" "}
              {user?.isSuperAdmin ? (
                <Link
                  to={`${basePath}/content-types/${contentTypeId}`}
                  className="text-foreground underline underline-offset-4"
                >
                  {t("content.editor.addFieldsHint")}
                </Link>
              ) : (
                <span>{t("content.editor.askAdmin")}</span>
              )}
            </p>
          ) : (
            contentType.fields.map((field) => {
              const previewValue = previewData?.[field.apiId];
              const currentValue = isPreviewing ? previewValue : data[field.apiId];
              return (
                <DynamicFieldInput
                  key={field.id}
                  field={field}
                  value={currentValue}
                  onChange={(next) => updateField(field.apiId, next)}
                  disabled={
                    !canEdit ||
                    isSaving ||
                    isPublishing ||
                    isPreviewing
                  }
                  siteId={siteId!}
                />
              );
            })
          )}
        </div>

        <aside className="space-y-5">
          {!isCreate && entry && siteId && contentTypeId ? (
            <EntryRevisionsPanel
              siteId={siteId}
              contentTypeId={contentTypeId}
              entryId={entry.id}
              reloadKey={revisionsReloadKey}
              activeRevisionId={previewRevision?.id ?? null}
              onSelect={handleSelectRevision}
            />
          ) : null}

          {!canEdit ? (
            <p className="text-xs text-muted-foreground">
              {t("content.editor.viewerNotice")}
            </p>
          ) : null}
        </aside>
      </div>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("content.editor.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("content.editor.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault();
                await handleDelete();
              }}
            >
              {isDeleting ? t("common.deleting") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="truncate text-right text-foreground">{value}</dd>
  </div>
);
