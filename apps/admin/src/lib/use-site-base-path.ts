import { useParams } from "react-router-dom";

/**
 * Returns the URL prefix for the current site workspace: `/s/:siteId`.
 *
 * After the routing unification, both super-admin (impersonating) and
 * regular members use the same `/s/:siteId/*` paths, so this is just
 * a thin wrapper around `useParams`.
 */
export function useSiteBasePath(): string {
  const { siteId } = useParams<{ siteId: string }>();
  return siteId ? `/s/${siteId}` : "";
}
