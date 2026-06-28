import { z } from 'zod'
import { ContentEntryStatus } from '../../../generated/prisma/client'
import { contentTypeParamsSchema } from './content-types.schemas'

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

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

const entryDataSchema = z.record(z.string(), jsonValueSchema)

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}, z.string().optional())

const nullableOptionalTrimmedString = z.preprocess((value) => {
  if (value === null) return null
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}, z.string().nullable().optional())

const slugFormat = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const slugSchema = z.preprocess((value) => {
  if (value === null) return null
  if (typeof value !== 'string') return value
  const trimmed = value.trim().toLowerCase()
  return trimmed === '' ? null : trimmed
}, z
  .string()
  .nullable()
  .optional()
  .refine(
    (value) => value === null || value === undefined || slugFormat.test(value),
    {
      message:
        'Slug must be lowercase letters, numbers, and hyphens only (kebab-case).'
    }
  ))

export const createContentEntrySchema = z.object({
  data: entryDataSchema,
  slug: slugSchema,
  status: z.nativeEnum(ContentEntryStatus).optional()
})

export const updateContentEntrySchema = z.object({
  data: entryDataSchema.optional(),
  slug: slugSchema,
  status: z.nativeEnum(ContentEntryStatus).optional()
})

export const listContentEntriesQuerySchema = z.object({
  search: optionalTrimmedString,
  status: z.nativeEnum(ContentEntryStatus).optional(),
  page: z
    .preprocess(
      (v) => (typeof v === 'string' ? Number(v) : v),
      z.number().int().min(1).optional()
    )
    .optional(),
  pageSize: z
    .preprocess(
      (v) => (typeof v === 'string' ? Number(v) : v),
      z.number().int().min(1).max(100).optional()
    )
    .optional()
})

export const contentEntryParamsSchema = contentTypeParamsSchema.extend({
  entryId: z.string().uuid('A valid content entry id is required.')
})

export const contentEntryRevisionParamsSchema = contentEntryParamsSchema.extend({
  revisionId: z.string().uuid('A valid revision id is required.')
})

// Re-export upstream
export { contentTypeParamsSchema }

export type CreateContentEntryInput = z.infer<typeof createContentEntrySchema>
export type UpdateContentEntryInput = z.infer<typeof updateContentEntrySchema>
export type ListContentEntriesQuery = z.infer<
  typeof listContentEntriesQuerySchema
>

// Re-export for consumers that need to construct the literal at runtime.
export { nullableOptionalTrimmedString as _nullableOptionalTrimmedString }
