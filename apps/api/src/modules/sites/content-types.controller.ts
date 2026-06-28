import type { RequestHandler } from 'express'
import { parseOrThrow, requireUserOrThrow } from '../../lib/guards'
import { sendCreated, sendOk } from '../../lib/response'
import { recordAudit } from '../audit/audit.service'
import {
  createContentFieldSchema,
  createContentTypeSchema,
  listContentTypesQuerySchema,
  replaceContentTypeSchema,
  reorderContentFieldsSchema,
  contentFieldParamsSchema,
  contentTypeParamsSchema,
  siteIdParamsSchema,
  updateContentFieldSchema,
  updateContentTypeSchema
} from './content-types.schemas'
import {
  createContentFieldForUser,
  createContentTypeForUser,
  deleteContentFieldForUser,
  deleteContentTypeForUser,
  getContentTypeByIdForUser,
  listContentTypesForUser,
  replaceContentTypeForUser,
  reorderContentFieldsForUser,
  updateContentFieldForUser,
  updateContentTypeForUser
} from './content-types.service'

export const listContentTypes: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { siteId } = parseOrThrow(siteIdParamsSchema, req.params, 'Invalid site id')
    const query = parseOrThrow(listContentTypesQuerySchema, req.query, 'Invalid query parameters')

    const result = await listContentTypesForUser({ user, siteId, query })
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}

export const createContentType: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { siteId } = parseOrThrow(siteIdParamsSchema, req.params, 'Invalid site id')
    const body = parseOrThrow(createContentTypeSchema, req.body, 'Invalid request body')

    const result = await createContentTypeForUser({ user, siteId, input: body })

    await recordAudit({
      req,
      action: 'content_type.created',
      entityType: 'content_type',
      entityId: result.contentType.id,
      siteId,
      userId: user.id,
      metadata: { name: result.contentType.name, apiId: result.contentType.apiId }
    })

    sendCreated(res, result, 'Content type created')
  } catch (error) {
    next(error)
  }
}

export const getContentTypeById: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentTypeParamsSchema, req.params, 'Invalid route parameters')

    const result = await getContentTypeByIdForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId
    })
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}

export const updateContentType: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentTypeParamsSchema, req.params, 'Invalid route parameters')
    const body = parseOrThrow(updateContentTypeSchema, req.body, 'Invalid request body')

    const result = await updateContentTypeForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      input: body
    })

    await recordAudit({
      req,
      action: 'content_type.updated',
      entityType: 'content_type',
      entityId: params.contentTypeId,
      siteId: params.siteId,
      userId: user.id,
      metadata: { changes: body }
    })

    sendOk(res, result, 'Content type updated')
  } catch (error) {
    next(error)
  }
}

export const deleteContentType: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentTypeParamsSchema, req.params, 'Invalid route parameters')

    const result = await deleteContentTypeForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId
    })

    await recordAudit({
      req,
      action: 'content_type.deleted',
      entityType: 'content_type',
      entityId: params.contentTypeId,
      siteId: params.siteId,
      userId: user.id
    })

    sendOk(res, result, 'Content type deleted')
  } catch (error) {
    next(error)
  }
}

export const createContentField: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentTypeParamsSchema, req.params, 'Invalid route parameters')
    const body = parseOrThrow(createContentFieldSchema, req.body, 'Invalid request body')

    const result = await createContentFieldForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      input: body
    })

    await recordAudit({
      req,
      action: 'content_field.created',
      entityType: 'content_field',
      entityId: result.field.id,
      siteId: params.siteId,
      userId: user.id,
      metadata: {
        contentTypeId: params.contentTypeId,
        label: result.field.label,
        type: result.field.type
      }
    })

    sendCreated(res, result, 'Content field created')
  } catch (error) {
    next(error)
  }
}

export const updateContentField: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentFieldParamsSchema, req.params, 'Invalid route parameters')
    const body = parseOrThrow(updateContentFieldSchema, req.body, 'Invalid request body')

    const result = await updateContentFieldForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      fieldId: params.fieldId,
      input: body
    })

    await recordAudit({
      req,
      action: 'content_field.updated',
      entityType: 'content_field',
      entityId: params.fieldId,
      siteId: params.siteId,
      userId: user.id,
      metadata: {
        contentTypeId: params.contentTypeId,
        changes: body
      }
    })

    sendOk(res, result, 'Content field updated')
  } catch (error) {
    next(error)
  }
}

export const deleteContentField: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentFieldParamsSchema, req.params, 'Invalid route parameters')

    const result = await deleteContentFieldForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      fieldId: params.fieldId
    })

    await recordAudit({
      req,
      action: 'content_field.deleted',
      entityType: 'content_field',
      entityId: params.fieldId,
      siteId: params.siteId,
      userId: user.id,
      metadata: { contentTypeId: params.contentTypeId }
    })

    sendOk(res, result, 'Content field deleted')
  } catch (error) {
    next(error)
  }
}

export const replaceContentType: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentTypeParamsSchema, req.params, 'Invalid route parameters')
    const body = parseOrThrow(replaceContentTypeSchema, req.body, 'Invalid schema payload')

    const result = await replaceContentTypeForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      input: body
    })

    await recordAudit({
      req,
      action: 'content_type.replaced',
      entityType: 'content_type',
      entityId: params.contentTypeId,
      siteId: params.siteId,
      userId: user.id,
      metadata: {
        name: result.contentType.name,
        apiId: result.contentType.apiId,
        fieldCount: result.contentType.fields.length
      }
    })

    sendOk(res, result, 'Schema replaced')
  } catch (error) {
    next(error)
  }
}

export const reorderContentFields: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(contentTypeParamsSchema, req.params, 'Invalid route parameters')
    const body = parseOrThrow(reorderContentFieldsSchema, req.body, 'Invalid request body')

    const result = await reorderContentFieldsForUser({
      user,
      siteId: params.siteId,
      contentTypeId: params.contentTypeId,
      input: body
    })

    await recordAudit({
      req,
      action: 'content_field.reordered',
      entityType: 'content_type',
      entityId: params.contentTypeId,
      siteId: params.siteId,
      userId: user.id,
      metadata: { fieldIds: body.fieldIds }
    })

    sendOk(res, result, 'Content fields reordered')
  } catch (error) {
    next(error)
  }
}
