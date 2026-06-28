export type StorageUploadInput = {
  /** Logical path inside the bucket, e.g. "site-id/2026/05/abc.jpg" */
  key: string
  body: Buffer
  contentType: string
}

export type StorageUploadResult = {
  key: string
  /** Publicly accessible URL */
  url: string
  sizeBytes: number
}

export interface StorageAdapter {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>
  delete(key: string): Promise<void>
  /** Read the original bytes back. Used by the image transform pipeline. */
  read(key: string): Promise<Buffer>
  /** Build a URL for direct (unauthenticated) access. Generally NOT used now
   *  that originals are locked — kept for completeness. */
  publicUrl(key: string): string
}
