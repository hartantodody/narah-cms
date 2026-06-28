import type { RequestHandler } from 'express'
import type { ApiError } from '../lib/response'

export const notFoundMiddleware: RequestHandler = (req, res) => {
  const payload: ApiError = {
    success: false,
    message: 'Route not found',
    code: 'ROUTE_NOT_FOUND'
  }
  res.status(404).json(payload)
}
