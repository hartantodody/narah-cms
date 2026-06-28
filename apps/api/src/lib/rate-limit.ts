/**
 * Tiny in-memory fixed-window rate limiter.
 *
 * NOTE: This is single-instance only. If we ever run multiple API
 * replicas, swap the underlying store for Redis (e.g. ioredis + a Lua
 * script). The interface is intentionally small so that swap is a 1-file
 * change.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000 // 1 minute

// Periodic GC so the map doesn't grow forever.
const GC_INTERVAL_MS = 5 * 60_000
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}, GC_INTERVAL_MS).unref?.()

export type RateLimitResult = {
  ok: boolean
  limit: number
  remaining: number
  resetAtMs: number
  retryAfterSec: number
}

/**
 * Take one token for `key`. Returns whether the request is allowed plus
 * the headers worth surfacing to the client.
 */
export const consumeRateToken = (
  key: string,
  maxPerMinute: number
): RateLimitResult => {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + WINDOW_MS
    buckets.set(key, { count: 1, resetAt })
    return {
      ok: true,
      limit: maxPerMinute,
      remaining: Math.max(0, maxPerMinute - 1),
      resetAtMs: resetAt,
      retryAfterSec: 0
    }
  }

  if (existing.count >= maxPerMinute) {
    return {
      ok: false,
      limit: maxPerMinute,
      remaining: 0,
      resetAtMs: existing.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    }
  }

  existing.count += 1
  return {
    ok: true,
    limit: maxPerMinute,
    remaining: Math.max(0, maxPerMinute - existing.count),
    resetAtMs: existing.resetAt,
    retryAfterSec: 0
  }
}
