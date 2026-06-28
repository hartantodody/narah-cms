# Backblaze B2 setup

Walkthrough for pointing Narah's media uploads at Backblaze B2 —
cheapest mainstream S3-compatible provider, no Komdigi pressure list
exposure. Total time: ~10 minutes.

## Why B2

- **Cheapest of the major providers** — storage $0.006/GB, free 10 GB
  tier covers most pilots at $0.
- **S3-compatible API** — swapping to AWS S3 / MinIO / DO Spaces later
  is just an env-var change (same adapter).
- **No Indonesian regulatory pressure** — not on Komdigi's PSE list.

Trade-off vs R2: $0.01/GB egress (free 3× monthly storage). For
visitor-facing media at scale, R2's free egress wins; for archive-heavy
or low-traffic, B2 is cheaper end-to-end.

---

## 1. Sign up for Backblaze

1. Open <https://www.backblaze.com/sign-up/cloud-storage>.
2. Free account, no credit card required for the free tier.
3. Verify your email — Backblaze blocks bucket creation until you do.
4. Sign in to the dashboard. Look for the **B2 Cloud Storage** section
   in the left sidebar.

## 2. Create two buckets — dev and prod

Separate buckets keep development uploads from polluting production
media.

1. **Buckets** → **Create a Bucket**.
2. **Bucket Unique Name:** pick something globally unique (bucket
   names are public). Example: `narah-dev` and `narah-prod`.
3. **Files in Bucket are:** `Public` (we serve images via public URLs).
4. **Default Encryption:** enable Server-Side Encryption (free).
5. Repeat for the prod bucket.

## 3. Generate an Application Key

This is the credential the CMS uses to read/write objects. Treat it
like a password.

1. Left sidebar → **Application Keys** → **Add a New Application Key**.
2. **Name:** e.g. `narah-dev-key`.
3. **Allow access to:** only the dev bucket (one key per bucket is
   safer).
4. **Type of Access:** `Read and Write`.
5. Leave file name prefix and lifetime empty.
6. Click **Create New Key**. Copy the `keyID` and `applicationKey`
   shown — they appear ONCE.

> **Critical: save the key now.** Backblaze will not show the
> `applicationKey` again. If you close this page without copying, you
> have to delete the key and create a new one.

## 4. Note your endpoint, region, and public URL

Backblaze shows these in the bucket details. The region is part of the
endpoint.

1. Open the bucket → look at the **Endpoint** row, e.g.
   `s3.us-west-004.backblazeb2.com`. The `us-west-004` part is the
   region.
2. Look at the **Friendly URL** row — that's the public base URL.

**Examples:**

| Field | Value |
|---|---|
| Endpoint | `https://s3.us-west-004.backblazeb2.com` |
| Region | `us-west-004` |
| Public URL | `https://f004.backblazeb2.com/file/narah-dev` |

## 5. Configure the API

Edit `apps/api/.env` (copy from `.env.example` if missing):

```env
STORAGE_DRIVER=s3
S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
S3_REGION=us-west-004
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=narah-dev
S3_PUBLIC_BASE_URL=https://f004.backblazeb2.com/file/narah-dev
```

- `S3_PUBLIC_BASE_URL` must match the bucket's Friendly URL exactly —
  no trailing slash.
- Don't use `region=auto` with B2 — the SDK needs the exact region
  string or signatures fail.

For prod, use a separate `.env` (or process-manager env) with
`S3_BUCKET=narah-prod` + the prod key.

## 6. Restart and verify

```bash
cd apps/api
bun run dev
```

1. Open the admin → Media library on any site.
2. Upload a small image.
3. Check the bucket file list in Backblaze — the file should appear
   within a second.

---

## Troubleshooting

### `"InvalidAccessKeyId"` or 403 on upload

The `keyID` or `applicationKey` is wrong, or the key was scoped to a
different bucket. Verify the key in Backblaze → Application Keys, and
confirm the bucket name matches `S3_BUCKET`.

### Uploads succeed but images don't load on the public site

`S3_PUBLIC_BASE_URL` is wrong, or the bucket is set to Private. Open
the bucket in Backblaze, confirm Files in Bucket = `Public`, and copy
the Friendly URL exactly.

### `"SignatureDoesNotMatch"` error

Region mismatch. The region must match the endpoint exactly (e.g.
endpoint `s3.us-west-004.backblazeb2.com` → region `us-west-004`).
Don't use `auto` with Backblaze.

### API won't start — `"missing env vars"`

`STORAGE_DRIVER=s3` needs ALL of `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL` set. Check
the error log for the specific missing field.
