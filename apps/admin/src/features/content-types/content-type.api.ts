import { apiFetch } from "@/lib/api";
import type {
  ContentFieldMutationResponse,
  ContentTypeDetailResponse,
  ContentTypeListResponse,
  CreateContentFieldInput,
  CreateContentTypeInput,
  DeleteContentFieldResponse,
  DeleteContentTypeResponse,
  ReorderContentFieldsResponse,
  ReplaceContentTypeInput,
  UpdateContentFieldInput,
  UpdateContentTypeInput,
} from "./content-type.types";

type GetContentTypesParams = {
  search?: string;
};

export function getContentTypes(siteId: string, params?: GetContentTypesParams) {
  const searchParams = new URLSearchParams();

  if (params?.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }

  const queryString = searchParams.toString();

  return apiFetch<ContentTypeListResponse>(
    queryString
      ? `/sites/${siteId}/content-types?${queryString}`
      : `/sites/${siteId}/content-types`,
  );
}

export const createContentType = (
  siteId: string,
  input: CreateContentTypeInput,
) =>
  apiFetch<ContentTypeDetailResponse>(`/sites/${siteId}/content-types`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getContentType = (siteId: string, contentTypeId: string) =>
  apiFetch<ContentTypeDetailResponse>(
    `/sites/${siteId}/content-types/${contentTypeId}`,
  );

export const updateContentType = (
  siteId: string,
  contentTypeId: string,
  input: UpdateContentTypeInput,
) =>
  apiFetch<ContentTypeDetailResponse>(
    `/sites/${siteId}/content-types/${contentTypeId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

export const deleteContentType = (siteId: string, contentTypeId: string) =>
  apiFetch<DeleteContentTypeResponse>(
    `/sites/${siteId}/content-types/${contentTypeId}`,
    {
      method: "DELETE",
    },
  );

export const createContentField = (
  siteId: string,
  contentTypeId: string,
  input: CreateContentFieldInput,
) =>
  apiFetch<ContentFieldMutationResponse>(
    `/sites/${siteId}/content-types/${contentTypeId}/fields`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

export const updateContentField = (
  siteId: string,
  contentTypeId: string,
  fieldId: string,
  input: UpdateContentFieldInput,
) =>
  apiFetch<ContentFieldMutationResponse>(
    `/sites/${siteId}/content-types/${contentTypeId}/fields/${fieldId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

export const deleteContentField = (
  siteId: string,
  contentTypeId: string,
  fieldId: string,
) =>
  apiFetch<DeleteContentFieldResponse>(
    `/sites/${siteId}/content-types/${contentTypeId}/fields/${fieldId}`,
    {
      method: "DELETE",
    },
  );

/**
 * Replace the entire schema (metadata + fields) atomically. Used by the
 * Code-tab editor. The backend diffs fields by `apiId`.
 */
export const replaceContentTypeSchema = (
  siteId: string,
  contentTypeId: string,
  input: ReplaceContentTypeInput,
) =>
  apiFetch<ContentTypeDetailResponse>(
    `/sites/${siteId}/content-types/${contentTypeId}/schema`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );

export const reorderContentFields = (
  siteId: string,
  contentTypeId: string,
  fieldIds: string[],
) =>
  apiFetch<ReorderContentFieldsResponse>(
    `/sites/${siteId}/content-types/${contentTypeId}/fields/reorder`,
    {
      method: "PATCH",
      body: JSON.stringify({
        fieldIds,
      }),
    },
  );
