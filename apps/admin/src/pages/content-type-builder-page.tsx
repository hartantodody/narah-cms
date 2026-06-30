import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BadgeCheck,
  Braces,
  Calendar,
  CalendarClock,
  CheckSquare2,
  Code2,
  Edit3,
  FileText,
  Hash,
  Image as ImageIcon,
  Info,
  Layers,
  Layers3,
  Link2,
  List as ListIcon,
  ListChecks,
  ListTree,
  Plus,
  SlidersHorizontal,
  Trash2,
  Type as TypeIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
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
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/features/auth/auth-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddToSchemaChooserDialog } from "@/features/content-types/add-to-schema-chooser-dialog";
import { ContentFieldFormDialog } from "@/features/content-types/content-field-form-dialog";
import { ContentGroupFormDialog } from "@/features/content-types/content-group-form-dialog";
import { ContentTypeFormDialog } from "@/features/content-types/content-type-form-dialog";
import {
  deleteContentField,
  deleteContentType,
  getContentType,
  reorderContentFields,
} from "@/features/content-types/content-type.api";
import { DynamicFieldInput } from "@/features/content-entries/dynamic-field-input";
import { SchemaCodeEditor } from "@/features/content-types/schema-code-editor";
import type {
  ContentField,
  ContentTypeDetail,
} from "@/features/content-types/content-type.types";
import {
  canManageContentTypes,
  formatContentFieldType,
  getContentFieldTypeBadgeClassName,
} from "@/features/content-types/content-type.utils";
import { getSite } from "@/features/sites/site.api";
import type { SiteDetail } from "@/features/sites/site.types";
import { formatSiteDate } from "@/features/sites/site.utils";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { ApiExplorerPanel } from "@/features/api-explorer/api-explorer-panel";

