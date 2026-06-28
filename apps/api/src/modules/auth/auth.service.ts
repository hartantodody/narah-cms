import jwt, { type SignOptions } from 'jsonwebtoken'
import { z } from 'zod'
import { env } from '../../config/env'
import { prisma } from '../../lib/prisma'
import {
  type PolicyDocumentType,
  type Prisma,
  UserStatus
} from '../../../generated/prisma/client'
import type {
  AuthenticatedRequestUser,
  AuthTokenPayload,
  RequiredPolicyResponse
} from './auth.types'

const tokenPayloadSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  isSuperAdmin: z.boolean()
})

const authUserSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  tier: true,
  isSuperAdmin: true
} satisfies Prisma.UserSelect

const loginUserSelect = {
  ...authUserSelect,
  passwordHash: true
} satisfies Prisma.UserSelect

type AuthUserRecord = Prisma.UserGetPayload<{
  select: typeof authUserSelect
}>

type LoginUserRecord = Prisma.UserGetPayload<{
  select: typeof loginUserSelect
}>

export const serializeAuthenticatedUser = (
  user: AuthUserRecord
): AuthenticatedRequestUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  status: user.status,
  tier: user.tier,
  isSuperAdmin: user.isSuperAdmin
})

export const findLoginUserByEmail = (email: string) =>
  prisma.user.findUnique({
    where: { email },
    select: loginUserSelect
  })

/**
 * Public self-service registration. Creates an ACTIVE user with FREE tier.
 * No email verification step — that can be layered on later behind a flag.
 *
 * Returns `{ error: 'EMAIL_TAKEN' }` if the email is already registered so
 * the controller can return a clean 409 without leaking which emails exist.
 */
export const registerNewUser = async (input: {
  email: string
  name: string
  password: string
}): Promise<AuthUserRecord | { error: 'EMAIL_TAKEN' }> => {
  const normalizedEmail = input.email.trim().toLowerCase()

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true }
  })
  if (existing) {
    return { error: 'EMAIL_TAKEN' }
  }

  const passwordHash = await Bun.password.hash(input.password, {
    algorithm: 'bcrypt',
    cost: 10
  })

  return prisma.user.create({
    data: {
      email: normalizedEmail,
      name: input.name.trim(),
      passwordHash,
      status: UserStatus.ACTIVE
      // tier defaults to FREE via schema default
      // isSuperAdmin defaults to false via schema default
    },
    select: authUserSelect
  })
}

export const updateUserProfile = async (
  userId: string,
  input: { name?: string }
): Promise<AuthUserRecord | null> => {
  const data: Prisma.UserUpdateInput = {}
  if (input.name !== undefined) data.name = input.name

  if (Object.keys(data).length === 0) {
    return prisma.user.findUnique({ where: { id: userId }, select: authUserSelect })
  }

  return prisma.user.update({
    where: { id: userId },
    data,
    select: authUserSelect
  })
}

export const changeUserPassword = async (
  userId: string,
  input: { currentPassword: string; newPassword: string }
): Promise<{ ok: true } | { error: 'INVALID_CURRENT_PASSWORD' }> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true }
  })
  if (!user) return { error: 'INVALID_CURRENT_PASSWORD' }

  const ok = await Bun.password.verify(input.currentPassword, user.passwordHash)
  if (!ok) return { error: 'INVALID_CURRENT_PASSWORD' }

  const passwordHash = await Bun.password.hash(input.newPassword)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  })
  return { ok: true }
}

export const getUserSiteMemberships = async (userId: string) => {
  const memberships = await prisma.siteMember.findMany({
    where: { userId },
    select: {
      role: true,
      site: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true
        }
      }
    },
    orderBy: { site: { name: 'asc' } }
  })

  return memberships
    .filter((m) => m.site.status !== 'ARCHIVED')
    .map((m) => ({
      siteId: m.site.id,
      siteSlug: m.site.slug,
      siteName: m.site.name,
      role: m.role
    }))
}

export const findAuthenticatedUserById = (id: string) =>
  prisma.user.findUnique({
    where: { id },
    select: authUserSelect
  })

export const updateUserLastLoginAt = async (
  userId: string
): Promise<AuthUserRecord | null> =>
  prisma.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: new Date()
    },
    select: authUserSelect
  })

export const signAccessToken = (user: AuthenticatedRequestUser) =>
  jwt.sign(
    {
      userId: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn']
    }
  )

export const verifyAccessToken = (
  token: string
): AuthTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET)

    if (typeof decoded === 'string') {
      return null
    }

    const parsedPayload = tokenPayloadSchema.safeParse(decoded)

    return parsedPayload.success ? parsedPayload.data : null
  } catch {
    return null
  }
}

export const isUserActive = (
  user: Pick<AuthenticatedRequestUser, 'status'>
) => user.status === UserStatus.ACTIVE

export const getActivePoliciesForUser = async (
  userId: string
): Promise<{
  policies: RequiredPolicyResponse[]
  requiresPolicyAcceptance: boolean
}> => {
  const activePolicies = await prisma.policyDocument.findMany({
    where: {
      isActive: true
    },
    orderBy: [{ type: 'asc' }, { version: 'desc' }],
    select: {
      id: true,
      type: true,
      version: true,
      title: true,
      content: true,
      acceptances: {
        where: {
          userId
        },
        select: {
          id: true
        }
      }
    }
  })

  const policies = activePolicies.map((policy) => ({
    id: policy.id,
    type: policy.type,
    version: policy.version,
    title: policy.title,
    content: policy.content,
    accepted: policy.acceptances.length > 0
  }))

  return {
    policies,
    requiresPolicyAcceptance: policies.some((policy) => !policy.accepted)
  }
}

export const getRequiresPolicyAcceptance = async (userId: string) => {
  const { requiresPolicyAcceptance } = await getActivePoliciesForUser(userId)

  return requiresPolicyAcceptance
}

export const getActivePoliciesByIds = (policyDocumentIds: string[]) =>
  prisma.policyDocument.findMany({
    where: {
      id: {
        in: policyDocumentIds
      },
      isActive: true
    },
    select: {
      id: true,
      type: true
    }
  })

export const acceptPoliciesForUser = async ({
  userId,
  policyDocumentIds,
  ipAddress,
  userAgent
}: {
  userId: string
  policyDocumentIds: string[]
  ipAddress: string | null
  userAgent: string | null
}) => {
  const uniquePolicyIds = [...new Set(policyDocumentIds)]
  const activePolicies = await getActivePoliciesByIds(uniquePolicyIds)

  if (activePolicies.length !== uniquePolicyIds.length) {
    return {
      acceptedPolicies: activePolicies,
      acceptedAllRequestedPolicies: false
    }
  }

  await prisma.policyAcceptance.createMany({
    data: uniquePolicyIds.map((policyDocumentId) => ({
      userId,
      policyDocumentId,
      ipAddress,
      userAgent
    })),
    skipDuplicates: true
  })

  return {
    acceptedPolicies: activePolicies,
    acceptedAllRequestedPolicies: true
  }
}

export const getInvalidCredentialsResponse = () => ({
  message: 'Invalid credentials'
})

export const isPolicyType = (
  value: string
): value is PolicyDocumentType =>
  value === 'PRIVACY_POLICY' || value === 'USER_AGREEMENT'
