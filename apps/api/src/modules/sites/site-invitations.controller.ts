import type { RequestHandler } from 'express'
import { parseOrThrow, requireUserOrThrow } from '../../lib/guards'
import { sendCreated, sendOk } from '../../lib/response'
import { recordAudit } from '../audit/audit.service'
import {
  createSiteInvitationForUser,
  listSiteInvitationsForUser,
  revokeSiteInvitationForUser
} from './site-invitations.service'
import {
  createSiteInvitationSchema,
  siteInvitationParamsSchema
} from './site-invitations.schemas'
import { siteIdParamsSchema } from './site-members.schemas'

export const listSiteInvitations: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { siteId } = parseOrThrow(siteIdParamsSchema, req.params, 'Invalid site id')

    const result = await listSiteInvitationsForUser(user, siteId)
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}

export const createSiteInvitation: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { siteId } = parseOrThrow(siteIdParamsSchema, req.params, 'Invalid site id')
    const body = parseOrThrow(createSiteInvitationSchema, req.body, 'Invalid request body')

    const result = await createSiteInvitationForUser({ user, siteId, input: body })

    await recordAudit({
      req,
      action: 'site_invitation.created',
      entityType: 'site_invitation',
      entityId: result.invitation.id,
      siteId,
      userId: user.id,
      metadata: {
        email: result.invitation.email,
        role: result.invitation.role
      }
    })

    sendCreated(res, result, 'Invitation created')
  } catch (error) {
    next(error)
  }
}

export const revokeSiteInvitation: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(siteInvitationParamsSchema, req.params, 'Invalid route parameters')

    const result = await revokeSiteInvitationForUser({
      user,
      siteId: params.siteId,
      invitationId: params.invitationId
    })

    await recordAudit({
      req,
      action: 'site_invitation.revoked',
      entityType: 'site_invitation',
      entityId: params.invitationId,
      siteId: params.siteId,
      userId: user.id
    })

    sendOk(res, result, 'Invitation revoked')
  } catch (error) {
    next(error)
  }
}
