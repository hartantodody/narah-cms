import type { AuthenticatedRequestUser } from '../modules/auth/auth.types'

export type ApiKeyContext = {
  apiKeyId: string
  siteId: string
  siteSlug: string
  scopes: string[]
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedRequestUser
      apiKey?: ApiKeyContext
    }
  }
}

export {}
