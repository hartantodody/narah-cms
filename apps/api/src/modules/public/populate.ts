import {
  ContentEntryStatus,
  type Prisma
} from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'

/**
 * Populate (field expansion) for the public delivery API.
 *
 * Syntax:
 *   ?populate=heroImage,author          → expand these specific top-level fields
 *   ?populate=*                         → expand every MEDIA + RELATION field
 *
 * Only top-level fields are expanded (nested expansion of related entries'
 * own MEDIA/RELATION fields is not yet supported — keep request shape small).
 *
 * MEDIA value shapes accepted (matches validateAndNormalizeEntryData):
 *   - "<uuid>"
 *   - { id: "<uuid>", url?, alt? }
 *   - [<above>...] when field.isList
 *
 * RELATION value shapes accepted:
 *   - "<uuid>"
 *   - { id: "<uuid>", slug?, contentTypeApiId? }
 *   - [<above>...] when field.isList
 */

type FieldMeta = {
  apiId: string
  type: string
  isList: boolean
}

type PopulateOptions = {
  /** Top-level field apiIds to expand, or '*' to expand all media + relation. */
  fields: string[] | '*'
  /** All fields of the content type — used to know each field's type. */
  contentTypeFields: FieldMeta[]
  /**
   * When true, relation expansion includes DRAFT entries in addition to
   * PUBLISHED. Caller is responsible for verifying the API key carries the
   * draft-read scope before passing this.
   */
  preview?: boolean
}

const mediaAssetSelect = {
  id: true,
  filename: true,
  url: true,
  mimeType: true,
  sizeBytes: true,
  altText: true,
  metadata: true,
  createdAt: true
} satisfies Prisma.MediaAssetSelect

const relationEntrySelect = {
  id: true,
  slug: true,
  data: true,
  publishedAt: true,
  updatedAt: true,
  contentType: { select: { apiId: true, name: true } }
} satisfies Prisma.ContentEntrySelect

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

const extractId = (v: unknown): string | null => {
  if (isUuid(v)) return v
  if (v && typeof v === 'object' && 'id' in v) {
    const id = (v as { id: unknown }).id
    if (isUuid(id)) return id
  }
  return null
}

const serializeMediaAsset = (
  asset: Prisma.MediaAssetGetPayload<{ select: typeof mediaAssetSelect }>
) => ({
  id: asset.id,
  filename: asset.filename,
  url: asset.url,
  mimeType: asset.mimeType,
  sizeBytes: Number(asset.sizeBytes),
  altText: asset.altText,
  metadata: asset.metadata,
  createdAt: asset.createdAt
})

const serializeRelationEntry = (
  entry: Prisma.ContentEntryGetPayload<{ select: typeof relationEntrySelect }>
) => ({
  id: entry.id,
  slug: entry.slug,
  contentType: entry.contentType.apiId,
  publishedAt: entry.publishedAt,
  updatedAt: entry.updatedAt,
  data: entry.data
})

/**
 * Parse the populate query string. Returns either the wildcard or a list of
 * normalized field apiIds. Returns null when no populate is requested.
 */
export const parsePopulate = (
  raw: string | string[] | undefined
): string[] | '*' | null => {
  if (raw === undefined) return null
  const str = Array.isArray(raw) ? raw.join(',') : raw
  const trimmed = str.trim()
  if (!trimmed) return null
  if (trimmed === '*') return '*'
  const fields = trimmed
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)
  return fields.length > 0 ? fields : null
}

const resolveFieldsToPopulate = (opts: PopulateOptions): FieldMeta[] => {
  const expandable = opts.contentTypeFields.filter(
    (f) => f.type === 'MEDIA' || f.type === 'RELATION'
  )
  if (opts.fields === '*') return expandable
  const wanted = new Set(opts.fields)
  return expandable.filter((f) => wanted.has(f.apiId))
}

/**
 * Expand MEDIA + RELATION fields on a list of entries' `data` payloads.
 * Mutates the entries array shape: returns a new list of entries with the
 * same shape but `data` rewritten so expanded fields contain full nested
 * objects instead of raw IDs.
 */
export const expandEntries = async <
  T extends { data: unknown; siteId?: string | null }
>(
  entries: T[],
  opts: PopulateOptions,
  siteId: string
): Promise<T[]> => {
  if (entries.length === 0) return entries
  const fieldsToExpand = resolveFieldsToPopulate(opts)
  if (fieldsToExpand.length === 0) return entries

  const mediaIds = new Set<string>()
  const relationIds = new Set<string>()

  for (const entry of entries) {
    const data =
      entry.data && typeof entry.data === 'object'
        ? (entry.data as Record<string, unknown>)
        : null
    if (!data) continue
    for (const field of fieldsToExpand) {
      const value = data[field.apiId]
      if (value == null) continue
      const items = Array.isArray(value) ? value : [value]
      for (const item of items) {
        const id = extractId(item)
        if (!id) continue
        if (field.type === 'MEDIA') mediaIds.add(id)
        else if (field.type === 'RELATION') relationIds.add(id)
      }
    }
  }

  const [mediaAssets, relationEntries] = await Promise.all([
    mediaIds.size > 0
      ? prisma.mediaAsset.findMany({
          where: { id: { in: [...mediaIds] }, siteId },
          select: mediaAssetSelect
        })
      : Promise.resolve([]),
    relationIds.size > 0
      ? prisma.contentEntry.findMany({
          where: {
            id: { in: [...relationIds] },
            siteId,
            status: opts.preview
              ? { in: [ContentEntryStatus.DRAFT, ContentEntryStatus.PUBLISHED] }
              : ContentEntryStatus.PUBLISHED
          },
          select: relationEntrySelect
        })
      : Promise.resolve([])
  ])

  const mediaMap = new Map(mediaAssets.map((a) => [a.id, serializeMediaAsset(a)]))
  const relationMap = new Map(
    relationEntries.map((e) => [e.id, serializeRelationEntry(e)])
  )

  const rewriteValue = (
    field: FieldMeta,
    value: unknown
  ): unknown => {
    const lookup = (item: unknown): unknown => {
      const id = extractId(item)
      if (!id) return item
      if (field.type === 'MEDIA') return mediaMap.get(id) ?? null
      if (field.type === 'RELATION') return relationMap.get(id) ?? null
      return item
    }
    if (Array.isArray(value)) {
      return value.map(lookup).filter((v) => v !== null)
    }
    return lookup(value)
  }

  return entries.map((entry) => {
    const data =
      entry.data && typeof entry.data === 'object'
        ? { ...(entry.data as Record<string, unknown>) }
        : null
    if (!data) return entry
    for (const field of fieldsToExpand) {
      if (!(field.apiId in data)) continue
      data[field.apiId] = rewriteValue(field, data[field.apiId])
    }
    return { ...entry, data }
  })
}

export const getContentTypeFields = async (
  contentTypeId: string
): Promise<FieldMeta[]> => {
  const fields = await prisma.contentField.findMany({
    where: { contentTypeId },
    select: { apiId: true, type: true, isList: true }
  })
  return fields.map((f) => ({
    apiId: f.apiId,
    type: f.type,
    isList: f.isList
  }))
}
