import {
  ContentEntryStatus,
  ContentFieldType,
  Prisma,
  SiteRole,
  SiteStatus,
  type PrismaClient
} from '../generated/prisma/client'
import {
  acceptPoliciesForUser,
  createSeedClient,
  ensureDefaultPolicies,
  hashSeedPassword,
  upsertSeedUser
} from './seed-utils'

const { prisma, pool } = createSeedClient()

type FieldDefinition = {
  label: string
  apiId: string
  type: ContentFieldType
  description?: string | null
  required?: boolean
  localized?: boolean
  isList?: boolean
  sortOrder: number
  config?: Prisma.InputJsonValue | null
  validation?: Prisma.InputJsonValue | null
  defaultValue?: Prisma.InputJsonValue | null
}

type ContentTypeDefinition = {
  name: string
  apiId: string
  description: string
  isSingleton: boolean
  fields: FieldDefinition[]
}

async function ensureSiteMember({
  prisma,
  siteId,
  userId,
  role
}: {
  prisma: PrismaClient
  siteId: string
  userId: string
  role: SiteRole
}) {
  return prisma.siteMember.upsert({
    where: {
      siteId_userId: {
        siteId,
        userId
      }
    },
    update: {
      role
    },
    create: {
      siteId,
      userId,
      role
    }
  })
}

async function ensureContentType({
  prisma,
  siteId,
  createdById,
  definition
}: {
  prisma: PrismaClient
  siteId: string
  createdById: string
  definition: ContentTypeDefinition
}) {
  return prisma.contentType.upsert({
    where: {
      siteId_apiId: {
        siteId,
        apiId: definition.apiId
      }
    },
    update: {
      name: definition.name,
      description: definition.description,
      isSingleton: definition.isSingleton
    },
    create: {
      siteId,
      name: definition.name,
      apiId: definition.apiId,
      description: definition.description,
      isSingleton: definition.isSingleton,
      createdById
    }
  })
}

async function ensureContentField({
  prisma,
  contentTypeId,
  definition
}: {
  prisma: PrismaClient
  contentTypeId: string
  definition: FieldDefinition
}) {
  return prisma.contentField.upsert({
    where: {
      contentTypeId_apiId: {
        contentTypeId,
        apiId: definition.apiId
      }
    },
    update: {
      label: definition.label,
      type: definition.type,
      description: definition.description ?? null,
      required: definition.required ?? false,
      localized: definition.localized ?? false,
      isList: definition.isList ?? false,
      sortOrder: definition.sortOrder,
      config: definition.config ?? Prisma.JsonNull,
      validation: definition.validation ?? Prisma.JsonNull,
      defaultValue: definition.defaultValue ?? Prisma.JsonNull
    },
    create: {
      contentTypeId,
      label: definition.label,
      apiId: definition.apiId,
      type: definition.type,
      description: definition.description ?? null,
      required: definition.required ?? false,
      localized: definition.localized ?? false,
      isList: definition.isList ?? false,
      sortOrder: definition.sortOrder,
      config: definition.config ?? Prisma.JsonNull,
      validation: definition.validation ?? Prisma.JsonNull,
      defaultValue: definition.defaultValue ?? Prisma.JsonNull
    }
  })
}

async function ensureContentEntry({
  prisma,
  siteId,
  contentTypeId,
  slug,
  status,
  data,
  createdById,
  updatedById
}: {
  prisma: PrismaClient
  siteId: string
  contentTypeId: string
  slug: string
  status: ContentEntryStatus
  data: Prisma.InputJsonValue
  createdById: string
  updatedById: string
}) {
  const existingEntry = await prisma.contentEntry.findFirst({
    where: {
      contentTypeId,
      slug
    },
    select: {
      id: true
    }
  })

  const publishedAt = status === ContentEntryStatus.PUBLISHED ? new Date() : null

  if (existingEntry) {
    return prisma.contentEntry.update({
      where: {
        id: existingEntry.id
      },
      data: {
        status,
        data,
        updatedById,
        publishedAt
      }
    })
  }

  return prisma.contentEntry.create({
    data: {
      siteId,
      contentTypeId,
      slug,
      status,
      data,
      version: 1,
      createdById,
      updatedById,
      publishedAt
    }
  })
}

