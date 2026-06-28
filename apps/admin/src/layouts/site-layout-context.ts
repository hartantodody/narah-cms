import { useOutletContext } from "react-router-dom";
import type { SiteDetail } from "@/features/sites/site.types";

export type SiteRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export type SiteLayoutContextValue = {
  /** Loaded site detail (always present once children render). */
  site: SiteDetail;
  /** Refresh from the API. Use after mutations that affect site metadata. */
  refresh: () => Promise<void>;
  /** Resolved role — for super-admin impersonating, treated as OWNER. */
  effectiveRole: SiteRole;
  /** True when the viewer is super-admin & not a native member. */
  isImpersonating: boolean;
  /** True when the viewer is the platform super admin. */
  isSuperAdmin: boolean;
};

/**
 * Hook for pages rendered inside `<SiteLayout>` to grab the loaded site +
 * refresh fn without re-fetching themselves.
 */
export function useSiteContext(): SiteLayoutContextValue {
  return useOutletContext<SiteLayoutContextValue>();
}
