import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { UserStatus } from '../generated/prisma/client'
import { prisma } from '../src/lib/prisma'
import {
  acceptAllPolicies,
  api,
  createAuthedUser,
  loginUser,
  registerUser,
  resetDb,
  startTestServer,
  stopTestServer,
  uniqueEmail
} from './helpers'

beforeAll(async () => {
  await startTestServer()
})

afterAll(async () => {
  await stopTestServer()
})

beforeEach(async () => {
  await resetDb()
})

describe('Auth — registration', () => {
  test('happy: registers a new user and returns a token', async () => {
    const email = uniqueEmail()
    const res = await api<{ accessToken: string; user: { email: string } }>(
      '/auth/register',
      {
        method: 'POST',
        body: { email, name: 'Alice', password: 'password123' }
      }
    )

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data?.accessToken).toBeTruthy()
    expect(res.body.data?.user.email).toBe(email)
  })

  test('rejects duplicate email with 409 EMAIL_TAKEN', async () => {
    const email = uniqueEmail()
    await registerUser({ email })
    const dup = await api('/auth/register', {
      method: 'POST',
      body: { email, name: 'Alice2', password: 'password123' }
    })
    expect(dup.status).toBe(409)
    expect(dup.body.code).toBe('EMAIL_TAKEN')
  })

  test('rejects password shorter than 8 chars', async () => {
    const res = await api('/auth/register', {
      method: 'POST',
      body: { email: uniqueEmail(), name: 'Alice', password: 'short' }
    })
    expect(res.status).toBe(400)
  })

  test('rejects malformed email', async () => {
    const res = await api('/auth/register', {
      method: 'POST',
      body: { email: 'not-an-email', name: 'Alice', password: 'password123' }
    })
    expect(res.status).toBe(400)
  })
})

describe('Auth — login', () => {
  test('happy: returns accessToken + user', async () => {
    const u = await registerUser()
    const res = await loginUser(u.user.email, u.password)
    expect(res.status).toBe(200)
    expect(res.body.data?.accessToken).toBeTruthy()
    expect(res.body.data?.user.email).toBe(u.user.email)
  })

  test('rejects wrong password with 401 INVALID_CREDENTIALS', async () => {
    const u = await registerUser()
    const res = await loginUser(u.user.email, 'wrongpassword')
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('INVALID_CREDENTIALS')
  })

  test('rejects unknown email with the SAME 401 message (no user enumeration)', async () => {
    const u = await registerUser()
    const wrong = await loginUser(u.user.email, 'wrongpassword')
    const unknown = await loginUser(uniqueEmail('ghost'), 'anything123')
    expect(unknown.status).toBe(401)
    expect(unknown.body.code).toBe('INVALID_CREDENTIALS')
    expect(unknown.body.message).toBe(wrong.body.message)
  })

  test('rejects disabled user with 403 USER_INACTIVE', async () => {
    const u = await registerUser()
    await prisma.user.update({
      where: { id: u.user.id },
      data: { status: UserStatus.DISABLED }
    })
    const res = await loginUser(u.user.email, u.password)
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('USER_INACTIVE')
  })
})

describe('Auth — /auth/me', () => {
  test('happy: returns current user', async () => {
    const u = await registerUser()
    const res = await api<{ user: { email: string } }>('/auth/me', {
      token: u.accessToken
    })
    expect(res.status).toBe(200)
    expect(res.body.data?.user.email).toBe(u.user.email)
  })

  test('401 without bearer token', async () => {
    const res = await api('/auth/me')
    expect(res.status).toBe(401)
  })

  test('401 with garbage token', async () => {
    const res = await api('/auth/me', { token: 'not.a.real.jwt' })
    expect(res.status).toBe(401)
  })
})

describe('Auth — change password', () => {
  test('happy: new password works, old password rejected', async () => {
    const u = await createAuthedUser()
    const change = await api('/auth/me/change-password', {
      method: 'POST',
      token: u.accessToken,
      body: { currentPassword: u.password, newPassword: 'newpass4567' }
    })
    expect(change.status).toBe(200)

    const withNew = await loginUser(u.user.email, 'newpass4567')
    expect(withNew.status).toBe(200)

    const withOld = await loginUser(u.user.email, u.password)
    expect(withOld.status).toBe(401)
  })

  test('rejects when currentPassword is wrong', async () => {
    const u = await createAuthedUser()
    const res = await api('/auth/me/change-password', {
      method: 'POST',
      token: u.accessToken,
      body: { currentPassword: 'wrong-current', newPassword: 'newpass4567' }
    })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD')
  })

  test('rejects newPassword shorter than 8 chars', async () => {
    const u = await createAuthedUser()
    const res = await api('/auth/me/change-password', {
      method: 'POST',
      token: u.accessToken,
      body: { currentPassword: u.password, newPassword: 'short' }
    })
    expect(res.status).toBe(400)
  })
})

describe('Auth — policy acceptance', () => {
  test('after acceptAllPolicies, /auth/me reports requiresPolicyAcceptance=false', async () => {
    // The test DB starts empty — there may or may not be active policy
    // documents depending on whether the seed ran. Either way, after
    // calling accept on whatever IS active, the flag must end up false.
    const u = await registerUser()
    await acceptAllPolicies(u.accessToken)
    const me = await api<{ requiresPolicyAcceptance: boolean }>('/auth/me', {
      token: u.accessToken
    })
    expect(me.body.data?.requiresPolicyAcceptance).toBe(false)
  })

  test('rejects accept with invalid policy id', async () => {
    const u = await registerUser()
    const res = await api('/auth/accept-policies', {
      method: 'POST',
      token: u.accessToken,
      body: { policyDocumentIds: ['00000000-0000-0000-0000-000000000000'] }
    })
    expect(res.status).toBe(400)
  })
})

describe('Cross-cutting', () => {
  test('every response includes x-request-id', async () => {
    const res = await api('/auth/me')
    expect(res.headers.get('x-request-id')).toMatch(
      /^[0-9a-f-]{8,}$/i
    )
  })

  test('client-supplied x-request-id is echoed back', async () => {
    const res = await api('/auth/me', {
      headers: { 'x-request-id': 'trace-from-client-123' }
    })
    expect(res.headers.get('x-request-id')).toBe('trace-from-client-123')
  })
})
