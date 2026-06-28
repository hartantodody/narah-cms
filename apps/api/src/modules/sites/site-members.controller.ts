import type { RequestHandler } from 'express'
import { parseOrThrow, requireUserOrThrow } from '../../lib/guards'
import { sendOk } from '../../lib/response'
import { recordAudit } from '../audit/audit.service'
import {
  listSiteMembersForUser,
  removeSiteMemberForUser,
  updateSiteMemberForUser
} from './site-members.service'
import {
  siteIdParamsSchema,
  siteMemberParamsSchema,
  updateSiteMemberSchema
} from './site-members.schemas'

export const listSiteMembers: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { siteId } = parseOrThrow(siteIdParamsSchema, req.params, 'Invalid site id')

    const result = await listSiteMembersForUser(user, siteId)
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}

export const updateSiteMember: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(siteMemberParamsSchema, req.params, 'Invalid route parameters')
    const body = parseOrThrow(updateSiteMemberSchema, req.body, 'Invalid request body')

    const result = await updateSiteMemberForUser({
      user,
      siteId: params.siteId,
      memberId: params.memberId,
      input: body
    })

    await recordAudit({
      req,
      action: 'site_member.role_changed',
      entityType: 'site_member',
      entityId: params.memberId,
      siteId: params.siteId,
      userId: user.id,
      metadata: { newRole: body.role }
    })

    sendOk(res, result, 'Member updated')
  } catch (error) {
    next(error)
  }
}

export const removeSiteMember: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(siteMemberParamsSchema, req.params, 'Invalid route parameters')

    const result = await removeSiteMemberForUser({
      user,
      siteId: params.siteId,
      memberId: params.memberId
    })

    await recordAudit({
      req,
      action: 'site_member.removed',
      entityType: 'site_member',
      entityId: params.memberId,
      siteId: params.siteId,
      userId: user.id
    })

    sendOk(res, result, 'Member removed')
  } catch (error) {
    next(error)
  }
}
