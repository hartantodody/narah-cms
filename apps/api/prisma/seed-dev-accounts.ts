/**
 * Dev convenience accounts for testing role flows manually:
 *
 *   - Freelancer (intended to be made OWNER of any site you create for them)
 *     email:    freelancer@narah.local
 *     password: Freelancer12345!
 *
 *   - Editor (intended to be invited as EDITOR on a site)
 *     email:    editor@narah.local
 *     password: Editor12345!
 *
 * These users start with zero memberships — they only become Owner/Editor
 * once the super admin invites them (or assigns them) to a specific site.
 *
 * Idempotent: re-running upserts by email, no duplicate accounts. Policy
 * acceptance is recorded so they skip the consent gate on first login.
 *
 * Run with:
 *   bun run db:seed:dev-accounts
 */

import {
  acceptPoliciesForUser,
  createSeedClient,
  ensureDefaultPolicies,
  hashSeedPassword,
  upsertSeedUser
} from './seed-utils'

const { prisma, pool } = createSeedClient()

type DevAccount = {
  email: string
  name: string
  password: string
}

const devAccounts: DevAccount[] = [
  {
    email: 'freelancer@narah.local',
    name: 'Freelancer Owner',
    password: 'Freelancer12345!'
  },
  {
    email: 'editor@narah.local',
    name: 'Editor Demo',
    password: 'Editor12345!'
  }
]

async function main() {
  const policies = await ensureDefaultPolicies(prisma)
  const policyIds = policies.map((p) => p.id)

  for (const account of devAccounts) {
    const passwordHash = await hashSeedPassword(account.password)

    const user = await upsertSeedUser({
      prisma,
      email: account.email,
      name: account.name,
      passwordHash
    })

    await acceptPoliciesForUser({
      prisma,
      userId: user.id,
      policyDocumentIds: policyIds,
      userAgent: 'seed-dev-accounts-script',
      ipAddress: 'local-seed'
    })

    console.log(`✓ ${account.email.padEnd(28)} / ${account.password}`)
  }

  console.log('')
  console.log(`Seeded ${devAccounts.length} dev accounts.`)
  console.log('Both have ACTIVE status and accepted required policies — no consent gate on first login.')
  console.log('Membership: zero. Invite them from /admin/sites once a site is created.')
}

main()
  .catch((error) => {
    console.error('Dev accounts seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
