export type SiteStatus = "ACTIVE" | "DISABLED" | "ARCHIVED";
export type SiteRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export type SiteListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: SiteStatus;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
};

export type SiteDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: SiteStatus;
  createdAt: string;
  updatedAt: string;
  currentUserRole: SiteRole | null;
  memberCount: number;
  contentTypeCount: number;
  entryCount: number;
  mediaAssetCount: number;
  totalMediaBytes: number;
};

export type RecentEntrySummary = {
  id: string;
  slug: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: string;
  publishedAt: string | null;
  contentType: { id: string; name: string; apiId: string };
  updatedBy: { id: string; name: string | null; email: string };
};

export type RecentEntriesResponse = {
  entries: RecentEntrySummary[];
};

export type SiteListResponse = {
  sites: SiteListItem[];
};

export type SiteDetailResponse = {
  site: SiteDetail;
};

export type CreateSiteInput = {
  name: string;
  slug?: string;
  description?: string | null;
};

export type UpdateSiteInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  status?: SiteStatus;
};

export type ArchiveSiteResponse = {
  ok: boolean;
};
