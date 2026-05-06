import cors from 'cors'
import express, { Router } from 'express'
import { env } from './config/env'
import { errorMiddleware } from './middleware/error.middleware'
import { notFoundMiddleware } from './middleware/not-found.middleware'
import { healthRouter } from './modules/health/health.routes'

const apiV1Router = Router()

apiV1Router.use('/health', healthRouter)

export const app = express()

app.disable('x-powered-by')
app.use(
  cors({
    origin: env.CORS_ORIGIN
  })
)
app.use(express.json())

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
