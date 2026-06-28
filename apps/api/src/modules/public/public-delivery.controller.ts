import type { RequestHandler } from 'express'
import { z } from 'zod'
import {
  ContentEntryStatus,
  type Prisma
} from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { API_KEY_SCOPES } from '../../utils/api-key'
import { HttpError } from '../../utils/http-error'
import { expandEntries, getContentTypeFields, parsePopulate } from './populate'

/**
 * Public delivery API. The API key is the authentication AND the scoping
 * mechanism — every key is bound to one site, so all queries are
 * automatically site-scoped.
 *
 * Only PUBLISHED entries are returned.
 *
 * Routes:
 *   GET  /public/v1/content-types/:contentTypeApiId/entries
 *   GET  /public/v1/content-types/:contentTypeApiId/entries/:slug
 *   GET  /public/v1/me  — info about the current API key (for debugging)
 */

const contentTypeParamSchema = z.object({
  contentTypeApiId: z
    .string()
    .min(1, 'A content type apiId is required.')
    .regex(/^[a-z][a-z0-9_]*$/, 'Invalid content type apiId.')
})

const entryParamSchema = contentTypeParamSchema.extend({
  slug: z
    .string()
    .min(1, 'Slug is required.')
    .regex(/^[a-z0-9-]+$/, 'Invalid slug.')
})

