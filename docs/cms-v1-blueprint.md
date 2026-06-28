# Narah CMS v1 Blueprint

## Product Concept

Narah CMS is a schema-driven, multi-site headless CMS designed for teams that need to manage structured content across multiple properties from a shared platform. The system should let administrators define content models, generate the corresponding authoring experience dynamically, and expose content through a consistent API for downstream web and app clients.

## Goals

- Provide a flexible headless CMS foundation for multiple sites within one platform.
- Let authorized users define content structures without hardcoding forms for every content type.
- Support clear role boundaries for governance, publishing safety, and operational scale.
- Keep the platform modular so features can be phased in without reworking the core architecture.

## Non-Goals (v1)

- Building entry authoring or media upload before the schema layer is validated.
- Public delivery API features beyond basic published-content read access.
- Multi-tenancy at the database level (single Postgres, scoped by `siteId`).

## Tech Stack

- Monorepo: Bun workspaces
- Admin app: Vite, React 19, TypeScript, React Router 7, TanStack Query/Table, React Hook Form + Zod, shadcn/ui, Tailwind CSS 4, `next-themes` for light/dark
- API app: Bun, Express 5, TypeScript, Prisma 7 (Postgres), Zod, JWT auth, Swagger/OpenAPI
- Local infra: Docker Compose (Postgres)

## Monorepo Structure

```text
apps/
  admin/   # React admin dashboard
  api/     # Express API
packages/  # Shared packages to be introduced as the platform grows
docs/      # Product and architecture documentation
```

## Role Model

- `super_admin`: Platform-wide administrator with access to all sites, configuration, and user management.
- `site_admin`: Site-level administrator responsible for settings, users, and content governance within assigned sites.
- `editor`: Content author and maintainer for permitted schemas and entries.
- `viewer`: Read-only access for approved operational or auditing use cases.

## First-Login Legal Consent Requirement

On a user's first successful login, access to the application should be gated until both of the following are explicitly accepted:

- Privacy Policy acceptance
- User Agreement acceptance

The system should store consent status and timestamp for auditability once authentication is implemented.

## High-Level Modules

- Auth & invitation
- Site management
- Content type builder
- Field builder
- Dynamic form renderer
- Content entry manager
- Media library
- Public API

## Phased Roadmap

### Phase 1 — Foundation · shipped

- Bun workspace, admin + api boundaries, dev workflows.
- API skeleton with versioned routing, env validation, error middleware.
- Admin shell, blueprint docs.

### Phase 2 — Auth, sites, members · shipped

- JWT auth (`/auth/login`, `/auth/me`), policy-acceptance middleware.
- First-login Privacy Policy + User Agreement gate (`/auth/required-policies`, `/auth/accept-policies`).
- Site CRUD, members (OWNER / ADMIN / EDITOR / VIEWER), invitations (token-based).
- Prisma schema with 13 models (User, Site, SiteMember, SiteInvitation, ContentType, ContentField, ContentEntry, MediaAsset, ApiKey, PolicyDocument, PolicyAcceptance, AuditLog).

### Phase 3 — Schema builder · shipped

- Content type CRUD per site.
- Field CRUD with reorder, type catalog (TEXT, RICH_TEXT, NUMBER, BOOLEAN, DATE, DATETIME, MEDIA, JSON, SELECT, MULTI_SELECT, RELATION).
- Per-field `required`, `localized`, `isList`, `config`, `validation`, `defaultValue`.

### Phase 4 — Content entries · shipped

