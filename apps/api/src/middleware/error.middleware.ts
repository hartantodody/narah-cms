import type { ErrorRequestHandler } from 'express'

type ErrorWithStatus = Error & {
  status?: number
  statusCode?: number
}

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, next) => {
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
    console.error(error)
  }

  res.status(statusCode).json({
    message
  })
}
