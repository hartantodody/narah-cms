import type { LucideIcon } from "lucide-react";

type ComingSoonPanelProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function ComingSoonPanel({
  icon: Icon,
  title,
  description,
}: ComingSoonPanelProps) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-foreground/2 p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-foreground/10 text-foreground dark:bg-white/10">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium">{title}</h2>
            <span className="rounded-md bg-foreground/10 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground dark:bg-white/10">
              soon
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
