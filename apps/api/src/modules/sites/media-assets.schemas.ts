import { z } from 'zod'
import { siteIdParamsSchema } from './sites.schemas'

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

export const listMediaAssetsQuerySchema = z.object({
  search: optionalTrimmedString,
  mimeTypePrefix: optionalTrimmedString,
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

const unitFloat = z
  .number()
  .min(0)
  .max(1)

export const focalPointSchema = z
  .object({
    x: unitFloat,
    y: unitFloat
  })
  .nullable()
  .optional()

export const updateMediaAssetSchema = z.object({
  filename: optionalTrimmedString,
  altText: nullableOptionalTrimmedString,
  focalPoint: focalPointSchema
})

export const mediaAssetParamsSchema = siteIdParamsSchema.extend({
  assetId: z.string().uuid('A valid media asset id is required.')
})

export type ListMediaAssetsQuery = z.infer<typeof listMediaAssetsQuerySchema>
export type UpdateMediaAssetInput = z.infer<typeof updateMediaAssetSchema>

export { siteIdParamsSchema }
