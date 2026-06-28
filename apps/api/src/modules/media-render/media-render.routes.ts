import { Router } from 'express'
import { renderMediaAsset } from './media-render.controller'

const mediaRenderRouter = Router()

// Public — no auth, no policy guard. The asset id is enough to fetch.
// Originals are never returned by this route; always a derivative.
mediaRenderRouter.get('/:assetId', renderMediaAsset)

export { mediaRenderRouter }
