import { AlertCircle, ImageIcon, Search, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { ApiError, getApiErrorMessage } from "@/lib/api";
import {
  listMediaAssets,
  uploadMediaAsset,
} from "./media-asset.api";
import type { MediaAsset } from "./media-asset.types";
import { buildAssetUrl, formatBytes, isImageMime } from "./media-asset.utils";

type AssetPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  onSelect: (asset: MediaAsset) => void;
  /** Restrict listing to a MIME prefix, e.g. "image/" */
  mimeTypePrefix?: string;
};

const PAGE_SIZE = 24;

export function AssetPicker({
  open,
  onOpenChange,
  siteId,
  onSelect,
  mimeTypePrefix = "image/",
}: AssetPickerProps) {
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await listMediaAssets(siteId, {
        search: search.trim() || undefined,
        mimeTypePrefix,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      setItems(response.items);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load media."));
    } finally {
      setIsLoading(false);
    }
  }, [siteId, search, mimeTypePrefix]);

  useEffect(() => {
    if (open) {
      setSelectedId(null);
      load();
    }
  }, [open, load]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadMediaAsset(siteId, file);
      }
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(getApiErrorMessage(err, "Upload failed."));
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const selected = items.find((a) => a.id === selectedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-3xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg">Choose an image</DialogTitle>
          <DialogDescription>
            Pick an existing image or upload a new one.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  load();
                }
              }}
              placeholder="Search filenames…"
              className="h-9 pl-9 text-sm"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="size-4" />
            {isUploading ? "Uploading…" : "Upload"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            hidden
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>

        {error ? (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="size-4" />
            <AlertTitle className="text-sm">Something went wrong</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="size-4" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <ImageIcon className="size-6 opacity-40" />
              <p>No images yet. Upload one to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {items.map((asset) => {
                const active = asset.id === selectedId;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedId(asset.id)}
                    onDoubleClick={() => {
                      onSelect(asset);
                      onOpenChange(false);
                    }}
                    className={
                      "group relative aspect-square overflow-hidden rounded-md border bg-background transition-all " +
                      (active
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/40")
                    }
                    title={asset.filename}
                  >
                    {isImageMime(asset.mimeType) ? (
                      <img
                        src={buildAssetUrl(asset.url, { w: 300, q: 70 })}
                        alt={asset.altText ?? asset.filename}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="size-6" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected summary */}
        {selected ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-card p-2 text-xs">
            <div className="flex items-center gap-2 truncate">
              <img
                src={buildAssetUrl(selected.url, { w: 96, q: 70 })}
                alt=""
                className="size-8 rounded object-cover"
              />
              <div className="min-w-0">
                <p className="truncate font-medium">{selected.filename}</p>
                <p className="text-muted-foreground">
                  {formatBytes(selected.sizeBytes)} · {selected.mimeType}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selected}
            onClick={() => {
              if (selected) {
                onSelect(selected);
                onOpenChange(false);
              }
            }}
          >
            Use this image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
