import cors from 'cors'
import express, { Router, type RequestHandler } from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { env } from './config/env'
import { registerSwagger } from './docs/swagger'
import { logger } from './lib/logger'
import { errorMiddleware } from './middleware/error.middleware'
import { notFoundMiddleware } from './middleware/not-found.middleware'
import { requestIdMiddleware } from './middleware/request-id.middleware'
import { auditRouter } from './modules/audit/audit.routes'
import { authRouter } from './modules/auth/auth.routes'
import { healthRouter } from './modules/health/health.routes'
import { invitationsRouter } from './modules/invitations/invitations.routes'
import { mediaRenderRouter } from './modules/media-render/media-render.routes'
import { publicRouter } from './modules/public/public-delivery.routes'
import { sitesRouter } from './modules/sites/sites.routes'
import { usersRouter } from './modules/users/users.routes'

const apiV1Router = Router()

apiV1Router.use('/health', healthRouter)

export const app = express()

app.disable('x-powered-by')
if (env.TRUST_PROXY) app.set('trust proxy', 1)

app.use(requestIdMiddleware)
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req as { id?: string }).id ?? '',
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error'
      if (res.statusCode >= 400) return 'warn'
      return 'info'
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode })
    }
  }) as unknown as RequestHandler
)

// Swagger UI needs inline scripts/styles — disable CSP outside of prod;
// other helmet defaults stay (HSTS, X-Content-Type-Options, Referrer-Policy).
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }) as RequestHandler
)

app.use(
  cors({
    origin: env.CORS_ORIGIN
  })
)
app.use(express.json({ limit: '1mb' }) as RequestHandler)

// Originals are NEVER served directly. All image access goes through the
// transform pipeline at /api/media/:assetId, which returns a derivative
// (resized + compressed + format-negotiated). Admins can still download the
// original via the auth-gated endpoint at /sites/:siteId/media/:assetId/download.
app.use('/api/media', mediaRenderRouter)

// Public delivery API — API-key authenticated, open CORS, only PUBLISHED content.
app.use('/public/v1', publicRouter)

registerSwagger(app)
app.use('/auth', authRouter)
app.use('/audit-logs', auditRouter)
app.use('/invitations', invitationsRouter)
app.use('/sites', sitesRouter)
app.use('/users', usersRouter)

app.get('/', (_req, res) => {
  res.json({
    name: 'Narah CMS API',
    service: '@narah-cms/api',
    environment: env.NODE_ENV,
    version: 'v1',
    routes: {
      root: '/',
      health: '/health',
      v1Health: '/api/v1/health'
    }
  })
})

app.use('/api/v1', apiV1Router)
app.use('/health', healthRouter)

app.use(notFoundMiddleware)
app.use(errorMiddleware)
