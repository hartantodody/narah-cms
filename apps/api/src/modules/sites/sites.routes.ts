import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.middleware'
import { requireAcceptedPolicies } from '../../middleware/policy-guard.middleware'
import {
  listSiteMembers,
  removeSiteMember,
  updateSiteMember
} from './site-members.controller'
import {
  createSiteInvitation,
  listSiteInvitations,
  revokeSiteInvitation
} from './site-invitations.controller'
import {
  createContentField,
  createContentType,
  deleteContentField,
  deleteContentType,
  getContentTypeById,
  analyzeContentFieldChange,
  listContentTypes,
  reorderContentFields,
  updateContentField,
  replaceContentType,
  updateContentType
} from './content-types.controller'
import {
  createContentEntry,
  deleteContentEntry,
  getContentEntryById,
  getContentEntryRevision,
  listContentEntries,
  listContentEntryRevisions,
  publishContentEntry,
  restoreContentEntryRevision,
  unpublishContentEntry,
  updateContentEntry
} from './content-entries.controller'
import {
  deleteMediaAsset,
  downloadMediaAssetOriginal,
  getMediaAsset,
  listMediaAssets,
  updateMediaAsset,
  uploadMediaAsset,
  uploadMiddleware
} from './media-assets.controller'
import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKey
} from './api-keys.controller'
import { listSiteAuditLogs } from '../audit/audit.controller'
import {
  deleteAnalyticsConfig,
  getAnalyticsConfig,
  getAnalyticsOverview,
  setAnalyticsConfig,
} from './analytics.controller'
import {
  archiveSite,
  createSite,
  getSiteById,
  listRecentEntries,
  listSites,
  updateSite
} from './sites.controller'

const sitesRouter = Router()

sitesRouter.use(requireAuth, requireAcceptedPolicies)

sitesRouter.get('/', listSites)
// Any authenticated user can create a site. Tier limits (FREE = 1 owned
// site) are enforced inside `createSiteForUser`. The creator becomes OWNER.
sitesRouter.post('/', createSite)
sitesRouter.get('/:siteId/content-types', listContentTypes)
// Content-type management: OWNER / ADMIN / super admin. Checked in the
// service via `ensureSchemaManageAccess`.
sitesRouter.post('/:siteId/content-types', createContentType)
sitesRouter.get('/:siteId/content-types/:contentTypeId', getContentTypeById)
sitesRouter.patch(
  '/:siteId/content-types/:contentTypeId',
  updateContentType
)
sitesRouter.put(
  '/:siteId/content-types/:contentTypeId/schema',
  replaceContentType
)
sitesRouter.delete(
  '/:siteId/content-types/:contentTypeId',
  deleteContentType
)
sitesRouter.post(
  '/:siteId/content-types/:contentTypeId/fields',
  createContentField
)
sitesRouter.patch(
  '/:siteId/content-types/:contentTypeId/fields/reorder',
  reorderContentFields
)
sitesRouter.patch(
  '/:siteId/content-types/:contentTypeId/fields/:fieldId',
  updateContentField
)
sitesRouter.post(
  '/:siteId/content-types/:contentTypeId/fields/:fieldId/impact-analysis',
  analyzeContentFieldChange
)
sitesRouter.delete(
  '/:siteId/content-types/:contentTypeId/fields/:fieldId',
  deleteContentField
)
sitesRouter.get(
  '/:siteId/content-types/:contentTypeId/entries',
  listContentEntries
)
sitesRouter.post(
  '/:siteId/content-types/:contentTypeId/entries',
  createContentEntry
)
sitesRouter.get(
  '/:siteId/content-types/:contentTypeId/entries/:entryId',
  getContentEntryById
)
sitesRouter.patch(
  '/:siteId/content-types/:contentTypeId/entries/:entryId',
  updateContentEntry
)
sitesRouter.delete(
  '/:siteId/content-types/:contentTypeId/entries/:entryId',
  deleteContentEntry
)
sitesRouter.post(
  '/:siteId/content-types/:contentTypeId/entries/:entryId/publish',
  publishContentEntry
)
sitesRouter.post(
  '/:siteId/content-types/:contentTypeId/entries/:entryId/unpublish',
  unpublishContentEntry
)
sitesRouter.get(
  '/:siteId/content-types/:contentTypeId/entries/:entryId/revisions',
  listContentEntryRevisions
)
sitesRouter.get(
  '/:siteId/content-types/:contentTypeId/entries/:entryId/revisions/:revisionId',
  getContentEntryRevision
)
sitesRouter.post(
  '/:siteId/content-types/:contentTypeId/entries/:entryId/revisions/:revisionId/restore',
  restoreContentEntryRevision
)
sitesRouter.get('/:siteId/media', listMediaAssets)
sitesRouter.post('/:siteId/media', uploadMiddleware, uploadMediaAsset)
sitesRouter.get('/:siteId/media/:assetId', getMediaAsset)
sitesRouter.get(
  '/:siteId/media/:assetId/download',
  downloadMediaAssetOriginal
)
sitesRouter.patch('/:siteId/media/:assetId', updateMediaAsset)
sitesRouter.delete('/:siteId/media/:assetId', deleteMediaAsset)
// API keys: OWNER / ADMIN / super admin. Service-side `ensureManage` enforces.
sitesRouter.get('/:siteId/api-keys', listApiKeys)
sitesRouter.post('/:siteId/api-keys', createApiKey)
sitesRouter.patch('/:siteId/api-keys/:apiKeyId', updateApiKey)
sitesRouter.post('/:siteId/api-keys/:apiKeyId/revoke', revokeApiKey)
sitesRouter.delete('/:siteId/api-keys/:apiKeyId', deleteApiKey)
sitesRouter.get('/:siteId/members', listSiteMembers)
sitesRouter.patch('/:siteId/members/:memberId', updateSiteMember)
sitesRouter.delete('/:siteId/members/:memberId', removeSiteMember)
sitesRouter.get('/:siteId/invitations', listSiteInvitations)
sitesRouter.post('/:siteId/invitations', createSiteInvitation)
sitesRouter.delete('/:siteId/invitations/:invitationId', revokeSiteInvitation)
sitesRouter.get('/:siteId/recent-entries', listRecentEntries)
sitesRouter.get('/:siteId/audit-logs', listSiteAuditLogs)

// Google Analytics integration. Read = anyone with site access; write =
// OWNER / ADMIN (enforced inside the service).
sitesRouter.get('/:siteId/analytics/config', getAnalyticsConfig)
sitesRouter.put('/:siteId/analytics/config', setAnalyticsConfig)
sitesRouter.delete('/:siteId/analytics/config', deleteAnalyticsConfig)
sitesRouter.get('/:siteId/analytics/overview', getAnalyticsOverview)

sitesRouter.get('/:siteId', getSiteById)
// Site update: OWNER / ADMIN / super admin. Archive: OWNER / super admin only.
sitesRouter.patch('/:siteId', updateSite)
sitesRouter.delete('/:siteId', archiveSite)

export { sitesRouter }
