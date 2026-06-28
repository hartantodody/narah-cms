import {
  AlertCircle,
  FileText,
  Layers,
  Layers3,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ContentTypeFormDialog } from "@/features/content-types/content-type-form-dialog";
import {
  deleteContentType,
  getContentTypes,
} from "@/features/content-types/content-type.api";
import type {
  ContentTypeDetail,
  ContentTypeListItem,
  ContentTypeViewerContext,
} from "@/features/content-types/content-type.types";
import { canManageContentTypes } from "@/features/content-types/content-type.utils";
import { formatSiteDate } from "@/features/sites/site.utils";
import { ApiError, getApiErrorMessage } from "@/lib/api";

type ContentTypesSectionProps = ContentTypeViewerContext & {
  siteId: string;
  onContentTypesChanged?: () => Promise<void> | void;
};

export function ContentTypesSection({
  siteId,
  currentUserRole,
  isSuperAdmin,
  onContentTypesChanged,
}: ContentTypesSectionProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [contentTypes, setContentTypes] = useState<ContentTypeListItem[]>([]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingContentType, setEditingContentType] =
    useState<ContentTypeListItem | null>(null);
  const [deletingContentType, setDeletingContentType] =
    useState<ContentTypeListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = canManageContentTypes({
    isSuperAdmin,
    currentUserRole,
  });

  useEffect(() => {
    let isActive = true;

    async function loadContentTypes() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getContentTypes(siteId, {
          search: deferredSearch,
        });

        if (!isActive) {
          return;
        }

        setContentTypes(response.contentTypes);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          getApiErrorMessage(
            error,
            "We couldn't load this site's content types right now.",
          ),
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadContentTypes();

    return () => {
      isActive = false;
    };
  }, [deferredSearch, siteId]);

  const refreshContentTypes = async () => {
    const response = await getContentTypes(siteId, {
      search: deferredSearch,
    });

    setContentTypes(response.contentTypes);
    await onContentTypesChanged?.();
  };

  const handleContentTypeSaved = async (_contentType: ContentTypeDetail) => {
    await refreshContentTypes();
    setEditingContentType(null);
  };

  const handleDeleteContentType = async () => {
    if (!deletingContentType) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteContentType(siteId, deletingContentType.id);
      await refreshContentTypes();
      setDeletingContentType(null);
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
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="narah-solid-panel rounded-2xl py-0">
        <CardHeader className="border-b border-border/60 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm font-semibold">
                  {t("schema.contentTypes.title")}
                </CardTitle>
                {!canManage ? (
                  <Badge
                    variant="outline"
                    className="border-[var(--narah-border-strong)] bg-white/[0.03] text-[var(--narah-accent-soft)]"
                  >
                    {t("schema.contentTypes.readOnly")}
                  </Badge>
                ) : null}
              </div>
              <CardDescription className="text-xs">
                {t("schema.contentTypes.description")}
              </CardDescription>
            </div>

            <div className="flex w-full flex-col gap-2.5 sm:flex-row lg:w-auto">
              <div className="relative w-full sm:min-w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("schema.contentTypes.searchPlaceholder")}
                  className="h-8 rounded-lg border-border/80 bg-background/50 pl-8 text-xs"
                />
              </div>

              {canManage ? (
                <Button
                  size="lg"
                  className="h-9 rounded-lg bg-primary px-4 text-sm shadow-[0_8px_24px_rgba(124,58,237,0.24)] hover:bg-primary/90"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="size-3.5" />
                  {t("schema.contentTypes.create")}
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-3 pb-2">
          {errorMessage ? (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle />
              <AlertTitle>Unable to load content types</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {isLoading ? (
            <div className="flex min-h-40 items-center justify-center gap-2.5 text-xs text-muted-foreground">
              <Spinner className="size-3.5" />
              Loading content types...
            </div>
          ) : contentTypes.length === 0 ? (
            <div className="narah-muted-surface my-1 flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 px-6 py-8 text-center">
              <div className="flex size-10 items-center justify-center rounded-lg border border-border/60 bg-primary/12 text-[var(--narah-primary-soft)]">
                <Layers3 className="size-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("schema.contentTypes.empty")}</p>
                <p className="max-w-xs text-xs leading-5 text-muted-foreground">
                  {t("schema.contentTypes.emptyHint")}
                </p>
              </div>
              {canManage ? (
                <Button
                  size="sm"
                  className="rounded-lg bg-primary px-4 hover:bg-primary/90"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="size-3.5" />
                  {t("schema.contentTypes.create")}
                </Button>
              ) : null}
            </div>
          ) : (
            <Table className="[&_td]:h-12 [&_th]:text-[0.65rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.16em] [&_th]:text-[var(--narah-text-subtle)]">
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>{t("schema.contentTypes.columns.name")}</TableHead>
                  <TableHead>{t("schema.contentTypes.columns.apiId")}</TableHead>
                  <TableHead>{t("schema.contentTypes.columns.mode")}</TableHead>
                  <TableHead>{t("schema.contentTypes.columns.description")}</TableHead>
                  <TableHead>{t("schema.contentTypes.columns.fields")}</TableHead>
                  <TableHead>{t("schema.contentTypes.columns.entries")}</TableHead>
                  <TableHead>{t("schema.contentTypes.columns.updated")}</TableHead>
                  <TableHead className="w-14 text-right">{t("schema.contentTypes.columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contentTypes.map((contentType) => (
                  <TableRow
                    key={contentType.id}
                    onClick={() =>
                      navigate(`/s/${siteId}/content-types/${contentType.id}`)
                    }
                    className="cursor-pointer border-border/50 hover:bg-white/[0.025]"
                  >
                    <TableCell className="text-sm font-medium">
                      {contentType.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {contentType.apiId}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          contentType.isSingleton
                            ? "gap-1 border-(--narah-accent)/30 bg-(--narah-accent)/10 font-mono text-[0.6rem] uppercase tracking-wider text-(--narah-accent)"
                            : "gap-1 border-primary/30 bg-primary/10 font-mono text-[0.6rem] uppercase tracking-wider text-(--narah-primary-soft)"
                        }
                      >
                        {contentType.isSingleton ? (
                          <FileText className="size-3" />
                        ) : (
                          <Layers className="size-3" />
                        )}
                        {contentType.isSingleton
                          ? t("schema.contentTypes.mode.singleton")
                          : t("schema.contentTypes.mode.collection")}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-56 truncate text-xs text-muted-foreground">
                      {contentType.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{contentType.fieldCount}</TableCell>
                    <TableCell className="text-xs">{contentType.entryCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatSiteDate(contentType.updatedAt)}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            className="rounded-md border-border/70 bg-background/50 hover:bg-background/80"
                          >
                            <MoreHorizontal className="size-3.5" />
                            <span className="sr-only">
                              Open content type actions
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              to={`/s/${siteId}/content-types/${contentType.id}`}
                            >
                              {t("schema.contentTypes.actions.open")}
                            </Link>
                          </DropdownMenuItem>
                          {canManage ? (
                            <DropdownMenuItem
                              onSelect={() => setEditingContentType(contentType)}
                            >
                              {t("schema.contentTypes.actions.edit")}
                            </DropdownMenuItem>
                          ) : null}
                          {canManage ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeletingContentType(contentType)}
                            >
                              <Trash2 className="size-3.5" />
                              {t("schema.contentTypes.actions.delete")}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ContentTypeFormDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        siteId={siteId}
        onSuccess={handleContentTypeSaved}
      />

      <ContentTypeFormDialog
        open={Boolean(editingContentType)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingContentType(null);
          }
        }}
        siteId={siteId}
        contentType={editingContentType}
        onSuccess={handleContentTypeSaved}
      />

      <AlertDialog
        open={Boolean(deletingContentType)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingContentType(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this content type?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingContentType
                ? `Delete "${deletingContentType.name}" and its field definitions. This only works when the content type has no entries yet.`
                : "Delete this content type and its field definitions."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteContentType}
            >
              {isDeleting ? "Deleting..." : "Delete content type"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
