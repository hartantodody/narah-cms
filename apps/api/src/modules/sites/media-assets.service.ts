import path from 'node:path'
import { randomUUID } from 'node:crypto'
import mime from 'mime-types'
import type { Prisma } from '../../../generated/prisma/client'
import { env } from '../../config/env'
import { inspectImage } from '../../lib/image-transform'
import { prisma } from '../../lib/prisma'
import { getStorageAdapter } from '../../lib/storage'
import { HttpError } from '../../utils/http-error'
import type { AuthenticatedRequestUser } from '../auth/auth.types'
import { canAccessSite, canEditSiteContent } from './sites.authorization'
import type {
  ListMediaAssetsQuery,
  UpdateMediaAssetInput
} from './media-assets.schemas'

const apiPublicBaseUrl = (): string =>
  env.API_PUBLIC_BASE_URL?.replace(/\/+$/, '') ??
  `http://localhost:${env.PORT}`

const buildRenderUrl = (assetId: string, defaultWidth = 1600): string =>
  `${apiPublicBaseUrl()}/api/media/${assetId}?w=${defaultWidth}`

const ALLOWED_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
])

const mediaAssetSelect = {
  id: true,
  siteId: true,
  filename: true,
  url: true,
  mimeType: true,
  sizeBytes: true,
  altText: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { id: true, name: true, email: true } }
} satisfies Prisma.MediaAssetSelect

type MediaAssetRecord = Prisma.MediaAssetGetPayload<{
  select: typeof mediaAssetSelect
}>

const extractFocalPoint = (
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

const extractDimensions = (
  metadata: unknown
): { width: number | null; height: number | null } => {
  if (typeof metadata === 'object' && metadata !== null) {
    const m = metadata as Record<string, unknown>
    return {
      width: typeof m.width === 'number' ? m.width : null,
      height: typeof m.height === 'number' ? m.height : null
    }
  }
  return { width: null, height: null }
}

const serializeMediaAsset = (asset: MediaAssetRecord) => {
  const focal = extractFocalPoint(asset.metadata)
  const dims = extractDimensions(asset.metadata)
  return {
    id: asset.id,
    siteId: asset.siteId,
    filename: asset.filename,
    /** Public render URL (transformed). Originals not exposed. */
    url: buildRenderUrl(asset.id),
    mimeType: asset.mimeType,
    sizeBytes: Number(asset.sizeBytes),
    altText: asset.altText,
    width: dims.width,
    height: dims.height,
    focalPoint: focal,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    uploadedBy: asset.uploadedBy
  }
}

const ensureSiteAndAccess = async (
  user: AuthenticatedRequestUser,
  siteId: string
) => {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true }
  })
  if (!site) {
    throw new HttpError({
      message: 'Site not found',
      statusCode: 404,
      code: 'SITE_NOT_FOUND'
    })
  }
  if (!(await canAccessSite(user, siteId))) {
    throw new HttpError({
      message: 'You do not have access to this site',
      statusCode: 403,
      code: 'FORBIDDEN'
    })
  }
}

const ensureContentEditAccess = async (
  user: AuthenticatedRequestUser,
  siteId: string
) => {
  if (!(await canEditSiteContent(user, siteId))) {
    throw new HttpError({
      message: 'You do not have permission to manage media for this site',
      statusCode: 403,
      code: 'FORBIDDEN'
    })
  }
}

const sanitizeFilename = (input: string): string => {
  const base = input.split(/[\\/]/).pop() ?? input
  return (
    base
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 120) || 'file'
  )
}

const buildStorageKey = ({
  siteId,
  filename
}: {
  siteId: string
  filename: string
}): string => {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const ext = path.extname(filename) || ''
  const stem = path.basename(filename, ext)
  const unique = randomUUID().slice(0, 8)
  return `${siteId}/${yyyy}/${mm}/${stem}-${unique}${ext}`
}

/* ─────────────────────────────────────────────────────────── */

export const listMediaAssetsForUser = async ({
  user,
  siteId,
  query
}: {
  user: AuthenticatedRequestUser
  siteId: string
  query: ListMediaAssetsQuery
}) => {
  await ensureSiteAndAccess(user, siteId)

  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 24

  const where: Prisma.MediaAssetWhereInput = { siteId }
  if (query.search) {
    where.filename = { contains: query.search, mode: 'insensitive' }
  }
  if (query.mimeTypePrefix) {
    where.mimeType = { startsWith: query.mimeTypePrefix }
  }

  const [items, total] = await prisma.$transaction([
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
      select: mediaAssetSelect
    }),
    prisma.mediaAsset.count({ where })
  ])

  return {
    items: items.map(serializeMediaAsset),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  }
}

export const getMediaAssetForUser = async ({
  user,
  siteId,
  assetId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  assetId: string
}) => {
  await ensureSiteAndAccess(user, siteId)
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: assetId, siteId },
    select: mediaAssetSelect
  })
  if (!asset) {
    throw new HttpError({
      message: 'Media asset not found',
      statusCode: 404,
      code: 'MEDIA_ASSET_NOT_FOUND'
    })
  }
  return { asset: serializeMediaAsset(asset) }
}

