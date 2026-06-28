import type { RequestHandler } from 'express'
import multer from 'multer'
import { env } from '../../config/env'
import { parseOrThrow, requireUserOrThrow } from '../../lib/guards'
import { sendCreated, sendOk } from '../../lib/response'
import { HttpError } from '../../utils/http-error'
import { recordAudit } from '../audit/audit.service'
import {
  listMediaAssetsQuerySchema,
  mediaAssetParamsSchema,
  siteIdParamsSchema,
  updateMediaAssetSchema
} from './media-assets.schemas'
import {
  deleteMediaAssetForUser,
  downloadMediaAssetOriginalForUser,
  getMediaAssetForUser,
  listMediaAssetsForUser,
  updateMediaAssetForUser,
  uploadMediaAssetForUser
} from './media-assets.service'

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 }
}).single('file')

export const listMediaAssets: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { siteId } = parseOrThrow(siteIdParamsSchema, req.params, 'Invalid route parameters')
    const query = parseOrThrow(listMediaAssetsQuerySchema, req.query, 'Invalid query parameters')

    const result = await listMediaAssetsForUser({ user, siteId, query })
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}

export const uploadMediaAsset: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { siteId } = parseOrThrow(siteIdParamsSchema, req.params, 'Invalid route parameters')

    if (!req.file) {
      throw new HttpError({
        message: 'Missing "file" upload',
        statusCode: 400,
        code: 'NO_FILE_UPLOADED'
      })
    }

    const result = await uploadMediaAssetForUser({
      user,
      siteId,
      file: {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        buffer: req.file.buffer,
        size: req.file.size
      }
    })

    await recordAudit({
      req,
      action: 'media_asset.uploaded',
      entityType: 'media_asset',
      entityId: result.asset.id,
      siteId,
      userId: user.id,
      metadata: {
        filename: result.asset.filename,
        mimeType: result.asset.mimeType,
        sizeBytes: result.asset.sizeBytes
      }
    })

    sendCreated(res, result, 'Asset uploaded')
  } catch (error) {
    next(error)
  }
}

export const getMediaAsset: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(mediaAssetParamsSchema, req.params, 'Invalid route parameters')

    const result = await getMediaAssetForUser({
      user,
      siteId: params.siteId,
      assetId: params.assetId
    })
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
}

export const updateMediaAsset: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(mediaAssetParamsSchema, req.params, 'Invalid route parameters')
    const body = parseOrThrow(updateMediaAssetSchema, req.body, 'Invalid request body')

    const result = await updateMediaAssetForUser({
      user,
      siteId: params.siteId,
      assetId: params.assetId,
      input: body
    })

    await recordAudit({
      req,
      action: 'media_asset.updated',
      entityType: 'media_asset',
      entityId: params.assetId,
      siteId: params.siteId,
      userId: user.id,
      metadata: { changes: body }
    })

    sendOk(res, result, 'Asset updated')
  } catch (error) {
    next(error)
  }
}

export const downloadMediaAssetOriginal: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(mediaAssetParamsSchema, req.params, 'Invalid route parameters')

    const result = await downloadMediaAssetOriginalForUser({
      user,
      siteId: params.siteId,
      assetId: params.assetId
    })

    // Binary response — no envelope wrap. This endpoint streams the raw
    // original file with an attachment disposition.
    res.setHeader('Content-Type', result.mimeType)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename.replace(/"/g, '')}"`
    )
    res.setHeader('Content-Length', String(result.body.byteLength))
    res.setHeader('Cache-Control', 'private, no-store')
    res.status(200).send(result.body)
  } catch (error) {
    next(error)
  }
}

export const deleteMediaAsset: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const params = parseOrThrow(mediaAssetParamsSchema, req.params, 'Invalid route parameters')

    const result = await deleteMediaAssetForUser({
      user,
      siteId: params.siteId,
      assetId: params.assetId
    })

    await recordAudit({
      req,
      action: 'media_asset.deleted',
      entityType: 'media_asset',
      entityId: params.assetId,
      siteId: params.siteId,
      userId: user.id
    })

    sendOk(res, result, 'Asset deleted')
  } catch (error) {
    next(error)
  }
}
