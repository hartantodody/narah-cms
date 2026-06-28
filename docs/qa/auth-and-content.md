# Manual QA — Auth & Content

Pre-prod regression checklist. Run end-to-end before any client demo or
production deploy. Each section has a happy-path + the critical edges
worth catching before they bite a real user.

Style note: ✅ = expected pass; 🚫 = expected failure (verify the error
message + status code match).

---

## 0. Pre-flight

| Check | How |
|---|---|
| Docker postgres up | `docker ps` → `narah-cms-postgres` running on `5433->5432` |
| API up | `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health` → `200` |
| API health includes security headers | `curl -sI http://localhost:4000/health` → `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, `x-request-id: <uuid>` present |
| Admin app up | `cd apps/admin && bun dev` → http://localhost:5173 loads |
| Clean baseline | Reset DB if you want a deterministic run: `cd apps/api && bun run db:reset && bun run db:seed && bun run db:seed:dev-accounts` |
| Super admin creds (after seed) | `admin@narah.local` / `Admin12345!` |

Stop here if anything fails — the rest assumes a clean baseline.

---

## 1. Auth — Registration

### 1.1 Happy path: new account

| Step | Expected |
|---|---|
| Open http://localhost:5173/register | Form renders with email/name/password fields |
| Submit `qa-new@test.local` / `QA Tester` / `password123` | ✅ Redirect to onboarding/policies if any are required; `accessToken` stored in localStorage |
| `curl http://localhost:4000/auth/me -H "Authorization: Bearer <token>"` | ✅ `200` with `data.user.email === "qa-new@test.local"` |

### 1.2 Edge: duplicate email

| Step | Expected |
|---|---|
| Register again with the same `qa-new@test.local` | 🚫 `409 EMAIL_TAKEN` — admin shows toast "An account with this email already exists." |

### 1.3 Edge: weak password

| Step | Expected |
|---|---|
| Register with password `short` (7 chars) | 🚫 `400` validation error mentioning password min length 8 |

### 1.4 Edge: rate limit

| Step | Expected |
|---|---|
| POST `/auth/register` 6 times in 15 min from same IP | 🚫 6th call → `429 RATE_LIMIT_EXCEEDED` with envelope `{ success: false, message: "Too many attempts…", code: "RATE_LIMIT_EXCEEDED" }` |
| Response headers | Includes `ratelimit-remaining`, `ratelimit-reset` |

---

## 2. Auth — Login

### 2.1 Happy path

| Step | Expected |
|---|---|
| Login `qa-new@test.local` / `password123` | ✅ `200` with `data.accessToken`, `data.user`, `data.requiresPolicyAcceptance`, `data.memberships` |
| Decode JWT (jwt.io) | Payload has `sub`, `iat`, `exp`; `exp - iat` matches `JWT_ACCESS_EXPIRES_IN` |

### 2.2 Edge: wrong password

| Step | Expected |
|---|---|
| Login `qa-new@test.local` / `wrongpass` | 🚫 `401 INVALID_CREDENTIALS` — same generic message regardless of whether email exists (timing should be similar too) |

### 2.3 Edge: unknown email

| Step | Expected |
|---|---|
| Login `nobody@nowhere.test` / anything | 🚫 `401 INVALID_CREDENTIALS` (same message as above — never `404`) |

### 2.4 Edge: rate limit on login

| Step | Expected |
|---|---|
| 11 failed login attempts in 15 min from same IP | 🚫 11th → `429 RATE_LIMIT_EXCEEDED` |

### 2.5 Edge: inactive user

| Step | Expected |
|---|---|
| Admin marks user `status = INACTIVE` in DB | — |
| User logs in | 🚫 `403 USER_INACTIVE` |

---

## 3. Auth — Session lifecycle

### 3.1 Token usage

| Step | Expected |
|---|---|
| `GET /auth/me` with valid bearer | ✅ Current user returned |
| `GET /auth/me` with no header | 🚫 `401` |
| `GET /auth/me` with `Authorization: Bearer garbage` | 🚫 `401` |
| `GET /auth/me` with valid token after `JWT_ACCESS_SECRET` rotated server-side | 🚫 `401` (token now signed with old key) |

