import type { Server } from 'node:http'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'

let server: Server | null = null
let baseUrl = ''

export const startTestServer = async () => {
  if (server) return baseUrl
  server = app.listen(0)
  await new Promise<void>((resolve) => server!.once('listening', () => resolve()))
  const addr = server.address()
  if (!addr || typeof addr === 'string') {
    throw new Error('Unexpected server address shape')
  }
  baseUrl = `http://127.0.0.1:${addr.port}`
  return baseUrl
}

export const stopTestServer = async () => {
  if (!server) return
  await new Promise<void>((resolve, reject) => {
    server!.close((err) => (err ? reject(err) : resolve()))
  })
  server = null
  await prisma.$disconnect()
}

/**
 * Wipe all rows from the tables we touch in tests. Order respects FK
 * cascades (children before parents). Add new tables here as the schema
 * grows.
 */
export const resetDb = async () => {
  await prisma.$transaction([
    prisma.contentEntryRevision.deleteMany(),
    prisma.contentEntry.deleteMany(),
    prisma.contentField.deleteMany(),
    prisma.contentType.deleteMany(),
    prisma.mediaAsset.deleteMany(),
    prisma.apiKey.deleteMany(),
    prisma.siteAnalyticsConfig.deleteMany(),
    prisma.siteInvitation.deleteMany(),
    prisma.siteMember.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.site.deleteMany(),
    prisma.policyAcceptance.deleteMany(),
    prisma.user.deleteMany()
  ])
}

/* ────────────────────────────────────────────────────────────── */
/* Tiny fetch wrapper that returns parsed JSON + status            */
/* ────────────────────────────────────────────────────────────── */

type ReqInit = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  token?: string
  headers?: Record<string, string>
}

export type ApiResponse<T = unknown> = {
  status: number
  body: { success: boolean; message: string; data?: T; code?: string; issues?: string[] }
  headers: Headers
}

export const api = async <T = unknown>(
  path: string,
  init: ReqInit = {}
): Promise<ApiResponse<T>> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    ...(init.headers ?? {})
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : {}
  return { status: res.status, body, headers: res.headers }
}

/* ────────────────────────────────────────────────────────────── */
/* High-level shortcuts                                            */
/* ────────────────────────────────────────────────────────────── */

let userCounter = 0

export const uniqueEmail = (prefix = 'user') => {
  userCounter += 1
  return `${prefix}-${Date.now()}-${userCounter}@test.local`
}

type AuthPayload = {
  accessToken: string
  user: { id: string; email: string; name: string }
  requiresPolicyAcceptance: boolean
}

export const registerUser = async (
  overrides: Partial<{ email: string; name: string; password: string }> = {}
) => {
  const email = overrides.email ?? uniqueEmail()
  const password = overrides.password ?? 'password123'
  const name = overrides.name ?? 'Test User'
  const res = await api<AuthPayload>('/auth/register', {
    method: 'POST',
    body: { email, name, password }
  })
  if (res.status !== 201) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return { ...res.body.data!, password }
}

export const loginUser = async (email: string, password: string) => {
  return api<AuthPayload>('/auth/login', {
    method: 'POST',
    body: { email, password }
  })
}

/**
 * Skip the /auth/accept-policies dance by accepting every active policy
 * directly. Returns the same token so callers can keep using it.
 */
export const acceptAllPolicies = async (token: string) => {
  const policies = await api<{ policies: { id: string; accepted: boolean }[] }>(
    '/auth/required-policies',
    { token }
  )
  const ids =
    policies.body.data?.policies.filter((p) => !p.accepted).map((p) => p.id) ??
    []
  if (ids.length > 0) {
    await api('/auth/accept-policies', {
      method: 'POST',
      token,
      body: { policyDocumentIds: ids }
    })
  }
}

/** One-shot helper: register → accept policies → return token + user. */
export const createAuthedUser = async () => {
  const u = await registerUser()
  await acceptAllPolicies(u.accessToken)
  return u
}

export const createSite = async (token: string, name = 'QA Site') => {
  const res = await api<{ site: { id: string; slug: string; name: string } }>(
    '/sites',
    { method: 'POST', token, body: { name } }
  )
  if (res.status !== 201) {
    throw new Error(`createSite failed: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return res.body.data!.site
}

export const createContentType = async (
  token: string,
  siteId: string,
  overrides: Partial<{ name: string; apiId: string; isSingleton: boolean }> = {}
) => {
  const res = await api<{
    contentType: { id: string; apiId: string; name: string; isSingleton: boolean }
  }>(`/sites/${siteId}/content-types`, {
    method: 'POST',
    token,
    body: { name: overrides.name ?? 'Article', ...overrides }
  })
  if (res.status !== 201) {
    throw new Error(
      `createContentType failed: ${res.status} ${JSON.stringify(res.body)}`
    )
  }
  return res.body.data!.contentType
}

export const createField = async (
  token: string,
  siteId: string,
  contentTypeId: string,
  body: {
    label: string
    type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'SELECT' | 'RELATION' | 'MEDIA' | 'RICH_TEXT'
    apiId?: string
    required?: boolean
    isList?: boolean
    config?: Record<string, unknown>
  }
) => {
  const res = await api<{ field: { id: string; apiId: string } }>(
    `/sites/${siteId}/content-types/${contentTypeId}/fields`,
    { method: 'POST', token, body }
  )
  if (res.status !== 201) {
    throw new Error(`createField failed: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return res.body.data!.field
}
