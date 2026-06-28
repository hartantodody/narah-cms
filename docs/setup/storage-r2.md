# Cloudflare R2 setup

Walkthrough for pointing Narah's media uploads at Cloudflare R2. Total
time: ~15 minutes if it's your first time.

> **Tail risk worth knowing.** Cloudflare is on Komdigi's PSE-registration
> pressure list. If Cloudflare doesn't comply, R2 access from Indonesia
> could be cut. Dialogue is ongoing and Cloudflare has signalled
> compliance. If zero downtime is non-negotiable, use [Backblaze B2](./storage-b2.md)
> instead.

## Why R2

- **$0 egress** — your bill stays predictable no matter how busy the
  public site gets.
- **Edge-native** — files served from Cloudflare's CDN, no extra setup.
- **Generous free tier** — 10 GB storage + 1M Class A ops + 10M Class B
  ops per month, forever.

---

## 1. Sign up for Cloudflare

1. Open <https://dash.cloudflare.com/sign-up>.
2. Register with your work email and verify the confirmation email.
3. After login, the left sidebar should show **R2 Object Storage**.

## 2. Enable R2 (one-time per account)

R2 must be explicitly enabled. Cloudflare asks for billing details even
on the free plan — only for overage protection. You won't be charged
unless you exceed the free quota.

1. Sidebar → **R2 Object Storage** → **Purchase R2 Plan**.
2. Choose the free tier and add a payment method.
3. After activation, you can create buckets.

## 3. Create two buckets — dev and prod

Separate buckets keep dev uploads from polluting production media.

1. R2 dashboard → **Create bucket**.
2. Name: `narah-dev` (then repeat with `narah-prod`). Bucket names are
   global — pick something unique if those are taken.
3. **Location:** `Automatic` (Cloudflare picks an optimal region). For
   Indonesian visitors, APAC is typical.
4. **Default storage class:** `Standard`.

Example names: `narah-dev`, `narah-prod`.

## 4. Enable public access

By default R2 buckets are private. Two ways to expose:

| Mode | When to use |
|---|---|
| `r2.dev` subdomain | Dev only — easy, but **rate-limited**, not for prod. |
| Custom domain (CNAME via Cloudflare DNS) | Production. Required for serving real traffic. |

1. Open the bucket → **Settings** tab → **Public Access** section.
2. **Dev quick path:** Enable **R2.dev subdomain**. Copy the public URL
   — looks like `pub-abc123.r2.dev`.
3. **Prod recommended:** Add a **Custom Domain** like
   `media.yoursite.com`. Cloudflare automatically sets up the CNAME and
   TLS for you when the zone is on Cloudflare.

> **Warning.** `r2.dev` URLs have aggressive rate limits and are not
> for production traffic. Use a custom domain for the prod bucket.

## 5. Create an API token

This is the credential Narah uses to upload/read objects. Treat it
like a password.

1. R2 dashboard sidebar → **Manage R2 API Tokens** → **Create API Token**.
2. **Permissions:** `Object Read & Write`.
3. **Specify bucket:** scope to the dev bucket (create a separate token
   for prod later — never share one token across dev + prod).
4. **TTL:** `Forever` (or rotate every 90 days if you want).
5. Copy the **Access Key ID** and **Secret Access Key** shown — they
   appear ONCE.

> **Critical: save the keys now.** Cloudflare will not show the Secret
> Access Key again. If you close the page, regenerate the token.

## 6. Find your Account ID

Needed to build the R2 S3 endpoint URL.

1. Open any zone in the Cloudflare dashboard → the right sidebar shows
   **Account ID**.
2. Or: R2 dashboard → top-right account selector → Account ID is
   displayed.

**Account ID format:** `abc123def456...` (32 hex chars).

**Endpoint pattern:** `https://<account-id>.r2.cloudflarestorage.com`.

## 7. Configure the API

Edit `apps/api/.env` (copy from `.env.example` if missing):

```env
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=abc123def456...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=narah-dev
R2_PUBLIC_BASE_URL=https://pub-abc123.r2.dev
```

- `R2_PUBLIC_BASE_URL` must match what you set up in step 4 — `r2.dev`
  subdomain or your custom domain — **no trailing slash**.

For prod, use a separate `.env` (or env vars in your process manager)
with `R2_BUCKET=narah-prod` + the prod token + custom domain.

## 8. Restart and verify

```bash
cd apps/api
bun run dev
```

1. Open the admin → Media library on any site.
2. Upload a small image.
3. Check the bucket file list in the Cloudflare R2 dashboard — the
   file should appear within a second.

---

## Troubleshooting

### 403 "InvalidAccessKeyId" or signature error

Wrong Access Key or Secret. Regenerate the token in R2 dashboard →
Manage API Tokens. Confirm the token has **Object Read & Write** and is
scoped to the right bucket.

### Uploads succeed but images 404 on the public site

Public access isn't enabled, or `R2_PUBLIC_BASE_URL` is wrong. Open the
bucket → Settings → Public Access; enable r2.dev or attach a custom
domain, then copy the URL exactly (no trailing slash).

### `r2.dev` URL works locally but rate-limits in production

Expected — `r2.dev` is dev-only. Move to a Custom Domain (CNAME via
Cloudflare DNS) and update `R2_PUBLIC_BASE_URL`.

### `"missing env vars: R2_ACCOUNT_ID"` on startup

`STORAGE_DRIVER=r2` needs ALL of `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` set. Check
the error log for the specific missing field.

### Sudden 503 / Connection refused from Indonesian visitors

Worst case — Cloudflare actually got blocked by Komdigi. Switch
`STORAGE_DRIVER` to `s3` (Backblaze B2 fallback per [storage-b2.md](./storage-b2.md))
and mirror existing objects (rclone works fine). Adapter is provider-
agnostic so the switch is fast.
