import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import { requireAcceptedPolicies } from '../../middleware/policy-guard.middleware'
import { listGlobalAuditLogs } from './audit.controller'

const auditRouter = Router()

auditRouter.use(requireAuth, requireAcceptedPolicies)
auditRouter.get('/', listGlobalAuditLogs)

export { auditRouter }
