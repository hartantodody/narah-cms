import path from 'node:path'
import { env } from '../../config/env'
import { LocalStorageAdapter } from './local-adapter'
import { S3StorageAdapter } from './s3-adapter'
import type { StorageAdapter } from './storage.types'

let cachedAdapter: StorageAdapter | null = null

const buildLocalAdapter = (): StorageAdapter => {
  const rootDir = path.isAbsolute(env.STORAGE_LOCAL_DIR)
    ? env.STORAGE_LOCAL_DIR
    : path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR)
  const publicBaseUrl =
    env.STORAGE_PUBLIC_BASE_URL ?? `http://localhost:${env.PORT}/storage`
  return new LocalStorageAdapter(rootDir, publicBaseUrl)
}

const buildS3Adapter = (): StorageAdapter => {
  const missing = [
    !env.S3_ENDPOINT && 'S3_ENDPOINT',
    !env.S3_ACCESS_KEY_ID && 'S3_ACCESS_KEY_ID',
    !env.S3_SECRET_ACCESS_KEY && 'S3_SECRET_ACCESS_KEY',
    !env.S3_BUCKET && 'S3_BUCKET',
    !env.S3_PUBLIC_BASE_URL && 'S3_PUBLIC_BASE_URL'
  ].filter(Boolean) as string[]
  if (missing.length > 0) {
    throw new Error(
      `STORAGE_DRIVER=s3 but missing env vars: ${missing.join(', ')}`
    )
  }
  return new S3StorageAdapter({
    endpoint: env.S3_ENDPOINT!,
    region: env.S3_REGION ?? 'auto',
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    bucket: env.S3_BUCKET!,
    publicBaseUrl: env.S3_PUBLIC_BASE_URL!,
    forcePathStyle: env.S3_FORCE_PATH_STYLE
  })
}

const buildR2Adapter = (): StorageAdapter => {
  const missing = [
    !env.R2_ACCOUNT_ID && 'R2_ACCOUNT_ID',
    !env.R2_ACCESS_KEY_ID && 'R2_ACCESS_KEY_ID',
    !env.R2_SECRET_ACCESS_KEY && 'R2_SECRET_ACCESS_KEY',
    !env.R2_BUCKET && 'R2_BUCKET',
    !env.R2_PUBLIC_BASE_URL && 'R2_PUBLIC_BASE_URL'
  ].filter(Boolean) as string[]
  if (missing.length > 0) {
    throw new Error(
      `STORAGE_DRIVER=r2 but missing env vars: ${missing.join(', ')}`
    )
  }
  return new S3StorageAdapter({
    endpoint: `https://${env.R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
    region: 'auto',
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    bucket: env.R2_BUCKET!,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL!
  })
}

export const getStorageAdapter = (): StorageAdapter => {
  if (cachedAdapter) return cachedAdapter
  switch (env.STORAGE_DRIVER) {
    case 's3':
      cachedAdapter = buildS3Adapter()
      break
    case 'r2':
      cachedAdapter = buildR2Adapter()
      break
    default:
      cachedAdapter = buildLocalAdapter()
  }
  return cachedAdapter
}

export const getLocalStorageRoot = (): string | null => {
  if (env.STORAGE_DRIVER !== 'local') return null
  return path.isAbsolute(env.STORAGE_LOCAL_DIR)
    ? env.STORAGE_LOCAL_DIR
    : path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR)
}

export type { StorageAdapter } from './storage.types'
