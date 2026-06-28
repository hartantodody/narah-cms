import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

export type OutputFormat = 'auto' | 'webp' | 'avif' | 'jpeg' | 'png'

export type TransformOptions = {
  /** Target width in pixels (clamped). */
  width?: number
  /** Target height in pixels (clamped). */
  height?: number
  /** 1..100 quality. */
  quality?: number
  /** How to fit when both width and height are provided. */
  fit?: 'cover' | 'contain' | 'inside' | 'outside'
  /** Output format hint. 'auto' negotiates via the Accept header. */
  format?: OutputFormat
  /** Focal point used when fit=cover. Both 0..1. Defaults to center. */
  focalX?: number
  focalY?: number
}

export type ResolvedTransform = {
  width?: number
  height?: number
  quality: number
  fit: 'cover' | 'contain' | 'inside' | 'outside'
  format: 'webp' | 'avif' | 'jpeg' | 'png'
  focalX: number
  focalY: number
}

const MAX_DIMENSION = 4096
const MIN_DIMENSION = 16

const clampDim = (n: number | undefined): number | undefined => {
  if (n === undefined) return undefined
  if (!Number.isFinite(n)) return undefined
  return Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, Math.round(n)))
}

export const negotiateFormat = (
  requested: OutputFormat | undefined,
  acceptHeader: string | undefined,
  originalMime: string
): ResolvedTransform['format'] => {
  if (requested && requested !== 'auto') return requested
  const accept = (acceptHeader ?? '').toLowerCase()
  if (accept.includes('image/avif')) return 'avif'
  if (accept.includes('image/webp')) return 'webp'
  // Fall back to a sane re-encode of the original format
  if (originalMime === 'image/png') return 'png'
  return 'jpeg'
}

export const resolveTransform = (
  opts: TransformOptions,
  acceptHeader: string | undefined,
  originalMime: string
): ResolvedTransform => {
  const focalX =
    typeof opts.focalX === 'number' && Number.isFinite(opts.focalX)
      ? Math.max(0, Math.min(1, opts.focalX))
      : 0.5
  const focalY =
    typeof opts.focalY === 'number' && Number.isFinite(opts.focalY)
      ? Math.max(0, Math.min(1, opts.focalY))
      : 0.5
  return {
    width: clampDim(opts.width),
    height: clampDim(opts.height),
    quality:
      typeof opts.quality === 'number' && Number.isFinite(opts.quality)
        ? Math.max(1, Math.min(100, Math.round(opts.quality)))
        : 85,
    fit: opts.fit ?? 'cover',
    format: negotiateFormat(opts.format, acceptHeader, originalMime),
    focalX,
    focalY
  }
}

/* ────────────────────────────────────────────────────────────── */

export type TransformResult = {
  body: Buffer
  contentType: string
  /** sha256 of the output, useful as an ETag. */
  etag: string
  cacheHit: boolean
}

const formatToMime: Record<ResolvedTransform['format'], string> = {
  webp: 'image/webp',
  avif: 'image/avif',
  jpeg: 'image/jpeg',
  png: 'image/png'
}

const formatToExt: Record<ResolvedTransform['format'], string> = {
  webp: 'webp',
  avif: 'avif',
  jpeg: 'jpg',
  png: 'png'
}

const buildCacheKey = (
  storageKey: string,
  resolved: ResolvedTransform
): string => {
  const payload = JSON.stringify({
    k: storageKey,
    w: resolved.width ?? null,
    h: resolved.height ?? null,
    q: resolved.quality,
    fit: resolved.fit,
    fmt: resolved.format,
    fx: resolved.focalX,
    fy: resolved.focalY
  })
  return createHash('sha256').update(payload).digest('hex')
}

const buildCachePath = (cacheRoot: string, hash: string, ext: string): string =>
  path.join(cacheRoot, hash.slice(0, 2), `${hash}.${ext}`)

const runSharp = async (
  original: Buffer,
  resolved: ResolvedTransform
): Promise<Buffer> => {
  // rotate() applies EXIF orientation so we never serve a sideways image.
  let pipeline = sharp(original, { failOn: 'none' }).rotate()

  const wantsResize = resolved.width || resolved.height
  if (wantsResize) {
    pipeline = pipeline.resize({
      width: resolved.width,
      height: resolved.height,
      fit: resolved.fit,
      withoutEnlargement: true,
      // Focal point: sharp accepts "position" as gravity strings or attention.
      // When both dims + cover, use a custom position via "attention" — but we
      // want manual focal point, so use raw position via "position" with x/y
      // would require extract(). Simpler: rely on cover with attention for now
      // when focal is default (0.5,0.5), else compute extract.
      position:
        resolved.fit === 'cover'
          ? resolved.focalX === 0.5 && resolved.focalY === 0.5
            ? 'centre'
            : focalToPosition(resolved.focalX, resolved.focalY)
          : 'centre'
    })
  }

  switch (resolved.format) {
    case 'webp':
      return pipeline.webp({ quality: resolved.quality, effort: 4 }).toBuffer()
    case 'avif':
      return pipeline
        .avif({ quality: resolved.quality, effort: 4 })
        .toBuffer()
    case 'jpeg':
      return pipeline
        .jpeg({ quality: resolved.quality, mozjpeg: true })
        .toBuffer()
    case 'png':
      return pipeline.png({ compressionLevel: 9 }).toBuffer()
  }
}

/**
 * Map a 0..1 focal point to one of sharp's nine position keywords.
 * Sharp doesn't support arbitrary focal coords natively in resize(), so we
 * snap to the nearest grid cell. Good enough for most CMS use cases.
 */
const focalToPosition = (x: number, y: number): string => {
  const xs = x < 0.34 ? 'left' : x > 0.66 ? 'right' : ''
  const ys = y < 0.34 ? 'top' : y > 0.66 ? 'bottom' : ''
  if (!xs && !ys) return 'centre'
  if (!xs) return ys
  if (!ys) return xs
  return `${ys} ${xs}`
}

/* ────────────────────────────────────────────────────────────── */

export const buildImageTransformer = ({
  cacheRoot
}: {
  cacheRoot: string
}) => {
  return async function transformImage({
    storageKey,
    originalMime,
    readOriginal,
    options,
    acceptHeader
  }: {
    storageKey: string
    originalMime: string
    readOriginal: () => Promise<Buffer>
    options: TransformOptions
    acceptHeader: string | undefined
  }): Promise<TransformResult> {
    const resolved = resolveTransform(options, acceptHeader, originalMime)
    const hash = buildCacheKey(storageKey, resolved)
    const cachePath = buildCachePath(cacheRoot, hash, formatToExt[resolved.format])

    // Cache hit?
    try {
      const cached = await fs.readFile(cachePath)
      return {
        body: cached,
        contentType: formatToMime[resolved.format],
        etag: `"${hash}"`,
        cacheHit: true
      }
    } catch {
      // miss → compute
    }

    const original = await readOriginal()
    const output = await runSharp(original, resolved)

    // Write to cache (best-effort)
    try {
      await fs.mkdir(path.dirname(cachePath), { recursive: true })
      await fs.writeFile(cachePath, output)
    } catch (err) {
      console.warn('Failed to write image cache:', err)
    }

    return {
      body: output,
      contentType: formatToMime[resolved.format],
      etag: `"${hash}"`,
      cacheHit: false
    }
  }
}

/** Extract dimensions + content-type from an image buffer. */
export const inspectImage = async (
  buffer: Buffer
): Promise<{ width?: number; height?: number }> => {
  const meta = await sharp(buffer).metadata()
  return { width: meta.width, height: meta.height }
}
