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
 * Top-level expansion covers MEDIA + RELATION. GROUP fields are also
 * traversed one level deep: any MEDIA or RELATION children inside a
 * GROUP item get their IDs resolved into full objects, so a gallery
 * field returns objects ready to render.
 *
 * Nested expansion of related entries' own MEDIA/RELATION fields is
 * still not supported (would balloon request size — keep payloads small).
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
  /** Only set when type === 'GROUP'. Flat list (no recursion — 2-level cap). */
  groupChildren?: FieldMeta[]
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

const groupHasExpandableChild = (f: FieldMeta): boolean =>
  f.type === 'GROUP' &&
  (f.groupChildren ?? []).some(
    (c) => c.type === 'MEDIA' || c.type === 'RELATION'
  )

const resolveFieldsToPopulate = (opts: PopulateOptions): FieldMeta[] => {
  const expandable = opts.contentTypeFields.filter(
    (f) =>
      f.type === 'MEDIA' || f.type === 'RELATION' || groupHasExpandableChild(f)
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
 *
 * For GROUP fields, each item's MEDIA/RELATION children get the same
 * treatment one level deep.
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

  const collectIdsFromField = (field: FieldMeta, value: unknown) => {
    if (value == null) return
    if (field.type === 'MEDIA' || field.type === 'RELATION') {
      const items = Array.isArray(value) ? value : [value]
      for (const item of items) {
        const id = extractId(item)
        if (!id) continue
        if (field.type === 'MEDIA') mediaIds.add(id)
        else relationIds.add(id)
      }
      return
    }
    if (field.type === 'GROUP' && field.groupChildren) {
      const items = Array.isArray(value) ? value : [value]
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        for (const child of field.groupChildren) {
          if (child.type !== 'MEDIA' && child.type !== 'RELATION') continue
          const childValue = (item as Record<string, unknown>)[child.apiId]
          collectIdsFromField(child, childValue)
        }
      }
    }
  }

  for (const entry of entries) {
    const data =
      entry.data && typeof entry.data === 'object'
        ? (entry.data as Record<string, unknown>)
        : null
    if (!data) continue
    for (const field of fieldsToExpand) {
      collectIdsFromField(field, data[field.apiId])
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

  const lookupOne = (childType: string, item: unknown): unknown => {
    const id = extractId(item)
    if (!id) return item
    if (childType === 'MEDIA') return mediaMap.get(id) ?? null
    if (childType === 'RELATION') return relationMap.get(id) ?? null
    return item
  }

  const rewriteScalarOrList = (
    field: FieldMeta,
    value: unknown
  ): unknown => {
    if (Array.isArray(value)) {
      return value.map((v) => lookupOne(field.type, v)).filter((v) => v !== null)
    }
    return lookupOne(field.type, value)
  }

  const rewriteGroupItem = (
    field: FieldMeta,
    item: unknown
  ): unknown => {
    if (!item || typeof item !== 'object') return item
    const out: Record<string, unknown> = { ...(item as Record<string, unknown>) }
    for (const child of field.groupChildren ?? []) {
      if (child.type !== 'MEDIA' && child.type !== 'RELATION') continue
      if (!(child.apiId in out)) continue
      out[child.apiId] = rewriteScalarOrList(child, out[child.apiId])
    }
    return out
  }

  const rewriteValue = (field: FieldMeta, value: unknown): unknown => {
    if (field.type === 'MEDIA' || field.type === 'RELATION') {
      return rewriteScalarOrList(field, value)
    }
    if (field.type === 'GROUP') {
      if (Array.isArray(value)) {
        return value.map((item) => rewriteGroupItem(field, item))
      }
      return rewriteGroupItem(field, value)
    }
    return value
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

const parseGroupChildren = (config: unknown): FieldMeta[] | undefined => {
  if (!config || typeof config !== 'object') return undefined
  const rawChildren = (config as { children?: unknown }).children
  if (!Array.isArray(rawChildren)) return undefined
  return rawChildren
    .filter(
      (c): c is { apiId: string; type: string; isList?: boolean } =>
        c !== null &&
        typeof c === 'object' &&
        typeof (c as { apiId?: unknown }).apiId === 'string' &&
        typeof (c as { type?: unknown }).type === 'string'
    )
    .map((c) => ({
      apiId: c.apiId,
      type: c.type,
      isList: c.isList === true
    }))
}

export const getContentTypeFields = async (
  contentTypeId: string
): Promise<FieldMeta[]> => {
  const fields = await prisma.contentField.findMany({
    where: { contentTypeId },
    select: { apiId: true, type: true, isList: true, config: true }
  })
  return fields.map((f) => {
    const meta: FieldMeta = {
      apiId: f.apiId,
      type: f.type,
      isList: f.isList
    }
    if (f.type === 'GROUP') {
      meta.groupChildren = parseGroupChildren(f.config)
    }
    return meta
  })
}
