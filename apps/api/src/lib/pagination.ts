import { z } from 'zod'
import type { PaginatedData } from './response'

/**
 * Standardized pagination query parsing.
 *
 * Accepts:
 *   ?page=1          (1-indexed, defaults to 1)
 *   ?pageSize=20     (default 20, max 100)
 *
 * Returns the parsed values plus Prisma-friendly `skip` / `take`.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
})

export type PaginationParams = z.infer<typeof paginationQuerySchema>

export type ParsedPagination = PaginationParams & {
  skip: number
  take: number
}

/**
 * Parse pagination from a query object. Throws a `ZodError` on bad input —
 * callers should use `.safeParse()` if they want a soft fail.
 */
export const parsePagination = (query: unknown): ParsedPagination => {
  const parsed = paginationQuerySchema.parse(query)
  return {
    ...parsed,
    skip: (parsed.page - 1) * parsed.pageSize,
    take: parsed.pageSize
  }
}

/**
 * Wrap a list of items + total count in the shared `PaginatedData` shape so
 * controllers can hand it straight to `sendPaginated`.
 */
export const buildPaginated = <T>(
  items: T[],
  total: number,
  pagination: { page: number; pageSize: number }
): PaginatedData<T> => ({
  items,
  total,
  page: pagination.page,
  pageSize: pagination.pageSize,
  pageCount: Math.max(1, Math.ceil(total / pagination.pageSize))
})
