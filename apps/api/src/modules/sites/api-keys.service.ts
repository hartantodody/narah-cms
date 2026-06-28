import type { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import {
  API_KEY_SCOPES,
  generateApiKey,
  type ApiKeyScope
} from '../../utils/api-key'
import { HttpError } from '../../utils/http-error'
import type { AuthenticatedRequestUser } from '../auth/auth.types'
import { canManageSite } from './sites.authorization'
import type {
  CreateApiKeyInput,
  ListApiKeysQuery,
  UpdateApiKeyInput
} from './api-keys.schemas'

const apiKeySelect = {
  id: true,
  siteId: true,
  name: true,
  keyPrefix: true,
  scopes: true,
  allowedOrigins: true,
  rateLimitPerMinute: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true } }
} satisfies Prisma.ApiKeySelect

type ApiKeyRecord = Prisma.ApiKeyGetPayload<{ select: typeof apiKeySelect }>

const serializeApiKey = (key: ApiKeyRecord) => ({
  id: key.id,
  siteId: key.siteId,
  name: key.name,
  keyPrefix: key.keyPrefix,
  scopes: key.scopes,
  allowedOrigins: key.allowedOrigins,
  rateLimitPerMinute: key.rateLimitPerMinute,
  lastUsedAt: key.lastUsedAt,
  expiresAt: key.expiresAt,
  revokedAt: key.revokedAt,
  createdAt: key.createdAt,
  updatedAt: key.updatedAt,
  createdBy: key.createdBy
})

const ensureManage = async (
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
  if (user.isSuperAdmin) return
  if (await canManageSite(user, siteId)) return

  throw new HttpError({
    message: 'Only site owners, admins, and super admins can manage API keys',
    statusCode: 403,
    code: 'FORBIDDEN'
  })
}

export const listApiKeysForUser = async ({
  user,
  siteId,
  query
}: {
  user: AuthenticatedRequestUser
  siteId: string
  query: ListApiKeysQuery
}) => {
  await ensureManage(user, siteId)
  const where: Prisma.ApiKeyWhereInput = { siteId }
  if (query.search) {
    where.name = { contains: query.search, mode: 'insensitive' }
  }
  const items = await prisma.apiKey.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: apiKeySelect
  })
  return { apiKeys: items.map(serializeApiKey) }
}

export const createApiKeyForUser = async ({
  user,
  siteId,
  input
}: {
  user: AuthenticatedRequestUser
  siteId: string
  input: CreateApiKeyInput
}) => {
  await ensureManage(user, siteId)

  const scopes: ApiKeyScope[] =
    (input.scopes as ApiKeyScope[] | undefined) ?? [API_KEY_SCOPES.ENTRIES_READ]

  const generated = generateApiKey()

  const created = await prisma.apiKey.create({
    data: {
      siteId,
      name: input.name,
      keyPrefix: generated.keyPrefix,
      keyHash: generated.keyHash,
      scopes,
      allowedOrigins: input.allowedOrigins ?? [],
      rateLimitPerMinute: input.rateLimitPerMinute ?? 60,
      createdById: user.id,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
    },
    select: apiKeySelect
  })

  return {
    apiKey: serializeApiKey(created),
    /** Plaintext is returned ONCE on creation. Frontend must display & let
     *  the user copy it now; we never store or expose it again. */
    plaintext: generated.plaintext
  }
}

export const updateApiKeyForUser = async ({
  user,
  siteId,
  apiKeyId,
  input
}: {
  user: AuthenticatedRequestUser
  siteId: string
  apiKeyId: string
  input: UpdateApiKeyInput
}) => {
  await ensureManage(user, siteId)
  const existing = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, siteId },
    select: { id: true }
  })
  if (!existing) {
    throw new HttpError({
      message: 'API key not found',
      statusCode: 404,
      code: 'API_KEY_NOT_FOUND'
    })
  }
  const data: Prisma.ApiKeyUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.scopes !== undefined) {
    data.scopes = input.scopes as ApiKeyScope[]
  }
  if (input.allowedOrigins !== undefined) {
    data.allowedOrigins = input.allowedOrigins
  }
  if (input.rateLimitPerMinute !== undefined) {
    data.rateLimitPerMinute = input.rateLimitPerMinute
  }
  const updated = await prisma.apiKey.update({
    where: { id: apiKeyId },
    data,
    select: apiKeySelect
  })
  return { apiKey: serializeApiKey(updated) }
}

export const revokeApiKeyForUser = async ({
  user,
  siteId,
  apiKeyId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  apiKeyId: string
}) => {
  await ensureManage(user, siteId)
  const existing = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, siteId },
    select: { id: true, revokedAt: true }
  })
  if (!existing) {
    throw new HttpError({
      message: 'API key not found',
      statusCode: 404,
      code: 'API_KEY_NOT_FOUND'
    })
  }
  if (existing.revokedAt) {
    // Idempotent — no-op return.
    const refreshed = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: apiKeySelect
    })
    return { apiKey: serializeApiKey(refreshed!) }
  }
  const updated = await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: { revokedAt: new Date() },
    select: apiKeySelect
  })
  return { apiKey: serializeApiKey(updated) }
}

export const deleteApiKeyForUser = async ({
  user,
  siteId,
  apiKeyId
}: {
  user: AuthenticatedRequestUser
  siteId: string
  apiKeyId: string
}) => {
  await ensureManage(user, siteId)
  const existing = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, siteId },
    select: { id: true }
  })
  if (!existing) {
    throw new HttpError({
      message: 'API key not found',
      statusCode: 404,
      code: 'API_KEY_NOT_FOUND'
    })
  }
  await prisma.apiKey.delete({ where: { id: apiKeyId } })
  return { id: apiKeyId, deleted: true }
}