export function ContentTypeBuilderPage() {
  const { siteId, contentTypeId } = useParams<{
    siteId: string;
    contentTypeId: string;
  }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [contentType, setContentType] = useState<ContentTypeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isContentTypeDialogOpen, setIsContentTypeDialogOpen] = useState(false);
  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [editingField, setEditingField] = useState<ContentField | null>(null);
  const [deletingField, setDeletingField] = useState<ContentField | null>(null);
  const [isDeletingField, setIsDeletingField] = useState(false);
  const [isDeletingContentType, setIsDeletingContentType] = useState(false);
  const [isDeleteContentTypeDialogOpen, setIsDeleteContentTypeDialogOpen] =
    useState(false);
  const [reorderingFieldId, setReorderingFieldId] = useState<string | null>(null);

  const canManage = useMemo(
    () =>
      canManageContentTypes({
        isSuperAdmin: Boolean(user?.isSuperAdmin),
        currentUserRole: site?.currentUserRole ?? null,
      }),
    [site?.currentUserRole, user?.isSuperAdmin],
  );

  const refreshBuilderData = async () => {
    if (!siteId || !contentTypeId) {
      return;
    }

    const currentSiteId = siteId;
    const currentContentTypeId = contentTypeId;

    if (!currentSiteId || !currentContentTypeId) {
      return;
    }

    const [siteResponse, contentTypeResponse] = await Promise.all([
      getSite(currentSiteId),
      getContentType(currentSiteId, currentContentTypeId),
    ]);

    setSite(siteResponse.site);
    setContentType(contentTypeResponse.contentType);
  };

  useEffect(() => {
    if (!siteId || !contentTypeId) {
      setErrorMessage("A site id and content type id are required.");
      setIsLoading(false);
      return;
    }

    let isActive = true;

    async function loadBuilderData() {
      setIsLoading(true);
      setErrorMessage(null);

      const currentSiteId = siteId;
      const currentContentTypeId = contentTypeId;

      if (!currentSiteId || !currentContentTypeId) {
        return;
      }

      try {
        const [siteResponse, contentTypeResponse] = await Promise.all([
          getSite(currentSiteId),
          getContentType(currentSiteId, currentContentTypeId),
        ]);

        if (!isActive) {
          return;
        }

        setSite(siteResponse.site);
        setContentType(contentTypeResponse.contentType);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          getApiErrorMessage(
            error,
            "We couldn't load this content type right now.",
          ),
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadBuilderData();

    return () => {
      isActive = false;
    };
  }, [contentTypeId, siteId]);

  const handleDeleteField = async () => {
    if (!siteId || !contentTypeId || !deletingField) {
      return;
    }

    setIsDeletingField(true);
    setErrorMessage(null);

    try {
      await deleteContentField(siteId, contentTypeId, deletingField.id);
      await refreshBuilderData();
      setDeletingField(null);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "We couldn't delete this field right now."),
      );
    } finally {
      setIsDeletingField(false);
    }
  };

  const handleDeleteContentType = async () => {
    if (!siteId || !contentTypeId || !contentType) {
      return;
    }

    setIsDeletingContentType(true);
    setErrorMessage(null);

    try {
      await deleteContentType(siteId, contentTypeId);
      navigate(`/s/${siteId}/schema`, {
        replace: true,
      });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "CONTENT_TYPE_HAS_ENTRIES"
      ) {
        setErrorMessage(
          "This content type already has entries and cannot be deleted.",
        );
      } else {
        setErrorMessage(
          getApiErrorMessage(
            error,
            "We couldn't delete this content type right now.",
          ),
        );
      }
    } finally {
      setIsDeletingContentType(false);
      setIsDeleteContentTypeDialogOpen(false);
    }
  };

  const handleMoveField = async (fieldId: string, direction: -1 | 1) => {
    if (!siteId || !contentTypeId || !contentType) {
      return;
    }

    const currentIndex = contentType.fields.findIndex((field) => field.id === fieldId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= contentType.fields.length) {
      return;
    }

    const nextFields = [...contentType.fields];
    const [field] = nextFields.splice(currentIndex, 1);
    nextFields.splice(nextIndex, 0, field);

    setReorderingFieldId(fieldId);
    setErrorMessage(null);
    setContentType({
      ...contentType,
      fields: nextFields.map((item, index) => ({
        ...item,
        sortOrder: index,
      })),
    });

    try {
      await reorderContentFields(
        siteId,
        contentTypeId,
        nextFields.map((item) => item.id),
      );
      await refreshBuilderData();
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "We couldn't reorder fields right now."),
      );
      await refreshBuilderData();
    } finally {
      setReorderingFieldId(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="narah-glass-panel rounded-[28px] border border-border/70">
        <CardContent className="flex min-h-48 items-center justify-center gap-3 pt-4 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Loading content type builder...
        </CardContent>
      </Card>
    );
  }

  if (!siteId || !contentTypeId || !site || !contentType) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Content type unavailable</AlertTitle>
          <AlertDescription>
            {errorMessage ?? "We couldn't find this content type."}
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="rounded-2xl border-border/80 bg-background/60 hover:bg-background/80"
          asChild
        >
          <Link to="/admin/sites">
            <ArrowLeft className="size-4" />
            Back to sites
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <Button
              variant="outline"
              className="rounded-2xl border-border/80 bg-background/60 hover:bg-background/80"
              asChild
            >
              <Link to={`/s/${siteId}/schema`}>
                <ArrowLeft className="size-4" />
                {t("schema.builder.back")}
              </Link>
            </Button>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-transparent bg-primary/14 text-[var(--narah-primary-soft)]">
                  {t("schema.builder.badge")}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-[var(--narah-border-strong)] bg-white/[0.03] text-[var(--narah-accent-soft)]"
                >
                  {contentType.apiId}
                </Badge>
                {contentType.isSingleton ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-(--narah-accent)/30 bg-(--narah-accent)/10 font-mono text-[0.6rem] uppercase tracking-wider text-(--narah-accent)"
                  >
                    <FileText className="size-3" />
                    {t("schema.contentTypes.mode.singleton")}
                  </Badge>
                ) : null}
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">
                  {contentType.name}
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {contentType.description ?? t("schema.builder.noDescription")}
                </p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>{t("schema.builder.siteLabel")}: {site.name}</span>
                  <span>
                    {t("schema.builder.updatedLabel")}:{" "}
                    {formatSiteDate(contentType.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-2xl border-border/80 bg-background/60 hover:bg-background/80"
              asChild
            >
              <Link
                to={`/s/${siteId}/content-types/${contentTypeId}/entries`}
              >
                <ListTree className="size-4" />
                {t("schema.builder.viewEntries")}
              </Link>
            </Button>
            {canManage ? (
              <Button
                variant="outline"
                className="rounded-2xl border-border/80 bg-background/60 hover:bg-background/80"
                onClick={() => setIsContentTypeDialogOpen(true)}
              >
                <Edit3 className="size-4" />
                {t("schema.builder.editType")}
              </Button>
            ) : null}
            {canManage ? (
              <Button
                className="rounded-2xl bg-primary px-5 hover:bg-primary/90"
                onClick={() => {
                  setEditingField(null);
                  setIsChooserOpen(true);
                }}
              >
                <Plus className="size-4" />
                {t("schema.builder.addField")}
              </Button>
            ) : null}
            {canManage ? (
              <Button
                variant="destructive"
                className="rounded-2xl"
                onClick={() => setIsDeleteContentTypeDialogOpen(true)}
              >
                <Trash2 className="size-4" />
                {t("schema.builder.deleteType")}
              </Button>
            ) : null}
          </div>
        </div>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Unable to complete schema action</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="rounded-2xl border border-border/70 bg-card/40 py-0">
          <Tabs defaultValue="overview" className="gap-0">
            <div className="border-b border-border/60 px-4 py-3">
              <TabsList className="h-9">
                <TabsTrigger value="overview" className="gap-1.5 px-3">
                  <Info className="size-3.5" />
                  {t("schema.builder.tabs.overview")}
                </TabsTrigger>
                <TabsTrigger value="visual" className="gap-1.5 px-3">
                  <SlidersHorizontal className="size-3.5" />
                  {t("schema.builder.tabs.visual")}
                </TabsTrigger>
                <TabsTrigger value="code" className="gap-1.5 px-3">
                  <Braces className="size-3.5" />
                  {t("schema.builder.tabs.code")}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="p-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-primary/10 text-(--narah-primary-soft)">
                      <BadgeCheck className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {t("schema.builder.overview.summary.title")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("schema.builder.overview.summary.description")}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 pt-1">
                    <SummaryRow
                      label={t("schema.builder.overview.summary.apiId")}
                      value={contentType.apiId}
                    />
                    <SummaryRow
                      label={t("schema.builder.overview.summary.mode")}
                      value={
                        contentType.isSingleton
                          ? t("schema.contentTypes.mode.singleton")
                          : t("schema.contentTypes.mode.collection")
                      }
                    />
                    <SummaryRow
                      label={t("schema.builder.overview.summary.fieldCount")}
                      value={String(contentType.fields.length)}
                    />
                    <SummaryRow
                      label={t("schema.builder.overview.summary.siteRole")}
                      value={site.currentUserRole ?? "-"}
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-[var(--narah-accent-muted)] text-[var(--narah-accent-soft)]">
                      <Layers3 className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {t("schema.builder.overview.notes.title")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("schema.builder.overview.notes.description")}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    <Trans
                      i18nKey="schema.builder.overview.notes.body"
                      components={{
                        strong: <strong className="text-foreground" />,
                      }}
                    />
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-primary/10 text-(--narah-primary-soft)">
                    <Code2 className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {t("schema.builder.overview.apiExplorer.title")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("schema.builder.overview.apiExplorer.description")}
                    </p>
                  </div>
                </div>
                <ApiExplorerPanel contentType={contentType} />
              </div>
            </TabsContent>

            <TabsContent value="visual" className="p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    {t("schema.builder.fields.title")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("schema.builder.fields.description")}
                  </p>
                </div>
                {!canManage ? (
                  <Badge
                    variant="outline"
                    className="border-[var(--narah-border-strong)] bg-white/[0.03] text-[var(--narah-accent-soft)]"
                  >
                    {t("schema.contentTypes.readOnly")}
                  </Badge>
                ) : null}
              </div>
              <div className="space-y-4">
              {contentType.fields.length === 0 ? (
                <div className="flex min-h-52 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/70 bg-card/40 px-6 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-primary/12 text-[var(--narah-primary-soft)]">
                    <ListTree className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">
                      {t("schema.builder.fields.empty")}
                    </p>
                    <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                      {t("schema.builder.fields.emptyHint")}
                    </p>
                  </div>
                  {canManage ? (
                    <Button
                      className="rounded-2xl bg-primary px-5 hover:bg-primary/90"
                      onClick={() => {
                        setEditingField(null);
                        setIsChooserOpen(true);
                      }}
                    >
                      <Plus className="size-4" />
                      {t("schema.builder.fields.addField")}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card/50">
                  {contentType.fields.map((field, index) => (
                    <FieldRow
                      key={field.id}
                      field={field}
                      siteId={siteId}
                      isFirst={index === 0}
                      isLast={index === contentType.fields.length - 1}
                      isReordering={reorderingFieldId === field.id}
                      canManage={canManage}
                      onMoveUp={() => void handleMoveField(field.id, -1)}
                      onMoveDown={() => void handleMoveField(field.id, 1)}
                      onEdit={() => {
                        setEditingField(field);
                        if (field.type === "GROUP") {
                          setIsGroupDialogOpen(true);
                        } else {
                          setIsFieldDialogOpen(true);
                        }
                      }}
                      onDelete={() => setDeletingField(field)}
                    />
                  ))}
                </div>
              )}
              </div>
            </TabsContent>

            <TabsContent value="code" className="p-5">
              <SchemaCodeEditor
                siteId={siteId}
                contentTypeId={contentTypeId}
                contentType={contentType}
                canManage={canManage}
                onApplied={(next) => setContentType(next)}
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <ContentTypeFormDialog
        open={isContentTypeDialogOpen}
        onOpenChange={setIsContentTypeDialogOpen}
        siteId={siteId}
        contentType={contentType}
        onSuccess={async (nextContentType) => {
          setContentType(nextContentType);
          await refreshBuilderData();
        }}
      />

      <AddToSchemaChooserDialog
        open={isChooserOpen}
        onOpenChange={setIsChooserOpen}
        onChoose={(choice) => {
          setIsChooserOpen(false);
          setEditingField(null);
          if (choice === "field") {
            setIsFieldDialogOpen(true);
          } else {
            setIsGroupDialogOpen(true);
          }
        }}
      />

      <ContentFieldFormDialog
        open={isFieldDialogOpen}
        onOpenChange={(open) => {
          setIsFieldDialogOpen(open);

          if (!open) {
            setEditingField(null);
          }
        }}
        siteId={siteId}
        contentTypeId={contentTypeId}
        field={editingField}
        onSuccess={async () => {
          await refreshBuilderData();
          setEditingField(null);
        }}
      />

      <ContentGroupFormDialog
        open={isGroupDialogOpen}
        onOpenChange={(open) => {
          setIsGroupDialogOpen(open);
          if (!open) {
            setEditingField(null);
          }
        }}
        siteId={siteId}
        contentTypeId={contentTypeId}
        field={editingField?.type === "GROUP" ? editingField : null}
        onSuccess={async () => {
          await refreshBuilderData();
          setEditingField(null);
        }}
      />

      <AlertDialog
        open={Boolean(deletingField)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingField(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this field?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingField
                ? `Delete "${deletingField.label}" from this content type.`
                : "Delete this field from the content type."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingField}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeletingField}
              onClick={handleDeleteField}
            >
              {isDeletingField ? "Deleting..." : "Delete field"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDeleteContentTypeDialogOpen}
        onOpenChange={setIsDeleteContentTypeDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this content type?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Delete "${contentType.name}" and all of its field definitions. This only works while the content type has no entries.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingContentType}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeletingContentType}
              onClick={handleDeleteContentType}
            >
              {isDeletingContentType ? "Deleting..." : "Delete content type"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono font-medium">{value}</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Compact field row — one line per field with optional children below   */
/* ────────────────────────────────────────────────────────────────────── */

const fieldTypeIcon = (type: ContentField["type"]) => {
  switch (type) {
    case "TEXT":
      return TypeIcon;
    case "RICH_TEXT":
      return FileText;
    case "NUMBER":
      return Hash;
    case "BOOLEAN":
      return CheckSquare2;
    case "DATE":
      return Calendar;
    case "DATETIME":
      return CalendarClock;
    case "MEDIA":
      return ImageIcon;
    case "JSON":
      return Braces;
    case "SELECT":
      return ListIcon;
    case "MULTI_SELECT":
      return ListChecks;
    case "RELATION":
      return Link2;
    case "GROUP":
      return Layers;
    default:
      return TypeIcon;
  }
};

/**
 * Schema field "row" — actually a live WYSIWYG preview of how the field
 * will render in the entry editor. Reuses DynamicFieldInput in disabled
 * mode so what editors design is exactly what content creators see.
 * Floating action toolbar appears on hover/focus in the top-right corner.
 */
function FieldRow({
  field,
  siteId,
  isFirst,
  isLast,
  isReordering,
  canManage,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: {
  field: ContentField;
  siteId: string;
  isFirst: boolean;
  isLast: boolean;
  isReordering: boolean;
  canManage: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const Icon = fieldTypeIcon(field.type);
  const typeLabel = formatContentFieldType(field.type);

  return (
    <div className="group relative px-4 py-4 transition-colors hover:bg-muted/20">
      {/* Type chip — small, top-right, never overlapping content. */}
      <div className="pointer-events-none absolute right-3 top-3 z-0 flex items-center gap-1">
        <span
          className={
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider " +
            getContentFieldTypeBadgeClassName(field.type)
          }
        >
          <Icon className="size-3" />
          {typeLabel}
          {field.isList ? " · list" : ""}
        </span>
      </div>

      {/* Live preview of the field — same component editors use, disabled.
          For repeatable groups we inject one empty item so the child shape
          is visible; otherwise editors would just see "No items yet". */}
      <div className="pointer-events-none pr-28 opacity-90">
        <DynamicFieldInput
          field={field}
          value={
            field.type === "GROUP" && field.isList ? [{}] : undefined
          }
          onChange={() => {}}
          disabled
          siteId={siteId}
        />
      </div>

      {/* Floating action toolbar — appears on hover, sits above type chip. */}
      {canManage ? (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-0.5 rounded-md border border-border/60 bg-background/95 p-0.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onMoveUp}
            disabled={isFirst || isReordering}
            aria-label={t("schema.builder.fields.actions.up")}
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onMoveDown}
            disabled={isLast || isReordering}
            aria-label={t("schema.builder.fields.actions.down")}
          >
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            aria-label={t("schema.builder.fields.actions.edit")}
          >
            <Edit3 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
            aria-label={t("schema.builder.fields.actions.delete")}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

