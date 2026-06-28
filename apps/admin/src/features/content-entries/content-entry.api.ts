import { apiFetch } from "@/lib/api";
import type {
  ContentEntryResponse,
  ContentEntryRevisionDetail,
  ContentEntryRevisionListItem,
  CreateContentEntryInput,
  ListContentEntriesQuery,
  ListContentEntriesResponse,
  UpdateContentEntryInput,
} from "./content-entry.types";

const basePath = (siteId: string, contentTypeId: string) =>
  `/sites/${siteId}/content-types/${contentTypeId}/entries`;

export function listContentEntries(
  siteId: string,
  contentTypeId: string,
  query?: ListContentEntriesQuery,
) {
  const params = new URLSearchParams();
  if (query?.search?.trim()) params.set("search", query.search.trim());
  if (query?.status) params.set("status", query.status);
  if (query?.page) params.set("page", String(query.page));
  if (query?.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return apiFetch<ListContentEntriesResponse>(
    qs ? `${basePath(siteId, contentTypeId)}?${qs}` : basePath(siteId, contentTypeId),
  );
}

export const getContentEntry = (
  siteId: string,
  contentTypeId: string,
  entryId: string,
) =>
  apiFetch<ContentEntryResponse>(
    `${basePath(siteId, contentTypeId)}/${entryId}`,
  );

export const createContentEntry = (
  siteId: string,
  contentTypeId: string,
  input: CreateContentEntryInput,
) =>
  apiFetch<ContentEntryResponse>(basePath(siteId, contentTypeId), {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateContentEntry = (
  siteId: string,
  contentTypeId: string,
  entryId: string,
  input: UpdateContentEntryInput,
) =>
  apiFetch<ContentEntryResponse>(
    `${basePath(siteId, contentTypeId)}/${entryId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

export const deleteContentEntry = (
  siteId: string,
  contentTypeId: string,
  entryId: string,
) =>
  apiFetch<{ id: string; deleted: boolean }>(
    `${basePath(siteId, contentTypeId)}/${entryId}`,
    { method: "DELETE" },
  );

export const publishContentEntry = (
  siteId: string,
  contentTypeId: string,
  entryId: string,
) =>
  apiFetch<ContentEntryResponse>(
    `${basePath(siteId, contentTypeId)}/${entryId}/publish`,
    { method: "POST" },
  );

export const unpublishContentEntry = (
  siteId: string,
  contentTypeId: string,
  entryId: string,
) =>
  apiFetch<ContentEntryResponse>(
    `${basePath(siteId, contentTypeId)}/${entryId}/unpublish`,
    { method: "POST" },
  );

export const listContentEntryRevisions = (
  siteId: string,
  contentTypeId: string,
  entryId: string,
) =>
  apiFetch<{ revisions: ContentEntryRevisionListItem[] }>(
    `${basePath(siteId, contentTypeId)}/${entryId}/revisions`,
  );

export const getContentEntryRevision = (
  siteId: string,
  contentTypeId: string,
  entryId: string,
  revisionId: string,
) =>
  apiFetch<{ revision: ContentEntryRevisionDetail }>(
    `${basePath(siteId, contentTypeId)}/${entryId}/revisions/${revisionId}`,
  );

export const restoreContentEntryRevision = (
  siteId: string,
  contentTypeId: string,
  entryId: string,
  revisionId: string,
) =>
  apiFetch<ContentEntryResponse>(
    `${basePath(siteId, contentTypeId)}/${entryId}/revisions/${revisionId}/restore`,
    { method: "POST" },
  );
