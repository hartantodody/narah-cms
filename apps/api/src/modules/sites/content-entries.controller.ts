import type { RequestHandler } from 'express'
import { parseOrThrow, requireUserOrThrow } from '../../lib/guards'
import { sendCreated, sendOk } from '../../lib/response'
import { recordAudit } from '../audit/audit.service'
import {
  contentEntryParamsSchema,
  contentEntryRevisionParamsSchema,
  contentTypeParamsSchema,
  createContentEntrySchema,
  listContentEntriesQuerySchema,
  updateContentEntrySchema
} from './content-entries.schemas'
import {
  createContentEntryForUser,
  deleteContentEntryForUser,
  getContentEntryByIdForUser,
  getContentEntryRevisionForUser,
  listContentEntriesForUser,
  listContentEntryRevisionsForUser,
  publishContentEntryForUser,
  restoreContentEntryRevisionForUser,
  unpublishContentEntryForUser,
  updateContentEntryForUser
} from './content-entries.service'

export const listContentEntries: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentTypeParamsSchema, req.params, 'Invalid route parameters')
    const query = parseOrThrow(listContentEntriesQuerySchema, req.query, 'Invalid query parameters')

    const result = await listContentEntriesForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      query
    })
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}

export const createContentEntry: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentTypeParamsSchema, req.params, 'Invalid route parameters')
    const body = parseOrThrow(createContentEntrySchema, req.body, 'Invalid request body')

    const result = await createContentEntryForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      input: body
    })

    await recordAudit({
      req,
      action: 'content_entry.created',
      entityType: 'content_entry',
      entityId: result.entry.id,
      siteId: params.siteId,
      userId: user.id,
      metadata: {
        contentTypeId: params.contentTypeId,
        slug: result.entry.slug,
        status: result.entry.status
      }
    })

    sendCreated(res, result, 'Entry created')
  } catch (error) {
    next(error)
  }
}

export const getContentEntryById: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentEntryParamsSchema, req.params, 'Invalid route parameters')

    const result = await getContentEntryByIdForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      entryId: params.entryId
    })
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}

export const updateContentEntry: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentEntryParamsSchema, req.params, 'Invalid route parameters')
    const body = parseOrThrow(updateContentEntrySchema, req.body, 'Invalid request body')

    const result = await updateContentEntryForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      entryId: params.entryId,
      input: body
    })

    await recordAudit({
      req,
      action: 'content_entry.updated',
      entityType: 'content_entry',
      entityId: params.entryId,
      siteId: params.siteId,
      userId: user.id,
      metadata: {
        contentTypeId: params.contentTypeId,
        slug: result.entry.slug
      }
    })

    sendOk(res, result, 'Entry updated')
  } catch (error) {
    next(error)
  }
}

export const deleteContentEntry: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentEntryParamsSchema, req.params, 'Invalid route parameters')

    const result = await deleteContentEntryForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      entryId: params.entryId
    })

    await recordAudit({
      req,
      action: 'content_entry.deleted',
      entityType: 'content_entry',
      entityId: params.entryId,
      siteId: params.siteId,
      userId: user.id,
      metadata: { contentTypeId: params.contentTypeId }
    })

    sendOk(res, result, 'Entry deleted')
  } catch (error) {
    next(error)
  }
}

export const publishContentEntry: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentEntryParamsSchema, req.params, 'Invalid route parameters')

    const result = await publishContentEntryForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      entryId: params.entryId
    })

    await recordAudit({
      req,
      action: 'content_entry.published',
      entityType: 'content_entry',
      entityId: params.entryId,
      siteId: params.siteId,
      userId: user.id,
      metadata: { contentTypeId: params.contentTypeId }
    })

    sendOk(res, result, 'Entry published')
  } catch (error) {
    next(error)
  }
}

export const unpublishContentEntry: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentEntryParamsSchema, req.params, 'Invalid route parameters')

    const result = await unpublishContentEntryForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      entryId: params.entryId
    })

    await recordAudit({
      req,
      action: 'content_entry.unpublished',
      entityType: 'content_entry',
      entityId: params.entryId,
      siteId: params.siteId,
      userId: user.id,
      metadata: { contentTypeId: params.contentTypeId }
    })

    sendOk(res, result, 'Entry unpublished')
  } catch (error) {
    next(error)
  }
}

export const listContentEntryRevisions: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentEntryParamsSchema, req.params, 'Invalid route parameters')

    const result = await listContentEntryRevisionsForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      entryId: params.entryId
    })
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}

export const getContentEntryRevision: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentEntryRevisionParamsSchema, req.params, 'Invalid route parameters')

    const result = await getContentEntryRevisionForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      entryId: params.entryId,
      revisionId: params.revisionId
    })
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}

export const restoreContentEntryRevision: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentEntryRevisionParamsSchema, req.params, 'Invalid route parameters')

    const result = await restoreContentEntryRevisionForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      entryId: params.entryId,
      revisionId: params.revisionId
    })

    await recordAudit({
      req,
      action: 'content_entry.restored',
      entityType: 'content_entry',
      entityId: params.entryId,
      siteId: params.siteId,
      userId: user.id,
      metadata: {
        contentTypeId: params.contentTypeId,
        revisionId: params.revisionId
      }
    })

    sendOk(res, result, 'Entry restored from revision')
  } catch (error) {
    next(error)
  }
}
