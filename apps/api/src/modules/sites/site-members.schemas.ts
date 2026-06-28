import { z } from 'zod'
import { SiteRole } from '../../../generated/prisma/client'

export const siteIdParamsSchema = z.object({
  siteId: z.string().uuid('A valid site id is required.')
})

export const siteMemberParamsSchema = z.object({
  siteId: z.string().uuid('A valid site id is required.'),
  memberId: z.string().uuid('A valid member id is required.')
})

export const updateSiteMemberSchema = z.object({
  role: z.nativeEnum(SiteRole)
})
