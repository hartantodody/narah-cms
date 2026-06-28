import type { Prisma } from '../../../generated/prisma/client'
import { buildPaginated } from '../../lib/pagination'
import { prisma } from '../../lib/prisma'
import { HttpError } from '../../utils/http-error'
import type { AuthenticatedRequestUser } from '../auth/auth.types'
import type { ListUsersQuery, UpdateUserInput } from './users.schemas'
import type { UserDetail, UserListItem } from './users.types'

const requireSuperAdmin = (user: AuthenticatedRequestUser) => {
  if (!user.isSuperAdmin) {
    throw new HttpError({
      message: 'Only super admins can manage users',
      statusCode: 403,
      code: 'FORBIDDEN'
    })
  }
}

const userListSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  tier: true,
  isSuperAdmin: true,
  lastLoginAt: true,
  createdAt: true,
  _count: { select: { siteMemberships: true } }
} satisfies Prisma.UserSelect

const userDetailSelect = {
  ...userListSelect,
  updatedAt: true,
  siteMemberships: {
    select: {
      role: true,
      site: { select: { id: true, name: true, slug: true } }
    },
    orderBy: { createdAt: 'desc' as const }
  }
} satisfies Prisma.UserSelect

const serializeListItem = (
  user: Prisma.UserGetPayload<{ select: typeof userListSelect }>
): UserListItem => ({
  id: user.id,
  email: user.email,
  name: user.name,
  status: user.status,
  tier: user.tier,
  isSuperAdmin: user.isSuperAdmin,
  lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  createdAt: user.createdAt.toISOString(),
  siteCount: user._count.siteMemberships
})

const serializeDetail = (
  user: Prisma.UserGetPayload<{ select: typeof userDetailSelect }>
): UserDetail => ({
  ...serializeListItem(user),
  updatedAt: user.updatedAt.toISOString(),
  memberships: user.siteMemberships.map((m) => ({
    siteId: m.site.id,
    siteName: m.site.name,
    siteSlug: m.site.slug,
    role: m.role
  }))
})

export const listUsers = async (
  actor: AuthenticatedRequestUser,
  query: ListUsersQuery
) => {
  requireSuperAdmin(actor)

  const where: Prisma.UserWhereInput = {}
  if (query.status) where.status = query.status
  if (query.tier) where.tier = query.tier
  if (query.isSuperAdmin !== undefined) where.isSuperAdmin = query.isSuperAdmin
  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: 'insensitive' } },
      { name: { contains: query.search, mode: 'insensitive' } }
    ]
  }

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: userListSelect
    })
  ])

  return buildPaginated(items.map(serializeListItem), total, {
    page: query.page,
    pageSize: query.pageSize
  })
}

export const getUserById = async (
  actor: AuthenticatedRequestUser,
  userId: string
): Promise<UserDetail> => {
  requireSuperAdmin(actor)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userDetailSelect
  })

  if (!user) {
    throw new HttpError({
      message: 'User not found',
      statusCode: 404,
      code: 'USER_NOT_FOUND'
    })
  }

  return serializeDetail(user)
}

export const updateUser = async (
  actor: AuthenticatedRequestUser,
  userId: string,
  input: UpdateUserInput
): Promise<UserDetail> => {
  requireSuperAdmin(actor)

  // Prevent self-locking out: super admin can't remove their own super-admin
  // flag or disable themselves. Demote / disable another super admin instead.
  if (userId === actor.id) {
    if (input.isSuperAdmin === false) {
      throw new HttpError({
        message: 'You cannot remove your own super-admin status',
        statusCode: 400,
        code: 'CANNOT_DEMOTE_SELF'
      })
    }
    if (input.status && input.status !== 'ACTIVE') {
      throw new HttpError({
        message: 'You cannot deactivate your own account',
        statusCode: 400,
        code: 'CANNOT_DEACTIVATE_SELF'
      })
    }
  }

  const exists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  })

  if (!exists) {
    throw new HttpError({
      message: 'User not found',
      statusCode: 404,
      code: 'USER_NOT_FOUND'
    })
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.tier !== undefined && { tier: input.tier }),
      ...(input.isSuperAdmin !== undefined && { isSuperAdmin: input.isSuperAdmin })
    }
  })

  return getUserById(actor, userId)
}
