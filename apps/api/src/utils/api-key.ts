import { createHash, randomBytes } from 'node:crypto'
import { env } from '../config/env'

/**
 * API key format: `narah_<env>_<random>` where:
 *   - `narah_live_xxxxxxxx...` in production
 *   - `narah_dev_xxxxxxxx...` in dev/test
 *
 * Stored as a SHA-256 hash. SHA-256 is appropriate here (instead of bcrypt)
 * because the underlying key has high entropy (32 random bytes), so we don't
 * need the slow-hashing protection that user passwords need.
 *
 * The `keyPrefix` stored alongside the hash is the first 8 chars of the
 * plaintext — useful for "Which key was this?" displays without exposing
 * the secret.
 */

const KEY_BODY_BYTES = 32
const PREFIX_VISIBLE_CHARS = 8

const keyEnvSegment = (): string =>
  env.NODE_ENV === 'production' ? 'live' : 'dev'

export type GeneratedApiKey = {
  /** Full plaintext key. Show ONCE to the user, never store. */
  plaintext: string
  /** First PREFIX_VISIBLE_CHARS chars of the body — safe to store/display. */
  keyPrefix: string
  /** SHA-256 of the full plaintext — what we store in `keyHash`. */
  keyHash: string
}

export const generateApiKey = (): GeneratedApiKey => {
  const body = randomBytes(KEY_BODY_BYTES).toString('base64url')
  const plaintext = `narah_${keyEnvSegment()}_${body}`
  return {
    plaintext,
    keyPrefix: body.slice(0, PREFIX_VISIBLE_CHARS),
    keyHash: hashApiKey(plaintext)
  }
}

export const hashApiKey = (plaintext: string): string =>
  createHash('sha256').update(plaintext).digest('hex')

/**
 * Pull the bearer token / API key from a request's headers.
 * Accepts either `Authorization: Bearer ...` or `x-api-key: ...`.
 */
export const extractApiKeyFromHeaders = (headers: {
  authorization?: string | string[] | undefined
  'x-api-key'?: string | string[] | undefined
}): string | null => {
  const xKey = headers['x-api-key']
  if (typeof xKey === 'string' && xKey.trim() !== '') return xKey.trim()

  const auth = headers.authorization
  if (typeof auth === 'string') {
    const [scheme, token] = auth.split(' ')
    if (scheme && scheme.toLowerCase() === 'bearer' && token) return token.trim()
  }
  return null
}

/**
 * Scope catalog. Strings stored in `ApiKey.scopes`.
 */
export const API_KEY_SCOPES = {
  /** Read PUBLISHED entries via the public delivery API. */
  ENTRIES_READ: 'entries:read',
  /**
   * Read DRAFT entries (in addition to PUBLISHED) when the caller passes
   * `?preview=1`. Intended for preview deployments — never grant to a key
   * embedded in a public, cacheable production site.
   */
  ENTRIES_READ_DRAFTS: 'entries:read-drafts'
} as const

export type ApiKeyScope = (typeof API_KEY_SCOPES)[keyof typeof API_KEY_SCOPES]

export const ALL_SCOPES: readonly ApiKeyScope[] = [
  API_KEY_SCOPES.ENTRIES_READ,
  API_KEY_SCOPES.ENTRIES_READ_DRAFTS
]
