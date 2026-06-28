import { ApiKeysSection } from "@/features/api-keys/api-keys-section";
import { useSiteContext } from "@/layouts/site-layout-context";

export function ApiKeysPage() {
  const { site, effectiveRole, isSuperAdmin } = useSiteContext();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          site / api keys
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Issue scoped keys for headless clients. Keys are shown once at
          creation — store them safely.
        </p>
      </header>

      <ApiKeysSection
        siteId={site.id}
        currentUserRole={effectiveRole}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
