import type { Prisma } from '../../../generated/prisma/client'
import {
  InvitationStatus,
  SiteRole,
  UserStatus
} from '../../../generated/prisma/client'
import { env } from '../../config/env'
import { prisma } from '../../lib/prisma'
import { HttpError } from '../../utils/http-error'
import {
  generateInvitationToken,
  hashInvitationToken
} from '../../utils/invitation-token'
import type { AuthenticatedRequestUser } from '../auth/auth.types'
import {
  canCreateSiteInvitationRole,
  canManageSitePeople,
  getSiteRoleForUser
} from './sites.authorization'
import type {
  AcceptInvitationInput,
  CreateSiteInvitationInput
} from './site-invitations.types'

const invitationSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  invitedBy: {
    select: {
      id: true,
      email: true,
      name: true
    }
  }
} satisfies Prisma.SiteInvitationSelect

type SiteInvitationRecord = Prisma.SiteInvitationGetPayload<{
  select: typeof invitationSelect
}>

const serializeSiteInvitation = (
  invitation: SiteInvitationRecord,
  inviteUrl: string | null = null
) => ({
  id: invitation.id,
  email: invitation.email,
  role: invitation.role,
  status: invitation.status,
  expiresAt: invitation.expiresAt,
  createdAt: invitation.createdAt,
  invitedBy: {
    id: invitation.invitedBy.id,
    email: invitation.invitedBy.email,
    name: invitation.invitedBy.name
  },
  inviteUrl
})

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const getInvitationAppBaseUrl = () =>
  env.CORS_ORIGIN === '*' ? 'http://localhost:5173' : env.CORS_ORIGIN

const buildInvitationUrl = (token: string) => {
  const invitationUrl = new URL('/invitations/accept', getInvitationAppBaseUrl())

  invitationUrl.searchParams.set('token', token)

  return invitationUrl.toString()
}

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

const expirePendingInvitations = async (siteId?: string) => {
  await prisma.siteInvitation.updateMany({
    where: {
      status: InvitationStatus.PENDING,
      expiresAt: {
        lte: new Date()
      },
      ...(siteId ? { siteId } : {})
    },
    data: {
      status: InvitationStatus.EXPIRED
    }
  })
}

const ensureSiteInvitationManagementAccess = async (
  user: AuthenticatedRequestUser,
  siteId: string
) => {
  const canManage = await canManageSitePeople(user, siteId)

  if (!canManage) {
    throw new HttpError({
      message: 'You do not have permission to manage invitations for this site',
      statusCode: 403,
      code: 'SITE_INVITATION_MANAGE_DENIED'
    })
  }
}

const getInvitationRecord = async (siteId: string, invitationId: string) => {
  const invitation = await prisma.siteInvitation.findFirst({
    where: {
      id: invitationId,
      siteId
    },
    select: invitationSelect
  })

  if (!invitation) {
    throw new HttpError({
      message: 'Site invitation not found',
      statusCode: 404,
      code: 'SITE_INVITATION_NOT_FOUND'
    })
  }

  return invitation
}

export const listSiteInvitationsForUser = async (
  user: AuthenticatedRequestUser,
  siteId: string
) => {
  await ensureSiteExists(siteId)
  await ensureSiteInvitationManagementAccess(user, siteId)
  await expirePendingInvitations(siteId)

  const invitations = await prisma.siteInvitation.findMany({
    where: {
      siteId,
      status: InvitationStatus.PENDING
    },
    orderBy: [{ createdAt: 'desc' }],
    select: invitationSelect
  })

  return {
    invitations: invitations.map((invitation) =>
      serializeSiteInvitation(invitation)
    )
  }
}

