import { Navigate } from "react-router-dom";
import { SiteMembersSection } from "@/features/site-members/site-members-section";
import { useSiteContext } from "@/layouts/site-layout-context";

export function SiteShellMembersPage() {
  const { site, refresh, effectiveRole, isSuperAdmin } = useSiteContext();

  // Only OWNER / ADMIN (or super admin impersonating) can view this page.
  if (effectiveRole !== "OWNER" && effectiveRole !== "ADMIN") {
    return <Navigate to={`/s/${site.id}`} replace />;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          site / members
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Manage who can access this site and what role they hold.
        </p>
      </header>

      <SiteMembersSection
        siteId={site.id}
        currentUserRole={effectiveRole}
        isSuperAdmin={isSuperAdmin}
        onMembersChanged={refresh}
      />
    </div>
  );
}