- Entry CRUD nested under content type: `GET / POST / GET :id / PATCH :id / DELETE :id` and `POST :id/publish` + `POST :id/unpublish` on `/sites/:siteId/content-types/:contentTypeId/entries`.
- Server-side data validation against the ContentType's field definitions: required, type coercion, min/max length, min/max number, regex pattern, integer flag, SELECT option enforcement, MULTI_SELECT as list of SELECT values, UUID format for MEDIA / RELATION, list `isList` arrays.
- Status machine: DRAFT ↔ PUBLISHED; `publishedAt` set on first publish, cleared on unpublish; version counter incremented on each data update.
- Slug: optional, auto-derived from `slug` / `title` / `name` / `heading` field when blank; singleton content types default to the contentType `apiId`; uniqueness enforced per content type.
- Permissions: OWNER / ADMIN / EDITOR can edit, VIEWER read-only, super admin bypasses membership. New `canEditSiteContent` helper in `sites.authorization.ts`.
- Singleton enforcement: max 1 entry per content type when `isSingleton`.
- Admin UI:
  - `EntriesListPage` (`/dashboard/sites/:siteId/content-types/:contentTypeId/entries`) — paginated table, status filter pills, slug search, delete dialog.
  - `EntryEditorPage` (`/.../entries/new` and `/.../entries/:entryId`) — dynamic form built from the schema, sidebar with slug + audit metadata, save draft / publish / unpublish / delete actions.
  - `DynamicFieldInput` (`features/content-entries/dynamic-field-input.tsx`) — renders one input per `ContentFieldType`. Fully supported: TEXT, **RICH_TEXT (TipTap editor)**, NUMBER, BOOLEAN, DATE, DATETIME, SELECT, MULTI_SELECT (toggle pills), JSON (mono textarea). Placeholder UX for MEDIA and RELATION — paste-UUID with a "coming soon" hint.
- Rich text editor (`components/app/rich-text-editor.tsx`) — TipTap-based, emits TipTap JSON (`{ type: "doc", content: [...] }`). Toolbar: bold, italic, strikethrough, inline code, H1/H2/H3, bullet/numbered list, blockquote, divider, link, undo/redo. Backend accepts either a TipTap doc object or legacy plain string for `RICH_TEXT` fields. Output is rendered with the `.narah-prose` utility class defined in `index.css`.

Deferred to Phase 5:

- MEDIA field with proper asset picker (needs media library).
- RELATION searchable picker (currently paste-UUID).
- Image embed inside the rich text editor (needs media library too).
- Audit log writes.

### Phase 5a — Media library + image optimization · shipped

- Storage adapter pattern (`apps/api/src/lib/storage/`): pluggable driver picked via `STORAGE_DRIVER` env var.
  - `LocalStorageAdapter` — writes to `apps/api/storage/` (gitignored), served by Express via `/storage/*` static.
  - `R2StorageAdapter` — S3-compatible client for Cloudflare R2. Activated by setting `STORAGE_DRIVER=r2` + `R2_*` env vars. Same upload/delete contract as local — no code change to switch.
- Backend module `media-assets.*` under `sites/`:
  - `POST /sites/:siteId/media` — multipart upload (`field: file`), max size from `MAX_UPLOAD_SIZE_MB` (default 10), allow-list `image/jpeg`, `image/png`, `image/webp`, `image/gif`.
  - `GET /sites/:siteId/media` — paginated, filename search, `mimeTypePrefix` filter.
  - `GET / PATCH / DELETE /sites/:siteId/media/:assetId` — read, update (filename, altText), delete (removes both DB row and storage object).
  - Filenames sanitized; storage keys structured as `siteId/yyyy/mm/stem-uuid8.ext`; original storage key kept in `MediaAsset.metadata.storageKey` for cleanup.
- Permissions: same `canAccessSite` for reads, `canEditSiteContent` (OWNER / ADMIN / EDITOR + super admin) for upload / update / delete.
- **Image transform pipeline** (`apps/api/src/lib/image-transform.ts`) using `sharp`:
  - Originals are NEVER served publicly. Express static for `/storage/*` is disabled; only the transform endpoint can read them.
  - Public render endpoint `GET /api/media/:assetId` (no auth) returns a derivative with query params `w`, `h`, `q` (1–100, default 85), `fit` (cover / contain / inside / outside), `fmt` (auto / webp / avif / jpeg / png). When `fmt=auto`, format is negotiated via the `Accept` header (AVIF → WebP → JPEG/PNG).
  - Disk cache at `IMAGE_CACHE_DIR` (default `.cache/images/`, gitignored) keyed by sha256 of (storageKey + params). First hit transforms, subsequent hits serve cached. `Cache-Control: public, max-age=31536000, immutable` + ETag for browser/CDN cache.
  - Focal point honoured when `fit=cover` — snaps to one of sharp's nine position keywords based on the focal coordinates.
  - Dimensions clamped to 16…4096 to prevent abuse.
