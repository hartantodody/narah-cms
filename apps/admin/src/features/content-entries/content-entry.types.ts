export type ContentEntryStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type UserSummary = {
  id: string;
  name: string;
  email: string;
};

export type ContentEntryListItem = {
  id: string;
  slug: string | null;
  status: ContentEntryStatus;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserSummary;
  updatedBy: UserSummary;
};

export type ContentEntryDetail = {
  id: string;
  siteId: string;
  contentTypeId: string;
  slug: string | null;
  status: ContentEntryStatus;
  data: Record<string, unknown>;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserSummary;
  updatedBy: UserSummary;
};

export type ListContentEntriesResponse = {
  items: ContentEntryListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ContentEntryResponse = {
  entry: ContentEntryDetail;
};

export type CreateContentEntryInput = {
  data: Record<string, unknown>;
  slug?: string | null;
  status?: ContentEntryStatus;
};

export type UpdateContentEntryInput = {
  data?: Record<string, unknown>;
  slug?: string | null;
  status?: ContentEntryStatus;
};

export type ListContentEntriesQuery = {
  search?: string;
  status?: ContentEntryStatus;
  page?: number;
  pageSize?: number;
};

export type ContentEntryRevisionListItem = {
  id: string;
  entryId: string;
  version: number;
  status: ContentEntryStatus;
  createdAt: string;
  author: UserSummary;
};

export type ContentEntryRevisionDetail = ContentEntryRevisionListItem & {
  data: Record<string, unknown>;
};
