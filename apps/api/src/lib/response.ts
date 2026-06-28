import type { Response } from 'express'

/**
 * Narah CMS API response envelope.
 *
 * Every admin-facing endpoint wraps its payload in this shape so consumers
 * (the admin web app, and any third-party tool built against the management
 * API) see a uniform contract. Public delivery (`/public/v1/*`) and binary
 * endpoints (`/api/media/*`) keep their own contracts.
 *
 *   Success: { success: true,  message, data }
 *   Error:   { success: false, message, code?, issues? }
 *
 * For paginated lists, pagination metadata lives INSIDE `data`:
 *   { success: true, message, data: { items, total, page, pageSize, pageCount } }
 *
 * Use the helpers below from controllers; don't `res.json(...)` directly so
 * the envelope stays consistent.
 */

export type ApiSuccess<T> = {
  success: true
  message: string
  data: T
}

export type ApiError = {
  success: false
  message: string
  code?: string
  issues?: string[]
}

export type PaginatedData<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

/** 200 OK. */
export const sendOk = <T>(res: Response, data: T, message = 'OK') => {
  return res.status(200).json({
    success: true,
    message,
    data
  } satisfies ApiSuccess<T>)
}

/** 201 Created — for POST endpoints that produced a new resource. */
export const sendCreated = <T>(res: Response, data: T, message = 'Created') => {
  return res.status(201).json({
    success: true,
    message,
    data
  } satisfies ApiSuccess<T>)
}

/** 200 OK with `null` data. Use for soft-delete / archive style actions. */
export const sendOkEmpty = (res: Response, message = 'OK') => {
  return res.status(200).json({
    success: true,
    message,
    data: null
  } satisfies ApiSuccess<null>)
}

/** 200 OK with a paginated list. `data` carries items + meta. */
export const sendPaginated = <T>(
  res: Response,
  paginated: PaginatedData<T>,
  message = 'OK'
) => {
  return res.status(200).json({
    success: true,
    message,
    data: paginated
  } satisfies ApiSuccess<PaginatedData<T>>)
}
