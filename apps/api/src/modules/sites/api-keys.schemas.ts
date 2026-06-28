import { z } from 'zod'
import { ALL_SCOPES } from '../../utils/api-key'
import { siteIdParamsSchema } from './sites.schemas'

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}, z.string().optional())

const scopeEnum = z.enum(ALL_SCOPES as unknown as [string, ...string[]])

const originSchema = z
  .string()
  .trim()
  .url('Each allowed origin must be a full URL (e.g. https://example.com).')
  .refine(
    (value) => {
      try {
        const url = new URL(value)
        // No paths, no query — origin only.
        return url.pathname === '/' || url.pathname === ''
      } catch {
        return false
      }
    },
    {
      message:
        'Origins must contain only protocol + host (+ optional port), no paths.'
    }
  )

const allowedOriginsSchema = z
  .array(originSchema)
  .max(20, 'No more than 20 origins per key.')

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  scopes: z.array(scopeEnum).min(1, 'At least one scope is required.').optional(),
  /** ISO date-time. If omitted, key never expires. */
  expiresAt: z
    .string()
    .datetime({ message: 'expiresAt must be an ISO date-time.' })
    .optional(),
  /** Empty array = allow any origin (`*`). */
  allowedOrigins: allowedOriginsSchema.optional(),
  /** Per-minute rate limit for this key on public delivery routes. */
  rateLimitPerMinute: z.number().int().min(1).max(10000).optional()
})

export const updateApiKeySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').optional(),
  scopes: z.array(scopeEnum).min(1, 'At least one scope is required.').optional(),
  allowedOrigins: allowedOriginsSchema.optional(),
  rateLimitPerMinute: z.number().int().min(1).max(10000).optional()
})

export const listApiKeysQuerySchema = z.object({
  search: optionalTrimmedString
})

export const apiKeyParamsSchema = siteIdParamsSchema.extend({
  apiKeyId: z.string().uuid('A valid api key id is required.')
})

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>
export type ListApiKeysQuery = z.infer<typeof listApiKeysQuerySchema>

export { siteIdParamsSchema }
