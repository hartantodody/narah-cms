import cors from 'cors'
import { Router } from 'express'
import {
  requireApiKey,
  requireScope
} from '../../middleware/api-key.middleware'
import { API_KEY_SCOPES } from '../../utils/api-key'
import {
  getApiKeyInfo,
  getPublishedEntryBySlug,
  listPublishedEntries
} from './public-delivery.controller'

const publicRouter = Router()

// Public delivery is designed for cross-origin browser consumption
// (websites embedding their content), so we allow any origin here.
// Per-key origin allowlist can be layered on later.
publicRouter.use(
  cors({
    origin: true,
    methods: ['GET'],
    allowedHeaders: ['Authorization', 'X-Api-Key', 'Content-Type'],
    exposedHeaders: [
      'Cache-Control',
      'ETag',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After'
    ]
  })
)

publicRouter.use(requireApiKey)

publicRouter.get('/me', getApiKeyInfo)

publicRouter.get(
  '/content-types/:contentTypeApiId/entries',
  requireScope(API_KEY_SCOPES.ENTRIES_READ),
  listPublishedEntries
)

publicRouter.get(
  '/content-types/:contentTypeApiId/entries/:slug',
  requireScope(API_KEY_SCOPES.ENTRIES_READ),
  getPublishedEntryBySlug
)

export { publicRouter }
