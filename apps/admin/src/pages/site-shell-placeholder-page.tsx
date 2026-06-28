import { Construction } from "lucide-react";

export function SiteShellPlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-3">
      <h1 className="font-serif text-3xl tracking-tight">{title}</h1>
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        <Construction className="size-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">Coming up in step #3</p>
          <p className="mt-0.5 text-xs">
            This page will reuse the existing entries / media / members
            components, scoped to the current site.
          </p>
        </div>
      </div>
    </div>
  );
}
