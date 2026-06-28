import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { prisma } from '../../lib/prisma'
import { encryptString, decryptString } from '../../lib/crypto'
import { HttpError } from '../../utils/http-error'
import type { AuthenticatedRequestUser } from '../auth/auth.types'
import { canAccessSite, canManageSite } from './sites.authorization'
import type { SetAnalyticsConfigInput } from './analytics.schemas'

/* ────────────────────────────────────────────────────────────────────────── */
/*  Access guards                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

const ensureSiteAccess = async (
  user: AuthenticatedRequestUser,
  siteId: string,
) => {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true },
  })
  if (!site) {
    throw new HttpError({
      message: 'Site not found',
      statusCode: 404,
      code: 'SITE_NOT_FOUND',
    })
  }
  if (!(await canAccessSite(user, siteId))) {
    throw new HttpError({
      message: 'You do not have access to this site',
      statusCode: 403,
      code: 'FORBIDDEN',
    })
  }
}

const ensureManageAccess = async (
  user: AuthenticatedRequestUser,
  siteId: string,
) => {
  if (!(await canManageSite(user, siteId))) {
    throw new HttpError({
      message: 'Only site OWNER or ADMIN can change analytics settings',
      statusCode: 403,
      code: 'FORBIDDEN',
    })
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Config                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

// Outward-facing config never returns the encrypted SA JSON. The UI shows
// "connected" + property id only.
const sanitizeConfig = (record: {
  propertyId: string
  updatedAt: Date
}) => ({
  connected: true,
  propertyId: record.propertyId,
  updatedAt: record.updatedAt.toISOString(),
})

export const getAnalyticsConfigForUser = async ({
  user,
  siteId,
}: {
  user: AuthenticatedRequestUser
  siteId: string
}) => {
  await ensureSiteAccess(user, siteId)
  const record = await prisma.siteAnalyticsConfig.findUnique({
    where: { siteId },
    select: { propertyId: true, updatedAt: true },
  })
  if (!record) {
    return { config: { connected: false as const } }
  }
  return { config: sanitizeConfig(record) }
}

export const setAnalyticsConfigForUser = async ({
  user,
  siteId,
  input,
}: {
  user: AuthenticatedRequestUser
  siteId: string
  input: SetAnalyticsConfigInput
}) => {
  await ensureSiteAccess(user, siteId)
  await ensureManageAccess(user, siteId)

  // Validate service account JSON shape before storing.
  let parsed: { client_email?: string; private_key?: string }
  try {
    parsed = JSON.parse(input.serviceAccount)
  } catch {
    throw new HttpError({
      message: 'Service account must be valid JSON',
      statusCode: 400,
      code: 'INVALID_SERVICE_ACCOUNT',
    })
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new HttpError({
      message:
        'Service account JSON is missing client_email or private_key fields',
      statusCode: 400,
      code: 'INVALID_SERVICE_ACCOUNT',
    })
  }

  const encrypted = encryptString(input.serviceAccount)

  const record = await prisma.siteAnalyticsConfig.upsert({
    where: { siteId },
    create: {
      siteId,
      propertyId: input.propertyId,
      serviceAccountCiphertext: encrypted.ciphertext,
      serviceAccountIv: encrypted.iv,
      serviceAccountAuthTag: encrypted.authTag,
    },
    update: {
      propertyId: input.propertyId,
      serviceAccountCiphertext: encrypted.ciphertext,
      serviceAccountIv: encrypted.iv,
      serviceAccountAuthTag: encrypted.authTag,
    },
    select: { propertyId: true, updatedAt: true },
  })

  return { config: sanitizeConfig(record) }
}

export const deleteAnalyticsConfigForUser = async ({
  user,
  siteId,
}: {
  user: AuthenticatedRequestUser
  siteId: string
}) => {
  await ensureSiteAccess(user, siteId)
  await ensureManageAccess(user, siteId)

  await prisma.siteAnalyticsConfig
    .delete({ where: { siteId } })
    .catch(() => {
      /* idempotent — already disconnected */
    })

  return { config: { connected: false as const } }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Overview report                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const loadCredentials = async (siteId: string) => {
  const record = await prisma.siteAnalyticsConfig.findUnique({
    where: { siteId },
    select: {
      propertyId: true,
      serviceAccountCiphertext: true,
      serviceAccountIv: true,
      serviceAccountAuthTag: true,
    },
  })
  if (!record) {
    throw new HttpError({
      message: 'Google Analytics is not connected for this site',
      statusCode: 404,
      code: 'ANALYTICS_NOT_CONFIGURED',
    })
  }

  let json: { client_email: string; private_key: string }
  try {
    json = JSON.parse(
      decryptString({
        ciphertext: record.serviceAccountCiphertext,
        iv: record.serviceAccountIv,
        authTag: record.serviceAccountAuthTag,
      }),
    )
  } catch {
    throw new HttpError({
      message: 'Stored service account is unreadable. Reconnect Analytics.',
      statusCode: 500,
      code: 'ANALYTICS_CREDENTIAL_DECRYPT_FAILED',
    })
  }

  return { propertyId: record.propertyId, credentials: json }
}

