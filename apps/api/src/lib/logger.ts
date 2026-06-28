import pino from 'pino'
import { env } from '../config/env'

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: '@narah-cms/api', env: env.NODE_ENV },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      '*.password',
      '*.token',
      '*.secret'
    ],
    censor: '[redacted]'
  }
})

export type Logger = typeof logger
