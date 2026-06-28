import { AlertCircle, ArrowLeft, Code2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ApiExplorerPanel } from "@/features/api-explorer/api-explorer-panel";
import { useAuth } from "@/features/auth/auth-provider";
import { getContentType } from "@/features/content-types/content-type.api";
import type { ContentTypeDetail } from "@/features/content-types/content-type.types";
import { getApiErrorMessage } from "@/lib/api";

export function SiteShellContentTypeApiPage() {
  const { siteId, contentTypeId } = useParams<{
    siteId: string;
    contentTypeId: string;
  }>();
  const { user, memberships } = useAuth();

  const [contentType, setContentType] = useState<ContentTypeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId || !contentTypeId) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getContentType(siteId, contentTypeId)
      .then((r) => {
        if (!cancelled) setContentType(r.contentType);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Unable to load this content type."));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId, contentTypeId]);

  if (!siteId || !contentTypeId) return <Navigate to="/sites" replace />;

  const membership = memberships.find((m) => m.siteId === siteId);
  if (
    !user?.isSuperAdmin &&
    membership?.role !== "OWNER" &&
    membership?.role !== "ADMIN"
  ) {
    return <Navigate to={`/s/${siteId}`} replace />;
  }

  return (
    <div className="space-y-6">
      <Link
        to={`/s/${siteId}/content-types/${contentTypeId}/entries`}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to entries
      </Link>

      <header className="space-y-1.5">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
          api reference
        </p>
        <h1 className="font-serif text-4xl tracking-tight">
          <em className="italic text-(--narah-accent)">
            {contentType?.name ?? "Content type"}
          </em>
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Shape your frontend will receive from the public delivery API. Copy the
          TypeScript type or cURL snippet to hand off to FE devs.
        </p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center text-xs text-muted-foreground">
          <Spinner className="size-4" />
        </div>
      ) : contentType ? (
        <div className="rounded-xl border border-border bg-card p-5 shadow-(--narah-shadow-xs)">
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Code2 className="size-3.5" />
            <span>Public delivery API</span>
          </div>
          <ApiExplorerPanel contentType={contentType} />
        </div>
      ) : null}
    </div>
  );
}