### 3.2 Change password

| Step | Expected |
|---|---|
| POST `/auth/me/change-password` `{ currentPassword: "password123", newPassword: "newpass456" }` | ✅ `200` |
| Login with new password | ✅ `200` |
| Login with old password | 🚫 `401 INVALID_CREDENTIALS` |
| Change password with wrong current pwd | 🚫 `400 INVALID_CURRENT_PASSWORD` |
| Change password with new pwd < 8 chars | 🚫 `400` validation error |

### 3.3 Profile update

| Step | Expected |
|---|---|
| PATCH `/auth/me` `{ name: "New Name" }` | ✅ `200` returns updated user |
| `/auth/me` after update reflects new name | ✅ |

---

## 4. Auth — Policy acceptance

### 4.1 Happy path

| Step | Expected |
|---|---|
| Fresh login (user has unaccepted policies) | `data.requiresPolicyAcceptance === true` |
| GET `/auth/required-policies` | ✅ Returns array of `{ id, type, version, title, content, accepted: false }` |
| Open `/policies` page in admin | Renders all active policies with checkboxes |
| Submit all checkboxes | ✅ POST `/auth/accept-policies` with all `policyDocumentIds`; navigates to dashboard |

### 4.2 Edge: blocked while unaccepted

| Step | Expected |
|---|---|
| User who hasn't accepted policies hits `GET /sites` | 🚫 `403` with `code` indicating policies required, OR redirected by client guard |

### 4.3 Edge: invalid policy ID

| Step | Expected |
|---|---|
| POST `/auth/accept-policies` `{ policyDocumentIds: ["00000000-0000-0000-0000-000000000000"] }` | 🚫 `400 INVALID_POLICY_DOCUMENT` |

---

## 5. Invitations

### 5.1 Happy path: invite + accept

| Step | Expected |
|---|---|
| As OWNER of a site, POST `/sites/:siteId/invitations` `{ email: "newperson@test.local", role: "EDITOR" }` | ✅ `201` returns `{ invitation, inviteLink }` |
| Open `inviteLink` in a private window | `/accept-invitation?token=...` form renders |
| Submit with name + password (new user case) | ✅ Account created, auto-login, redirected; user now in site member list as EDITOR |

### 5.2 Edge: existing user accepts

| Step | Expected |
|---|---|
| Invite `qa-new@test.local` (existing user) | Invite link works without asking for password |
| Submit | ✅ User added to site; no new account created |

### 5.3 Edge: invalid/expired/revoked token

| Step | Expected |
|---|---|
| POST `/invitations/accept` `{ token: "garbage" }` | 🚫 `400` or `404` invalid token |
| Revoke the invite from admin, then try to accept | 🚫 invalid/revoked token error |

### 5.4 Edge: role escalation by ADMIN

| Step | Expected |
|---|---|
| As ADMIN, invite someone as `OWNER` | 🚫 `403` — admin cannot assign OWNER |
| As ADMIN, invite as `EDITOR` | ✅ works |

### 5.5 Edge: rate limit on accept

| Step | Expected |
|---|---|
| POST `/invitations/accept` 21 times in 15 min from same IP | 🚫 21st → `429 RATE_LIMIT_EXCEEDED` |

---

## 6. Sites

### 6.1 Happy path: create

| Step | Expected |
|---|---|
| POST `/sites` `{ name: "QA Site" }` | ✅ `201` with auto-generated `slug` (kebab-case of name) |
| Creator role on the new site | ✅ `OWNER` |

### 6.2 Edge: free tier site limit

| Step | Expected |
|---|---|
| Non-super-admin who already owns 1 site tries to create another | 🚫 `403` or `400` with message about free tier limit |
| Same as super admin | ✅ creates without limit |

### 6.3 Edge: slug normalisation

| Step | Expected |
|---|---|
| POST `/sites` `{ name: "QA Site", slug: "QA_Site!" }` | Slug stored as `qa-site` (or rejected with clear error — verify which) |

### 6.4 Edge: archive vs delete

