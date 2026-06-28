/**
 * Reset script — wipes every site + all dependent data so you can test the
 * full flow from a clean slate. The super admin user is preserved.
 *
 * What gets wiped:
 *   - All sites (and their content types, fields, entries, media assets,
 *     api keys, members, invitations — cascaded by FK)
 *   - All audit logs
 *   - All non-super-admin users + their policy acceptances
 *
 * What's preserved:
 *   - Super admin user account (admin@narah.local, or SEED_SUPER_ADMIN_EMAIL)
 *   - Active policy documents
 *   - The super admin's policy acceptances
 *
 * Storage files (under apps/api/storage/) are NOT touched — delete them
 * manually if you want a truly clean reset.
 *
 * Run with:
 *   bun run db:seed:reset
 */

import { createSeedClient } from './seed-utils'

const { prisma, pool } = createSeedClient()

async function main() {
  const superAdminEmail =
    process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@narah.local'

  const superAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail },
    select: { id: true, isSuperAdmin: true }
  })

  if (!superAdmin) {
    throw new Error(
      `Super admin "${superAdminEmail}" not found. Run db:seed first to provision the base account.`
    )
  }
  if (!superAdmin.isSuperAdmin) {
    throw new Error(
      `User "${superAdminEmail}" exists but isSuperAdmin is false. Refusing to run reset.`
    )
  }

  // Snapshot what we're about to nuke so the log is useful.
  const [
    siteCount,
    nonSuperAdminCount,
    auditCount,
    mediaCount,
    apiKeyCount
  ] = await Promise.all([
    prisma.site.count(),
    prisma.user.count({ where: { id: { not: superAdmin.id } } }),
    prisma.auditLog.count(),
    prisma.mediaAsset.count(),
    prisma.apiKey.count()
  ])

  console.log('About to wipe:')
  console.log(`  - ${siteCount} site(s) (cascades to types, fields, entries, members, invitations)`)
  console.log(`  - ${apiKeyCount} api key(s)`)
  console.log(`  - ${mediaCount} media asset record(s)`)
  console.log(`  - ${auditCount} audit log entry/entries`)
  console.log(`  - ${nonSuperAdminCount} non-super-admin user(s)`)
  console.log('')

  // Order matters even with cascades — audit logs reference users, so wipe
  // them first. Then sites (cascade hits content types / fields / entries /
  // media / members / invitations / api keys). Finally users that aren't
  // the super admin (their policy acceptances cascade with the user).
  await prisma.$transaction([
    prisma.auditLog.deleteMany({}),
    prisma.site.deleteMany({}),
    prisma.policyAcceptance.deleteMany({
      where: { userId: { not: superAdmin.id } }
    }),
    prisma.user.deleteMany({
      where: { id: { not: superAdmin.id } }
    })
  ])

  console.log('✓ Wipe complete.')
  console.log(`  Super admin preserved: ${superAdminEmail}`)
  console.log('')
  console.log('Storage files (apps/api/storage/) were not touched.')
  console.log('Remove that folder manually if you want a fully fresh disk too.')
}

main()
  .catch((error) => {
    console.error('Reset failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
