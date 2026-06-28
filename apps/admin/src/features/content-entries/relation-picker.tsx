import { AlertCircle, FileQuestion, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { listContentEntries } from "@/features/content-entries/content-entry.api";
import type { ContentEntryListItem } from "@/features/content-entries/content-entry.types";
import {
  contentEntryStatusClass,
  contentEntryStatusLabel,
} from "@/features/content-entries/content-entry.utils";
import { getContentType } from "@/features/content-types/content-type.api";
import type { ContentTypeDetail } from "@/features/content-types/content-type.types";
import { getApiErrorMessage } from "@/lib/api";

export type RelationPickerSelection = {
  id: string;
  slug: string | null;
  contentTypeApiId: string;
};

type RelationPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  /** The content type that entries are picked from (from field.config.contentTypeId). */
  contentTypeId: string;
  onSelect: (selection: RelationPickerSelection) => void;
};

const PAGE_SIZE = 20;

export function RelationPicker({
  open,
  onOpenChange,
  siteId,
  contentTypeId,
  onSelect,
}: RelationPickerProps) {
  const [contentType, setContentType] = useState<ContentTypeDetail | null>(null);
  const [items, setItems] = useState<ContentEntryListItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!siteId || !contentTypeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [ctResp, entriesResp] = await Promise.all([
        getContentType(siteId, contentTypeId),
        listContentEntries(siteId, contentTypeId, {
          search: search.trim() || undefined,
          page: 1,
          pageSize: PAGE_SIZE,
        }),
      ]);
      setContentType(ctResp.contentType);
      setItems(entriesResp.items);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load entries."));
    } finally {
      setIsLoading(false);
    }
  }, [siteId, contentTypeId, search]);

  useEffect(() => {
    if (open) {
      setSelectedId(null);
      void load();
    }
  }, [open, load]);

  const selected = items.find((e) => e.id === selectedId);

  const confirm = () => {
    if (!selected || !contentType) return;
    onSelect({
      id: selected.id,
      slug: selected.slug,
      contentTypeApiId: contentType.apiId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Choose {contentType ? `a ${contentType.name}` : "an entry"}
          </DialogTitle>
          <DialogDescription>
            {contentType ? (
              <>
                Pick one published or draft entry from the{" "}
                <code className="font-mono text-xs">{contentType.apiId}</code>{" "}
                content type.
              </>
            ) : (
              "Loading…"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void load();
              }
            }}
            placeholder="Search by slug…"
            className="h-9 pl-9 text-sm"
          />
        </div>

        {error ? (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="size-4" />
            <AlertTitle className="text-sm">Something went wrong</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-muted/30">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="size-4" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <FileQuestion className="size-6 opacity-40" />
              <p>No entries yet in this content type.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((entry) => {
                const active = entry.id === selectedId;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(entry.id)}
                      onDoubleClick={() => {
                        setSelectedId(entry.id);
                        if (contentType) {
                          onSelect({
                            id: entry.id,
                            slug: entry.slug,
                            contentTypeApiId: contentType.apiId,
                          });
                          onOpenChange(false);
                        }
                      }}
                      className={
                        "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors " +
                        (active
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-accent/60 text-foreground")
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm">
                          {entry.slug ?? (
                            <span className="italic text-muted-foreground">
                              (no slug)
                            </span>
                          )}
                        </p>
                        <p className="text-[0.7rem] text-muted-foreground">
                          v{entry.version} · updated{" "}
                          {new Date(entry.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={contentEntryStatusClass(entry.status)}
                      >
                        {contentEntryStatusLabel(entry.status)}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!selected} onClick={confirm}>
            Use this entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
