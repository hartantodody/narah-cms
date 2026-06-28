import type { RequestHandler } from 'express'
import { prisma } from '../lib/prisma'
import { consumeRateToken } from '../lib/rate-limit'
import {
  extractApiKeyFromHeaders,
  hashApiKey,
  type ApiKeyScope
} from '../utils/api-key'

/**
 * requireApiKey — authenticates a request against the ApiKey table.
 *
 * On success attaches `req.apiKey = { apiKeyId, siteId, siteSlug, scopes }`
 * and updates `lastUsedAt` (best-effort, non-blocking).
 *
 * Always reject with a generic 401 to avoid leaking which keys exist.
 */
export const requireApiKey: RequestHandler = async (req, res, next) => {
  try {
    const plaintext = extractApiKeyFromHeaders({
      authorization: req.headers.authorization,
      'x-api-key': req.headers['x-api-key']
    })
    if (!plaintext) {
      res.status(401).json({
        message: 'Missing API key',
        code: 'API_KEY_REQUIRED'
      })
      return
    }

    const keyHash = hashApiKey(plaintext)
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        siteId: true,
        scopes: true,
        allowedOrigins: true,
        rateLimitPerMinute: true,
        revokedAt: true,
        expiresAt: true,
        site: { select: { id: true, slug: true, status: true } }
      }
    })

    if (!apiKey) {
      res.status(401).json({
        message: 'Invalid API key',
        code: 'API_KEY_INVALID'
      })
      return
    }

    if (apiKey.revokedAt) {
      res.status(401).json({
        message: 'API key has been revoked',
        code: 'API_KEY_REVOKED'
      })
      return
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      res.status(401).json({
        message: 'API key has expired',
        code: 'API_KEY_EXPIRED'
      })
      return
    }

    if (apiKey.site.status !== 'ACTIVE') {
      res.status(403).json({
        message: 'Site is not active',
        code: 'SITE_NOT_ACTIVE'
      })
      return
    }

    // ── Per-key CORS origin allowlist ─────────────────────
    // Empty allowedOrigins = wildcard (any origin allowed).
    // Non-empty = the request Origin must match exactly. Server-to-server
    // requests (no Origin header) are always allowed.
    const requestOrigin = req.headers.origin
    if (apiKey.allowedOrigins.length > 0 && typeof requestOrigin === 'string') {
      if (!apiKey.allowedOrigins.includes(requestOrigin)) {
        res.status(403).json({
          message: 'Origin not allowed for this API key',
          code: 'ORIGIN_NOT_ALLOWED'
        })
        return
      }
      // Override the wildcard CORS header set upstream with the specific
      // origin so the browser actually accepts the response.
      res.setHeader('Access-Control-Allow-Origin', requestOrigin)
      res.setHeader('Vary', 'Origin')
    }

    // ── Per-key rate limit ────────────────────────────────
    const rate = consumeRateToken(apiKey.id, apiKey.rateLimitPerMinute)
    res.setHeader('X-RateLimit-Limit', String(rate.limit))
    res.setHeader('X-RateLimit-Remaining', String(rate.remaining))
    res.setHeader('X-RateLimit-Reset', String(Math.floor(rate.resetAtMs / 1000)))
    if (!rate.ok) {
      res.setHeader('Retry-After', String(rate.retryAfterSec))
      res.status(429).json({
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: rate.retryAfterSec
      })
      return
    }

    req.apiKey = {
      apiKeyId: apiKey.id,
      siteId: apiKey.siteId,
      siteSlug: apiKey.site.slug,
      scopes: apiKey.scopes
    }

    // Update lastUsedAt without blocking the request.
    void prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
        select: { id: true }
      })
      .catch((err) => {
        console.warn('Failed to update apiKey.lastUsedAt:', err)
      })

    next()
  } catch (error) {
    next(error)
  }
}

/**
 * requireScope — gate a route on a specific scope. Use AFTER requireApiKey.
 */
export const requireScope = (scope: ApiKeyScope): RequestHandler => {
  return (req, res, next) => {
    if (!req.apiKey) {
      res.status(401).json({
        message: 'API key required',
        code: 'API_KEY_REQUIRED'
      })
      return
    }
    if (!req.apiKey.scopes.includes(scope)) {
      res.status(403).json({
        message: `Missing required scope: ${scope}`,
        code: 'API_KEY_SCOPE_REQUIRED'
      })
      return
    }
    next()
  }
}