const demoContentTypes: ContentTypeDefinition[] = [
  {
    name: 'Page',
    apiId: 'page',
    description: 'Static website pages.',
    isSingleton: false,
    fields: [
      {
        label: 'Title',
        apiId: 'title',
        type: ContentFieldType.TEXT,
        required: true,
        sortOrder: 0
      },
      {
        label: 'Slug',
        apiId: 'slug',
        type: ContentFieldType.TEXT,
        required: true,
        sortOrder: 1
      },
      {
        label: 'Body',
        apiId: 'body',
        type: ContentFieldType.RICH_TEXT,
        sortOrder: 2
      },
      {
        label: 'Cover Image',
        apiId: 'cover_image',
        type: ContentFieldType.MEDIA,
        sortOrder: 3
      },
      {
        label: 'SEO Title',
        apiId: 'seo_title',
        type: ContentFieldType.TEXT,
        sortOrder: 4
      }
    ]
  },
  {
    name: 'Blog Post',
    apiId: 'blog_post',
    description: 'Articles and updates.',
    isSingleton: false,
    fields: [
      {
        label: 'Title',
        apiId: 'title',
        type: ContentFieldType.TEXT,
        required: true,
        sortOrder: 0
      },
      {
        label: 'Slug',
        apiId: 'slug',
        type: ContentFieldType.TEXT,
        required: true,
        sortOrder: 1
      },
      {
        label: 'Excerpt',
        apiId: 'excerpt',
        type: ContentFieldType.TEXT,
        sortOrder: 2
      },
      {
        label: 'Content',
        apiId: 'content',
        type: ContentFieldType.RICH_TEXT,
        sortOrder: 3
      },
      {
        label: 'Category',
        apiId: 'category',
        type: ContentFieldType.SELECT,
        sortOrder: 4,
        config: {
          options: [
            { label: 'News', value: 'news' },
            { label: 'Guide', value: 'guide' },
            { label: 'Release Note', value: 'release_note' }
          ]
        }
      },
      {
        label: 'Published Date',
        apiId: 'published_date',
        type: ContentFieldType.DATE,
        sortOrder: 5
      },
      {
        label: 'Featured',
        apiId: 'featured',
        type: ContentFieldType.BOOLEAN,
        sortOrder: 6
      }
    ]
  },
  {
    name: 'Site Settings',
    apiId: 'site_settings',
    description: 'Global website settings.',
    isSingleton: true,
    fields: [
      {
        label: 'Site Name',
        apiId: 'site_name',
        type: ContentFieldType.TEXT,
        required: true,
        sortOrder: 0
      },
      {
        label: 'Description',
        apiId: 'description',
        type: ContentFieldType.TEXT,
        sortOrder: 1
      },
      {
        label: 'Logo',
        apiId: 'logo',
        type: ContentFieldType.MEDIA,
        sortOrder: 2
      },
      {
        label: 'Social Links',
        apiId: 'social_links',
        type: ContentFieldType.JSON,
        sortOrder: 3
      }
    ]
  }
]

