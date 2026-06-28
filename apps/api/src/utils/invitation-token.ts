import { createHash, randomBytes } from 'node:crypto'

export const generateInvitationToken = () => randomBytes(32).toString('base64url')

export const hashInvitationToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')
