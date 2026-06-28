import { Settings } from "lucide-react";
import { ComingSoonPanel } from "@/components/app/coming-soon-panel";

export function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          platform / settings
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Platform settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rate limits, storage backend, default policies. Affects every site on the platform.
        </p>
      </div>

      <ComingSoonPanel
        icon={Settings}
        title="Platform configuration"
        description="Global toggles and limits will live here. For now the platform runs on the defaults defined in `apps/api/src/config/env.ts`."
      />
    </div>
  );
}
