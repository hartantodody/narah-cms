import { z } from 'zod'
import { SiteStatus } from '../../../generated/prisma/client'

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

export const createSiteSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters long.'),
  slug: optionalTrimmedString,
  description: nullableOptionalTrimmedString
})

export const updateSiteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters long.')
    .optional(),
  slug: optionalTrimmedString,
  description: nullableOptionalTrimmedString,
  status: z.nativeEnum(SiteStatus).optional()
})

export const siteIdParamsSchema = z.object({
  siteId: z.string().uuid('A valid site id is required.')
})

export const listSitesQuerySchema = z.object({
  includeArchived: z.preprocess((value) => {
    if (value === undefined) {
      return false
    }

    if (typeof value === 'boolean') {
      return value
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()

      if (normalized === 'true') {
        return true
      }

      if (normalized === 'false' || normalized === '') {
        return false
      }
    }

    return value
  }, z.boolean().default(false)),
  search: optionalTrimmedString
})

export const normalizeSiteSlug = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

export type CreateSiteInput = z.infer<typeof createSiteSchema>
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>
export type ListSitesQuery = z.infer<typeof listSitesQuerySchema>