| Step | Expected |
|---|---|
| DELETE `/sites/:siteId` as OWNER | ✅ Soft-archive — `GET /sites` excludes it by default |
| `GET /sites?includeArchived=true` | ✅ Archived site appears |
| Non-OWNER tries delete | 🚫 `403` |

---

## 7. Content Types

All steps assume the QA site from §6.1.

### 7.1 Happy path: create content type

| Step | Expected |
|---|---|
| In admin → Schema → New content type → Name "Article" | API ID preview shows `article` live as you type |
| Create | ✅ `201` with `apiId: "article"`, empty fields list |
| As EDITOR (not ADMIN) try to create | 🚫 `403` |

### 7.2 Singleton

| Step | Expected |
|---|---|
| Create with `isSingleton: true`, name "Home Page" | ✅ Created. Only ONE entry allowed under it later |
| Visual indicator in Schema list | Singleton icon different from Collection icon |

### 7.3 Edge: duplicate apiId

| Step | Expected |
|---|---|
| Create second content type with same `apiId: "article"` | 🚫 `409` |

### 7.4 Schema replace (code editor)

| Step | Expected |
|---|---|
| PUT `/content-types/:id/schema` with fields array of 3 fields | ✅ All 3 fields exist after; old fields with matching apiId preserved; old fields not in body deleted |
| PUT with two fields sharing same `apiId` | 🚫 `409` duplicate apiId |

---

## 8. Fields

### 8.1 Happy path: add TEXT field

| Step | Expected |
|---|---|
| Add field `label: "Title"`, `type: TEXT`, `required: true` | ✅ `201`, apiId auto-derived to `title` |
| Add SELECT field with `config.options: ["A","B"]` | ✅ |
| Add SELECT with no options | 🚫 `400` validation |
| Add RELATION with `config.contentTypeId: "<unknown>"` | 🚫 `400` |

### 8.2 isList toggle (data preservation)

| Step | Expected |
|---|---|
| Existing entry has `data.title = "Hello"` (scalar); flip Title field to `isList: true` | ✅ Existing data migrated to `["Hello"]` (verify via `GET /entries/:id`) |
| Flip back to scalar | ✅ Data unwrapped to `"Hello"` (first item kept) |

### 8.3 Reorder

| Step | Expected |
|---|---|
| PATCH `/fields/reorder` with all field IDs in new order | ✅ `200`; subsequent GET reflects order |
| Reorder with missing/extra IDs | 🚫 `400` |

### 8.4 Delete field

| Step | Expected |
|---|---|
| Delete field; entries with that field's data | Field disappears from schema; old entry data may retain orphan key (verify behaviour) |

---

## 9. Content Entries — CRUD

Assume `Article` content type with fields `title (TEXT, required)`, `body (TEXT)`, `tags (TEXT, isList)`.

### 9.1 Happy path: create draft

| Step | Expected |
|---|---|
| POST `/entries` `{ data: { title: "Hello", body: "World", tags: ["a","b"] }, status: "DRAFT" }` | ✅ `201` with `version: 1`, `status: "DRAFT"`, `publishedAt: null` |
| GET that entry | ✅ Data matches |
| As VIEWER, create | 🚫 `403` |

### 9.2 Edge: missing required field

| Step | Expected |
|---|---|
| POST with no `title` | 🚫 `400` with `issues` listing missing field |

### 9.3 Edge: wrong type

| Step | Expected |
|---|---|
| POST with `title: 123` (number where text expected) | 🚫 `400` |
| POST with `tags: "single"` when field is `isList` | 🚫 `400` |

### 9.4 Edge: duplicate slug within content type

| Step | Expected |
|---|---|
| Two entries with the same `slug` under one collection content type | 🚫 second one `409` |
| Same slug across different content types | ✅ allowed |

### 9.5 Edge: singleton constraint

| Step | Expected |
|---|---|
| Singleton `Home Page` already has 1 entry; POST a second | 🚫 `400` or `409` "singleton already has an entry" |

---

## 10. Content Entries — Publish flow

### 10.1 Happy path

| Step | Expected |
|---|---|
| Entry is DRAFT version 2 | — |
| POST `/entries/:id/publish` | ✅ `200`, `status: "PUBLISHED"`, `publishedAt` set, `version` unchanged (no new revision) |
| POST `/entries/:id/unpublish` | ✅ `200`, `status: "DRAFT"`, `publishedAt` may stay or clear (verify) |

