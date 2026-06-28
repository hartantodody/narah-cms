import type { RequestHandler } from 'express'
import { prisma } from '../../lib/prisma'
import { requireUserOrThrow } from '../../lib/guards'
import { sendOk } from '../../lib/response'

export const getHealth: RequestHandler = (_req, res) => {
  sendOk(res, {
    status: 'ok',
    service: '@narah-cms/api',
    timestamp: new Date().toISOString()
  })
}

export const getDatabaseHealth: RequestHandler = async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    sendOk(res, { database: 'connected' })
  } catch (error) {
    next(error)
  }
}

export const getProtectedHealth: RequestHandler = (req, res, next) => {
  try {
    const user = requireUserOrThrow(req.user)
    sendOk(res, { userId: user.id })
  } catch (error) {
    next(error)
  }
}
