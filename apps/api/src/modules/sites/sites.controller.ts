import type { RequestHandler } from 'express'
import { parseOrThrow, requireUserOrThrow } from '../../lib/guards'
import { sendCreated, sendOk } from '../../lib/response'
import { recordAudit } from '../audit/audit.service'
import {
  archiveSiteForUser,
  createSiteForUser,
  getSiteByIdForUser,
  listRecentEntriesForUser,
  listSitesForUser,
  updateSiteForUser
} from './sites.service'
import {
  createSiteSchema,
  listSitesQuerySchema,
  siteIdParamsSchema,
  updateSiteSchema
} from './sites.schemas'

export const listSites: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const query = parseOrThrow(listSitesQuerySchema, req.query, 'Invalid query parameters')
    const result = await listSitesForUser(user, query)
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}

export const createSite: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const body = parseOrThrow(createSiteSchema, req.body, 'Invalid request body')

    const result = await createSiteForUser(user, body)

    await recordAudit({
      req,
      action: 'site.created',
      entityType: 'site',
      entityId: result.site.id,
      siteId: result.site.id,
      userId: user.id,
      metadata: { name: result.site.name, slug: result.site.slug }
    })

    sendCreated(res, result, 'Site created')
  } catch (error) {
    next(error)
  }
}

export const getSiteById: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { siteId } = parseOrThrow(siteIdParamsSchema, req.params, 'Invalid site id')
    const result = await getSiteByIdForUser(user, siteId)
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}

export const listRecentEntries: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { siteId } = parseOrThrow(siteIdParamsSchema, req.params, 'Invalid site id')

    const limitRaw = req.query.limit
    const limit =
      typeof limitRaw === 'string' && /^\d+$/.test(limitRaw)
        ? parseInt(limitRaw, 10)
        : 10

    const result = await listRecentEntriesForUser(user, siteId, limit)
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}

export const updateSite: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { siteId } = parseOrThrow(siteIdParamsSchema, req.params, 'Invalid site id')
    const body = parseOrThrow(updateSiteSchema, req.body, 'Invalid request body')

    const result = await updateSiteForUser(user, siteId, body)

    await recordAudit({
      req,
      action: 'site.updated',
      entityType: 'site',
      entityId: result.site.id,
      siteId: result.site.id,
      userId: user.id,
      metadata: { changes: body }
    })

    sendOk(res, result, 'Site updated')
  } catch (error) {
    next(error)
  }
}

export const archiveSite: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { siteId } = parseOrThrow(siteIdParamsSchema, req.params, 'Invalid site id')

    const result = await archiveSiteForUser(user, siteId)

    await recordAudit({
      req,
      action: 'site.archived',
      entityType: 'site',
      entityId: siteId,
      siteId,
      userId: user.id
    })

    sendOk(res, result, 'Site archived')
  } catch (error) {
    next(error)
  }
}
