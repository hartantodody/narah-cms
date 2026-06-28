# Future task — Per-site visitor analytics

**Status**: deferred (post core features)
**Provider chosen**: Google Analytics 4 (GA4)
**Auth model**: Service Account JSON (per-site upload)
**Chart library**: Recharts

## Why GA4 + Service Account

- Most clients already use GA4 — familiar property + measurement IDs
- Service Account avoids OAuth client registration per deployment, no token refresh logic, no expiring credentials. Setup is technical (GCP Console hop) but Narah is freelancer-managed → operator handles it once per client
- OAuth could be added later as an alternative if smoother UX becomes a priority

## Scope

### Database

New table `SiteAnalyticsConfig`:

| field | type | notes |
|---|---|---|
| `id` | uuid | pk |
| `siteId` | uuid | fk → `Site.id`, **unique** (1:1) |
| `provider` | enum | `GA4` (single value for now, future-proof) |
| `propertyId` | string | GA4 numeric property id (e.g. `123456789`) — used by the Data API |
| `measurementId` | string | GA4 measurement id (e.g. `G-XXXXXXXXXX`) — displayed in the install snippet |
| `credentialsEncrypted` | text | Service Account JSON, encrypted at rest with `ENCRYPTION_KEY` env var |
| `connectedAt` | datetime | first successful save |
| `lastTestedAt` | datetime? | last successful `POST /test` call |

### API endpoints

All scoped under `/sites/:siteId/analytics`. Authorization: OWNER + ADMIN only (super admin always).

| method | path | purpose |
|---|---|---|
| `GET` | `/config` | Return config with `credentialsEncrypted` masked. Also returns `isConnected` boolean. |
| `PUT` | `/config` | Save / update `propertyId`, `measurementId`, and credentials. Re-encrypts on every write. |
| `DELETE` | `/config` | Disconnect — wipes credentials. |
| `POST` | `/test` | Calls GA Data API once with smallest possible request. Returns `{ ok, errorCode? }`. Updates `lastTestedAt` on success. |
| `GET` | `/report?range=7d\|30d\|90d&metric=visitors\|sessions\|pageviews` | Fetch metrics. **Server cache 5 min** per `(siteId, range, metric)` tuple. |

### Backend deps

- `@google-analytics/data` — official GA4 Data API client
- Encryption: reuse existing crypto setup OR add `crypto.createCipheriv` (AES-256-GCM) with `ENCRYPTION_KEY` (32-byte base64 env var)
- Add a `SiteAnalyticsService` module in `apps/api/src/modules/analytics/`

### Frontend

- Install `recharts`
- **Site Settings page** (`/s/:siteId/settings`) — new section "Analytics":
  - Form: `propertyId` + `measurementId` + paste box for Service Account JSON
  - "Test connection" button → calls `POST /test` → toast result
  - When connected: show install snippet (`gtag.js` with the measurement ID) in a copy-to-clipboard block — user pastes into their public site's `<head>` themselves
  - "Disconnect" button
  - Status badge: `Connected ✓` / `Not connected` / `Connection failed`
- **Site Dashboard** (`/s/:siteId`) — new section "Visitors":
  - Range selector: 7d / 30d / 90d (small segmented control)
  - Big number: unique visitors in range, delta vs prev period
  - Line chart (Recharts): daily visitors over range
  - Top 5 pages table by pageviews
  - Empty state when not connected → CTA link to Site Settings

## Operator setup checklist (for the client's GA property)

1. Open GCP Console, create or pick a project
2. Enable "Google Analytics Data API" on that project
3. Create Service Account, role: none needed inside GCP
4. Generate JSON key, download (~5 KB)
5. Open GA4 Admin → Property Access Management → Add user
6. Paste the service account email (looks like `xxx@xxx.iam.gserviceaccount.com`), assign **Viewer** role
7. Copy the GA4 property id (Admin → Property Settings → top of the page)
8. Paste both JSON + property id into Narah Site Settings → Analytics

## Things deliberately out of scope

- Real-time visitor count (GA Realtime API) — phase 2 if requested
- Multi-property aggregation (one Narah site mapping to N GA properties) — unlikely use case
- OAuth flow — keep deferred unless Service Account UX proves too painful
- Goal/conversion tracking, e-commerce events — not a CMS concern
- Cookie consent banner in the installed snippet — user's responsibility on their public site
- Building our own first-party analytics pipeline — separate product

## Rough effort estimate

~3-5 days end-to-end:

- 0.5 day: DB migration + encryption helper
- 1 day: API endpoints (`config`, `test`, `report` with cache)
- 0.5 day: Service Account validation + GA Data API call wiring
- 1 day: Site Settings form section
- 1 day: Site Dashboard visitor chart + range selector
- 0.5 day: empty / error / loading states, copy polish

## Pickup pointers when this task starts

- `apps/api/prisma/schema.prisma` — add `SiteAnalyticsConfig` model with a unique index on `siteId`
- `apps/api/src/lib/` — add `encrypt.ts` if not present
- `apps/api/src/modules/analytics/` — new module mirroring the layout of `modules/sites/`
- `apps/admin/src/features/analytics/` — feature folder for the dashboard section + settings form
- `apps/admin/src/pages/site-settings-page.tsx` — currently a stub; this is where the analytics form lands
- `apps/admin/src/pages/site-detail-page.tsx` — overview page; visitor section goes here
