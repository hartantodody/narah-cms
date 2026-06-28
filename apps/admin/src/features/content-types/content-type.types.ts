import type { SiteRole } from "@/features/sites/site.types";

export type ContentFieldType =
  | "TEXT"
  | "RICH_TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "DATE"
  | "DATETIME"
  | "MEDIA"
  | "JSON"
  | "SELECT"
  | "MULTI_SELECT"
  | "RELATION";

export type ContentField = {
  id: string;
  label: string;
  apiId: string;
  type: ContentFieldType;
  description: string | null;
  required: boolean;
  localized: boolean;
  isList: boolean;
  sortOrder: number;
  config: Record<string, unknown> | null;
  validation: Record<string, unknown> | null;
  defaultValue: unknown | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentTypeListItem = {
  id: string;
  name: string;
  apiId: string;
  description: string | null;
  isSingleton: boolean;
  fieldCount: number;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ContentTypeDetail = {
  id: string;
  name: string;
  apiId: string;
  description: string | null;
  isSingleton: boolean;
  fields: ContentField[];
  createdAt: string;
  updatedAt: string;
};

export type ContentTypeListResponse = {
  contentTypes: ContentTypeListItem[];
};

export type ContentTypeDetailResponse = {
  contentType: ContentTypeDetail;
};

export type ContentFieldMutationResponse = {
  field: ContentField;
};

export type DeleteContentTypeResponse = {
  ok: boolean;
};

export type DeleteContentFieldResponse = {
  ok: boolean;
};

export type ReorderContentFieldsResponse = {
  ok: boolean;
};

export type CreateContentTypeInput = {
  name: string;
  apiId?: string;
  description?: string | null;
  isSingleton?: boolean;
};

export type UpdateContentTypeInput = {
  name?: string;
  apiId?: string;
  description?: string | null;
  isSingleton?: boolean;
};

export type CreateContentFieldInput = {
  label: string;
  apiId?: string;
  type: ContentFieldType;
  description?: string | null;
  required?: boolean;
  localized?: boolean;
  isList?: boolean;
  sortOrder?: number;
  config?: Record<string, unknown> | null;
  validation?: Record<string, unknown> | null;
  defaultValue?: unknown | null;
};

export type UpdateContentFieldInput = {
  label?: string;
  apiId?: string;
  type?: ContentFieldType;
  description?: string | null;
  required?: boolean;
  localized?: boolean;
  isList?: boolean;
  sortOrder?: number;
  config?: Record<string, unknown> | null;
  validation?: Record<string, unknown> | null;
  defaultValue?: unknown | null;
};

export type ReorderContentFieldsInput = {
  fieldIds: string[];
};

/**
 * Payload for `PUT /sites/:siteId/content-types/:contentTypeId/schema`.
 * Used by the Code-tab editor — replaces the entire schema atomically.
 * Backend diffs fields by `apiId`: matching → update, new → create,
 * absent → delete.
 */
export type ReplaceContentTypeInput = {
  name: string;
  apiId?: string;
  description?: string | null;
  isSingleton?: boolean;
  fields: Array<{
    label: string;
    apiId: string;
    type: ContentFieldType;
    description?: string | null;
    required?: boolean;
    localized?: boolean;
    isList?: boolean;
    config?: Record<string, unknown> | null;
    validation?: Record<string, unknown> | null;
    defaultValue?: unknown | null;
  }>;
};

export type ContentTypeViewerContext = {
  isSuperAdmin: boolean;
  currentUserRole: SiteRole | null;
};