const listQuerySchema = z.object({
  page: z
    .preprocess(
      (v) => (typeof v === 'string' ? Number(v) : v),
      z.number().int().min(1).default(1)
    )
    .optional(),
  pageSize: z
    .preprocess(
      (v) => (typeof v === 'string' ? Number(v) : v),
      z.number().int().min(1).max(100).default(20)
    )
    .optional(),
  /** ISO field name to sort by. Defaults to publishedAt desc. */
  orderBy: z.enum(['publishedAt', 'updatedAt', 'createdAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  /**
   * Comma-separated list of top-level MEDIA / RELATION field apiIds to expand
   * inline. Use `*` to expand every MEDIA + RELATION field. Example:
   *   ?populate=heroImage,author
   *   ?populate=*
   */
  populate: z.string().optional(),
  /**
   * When truthy, returns DRAFT entries in addition to PUBLISHED.
   * Requires the key to carry the `entries:read-drafts` scope. Cache headers
   * switch to `no-store` whenever preview is active.
   */
  preview: z
    .preprocess((v) => {
      if (typeof v !== 'string') return v
      const lc = v.toLowerCase()
      if (['1', 'true', 'yes'].includes(lc)) return true
      if (['0', 'false', 'no', ''].includes(lc)) return false
      return v
    }, z.boolean().default(false))
    .optional()
})

const isPreviewRequested = (raw: unknown): boolean => {
  if (typeof raw !== 'string') return false
  const lc = raw.toLowerCase()
  return lc === '1' || lc === 'true' || lc === 'yes'
}

const assertPreviewScope = (req: Parameters<RequestHandler>[0]) => {
  if (!req.apiKey?.scopes.includes(API_KEY_SCOPES.ENTRIES_READ_DRAFTS)) {
    throw new HttpError({
      message: `Preview mode requires the "${API_KEY_SCOPES.ENTRIES_READ_DRAFTS}" scope.`,
      statusCode: 403,
      code: 'API_KEY_SCOPE_REQUIRED'
    })
  }
}

const previewStatusFilter = (preview: boolean): Prisma.ContentEntryWhereInput['status'] =>
  preview
    ? { in: [ContentEntryStatus.DRAFT, ContentEntryStatus.PUBLISHED] }
    : ContentEntryStatus.PUBLISHED

const applyCacheHeaders = (res: Parameters<RequestHandler>[1], preview: boolean) => {
  if (preview) {
    res.setHeader('Cache-Control', 'no-store')
  } else {
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60')
  }
}

const requireApiKeyContext = (req: Parameters<RequestHandler>[0]) => {
  if (!req.apiKey) {
    throw Object.assign(new Error('API key context missing'), {
      statusCode: 401
    })
  }
  return req.apiKey
}

const findContentType = async (siteId: string, apiId: string) =>
  prisma.contentType.findFirst({
    where: { siteId, apiId },
    select: { id: true, apiId: true, name: true, isSingleton: true }
  })

const publicEntrySelect = {
  id: true,
  slug: true,
  data: true,
  publishedAt: true,
  updatedAt: true,
  contentType: { select: { apiId: true } }
} satisfies Prisma.ContentEntrySelect

type PublicEntryRecord = Prisma.ContentEntryGetPayload<{
  select: typeof publicEntrySelect
}>

const serializePublicEntry = (entry: PublicEntryRecord) => ({
  id: entry.id,
  slug: entry.slug,
  contentType: entry.contentType.apiId,
  publishedAt: entry.publishedAt,
  updatedAt: entry.updatedAt,
  data: entry.data
})

/* ──────────────────────────────────────────────────────────── */

export const getApiKeyInfo: RequestHandler = (req, res) => {
  const ctx = req.apiKey
  if (!ctx) {
    res.status(401).json({ message: 'API key required' })
    return
  }
  res.status(200).json({
    siteSlug: ctx.siteSlug,
    siteId: ctx.siteId,
    scopes: ctx.scopes
  })
}

export const listPublishedEntries: RequestHandler = async (req, res, next) => {
  try {
    const ctx = requireApiKeyContext(req)
    const params = contentTypeParamSchema.safeParse(req.params)
    if (!params.success) {
      res.status(400).json({
        message: 'Invalid route parameters',
        issues: params.error.issues.map((i) => i.message)
      })
      return
    }
    const query = listQuerySchema.safeParse(req.query)
    if (!query.success) {
      res.status(400).json({
        message: 'Invalid query parameters',
        issues: query.error.issues.map((i) => i.message)
      })
      return
    }

    const contentType = await findContentType(
      ctx.siteId,
      params.data.contentTypeApiId
    )
    if (!contentType) {
      res.status(404).json({
        message: 'Content type not found for this site',
        code: 'CONTENT_TYPE_NOT_FOUND'
      })
      return
    }

    const preview = query.data.preview === true
    if (preview) assertPreviewScope(req)

    const page = query.data.page ?? 1
    const pageSize = query.data.pageSize ?? 20
    const orderBy = query.data.orderBy ?? 'publishedAt'
    const order = query.data.order ?? 'desc'

    const where: Prisma.ContentEntryWhereInput = {
      siteId: ctx.siteId,
      contentTypeId: contentType.id,
      status: previewStatusFilter(preview)
    }

    const [items, total] = await prisma.$transaction([
      prisma.contentEntry.findMany({
        where,
        orderBy: { [orderBy]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: publicEntrySelect
      }),
      prisma.contentEntry.count({ where })
    ])

    const populate = parsePopulate(query.data.populate)
    const serialized = items.map(serializePublicEntry)
    const expanded = populate
      ? await expandEntries(
          serialized,
          {
            fields: populate,
            contentTypeFields: await getContentTypeFields(contentType.id),
            preview
          },
          ctx.siteId
        )
      : serialized

    applyCacheHeaders(res, preview)
    res.status(200).json({
      items: expanded,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    })
  } catch (error) {
    next(error)
  }
}

export const getPublishedEntryBySlug: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const ctx = requireApiKeyContext(req)
    const params = entryParamSchema.safeParse(req.params)
    if (!params.success) {
      res.status(400).json({
        message: 'Invalid route parameters',
        issues: params.error.issues.map((i) => i.message)
      })
      return
    }

    const contentType = await findContentType(
      ctx.siteId,
      params.data.contentTypeApiId
    )
    if (!contentType) {
      res.status(404).json({
        message: 'Content type not found for this site',
        code: 'CONTENT_TYPE_NOT_FOUND'
      })
      return
    }

    const preview = isPreviewRequested(req.query.preview)
    if (preview) assertPreviewScope(req)

    const entry = await prisma.contentEntry.findFirst({
      where: {
        siteId: ctx.siteId,
        contentTypeId: contentType.id,
        slug: params.data.slug,
        status: previewStatusFilter(preview)
      },
      select: publicEntrySelect
    })
    if (!entry) {
      res.status(404).json({
        message: 'Entry not found',
        code: 'ENTRY_NOT_FOUND'
      })
      return
    }

    const populate = parsePopulate(
      typeof req.query.populate === 'string' ? req.query.populate : undefined
    )
    const serialized = serializePublicEntry(entry)
    const [out] = populate
      ? await expandEntries(
          [serialized],
          {
            fields: populate,
            contentTypeFields: await getContentTypeFields(contentType.id),
            preview
          },
          ctx.siteId
        )
      : [serialized]

    applyCacheHeaders(res, preview)
    res.status(200).json({ entry: out })
  } catch (error) {
    next(error)
  }
}
