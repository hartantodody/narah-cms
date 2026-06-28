import { Router } from 'express'
import { invitationAcceptRateLimiter } from '../../middleware/rate-limit-admin.middleware'
import { acceptInvitation } from './invitations.controller'

const invitationsRouter = Router()

invitationsRouter.post('/accept', invitationAcceptRateLimiter, acceptInvitation)

export { invitationsRouter }
