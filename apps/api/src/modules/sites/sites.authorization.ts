import type { RequestHandler } from 'express'
import { SiteRole } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import type { AuthenticatedRequestUser } from '../auth/auth.types'

const manageableSiteRoles = new Set<SiteRole>([SiteRole.OWNER, SiteRole.ADMIN])
const contentEditableSiteRoles = new Set<SiteRole>([
  SiteRole.OWNER,
  SiteRole.ADMIN,
  SiteRole.EDITOR
])
const ownerInvitableRoles = new Set<SiteRole>([
  SiteRole.ADMIN,
  SiteRole.EDITOR,
  SiteRole.VIEWER
])
const adminInvitableRoles = new Set<SiteRole>([
  SiteRole.EDITOR,
  SiteRole.VIEWER
])
const adminManageableRoles = new Set<SiteRole>([
  SiteRole.EDITOR,
  SiteRole.VIEWER
])

export const requireSuperAdmin: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({
      message: 'Authentication required'
    })
    return
  }

  if (!req.user.isSuperAdmin) {
    res.status(403).json({
      message: 'Super admin access required'
    })
    return
  }

  next()
}

export const getSiteMembership = (siteId: string, userId: string) =>
  prisma.siteMember.findUnique({
    where: {
      siteId_userId: {
        siteId,
        userId
      }
    },
    select: {
      role: true
    }
  })

export const getSiteRoleForUser = async (
  user: AuthenticatedRequestUser,
  siteId: string
) => {
  const membership = await getSiteMembership(siteId, user.id)

  return membership?.role ?? null
}

export const canAccessSite = async (
  user: AuthenticatedRequestUser,
  siteId: string
) => {
  if (user.isSuperAdmin) {
    return true
  }

  const membership = await getSiteMembership(siteId, user.id)

  return membership !== null
}

export const canManageSite = async (
  user: AuthenticatedRequestUser,
  siteId: string
) => {
  if (user.isSuperAdmin) {
    return true
  }

  const membership = await getSiteMembership(siteId, user.id)

  return membership ? manageableSiteRoles.has(membership.role) : false
}

export const canManageSitePeople = canManageSite

export const canEditSiteContent = async (
  user: AuthenticatedRequestUser,
  siteId: string
) => {
  if (user.isSuperAdmin) {
    return true
  }

  const membership = await getSiteMembership(siteId, user.id)

  return membership ? contentEditableSiteRoles.has(membership.role) : false
}

export const canCreateSiteInvitationRole = ({
  isSuperAdmin,
  actorRole,
  role
}: {
  isSuperAdmin: boolean
  actorRole: SiteRole | null
  role: SiteRole
}) => {
  if (role === SiteRole.OWNER) {
    return false
  }

  if (isSuperAdmin) {
    return ownerInvitableRoles.has(role)
  }

  if (actorRole === SiteRole.OWNER) {
    return ownerInvitableRoles.has(role)
  }

  if (actorRole === SiteRole.ADMIN) {
    return adminInvitableRoles.has(role)
  }

  return false
}

export const canAssignSiteMemberRole = ({
  isSuperAdmin,
  actorRole,
  targetRole,
  nextRole
}: {
  isSuperAdmin: boolean
  actorRole: SiteRole | null
  targetRole: SiteRole
  nextRole: SiteRole
}) => {
  if (isSuperAdmin) {
    return true
  }

  if (actorRole === SiteRole.OWNER) {
    return true
  }

  if (actorRole === SiteRole.ADMIN) {
    return (
      adminManageableRoles.has(targetRole) && adminManageableRoles.has(nextRole)
    )
  }

  return false
}

export const canRemoveSiteMemberRole = ({
  isSuperAdmin,
  actorRole,
  targetRole
}: {
  isSuperAdmin: boolean
  actorRole: SiteRole | null
  targetRole: SiteRole
}) => {
  if (isSuperAdmin) {
    return true
  }

  if (actorRole === SiteRole.OWNER) {
    return true
  }

  if (actorRole === SiteRole.ADMIN) {
    return adminManageableRoles.has(targetRole)
  }

  return false
}
