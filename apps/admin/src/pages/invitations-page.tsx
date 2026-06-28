import { SiteInvitationsSection } from "@/features/site-invitations/site-invitations-section";
import { useSiteContext } from "@/layouts/site-layout-context";

export function InvitationsPage() {
  const { site, effectiveRole, isSuperAdmin } = useSiteContext();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          site / invitations
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Invitations</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pending invites to join this site. Revoke or resend at any time.
        </p>
      </header>

      <SiteInvitationsSection
        siteId={site.id}
        currentUserRole={effectiveRole}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
