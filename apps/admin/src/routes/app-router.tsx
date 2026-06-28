import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { AppLoadingScreen } from "@/components/app/app-loading-screen";
import { useAuth } from "@/features/auth/auth-provider";
import { AdminLayout } from "@/layouts/admin-layout";
import { ProfileLayout } from "@/layouts/profile-layout";
import { SiteLayout } from "@/layouts/site-layout";
import { AcceptInvitationPage } from "@/pages/accept-invitation-page";
import { AdminSettingsPage } from "@/pages/admin-settings-page";
import { AdminUsersPage } from "@/pages/admin-users-page";
import { ApiKeysPage } from "@/pages/api-keys-page";
import { AuditLogPage } from "@/pages/audit-log-page";
import { ContentHubPage } from "@/pages/content-hub-page";
import { ContentTypeBuilderPage } from "@/pages/content-type-builder-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { EntriesListPage } from "@/pages/entries-list-page";
import { EntryEditorPage } from "@/pages/entry-editor-page";
import { InvitationsPage } from "@/pages/invitations-page";
import { MediaLibraryPage } from "@/pages/media-library-page";
import { LoginPage } from "@/pages/login-page";
import { PolicyAcceptancePage } from "@/pages/policy-acceptance-page";
import { RegisterPage } from "@/pages/register-page";
import { ProfilePage } from "@/pages/profile-page";
import { GuideGoogleAnalyticsPage } from "@/pages/guide-google-analytics-page";
import { SchemaPage } from "@/pages/schema-page";
import { SiteDetailPage } from "@/pages/site-detail-page";
import { SitePickerPage } from "@/pages/site-picker-page";
import { SiteSettingsPage } from "@/pages/site-settings-page";
import { SiteShellContentTypeApiPage } from "@/pages/site-shell-content-type-api-page";
import { SiteShellMembersPage } from "@/pages/site-shell-members-page";
import { SitesPage } from "@/pages/sites-page";
import { ProtectedRoute } from "./protected-route";
import { RequirePolicyAcceptedRoute } from "./require-policy-accepted-route";
import { RequireSuperAdminRoute } from "./require-super-admin-route";

/* ────────────────────────────────────────────────────────────── */
/* Root redirect                                                  */
/* ────────────────────────────────────────────────────────────── */

function AppFallbackRedirect() {
  const { isAuthenticated, isLoading, requiresPolicyAcceptance, user, memberships } = useAuth();

  if (isLoading) return <AppLoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiresPolicyAcceptance) return <Navigate to="/onboarding/policies" replace />;
  if (user?.isSuperAdmin) return <Navigate to="/admin" replace />;
  if (memberships.length === 1) return <Navigate to={`/s/${memberships[0].siteId}`} replace />;
  return <Navigate to="/sites" replace />;
}

function PolicyOnboardingOutlet() {
  const { isLoading, requiresPolicyAcceptance, user, memberships } = useAuth();

  if (isLoading) return <AppLoadingScreen />;
  if (!requiresPolicyAcceptance) {
    if (user?.isSuperAdmin) return <Navigate to="/admin" replace />;
    if (memberships.length === 1) return <Navigate to={`/s/${memberships[0].siteId}`} replace />;
    return <Navigate to="/sites" replace />;
  }
  return <Outlet />;
}

/* ────────────────────────────────────────────────────────────── */
/* Legacy redirects                                               */
/* /dashboard/* → /admin/* or /s/:siteId/*                        */
/* /app/* → /sites or /s/:siteId/*                                */
/* ────────────────────────────────────────────────────────────── */

function stripSiteIdPrefix(pathname: string): string {
  // Match any of the legacy/admin site-scoped prefixes and return whatever
  // comes after the siteId segment.
  const m = pathname.match(
    /^\/(?:dashboard\/sites|admin\/sites|app|s)\/[^/]+(\/.*)?$/,
  );
  return m?.[1] ?? "";
}

function LegacySiteRedirect() {
  const { siteId } = useParams<{ siteId: string }>();
  const { pathname, search } = useLocation();
  const tail = stripSiteIdPrefix(pathname);
  return <Navigate to={`/s/${siteId}${tail}${search}`} replace />;
}

/* ────────────────────────────────────────────────────────────── */

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/invitations/accept" element={<AcceptInvitationPage />} />

        <Route element={<ProtectedRoute />}>
          {/* Onboarding (policy acceptance) */}
          <Route element={<PolicyOnboardingOutlet />}>
            <Route path="/onboarding/policies" element={<PolicyAcceptancePage />} />
          </Route>

          <Route element={<RequirePolicyAcceptedRoute />}>
            {/* ─────── ADMIN ZONE — platform-level (super admin only) ─────── */}
            <Route element={<RequireSuperAdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<DashboardPage />} />
                <Route path="/admin/sites" element={<SitesPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/audit-log" element={<AuditLogPage />} />
                <Route path="/admin/settings" element={<AdminSettingsPage />} />
              </Route>
              {/* Super admin entering a site → /s/:siteId (impersonate) */}
              <Route
                path="/admin/sites/:siteId"
                element={<LegacySiteRedirect />}
              />
            </Route>

            {/* ─────── SITE WORKSPACE — everyone with membership ─────── */}
            <Route path="/sites" element={<SitePickerPage />} />
            <Route path="/s/:siteId" element={<SiteLayout />}>
              <Route index element={<SiteDetailPage />} />
              <Route path="content" element={<ContentHubPage />} />
              <Route path="content-types/:contentTypeId" element={<ContentTypeBuilderPage />} />
              <Route path="content-types/:contentTypeId/entries" element={<EntriesListPage />} />
              <Route
                path="content-types/:contentTypeId/entries/:entryId"
                element={<EntryEditorPage />}
              />
              <Route path="content-types/:contentTypeId/api" element={<SiteShellContentTypeApiPage />} />
              <Route path="schema" element={<SchemaPage />} />
              <Route path="media" element={<MediaLibraryPage />} />
              <Route path="members" element={<SiteShellMembersPage />} />
              <Route path="invitations" element={<InvitationsPage />} />
              <Route path="api-keys" element={<ApiKeysPage />} />
              <Route path="audit-log" element={<AuditLogPage />} />
              <Route path="settings" element={<SiteSettingsPage />} />
              <Route
                path="guides/google-analytics"
                element={<GuideGoogleAnalyticsPage />}
              />
            </Route>

            {/* Profile */}
            <Route element={<ProfileLayout />}>
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            {/* ─────── Legacy redirects (back-compat) ─────── */}
            <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
            <Route path="/dashboard/sites" element={<Navigate to="/admin/sites" replace />} />
            <Route path="/dashboard/sites/:siteId/*" element={<LegacySiteRedirect />} />
            <Route path="/dashboard/audit-log" element={<Navigate to="/admin/audit-log" replace />} />
            <Route path="/app" element={<Navigate to="/sites" replace />} />
            <Route path="/app/:siteId/*" element={<LegacySiteRedirect />} />
          </Route>
        </Route>

        <Route path="*" element={<AppFallbackRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