async function main() {
  const superAdminEmail =
    process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@narah.local'
  const superAdminPassword =
    process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'Admin12345!'
  const superAdminPasswordHash = await hashSeedPassword(superAdminPassword)
  const demoPassword = 'Demo12345!'
  const demoPasswordHash = await hashSeedPassword(demoPassword)

  const superAdmin = await upsertSeedUser({
    prisma,
    email: superAdminEmail,
    name: 'Super Admin',
    passwordHash: superAdminPasswordHash,
    isSuperAdmin: true
  })

  const activePolicies = await ensureDefaultPolicies(prisma)
  const activePolicyIds = activePolicies.map((policy) => policy.id)

  await acceptPoliciesForUser({
    prisma,
    userId: superAdmin.id,
    policyDocumentIds: activePolicyIds,
    userAgent: 'seed-demo-script',
    ipAddress: 'local-seed'
  })

  const demoUsers = await Promise.all([
    upsertSeedUser({
      prisma,
      email: 'demo.admin@narah.local',
      name: 'Demo Admin',
      passwordHash: demoPasswordHash
    }),
    upsertSeedUser({
      prisma,
      email: 'demo.editor@narah.local',
      name: 'Demo Editor',
      passwordHash: demoPasswordHash
    }),
    upsertSeedUser({
      prisma,
      email: 'demo.viewer@narah.local',
      name: 'Demo Viewer',
      passwordHash: demoPasswordHash
    })
  ])

  await Promise.all(
    [superAdmin, ...demoUsers].map((user) =>
      acceptPoliciesForUser({
        prisma,
        userId: user.id,
        policyDocumentIds: activePolicyIds,
        userAgent: 'seed-demo-script',
        ipAddress: 'local-seed'
      })
    )
  )

  const demoSite = await prisma.site.upsert({
    where: {
      slug: 'narah-demo'
    },
    update: {
      name: 'Narah Demo Site',
      description: 'Demo workspace for testing Narah CMS content modeling.',
      status: SiteStatus.ACTIVE,
      createdById: superAdmin.id
    },
    create: {
      name: 'Narah Demo Site',
      slug: 'narah-demo',
      description: 'Demo workspace for testing Narah CMS content modeling.',
      status: SiteStatus.ACTIVE,
      createdById: superAdmin.id
    }
  })

  const [demoAdmin, demoEditor, demoViewer] = demoUsers

  await Promise.all([
    ensureSiteMember({
      prisma,
      siteId: demoSite.id,
      userId: superAdmin.id,
      role: SiteRole.OWNER
    }),
    ensureSiteMember({
      prisma,
      siteId: demoSite.id,
      userId: demoAdmin.id,
      role: SiteRole.ADMIN
    }),
    ensureSiteMember({
      prisma,
      siteId: demoSite.id,
      userId: demoEditor.id,
      role: SiteRole.EDITOR
    }),
    ensureSiteMember({
      prisma,
      siteId: demoSite.id,
      userId: demoViewer.id,
      role: SiteRole.VIEWER
    })
  ])

  const [pageType, blogPostType, siteSettingsType] = await Promise.all(
    demoContentTypes.map((definition) =>
      ensureContentType({
        prisma,
        siteId: demoSite.id,
        createdById: superAdmin.id,
        definition
      })
    )
  )

  await Promise.all(
    demoContentTypes.flatMap((definition) => {
      const contentTypeId =
        definition.apiId === 'page'
          ? pageType.id
          : definition.apiId === 'blog_post'
            ? blogPostType.id
            : siteSettingsType.id

      return definition.fields.map((fieldDefinition) =>
        ensureContentField({
          prisma,
          contentTypeId,
          definition: fieldDefinition
        })
      )
    })
  )

  await Promise.all([
    ensureContentEntry({
      prisma,
      siteId: demoSite.id,
      contentTypeId: pageType.id,
      slug: 'home',
      status: ContentEntryStatus.PUBLISHED,
      data: {
        title: 'Welcome to Narah Demo',
        slug: 'home',
        body: 'This is a sample page entry generated for local testing.',
        seo_title: 'Narah Demo Home'
      },
      createdById: superAdmin.id,
      updatedById: superAdmin.id
    }),
    ensureContentEntry({
      prisma,
      siteId: demoSite.id,
      contentTypeId: blogPostType.id,
      slug: 'getting-started-with-narah',
      status: ContentEntryStatus.PUBLISHED,
      data: {
        title: 'Getting Started with Narah CMS',
        slug: 'getting-started-with-narah',
        excerpt: 'A sample article for testing schema-driven content.',
        content:
          'Narah CMS lets you model content types and manage entries from a clean admin interface.',
        category: 'guide',
        published_date: '2026-01-01',
        featured: true
      },
      createdById: superAdmin.id,
      updatedById: superAdmin.id
    }),
    ensureContentEntry({
      prisma,
      siteId: demoSite.id,
      contentTypeId: siteSettingsType.id,
      slug: 'site-settings',
      status: ContentEntryStatus.PUBLISHED,
      data: {
        site_name: 'Narah Demo',
        description: 'A demo site powered by Narah CMS.',
        social_links: {
          website: 'https://example.com',
          github: 'https://github.com/example'
        }
      },
      createdById: superAdmin.id,
      updatedById: superAdmin.id
    })
  ])

  console.log('Demo data seeded.')
  console.log(`Super Admin: ${superAdminEmail} / ${superAdminPassword}`)
  console.log('Demo Admin: demo.admin@narah.local / Demo12345!')
  console.log('Demo Editor: demo.editor@narah.local / Demo12345!')
  console.log('Demo Viewer: demo.viewer@narah.local / Demo12345!')
  console.log('Demo Site: narah-demo')
}

main()
  .catch((error) => {
    console.error('Prisma demo seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
