import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import {
  getUserByIdHandler,
  listUsersHandler,
  updateUserHandler
} from './users.controller'

/**
 * Platform user management. All routes require an authenticated super admin;
 * the super-admin check lives inside each service function (returns 403 with
 * `FORBIDDEN` code via the envelope error path).
 */
export const usersRouter = Router()

usersRouter.use(requireAuth)

usersRouter.get('/', listUsersHandler)
usersRouter.get('/:userId', getUserByIdHandler)
usersRouter.patch('/:userId', updateUserHandler)
