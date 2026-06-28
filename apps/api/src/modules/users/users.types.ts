import type { UserStatus, UserTier } from '../../../generated/prisma/client'

export type UserListItem = {
  id: string
  email: string
  name: string
  status: UserStatus
  tier: UserTier
  isSuperAdmin: boolean
  lastLoginAt: string | null
  createdAt: string
  siteCount: number
}

export type UserDetail = UserListItem & {
  updatedAt: string
  memberships: Array<{
    siteId: string
    siteName: string
    siteSlug: string
    role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'
  }>
}
