# Storage setup

Narah CMS stores uploaded media (images, PDFs, etc.) via a pluggable
adapter. One storage backend is configured per API instance via env
vars — choose once at deploy time. End users have no control over this
from the admin UI.

## Drivers

| `STORAGE_DRIVER` | Use case |
|---|---|
| `local` | Dev only. Files written to `STORAGE_LOCAL_DIR`. Don't use in prod. |
| `s3` | Any S3-compatible: Backblaze B2, AWS S3, MinIO, DO Spaces, Wasabi. |
| `r2` | Cloudflare R2 (legacy convenience — internally same adapter as `s3`). |

The `s3` and `r2` drivers share one underlying [`S3StorageAdapter`](../../apps/api/src/lib/storage/s3-adapter.ts) — they differ only in which env vars are read.

## Decision matrix

For the Narah pilot (LSP MICE, Indonesian audience):

| Factor | Cloudflare R2 | Backblaze B2 |
|---|---|---|
| Storage cost | $0.015/GB (free 10 GB) | $0.006/GB (free 10 GB) |
| Egress cost | **$0** | $0.01/GB (free 3× monthly storage) |
| Edge / CDN | Native (Cloudflare) | Pair with Cloudflare CDN via Bandwidth Alliance ($0 egress, more setup) |
| Spend cap | No hard limit (rely on free quotas) | Daily cap configurable in dashboard |
| Indonesia regulatory risk | **Tail risk** — Cloudflare on Komdigi PSE pressure list. Could be blocked if Cloudflare doesn't comply. | None known |
| Setup complexity | Simple (account ID + token) | Slightly more (endpoint includes region) |
| Best for | High-traffic visitor-facing media | Archive-heavy / low-traffic / cost-sensitive |

**Recommendation for current pilot:** Cloudflare R2.
- Egress is $0 so the bill stays predictable as the client grows.
- Edge-native serving = best UX without us doing extra config.
- Komdigi situation is real but Cloudflare is in active dialogue and
  much of the Indonesian government runs on Cloudflare → political
  cost of blocking is high. Acceptable tail risk for v1.
- If R2 ever goes dark, the S3 adapter lets us swap to B2 in minutes.

**Fall back to B2 if:** the client demands zero regulatory risk, or
traffic is predictably low and storage cost dominates.

## Setup walkthroughs

- [Cloudflare R2](./storage-r2.md) — 8 steps, includes r2.dev quick path + custom domain for prod
- [Backblaze B2](./storage-b2.md) — 6 steps

## After setup

1. Restart the API (`bun run dev` in dev; systemd/pm2 restart in prod).
2. Open the admin Media library on any site and upload a small image.
3. Confirm the file appears in the bucket's web console.
4. If anything fails, check the provider-specific troubleshooting
   sections at the bottom of each walkthrough.

## Migrating between providers

Because both drivers go through the same `S3StorageAdapter`:

1. Set up the new bucket and credentials.
2. Mirror existing objects from old → new bucket (use `rclone` or the
   provider's import tool — we don't ship a script for this yet).
3. Update env vars: `STORAGE_DRIVER` + the `*_BUCKET` / `*_ENDPOINT` /
   `*_PUBLIC_BASE_URL` set.
4. Restart the API. Existing `MediaAsset.url` rows still point at the
   old base URL — either rewrite them in SQL or keep the old domain
   serving until you've backfilled.
