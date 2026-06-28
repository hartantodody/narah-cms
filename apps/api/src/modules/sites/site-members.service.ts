import type { Prisma } from '../../../generated/prisma/client'
import { SiteRole } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { HttpError } from '../../utils/http-error'
import type { AuthenticatedRequestUser } from '../auth/auth.types'
import {
  canAccessSite,
  canAssignSiteMemberRole,
  canManageSitePeople,
  canRemoveSiteMemberRole,
  getSiteRoleForUser
} from './sites.authorization'
import type { UpdateSiteMemberInput } from './site-members.types'

const ownerSortOrder: Record<SiteRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  EDITOR: 2,
  VIEWER: 3
}

const siteMemberSelect = {
  id: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      isSuperAdmin: true
    }
  }
} satisfies Prisma.SiteMemberSelect

type SiteMemberRecord = Prisma.SiteMemberGetPayload<{
  select: typeof siteMemberSelect
}>

const serializeSiteMember = (member: SiteMemberRecord) => ({
  id: member.id,
  role: member.role,
  createdAt: member.createdAt,
  updatedAt: member.updatedAt,
  user: {
    id: member.user.id,
    email: member.user.email,
    name: member.user.name,
    status: member.user.status,
    isSuperAdmin: member.user.isSuperAdmin
  }
})

const ensureSiteExists = async (siteId: string) => {
  const site = await prisma.site.findUnique({
    where: {
      id: siteId
    },
    select: {
      id: true
    }
  })

  if (!site) {
    throw new HttpError({
      message: 'Site not found',
      statusCode: 404,
      code: 'SITE_NOT_FOUND'
    })
  }
}

const getSiteMemberRecord = async (siteId: string, memberId: string) => {
  const member = await prisma.siteMember.findFirst({
    where: {
      id: memberId,
      siteId
    },
    select: siteMemberSelect
  })

  if (!member) {
    throw new HttpError({
      message: 'Site member not found',
      statusCode: 404,
      code: 'SITE_MEMBER_NOT_FOUND'
    })
  }

  return member
}

const countSiteOwners = (siteId: string) =>
  prisma.siteMember.count({
    where: {
      siteId,
      role: SiteRole.OWNER
    }
  })

const ensureSiteMemberManagementAccess = async (
  user: AuthenticatedRequestUser,
  siteId: string
) => {
  const canManage = await canManageSitePeople(user, siteId)

  if (!canManage) {
    throw new HttpError({
      message: 'You do not have permission to manage members for this site',
      statusCode: 403,
      code: 'SITE_MEMBER_MANAGE_DENIED'
    })
  }
}

const ensureLastOwnerWillRemain = async ({
  siteId,
  currentRole,
  nextRole
}: {
  siteId: string
  currentRole: SiteRole
  nextRole?: SiteRole
}) => {
  if (currentRole !== SiteRole.OWNER) {
    return
  }

  if (nextRole === SiteRole.OWNER) {
    return
  }

  const ownerCount = await countSiteOwners(siteId)

  if (ownerCount <= 1) {
    throw new HttpError({
      message: 'At least one OWNER must remain in this site',
      statusCode: 409,
      code: 'LAST_OWNER_REQUIRED'
    })
  }
}

export const listSiteMembersForUser = async (
  user: AuthenticatedRequestUser,
  siteId: string
) => {
  await ensureSiteExists(siteId)

  const hasAccess = await canAccessSite(user, siteId)

  if (!hasAccess) {
    throw new HttpError({
      message: 'You do not have access to this site',
      statusCode: 403,
      code: 'SITE_ACCESS_DENIED'
    })
  }

  const members = await prisma.siteMember.findMany({
    where: {
      siteId
    },
    select: siteMemberSelect
  })

  const sortedMembers = [...members].sort((left, right) => {
    const roleDiff = ownerSortOrder[left.role] - ownerSortOrder[right.role]

    if (roleDiff !== 0) {
      return roleDiff
    }

    return left.createdAt.getTime() - right.createdAt.getTime()
  })

  return {
    members: sortedMembers.map(serializeSiteMember)
  }
}

export const updateSiteMemberForUser = async ({
  user,
  siteId,
  memberId,
  input
}: {
  user: AuthenticatedRequestUser
  siteId: string
  memberId: string
  input: UpdateSiteMemberInput
}) => {
  await ensureSiteExists(siteId)
  await ensureSiteMemberManagementAccess(user, siteId)

  const [actorRole, currentMember] = await Promise.all([
    getSiteRoleForUser(user, siteId),
    getSiteMemberRecord(siteId, memberId)
  ])

  const canAssignRole = canAssignSiteMemberRole({
    isSuperAdmin: user.isSuperAdmin,
    actorRole,
    targetRole: currentMember.role,
    nextRole: input.role
  })

  if (!canAssignRole) {
    throw new HttpError({
      message: 'You do not have permission to assign this role',
      statusCode: 403,
      code: 'SITE_MEMBER_ROLE_ASSIGNMENT_DENIED'
    })
  }

  await ensureLastOwnerWillRemain({
    siteId,
    currentRole: currentMember.role,
    nextRole: input.role
  })

  if (currentMember.role === input.role) {
    return {
      member: serializeSiteMember(currentMember)
    }
  }

  const updatedMember = await prisma.siteMember.update({
    where: {
      id: currentMember.id
    },
    data: {
      role: input.role
    },
    select: siteMemberSelect
  })

  return {
    member: serializeSiteMember(updatedMember)
  }
}

export const removeSiteMemberForUser = async ({
  user,
  siteId,
  memberId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  memberId: string
}) => {
  await ensureSiteExists(siteId)
  await ensureSiteMemberManagementAccess(user, siteId)

  const [actorRole, currentMember] = await Promise.all([
    getSiteRoleForUser(user, siteId),
    getSiteMemberRecord(siteId, memberId)
  ])

  const canRemoveMember = canRemoveSiteMemberRole({
    isSuperAdmin: user.isSuperAdmin,
    actorRole,
    targetRole: currentMember.role
  })

  if (!canRemoveMember) {
    throw new HttpError({
      message: 'You do not have permission to remove this member',
      statusCode: 403,
      code: 'SITE_MEMBER_REMOVE_DENIED'
    })
  }

  await ensureLastOwnerWillRemain({
    siteId,
    currentRole: currentMember.role
  })

  await prisma.siteMember.delete({
    where: {
      id: currentMember.id
    }
  })

  return {
    ok: true
  }
}
