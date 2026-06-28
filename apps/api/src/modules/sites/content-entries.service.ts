import {
  ContentEntryStatus,
  ContentFieldType,
  type Prisma
} from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { HttpError } from '../../utils/http-error'
import type { AuthenticatedRequestUser } from '../auth/auth.types'
import { canAccessSite, canEditSiteContent } from './sites.authorization'
import type {
  CreateContentEntryInput,
  ListContentEntriesQuery,
  UpdateContentEntryInput
} from './content-entries.schemas'

/* ────────────────────────────────────────────────────────────────────────── */
/*  Selects                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const entryListSelect = {
  id: true,
  slug: true,
  status: true,
  version: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
  updatedBy: { select: { id: true, name: true, email: true } }
} satisfies Prisma.ContentEntrySelect

const entryDetailSelect = {
  id: true,
  siteId: true,
  contentTypeId: true,
  slug: true,
  status: true,
  data: true,
  version: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
  updatedBy: { select: { id: true, name: true, email: true } }
} satisfies Prisma.ContentEntrySelect

type EntryListRecord = Prisma.ContentEntryGetPayload<{
  select: typeof entryListSelect
}>
type EntryDetailRecord = Prisma.ContentEntryGetPayload<{
  select: typeof entryDetailSelect
}>

/* ────────────────────────────────────────────────────────────────────────── */
/*  Revisions                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

const REVISION_RETENTION = 10

const revisionDetailSelect = {
  id: true,
  entryId: true,
  version: true,
  status: true,
  data: true,
  createdAt: true,
  author: { select: { id: true, name: true, email: true } }
} satisfies Prisma.ContentEntryRevisionSelect

const revisionListSelect = {
  id: true,
  entryId: true,
  version: true,
  status: true,
  createdAt: true,
  author: { select: { id: true, name: true, email: true } }
} satisfies Prisma.ContentEntryRevisionSelect

type RevisionListRecord = Prisma.ContentEntryRevisionGetPayload<{
  select: typeof revisionListSelect
}>
type RevisionDetailRecord = Prisma.ContentEntryRevisionGetPayload<{
  select: typeof revisionDetailSelect
}>

const serializeRevisionListItem = (record: RevisionListRecord) => ({
  id: record.id,
  entryId: record.entryId,
  version: record.version,
  status: record.status,
  createdAt: record.createdAt.toISOString(),
  author: record.author
})

const serializeRevisionDetail = (record: RevisionDetailRecord) => ({
  ...serializeRevisionListItem(record),
  data: record.data as Record<string, unknown>
})

// Snapshot the current state of an entry as a revision row. Must be invoked
// inside the same transaction that performs the entry update so the snapshot
// matches what the editor was looking at.
const snapshotEntryRevision = async (
  tx: Prisma.TransactionClient,
  entry: { id: string; version: number; status: ContentEntryStatus; data: Prisma.JsonValue },
  authorId: string
) => {
  await tx.contentEntryRevision.create({
    data: {
      entryId: entry.id,
      version: entry.version,
      status: entry.status,
      data: entry.data as Prisma.InputJsonValue,
      authorId
    }
  })

  // Prune older revisions beyond the retention window. Keep the most recent
  // REVISION_RETENTION rows by createdAt.
  const stale = await tx.contentEntryRevision.findMany({
    where: { entryId: entry.id },
    orderBy: { createdAt: 'desc' },
    skip: REVISION_RETENTION,
    select: { id: true }
  })
  if (stale.length > 0) {
    await tx.contentEntryRevision.deleteMany({
      where: { id: { in: stale.map((r) => r.id) } }
    })
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Errors / guards                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const isPrismaUniqueConstraintError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code: unknown }).code === 'P2002'

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
      message: 'You do not have permission to edit content for this site',
      statusCode: 403,
      code: 'FORBIDDEN'
    })
  }
}

const loadContentTypeWithFields = async (
  siteId: string,
  contentTypeId: string
) => {
  const contentType = await prisma.contentType.findFirst({
    where: { id: contentTypeId, siteId },
    select: {
      id: true,
      apiId: true,
      isSingleton: true,
      fields: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          apiId: true,
          label: true,
          type: true,
          required: true,
          isList: true,
          localized: true,
          config: true,
          validation: true,
          defaultValue: true
        }
      }
    }
  })
  if (!contentType) {
    throw new HttpError({
      message: 'Content type not found',
      statusCode: 404,
      code: 'CONTENT_TYPE_NOT_FOUND'
    })
  }
  return contentType
}

const loadEntryOrThrow = async (siteId: string, entryId: string) => {
  const entry = await prisma.contentEntry.findFirst({
    where: { id: entryId, siteId },
    select: entryDetailSelect
  })
  if (!entry) {
    throw new HttpError({
      message: 'Content entry not found',
      statusCode: 404,
      code: 'CONTENT_ENTRY_NOT_FOUND'
    })
  }
  return entry
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Data validation against schema                                            */
/* ────────────────────────────────────────────────────────────────────────── */

