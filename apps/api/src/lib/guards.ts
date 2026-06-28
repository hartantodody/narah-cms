import type { z } from 'zod'
import { HttpError } from '../utils/http-error'
import type { AuthenticatedRequestUser } from '../modules/auth/auth.types'

/**
 * Assert that an authenticated user is present on the request. Throws a
 * 401 `HttpError` (caught by the error middleware → envelope) when missing.
 *
 * Use after `requireAuth` middleware:
 *   const user = requireUserOrThrow(req.user)
 */
export const requireUserOrThrow = (
  user: AuthenticatedRequestUser | undefined
): AuthenticatedRequestUser => {
  if (!user) {
    throw new HttpError({
      message: 'Authentication required',
      statusCode: 401,
      code: 'AUTH_REQUIRED'
    })
  }
  return user
}

/**
 * Parse `value` against a Zod schema. On failure, throw a 400 `HttpError`
 * (caught by the error middleware → envelope) with the validation issues
 * exposed as `issues: string[]`.
 *
 * Use for params / query / body validation:
 *   const params = parseOrThrow(siteIdParamsSchema, req.params, 'Invalid site id')
 */
export const parseOrThrow = <T>(
  schema: z.ZodType<T>,
  value: unknown,
  message = 'Invalid request',
  code = 'INVALID_INPUT'
): T => {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new HttpError({
      message,
      statusCode: 400,
      code,
      issues: parsed.error.issues.map((issue) => issue.message)
    })
  }
  return parsed.data
}
