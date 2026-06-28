import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../../generated/prisma/client'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is missing. Set it in apps/api/.env before starting the API.'
  )
}

const globalForPrisma = globalThis as typeof globalThis & {
  __narahPrisma?: PrismaClient
}

const createPrismaClient = () => {
  const pool = new Pool({
    connectionString: databaseUrl
  })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.__narahPrisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__narahPrisma = prisma
}