export const createSiteInvitationForUser = async ({
  user,
  siteId,
  input
}: {
  user: AuthenticatedRequestUser
  siteId: string
  input: CreateSiteInvitationInput
}) => {
  await ensureSiteExists(siteId)
  await ensureSiteInvitationManagementAccess(user, siteId)
  await expirePendingInvitations(siteId)

  const actorRole = await getSiteRoleForUser(user, siteId)
  const canInviteRole = canCreateSiteInvitationRole({
    isSuperAdmin: user.isSuperAdmin,
    actorRole,
    role: input.role
  })

  if (!canInviteRole) {
    throw new HttpError({
      message: 'You do not have permission to invite a user with this role',
      statusCode: 403,
      code: 'SITE_INVITATION_ROLE_DENIED'
    })
  }

  const normalizedEmail = normalizeEmail(input.email)
  const existingMember = await prisma.siteMember.findFirst({
    where: {
      siteId,
      user: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive'
        }
      }
    },
    select: {
      id: true
    }
  })

  if (existingMember) {
    throw new HttpError({
      message: 'This user is already a site member',
      statusCode: 409,
      code: 'SITE_MEMBER_ALREADY_EXISTS'
    })
  }

  const token = generateInvitationToken()
  const tokenHash = hashInvitationToken(token)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const existingPendingInvitation = await prisma.siteInvitation.findFirst({
    where: {
      siteId,
      email: normalizedEmail,
      status: InvitationStatus.PENDING
    },
    select: {
      id: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  const invitation = existingPendingInvitation
    ? await prisma.siteInvitation.update({
        where: {
          id: existingPendingInvitation.id
        },
        data: {
          email: normalizedEmail,
          role: input.role,
          tokenHash,
          expiresAt,
          invitedById: user.id,
          status: InvitationStatus.PENDING,
          acceptedAt: null,
          acceptedById: null
        },
        select: invitationSelect
      })
    : await prisma.siteInvitation.create({
        data: {
          siteId,
          email: normalizedEmail,
          role: input.role,
          tokenHash,
          invitedById: user.id,
          expiresAt
        },
        select: invitationSelect
      })

  return {
    invitation: serializeSiteInvitation(invitation),
    inviteUrl: buildInvitationUrl(token)
  }
}

export const revokeSiteInvitationForUser = async ({
  user,
  siteId,
  invitationId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  invitationId: string
}) => {
  await ensureSiteExists(siteId)
  await ensureSiteInvitationManagementAccess(user, siteId)
  await expirePendingInvitations(siteId)

  const currentInvitation = await getInvitationRecord(siteId, invitationId)

  if (currentInvitation.status === InvitationStatus.REVOKED) {
    return {
      ok: true
    }
  }

  if (currentInvitation.status !== InvitationStatus.PENDING) {
    throw new HttpError({
      message: 'Only pending invitations can be revoked',
      statusCode: 409,
      code: 'SITE_INVITATION_NOT_PENDING'
    })
  }

  await prisma.siteInvitation.update({
    where: {
      id: currentInvitation.id
    },
    data: {
      status: InvitationStatus.REVOKED
    }
  })

  return {
    ok: true
  }
}

export const acceptSiteInvitation = async (input: AcceptInvitationInput) => {
  await expirePendingInvitations()

  const tokenHash = hashInvitationToken(input.token)
  const invitation = await prisma.siteInvitation.findUnique({
    where: {
      tokenHash
    },
    select: {
      id: true,
      siteId: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true
    }
  })

  if (!invitation) {
    throw new HttpError({
      message: 'Invitation not found',
      statusCode: 404,
      code: 'INVITATION_NOT_FOUND'
    })
  }

  if (invitation.status === InvitationStatus.REVOKED) {
    throw new HttpError({
      message: 'This invitation has been revoked',
      statusCode: 409,
      code: 'INVITATION_REVOKED'
    })
  }

  if (invitation.status === InvitationStatus.ACCEPTED) {
    throw new HttpError({
      message: 'This invitation has already been accepted',
      statusCode: 409,
      code: 'INVITATION_ALREADY_ACCEPTED'
    })
  }

  if (
    invitation.status === InvitationStatus.EXPIRED ||
    invitation.expiresAt.getTime() <= Date.now()
  ) {
    if (invitation.status === InvitationStatus.PENDING) {
      await prisma.siteInvitation.update({
        where: {
          id: invitation.id
        },
        data: {
          status: InvitationStatus.EXPIRED
        }
      })
    }

    throw new HttpError({
      message: 'This invitation has expired',
      statusCode: 410,
      code: 'INVITATION_EXPIRED'
    })
  }

  const normalizedEmail = normalizeEmail(invitation.email)
  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive'
      }
    },
    select: {
      id: true
    }
  })

  if (existingUser) {
    await prisma.$transaction(async (transaction) => {
      const existingMembership = await transaction.siteMember.findUnique({
        where: {
          siteId_userId: {
            siteId: invitation.siteId,
            userId: existingUser.id
          }
        },
        select: {
          id: true
        }
      })

      if (!existingMembership) {
        await transaction.siteMember.create({
          data: {
            siteId: invitation.siteId,
            userId: existingUser.id,
            role: invitation.role
          }
        })
      }

      await transaction.siteInvitation.update({
        where: {
          id: invitation.id
        },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedById: existingUser.id,
          acceptedAt: new Date()
        }
      })
    })

    return {
      ok: true,
      mode: 'EXISTING_USER' as const,
      message: 'Invitation accepted. Please log in.'
    }
  }

  const name = input.name?.trim()
  const password = input.password?.trim()

  if (!name || !password) {
    throw new HttpError({
      message: 'Name and password are required to create a new account',
      statusCode: 400,
      code: 'INVITATION_ACCOUNT_DETAILS_REQUIRED'
    })
  }

  const passwordHash = await Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: 10
  })

  await prisma.$transaction(async (transaction) => {
    const newUser = await transaction.user.create({
      data: {
        email: normalizedEmail,
        name,
        passwordHash,
        status: UserStatus.ACTIVE,
        isSuperAdmin: false
      },
      select: {
        id: true
      }
    })

    await transaction.siteMember.create({
      data: {
        siteId: invitation.siteId,
        userId: newUser.id,
        role: invitation.role
      }
    })

    await transaction.siteInvitation.update({
      where: {
        id: invitation.id
      },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedById: newUser.id,
        acceptedAt: new Date()
      }
    })
  })

  return {
    ok: true,
    mode: 'NEW_USER' as const,
    message: 'Account created. Please log in.'
  }
}
