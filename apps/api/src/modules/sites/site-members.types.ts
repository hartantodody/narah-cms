import type { z } from 'zod'
import type { updateSiteMemberSchema } from './site-members.schemas'

export type UpdateSiteMemberInput = z.infer<typeof updateSiteMemberSchema>
