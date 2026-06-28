import { z } from 'zod'
import { SiteRole } from '../../../generated/prisma/client'

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()

  return trimmed === '' ? undefined : trimmed
}, z.string().optional())

export const createSiteInvitationSchema = z.object({
  email: z.string().trim().email('A valid email address is required.'),
  role: z.enum([SiteRole.ADMIN, SiteRole.EDITOR, SiteRole.VIEWER])
})

export const siteInvitationParamsSchema = z.object({
  siteId: z.string().uuid('A valid site id is required.'),
  invitationId: z.string().uuid('A valid invitation id is required.')
})

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(1, 'Invitation token is required.'),
  name: optionalTrimmedString,
  password: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value
    }

    const trimmed = value.trim()

    return trimmed === '' ? undefined : trimmed
  }, z.string().min(8, 'Password must be at least 8 characters long.').optional())
})