type FieldDef = {
  id: string
  apiId: string
  label: string
  type: ContentFieldType
  required: boolean
  isList: boolean
  localized: boolean
  config: unknown
  validation: unknown
  defaultValue: unknown
}

type JsonObject = Record<string, unknown>

const isPlainObject = (v: unknown): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const validateScalar = (
  field: FieldDef,
  raw: unknown
): { value: unknown; issues: string[] } => {
  const issues: string[] = []
  const path = field.apiId
  const validation = isPlainObject(field.validation) ? field.validation : {}
  const config = isPlainObject(field.config) ? field.config : {}

  if (raw === null || raw === undefined) {
    return { value: null, issues }
  }

  switch (field.type) {
    case ContentFieldType.TEXT: {
      if (typeof raw !== 'string') {
        issues.push(`${path} must be a string.`)
        return { value: null, issues }
      }
      if (typeof validation.minLength === 'number' && raw.length < validation.minLength) {
        issues.push(`${path} must be at least ${validation.minLength} characters.`)
      }
      if (typeof validation.maxLength === 'number' && raw.length > validation.maxLength) {
        issues.push(`${path} must be at most ${validation.maxLength} characters.`)
      }
      if (typeof validation.pattern === 'string' && validation.pattern.length > 0) {
        try {
          if (!new RegExp(validation.pattern).test(raw)) {
            issues.push(`${path} does not match the required pattern.`)
          }
        } catch {
          // ignore malformed pattern
        }
      }
      return { value: raw, issues }
    }

    case ContentFieldType.RICH_TEXT: {
      // TipTap JSON document: { type: "doc", content: [...] }
      // Also accept legacy plain strings.
      if (typeof raw === 'string') {
        return { value: raw, issues }
      }
      if (
        isPlainObject(raw) &&
        (raw as { type?: unknown }).type === 'doc'
      ) {
        return { value: raw, issues }
      }
      issues.push(`${path} must be a TipTap document (type: "doc") or string.`)
      return { value: null, issues }
    }

    case ContentFieldType.NUMBER: {
      const n =
        typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
      if (!Number.isFinite(n)) {
        issues.push(`${path} must be a finite number.`)
        return { value: null, issues }
      }
      if (typeof validation.min === 'number' && n < validation.min) {
        issues.push(`${path} must be at least ${validation.min}.`)
      }
      if (typeof validation.max === 'number' && n > validation.max) {
        issues.push(`${path} must be at most ${validation.max}.`)
      }
      if (validation.integer === true && !Number.isInteger(n)) {
        issues.push(`${path} must be an integer.`)
      }
      return { value: n, issues }
    }

    case ContentFieldType.BOOLEAN: {
      if (typeof raw !== 'boolean') {
        issues.push(`${path} must be a boolean.`)
        return { value: null, issues }
      }
      return { value: raw, issues }
    }

    case ContentFieldType.DATE: {
      if (typeof raw !== 'string' || !ISO_DATE_RE.test(raw)) {
        issues.push(`${path} must be an ISO date string (YYYY-MM-DD).`)
        return { value: null, issues }
      }
      return { value: raw, issues }
    }

    case ContentFieldType.DATETIME: {
      if (typeof raw !== 'string') {
        issues.push(`${path} must be an ISO datetime string.`)
        return { value: null, issues }
      }
      const d = new Date(raw)
      if (Number.isNaN(d.getTime())) {
        issues.push(`${path} must be a valid ISO datetime.`)
        return { value: null, issues }
      }
      return { value: d.toISOString(), issues }
    }

    case ContentFieldType.JSON: {
      // accept any JSON; just check it's serializable structure
      return { value: raw, issues }
    }

    case ContentFieldType.SELECT: {
      if (typeof raw !== 'string') {
        issues.push(`${path} must be a string value from the option list.`)
        return { value: null, issues }
      }
      const options = Array.isArray(config.options) ? config.options : null
      if (options) {
        const values = options
          .map((opt) =>
            isPlainObject(opt) && typeof opt.value === 'string'
              ? opt.value
              : typeof opt === 'string'
                ? opt
                : null
          )
          .filter((v): v is string => v !== null)
        if (values.length > 0 && !values.includes(raw)) {
          issues.push(`${path} must be one of: ${values.join(', ')}.`)
        }
      }
      return { value: raw, issues }
    }

    case ContentFieldType.MULTI_SELECT: {
      // handled as a list — see below
      issues.push(`${path} multi-select must be provided as an array of values.`)
      return { value: null, issues }
    }

    case ContentFieldType.RELATION: {
      // Accept either a UUID string OR an entry reference object:
      //   { id, slug?, contentTypeApiId? }
      // The object form lets the admin store the slug too so consumers can
      // build URLs without an extra lookup.
      if (typeof raw === 'string' && UUID_RE.test(raw)) {
        return { value: raw, issues }
      }
      if (
        isPlainObject(raw) &&
        typeof (raw as { id?: unknown }).id === 'string' &&
        UUID_RE.test((raw as { id: string }).id)
      ) {
        const r = raw as {
          id: string
          slug?: unknown
          contentTypeApiId?: unknown
        }
        const normalized: {
          id: string
          slug?: string | null
          contentTypeApiId?: string
        } = { id: r.id }
        if (typeof r.slug === 'string' || r.slug === null) {
          normalized.slug = r.slug as string | null
        }
        if (typeof r.contentTypeApiId === 'string') {
          normalized.contentTypeApiId = r.contentTypeApiId
        }
        return { value: normalized, issues }
      }
      issues.push(`${path} must be an entry reference ({ id } or UUID string).`)
      return { value: null, issues }
    }

    case ContentFieldType.MEDIA: {
      // Accept an asset reference object: { id?, url, alt? }
      // Or a UUID string (legacy / lightweight).
      if (typeof raw === 'string' && UUID_RE.test(raw)) {
        return { value: raw, issues }
      }
      if (
        isPlainObject(raw) &&
        typeof (raw as { url?: unknown }).url === 'string'
      ) {
        const r = raw as { id?: unknown; url: string; alt?: unknown }
        const normalized: { id?: string; url: string; alt?: string | null } = {
          url: r.url
        }
        if (typeof r.id === 'string') normalized.id = r.id
        if (typeof r.alt === 'string' || r.alt === null) normalized.alt = r.alt as string | null
        return { value: normalized, issues }
      }
      issues.push(`${path} must be a media asset reference (url required).`)
      return { value: null, issues }
    }

    default:
      return { value: raw, issues }
  }
}

