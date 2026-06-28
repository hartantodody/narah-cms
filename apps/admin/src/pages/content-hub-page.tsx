import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, FileText, Shapes } from "lucide-react";
import { getContentTypes } from "@/features/content-types/content-type.api";
import type { ContentTypeListItem } from "@/features/content-types/content-type.types";
import { cn } from "@/lib/utils";

/**
 * Content hub — landing page for the "Content" sidebar item.
 * Lists every content type as a card so editors can jump straight into
 * entries. The schema-editing flow stays under the Configure → Schema menu.
 */
export function ContentHubPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const { t } = useTranslation();
  const [items, setItems] = useState<ContentTypeListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    setLoading(true);
    getContentTypes(siteId)
      .then((r) => {
        if (!cancelled) setItems(r.contentTypes);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          {t("content.hub.breadcrumb")}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {t("content.hub.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("content.hub.description")}
        </p>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border/40 bg-foreground/3"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-foreground/2 p-10 text-center">
          <p className="text-sm font-medium">{t("content.hub.empty")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("content.hub.emptyHint")}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ct) => (
            <Link
              key={ct.id}
              to={`/s/${siteId}/content-types/${ct.id}/entries`}
              className={cn(
                "group rounded-xl border border-border/40 bg-foreground/2 p-4 transition-colors",
                "hover:border-border hover:bg-foreground/5 dark:hover:bg-white/5",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground/10 text-foreground dark:bg-white/10">
                    {ct.isSingleton ? (
                      <FileText className="size-4" />
                    ) : (
                      <Shapes className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{ct.name}</p>
                    <p className="truncate font-mono text-[0.65rem] text-muted-foreground">
                      {ct.apiId}
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-3 flex items-center gap-3 text-[0.7rem] text-muted-foreground">
                <span>
                  {ct.isSingleton
                    ? t("content.hub.singleton")
                    : t("content.hub.collection")}
                </span>
                <span>·</span>
                <span>{t("content.hub.entry", { count: ct.entryCount })}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
