import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror from "@uiw/react-codemirror";
import { AlertCircle, Check, Copy, RotateCcw, Save } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { replaceContentTypeSchema } from "@/features/content-types/content-type.api";
import type {
  ContentTypeDetail,
  ReplaceContentTypeInput,
} from "@/features/content-types/content-type.types";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Serialize a content type into the editor-friendly JSON shape — strips
 * server-managed fields (`id`, `createdAt`, `updatedAt`, `sortOrder`) so
 * the editor focuses on what the user actually authors. Field order is
 * implicit via array position.
 */
function serializeForEditor(contentType: ContentTypeDetail): ReplaceContentTypeInput {
  return {
    name: contentType.name,
    apiId: contentType.apiId,
    description: contentType.description,
    isSingleton: contentType.isSingleton,
    fields: contentType.fields
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((f) => ({
        label: f.label,
        apiId: f.apiId,
        type: f.type,
        description: f.description,
        required: f.required,
        localized: f.localized,
        isList: f.isList,
        config: f.config,
        validation: f.validation,
        defaultValue: f.defaultValue,
      })),
  };
}

type SchemaCodeEditorProps = {
  siteId: string;
  contentTypeId: string;
  contentType: ContentTypeDetail;
  canManage: boolean;
  onApplied: (next: ContentTypeDetail) => void;
};

export function SchemaCodeEditor({
  siteId,
  contentTypeId,
  contentType,
  canManage,
  onApplied,
}: SchemaCodeEditorProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // The "baseline" JSON is whatever the server currently has. The editor
  // starts from this, and "Reset" returns to it.
  const baseline = useMemo(() => serializeForEditor(contentType), [contentType]);
  const baselineJson = useMemo(
    () => JSON.stringify(baseline, null, 2),
    [baseline],
  );

  const [value, setValue] = useState(baselineJson);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitIssues, setSubmitIssues] = useState<string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  // Reset editor when the underlying content type changes (e.g. after a
  // Visual-tab edit applied via individual API calls).
  const lastBaselineRef = useRef(baselineJson);
  useEffect(() => {
    if (baselineJson !== lastBaselineRef.current) {
      setValue(baselineJson);
      lastBaselineRef.current = baselineJson;
      setSubmitError(null);
      setSubmitIssues(null);
    }
  }, [baselineJson]);

  // Live-validate JSON on each keystroke (cheap — local parse only).
  useEffect(() => {
    if (value.trim() === "") {
      setParseError("Schema cannot be empty.");
      return;
    }
    try {
      JSON.parse(value);
      setParseError(null);
    } catch (e) {
      setParseError(
        e instanceof Error ? e.message : "Invalid JSON",
      );
    }
  }, [value]);

  const isDirty = value !== baselineJson;
  const canSubmit = canManage && isDirty && !parseError && !submitting;

  const handleApply = async () => {
    if (parseError) return;
    let parsed: ReplaceContentTypeInput;
    try {
      parsed = JSON.parse(value) as ReplaceContentTypeInput;
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitIssues(null);

    try {
      const response = await replaceContentTypeSchema(
        siteId,
        contentTypeId,
        parsed,
      );
      onApplied(response.contentType);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1500);
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message);
        setSubmitIssues(error.issues ?? null);
      } else {
        setSubmitError(getApiErrorMessage(error, "We couldn't apply this schema."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setValue(baselineJson);
    setSubmitError(null);
    setSubmitIssues(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setJustCopied(true);
      window.setTimeout(() => setJustCopied(false), 1500);
    } catch {
      // Silent — clipboard permissions can fail in headless contexts.
    }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs text-muted-foreground">
          Edit the schema as JSON. Field diff key:{" "}
          <code className="rounded bg-foreground/10 px-1 font-mono text-[0.7rem] dark:bg-white/10">
            apiId
          </code>
          . Removing a field deletes it; new <code className="rounded bg-foreground/10 px-1 font-mono text-[0.7rem] dark:bg-white/10">apiId</code> creates it.
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleCopy}
          >
            {justCopied ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleReset}
            disabled={!isDirty || submitting}
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
          {canManage ? (
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleApply}
              disabled={!canSubmit}
            >
              {submitting ? (
                <>
                  <Spinner className="size-3.5" />
                  Applying…
                </>
              ) : justSaved ? (
                <>
                  <Check className="size-3.5" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  Apply changes
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Editor */}
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-foreground/2 dark:bg-white/2",
          parseError ? "border-destructive/40" : "border-border/60",
        )}
      >
        <CodeMirror
          value={value}
          height="500px"
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            indentOnInput: true,
          }}
          extensions={[json()]}
          theme={isDark ? oneDark : "light"}
          editable={canManage}
          onChange={setValue}
        />
      </div>

      {/* Footer status row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <StatusIndicator
          parseError={parseError}
          dirty={isDirty}
          justSaved={justSaved}
        />
        <span className="text-muted-foreground">
          {value.length.toLocaleString()} chars
        </span>
      </div>

      {/* Submit-time errors (from backend) */}
      {submitError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Unable to apply schema</AlertTitle>
          <AlertDescription>
            <p>{submitError}</p>
            {submitIssues && submitIssues.length > 0 ? (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
                {submitIssues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function StatusIndicator({
  parseError,
  dirty,
  justSaved,
}: {
  parseError: string | null;
  dirty: boolean;
  justSaved: boolean;
}) {
  if (parseError) {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <AlertCircle className="size-3" />
        Invalid JSON: {parseError}
      </span>
    );
  }
  if (justSaved) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <Check className="size-3" />
        Saved
      </span>
    );
  }
  if (dirty) {
    return <span className="text-muted-foreground">Unsaved changes</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
      <Check className="size-3" />
      In sync with server
    </span>
  );
}
