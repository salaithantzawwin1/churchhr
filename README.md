# Church Member Registry

Member, household, pastor and organisation registry for the church, served as one
Cloudflare Worker (Hono + Drizzle ORM on D1). Every page is server-rendered; there
is no client framework and no separate API service.

## Stack

- **Runtime:** Cloudflare Workers (`src/index.tsx`, `wrangler.jsonc`)
- **Database:** D1 (`church-members-db`), schema owned by `migrations/`
- **ORM:** Drizzle (`src/db/schema.ts`, `src/db/client.ts`)
- **UI:** Hono JSX views (`src/views/`), strings in Myanmar / English / Korean (`src/i18n*.ts`)
- **Tests:** Vitest in real workerd with a local D1 (`test/`), plus plain Node
  tests over repository files (`checks/`)

## Local setup

Requires Node 22 and the npm lockfile's dependency versions.

```bash
npm ci
npm run db:local     # apply all migrations to the local D1
npm run dev          # wrangler dev on http://127.0.0.1:8787
```

The seeded administrator is `admin` / `admin123` and is flagged to change its
password on first sign-in. Local data lives under `.wrangler/` (git-ignored); delete
that directory to start from an empty database and re-run `npm run db:local`.
`db:local` asks for confirmation when run from a terminal and skips the prompt in
CI.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local Worker + D1 (`wrangler dev`) |
| `npm run typecheck` | `tsc --noEmit` over `src/` |
| `npm test` | All Vitest projects (worker, migration, repo) |
| `npm run build` | `wrangler deploy --dry-run`, writes `dist/` |
| `npm run assets:version` | Regenerate the versioned-asset list/digest |
| `npm run db:local` / `db:remote` | Apply pending D1 migrations |

`checks/asset-version.test.ts` fails when `public/app.js` or `public/styles.css`
changed without bumping `ASSET_V`, so run `npm run assets:version` after editing
them. `APP_VERSION` in `src/version.ts` is the release marker `/healthz` reports.

## Tests

- `test/**/*.test.ts` run inside workerd against a real local D1. Every file starts
  from an empty database and applies all migrations, so the suite also proves the
  migration chain applies cleanly.
- `test/migration-data.test.ts` runs separately (its own Vitest project): it builds
  the pre-0040 schema, seeds the legacy rows those migrations were written for,
  then applies 0040 and 0049 and asserts the moves, the pastor reuse, the conflict
  flags and the grade normalisation. Data migrations are irreversible, so keep
  this file in sync whenever one is added.
- `checks/**/*.test.ts` run in Node because workerd cannot read the repository.

## Deployment

GitHub Actions is the only production deploy path:

1. `ci.yml` runs on every pull request (typecheck, tests, production dependency audit).
2. `deploy.yml` runs on a push to `main`: the same gates, then an export of the live
   D1 (kept 14 days as a run artifact), pending migrations, the deploy, and a
   `/healthz` + sign-in smoke check against the live domain.
3. `audit.yml` reports every dependency advisory weekly (never blocks).
4. `uptime.yml` probes `/healthz` and `/login` every 30 minutes and fails on an
   unhealthy response, which notifies the repository's watchers.

Do **not** reconnect Cloudflare Workers Builds to this repository. It deployed the
same commits without any of those gates; `deploy.yml` warns if a Workers Builds
check run appears for a commit.

## Migrations and recovery

Migrations are append-only and irreversible. A new migration means:

1. Write `migrations/00NN_name.sql` (next number, no gaps).
2. Add a test that proves the data change on realistic rows, not just the schema.
3. Run `npm test` and `npm run build`.
4. Push to `main`; `deploy.yml` exports the database before applying anything.

Operational helpers:

- `scripts/pre-0040-check.sql` — read-only pre-flight checks for the org-structure
  migrations (run with `wrangler d1 execute --remote --file=...`).
- `scripts/restore-drill.sh <dump.sql>` — loads a deploy artifact dump into a
  throwaway local D1 and checks row counts and foreign keys. Run it before a risky
  release so the backup is known to work.
- `scripts/rollback-0040.sql` — guarded manual rollback of 0040 only; prefer the
  dump restore, and read the header before running it.

`/healthz` checks the Worker, D1 and the columns this build expects, including the
0043–0049 objects, so deploying ahead of a migration reports `db: "error"` instead
of a false green.

## Password hashing

PBKDF2-SHA256 with the iteration count stored in each hash (`src/auth.ts`). The
configured cost is `PBKDF2_ITERATIONS` in `wrangler.jsonc`; it is kept low for the
Workers Free CPU budget. Raising that value is safe: on the next successful
sign-in an account whose stored hash uses fewer iterations is re-hashed at the new
cost automatically, so no reset is required.
