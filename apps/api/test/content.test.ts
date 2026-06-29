import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import {
  api,
  createAuthedUser,
  createContentType,
  createField,
  createSite,
  resetDb,
  startTestServer,
  stopTestServer
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

/* ────────────────────────────────────────────────────────────── */
/* Sites                                                          */
/* ────────────────────────────────────────────────────────────── */

describe('Sites', () => {
  test('happy: authenticated user creates a site and becomes OWNER', async () => {
    const u = await createAuthedUser()
    const site = await createSite(u.accessToken, 'My QA Site')
    expect(site.name).toBe('My QA Site')
    expect(site.slug).toBe('my-qa-site')

    const list = await api<{ sites: { id: string }[] }>('/sites', {
      token: u.accessToken
    })
    const found = list.body.data?.sites.find((s) => s.id === site.id)
    expect(found).toBeTruthy()

    // currentUserRole lives on detail, not list.
    const detail = await api<{ site: { currentUserRole: string } }>(
      `/sites/${site.id}`,
      { token: u.accessToken }
    )
    expect(detail.body.data?.site.currentUserRole).toBe('OWNER')
  })

  test('rejects unauthenticated site creation', async () => {
    const res = await api('/sites', { method: 'POST', body: { name: 'X' } })
    expect(res.status).toBe(401)
  })

  test('rejects site name shorter than 2 chars', async () => {
    const u = await createAuthedUser()
    const res = await api('/sites', {
      method: 'POST',
      token: u.accessToken,
      body: { name: 'X' }
    })
    expect(res.status).toBe(400)
  })

  test('PATCH by OWNER updates metadata; non-member gets 403/404', async () => {
    const owner = await createAuthedUser()
    const site = await createSite(owner.accessToken)
    const ok = await api(`/sites/${site.id}`, {
      method: 'PATCH',
      token: owner.accessToken,
      body: { description: 'updated' }
    })
    expect(ok.status).toBe(200)

    const stranger = await createAuthedUser()
    const blocked = await api(`/sites/${site.id}`, {
      method: 'PATCH',
      token: stranger.accessToken,
      body: { description: 'hax' }
    })
    expect([403, 404]).toContain(blocked.status)
  })
})

/* ────────────────────────────────────────────────────────────── */
/* Content types                                                  */
/* ────────────────────────────────────────────────────────────── */

describe('Content types', () => {
  test('happy: creates content type with auto-derived apiId', async () => {
    const u = await createAuthedUser()
    const site = await createSite(u.accessToken)
    const ct = await createContentType(u.accessToken, site.id, { name: 'Article' })
    expect(ct.apiId).toBe('article')
  })

  test('rejects duplicate apiId with 409', async () => {
    const u = await createAuthedUser()
    const site = await createSite(u.accessToken)
    await createContentType(u.accessToken, site.id, { name: 'Article' })
    const dup = await api(`/sites/${site.id}/content-types`, {
      method: 'POST',
      token: u.accessToken,
      body: { name: 'Article 2', apiId: 'article' }
    })
    expect(dup.status).toBe(409)
  })

  test('singleton: isSingleton flag persists', async () => {
    const u = await createAuthedUser()
    const site = await createSite(u.accessToken)
    const ct = await createContentType(u.accessToken, site.id, {
      name: 'Home Page',
      isSingleton: true
    })
    const detail = await api<{ contentType: { isSingleton: boolean } }>(
      `/sites/${site.id}/content-types/${ct.id}`,
      { token: u.accessToken }
    )
    expect(detail.body.data?.contentType.isSingleton).toBe(true)
  })
})

/* ────────────────────────────────────────────────────────────── */
/* Fields                                                         */
/* ────────────────────────────────────────────────────────────── */

describe('Fields', () => {
  test('happy: adds TEXT field with auto-derived apiId', async () => {
    const u = await createAuthedUser()
    const site = await createSite(u.accessToken)
    const ct = await createContentType(u.accessToken, site.id)
    const field = await createField(u.accessToken, site.id, ct.id, {
      label: 'Title',
      type: 'TEXT',
      required: true
    })
    expect(field.apiId).toBe('title')
  })

  // Audit finding: SELECT without options[] is currently accepted (no
  // required-options check unless you supply a non-array value). Logged
  // in docs/qa/auth-and-content.md §8.1 as a known soft validation.
  test('SELECT with non-array options[] is rejected', async () => {
    const u = await createAuthedUser()
    const site = await createSite(u.accessToken)
    const ct = await createContentType(u.accessToken, site.id)
    const bad = await api(`/sites/${site.id}/content-types/${ct.id}/fields`, {
      method: 'POST',
      token: u.accessToken,
      body: {
        label: 'Status',
        type: 'SELECT',
        config: { options: 'not-an-array' }
      }
    })
    expect(bad.status).toBe(400)
  })
})

/* ────────────────────────────────────────────────────────────── */
/* Content entries — CRUD + versioning                            */
/* ────────────────────────────────────────────────────────────── */

const seedArticleSchema = async () => {
  const u = await createAuthedUser()
  const site = await createSite(u.accessToken)
  const ct = await createContentType(u.accessToken, site.id, { name: 'Article' })
  await createField(u.accessToken, site.id, ct.id, {
    label: 'Title',
    type: 'TEXT',
    required: true
  })
  await createField(u.accessToken, site.id, ct.id, {
    label: 'Body',
    type: 'TEXT'
  })
  return { user: u, site, contentType: ct }
}

type EntryDetail = {
  id: string
  version: number
  status: string
  data: Record<string, unknown>
}

type EntryWrap = { entry: EntryDetail }

describe('Content entries — CRUD', () => {
  test('happy: creates DRAFT entry at version 1', async () => {
    const { user, site, contentType } = await seedArticleSchema()
    const res = await api<EntryWrap>(
      `/sites/${site.id}/content-types/${contentType.id}/entries`,
      {
        method: 'POST',
        token: user.accessToken,
        body: { data: { title: 'Hello', body: 'World' } }
      }
    )
    expect(res.status).toBe(201)
    expect(res.body.data?.entry.version).toBe(1)
    expect(res.body.data?.entry.status).toBe('DRAFT')
  })

  test('rejects missing required field with 400', async () => {
    const { user, site, contentType } = await seedArticleSchema()
    const res = await api(
      `/sites/${site.id}/content-types/${contentType.id}/entries`,
      {
        method: 'POST',
        token: user.accessToken,
        body: { data: { body: 'no title here' } }
      }
    )
    expect(res.status).toBe(400)
  })

  test('rejects wrong scalar type for TEXT field', async () => {
    const { user, site, contentType } = await seedArticleSchema()
    const res = await api(
      `/sites/${site.id}/content-types/${contentType.id}/entries`,
      {
        method: 'POST',
        token: user.accessToken,
        body: { data: { title: 12345, body: 'x' } }
      }
    )
    expect(res.status).toBe(400)
  })
})

describe('Content entries — publish flow', () => {
  test('publish flips status to PUBLISHED; unpublish flips back', async () => {
    const { user, site, contentType } = await seedArticleSchema()
    const created = await api<EntryWrap>(
      `/sites/${site.id}/content-types/${contentType.id}/entries`,
      {
        method: 'POST',
        token: user.accessToken,
        body: { data: { title: 'Hello' } }
      }
    )
    const entryId = created.body.data!.entry.id
    const base = `/sites/${site.id}/content-types/${contentType.id}/entries/${entryId}`

    // Publish + unpublish return the entry FLAT (no wrapper) — inconsistent
    // with create/patch but match the controller's current behaviour.
    const pub = await api<EntryDetail>(`${base}/publish`, {
      method: 'POST',
      token: user.accessToken
    })
    expect(pub.status).toBe(200)
    expect(pub.body.data?.status).toBe('PUBLISHED')

    const unpub = await api<EntryDetail>(`${base}/unpublish`, {
      method: 'POST',
      token: user.accessToken
    })
    expect(unpub.status).toBe(200)
    expect(unpub.body.data?.status).toBe('DRAFT')
  })

  test('PATCH with unchanged data does NOT bump version', async () => {
    const { user, site, contentType } = await seedArticleSchema()
    const created = await api<EntryWrap>(
      `/sites/${site.id}/content-types/${contentType.id}/entries`,
      {
        method: 'POST',
        token: user.accessToken,
        body: { data: { title: 'Hello' } }
      }
    )
    const entryId = created.body.data!.entry.id
    const base = `/sites/${site.id}/content-types/${contentType.id}/entries/${entryId}`

    const noop = await api<EntryWrap>(base, {
      method: 'PATCH',
      token: user.accessToken,
      body: { data: { title: 'Hello' } }
    })
    expect(noop.body.data?.entry.version).toBe(1)
  })

  test('PATCH with changed data bumps version exactly once', async () => {
    const { user, site, contentType } = await seedArticleSchema()
    const created = await api<EntryWrap>(
      `/sites/${site.id}/content-types/${contentType.id}/entries`,
      {
        method: 'POST',
        token: user.accessToken,
        body: { data: { title: 'Hello' } }
      }
    )
    const entryId = created.body.data!.entry.id
    const base = `/sites/${site.id}/content-types/${contentType.id}/entries/${entryId}`

    const patched = await api<EntryWrap>(base, {
      method: 'PATCH',
      token: user.accessToken,
      body: { data: { title: 'Hello again' }, status: 'PUBLISHED' }
    })
    expect(patched.body.data?.entry.version).toBe(2)
    expect(patched.body.data?.entry.status).toBe('PUBLISHED')
  })
})

describe('Content entries — revisions & restore', () => {
  test('revisions list grows with each data change, then prunes to last 10', async () => {
    const { user, site, contentType } = await seedArticleSchema()
    const created = await api<EntryWrap>(
      `/sites/${site.id}/content-types/${contentType.id}/entries`,
      {
        method: 'POST',
        token: user.accessToken,
        body: { data: { title: 'v1' } }
      }
    )
    const entryId = created.body.data!.entry.id
    const base = `/sites/${site.id}/content-types/${contentType.id}/entries/${entryId}`

    for (let i = 2; i <= 12; i++) {
      await api(base, {
        method: 'PATCH',
        token: user.accessToken,
        body: { data: { title: `v${i}` } }
      })
    }

    const list = await api<{ revisions: { version: number }[] }>(
      `${base}/revisions`,
      { token: user.accessToken }
    )
    const revisions = list.body.data!.revisions
    expect(revisions.length).toBe(10)
    const versions = revisions.map((r) => r.version).sort((a, b) => a - b)
    // Oldest two (v1, v2) pruned; v3..v12 retained.
    expect(versions[0]).toBeGreaterThanOrEqual(3)
    expect(versions[versions.length - 1]).toBe(12)
  })

  test('restore: data reverts and forward revisions are deleted (rewind)', async () => {
    const { user, site, contentType } = await seedArticleSchema()
    const created = await api<EntryWrap>(
      `/sites/${site.id}/content-types/${contentType.id}/entries`,
      {
        method: 'POST',
        token: user.accessToken,
        body: { data: { title: 'v1' } }
      }
    )
    const entryId = created.body.data!.entry.id
    const base = `/sites/${site.id}/content-types/${contentType.id}/entries/${entryId}`

    for (let i = 2; i <= 4; i++) {
      await api(base, {
        method: 'PATCH',
        token: user.accessToken,
        body: { data: { title: `v${i}` } }
      })
    }

    const revs = await api<{ revisions: { id: string; version: number }[] }>(
      `${base}/revisions`,
      { token: user.accessToken }
    )
    const revList = revs.body.data!.revisions
    const v2 = revList.find((r) => r.version === 2)!
    expect(v2).toBeTruthy()

    const restored = await api<EntryWrap>(
      `${base}/revisions/${v2.id}/restore`,
      { method: 'POST', token: user.accessToken }
    )
    expect(restored.status).toBe(200)
    expect(restored.body.data?.entry.version).toBe(2)
    expect(restored.body.data?.entry.data.title).toBe('v2')

    const afterRevs = await api<{ revisions: { version: number }[] }>(
      `${base}/revisions`,
      { token: user.accessToken }
    )
    const remainingVersions = afterRevs.body.data!.revisions.map((r) => r.version)
    expect(remainingVersions.every((v) => v <= 2)).toBe(true)
  })
})

/* ────────────────────────────────────────────────────────────── */
/* GROUP fields — components / repeatable sub-schemas             */
/* ────────────────────────────────────────────────────────────── */

const seedGallerySchema = async () => {
  const u = await createAuthedUser()
  const site = await createSite(u.accessToken)
  const ct = await createContentType(u.accessToken, site.id, { name: 'Page' })
  // A GROUP field "gallery" that holds title + description + list of
  // { caption, image } items. Mirrors the LSP MICE pilot use case.
  const groupField = await api<{ field: { id: string; apiId: string } }>(
    `/sites/${site.id}/content-types/${ct.id}/fields`,
    {
      method: 'POST',
      token: u.accessToken,
      body: {
        label: 'Gallery',
        type: 'GROUP',
        isList: true,
        config: {
          children: [
            { apiId: 'title', label: 'Title', type: 'TEXT', required: true },
            { apiId: 'description', label: 'Description', type: 'TEXT' },
            { apiId: 'caption', label: 'Caption', type: 'TEXT' }
          ]
        }
      }
    }
  )
  if (groupField.status !== 201) {
    throw new Error(
      `seedGallerySchema failed: ${groupField.status} ${JSON.stringify(groupField.body)}`
    )
  }
  return { user: u, site, contentType: ct }
}

describe('GROUP field — schema', () => {
  test('rejects GROUP creation without config.children', async () => {
    const u = await createAuthedUser()
    const site = await createSite(u.accessToken)
    const ct = await createContentType(u.accessToken, site.id)
    const res = await api(`/sites/${site.id}/content-types/${ct.id}/fields`, {
      method: 'POST',
      token: u.accessToken,
      body: { label: 'Empty group', type: 'GROUP' }
    })
    expect(res.status).toBe(400)
  })

  test('rejects more than 5 children', async () => {
    const u = await createAuthedUser()
    const site = await createSite(u.accessToken)
    const ct = await createContentType(u.accessToken, site.id)
    const res = await api(`/sites/${site.id}/content-types/${ct.id}/fields`, {
      method: 'POST',
      token: u.accessToken,
      body: {
        label: 'Too many',
        type: 'GROUP',
        config: {
          children: [
            { apiId: 'a', label: 'A', type: 'TEXT' },
            { apiId: 'b', label: 'B', type: 'TEXT' },
            { apiId: 'c', label: 'C', type: 'TEXT' },
            { apiId: 'd', label: 'D', type: 'TEXT' },
            { apiId: 'e', label: 'E', type: 'TEXT' },
            { apiId: 'f', label: 'F', type: 'TEXT' }
          ]
        }
      }
    })
    expect(res.status).toBe(400)
  })

  test('rejects nested GROUP (2-level cap)', async () => {
    const u = await createAuthedUser()
    const site = await createSite(u.accessToken)
    const ct = await createContentType(u.accessToken, site.id)
    const res = await api(`/sites/${site.id}/content-types/${ct.id}/fields`, {
      method: 'POST',
      token: u.accessToken,
      body: {
        label: 'Nested',
        type: 'GROUP',
        config: {
          children: [
            {
              apiId: 'inner',
              label: 'Inner',
              type: 'GROUP',
              config: {
                children: [{ apiId: 'x', label: 'X', type: 'TEXT' }]
              }
            }
          ]
        }
      }
    })
    expect(res.status).toBe(400)
  })

  test('rejects duplicate apiId within children', async () => {
    const u = await createAuthedUser()
    const site = await createSite(u.accessToken)
    const ct = await createContentType(u.accessToken, site.id)
    const res = await api(`/sites/${site.id}/content-types/${ct.id}/fields`, {
      method: 'POST',
      token: u.accessToken,
      body: {
        label: 'Dup',
        type: 'GROUP',
        config: {
          children: [
            { apiId: 'a', label: 'A', type: 'TEXT' },
            { apiId: 'a', label: 'A2', type: 'TEXT' }
          ]
        }
      }
    })
    expect(res.status).toBe(400)
  })

  test('accepts valid GROUP with mixed child types', async () => {
    const u = await createAuthedUser()
    const site = await createSite(u.accessToken)
    const ct = await createContentType(u.accessToken, site.id)
    const res = await api<{ field: { id: string } }>(
      `/sites/${site.id}/content-types/${ct.id}/fields`,
      {
        method: 'POST',
        token: u.accessToken,
        body: {
          label: 'Gallery',
          type: 'GROUP',
          isList: true,
          config: {
            children: [
              { apiId: 'title', label: 'Title', type: 'TEXT', required: true },
              { apiId: 'caption', label: 'Caption', type: 'TEXT' }
            ]
          }
        }
      }
    )
    expect(res.status).toBe(201)
    expect(res.body.data?.field.id).toBeTruthy()
  })
})

describe('GROUP field — entry data', () => {
  test('happy: list-group entry stores array of objects', async () => {
    const { user, site, contentType } = await seedGallerySchema()
    const res = await api<EntryWrap>(
      `/sites/${site.id}/content-types/${contentType.id}/entries`,
      {
        method: 'POST',
        token: user.accessToken,
        body: {
          data: {
            gallery: [
              {
                title: 'Section A',
                description: 'first',
                caption: 'photo1'
              },
              { title: 'Section B', caption: 'photo2' }
            ]
          }
        }
      }
    )
    expect(res.status).toBe(201)
    const gallery = res.body.data?.entry.data.gallery as unknown[]
    expect(Array.isArray(gallery)).toBe(true)
    expect(gallery.length).toBe(2)
    expect((gallery[0] as Record<string, unknown>).title).toBe('Section A')
  })

  test('rejects entry where required child is missing inside an item', async () => {
    const { user, site, contentType } = await seedGallerySchema()
    const res = await api(
      `/sites/${site.id}/content-types/${contentType.id}/entries`,
      {
        method: 'POST',
        token: user.accessToken,
        body: {
          data: {
            gallery: [{ caption: 'orphan' }] // missing required title
          }
        }
      }
    )
    expect(res.status).toBe(400)
    expect((res.body.issues ?? []).some((m) => m.includes('title'))).toBe(true)
  })

  test('no-op save with same group data does not bump version', async () => {
    const { user, site, contentType } = await seedGallerySchema()
    const created = await api<EntryWrap>(
      `/sites/${site.id}/content-types/${contentType.id}/entries`,
      {
        method: 'POST',
        token: user.accessToken,
        body: {
          data: {
            gallery: [{ title: 'Hello', description: null, caption: 'cap' }]
          }
        }
      }
    )
    const entryId = created.body.data!.entry.id
    const noop = await api<EntryWrap>(
      `/sites/${site.id}/content-types/${contentType.id}/entries/${entryId}`,
      {
        method: 'PATCH',
        token: user.accessToken,
        body: {
          data: {
            gallery: [{ title: 'Hello', description: null, caption: 'cap' }]
          }
        }
      }
    )
    expect(noop.body.data?.entry.version).toBe(1)
  })

  test('change to a child value bumps version once', async () => {
    const { user, site, contentType } = await seedGallerySchema()
    const created = await api<EntryWrap>(
      `/sites/${site.id}/content-types/${contentType.id}/entries`,
      {
        method: 'POST',
        token: user.accessToken,
        body: { data: { gallery: [{ title: 'Hello' }] } }
      }
    )
    const entryId = created.body.data!.entry.id
    const patched = await api<EntryWrap>(
      `/sites/${site.id}/content-types/${contentType.id}/entries/${entryId}`,
      {
        method: 'PATCH',
        token: user.accessToken,
        body: { data: { gallery: [{ title: 'Hello world' }] } }
      }
    )
    expect(patched.body.data?.entry.version).toBe(2)
  })
})