- **Originals download** (admin only) — `GET /sites/:siteId/media/:assetId/download` (auth + site membership). Returns the un-transformed file with `Content-Disposition: attachment`.
- `MediaAsset.url` (the public-facing field on API responses) now points to the render endpoint with a default `?w=1600`. The serializer always builds it from `API_PUBLIC_BASE_URL` + asset id.
- Asset metadata extended on upload: `width`, `height`, `storageKey`, `focalPoint: { x: 0.5, y: 0.5 }` (default centre). Updatable via PATCH.
- Admin UI:
  - `MediaLibraryPage` (`/dashboard/sites/:siteId/media`) — grid (thumbnails via `?w=400&q=70`), filename search, upload, preview dialog with **focal point picker** (click image to place focal dot), alt text editor, **download original** button, delete.
  - `FocalPointPicker` (`features/media-assets/focal-point-picker.tsx`) — click-to-place crosshair, 0..1 normalized coords, used in the preview dialog.
  - `AssetPicker` modal (`features/media-assets/asset-picker.tsx`) — reusable picker with built-in upload, used by both MEDIA field and the rich text editor. Thumbnails via `?w=300&q=70`.
  - `MEDIA` field type renders preview (thumbnail via `?w=200&q=70`) + Change / Remove buttons. Stored shape: `{ id, url, alt }`. Backend validator accepts either this object or a legacy UUID string.
  - Rich text editor: TipTap `Image` extension + toolbar "Insert image" button that opens the same `AssetPicker`. Inserted as `<img>` node with `src` and `alt`.
  - Sidebar "Media" item activated (links to site picker).
- **Bandwidth impact (typical):** a 4 MB upload becomes ~180 KB at 1600px WebP (q85), ~110 KB at AVIF (q60). ~95% reduction over serving originals.

### Phase 5b — Public delivery API + API keys · shipped

- API key model (already in Prisma) wired up end-to-end. Key format: `narah_{env}_{base64url(32 random bytes)}`. Stored as SHA-256 hash (`keyHash` unique) + 8-char prefix for display (`keyPrefix`). Plaintext returned exactly once on creation and never persisted.
- Admin endpoints (`/sites/:siteId/api-keys`, JWT + OWNER/ADMIN required):
  - `GET /` — list (hash never exposed).
  - `POST /` — create (returns `{ apiKey, plaintext }` — plaintext only this once).
  - `POST /:apiKeyId/revoke` — sets `revokedAt`; key stays for audit.
  - `DELETE /:apiKeyId` — hard delete.
- Scope catalog (`apps/api/src/utils/api-key.ts`): currently `entries:read`. Designed to extend (preview tokens, write scopes) without schema change — scopes is a `String[]`.
- API-key auth middleware (`apps/api/src/middleware/api-key.middleware.ts`):
  - Accepts `Authorization: Bearer narah_...` OR `x-api-key: narah_...`.
  - SHA-256 → unique lookup, validates `revokedAt`, `expiresAt`, and parent site status.
  - Attaches `req.apiKey = { apiKeyId, siteId, siteSlug, scopes }`.
  - `lastUsedAt` updated non-blocking (fire-and-forget).
  - `requireScope(scope)` helper for per-route gating.
- Public delivery routes mounted at `/public/v1` (CORS open `*`, only GETs):
  - `GET /public/v1/me` — sanity check; returns the key's site + scopes.
  - `GET /public/v1/content-types/:apiId/entries` — paginated list of PUBLISHED entries (page / pageSize / orderBy / order). Site scope inferred from the key.
  - `GET /public/v1/content-types/:apiId/entries/:slug` — single PUBLISHED entry by slug.
  - Cache headers: `Cache-Control: public, max-age=30, s-maxage=60`.
- Admin UI: new **API Keys** tab on site detail. List with status badges (Active / Revoked / Expired), prefix, scopes, last-used, expiry. Create dialog → one-time plaintext reveal with copy button and ready-to-paste `curl` example. Revoke (reversible-style — record stays) and Delete (hard).

### Phase 5c — Polish

