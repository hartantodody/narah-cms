import type { RequestHandler } from 'express'
import { z } from 'zod'
import type { Prisma } from '../../../generated/prisma/client'
import { parseOrThrow, requireUserOrThrow } from '../../lib/guards'
import { buildPaginated } from '../../lib/pagination'
import { prisma } from '../../lib/prisma'
import { sendPaginated } from '../../lib/response'
import { HttpError } from '../../utils/http-error'
import { canAccessSite, canManageSite } from '../sites/sites.authorization'

const auditSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  metadata: true,
  siteId: true,
  userId: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
  site: { select: { id: true, name: true, slug: true } }
} satisfies Prisma.AuditLogSelect

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  siteId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  entityType: z.string().optional()
})

const siteParamSchema = z.object({ siteId: z.string().uuid() })

const fetchAuditPage = async (
  where: Prisma.AuditLogWhereInput,
  page: number,
  pageSize: number
) => {
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: auditSelect
    })
  ])
  return buildPaginated(items, total, { page, pageSize })
}

export const listGlobalAuditLogs: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    if (!user.isSuperAdmin) {
      throw new HttpError({
        message: 'Only super admins can view the global audit log',
        statusCode: 403,
        code: 'FORBIDDEN'
      })
    }

    const query = parseOrThrow(listQuerySchema, req.query, 'Invalid query parameters')
    const where: Prisma.AuditLogWhereInput = {}
    if (query.siteId) where.siteId = query.siteId
    if (query.userId) where.userId = query.userId
    if (query.action) where.action = query.action
    if (query.entityType) where.entityType = query.entityType

    const result = await fetchAuditPage(where, query.page, query.pageSize)
    sendPaginated(res, result)
  } catch (error) {
    next(error)
  }
}

export const listSiteAuditLogs: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    const { siteId } = parseOrThrow(siteParamSchema, req.params, 'Invalid site id')

    if (!(await canAccessSite(user, siteId))) {
      throw new HttpError({
        message: 'You do not have access to this site',
        statusCode: 403,
        code: 'SITE_ACCESS_DENIED'
      })
    }
    if (!(await canManageSite(user, siteId))) {
      throw new HttpError({
        message: 'Only owners and admins can view the audit log',
        statusCode: 403,
        code: 'FORBIDDEN'
      })
    }

    const query = parseOrThrow(listQuerySchema, req.query, 'Invalid query parameters')
    const where: Prisma.AuditLogWhereInput = { siteId }
    if (query.userId) where.userId = query.userId
    if (query.action) where.action = query.action
    if (query.entityType) where.entityType = query.entityType

    const result = await fetchAuditPage(where, query.page, query.pageSize)
    sendPaginated(res, result)
  } catch (error) {
    next(error)
  }
}
