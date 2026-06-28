import type { UserStatus, UserTier } from '../../../generated/prisma/client'

export type AuthTokenPayload = {
  userId: string
  email: string
  isSuperAdmin: boolean
}

export type AuthenticatedRequestUser = {
  id: string
  email: string
  name: string
  status: UserStatus
  tier: UserTier
  isSuperAdmin: boolean
}

export type RequiredPolicyResponse = {
  id: string
  type: string
  version: string
  title: string
  content: string
  accepted: boolean
}
