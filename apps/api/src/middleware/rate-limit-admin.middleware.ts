import rateLimit, { type Options } from 'express-rate-limit'
import { env } from '../config/env'
import type { ApiError } from '../lib/response'

// In integration tests we hammer these endpoints from one IP — bump the
// cap absurdly high so the limiter never trips during happy-path tests.
// Rate limit *behaviour* is verified manually (see docs/qa).
const TEST_BYPASS_MULTIPLIER = env.NODE_ENV === 'test' ? 1_000 : 1

/**
 * Tighter rate-limit for unauthenticated / pre-auth admin endpoints
 * (login, accept-invitation). Per-IP fixed window, returns the standard
 * envelope on rejection so the frontend can surface the message via the
 * same `ApiError` path.
 *
 * Defaults: 10 attempts per 15 minutes per IP.
 *
 * For multi-instance deployments swap the in-memory store for Redis
 * (`rate-limit-redis`). The signature stays the same.
 */
const buildLimiter = (overrides: Partial<Options> = {}) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10 * TEST_BYPASS_MULTIPLIER,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res, _next, options) => {
      const payload: ApiError = {
        success: false,
        message: 'Too many attempts — please slow down and try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }
      res.status(options.statusCode).json(payload)
    },
    ...overrides
  })

/** Login: 10 attempts / 15 min / IP. */
export const loginRateLimiter = buildLimiter()

/** Invitation acceptance: 20 attempts / 15 min / IP (still anti-bruteforce). */
export const invitationAcceptRateLimiter = buildLimiter({
  max: 20 * TEST_BYPASS_MULTIPLIER
})

/** Register: 5 new accounts / 15 min / IP — slower since it creates real rows. */
export const registerRateLimiter = buildLimiter({
  max: 5 * TEST_BYPASS_MULTIPLIER
})
