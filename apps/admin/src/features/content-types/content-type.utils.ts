import type {
  ContentField,
  ContentFieldType,
  ContentTypeViewerContext,
} from "./content-type.types";

export function canManageContentTypes({
  isSuperAdmin,
  currentUserRole,
}: ContentTypeViewerContext) {
  return (
    isSuperAdmin ||
    currentUserRole === "OWNER" ||
    currentUserRole === "ADMIN"
  );
}

export function formatContentFieldType(type: ContentFieldType) {
  return type.replaceAll("_", " ");
}

export function getContentFieldTypeBadgeClassName(type: ContentFieldType) {
  switch (type) {
    case "TEXT":
    case "RICH_TEXT":
      return "border-transparent bg-primary/14 text-[var(--narah-primary-soft)]";
    case "NUMBER":
    case "BOOLEAN":
    case "DATE":
    case "DATETIME":
      return "border-transparent bg-[var(--narah-accent-muted)] text-[var(--narah-accent-soft)]";
    case "MEDIA":
    case "RELATION":
      return "border-border/80 bg-white/[0.03] text-foreground";
    case "JSON":
    case "SELECT":
    case "MULTI_SELECT":
      return "border-border/80 bg-background/50 text-muted-foreground";
    default:
      return "";
  }
}

export function buildOptionValue(label: string) {
  const normalized = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "option";
}

export function getFieldOptionsText(field: ContentField) {
  const rawOptions = field.config?.options;

  if (!Array.isArray(rawOptions)) {
    return "";
  }

  return rawOptions
    .map((option) => {
      if (typeof option === "string") {
        return option;
      }

      if (
        typeof option === "object" &&
        option !== null &&
        "label" in option &&
        typeof option.label === "string"
      ) {
        return option.label;
      }

      if (
        typeof option === "object" &&
        option !== null &&
        "value" in option &&
        typeof option.value === "string"
      ) {
        return option.value;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export function getFieldRelationContentTypeId(field: ContentField) {
  const relatedContentTypeId = field.config?.contentTypeId;

  return typeof relatedContentTypeId === "string" ? relatedContentTypeId : "";
}

export function getAdditionalConfigJson(field: ContentField) {
  if (!field.config || typeof field.config !== "object") {
    return "";
  }

  const nextConfig = { ...field.config };
  delete nextConfig.options;
  delete nextConfig.contentTypeId;

  return Object.keys(nextConfig).length > 0
    ? JSON.stringify(nextConfig, null, 2)
    : "";
}

export function getValidationJson(field: ContentField) {
  if (!field.validation || typeof field.validation !== "object") {
    return "";
  }

  return JSON.stringify(field.validation, null, 2);
}

export function getValidationObject(
  field: ContentField | null | undefined,
): Record<string, unknown> | null {
  if (!field?.validation || typeof field.validation !== "object") {
    return null;
  }

  return field.validation as Record<string, unknown>;
}

/**
 * Validation rules the server actually enforces, per field type.
 * Keep in sync with `validateScalar` in
 * `apps/api/src/modules/sites/content-entries.service.ts`.
 */
export type ValidationRuleKey =
  | "minLength"
  | "maxLength"
  | "pattern"
  | "min"
  | "max"
  | "integer";

export const VALIDATION_RULES_BY_TYPE: Partial<
  Record<ContentFieldType, ValidationRuleKey[]>
> = {
  TEXT: ["minLength", "maxLength", "pattern"],
  NUMBER: ["min", "max", "integer"],
};
