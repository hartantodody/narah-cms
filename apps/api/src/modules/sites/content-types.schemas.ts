import { z } from 'zod'
import { ContentFieldType } from '../../../generated/prisma/client'
import { siteIdParamsSchema } from './sites.schemas'

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()

  return trimmed === '' ? undefined : trimmed
}, z.string().optional())

const nullableOptionalTrimmedString = z.preprocess((value) => {
  if (value === null) {
    return null
  }

  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}, z.string().nullable().optional())

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
)

const jsonObjectSchema: z.ZodType<Record<string, JsonValue>> = z.record(
  z.string(),
  jsonValueSchema
)

const fieldConfigSchema = jsonObjectSchema.nullable().optional()
const fieldValidationSchema = jsonObjectSchema.nullable().optional()
const fieldDefaultValueSchema = jsonValueSchema.nullable().optional()

const isValidUuid = (value: string) =>
  z.string().uuid().safeParse(value).success

/** Max number of child fields a GROUP can declare. Keeps payloads bounded
 *  and forces editors to think about composition vs. flat fields. */
export const GROUP_MAX_CHILDREN = 5

const API_ID_RE = /^[a-z][a-z0-9_]*$/

const isPlainObject = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Field types allowed as direct children of a GROUP. Excludes GROUP itself
 *  to enforce the 2-level nesting cap. */
const GROUP_CHILD_DISALLOWED = new Set<ContentFieldType>([ContentFieldType.GROUP])

/**
 * Validate the shape of a single child entry inside a GROUP's
 * config.children[]. Children look like simplified field defs:
 *   { apiId, label, type, required?, isList?, config?, description? }
 * Returns a flat list of issue strings prefixed with the child path so
 * the parent's superRefine can attach them to the right zod path.
 */
const getGroupChildIssues = (child: unknown, index: number): string[] => {
  const path = `children[${index}]`
  const issues: string[] = []

  if (!isPlainObject(child)) {
    issues.push(`${path} must be an object.`)
    return issues
  }

  const c = child as Record<string, JsonValue>

  if (typeof c.apiId !== 'string' || !API_ID_RE.test(c.apiId)) {
    issues.push(`${path}.apiId must match /^[a-z][a-z0-9_]*$/`)
  }
  if (typeof c.label !== 'string' || c.label.trim().length < 1) {
    issues.push(`${path}.label is required.`)
  }
  if (typeof c.type !== 'string') {
    issues.push(`${path}.type is required.`)
  } else if (!(c.type in ContentFieldType)) {
    issues.push(`${path}.type is not a valid field type.`)
  } else if (GROUP_CHILD_DISALLOWED.has(c.type as ContentFieldType)) {
    issues.push(
      `${path}.type GROUP is not allowed inside another GROUP (max 2-level nesting).`
    )
  }
  if (c.required !== undefined && typeof c.required !== 'boolean') {
    issues.push(`${path}.required must be a boolean.`)
  }
  if (c.isList !== undefined && typeof c.isList !== 'boolean') {
    issues.push(`${path}.isList must be a boolean.`)
  }
  if (c.config !== undefined && c.config !== null && !isPlainObject(c.config)) {
    issues.push(`${path}.config must be an object or null.`)
  }
  // Recurse into the child's own config rules (SELECT options, RELATION id).
  if (typeof c.type === 'string' && c.type in ContentFieldType) {
    const childConfig = isPlainObject(c.config) ? c.config : null
    issues.push(
      ...getContentFieldConfigIssues({
        type: c.type as ContentFieldType,
        config: childConfig
      }).map((m) => `${path}: ${m}`)
    )
  }

  return issues
}

export const getContentFieldConfigIssues = ({
  type,
  config
}: {
  type: ContentFieldType
  config?: Record<string, JsonValue> | null
}) => {
  if (!config) {
    if (type === ContentFieldType.GROUP) {
      return ['GROUP fields require config.children with at least one child.']
    }
    return [] as string[]
  }

  const issues: string[] = []

  if (
    (type === ContentFieldType.SELECT || type === ContentFieldType.MULTI_SELECT) &&
    'options' in config &&
    !Array.isArray(config.options)
  ) {
    issues.push(
      'config.options must be an array for SELECT and MULTI_SELECT fields.'
    )
  }

  if (
    type === ContentFieldType.RELATION &&
    'contentTypeId' in config &&
    config.contentTypeId !== null &&
    (typeof config.contentTypeId !== 'string' || !isValidUuid(config.contentTypeId))
  ) {
    issues.push(
      'config.contentTypeId must be a valid uuid for RELATION fields.'
    )
  }

  if (type === ContentFieldType.GROUP) {
    const children = (config as { children?: unknown }).children
    if (!Array.isArray(children) || children.length === 0) {
      issues.push('GROUP fields require config.children with at least one child.')
    } else {
      if (children.length > GROUP_MAX_CHILDREN) {
        issues.push(
          `GROUP fields may have at most ${GROUP_MAX_CHILDREN} children; got ${children.length}.`
        )
      }
      const seenApiIds = new Set<string>()
      for (const [i, child] of children.entries()) {
        issues.push(...getGroupChildIssues(child, i))
        if (isPlainObject(child) && typeof child.apiId === 'string') {
          const key = child.apiId.toLowerCase()
          if (seenApiIds.has(key)) {
            issues.push(`Duplicate apiId "${child.apiId}" inside GROUP children.`)
          }
          seenApiIds.add(key)
        }
      }
    }
  }

  return issues
}

