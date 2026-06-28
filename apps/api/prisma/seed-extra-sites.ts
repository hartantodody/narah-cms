/**
 * Tiny seed that drops 3 additional sites onto an existing Narah CMS
 * database so the /admin/sites masonry can be stress-tested with varied
 * card heights (short name + short description vs long name + long
 * description).
 *
 * Run with:
 *   bun run db:seed:extra-sites
 *
 * Idempotent: re-running upserts by slug — no duplicate sites are created.
 * Requires a super admin user to already exist (defaults to admin@narah.local
 * or whatever `SEED_SUPER_ADMIN_EMAIL` was used).
 */

import { SiteRole, SiteStatus } from '../generated/prisma/client'
import { createSeedClient } from './seed-utils'

const { prisma, pool } = createSeedClient()

type DummySite = {
  name: string
  slug: string
  description: string | null
}

const dummySites: DummySite[] = [
  {
    // Short name + short description → small card.
    name: 'Aurora',
    slug: 'aurora',
    description: 'Lightweight client portal.'
  },
  {
    // Medium name + medium description.
    name: 'Kaleka Studio',
    slug: 'kaleka-studio',
    description:
      'Design studio site with portfolio, case studies, and a small editorial blog.'
  },
  {
    // Long name + long multi-sentence description → tall card. Exercises the
    // masonry: this card should push only its column-mates, not the whole row.
    name: 'Nusantara Heritage Archive',
    slug: 'nusantara-heritage-archive',
    description:
      "A long-form workspace for an Indonesian heritage non-profit. Manages multilingual articles, oral history transcripts, photo galleries, and a public events calendar. The intentionally lengthy description here exists so the resulting card sits taller than its siblings — handy for verifying that the masonry layout distributes weight correctly without pushing every other card down."
  }
]

async function findSuperAdmin() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@narah.local'
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true }
  })
  if (!user) {
    throw new Error(
      `Super admin user "${email}" not found. Run db:seed first to provision the base account.`
    )
  }
  return user
}

async function ensureOwnership(siteId: string, userId: string) {
  await prisma.siteMember.upsert({
    where: {
      siteId_userId: { siteId, userId }
    },
    update: { role: SiteRole.OWNER },
    create: { siteId, userId, role: SiteRole.OWNER }
  })
}

async function main() {
  const superAdmin = await findSuperAdmin()

  for (const site of dummySites) {
    const record = await prisma.site.upsert({
      where: { slug: site.slug },
      update: {
        name: site.name,
        description: site.description,
        status: SiteStatus.ACTIVE
      },
      create: {
        name: site.name,
        slug: site.slug,
        description: site.description,
        status: SiteStatus.ACTIVE,
        createdById: superAdmin.id
      },
      select: { id: true, slug: true, name: true }
    })

    await ensureOwnership(record.id, superAdmin.id)
    console.log(`✓ ${record.slug.padEnd(28)} — ${record.name}`)
  }

  console.log(`\nSeeded ${dummySites.length} extra site${dummySites.length === 1 ? '' : 's'} owned by ${superAdmin.email}.`)
}

main()
  .catch((error) => {
    console.error('Extra-sites seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
