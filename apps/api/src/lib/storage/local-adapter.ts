import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  StorageAdapter,
  StorageUploadInput,
  StorageUploadResult
} from './storage.types'

export class LocalStorageAdapter implements StorageAdapter {
  constructor(
    private readonly rootDir: string,
    private readonly publicBaseUrl: string
  ) {}

  private absolutePath(key: string): string {
    // key is "siteId/yyyy/mm/filename"
    // Normalize and prevent escaping the root
    const safe = key.replace(/\\/g, '/').replace(/(^|\/)\.\.(\/|$)/g, '$1$2')
    return path.join(this.rootDir, safe)
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const target = this.absolutePath(input.key)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, input.body)
    return {
      key: input.key,
      url: this.publicUrl(input.key),
      sizeBytes: input.body.byteLength
    }
  }

  async read(key: string): Promise<Buffer> {
    const target = this.absolutePath(key)
    return fs.readFile(target)
  }

  async delete(key: string): Promise<void> {
    const target = this.absolutePath(key)
    try {
      await fs.unlink(target)
    } catch (err) {
      // Ignore if already gone
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }

  publicUrl(key: string): string {
    const base = this.publicBaseUrl.replace(/\/+$/, '')
    const cleanKey = key.replace(/^\/+/, '')
    return `${base}/${cleanKey}`
  }
}
