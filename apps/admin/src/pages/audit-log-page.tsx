import { Navigate, useParams } from "react-router-dom";
import { AuditLogViewer } from "@/features/audit/audit-log-viewer";
import { useAuth } from "@/features/auth/auth-provider";

/**
 * Shared audit log page:
 *  - When mounted under /admin/audit-log → global view (super admin).
 *  - When mounted under /s/:siteId/audit-log → site-scoped view (OWNER/ADMIN).
 */
export function AuditLogPage() {
  const { siteId } = useParams<{ siteId?: string }>();
  const { user, memberships } = useAuth();

  if (siteId) {
    const membership = memberships.find((m) => m.siteId === siteId);
    if (
      !user?.isSuperAdmin &&
      membership?.role !== "OWNER" &&
      membership?.role !== "ADMIN"
    ) {
      return <Navigate to={`/s/${siteId}`} replace />;
    }
  } else if (!user?.isSuperAdmin) {
    return <Navigate to="/sites" replace />;
  }

  const subtitle = siteId
    ? "Every change made within this site."
    : "Every mutation across the platform.";

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
          observability
        </p>
        <h1 className="font-serif text-4xl tracking-tight">
          <em className="italic text-(--narah-accent)">Audit log</em>
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
      </header>

      <AuditLogViewer siteId={siteId} />
    </div>
  );
}
