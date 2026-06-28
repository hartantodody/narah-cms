import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import { requireAcceptedPolicies } from '../../middleware/policy-guard.middleware'
import {
  getDatabaseHealth,
  getHealth,
  getProtectedHealth
} from './health.controller'

const healthRouter = Router()

healthRouter.get('/', getHealth)
healthRouter.get('/db', getDatabaseHealth)
healthRouter.get('/protected', requireAuth, requireAcceptedPolicies, getProtectedHealth)

export { healthRouter }
