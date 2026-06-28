import type { Express, RequestHandler } from 'express'
import swaggerUi from 'swagger-ui-express'
import { openApiDocument } from './openapi'

const swaggerUiHandler: RequestHandler = swaggerUi.setup(undefined, {
  customSiteTitle: 'Narah CMS API Docs',
  explorer: true,
  swaggerOptions: {
    url: '/openapi.json',
    persistAuthorization: true,
    displayRequestDuration: true
  }
})

export const registerSwagger = (app: Express) => {
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument)
  })

  app.get(['/api/docs', '/api/docs/'], (_req, res) => {
    res.redirect(302, '/docs')
  })

  app.get('/api/docs.json', (_req, res) => {
    res.redirect(302, '/openapi.json')
  })

  app.use('/docs', swaggerUi.serve, swaggerUiHandler)
}
