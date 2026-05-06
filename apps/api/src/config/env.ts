import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.union([z.literal('*'), z.string().url()]).default(
    'http://localhost:5173'
  )
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
