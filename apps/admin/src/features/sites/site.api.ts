import { apiFetch } from "@/lib/api";
import type {
  ArchiveSiteResponse,
  CreateSiteInput,
  RecentEntriesResponse,
  SiteDetailResponse,
  SiteListResponse,
  UpdateSiteInput,
} from "./site.types";

type GetSitesParams = {
  includeArchived?: boolean;
  search?: string;
};

export function getSites(params?: GetSitesParams) {
  const searchParams = new URLSearchParams();

  if (params?.includeArchived) {
    searchParams.set("includeArchived", "true");
  }

  if (params?.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }

  const queryString = searchParams.toString();

  return apiFetch<SiteListResponse>(
    queryString ? `/sites?${queryString}` : "/sites",
  );
}

export const createSite = (input: CreateSiteInput) =>
  apiFetch<SiteDetailResponse>("/sites", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getSite = (siteId: string) =>
  apiFetch<SiteDetailResponse>(`/sites/${siteId}`);

export const updateSite = (siteId: string, input: UpdateSiteInput) =>
  apiFetch<SiteDetailResponse>(`/sites/${siteId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const archiveSite = (siteId: string) =>
  apiFetch<ArchiveSiteResponse>(`/sites/${siteId}`, {
    method: "DELETE",
  });

export const getRecentEntries = (siteId: string, limit = 10) =>
  apiFetch<RecentEntriesResponse>(
    `/sites/${siteId}/recent-entries?limit=${limit}`,
  );
