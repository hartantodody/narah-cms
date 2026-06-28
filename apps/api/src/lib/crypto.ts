import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'
import { env } from '../config/env'

/**
 * AES-256-GCM symmetric encryption for at-rest secrets (e.g. third-party
 * service account JSONs). The encryption key is derived from the
 * `ENCRYPTION_KEY` env var via SHA-256, so any sufficiently long string works.
 *
 * Storage convention: ciphertext, iv, and authTag are stored separately as
 * base64 strings so each can be a typed column / json field.
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM standard

// Pulls from the validated env config (not process.env directly) so that the
// zod-default kicks in during local dev if the .env doesn't set this.
const getKey = () => createHash('sha256').update(env.ENCRYPTION_KEY).digest()

export type EncryptedPayload = {
  ciphertext: string
  iv: string
  authTag: string
}

export function encryptString(plaintext: string): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  }
}

export function decryptString(payload: EncryptedPayload): string {
  const iv = Buffer.from(payload.iv, 'base64')
  const authTag = Buffer.from(payload.authTag, 'base64')
  const ciphertext = Buffer.from(payload.ciphertext, 'base64')
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return dec.toString('utf8')
}