export const normalizeContentApiId = ({
  value,
  fallbackPrefix
}: {
  value: string
  fallbackPrefix: string
}) => {
  const normalizedFallbackPrefix = fallbackPrefix
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  let normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  const firstLetterIndex = normalized.search(/[a-z]/)

  if (firstLetterIndex > 0) {
    normalized = normalized.slice(firstLetterIndex)
  }

  if (!normalized) {
    return normalizedFallbackPrefix
  }

  if (!/^[a-z]/.test(normalized)) {
    normalized = `${normalizedFallbackPrefix}_${normalized}`
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  return normalized
}

export const createContentTypeSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters long.'),
  apiId: optionalTrimmedString,
  description: nullableOptionalTrimmedString,
  isSingleton: z.boolean().optional()
})

export const updateContentTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters long.')
    .optional(),
  apiId: optionalTrimmedString,
  description: nullableOptionalTrimmedString,
  isSingleton: z.boolean().optional()
})

export const createContentFieldSchema = z
  .object({
    label: z.string().trim().min(2, 'Label must be at least 2 characters long.'),
    apiId: optionalTrimmedString,
    type: z.nativeEnum(ContentFieldType),
    description: nullableOptionalTrimmedString,
    required: z.boolean().optional(),
    localized: z.boolean().optional(),
    isList: z.boolean().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
    config: fieldConfigSchema,
    validation: fieldValidationSchema,
    defaultValue: fieldDefaultValueSchema
  })
  .superRefine((value, ctx) => {
    const issues = getContentFieldConfigIssues({
      type: value.type,
      config: value.config
    })

    for (const issue of issues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['config'],
        message: issue
      })
    }
  })

export const updateContentFieldSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, 'Label must be at least 2 characters long.')
    .optional(),
  apiId: optionalTrimmedString,
  type: z.nativeEnum(ContentFieldType).optional(),
  description: nullableOptionalTrimmedString,
  required: z.boolean().optional(),
  localized: z.boolean().optional(),
  isList: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  config: fieldConfigSchema,
  validation: fieldValidationSchema,
  defaultValue: fieldDefaultValueSchema
})

export const reorderContentFieldsSchema = z.object({
  fieldIds: z
    .array(z.string().uuid('Each field id must be a valid uuid.'))
    .min(1, 'Provide at least one field id.')
})

/**
 * Schema for the "replace whole content type" endpoint used by the Code-tab
 * editor. The diff key for fields is `apiId` — fields in the payload whose
 * `apiId` matches an existing field are updated; new `apiId`s create new
 * fields; existing fields whose `apiId` is absent from the payload are deleted.
 */
const replaceFieldSchema = z
  .object({
    label: z.string().trim().min(2, 'Label must be at least 2 characters long.'),
    apiId: z.string().trim().min(1, 'Field apiId is required.'),
    type: z.nativeEnum(ContentFieldType),
    description: nullableOptionalTrimmedString,
    required: z.boolean().optional().default(false),
    localized: z.boolean().optional().default(false),
    isList: z.boolean().optional().default(false),
    config: fieldConfigSchema,
    validation: fieldValidationSchema,
    defaultValue: fieldDefaultValueSchema
  })
  .superRefine((value, ctx) => {
    const issues = getContentFieldConfigIssues({
      type: value.type,
      config: value.config
    })
    for (const issue of issues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['config'],
        message: issue
      })
    }
  })

export const replaceContentTypeSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters long.'),
    apiId: optionalTrimmedString,
    description: nullableOptionalTrimmedString,
    isSingleton: z.boolean().optional().default(false),
    fields: z.array(replaceFieldSchema).default([])
  })
  .superRefine((value, ctx) => {
    // Reject duplicate apiIds in the payload — caller should reconcile before
    // submitting since we can't pick which one wins.
    const seen = new Set<string>()
    for (const [index, field] of value.fields.entries()) {
      const key = field.apiId.toLowerCase()
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fields', index, 'apiId'],
          message: `Duplicate field apiId "${field.apiId}" in payload`
        })
      }
      seen.add(key)
    }
  })

export type ReplaceContentTypeInput = z.infer<typeof replaceContentTypeSchema>

export const listContentTypesQuerySchema = z.object({
  search: optionalTrimmedString
})

export const contentTypeParamsSchema = siteIdParamsSchema.extend({
  contentTypeId: z.string().uuid('A valid content type id is required.')
})

export const contentFieldParamsSchema = contentTypeParamsSchema.extend({
  fieldId: z.string().uuid('A valid content field id is required.')
})

export { siteIdParamsSchema }

export type CreateContentTypeInput = z.infer<typeof createContentTypeSchema>
export type UpdateContentTypeInput = z.infer<typeof updateContentTypeSchema>
export type CreateContentFieldInput = z.infer<typeof createContentFieldSchema>
export type UpdateContentFieldInput = z.infer<typeof updateContentFieldSchema>
export type ReorderContentFieldsInput = z.infer<
  typeof reorderContentFieldsSchema
>
export type ListContentTypesQuery = z.infer<typeof listContentTypesQuerySchema>
