import { app } from './app'
import { env } from './config/env'
import { logger } from './lib/logger'
import { prisma } from './lib/prisma'

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    `Narah CMS API listening on http://localhost:${env.PORT}`
  )
})

// Drain in-flight requests, then disconnect Prisma, then exit. A hard timeout
// guarantees we exit even if a request is stuck.
const SHUTDOWN_TIMEOUT_MS = 10_000
let shuttingDown = false

const shutdown = async (signal: string) => {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, 'shutdown signal received — draining')

  const forceExit = setTimeout(() => {
    logger.error('shutdown timeout exceeded — forcing exit')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)
  forceExit.unref()

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'http server close failed')
    }
    try {
      await prisma.$disconnect()
      logger.info('shutdown complete')
      process.exit(0)
    } catch (disconnectErr) {
      logger.error({ err: disconnectErr }, 'prisma disconnect failed')
      process.exit(1)
    }
  })
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException')
  void shutdown('uncaughtException')
})
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandledRejection')
  void shutdown('unhandledRejection')
})
