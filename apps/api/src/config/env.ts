import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  // Comma-separated origins for the admin CORS allowlist. Use '*' for any.
  TRUST_PROXY: z.coerce.boolean().default(false),
  CORS_ORIGIN: z.union([z.literal('*'), z.string().url()]).default(
    'http://localhost:5173'
  ),
  JWT_ACCESS_SECRET: z.string().min(1).default('dev_access_secret_change_me'),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('1d'),

  // ── Encryption (at-rest secrets like GA service account JSON) ───────────
  ENCRYPTION_KEY: z
    .string()
    .min(16, 'ENCRYPTION_KEY must be at least 16 chars')
    .default('dev_encryption_key_change_me_please_32+'),

  // ── Storage ─────────────────────────────────────────────
  // 'local' = filesystem; 's3' = any S3-compatible (Backblaze B2 / R2 /
  // MinIO / AWS S3 / DO Spaces). The legacy 'r2' alias is kept for
  // backwards compatibility — equivalent to 's3' with the R2 endpoint.
  STORAGE_DRIVER: z.enum(['local', 's3', 'r2']).default('local'),
  // Local driver
  STORAGE_LOCAL_DIR: z.string().min(1).default('storage'),
  // Base URL that the local driver serves files from (without trailing slash)
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
  // Generic S3-compatible driver (B2, R2, MinIO, AWS S3, …)
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  // Cloudflare R2 driver (legacy — STORAGE_DRIVER=r2)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
  // Upload limits
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(10),

  // Image transform cache directory (filesystem). Relative to cwd if not absolute.
  IMAGE_CACHE_DIR: z.string().min(1).default('.cache/images'),
  // Public base URL for the API (used to build asset.url). Falls back to
  // http://localhost:${PORT} in dev.
  API_PUBLIC_BASE_URL: z.string().url().optional()
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error(
    'Invalid environment variables:',
    parsedEnv.error.flatten().fieldErrors
  )

  throw new Error('Invalid environment configuration')
}

export const env = parsedEnv.data
export type Env = z.infer<typeof envSchema>
