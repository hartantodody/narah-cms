import { z } from 'zod'
import { UserStatus, UserTier } from '../../../generated/prisma/client'
import { paginationQuerySchema } from '../../lib/pagination'

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  tier: z.nativeEnum(UserTier).optional(),
  isSuperAdmin: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true'))
})

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>

export const userIdParamsSchema = z.object({
  userId: z.string().uuid('Invalid user id')
})

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    tier: z.nativeEnum(UserTier).optional(),
    isSuperAdmin: z.boolean().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided'
  })

export type UpdateUserInput = z.infer<typeof updateUserSchema>
