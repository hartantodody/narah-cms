import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

const HEADER = 'x-request-id'

declare module 'express-serve-static-core' {
  interface Request {
    id?: string
  }
}

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header(HEADER)
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID()
  req.id = id
  res.setHeader(HEADER, id)
  next()
}
