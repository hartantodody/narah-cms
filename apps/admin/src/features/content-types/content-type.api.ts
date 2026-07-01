import { apiFetch } from "@/lib/api";
import type {
  ContentFieldMutationResponse,
  ContentFieldType,
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

export type FieldImpactProposal = {
  apiId?: string;
  type?: ContentFieldType;
  required?: boolean;
  isList?: boolean;
  deleted?: boolean;
};

export type FieldImpactAnalysis = {
  totalEntries: number;
  entriesWithValue: number;
  entriesAtRisk: number;
  sample: Array<{
    id: string;
    slug: string | null;
    status: string;
    hasValue: boolean;
    willLoseData: boolean;
  }>;
  blockingReason: string | null;
};

/**
 * Ask the API what damage a proposed schema change would do BEFORE we
 * commit it. The admin renders a confirm modal off the response so the
 * user can back out if too many entries would lose data.
 */
export const analyzeContentFieldChange = (
  siteId: string,
  contentTypeId: string,
  fieldId: string,
  proposal: FieldImpactProposal,
) =>
  apiFetch<{ analysis: FieldImpactAnalysis }>(
    `/sites/${siteId}/content-types/${contentTypeId}/fields/${fieldId}/impact-analysis`,
    {
      method: "POST",
      body: JSON.stringify(proposal),
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
