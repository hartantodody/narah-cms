import type { ErrorRequestHandler } from 'express'
import { logger } from '../lib/logger'
import type { ApiError } from '../lib/response'

type ErrorWithStatus = Error & {
  status?: number
  statusCode?: number
  code?: string
  issues?: string[]
}

/**
 * Centralized error middleware. Every error thrown / `next(err)`ed inside an
 * admin route lands here and gets re-shaped into the standard envelope:
 *
 *   { success: false, message, code?, issues? }
 *
 * 5xx errors hide the original message (treated as opaque server failures)
 * but the original is still logged. 4xx errors pass `message` through so
 * clients can surface it.
 */
export const errorMiddleware: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error)
    return
  }

  const typedError = error as ErrorWithStatus
  const statusCode = typedError.statusCode ?? typedError.status ?? 500
  const message =
    statusCode >= 500
      ? 'Internal server error'
      : typedError.message || 'Request failed'

  if (statusCode >= 500) {
    logger.error(
      { err: error, requestId: req.id, path: req.path, method: req.method },
      'request failed'
    )
  }

  const issues = Array.isArray(typedError.issues) ? typedError.issues : undefined

  const payload: ApiError = {
    success: false,
    message,
    ...(typedError.code ? { code: typedError.code } : {}),
    ...(issues ? { issues } : {})
  }

  res.status(statusCode).json(payload)
}
