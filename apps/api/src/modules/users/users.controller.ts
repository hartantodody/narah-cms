import type { RequestHandler } from 'express'
import { parseOrThrow, requireUserOrThrow } from '../../lib/guards'
import { sendOk, sendPaginated } from '../../lib/response'
import { recordAudit } from '../audit/audit.service'
import {
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamsSchema
} from './users.schemas'
import { getUserById, listUsers, updateUser } from './users.service'

export const listUsersHandler: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireUserOrThrow(req.user)
    const query = parseOrThrow(listUsersQuerySchema, req.query, 'Invalid query parameters')

    const result = await listUsers(actor, query)
    sendPaginated(res, result)
  } catch (error) {
    next(error)
  }
}

export const getUserByIdHandler: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireUserOrThrow(req.user)
    const { userId } = parseOrThrow(userIdParamsSchema, req.params, 'Invalid user id')

    const user = await getUserById(actor, userId)
    sendOk(res, { user })
  } catch (error) {
    next(error)
  }
}

export const updateUserHandler: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireUserOrThrow(req.user)
    const { userId } = parseOrThrow(userIdParamsSchema, req.params, 'Invalid user id')
    const body = parseOrThrow(updateUserSchema, req.body, 'Invalid request body')

    const user = await updateUser(actor, userId, body)

    await recordAudit({
      req,
      action: 'user.updated',
      entityType: 'user',
      entityId: userId,
      userId: actor.id,
      metadata: { changes: body }
    })

    sendOk(res, { user }, 'User updated')
  } catch (error) {
    next(error)
  }
}