**RELATION picker · shipped**
- Schema author UX: in the field editor, RELATION fields now show a **dropdown** of available content types (replacing the paste-UUID input). Loaded lazily when type=RELATION is selected.
- Content author UX: `RelationPicker` modal (`features/content-entries/relation-picker.tsx`) lists entries from the related content type with slug search, status badges, double-click-to-select.
- Stored shape upgraded from bare UUID to `{ id, slug?, contentTypeApiId? }`. Backend `RELATION` validator accepts either form (string UUID or object); object form lets public consumers build URLs without an extra lookup.
- `DynamicFieldInput.RELATION` now renders a preview tile (content-type tag, slug, id) + Change / Remove buttons, matching the MEDIA field UX.

**Per-key CORS allowlist + rate limiting · shipped**
- `ApiKey` model extended: `allowedOrigins String[]` (empty = any origin) and `rateLimitPerMinute Int @default(60)`. Requires `bun run db:migrate` to apply.
- Admin can set both at create time and update later via `PATCH /sites/:siteId/api-keys/:apiKeyId`. Origins validated as full URLs (no paths).
- Middleware (`api-key.middleware.ts`) now enforces both:
  - Origin gate: if `allowedOrigins` is non-empty and request `Origin` header doesn't match, return 403 (`ORIGIN_NOT_ALLOWED`). When it does match, `Access-Control-Allow-Origin` is overridden to the specific origin (replacing the upstream wildcard) so browsers accept the response. Server-to-server requests (no Origin header) are always allowed.
  - Rate limit: in-memory fixed-window limiter (`lib/rate-limit.ts`), per-key budget. On hit returns 429 + `Retry-After`. Always sets `X-RateLimit-Limit / Remaining / Reset` headers, exposed via CORS.
  - In-memory means single-instance only; swap `lib/rate-limit.ts` for a Redis-backed impl when horizontally scaling.
- Admin UI: Create dialog accepts allowed origins (textarea, one per line) + rate limit. New Edit dialog. Table shows origins count + rate limit columns.

**Audit log writes + viewer · shipped**
- `audit.service.ts` (`recordAudit`) wired into mutations across sites, content types, fields, entries, media, members, invitations, and API keys. Every record captures `action`, `entityType`, `entityId`, optional `siteId` / `userId`, and metadata enriched with the request IP + user agent.
- Failures inside `recordAudit` are swallowed so audit issues never block the underlying operation.
- Admin viewer at `/dashboard/audit-log` (super admin) and `/app/:siteId/audit-log` (per-site). Backed by `AuditLogViewer` (`apps/admin/src/features/audit/audit-log-viewer.tsx`) with filter by entity type, action, actor, and date range.

**Public delivery `populate` (field expansion) · shipped**
- `?populate=heroImage,author` expands listed top-level fields; `?populate=*` expands every MEDIA + RELATION field.
- MEDIA fields resolve to the full asset payload (filename, url, mime, sizeBytes, altText, metadata). RELATION fields resolve to `{ id, slug, contentType, publishedAt, updatedAt, data }`.
- One batched lookup per type per request — no N+1. Nested expansion (relations-of-relations) is intentionally not supported in v1 to keep request shapes bounded.
- Lives in `apps/api/src/modules/public/populate.ts` and is called from both list + single-entry routes.

**API Explorer + per-content-type API docs page · shipped**
- New page at `/app/:siteId/content-types/:contentTypeId/api` (component: `apps/admin/src/features/api-explorer/api-explorer-panel.tsx`).
- Renders the exact public delivery URLs for the current content type, ready-to-copy curl commands, and an inline response viewer that exercises a chosen API key against the live endpoint.
- Helps content editors and integrators discover the URL shape per content type without poking at Swagger.

**Site shell layout for non-super-admin users · shipped**
- New `/app/:siteId/...` route family with its own `SiteShellLayout` — separate from the super-admin `/dashboard/sites/:siteId` flow.
- Non-super-admin members land on `/app` (a site picker) or `/app/:siteId` directly when they only have one site. Pages: dashboard, content-type entries, media, members, audit log, API docs.
- Super admin still has the global `/dashboard/sites` overview as before.

**Profile page · shipped**
- `/profile` (any authenticated user) under a dedicated `ProfileLayout`. Edits display name and shows account metadata. Linked from the user menu in the topbar.

