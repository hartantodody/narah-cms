import type { RequestHandler } from 'express'
import { parseOrThrow, requireUserOrThrow } from '../../lib/guards'
import { sendOk } from '../../lib/response'
import { recordAudit } from '../audit/audit.service'
import {
  analyticsSiteParamsSchema,
  setAnalyticsConfigSchema,
} from './analytics.schemas'
import {
  deleteAnalyticsConfigForUser,
  getAnalyticsConfigForUser,
  getAnalyticsOverviewForUser,
  setAnalyticsConfigForUser,
} from './analytics.service'

export const getAnalyticsConfig: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(
      analyticsSiteParamsSchema,
      req.params,
      'Invalid route parameters',
    )
    const result = await getAnalyticsConfigForUser({
      user,
      siteId: params.siteId,
    })
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}

export const setAnalyticsConfig: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(
      analyticsSiteParamsSchema,
      req.params,
      'Invalid route parameters',
    )
    const body = parseOrThrow(
      setAnalyticsConfigSchema,
      req.body,
      'Invalid request body',
    )
    const result = await setAnalyticsConfigForUser({
      user,
      siteId: params.siteId,
      input: body,
    })

    await recordAudit({
      req,
      action: 'site.analytics_connected',
      entityType: 'site',
      entityId: params.siteId,
      siteId: params.siteId,
      userId: user.id,
      metadata: { propertyId: body.propertyId },
    })

    sendOk(res, result, 'Analytics connected')
  } catch (error) {
    next(error)
  }
}

export const deleteAnalyticsConfig: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(
      analyticsSiteParamsSchema,
      req.params,
      'Invalid route parameters',
    )
    const result = await deleteAnalyticsConfigForUser({
      user,
      siteId: params.siteId,
    })

    await recordAudit({
      req,
      action: 'site.analytics_disconnected',
      entityType: 'site',
      entityId: params.siteId,
      siteId: params.siteId,
      userId: user.id,
    })

    sendOk(res, result, 'Analytics disconnected')
  } catch (error) {
    next(error)
  }
}

export const getAnalyticsOverview: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(
      analyticsSiteParamsSchema,
      req.params,
      'Invalid route parameters',
    )
    const result = await getAnalyticsOverviewForUser({
      user,
      siteId: params.siteId,
    })
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}
