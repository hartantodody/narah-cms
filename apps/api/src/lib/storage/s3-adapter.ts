import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import type {
  StorageAdapter,
  StorageUploadInput,
  StorageUploadResult
} from './storage.types'

/**
 * Generic S3-compatible storage adapter. Works with any S3 API: AWS S3,
 * Cloudflare R2, Backblaze B2, MinIO, DigitalOcean Spaces, Wasabi, etc.
 * The caller is responsible for supplying the correct endpoint + region
 * for their provider. See docs in apps/api/.env.example for examples.
 */
export type S3AdapterConfig = {
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicBaseUrl: string
  /** Some providers (MinIO, older B2 endpoints) require path-style URLs. */
  forcePathStyle?: boolean
}

export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client

  constructor(private readonly config: S3AdapterConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle ?? false,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    })
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType
      })
    )
    return {
      key: input.key,
      url: this.publicUrl(input.key),
      sizeBytes: input.body.byteLength
    }
  }

  async read(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      })
    )
    if (!response.Body) {
      throw new Error(`Empty response body for key ${key}`)
    }
    const chunks: Uint8Array[] = []
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      })
    )
  }

  publicUrl(key: string): string {
    const base = this.config.publicBaseUrl.replace(/\/+$/, '')
    const cleanKey = key.replace(/^\/+/, '')
    return `${base}/${cleanKey}`
  }
}
