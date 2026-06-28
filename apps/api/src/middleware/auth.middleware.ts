import type { RequestHandler } from 'express'
import type { ApiError } from '../lib/response'
import {
  findAuthenticatedUserById,
  isUserActive,
  serializeAuthenticatedUser,
  verifyAccessToken
} from '../modules/auth/auth.service'

const sendAuthError = (
  res: Parameters<RequestHandler>[1],
  status: number,
  message: string,
  code: string
) => {
  const payload: ApiError = {
    success: false,
    message,
    code
  }
  res.status(status).json(payload)
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const authorizationHeader = req.get('authorization')

    if (!authorizationHeader) {
      sendAuthError(res, 401, 'Authentication required', 'AUTH_REQUIRED')
      return
    }

    const [scheme, token] = authorizationHeader.split(' ')

    if (scheme !== 'Bearer' || !token) {
      sendAuthError(res, 401, 'Invalid or expired access token', 'INVALID_ACCESS_TOKEN')
      return
    }

    const payload = verifyAccessToken(token)

    if (!payload) {
      sendAuthError(res, 401, 'Invalid or expired access token', 'INVALID_ACCESS_TOKEN')
      return
    }

    const user = await findAuthenticatedUserById(payload.userId)

    if (!user) {
      sendAuthError(res, 401, 'Invalid or expired access token', 'INVALID_ACCESS_TOKEN')
      return
    }

    if (!isUserActive(user)) {
      sendAuthError(res, 403, 'User account is not active', 'USER_INACTIVE')
      return
    }

    req.user = serializeAuthenticatedUser(user)
    next()
  } catch (error) {
    next(error)
  }
}
