import type { RequestHandler } from 'express'
import { UserStatus } from '../../../generated/prisma/client'
import { parseOrThrow, requireUserOrThrow } from '../../lib/guards'
import { sendCreated, sendOk, sendOkEmpty } from '../../lib/response'
import { HttpError } from '../../utils/http-error'
import {
  acceptPoliciesForUser,
  changeUserPassword,
  findLoginUserByEmail,
  getActivePoliciesForUser,
  getInvalidCredentialsResponse,
  getRequiresPolicyAcceptance,
  getUserSiteMemberships,
  registerNewUser,
  serializeAuthenticatedUser,
  signAccessToken,
  updateUserLastLoginAt,
  updateUserProfile
} from './auth.service'
import {
  acceptPoliciesSchema,
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema
} from './auth.schemas'

const getClientIpAddress = (req: Parameters<RequestHandler>[0]) => {
  const forwardedFor = req.headers['x-forwarded-for']

  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]?.trim() || null
  }

  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0]?.trim() || null
  }

  return req.ip ?? null
}

const invalidCredentials = () => {
  const payload = getInvalidCredentialsResponse()
  return new HttpError({
    message: payload.message,
    statusCode: 401,
    code: 'INVALID_CREDENTIALS'
  })
}

export const register: RequestHandler = async (req, res, next) => {
  try {
    const body = parseOrThrow(registerSchema, req.body, 'Invalid request body')

    const result = await registerNewUser(body)
    if ('error' in result) {
      throw new HttpError({
        message: 'An account with this email already exists.',
        statusCode: 409,
        code: 'EMAIL_TAKEN'
      })
    }

    // Auto-login the newly registered user — same response shape as login.
    const responseUser = serializeAuthenticatedUser(result)
    const accessToken = signAccessToken(responseUser)
    const [requiresPolicyAcceptance, memberships] = await Promise.all([
      getRequiresPolicyAcceptance(result.id),
      getUserSiteMemberships(result.id)
    ])

    sendCreated(
      res,
      {
        accessToken,
        user: responseUser,
        requiresPolicyAcceptance,
        memberships
      },
      'Account created'
    )
  } catch (error) {
    next(error)
  }
}

export const login: RequestHandler = async (req, res, next) => {
  try {
    const body = parseOrThrow(loginSchema, req.body, 'Invalid request body')

    const user = await findLoginUserByEmail(body.email)
    if (!user) {
      throw invalidCredentials()
    }

    const passwordMatches = await Bun.password.verify(body.password, user.passwordHash)
    if (!passwordMatches) {
      throw invalidCredentials()
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new HttpError({
        message: 'User account is not active',
        statusCode: 403,
        code: 'USER_INACTIVE'
      })
    }

    const updatedUser = await updateUserLastLoginAt(user.id)
    if (!updatedUser) {
      throw invalidCredentials()
    }

    const responseUser = serializeAuthenticatedUser(updatedUser)
    const accessToken = signAccessToken(responseUser)
    const [requiresPolicyAcceptance, memberships] = await Promise.all([
      getRequiresPolicyAcceptance(updatedUser.id),
      getUserSiteMemberships(updatedUser.id)
    ])

    sendOk(
      res,
      {
        accessToken,
        user: responseUser,
        requiresPolicyAcceptance,
        memberships
      },
      'Signed in'
    )
  } catch (error) {
    next(error)
  }
}

export const getCurrentUser: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const [requiresPolicyAcceptance, memberships] = await Promise.all([
      getRequiresPolicyAcceptance(user.id),
      getUserSiteMemberships(user.id)
    ])

    sendOk(res, {
      user,
      requiresPolicyAcceptance,
      memberships
    })
  } catch (error) {
    next(error)
  }
}

export const updateProfile: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const body = parseOrThrow(updateProfileSchema, req.body, 'Invalid request body')

    const updated = await updateUserProfile(user.id, body)
    if (!updated) {
      throw new HttpError({
        message: 'User not found',
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      })
    }

    sendOk(res, { user: serializeAuthenticatedUser(updated) }, 'Profile updated')
  } catch (error) {
    next(error)
  }
}

export const changePassword: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const body = parseOrThrow(changePasswordSchema, req.body, 'Invalid request body')

    const result = await changeUserPassword(user.id, body)
    if ('error' in result) {
      throw new HttpError({
        message: 'Current password is incorrect',
        statusCode: 400,
        code: 'INVALID_CURRENT_PASSWORD'
      })
    }

    sendOkEmpty(res, 'Password updated')
  } catch (error) {
    next(error)
  }
}

export const getRequiredPolicies: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { policies } = await getActivePoliciesForUser(user.id)
    sendOk(res, { policies })
  } catch (error) {
    next(error)
  }
}

export const acceptPolicies: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const body = parseOrThrow(acceptPoliciesSchema, req.body, 'Invalid request body')

    const { acceptedAllRequestedPolicies } = await acceptPoliciesForUser({
      userId: user.id,
      policyDocumentIds: body.policyDocumentIds,
      ipAddress: getClientIpAddress(req),
      userAgent: req.get('user-agent') ?? null
    })

    if (!acceptedAllRequestedPolicies) {
      throw new HttpError({
        message: 'Only active policy documents can be accepted',
        statusCode: 400,
        code: 'INVALID_POLICY_DOCUMENT'
      })
    }

    const requiresPolicyAcceptance = await getRequiresPolicyAcceptance(user.id)

    sendOk(res, { requiresPolicyAcceptance }, 'Policies accepted')
  } catch (error) {
    next(error)
  }
}
