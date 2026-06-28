import { Check, Code2, Copy, FileJson, Terminal } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ContentTypeDetail } from "@/features/content-types/content-type.types";
import { apiBaseUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  buildListSample,
  buildSingleEntrySample,
  generateCurl,
  generateTypeScript,
} from "./sample-generators";

type Variant = "list" | "single";

export function ApiExplorerPanel({
  contentType,
}: {
  contentType: ContentTypeDetail;
}) {
  const [variant, setVariant] = useState<Variant>(
    contentType.isSingleton ? "single" : "list",
  );
  const [populate, setPopulate] = useState(false);

  const samplePopulated = useMemo(
    () =>
      variant === "list"
        ? buildListSample(contentType, "populated")
        : buildSingleEntrySample(contentType, "populated"),
    [contentType, variant],
  );

  const sampleRaw = useMemo(
    () =>
      variant === "list"
        ? buildListSample(contentType, "raw")
        : buildSingleEntrySample(contentType, "raw"),
    [contentType, variant],
  );

  const sampleJson = JSON.stringify(populate ? samplePopulated : sampleRaw, null, 2);

  const endpointPath =
    variant === "list"
      ? `/public/v1/content-types/${contentType.apiId}/entries`
      : `/public/v1/content-types/${contentType.apiId}/entries/{slug}`;
  const endpointFull = `${apiBaseUrl}${endpointPath}${populate ? "?populate=*" : ""}`;

  const tsSource = useMemo(
    () => generateTypeScript(contentType, populate),
    [contentType, populate],
  );

  const curlSource = useMemo(
    () =>
      generateCurl({
        apiBase: apiBaseUrl,
        contentTypeApiId: contentType.apiId,
        variant,
        slug: "example-slug",
        populate,
      }),
    [contentType, variant, populate],
  );

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs">
          {(["list", "single"] as Variant[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVariant(v)}
              className={cn(
                "rounded px-2.5 py-1 transition-colors",
                variant === v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "list" ? "List" : "Single (by slug)"}
            </button>
          ))}
        </div>

        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs">
          <input
            type="checkbox"
            checked={populate}
            onChange={(e) => setPopulate(e.target.checked)}
            className="accent-(--narah-accent)"
          />
          <span>?populate=*</span>
        </label>

        <code className="ml-auto truncate rounded-md border border-border bg-muted px-2.5 py-1 font-mono text-[0.7rem] text-muted-foreground">
          GET {endpointFull}
        </code>
      </div>

      <Tabs defaultValue="response" className="w-full">
        <TabsList>
          <TabsTrigger value="response" className="gap-1.5">
            <FileJson className="size-3.5" />
            Response
          </TabsTrigger>
          <TabsTrigger value="typescript" className="gap-1.5">
            <Code2 className="size-3.5" />
            TypeScript
          </TabsTrigger>
          <TabsTrigger value="curl" className="gap-1.5">
            <Terminal className="size-3.5" />
            cURL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="response" className="mt-3">
          <CodeBlock code={sampleJson} language="json" />
        </TabsContent>

        <TabsContent value="typescript" className="mt-3">
          <CodeBlock code={tsSource} language="typescript" />
          <p className="mt-2 text-xs text-muted-foreground">
            Copy-paste into your frontend repo. The shape changes when{" "}
            <code className="font-mono text-[0.7rem]">populate=*</code> is
            toggled.
          </p>
        </TabsContent>

        <TabsContent value="curl" className="mt-3">
          <CodeBlock code={curlSource} language="bash" />
          <p className="mt-2 text-xs text-muted-foreground">
            Replace <code className="font-mono text-[0.7rem]">YOUR_API_KEY</code>{" "}
            with a key from the API Keys section. Public delivery is read-only
            and only returns PUBLISHED entries.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-1.5">
        <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
          {language}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 gap-1.5 text-[0.7rem] text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="size-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3" />
              Copy
            </>
          )}
        </Button>
      </div>
      <pre className="max-h-[420px] overflow-auto p-4 font-mono text-[0.7rem] leading-5">
        <code>{code}</code>
      </pre>
    </div>
  );
}
