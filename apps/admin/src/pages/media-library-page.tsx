import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/features/auth/auth-provider";
import { canEditContentEntries } from "@/features/content-entries/content-entry.utils";
import { FocalPointPicker } from "@/features/media-assets/focal-point-picker";
import {
  deleteMediaAsset,
  downloadMediaOriginal,
  listMediaAssets,
  updateMediaAsset,
  uploadMediaAsset,
} from "@/features/media-assets/media-asset.api";
import type {
  FocalPoint,
  MediaAsset,
} from "@/features/media-assets/media-asset.types";
import {
  buildAssetUrl,
  formatBytes,
  isImageMime,
} from "@/features/media-assets/media-asset.utils";
import { getSite } from "@/features/sites/site.api";
import type { SiteDetail } from "@/features/sites/site.types";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { useSiteBasePath } from "@/lib/use-site-base-path";

const PAGE_SIZE = 24;

export function MediaLibraryPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const { user } = useAuth();
  const basePath = useSiteBasePath();

  const [site, setSite] = useState<SiteDetail | null>(null);
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState<MediaAsset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [altText, setAltText] = useState("");
  const [focal, setFocal] = useState<FocalPoint>({ x: 0.5, y: 0.5 });
  const [isSavingAlt, setIsSavingAlt] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canEdit = useMemo(
    () =>
      canEditContentEntries({
        isSuperAdmin: user?.isSuperAdmin ?? false,
        currentUserRole: site?.currentUserRole ?? null,
      }),
    [user?.isSuperAdmin, site?.currentUserRole],
  );

  const load = useCallback(async () => {
    if (!siteId) return;
    setError(null);
    try {
      const response = await listMediaAssets(siteId, {
        search: search.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load media."));
    }
  }, [siteId, search, page]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      if (!siteId) return;
      setIsLoading(true);
      try {
        const siteResp = await getSite(siteId);
        if (cancelled) return;
        setSite(siteResp.site);
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Unable to load site."));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  useEffect(() => {
    if (!isLoading) load();
  }, [isLoading, load]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !siteId) return;
    setIsUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadMediaAsset(siteId, file);
      }
      setPage(1);
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(getApiErrorMessage(err, "Upload failed."));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveAsset = async () => {
    if (!previewing || !siteId) return;
    setIsSavingAlt(true);
    try {
      const { asset } = await updateMediaAsset(siteId, previewing.id, {
        altText: altText.trim() || null,
        focalPoint: focal,
      });
      setPreviewing(asset);
      setItems((prev) => prev.map((a) => (a.id === asset.id ? asset : a)));
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to update asset."));
    } finally {
      setIsSavingAlt(false);
    }
  };

  const handleDownload = async () => {
    if (!previewing || !siteId) return;
    setIsDownloading(true);
    try {
      await downloadMediaOriginal(siteId, previewing.id, previewing.filename);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to download original."));
    } finally {
      setIsDownloading(false);
    }
  };

  const hasChanges =
    previewing !== null &&
    (altText !== (previewing.altText ?? "") ||
      focal.x !== previewing.focalPoint.x ||
      focal.y !== previewing.focalPoint.y);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (!site || !siteId) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Unable to load</AlertTitle>
        <AlertDescription>{error ?? "Site not found."}</AlertDescription>
      </Alert>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Link
          to={basePath}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {user?.isSuperAdmin ? "Back to site" : "Back to dashboard"}
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
              {site.name}
            </p>
            <h1 className="font-serif text-3xl tracking-tight">
              <em className="italic text-(--narah-accent)">Media</em> library
            </h1>
            <p className="text-sm text-muted-foreground">
              Images for your content entries. Drop them in once, reuse anywhere.
            </p>
          </div>

          {canEdit ? (
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="size-4" />
              {isUploading ? "Uploading…" : "Upload"}
            </Button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            hidden
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex justify-end">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search filenames…"
            className="h-9 pl-9 text-sm"
          />
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* Grid */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-20 text-center text-sm text-muted-foreground">
          <ImageIcon className="size-7 opacity-40" />
          <div>
            <p className="font-medium text-foreground">No media yet</p>
            <p className="mt-1 text-xs">
              {canEdit
                ? "Upload an image to get started."
                : "Ask an admin to upload images."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => {
                setPreviewing(asset);
                setAltText(asset.altText ?? "");
                setFocal(asset.focalPoint);
              }}
              className="group overflow-hidden rounded-lg border border-border bg-card text-left transition-all hover:border-primary/40 hover:shadow-(--narah-shadow-md)"
            >
              <div className="relative aspect-square overflow-hidden bg-muted">
                {isImageMime(asset.mimeType) ? (
                  <img
                    src={buildAssetUrl(asset.url, { w: 400, q: 70 })}
                    alt={asset.altText ?? asset.filename}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="size-6" />
                  </div>
                )}
              </div>
              <div className="space-y-0.5 px-2.5 py-2">
                <p className="truncate text-xs font-medium">{asset.filename}</p>
                <p className="font-mono text-[0.65rem] text-muted-foreground">
                  {formatBytes(asset.sizeBytes)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {total} assets
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

      {/* Preview / edit dialog */}
      <Dialog
        open={previewing !== null}
        onOpenChange={(open) => !open && setPreviewing(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          {previewing ? (
            <>
              <DialogHeader>
                <DialogTitle className="truncate">
                  {previewing.filename}
                </DialogTitle>
                <DialogDescription className="font-mono text-xs">
                  Uploaded by{" "}
                  {previewing.uploadedBy.name || previewing.uploadedBy.email}
                  {" · "}
                  {new Date(previewing.createdAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <FocalPointPicker
                src={buildAssetUrl(previewing.url, { w: 1200, q: 80 })}
                alt={previewing.altText ?? previewing.filename}
                value={focal}
                onChange={setFocal}
                disabled={!canEdit}
                className="max-h-[55vh]"
              />

              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="alt-text" className="text-xs font-medium">
                    Alt text
                  </Label>
                  <Input
                    id="alt-text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="Describe the image for accessibility"
                    disabled={!canEdit}
                  />
                </div>
                <p className="font-mono text-[0.65rem] text-muted-foreground sm:text-right">
                  Focal: {Math.round(focal.x * 100)}% · {Math.round(focal.y * 100)}%
                  <br />
                  {previewing.width && previewing.height
                    ? `${previewing.width}×${previewing.height}`
                    : "?"}{" "}
                  · {formatBytes(previewing.sizeBytes)}
                </p>
              </div>

              <p className="text-[0.7rem] text-muted-foreground">
                Click the image to set the focal point. Used when a consumer
                requests a crop (e.g. <code>?fit=cover</code>) to keep the
                important part of the image visible.
              </p>

              <DialogFooter className="flex-row justify-between sm:justify-between">
                <div className="flex gap-1">
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      onClick={() => setDeleting(previewing)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Download className="size-4" />
                    {isDownloading ? "Preparing…" : "Original"}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPreviewing(null)}>
                    Close
                  </Button>
                  {canEdit ? (
                    <Button
                      onClick={handleSaveAsset}
                      disabled={isSavingAlt || !hasChanges}
                    >
                      {isSavingAlt ? "Saving…" : "Save"}
                    </Button>
                  ) : null}
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the file from storage and the database.
              Any content entry already referencing it by URL will break.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleting || !siteId) return;
                setIsDeleting(true);
                try {
                  await deleteMediaAsset(siteId, deleting.id);
                  setDeleting(null);
                  setPreviewing(null);
                  await load();
                } catch (err) {
                  setError(getApiErrorMessage(err, "Unable to delete asset."));
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