### 10.2 Edge: save + immediate publish ≠ 2 versions

| Step | Expected |
|---|---|
| PATCH entry with `data` unchanged + `status: "PUBLISHED"` | ✅ `version` does NOT bump (data-equality check via JSON.stringify) |
| PATCH entry with `data` changed + `status: "PUBLISHED"` in one call | ✅ `version` bumps once (not twice) |

### 10.3 Public delivery sees only PUBLISHED

| Step | Expected |
|---|---|
| `curl /public/v1/content-types/article/entries -H "x-api-key: $KEY"` | ✅ Returns ONLY entries with status PUBLISHED. DRAFTs excluded. |

---

## 11. Content Entries — Versioning & revisions

### 11.1 Happy path

| Step | Expected |
|---|---|
| Create entry → `version: 1` | ✅ |
| PATCH with different data → `version: 2` | ✅ One revision row exists for the new state |
| PATCH 9 more times → `version: 11` | ✅ Total revisions in `revisions` list = 10 (oldest pruned) |
| GET `/revisions` | ✅ List sorted desc by `version`, most recent first |

### 11.2 Edge: no-op save doesn't bump

| Step | Expected |
|---|---|
| PATCH with identical `data` to current state | ✅ `version` unchanged; no new revision row |

### 11.3 Restore (rewind semantics)

| Step | Expected |
|---|---|
| Entry is at v5; revisions exist for v1–v5 | — |
| POST `/revisions/:v3-id/restore` | ✅ Entry data reverts to v3 data; `version` becomes `3`; revisions for v4 and v5 are deleted |
| GET `/revisions` after restore | Only v1, v2, v3 remain |

### 11.4 Edge: restoring "current" version

| Step | Expected |
|---|---|
| Entry currently at v3; POST restore on v3 itself | 🚫 `400` or no-op with clear message — UI's Restore button should be hidden in this case |

### 11.5 Edge: restore after schema change loses fields

| Step | Expected |
|---|---|
| Add field `subtitle` after revision v2 was created; restore to v2 | Entry shows v2 data; `subtitle` field empty/null (revision data is preserved verbatim — verify it doesn't crash the validator) |

---

## 12. Cross-cutting checks

### 12.1 Request IDs propagate

| Step | Expected |
|---|---|
| Any API call → response header `x-request-id` is a UUID | ✅ |
| Send a custom `x-request-id: my-trace-123` header | ✅ Response echoes the same value |
| Force a 5xx (e.g. trigger error path) → API log line | Contains `requestId: <same uuid>` |

### 12.2 Sensitive fields not logged

| Step | Expected |
|---|---|
| Login with valid creds → check API log line for that request | `password`, `Authorization` header value, `accessToken` all show as `[redacted]` |

### 12.3 Graceful shutdown

| Step | Expected |
|---|---|
| Start a long-running upload | — |
| Send `SIGTERM` to the API process (`kill -15 <pid>`) | API logs `shutdown signal received — draining`, finishes in-flight upload, logs `shutdown complete`, exits 0 |
| After SIGTERM, new request | Connection refused (server stopped accepting) |

### 12.4 Public delivery rate limit (smoke)

| Step | Expected |
|---|---|
| Hammer `/public/v1/content-types/article/entries` with one API key 100x in <1 min | After threshold → `429 RATE_LIMIT_EXCEEDED` with `retry-after` header |

---

## 13. Smoke regression matrix (run before every deploy)

Quick 5-minute sweep:

- [ ] Health 200 + security headers present
- [ ] Login admin@narah.local works, returns accessToken
- [ ] Site list non-empty for admin
- [ ] Create site → succeeds → archive → disappears from list
- [ ] Create content type → field → entry → publish → entry appears in public delivery
- [ ] Edit entry → version bumps → restore older revision → version rewinds correctly
- [ ] Logout / token cleared → `/auth/me` returns 401
- [ ] No PII or secrets in the last 200 API log lines (grep for `password`, `Bearer ey`, raw emails)
