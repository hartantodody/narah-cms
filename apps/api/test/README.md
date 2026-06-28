# Integration tests

Bun-native test runner against a real Postgres + the actual Express app
booted on an ephemeral port. No mocking of the DB or HTTP layer — these
tests catch regressions in routing, middleware order, validation, RBAC,
and Prisma queries together.

## One-time setup

1. **Create a throwaway test database.** Reuse the docker Postgres on
   port 5433 — just create a second database next to `narah_cms`:

   ```bash
   docker exec -it narah-cms-postgres psql -U narah -c "CREATE DATABASE narah_cms_test;"
   ```

2. **Export the test DB URL.** Either put it in `apps/api/.env`:

   ```env
   TEST_DATABASE_URL=postgresql://narah:narah@localhost:5433/narah_cms_test?schema=public
   ```

   …or export it in your shell session.

3. **Run migrations against it once.** The seed is NOT required — tests
   create their own users / sites.

   ```bash
   cd apps/api
   DATABASE_URL=$TEST_DATABASE_URL bun run db:migrate
   ```

   Re-run that command whenever the schema changes.

## Running

```bash
cd apps/api
bun test                 # all tests
bun test auth            # only auth.test.ts
bun test content         # only content.test.ts
bun test --watch         # rerun on save
```

Tests TRUNCATE all tables in `beforeEach`. Never point
`TEST_DATABASE_URL` at a database that has data you care about.

## What's covered

See `docs/qa/auth-and-content.md` for the full scenario matrix. The
automated tests cover the **happy paths + the critical edges that are
cheap to script**:

- **auth.test.ts**: register/login/me, wrong-password, user enumeration
  protection, inactive user, change-password (full lifecycle), policy
  acceptance, request-ID propagation.
- **content.test.ts**: site creation + ownership, content-type CRUD +
  apiId collisions, field validation (SELECT options), entry CRUD,
  publish/unpublish, version bumping (no-op vs change), revision
  pruning to last 10, restore-as-rewind semantics.

The following are deliberately **not** in the automated suite — verify
them by hand from `docs/qa/auth-and-content.md`:

- Rate limit triggering (per-IP windows make this slow/flaky to assert)
- Email/UI flows for invitation acceptance
- Graceful shutdown signals
- Public delivery API + API-key auth (separate suite once we add it)