**Singleton default slug bug fix · shipped**
- When a singleton entry was created without an explicit slug, it used `contentType.apiId` verbatim — but apiIds use underscores (`home_page`) while the slug schema only accepts hyphens (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`). Result: future PATCHes failed with "Invalid slug", and `GET /public/v1/.../entries/home_page` returned 400.
- Fix in `apps/api/src/modules/sites/content-entries.service.ts:627`: route the apiId through `slugify()` so the default becomes `home-page`. Old singletons with underscore slugs need to be renamed manually (or re-seeded — `seed-lspmice.ts` does this idempotently for the LSPMICE pilot).

**Preview tokens + draft preview mode · shipped**
- New scope `entries:read-drafts` added to `API_KEY_SCOPES`. Keys are still backwards-compatible — existing `entries:read`-only keys behave exactly as before.
- `PATCH /sites/:siteId/api-keys/:apiKeyId` now accepts `scopes`, so the draft scope can be granted/revoked on an existing key without rotating the plaintext.
- Public delivery list + single-entry routes accept `?preview=1` (also `true` / `yes`). When set:
  - If the key lacks `entries:read-drafts` → 403 `API_KEY_SCOPE_REQUIRED`.
  - Status filter widens from `PUBLISHED` to `IN (DRAFT, PUBLISHED)`.
  - Cache-Control switches to `no-store` (no proxy caching of unpublished work).
  - Relation expansion in `populate.ts` honors the same widening so previewed entries see previewed relations.
- Admin UI: Create + Edit dialogs gain an "Allow draft preview" checkbox. The table shows a yellow "Preview" badge next to the status for any key carrying the draft scope.

**LSPMICE pilot seed · shipped**
- `apps/api/prisma/seed-lspmice.ts` (script `bun run db:seed:lspmice`). Idempotent — re-runnable without duplication.
- Provisions the `lspmice` site, owner membership for the super admin, 8 content types matching the existing `lspmice/src/data/*.ts` schemas (`site_settings`, `home_page`, `about_page` as singletons; `assessor`, `certification_scheme`, `certificate_holder`, `news_post`, `gallery_album` as collections), populates the three singletons + 11 assessor entries with real data lifted from the LSPMICE Next.js repo, and mints a default `lspmice-web` API key (only if no active key with that name already exists, so re-running doesn't invalidate the website's current credential).

**Still next:**
- Validation rule builder UI (min/max/regex) in the field editor (still raw JSON).
- Image transforms variants beyond what's shipped (e.g. Cloudflare Images, upload-time variants).
- LSPMICE website integration — replace the hard-coded `lspmice/src/data/*.ts` with fetches against `/public/v1/...`.
- Backfill seed data for the remaining LSPMICE collections (25 certification schemes, certificate holders, news, gallery albums) — currently expected to be authored via the admin UI.
- Sync `apps/admin/.env.example` (lists port 3000) with the actual API port 4000.

## Design System

Light-first, soft-shadow palette inspired by Resend / Stripe. Indigo accent (`#4f46e5` / `#818cf8` in dark), neutral zinc surfaces, Inter for everything, monospace (`ui-monospace`) for labels and ticker chrome.

- Theme switching is class-based via `next-themes` (`attribute="class"`, `defaultTheme="system"`). The `ThemeToggle` (`components/app/theme-toggle.tsx`) lives in the topbar.
- Design tokens live in `apps/admin/src/index.css`:
  - `--narah-accent`, `--narah-bg`, `--narah-surface`, `--narah-border`, `--narah-text*`.
  - Soft elevation: `--narah-shadow-xs / sm / md / lg`.
  - shadcn tokens (`--background`, `--foreground`, `--primary`, etc.) re-pointed at the Narah palette.
- Login (`/login`) uses a full-bleed motion stage: drifting dot-grid + ambient gradient mesh (`.narah-auth-stage`) behind a centered card.
- Dashboard shell: fixed 240px sidebar (workspace label + flat nav), sticky topbar with theme toggle + user menu, content max-width 1280px.
- Legacy `.narah-glass-panel` / `.narah-solid-panel` / `.narah-muted-surface` / `.narah-gradient-border` classes are kept and re-skinned to the new neutral palette so the not-yet-redesigned pages (Sites, SiteDetail, ContentTypeBuilder, AcceptInvitation, PolicyAcceptance) continue to render coherently until they get their own pass.
