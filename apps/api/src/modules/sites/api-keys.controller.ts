import type { RequestHandler } from 'express'
import { parseOrThrow, requireUserOrThrow } from '../../lib/guards'
import { sendCreated, sendOk } from '../../lib/response'
import { recordAudit } from '../audit/audit.service'
import {
  apiKeyParamsSchema,
  createApiKeySchema,
  listApiKeysQuerySchema,
  siteIdParamsSchema,
  updateApiKeySchema
} from './api-keys.schemas'
import {
  createApiKeyForUser,
  deleteApiKeyForUser,
  listApiKeysForUser,
  revokeApiKeyForUser,
  updateApiKeyForUser
} from './api-keys.service'

export const listApiKeys: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { siteId } = parseOrThrow(siteIdParamsSchema, req.params, 'Invalid route parameters')
    const query = parseOrThrow(listApiKeysQuerySchema, req.query, 'Invalid query parameters')

    const result = await listApiKeysForUser({ user, siteId, query })
    sendOk(res, result)
  } catch (e) {
    next(e)
  }
}

export const createApiKey: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { siteId } = parseOrThrow(siteIdParamsSchema, req.params, 'Invalid route parameters')
    const body = parseOrThrow(createApiKeySchema, req.body, 'Invalid request body')

    const result = await createApiKeyForUser({ user, siteId, input: body })

    await recordAudit({
      req,
      action: 'api_key.created',
      entityType: 'api_key',
      entityId: result.apiKey.id,
      siteId,
      userId: user.id,
      metadata: {
        name: result.apiKey.name,
        keyPrefix: result.apiKey.keyPrefix,
        scopes: result.apiKey.scopes
      }
    })

    sendCreated(res, result, 'API key created')
  } catch (e) {
    next(e)
  }
}

export const updateApiKey: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(apiKeyParamsSchema, req.params, 'Invalid route parameters')
    const body = parseOrThrow(updateApiKeySchema, req.body, 'Invalid request body')

    const result = await updateApiKeyForUser({
      user,
      siteId: params.siteId,
      apiKeyId: params.apiKeyId,
      input: body
    })

    await recordAudit({
      req,
      action: 'api_key.updated',
      entityType: 'api_key',
      entityId: params.apiKeyId,
      siteId: params.siteId,
      userId: user.id,
      metadata: { changes: body }
    })

    sendOk(res, result, 'API key updated')
  } catch (e) {
    next(e)
  }
}

export const revokeApiKey: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(apiKeyParamsSchema, req.params, 'Invalid route parameters')

    const result = await revokeApiKeyForUser({
      user,
      siteId: params.siteId,
      apiKeyId: params.apiKeyId
    })

    await recordAudit({
      req,
      action: 'api_key.revoked',
      entityType: 'api_key',
      entityId: params.apiKeyId,
      siteId: params.siteId,
      userId: user.id
    })

    sendOk(res, result, 'API key revoked')
  } catch (e) {
    next(e)
  }
}

export const deleteApiKey: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(apiKeyParamsSchema, req.params, 'Invalid route parameters')

    const result = await deleteApiKeyForUser({
      user,
      siteId: params.siteId,
      apiKeyId: params.apiKeyId
    })

    await recordAudit({
      req,
      action: 'api_key.deleted',
      entityType: 'api_key',
      entityId: params.apiKeyId,
      siteId: params.siteId,
      userId: user.id
    })

    sendOk(res, result, 'API key deleted')
  } catch (e) {
    next(e)
  }
}
