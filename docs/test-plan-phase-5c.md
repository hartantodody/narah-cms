# Phase 5c — Manual test plan

Covers the work landed since commit `784a6a6`: audit logging + viewer, populate, API explorer, site shell layout, singleton-slug fix, preview tokens, and the LSPMICE pilot seed.

Run through this once end-to-end to validate "best case" before committing or pushing.

## 0. Pre-flight

| Check | How |
|---|---|
| Docker postgres running | `docker ps` shows `narah-cms-postgres` Up, mapping `5433->5432` |
| API server up | `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health` → `200` |
| Admin server up | `cd apps/admin && bun dev` — open http://localhost:5173 |
| LSPMICE site seeded | `bun run db:seed:lspmice` (idempotent, safe to re-run) |
| Super admin credentials | `admin@narah.local` / `Admin12345!` |

If any of the above fails, stop here — the rest assumes a clean baseline.

## 1. Singleton slug fix (regression check)

**Why:** singletons used to default to `apiId` as slug, which contains underscores that the slug validator rejects.

| Step | Expected |
|---|---|
| `curl http://localhost:4000/public/v1/content-types/home_page/entries/home-page -H "x-api-key: $LSPMICE_WEB_KEY"` | `200` with `entry.slug === "home-page"` |
| Same call with `home_page` (underscore) in the slug position | `400 Invalid slug.` |
| In admin, open the `home_page` singleton entry under site `lspmice` and click Save | No "Invalid slug" error; entry stays viewable |

## 2. Preview tokens + draft preview

**Why:** new scope `entries:read-drafts` + `?preview=1` query flag.

The seed left two keys behind:
- `lspmice-web` — scope `[entries:read]`
- `lspmice-preview` — scope `[entries:read, entries:read-drafts]`

And one DRAFT entry: `news_post / preview-test-draft` (used only for this test; safe to delete via admin once done).

| # | Request | Expected |
|---|---|---|
| 2.1 | `lspmice-web` + no preview, `GET /content-types/news_post/entries/preview-test-draft` | `404 ENTRY_NOT_FOUND` |
| 2.2 | `lspmice-web` + `?preview=1` | `403 API_KEY_SCOPE_REQUIRED` |
| 2.3 | `lspmice-preview` + no preview | `404 ENTRY_NOT_FOUND` (draft still hidden without the flag) |
| 2.4 | `lspmice-preview` + `?preview=1` | `200` + draft payload, `publishedAt: null` |
| 2.5 | `lspmice-preview` + `?preview=1` on the list endpoint | `total >= 1`, includes the draft |
| 2.6 | Response headers on a non-preview call | `Cache-Control: public, max-age=30, s-maxage=60` |
| 2.7 | Response headers on a preview call | `Cache-Control: no-store` |

Quick one-shot:

```bash
WEB="<paste lspmice-web key>"
PRV="<paste lspmice-preview key>"
BASE="http://localhost:4000/public/v1/content-types/news_post/entries/preview-test-draft"

curl -s -o /dev/null -w "2.1 (web,no-preview)  → %{http_code}\n" -H "x-api-key: $WEB" "$BASE"
curl -s -o /dev/null -w "2.2 (web,preview)     → %{http_code}\n" -H "x-api-key: $WEB" "$BASE?preview=1"
curl -s -o /dev/null -w "2.3 (prv,no-preview)  → %{http_code}\n" -H "x-api-key: $PRV" "$BASE"
curl -s -o /dev/null -w "2.4 (prv,preview)     → %{http_code}\n" -H "x-api-key: $PRV" "$BASE?preview=1"
```

Expected: `404, 403, 404, 200`.

## 3. Admin UI — scope toggle

Open site `lspmice` → **API Keys** tab. (You need to log in as super admin.)

| Step | Expected |
|---|---|
| 3.1 | Table shows `lspmice-preview` with a yellow "Preview" badge next to its Active badge; `lspmice-web` shows no Preview badge |
| 3.2 | Open Edit on `lspmice-web`, check "Allow draft preview", Save | Preview badge appears in the table for `lspmice-web` |
| 3.3 | Re-issue the test from 2.2 with the now-elevated `lspmice-web` | `200` (draft accessible) |
| 3.4 | Edit `lspmice-web` again, uncheck "Allow draft preview", Save | Preview badge disappears; the 2.2 request reverts to `403` |
| 3.5 | Click "New key", check the box at create-time, copy plaintext, try `?preview=1` with that new key | `200` |

