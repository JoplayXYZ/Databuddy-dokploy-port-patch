# Dashboard E2E plumbing

This folder contains the local DB/session plumbing used by future dashboard E2E tests.

## Isolated database

Use `run-local.sh` to create a per-run Postgres database, push the Drizzle schema into it, run a command, and drop the database on exit:

```bash
bun run --cwd apps/dashboard test:e2e:local

# Or run an arbitrary command inside the isolated DB env:
apps/dashboard/test/e2e/run-local.sh bun run --cwd apps/dashboard dev
```

Set `DATABUDDY_E2E_KEEP_DB=1` to keep the database for debugging.

## Session bootstrap

When `DATABUDDY_E2E_MODE=1` and `DATABUDDY_E2E_TEST_KEY` is set, tests can create a signed-in user via:

```http
POST /api/test/e2e/session
x-e2e-test-key: <DATABUDDY_E2E_TEST_KEY>
content-type: application/json

{
  "runScope": "local-run",
  "testScope": "api-key-delete",
  "withWebsite": true
}
```

The route returns `userId`, `organizationId`, and optionally `websiteId`, and forwards Better Auth `Set-Cookie` headers so browser tests can start authenticated. Outside E2E mode, the route returns `404`.
