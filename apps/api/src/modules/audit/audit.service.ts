import type { Request } from 'express'
import type { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'

export type AuditEntityType =
  | 'site'
  | 'content_type'
  | 'content_field'
  | 'content_entry'
  | 'media_asset'
  | 'site_member'
  | 'site_invitation'
  | 'api_key'
  | 'user'

export type AuditAction =
  // sites
  | 'site.created'
  | 'site.updated'
  | 'site.archived'
  | 'site.analytics_connected'
  | 'site.analytics_disconnected'
  // content types
  | 'content_type.created'
  | 'content_type.updated'
  | 'content_type.deleted'
  | 'content_type.replaced'
  | 'content_field.created'
  | 'content_field.updated'
  | 'content_field.deleted'
  | 'content_field.reordered'
  // entries
  | 'content_entry.created'
  | 'content_entry.updated'
  | 'content_entry.published'
  | 'content_entry.unpublished'
  | 'content_entry.deleted'
  | 'content_entry.restored'
  // media
  | 'media_asset.uploaded'
  | 'media_asset.updated'
  | 'media_asset.deleted'
  // members + invitations
  | 'site_member.role_changed'
  | 'site_member.removed'
  | 'site_invitation.created'
  | 'site_invitation.revoked'
  // api keys
  | 'api_key.created'
  | 'api_key.updated'
  | 'api_key.revoked'
  | 'api_key.deleted'
  // platform users
  | 'user.updated'

type RecordAuditInput = {
  tx?: Prisma.TransactionClient
  req?: Pick<Request, 'ip' | 'headers'>
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  siteId?: string | null
  userId?: string | null
  metadata?: Record<string, unknown>
}

const getClientIp = (req?: Pick<Request, 'ip' | 'headers'>): string | null => {
  if (!req) return null
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string') return fwd.split(',')[0]?.trim() || null
  if (Array.isArray(fwd)) return fwd[0]?.trim() || null
  return req.ip ?? null
}

const getUserAgent = (req?: Pick<Request, 'headers'>): string | null => {
  if (!req) return null
  const ua = req.headers['user-agent']
  return typeof ua === 'string' ? ua : null
}

export const recordAudit = async ({
  tx,
  req,
  action,
  entityType,
  entityId,
  siteId = null,
  userId = null,
  metadata = {}
}: RecordAuditInput) => {
  const client = tx ?? prisma
  const enrichedMetadata: Prisma.InputJsonValue = {
    ...metadata,
    entityType,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req)
  }

  try {
    await client.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        siteId,
        userId,
        metadata: enrichedMetadata
      }
    })
  } catch {
    // Audit failures must never block the main operation.
  }
}