const buildClient = (credentials: { client_email: string; private_key: string }) =>
  new BetaAnalyticsDataClient({
    credentials: {
      client_email: credentials.client_email,
      // SA JSONs store newlines as literal \n strings when copy-pasted; the
      // gRPC client wants real newlines.
      private_key: credentials.private_key.replace(/\\n/g, '\n'),
    },
  })

type OverviewRow<T> = { value: T; label: string }

export const getAnalyticsOverviewForUser = async ({
  user,
  siteId,
}: {
  user: AuthenticatedRequestUser
  siteId: string
}) => {
  await ensureSiteAccess(user, siteId)

  const { propertyId, credentials } = await loadCredentials(siteId)
  const client = buildClient(credentials)

  const property = `properties/${propertyId}`
  const dateRange = { startDate: '30daysAgo', endDate: 'today' }

  try {
    const [summaryRes, topPagesRes, sourcesRes, dailyRes] = await Promise.all([
      client.runReport({
        property,
        dateRanges: [dateRange],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'sessions' },
          { name: 'bounceRate' },
        ],
      }),
      client.runReport({
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 5,
      }),
      client.runReport({
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 5,
      }),
      // Per-day series for the trend chart. GA returns date as YYYYMMDD;
      // we keep raw and let the UI format.
      client.runReport({
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
    ])

    const summaryRow = summaryRes[0].rows?.[0]
    const summary = {
      activeUsers: Number(summaryRow?.metricValues?.[0]?.value ?? 0),
      pageViews: Number(summaryRow?.metricValues?.[1]?.value ?? 0),
      sessions: Number(summaryRow?.metricValues?.[2]?.value ?? 0),
      bounceRate: Number(summaryRow?.metricValues?.[3]?.value ?? 0),
    }

    const topPages: OverviewRow<number>[] = (topPagesRes[0].rows ?? []).map(
      (row) => ({
        label: row.dimensionValues?.[0]?.value ?? '(unknown)',
        value: Number(row.metricValues?.[0]?.value ?? 0),
      }),
    )

    const sources: OverviewRow<number>[] = (sourcesRes[0].rows ?? []).map(
      (row) => ({
        label: row.dimensionValues?.[0]?.value ?? '(unknown)',
        value: Number(row.metricValues?.[0]?.value ?? 0),
      }),
    )

    // YYYYMMDD → YYYY-MM-DD for the UI; GA returns the dimension as a
    // packed numeric string.
    const formatDate = (raw: string) =>
      raw.length === 8
        ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
        : raw

    const dailySeries = (dailyRes[0].rows ?? []).map((row) => ({
      date: formatDate(row.dimensionValues?.[0]?.value ?? ''),
      users: Number(row.metricValues?.[0]?.value ?? 0),
      pageViews: Number(row.metricValues?.[1]?.value ?? 0),
    }))

    return {
      propertyId,
      range: { days: 30 },
      summary,
      topPages,
      sources,
      dailySeries,
    }
  } catch (error: unknown) {
    // Most common causes are user-config issues (Analytics Data API not
    // enabled, SA missing Viewer role, wrong property id) rather than
    // server bugs. Surface as 400 so the real message reaches the UI
    // instead of getting masked to "Internal server error".
    const raw = error instanceof Error ? error.message : 'Unknown analytics error'
    console.error('[analytics] runReport failed:', raw)
    throw new HttpError({
      message: `Google Analytics request failed: ${raw}`,
      statusCode: 400,
      code: 'ANALYTICS_REQUEST_FAILED',
    })
  }
}
