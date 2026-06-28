import type { Prisma } from '../../../generated/prisma/client'
import { SiteRole, SiteStatus } from '../../../generated/prisma/client'
import { prisma } from '../../lib/prisma'
import { HttpError } from '../../utils/http-error'
import type { AuthenticatedRequestUser } from '../auth/auth.types'
import {
  canAccessSite,
  canManageSite,
  getSiteRoleForUser
} from './sites.authorization'
import type {
  CreateSiteInput,
  ListSitesQuery,
  UpdateSiteInput
} from './sites.schemas'
import { normalizeSiteSlug } from './sites.schemas'

const siteSummarySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      members: true
    }
  }
} satisfies Prisma.SiteSelect

const getSiteDetailSelect = (userId: string) =>
  ({
    id: true,
    name: true,
    slug: true,
    description: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    members: {
      where: {
        userId
      },
      select: {
        role: true
      },
      take: 1
    },
    _count: {
      select: {
        members: true,
        contentTypes: true,
        contentEntries: true,
        mediaAssets: true
      }
    }
  }) satisfies Prisma.SiteSelect

type SiteSummaryRecord = Prisma.SiteGetPayload<{
  select: typeof siteSummarySelect
}>

type SiteDetailRecord = Prisma.SiteGetPayload<{
  select: ReturnType<typeof getSiteDetailSelect>
}>

const isPrismaUniqueConstraintError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'P2002'

const getSlugConflictError = () =>
  new HttpError({
    message: 'A site with this slug already exists',
    statusCode: 409,
    code: 'SITE_SLUG_CONFLICT'
  })

const serializeSiteSummary = (site: SiteSummaryRecord) => ({
  id: site.id,
  name: site.name,
  slug: site.slug,
  description: site.description,
  status: site.status,
  createdAt: site.createdAt,
  updatedAt: site.updatedAt,
  memberCount: site._count.members
})

const serializeSiteDetail = (
  site: SiteDetailRecord,
  totalMediaBytes: number = 0
) => ({
  id: site.id,
  name: site.name,
  slug: site.slug,
  description: site.description,
  status: site.status,
  createdAt: site.createdAt,
  updatedAt: site.updatedAt,
  currentUserRole: site.members[0]?.role ?? null,
  memberCount: site._count.members,
  contentTypeCount: site._count.contentTypes,
  entryCount: site._count.contentEntries,
  mediaAssetCount: site._count.mediaAssets,
  totalMediaBytes
})

const getSiteTotalMediaBytes = async (siteId: string): Promise<number> => {
  const aggregate = await prisma.mediaAsset.aggregate({
    where: { siteId },
    _sum: { sizeBytes: true }
  })
  const sum = aggregate._sum.sizeBytes
  return sum ? Number(sum) : 0
}

export const listRecentEntriesForUser = async (
  user: AuthenticatedRequestUser,
  siteId: string,
  limit: number = 10
) => {
  await ensureSiteExists(siteId)
  if (!(await canAccessSite(user, siteId))) {
    throw new HttpError({
      message: 'You do not have access to this site',
      statusCode: 403,
      code: 'SITE_ACCESS_DENIED'
    })
  }

  const entries = await prisma.contentEntry.findMany({
    where: { siteId },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 50),
    select: {
      id: true,
      slug: true,
      status: true,
      updatedAt: true,
      publishedAt: true,
      contentType: {
        select: { id: true, name: true, apiId: true }
      },
      updatedBy: {
        select: { id: true, name: true, email: true }
      }
    }
  })

  return {
    entries: entries.map((e) => ({
      id: e.id,
      slug: e.slug,
      status: e.status,
      updatedAt: e.updatedAt,
      publishedAt: e.publishedAt,
      contentType: e.contentType,
      updatedBy: e.updatedBy
    }))
  }
}

const resolveSiteSlug = ({
  name,
  slug
}: {
  name: string
  slug?: string
}) => {
  const normalizedSlug = normalizeSiteSlug(slug ?? name)

  if (!normalizedSlug) {
    throw new HttpError({
      message: 'Slug is invalid after normalization',
      statusCode: 400,
      code: 'INVALID_SITE_SLUG'
    })
  }

  return normalizedSlug
}

const ensureSiteSlugIsAvailable = async ({
  slug,
  excludeSiteId
}: {
  slug: string
  excludeSiteId?: string
}) => {
  const existingSite = await prisma.site.findFirst({
    where: {
      slug,
      ...(excludeSiteId
        ? {
            id: {
              not: excludeSiteId
            }
          }
        : {})
    },
    select: {
      id: true
    }
  })

  if (existingSite) {
    throw getSlugConflictError()
  }
}

const ensureSiteExists = async (siteId: string) => {
  const site = await prisma.site.findUnique({
    where: {
      id: siteId
    },
    select: {
      id: true
    }
  })

  if (!site) {
    throw new HttpError({
      message: 'Site not found',
      statusCode: 404,
      code: 'SITE_NOT_FOUND'
    })
  }
}

const getSiteDetailRecord = async (siteId: string, userId: string) => {
  const site = await prisma.site.findUnique({
    where: {
      id: siteId
    },
    select: getSiteDetailSelect(userId)
  })

  if (!site) {
    throw new HttpError({
      message: 'Site not found',
      statusCode: 404,
      code: 'SITE_NOT_FOUND'
    })
  }

  return site
}

