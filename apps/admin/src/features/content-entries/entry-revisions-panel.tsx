import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { listContentEntryRevisions } from "@/features/content-entries/content-entry.api";
import type { ContentEntryRevisionListItem } from "@/features/content-entries/content-entry.types";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  siteId: string;
  contentTypeId: string;
  entryId: string;
  // Bumped by the parent after any save/publish so we refetch the list.
  reloadKey: number;
  // Highlighted row when the editor is previewing one of these revisions.
  activeRevisionId: string | null;
  onSelect: (rev: ContentEntryRevisionListItem) => void;
};

export function EntryRevisionsPanel({
  siteId,
  contentTypeId,
  entryId,
  reloadKey,
  activeRevisionId,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const [revisions, setRevisions] = useState<ContentEntryRevisionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    listContentEntryRevisions(siteId, contentTypeId, entryId)
      .then((res) => {
        if (!active) return;
        setRevisions(res.revisions);
      })
      .catch((err) => {
        if (!active) return;
        setError(getApiErrorMessage(err, t("content.editor.revisions.errorLoad")));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [siteId, contentTypeId, entryId, reloadKey, t]);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-(--narah-shadow-xs)">
      <div className="flex items-center gap-2">
        <History className="size-3.5 text-muted-foreground" />
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
          {t("content.editor.revisions.title")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner className="size-3" />
          {t("common.loading")}
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : revisions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("content.editor.revisions.empty")}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {revisions.map((rev) => {
            const isActive = activeRevisionId === rev.id;
            return (
              <li key={rev.id}>
                <button
                  type="button"
                  onClick={() => onSelect(rev)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition",
                    isActive
                      ? "border-(--narah-accent)/40 bg-(--narah-accent)/10"
                      : "border-border/60 bg-background/40 hover:border-border hover:bg-background/70",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs">
                      v{rev.version}
                      <span className="ml-2 text-muted-foreground">
                        {new Date(rev.createdAt).toLocaleString()}
                      </span>
                    </p>
                    <p className="truncate text-[0.65rem] text-muted-foreground">
                      {t("content.editor.revisions.by")}{" "}
                      {rev.author.name || rev.author.email}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "font-mono text-[0.6rem] uppercase tracking-wider",
                      isActive
                        ? "text-(--narah-accent)"
                        : "text-muted-foreground",
                    )}
                  >
                    {isActive
                      ? t("content.editor.revisions.viewing")
                      : t("content.editor.revisions.view")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[0.65rem] text-muted-foreground">
        {t("content.editor.revisions.footer")}
      </p>
    </div>
  );
}
