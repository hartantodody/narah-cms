import { z } from 'zod'

export const analyticsSiteParamsSchema = z.object({
  siteId: z.string().uuid('A valid site id is required.'),
})

export const setAnalyticsConfigSchema = z.object({
  // GA4 numeric property id. Stored as string — GA accepts only the numeric
  // part (no "properties/" prefix).
  propertyId: z
    .string()
    .trim()
    .regex(/^\d+$/, 'GA property id must be a numeric string.'),
  // The full service account JSON pasted by the user. We parse + validate
  // shape, then encrypt before storing.
  serviceAccount: z.string().trim().min(20, 'Service account JSON is required.'),
})

export type SetAnalyticsConfigInput = z.infer<typeof setAnalyticsConfigSchema>