export const listSitesForUser = async (
  user: AuthenticatedRequestUser,
  query: ListSitesQuery
) => {
  const filters: Prisma.SiteWhereInput[] = []

  if (!query.includeArchived) {
    filters.push({
      status: {
        not: SiteStatus.ARCHIVED
      }
    })
  }

  if (query.search) {
    filters.push({
      OR: [
        {
          name: {
            contains: query.search,
            mode: 'insensitive'
          }
        },
        {
          slug: {
            contains: query.search,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: query.search,
            mode: 'insensitive'
          }
        }
      ]
    })
  }

  if (!user.isSuperAdmin) {
    filters.push({
      members: {
        some: {
          userId: user.id
        }
      }
    })
  }

  const where: Prisma.SiteWhereInput =
    filters.length > 0
      ? {
          AND: filters
        }
      : {}

  const sites = await prisma.site.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: siteSummarySelect
  })

  return {
    sites: sites.map(serializeSiteSummary)
  }
}

// Per-tier cap on the number of sites a user can OWN. Super admin bypasses
// the cap entirely. PRO is currently uncapped — change to a finite number
// here if you want a higher-but-still-capped Pro tier.
const FREE_TIER_OWNED_SITE_LIMIT = 1

const enforceTierSiteLimit = async (user: AuthenticatedRequestUser) => {
  if (user.isSuperAdmin || user.tier === 'PRO') return

  const ownedCount = await prisma.siteMember.count({
    where: {
      userId: user.id,
      role: SiteRole.OWNER,
      site: { status: { not: SiteStatus.ARCHIVED } }
    }
  })

  if (ownedCount >= FREE_TIER_OWNED_SITE_LIMIT) {
    throw new HttpError({
      message: `Free tier is limited to ${FREE_TIER_OWNED_SITE_LIMIT} site. Upgrade to Pro for more.`,
      statusCode: 403,
      code: 'TIER_SITE_LIMIT_REACHED'
    })
  }
}

export const createSiteForUser = async (
  user: AuthenticatedRequestUser,
  input: CreateSiteInput
) => {
  await enforceTierSiteLimit(user)

  const name = input.name.trim()
  const slug = resolveSiteSlug({
    name,
    slug: input.slug
  })

  await ensureSiteSlugIsAvailable({
    slug
  })

  try {
    const site = await prisma.site.create({
      data: {
        name,
        slug,
        description: input.description ?? null,
        createdById: user.id,
        members: {
          create: {
            userId: user.id,
            role: SiteRole.OWNER
          }
        }
      },
      select: getSiteDetailSelect(user.id)
    })

    return {
      site: serializeSiteDetail(site)
    }
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw getSlugConflictError()
    }

    throw error
  }
}

export const getSiteByIdForUser = async (
  user: AuthenticatedRequestUser,
  siteId: string
) => {
  await ensureSiteExists(siteId)

  const hasAccess = await canAccessSite(user, siteId)

  if (!hasAccess) {
    throw new HttpError({
      message: 'You do not have access to this site',
      statusCode: 403,
      code: 'SITE_ACCESS_DENIED'
    })
  }

  const [site, totalMediaBytes] = await Promise.all([
    getSiteDetailRecord(siteId, user.id),
    getSiteTotalMediaBytes(siteId)
  ])

  return {
    site: serializeSiteDetail(site, totalMediaBytes)
  }
}

export const updateSiteForUser = async (
  user: AuthenticatedRequestUser,
  siteId: string,
  input: UpdateSiteInput
) => {
  await ensureSiteExists(siteId)

  if (!user.isSuperAdmin && !(await canManageSite(user, siteId))) {
    throw new HttpError({
      message: 'Only site owners, admins, and super admins can update site settings',
      statusCode: 403,
      code: 'SITE_MANAGE_DENIED'
    })
  }

  const currentSite = await prisma.site.findUnique({
    where: {
      id: siteId
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true
    }
  })

  if (!currentSite) {
    throw new HttpError({
      message: 'Site not found',
      statusCode: 404,
      code: 'SITE_NOT_FOUND'
    })
  }

  const data: Prisma.SiteUpdateInput = {}

  if (input.name !== undefined) {
    data.name = input.name.trim()
  }

  if (input.slug !== undefined) {
    const slug = resolveSiteSlug({
      name: input.name?.trim() ?? currentSite.name,
      slug: input.slug
    })

    if (slug !== currentSite.slug) {
      await ensureSiteSlugIsAvailable({
        slug,
        excludeSiteId: siteId
      })
    }

    data.slug = slug
  }

  if (input.description !== undefined) {
    data.description = input.description
  }

  if (input.status !== undefined) {
    data.status = input.status
  }

  try {
    const site =
      Object.keys(data).length === 0
        ? await getSiteDetailRecord(siteId, user.id)
        : await prisma.site.update({
            where: {
              id: siteId
            },
            data,
            select: getSiteDetailSelect(user.id)
          })

    return {
      site: serializeSiteDetail(site)
    }
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw getSlugConflictError()
    }

    throw error
  }
}

export const archiveSiteForUser = async (
  user: AuthenticatedRequestUser,
  siteId: string
) => {
  await ensureSiteExists(siteId)

  // OWNER only (in addition to super admin). Admins cannot archive — that's
  // intentionally an OWNER-only lifecycle action.
  if (!user.isSuperAdmin) {
    const role = await getSiteRoleForUser(user, siteId)
    if (role !== SiteRole.OWNER) {
      throw new HttpError({
        message: 'Only site owners and super admins can archive a site',
        statusCode: 403,
        code: 'SITE_ARCHIVE_DENIED'
      })
    }
  }

  await prisma.site.update({
    where: {
      id: siteId
    },
    data: {
      status: SiteStatus.ARCHIVED
    }
  })

  return {
    ok: true
  }
}