## 4. Populate (field expansion)

The LSPMICE pilot doesn't have RELATION fields wired yet, so this is best smoke-tested on the demo site if it exists, or by creating one quick reference field on `lspmice`.

If you have the `narah-demo` site (from `seed-demo`):

| Step | Expected |
|---|---|
| 4.1 | `GET /public/v1/content-types/blog_post/entries?populate=*` on any key bound to demo site | MEDIA fields resolve to `{ id, filename, url, mimeType, ... }`; RELATION fields resolve to `{ id, slug, contentType, data }` |
| 4.2 | Same call without `populate` | MEDIA/RELATION fields stay as raw IDs or `{id}` objects |

If you only have LSPMICE: skip — there's nothing relational to expand yet. (Wire one in when LSPMICE integration starts.)

## 5. Audit log writes + viewer

| Step | Expected |
|---|---|
| 5.1 | Do any mutation (rename a content type, edit an entry, mint an API key) | A row appears at the top of `/dashboard/audit-log` within seconds |
| 5.2 | Filter by action (e.g. `api_key.created`) | List narrows correctly |
| 5.3 | Open metadata column on a recent row | Includes `ipAddress`, `userAgent`, and operation-specific context |
| 5.4 | Visit `/app/:siteId/audit-log` as the same user | Same data scoped to that site only |

## 6. API Explorer page

| Step | Expected |
|---|---|
| 6.1 | From the site shell, open a content type → click "API" tab/link | Page loads at `/app/:siteId/content-types/:contentTypeId/api` |
| 6.2 | Page lists the public endpoints for that content type with copy-ready curl | URLs reflect the actual `apiId` and base URL |
| 6.3 | Choose an API key from the dropdown and "Try it" | Live response from the API appears inline |

## 7. Site shell vs super-admin shell

| Step | Expected |
|---|---|
| 7.1 | As super admin, open `/dashboard/sites` → it lists every site | Yes |
| 7.2 | Visit `/app` while logged in | Site picker (if multiple memberships) or auto-redirect to `/app/:siteId` (if single) |
| 7.3 | Sidebar items on `/app/:siteId` | Dashboard, Content Types (with entries), Media, Members, Audit Log; no super-admin-only items |

## 8. LSPMICE pilot data

| Step | Expected |
|---|---|
| 8.1 | `GET /public/v1/content-types/site_settings/entries/site-settings` with `lspmice-web` | Returns name, legal_name, navigation, contact_info, etc. — verbatim from `lspmice/src/data/site.ts` |
| 8.2 | `GET /public/v1/content-types/home_page/entries/home-page` | All six section blocks (`hero_slides`, `hero`, `highlights`, `about`, `about_panel`, `certification`, `news`, `contact`) present and non-empty |
| 8.3 | `GET /public/v1/content-types/about_page/entries/about-page` | Vision, missions, functions, work_foundations, legal_notes all present |
| 8.4 | `GET /public/v1/content-types/assessor/entries?pageSize=20` | `total >= 11`, items sorted by `publishedAt desc`; each entry's `data` has `name` + `display_order` |

## 9. Idempotency of seed

| Step | Expected |
|---|---|
| 9.1 | `bun run db:seed:lspmice` a second time | "Active 'lspmice-web' API key already exists" message; no duplicate site / content types / entries created |
| 9.2 | Revoke `lspmice-web` in admin, re-run the seed | A fresh plaintext key is printed; the old (revoked) row stays for audit |

## 10. Teardown / cleanup

- Delete the test draft entry `news_post / preview-test-draft` (via admin) if you don't want it sticking around.
- Keep the `lspmice-preview` key if you plan to develop the preview flow; revoke otherwise.

## Definition of done

All ✓ above, plus:
- No console errors in the admin during the manual flows.
- No 500s in the API logs during the runs.
- `bun run typecheck` in both `apps/api` and `apps/admin` (or `bunx tsc --noEmit` for admin) returns clean.
