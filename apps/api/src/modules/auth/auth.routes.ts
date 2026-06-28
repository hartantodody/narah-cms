import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import {
  loginRateLimiter,
  registerRateLimiter
} from '../../middleware/rate-limit-admin.middleware'
import {
  acceptPolicies,
  changePassword,
  getCurrentUser,
  getRequiredPolicies,
  login,
  register,
  updateProfile
} from './auth.controller'

const authRouter = Router()

authRouter.post('/register', registerRateLimiter, register)
authRouter.post('/login', loginRateLimiter, login)
authRouter.get('/me', requireAuth, getCurrentUser)
authRouter.patch('/me', requireAuth, updateProfile)
authRouter.post('/me/change-password', requireAuth, changePassword)
authRouter.get('/required-policies', requireAuth, getRequiredPolicies)
authRouter.post('/accept-policies', requireAuth, acceptPolicies)

export { authRouter }
