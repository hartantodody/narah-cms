import path from 'node:path'
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { env } from '../../config/env'
import {
  buildImageTransformer,
  type OutputFormat
} from '../../lib/image-transform'
import { prisma } from '../../lib/prisma'
import { getStorageAdapter } from '../../lib/storage'

const cacheRoot = path.isAbsolute(env.IMAGE_CACHE_DIR)
  ? env.IMAGE_CACHE_DIR
  : path.resolve(process.cwd(), env.IMAGE_CACHE_DIR)

const transformImage = buildImageTransformer({ cacheRoot })

const numericString = z.preprocess((v) => {
  if (typeof v === 'string' && v.trim() !== '') return Number(v)
  return v
}, z.number().int().positive().optional())

const renderQuerySchema = z.object({
  w: numericString,
  h: numericString,
  q: z
    .preprocess(
      (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v),
      z.number().int().min(1).max(100).optional()
    )
    .optional(),
  fit: z.enum(['cover', 'contain', 'inside', 'outside']).optional(),
  fmt: z.enum(['auto', 'webp', 'avif', 'jpeg', 'png']).optional()
})

const paramsSchema = z.object({
  assetId: z.string().uuid('A valid asset id is required.')
})

const extractFocalFromMetadata = (
  metadata: unknown
): { x: number; y: number } => {
  if (typeof metadata === 'object' && metadata !== null) {
    const m = metadata as Record<string, unknown>
    const fp = m.focalPoint
    if (typeof fp === 'object' && fp !== null) {
      const f = fp as Record<string, unknown>
      const x = typeof f.x === 'number' ? f.x : 0.5
      const y = typeof f.y === 'number' ? f.y : 0.5
      return { x, y }
    }
  }
  return { x: 0.5, y: 0.5 }
}

const extractStorageKey = (metadata: unknown): string | null => {
  if (typeof metadata === 'object' && metadata !== null) {
    const m = metadata as Record<string, unknown>
    if (typeof m.storageKey === 'string') return m.storageKey
  }
  return null
}

/**
 * Public render endpoint. No auth — anyone with the asset id can fetch the
 * transformed image. Originals are never exposed by this route.
 */
export const renderMediaAsset: RequestHandler = async (req, res, next) => {
  try {
    const params = paramsSchema.safeParse(req.params)
    if (!params.success) {
      res.status(400).json({
        message: 'Invalid asset id',
        issues: params.error.issues.map((i) => i.message)
      })
      return
    }

    const query = renderQuerySchema.safeParse(req.query)
    if (!query.success) {
      res.status(400).json({
        message: 'Invalid query parameters',
        issues: query.error.issues.map((i) => i.message)
      })
      return
    }

    const asset = await prisma.mediaAsset.findUnique({
      where: { id: params.data.assetId },
      select: { id: true, mimeType: true, metadata: true }
    })
    if (!asset) {
      res.status(404).json({ message: 'Media asset not found' })
      return
    }

    const storageKey = extractStorageKey(asset.metadata)
    if (!storageKey) {
      res.status(500).json({
        message: 'Media asset is missing storage metadata',
        code: 'MEDIA_MISSING_STORAGE_KEY'
      })
      return
    }

    const storage = getStorageAdapter()
    const focal = extractFocalFromMetadata(asset.metadata)

    const result = await transformImage({
      storageKey,
      originalMime: asset.mimeType,
      readOriginal: () => storage.read(storageKey),
      options: {
        width: query.data.w,
        height: query.data.h,
        quality: query.data.q,
        fit: query.data.fit,
        format: (query.data.fmt as OutputFormat | undefined) ?? 'auto',
        focalX: focal.x,
        focalY: focal.y
      },
      acceptHeader: req.headers.accept
    })

    // Honour If-None-Match for cheap 304s
    const inm = req.headers['if-none-match']
    if (typeof inm === 'string' && inm === result.etag) {
      res.status(304).end()
      return
    }

    res.setHeader('Content-Type', result.contentType)
    res.setHeader('ETag', result.etag)
    // Immutable: the transform output for given (assetId + params) never changes.
    // If the asset is deleted or focal point updated, the cache key changes too.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('X-Cache', result.cacheHit ? 'HIT' : 'MISS')
    res.status(200).send(result.body)
  } catch (error) {
    next(error)
  }
}
