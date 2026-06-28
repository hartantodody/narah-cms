import type {
  ContentField,
  ContentFieldType,
  ContentTypeDetail,
} from "@/features/content-types/content-type.types";

/* ────────────────────────────────────────────────────────────── *
 *  Sample JSON generation                                        *
 * ────────────────────────────────────────────────────────────── */

type SampleMode = "raw" | "populated";

const sampleScalar = (type: ContentFieldType): unknown => {
  switch (type) {
    case "TEXT":
      return "Lorem ipsum";
    case "RICH_TEXT":
      return {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello world." }],
          },
        ],
      };
    case "NUMBER":
      return 42;
    case "BOOLEAN":
      return true;
    case "DATE":
      return "2026-05-20";
    case "DATETIME":
      return "2026-05-20T10:30:00.000Z";
    case "JSON":
      return { key: "value" };
    case "SELECT":
      return "option_a";
    case "MULTI_SELECT":
      return ["option_a", "option_b"];
    default:
      return null;
  }
};

const sampleMediaRaw = () => "11111111-1111-1111-1111-111111111111";

const sampleMediaPopulated = () => ({
  id: "11111111-1111-1111-1111-111111111111",
  filename: "hero.jpg",
  url: "/api/media/11111111-1111-1111-1111-111111111111",
  mimeType: "image/jpeg",
  sizeBytes: 184320,
  altText: "Hero image",
  metadata: { width: 1920, height: 1080 },
  createdAt: "2026-05-20T10:30:00.000Z",
});

const sampleRelationRaw = () => "22222222-2222-2222-2222-222222222222";

const sampleRelationPopulated = (config: ContentField["config"]) => {
  const apiId =
    config && typeof config === "object" && "contentTypeApiId" in config
      ? String((config as { contentTypeApiId?: unknown }).contentTypeApiId ?? "related_type")
      : "related_type";
  return {
    id: "22222222-2222-2222-2222-222222222222",
    slug: "related-entry-slug",
    contentType: apiId,
    publishedAt: "2026-05-20T10:30:00.000Z",
    updatedAt: "2026-05-20T10:30:00.000Z",
    data: { title: "Related entry title" },
  };
};

const sampleFieldValue = (field: ContentField, mode: SampleMode): unknown => {
  const make = (): unknown => {
    if (field.type === "MEDIA") {
      return mode === "populated" ? sampleMediaPopulated() : sampleMediaRaw();
    }
    if (field.type === "RELATION") {
      return mode === "populated"
        ? sampleRelationPopulated(field.config)
        : sampleRelationRaw();
    }
    return sampleScalar(field.type);
  };

  if (field.isList && field.type !== "MULTI_SELECT") {
    return [make(), make()];
  }
  return make();
};

const buildDataObject = (
  fields: ContentField[],
  mode: SampleMode,
): Record<string, unknown> => {
  const obj: Record<string, unknown> = {};
  for (const field of fields) {
    obj[field.apiId] = sampleFieldValue(field, mode);
  }
  return obj;
};

export const buildSingleEntrySample = (
  contentType: ContentTypeDetail,
  mode: SampleMode,
) => ({
  entry: {
    id: "00000000-0000-0000-0000-000000000000",
    slug: "example-slug",
    contentType: contentType.apiId,
    publishedAt: "2026-05-20T10:30:00.000Z",
    updatedAt: "2026-05-20T10:30:00.000Z",
    data: buildDataObject(contentType.fields, mode),
  },
});

export const buildListSample = (
  contentType: ContentTypeDetail,
  mode: SampleMode,
) => ({
  items: [buildSingleEntrySample(contentType, mode).entry],
  page: 1,
  pageSize: 20,
  total: 1,
  totalPages: 1,
});

/* ────────────────────────────────────────────────────────────── *
 *  TypeScript type generation                                    *
 * ────────────────────────────────────────────────────────────── */

const pascalCase = (s: string) =>
  s
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join("");

const tsScalar = (type: ContentFieldType): string => {
  switch (type) {
    case "TEXT":
    case "DATE":
    case "DATETIME":
    case "SELECT":
      return "string";
    case "RICH_TEXT":
      return "TipTapDoc";
    case "NUMBER":
      return "number";
    case "BOOLEAN":
      return "boolean";
    case "JSON":
      return "Record<string, unknown>";
    case "MULTI_SELECT":
      return "string[]";
    default:
      return "unknown";
  }
};

const tsFieldType = (field: ContentField, populated: boolean): string => {
  let base: string;
  if (field.type === "MEDIA") {
    base = populated ? "MediaAsset" : "string";
  } else if (field.type === "RELATION") {
    base = populated ? "RelatedEntry" : "string";
  } else {
    base = tsScalar(field.type);
  }
  // MULTI_SELECT already returns string[] above — don't double-list it
  if (field.isList && field.type !== "MULTI_SELECT") {
    return `${base}[]`;
  }
  return base;
};

const SHARED_TYPES = `
type TipTapDoc = {
  type: "doc";
  content: Array<Record<string, unknown>>;
};

type MediaAsset = {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  altText: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type RelatedEntry = {
  id: string;
  slug: string | null;
  contentType: string;
  publishedAt: string;
  updatedAt: string;
  data: Record<string, unknown>;
};
`.trim();

export const generateTypeScript = (
  contentType: ContentTypeDetail,
  populated: boolean,
): string => {
  const typeName = pascalCase(contentType.name);
  const dataLines = contentType.fields
    .map((field) => {
      const tsType = tsFieldType(field, populated);
      const optional = field.required ? "" : "?";
      return `    ${field.apiId}${optional}: ${tsType};`;
    })
    .join("\n");

  return `${SHARED_TYPES}

export type ${typeName}Entry = {
  id: string;
  slug: string | null;
  contentType: "${contentType.apiId}";
  publishedAt: string;
  updatedAt: string;
  data: {
${dataLines}
  };
};

export type ${typeName}ListResponse = {
  items: ${typeName}Entry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ${typeName}SingleResponse = {
  entry: ${typeName}Entry;
};
`;
};

/* ────────────────────────────────────────────────────────────── *
 *  cURL examples                                                 *
 * ────────────────────────────────────────────────────────────── */

export const generateCurl = ({
  apiBase,
  contentTypeApiId,
  variant,
  slug,
  populate,
}: {
  apiBase: string;
  contentTypeApiId: string;
  variant: "list" | "single";
  slug?: string;
  populate?: boolean;
}): string => {
  const populateQs = populate ? "?populate=*" : "";
  const path =
    variant === "list"
      ? `/public/v1/content-types/${contentTypeApiId}/entries${populateQs}`
      : `/public/v1/content-types/${contentTypeApiId}/entries/${slug ?? "your-slug"}${populateQs}`;
  return `curl -H "x-api-key: YOUR_API_KEY" \\
  "${apiBase}${path}"`;
};