/**
 * Stable JSON-stringify that sorts object keys recursively so that two
 * JSON shapes with the same content but different key order produce the
 * same string. Used for no-op detection on entry saves — PostgreSQL JSONB
 * does not preserve insertion order, so a plain JSON.stringify is unsafe.
 */
const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value as Record<string, unknown>).sort()
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`
  )
  return `{${parts.join(',')}}`
}

const validateAndNormalizeEntryData = (
  fields: FieldDef[],
  rawData: unknown
): { data: JsonObject; issues: string[] } => {
  const data: JsonObject = {}
  const issues: string[] = []

  const incoming = isPlainObject(rawData) ? rawData : {}

  for (const field of fields) {
    const raw = incoming[field.apiId]
    const isMissing = raw === undefined || raw === null || raw === ''

    // MULTI_SELECT is always a list — even when isList is false
    const isListField =
      field.isList || field.type === ContentFieldType.MULTI_SELECT

    if (isMissing) {
      if (field.required) {
        issues.push(`${field.apiId} is required.`)
      }
      data[field.apiId] = isListField ? [] : null
      continue
    }

    if (isListField) {
      if (!Array.isArray(raw)) {
        issues.push(`${field.apiId} must be an array.`)
        data[field.apiId] = []
        continue
      }
      // For MULTI_SELECT treat each item as a SELECT-style value
      const itemFieldType =
        field.type === ContentFieldType.MULTI_SELECT
          ? ContentFieldType.SELECT
          : field.type
      const itemField: FieldDef = { ...field, type: itemFieldType, isList: false }
      const out: unknown[] = []
      for (const item of raw) {
        const { value, issues: itemIssues } = validateScalar(itemField, item)
        issues.push(...itemIssues)
        if (value !== null) out.push(value)
      }
      data[field.apiId] = out
      if (field.required && out.length === 0) {
        issues.push(`${field.apiId} must contain at least one value.`)
      }
    } else {
      const { value, issues: scalarIssues } = validateScalar(field, raw)
      issues.push(...scalarIssues)
      data[field.apiId] = value
    }
  }

  return { data, issues }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Slug helpers                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

const slugify = (input: string): string =>
  input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

const deriveSlug = (
  data: JsonObject,
  fields: FieldDef[]
): string | null => {
  // Prefer a field named 'title', 'name', or 'slug'
  const candidateApiIds = ['slug', 'title', 'name', 'heading']
  for (const apiId of candidateApiIds) {
    const f = fields.find((fld) => fld.apiId === apiId)
    if (!f) continue
    const value = data[apiId]
    if (typeof value === 'string' && value.trim().length > 0) {
      const s = slugify(value)
      if (s) return s
    }
  }
  // Fallback: first TEXT field that has a string value
  for (const f of fields) {
    if (f.type !== ContentFieldType.TEXT && f.type !== ContentFieldType.RICH_TEXT) continue
    const value = data[f.apiId]
    if (typeof value === 'string' && value.trim().length > 0) {
      const s = slugify(value)
      if (s) return s
    }
  }
  return null
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Serializers                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

const serializeListEntry = (entry: EntryListRecord) => ({
  id: entry.id,
  slug: entry.slug,
  status: entry.status,
  version: entry.version,
  publishedAt: entry.publishedAt,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  createdBy: entry.createdBy,
  updatedBy: entry.updatedBy
})

const serializeDetailEntry = (entry: EntryDetailRecord) => ({
  id: entry.id,
  siteId: entry.siteId,
  contentTypeId: entry.contentTypeId,
  slug: entry.slug,
  status: entry.status,
  data: entry.data,
  version: entry.version,
  publishedAt: entry.publishedAt,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  createdBy: entry.createdBy,
  updatedBy: entry.updatedBy
})

/* ────────────────────────────────────────────────────────────────────────── */
/*  Public service functions                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export const listContentEntriesForUser = async ({
  user,
  siteId,
  contentTypeId,
  query
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  query: ListContentEntriesQuery
}) => {
  await ensureSiteAndAccess(user, siteId)
  await loadContentTypeWithFields(siteId, contentTypeId)

  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 20

  const where: Prisma.ContentEntryWhereInput = {
    siteId,
    contentTypeId
  }
  if (query.status) where.status = query.status
  if (query.search) {
    where.slug = { contains: query.search, mode: 'insensitive' }
  }

  const [items, total] = await prisma.$transaction([
    prisma.contentEntry.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
      select: entryListSelect
    }),
    prisma.contentEntry.count({ where })
  ])

  return {
    items: items.map(serializeListEntry),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  }
}

export const getContentEntryByIdForUser = async ({
  user,
  siteId,
  contentTypeId,
  entryId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  entryId: string
}) => {
  await ensureSiteAndAccess(user, siteId)
  await loadContentTypeWithFields(siteId, contentTypeId)
  const entry = await loadEntryOrThrow(siteId, entryId)
  if (entry.contentTypeId !== contentTypeId) {
    throw new HttpError({
      message: 'Content entry does not belong to the specified content type',
      statusCode: 404,
      code: 'CONTENT_ENTRY_NOT_FOUND'
    })
  }
  return { entry: serializeDetailEntry(entry) }
}

export const createContentEntryForUser = async ({
  user,
  siteId,
  contentTypeId,
  input
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  input: CreateContentEntryInput
}) => {
  await ensureSiteAndAccess(user, siteId)
  await ensureContentEditAccess(user, siteId)

  const contentType = await loadContentTypeWithFields(siteId, contentTypeId)

  // Singleton enforcement
  if (contentType.isSingleton) {
    const existing = await prisma.contentEntry.findFirst({
      where: { siteId, contentTypeId },
      select: { id: true }
    })
    if (existing) {
      throw new HttpError({
        message: 'This content type is a singleton and already has an entry',
        statusCode: 409,
        code: 'CONTENT_TYPE_SINGLETON_EXISTS'
      })
    }
  }

  const { data, issues } = validateAndNormalizeEntryData(
    contentType.fields,
    input.data
  )
  if (issues.length > 0) {
    throw new HttpError({
      message: 'Entry data failed validation',
      statusCode: 400,
      code: 'CONTENT_ENTRY_INVALID',
      issues
    })
  }

  const status = input.status ?? ContentEntryStatus.DRAFT
  const slug =
    input.slug ??
    (contentType.isSingleton
      ? slugify(contentType.apiId)
      : deriveSlug(data, contentType.fields))

  try {
    const created = await prisma.$transaction(async (tx) => {
      const entry = await tx.contentEntry.create({
        data: {
          siteId,
          contentTypeId,
          slug,
          status,
          data: data as Prisma.InputJsonValue,
          createdById: user.id,
          updatedById: user.id,
          publishedAt: status === ContentEntryStatus.PUBLISHED ? new Date() : null
        },
        select: entryDetailSelect
      })
      // Seed the revision history with the initial state so v1 in the UI
      // matches the data the user just submitted (not "the empty state before
      // they ever saved").
      await snapshotEntryRevision(
        tx,
        {
          id: entry.id,
          version: entry.version,
          status: entry.status,
          data: entry.data
        },
        user.id
      )
      return entry
    })
    return { entry: serializeDetailEntry(created) }
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw new HttpError({
        message: 'An entry with this slug already exists for this content type',
        statusCode: 409,
        code: 'CONTENT_ENTRY_SLUG_TAKEN'
      })
    }
    throw error
  }
}

export const updateContentEntryForUser = async ({
  user,
  siteId,
  contentTypeId,
  entryId,
  input
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  entryId: string
  input: UpdateContentEntryInput
}) => {
  await ensureSiteAndAccess(user, siteId)
  await ensureContentEditAccess(user, siteId)

  const contentType = await loadContentTypeWithFields(siteId, contentTypeId)
  const existing = await loadEntryOrThrow(siteId, entryId)
  if (existing.contentTypeId !== contentTypeId) {
    throw new HttpError({
      message: 'Content entry does not belong to the specified content type',
      statusCode: 404,
      code: 'CONTENT_ENTRY_NOT_FOUND'
    })
  }

  const updateData: Prisma.ContentEntryUpdateInput = {
    updatedBy: { connect: { id: user.id } }
  }

  // Tracks whether the entry data actually changed. A no-op save (e.g. publish
  // re-submits the unchanged form) should NOT bump the version counter or
  // create a new revision — otherwise users see phantom versions in history.
  let dataChanged = false

  if (input.data !== undefined) {
    const { data, issues } = validateAndNormalizeEntryData(
      contentType.fields,
      input.data
    )
    if (issues.length > 0) {
      throw new HttpError({
        message: 'Entry data failed validation',
        statusCode: 400,
        code: 'CONTENT_ENTRY_INVALID',
        issues
      })
    }

    // Deep-equality check via stable-key JSON serialization. PostgreSQL
    // JSONB doesn't preserve insertion order, so we must sort keys before
    // stringifying or otherwise no-op saves will look "changed" and bump
    // the version. Field values themselves are bounded (strings, numbers,
    // booleans, arrays of those) so a single-pass key sort is enough.
    dataChanged =
      stableStringify(existing.data ?? {}) !== stableStringify(data)

    if (dataChanged) {
      updateData.data = data as Prisma.InputJsonValue
      updateData.version = { increment: 1 }
    }
  }

  if (input.slug !== undefined) {
    updateData.slug = input.slug
  }

  if (input.status !== undefined && input.status !== existing.status) {
    updateData.status = input.status
    if (input.status === ContentEntryStatus.PUBLISHED) {
      updateData.publishedAt = existing.publishedAt ?? new Date()
    } else if (input.status === ContentEntryStatus.DRAFT) {
      updateData.publishedAt = null
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.contentEntry.update({
        where: { id: entryId },
        data: updateData,
        select: entryDetailSelect
      })

      // Post-save snapshot: only when data actually changes (slug/status
      // tweaks don't need a revision, and an unchanged re-submit shouldn't
      // create a phantom version). The snapshot captures the NEW state so vN
      // in the revisions list always matches the data that was saved at that
      // point, not the state before the save.
      if (dataChanged) {
        await snapshotEntryRevision(
          tx,
          {
            id: next.id,
            version: next.version,
            status: next.status,
            data: next.data
          },
          user.id
        )
      }

      return next
    })
    return { entry: serializeDetailEntry(updated) }
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw new HttpError({
        message: 'An entry with this slug already exists for this content type',
        statusCode: 409,
        code: 'CONTENT_ENTRY_SLUG_TAKEN'
      })
    }
    throw error
  }
}

export const deleteContentEntryForUser = async ({
  user,
  siteId,
  contentTypeId,
  entryId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  entryId: string
}) => {
  await ensureSiteAndAccess(user, siteId)
  await ensureContentEditAccess(user, siteId)
  const existing = await loadEntryOrThrow(siteId, entryId)
  if (existing.contentTypeId !== contentTypeId) {
    throw new HttpError({
      message: 'Content entry does not belong to the specified content type',
      statusCode: 404,
      code: 'CONTENT_ENTRY_NOT_FOUND'
    })
  }
  await prisma.contentEntry.delete({ where: { id: entryId } })
  return { id: entryId, deleted: true }
}

export const publishContentEntryForUser = async ({
  user,
  siteId,
  contentTypeId,
  entryId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  entryId: string
}) => {
  await ensureSiteAndAccess(user, siteId)
  await ensureContentEditAccess(user, siteId)
  const contentType = await loadContentTypeWithFields(siteId, contentTypeId)
  const existing = await loadEntryOrThrow(siteId, entryId)
  if (existing.contentTypeId !== contentTypeId) {
    throw new HttpError({
      message: 'Content entry does not belong to the specified content type',
      statusCode: 404,
      code: 'CONTENT_ENTRY_NOT_FOUND'
    })
  }

  // Re-validate against the current schema before publishing
  const { issues } = validateAndNormalizeEntryData(contentType.fields, existing.data)
  if (issues.length > 0) {
    throw new HttpError({
      message: 'Entry cannot be published — data is incomplete or invalid',
      statusCode: 400,
      code: 'CONTENT_ENTRY_INVALID',
      issues
    })
  }

  const updated = await prisma.contentEntry.update({
    where: { id: entryId },
    data: {
      status: ContentEntryStatus.PUBLISHED,
      publishedAt: existing.publishedAt ?? new Date(),
      updatedBy: { connect: { id: user.id } }
    },
    select: entryDetailSelect
  })
  return serializeDetailEntry(updated)
}

export const unpublishContentEntryForUser = async ({
  user,
  siteId,
  contentTypeId,
  entryId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  entryId: string
}) => {
  await ensureSiteAndAccess(user, siteId)
  await ensureContentEditAccess(user, siteId)
  const existing = await loadEntryOrThrow(siteId, entryId)
  if (existing.contentTypeId !== contentTypeId) {
    throw new HttpError({
      message: 'Content entry does not belong to the specified content type',
      statusCode: 404,
      code: 'CONTENT_ENTRY_NOT_FOUND'
    })
  }
  const updated = await prisma.contentEntry.update({
    where: { id: entryId },
    data: {
      status: ContentEntryStatus.DRAFT,
      publishedAt: null,
      updatedBy: { connect: { id: user.id } }
    },
    select: entryDetailSelect
  })
  return serializeDetailEntry(updated)
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Revisions API                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export const listContentEntryRevisionsForUser = async ({
  user,
  siteId,
  contentTypeId,
  entryId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  entryId: string
}) => {
  await ensureSiteAndAccess(user, siteId)
  const existing = await loadEntryOrThrow(siteId, entryId)
  if (existing.contentTypeId !== contentTypeId) {
    throw new HttpError({
      message: 'Content entry does not belong to the specified content type',
      statusCode: 404,
      code: 'CONTENT_ENTRY_NOT_FOUND'
    })
  }

  const revisions = await prisma.contentEntryRevision.findMany({
    where: { entryId },
    orderBy: { createdAt: 'desc' },
    select: revisionListSelect
  })

  return { revisions: revisions.map(serializeRevisionListItem) }
}

export const getContentEntryRevisionForUser = async ({
  user,
  siteId,
  contentTypeId,
  entryId,
  revisionId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  entryId: string
  revisionId: string
}) => {
  await ensureSiteAndAccess(user, siteId)
  const existing = await loadEntryOrThrow(siteId, entryId)
  if (existing.contentTypeId !== contentTypeId) {
    throw new HttpError({
      message: 'Content entry does not belong to the specified content type',
      statusCode: 404,
      code: 'CONTENT_ENTRY_NOT_FOUND'
    })
  }

  const revision = await prisma.contentEntryRevision.findFirst({
    where: { id: revisionId, entryId },
    select: revisionDetailSelect
  })
  if (!revision) {
    throw new HttpError({
      message: 'Revision not found',
      statusCode: 404,
      code: 'CONTENT_ENTRY_REVISION_NOT_FOUND'
    })
  }

  return { revision: serializeRevisionDetail(revision) }
}

export const restoreContentEntryRevisionForUser = async ({
  user,
  siteId,
  contentTypeId,
  entryId,
  revisionId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  contentTypeId: string
  entryId: string
  revisionId: string
}) => {
  await ensureSiteAndAccess(user, siteId)
  await ensureContentEditAccess(user, siteId)

  const existing = await loadEntryOrThrow(siteId, entryId)
  if (existing.contentTypeId !== contentTypeId) {
    throw new HttpError({
      message: 'Content entry does not belong to the specified content type',
      statusCode: 404,
      code: 'CONTENT_ENTRY_NOT_FOUND'
    })
  }

  const revision = await prisma.contentEntryRevision.findFirst({
    where: { id: revisionId, entryId },
    select: { id: true, version: true, data: true }
  })
  if (!revision) {
    throw new HttpError({
      message: 'Revision not found',
      statusCode: 404,
      code: 'CONTENT_ENTRY_REVISION_NOT_FOUND'
    })
  }

  // Restore semantics: literally use the old snapshot. Do NOT validate against
  // the current schema (we want the exact bytes the user picked), do NOT bump
  // the version counter (we are reverting to an older version, not creating a
  // new one), and do NOT snapshot the discarded current state (the revision
  // list represents past saves, not restore events).
  //
  // "Rewind" semantics: any revisions ahead of the restored one (> restored
  // version) are dropped so the next save lands on the next sequential
  // version without colliding with the (entryId, version) unique constraint.
  // We keep the restored revision itself so it remains the latest entry in
  // the list.
  const updated = await prisma.$transaction(async (tx) => {
    await tx.contentEntryRevision.deleteMany({
      where: { entryId, version: { gt: revision.version } }
    })

    return tx.contentEntry.update({
      where: { id: entryId },
      data: {
        data: revision.data as Prisma.InputJsonValue,
        version: revision.version,
        updatedBy: { connect: { id: user.id } }
      },
      select: entryDetailSelect
    })
  })

  return { entry: serializeDetailEntry(updated) }
}
