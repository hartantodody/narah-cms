import type { z } from 'zod'
import type {
  acceptInvitationSchema,
  createSiteInvitationSchema
} from './site-invitations.schemas'

export type CreateSiteInvitationInput = z.infer<
  typeof createSiteInvitationSchema
>
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>
