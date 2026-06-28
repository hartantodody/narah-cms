import type { RequestHandler } from 'express'
import { parseOrThrow } from '../../lib/guards'
import { sendOk } from '../../lib/response'
import { acceptSiteInvitation } from '../sites/site-invitations.service'
import { acceptInvitationSchema } from '../sites/site-invitations.schemas'

export const acceptInvitation: RequestHandler = async (req, res, next) => {
  try {
    const body = parseOrThrow(acceptInvitationSchema, req.body, 'Invalid request body')
    const result = await acceptSiteInvitation(body)
    sendOk(res, result, 'Invitation accepted')
  } catch (error) {
    next(error)
  }
}
