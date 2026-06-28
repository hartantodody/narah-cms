/**
 * Bun loads this BEFORE any test module. We use it to point the API at a
 * dedicated test database and silence rate limiters / logger during tests.
 *
 * Set TEST_DATABASE_URL in your shell or apps/api/.env.test before
 * running `bun test`. See test/README.md for one-time setup.
 */
import 'dotenv/config'

const testDbUrl = process.env.TEST_DATABASE_URL
if (!testDbUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required to run integration tests. ' +
      'Point it at a throwaway Postgres database — tests TRUNCATE all tables on every run.'
  )
}

process.env.DATABASE_URL = testDbUrl
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent'
// Stable secrets so token signing is deterministic across runs.
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test_jwt_secret_change_me_in_real_envs'
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ?? 'test_encryption_key_min_32_chars_padding'
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*'
