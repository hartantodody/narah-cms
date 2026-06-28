import {
  acceptPoliciesForUser,
  createSeedClient,
  defaultPolicies,
  ensureDefaultPolicies,
  hashSeedPassword,
  upsertSeedUser
} from './seed-utils'

const { prisma, pool } = createSeedClient()

async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@narah.local'
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'Admin12345!'
  const passwordHash = await hashSeedPassword(password)

  const superAdmin = await upsertSeedUser({
    prisma,
    email,
    name: 'Super Admin',
    passwordHash,
    isSuperAdmin: true
  })

  const activePolicies = await ensureDefaultPolicies(prisma)
  const acceptedCount = await acceptPoliciesForUser({
    prisma,
    userId: superAdmin.id,
    policyDocumentIds: activePolicies.map((policy) => policy.id),
    userAgent: 'seed-script',
    ipAddress: 'local-seed'
  })

  console.log(`Seeded super admin: ${superAdmin.email}`)
  console.log(
    `Seeded policy documents: ${defaultPolicies
      .map((policy) => `${policy.type}@${policy.version}`)
      .join(', ')}`
  )
  console.log(
    `Auto-accepted ${activePolicies.length} active policies for seeded super admin (${acceptedCount} newly created acceptances).`
  )
}

main()
  .catch((error) => {
    console.error('Prisma seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
