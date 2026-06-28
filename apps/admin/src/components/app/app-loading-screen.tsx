import { Spinner } from "@/components/ui/spinner";

type AppLoadingScreenProps = {
  title?: string;
  description?: string;
};

export function AppLoadingScreen({
  title = "Loading Narah CMS",
  description = "Preparing your workspace.",
}: AppLoadingScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-(--narah-shadow-sm)">
        <div className="grid size-10 place-items-center rounded-full border border-border bg-muted">
          <Spinner className="size-4" />
        </div>
        <div className="space-y-1">
          <h1 className="text-sm font-semibold">{title}</h1>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </main>
  );
}