export const uploadMediaAssetForUser = async ({
  user,
  siteId,
  file
}: {
  user: AuthenticatedRequestUser
  siteId: string
  file: {
    originalname: string
    mimetype: string
    buffer: Buffer
    size: number
  }
}) => {
  await ensureSiteAndAccess(user, siteId)
  await ensureContentEditAccess(user, siteId)

  // Validate MIME type
  const detectedMime = file.mimetype || mime.lookup(file.originalname) || 'application/octet-stream'
  if (!ALLOWED_MIME_TYPES.has(detectedMime)) {
    throw new HttpError({
      message: `File type "${detectedMime}" is not allowed. Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}.`,
      statusCode: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE'
    })
  }

  const filename = sanitizeFilename(file.originalname)
  const key = buildStorageKey({ siteId, filename })

  const storage = getStorageAdapter()
  const upload = await storage.upload({
    key,
    body: file.buffer,
    contentType: detectedMime
  })

  // Extract dimensions for responsive image hints; ignore errors gracefully.
  let width: number | null = null
  let height: number | null = null
  try {
    const meta = await inspectImage(file.buffer)
    width = meta.width ?? null
    height = meta.height ?? null
  } catch (err) {
    console.warn('Failed to inspect image dimensions:', err)
  }

  const created = await prisma.mediaAsset.create({
    data: {
      siteId,
      uploadedById: user.id,
      filename,
      // `url` column kept for legacy reference. The serializer always emits
      // the render endpoint URL anyway.
      url: upload.url,
      mimeType: detectedMime,
      sizeBytes: BigInt(upload.sizeBytes),
      altText: null,
      metadata: {
        storageKey: key,
        width,
        height,
        focalPoint: { x: 0.5, y: 0.5 }
      } as Prisma.InputJsonValue
    },
    select: mediaAssetSelect
  })

  return { asset: serializeMediaAsset(created) }
}

export const updateMediaAssetForUser = async ({
  user,
  siteId,
  assetId,
  input
}: {
  user: AuthenticatedRequestUser
  siteId: string
  assetId: string
  input: UpdateMediaAssetInput
}) => {
  await ensureSiteAndAccess(user, siteId)
  await ensureContentEditAccess(user, siteId)

  const existing = await prisma.mediaAsset.findFirst({
    where: { id: assetId, siteId },
    select: { id: true }
  })
  if (!existing) {
    throw new HttpError({
      message: 'Media asset not found',
      statusCode: 404,
      code: 'MEDIA_ASSET_NOT_FOUND'
    })
  }

  const data: Prisma.MediaAssetUpdateInput = {}
  if (input.filename !== undefined) data.filename = sanitizeFilename(input.filename)
  if (input.altText !== undefined) data.altText = input.altText

  // Merge focalPoint into existing metadata without losing storageKey/etc.
  if (input.focalPoint !== undefined) {
    const current = await prisma.mediaAsset.findUnique({
      where: { id: assetId },
      select: { metadata: true }
    })
    const existingMeta =
      current?.metadata && typeof current.metadata === 'object'
        ? (current.metadata as Record<string, unknown>)
        : {}
    const nextMeta = {
      ...existingMeta,
      focalPoint:
        input.focalPoint === null
          ? { x: 0.5, y: 0.5 }
          : { x: input.focalPoint.x, y: input.focalPoint.y }
    }
    data.metadata = nextMeta as Prisma.InputJsonValue
  }

  const updated = await prisma.mediaAsset.update({
    where: { id: assetId },
    data,
    select: mediaAssetSelect
  })
  return { asset: serializeMediaAsset(updated) }
}

export const downloadMediaAssetOriginalForUser = async ({
  user,
  siteId,
  assetId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  assetId: string
}) => {
  await ensureSiteAndAccess(user, siteId)
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: assetId, siteId },
    select: {
      filename: true,
      mimeType: true,
      metadata: true
    }
  })
  if (!asset) {
    throw new HttpError({
      message: 'Media asset not found',
      statusCode: 404,
      code: 'MEDIA_ASSET_NOT_FOUND'
    })
  }
  const meta =
    typeof asset.metadata === 'object' && asset.metadata !== null
      ? (asset.metadata as Record<string, unknown>)
      : {}
  const storageKey = typeof meta.storageKey === 'string' ? meta.storageKey : null
  if (!storageKey) {
    throw new HttpError({
      message: 'Media asset is missing storage metadata',
      statusCode: 500,
      code: 'MEDIA_MISSING_STORAGE_KEY'
    })
  }
  const storage = getStorageAdapter()
  const body = await storage.read(storageKey)
  return {
    filename: asset.filename,
    mimeType: asset.mimeType,
    body
  }
}

export const deleteMediaAssetForUser = async ({
  user,
  siteId,
  assetId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  assetId: string
}) => {
  await ensureSiteAndAccess(user, siteId)
  await ensureContentEditAccess(user, siteId)

  const existing = await prisma.mediaAsset.findFirst({
    where: { id: assetId, siteId },
    select: { id: true, metadata: true }
  })
  if (!existing) {
    throw new HttpError({
      message: 'Media asset not found',
      statusCode: 404,
      code: 'MEDIA_ASSET_NOT_FOUND'
    })
  }

  // Best-effort delete from storage
  const meta =
    typeof existing.metadata === 'object' && existing.metadata !== null
      ? (existing.metadata as Record<string, unknown>)
      : {}
  const storageKey = typeof meta.storageKey === 'string' ? meta.storageKey : null
  if (storageKey) {
    try {
      const storage = getStorageAdapter()
      await storage.delete(storageKey)
    } catch (err) {
      // Log and continue; the DB record removal is still desirable.
      console.warn('Failed to delete media file from storage:', err)
    }
  }

  await prisma.mediaAsset.delete({ where: { id: assetId } })
  return { id: assetId, deleted: true }
}
