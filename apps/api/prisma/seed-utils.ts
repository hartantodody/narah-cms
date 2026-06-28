import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import {
  PolicyDocumentType,
  PrismaClient,
  UserStatus
} from '../generated/prisma/client'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is missing. Set it in apps/api/.env before running Prisma seed.'
  )
}

export const defaultPolicies = [
  {
    type: PolicyDocumentType.PRIVACY_POLICY,
    version: '1.0.0',
    title: 'Privacy Policy',
    content:
      'This is the initial Privacy Policy placeholder for Narah CMS. Replace this with your approved legal content before production use.'
  },
  {
    type: PolicyDocumentType.USER_AGREEMENT,
    version: '1.0.0',
    title: 'User Agreement',
    content:
      'This is the initial User Agreement placeholder for Narah CMS. Replace this with your approved legal content before production use.'
  }
] as const

export function createSeedClient() {
  const pool = new Pool({
    connectionString: databaseUrl
  })

  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  return { prisma, pool }
}

export async function hashSeedPassword(password: string) {
  return Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: 10
  })
}

export async function upsertSeedUser({
  prisma,
  email,
  name,
  passwordHash,
  isSuperAdmin = false
}: {
  prisma: PrismaClient
  email: string
  name: string
  passwordHash: string
  isSuperAdmin?: boolean
}) {
  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      status: UserStatus.ACTIVE,
      isSuperAdmin
    },
    create: {
      email,
      name,
      passwordHash,
      status: UserStatus.ACTIVE,
      isSuperAdmin
    }
  })
}

export async function ensureDefaultPolicies(prisma: PrismaClient) {
  const publishedAt = new Date()

  for (const policy of defaultPolicies) {
    await prisma.policyDocument.upsert({
      where: {
        type_version: {
          type: policy.type,
          version: policy.version
        }
      },
      update: {
        title: policy.title,
        content: policy.content,
        isActive: true,
        publishedAt
      },
      create: {
        type: policy.type,
        version: policy.version,
        title: policy.title,
        content: policy.content,
        isActive: true,
        publishedAt
      }
    })
  }

  return prisma.policyDocument.findMany({
    where: {
      isActive: true
    },
    select: {
      id: true,
      type: true,
      version: true
    }
  })
}

export async function acceptPoliciesForUser({
  prisma,
  userId,
  policyDocumentIds,
  userAgent = 'seed-script',
  ipAddress = 'local-seed'
}: {
  prisma: PrismaClient
  userId: string
  policyDocumentIds?: string[]
  userAgent?: string | null
  ipAddress?: string | null
}) {
  const resolvedPolicyDocumentIds =
    policyDocumentIds ??
    (
      await prisma.policyDocument.findMany({
        where: {
          isActive: true
        },
        select: {
          id: true
        }
      })
    ).map((policy) => policy.id)

  if (resolvedPolicyDocumentIds.length === 0) {
    return 0
  }

  const acceptedAt = new Date()

  const result = await prisma.policyAcceptance.createMany({
    data: resolvedPolicyDocumentIds.map((policyDocumentId) => ({
      userId,
      policyDocumentId,
      acceptedAt,
      userAgent,
      ipAddress
    })),
    skipDuplicates: true
  })

  return result.count
}
