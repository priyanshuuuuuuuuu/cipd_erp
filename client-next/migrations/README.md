# Database migrations (college VM PostgreSQL)

The database is `cipd` on the VM. Each cohort is a PostgreSQL schema; shared registry/identity tables live in `core`.
**Never run `drizzle-kit push/generate/migrate`** – it is disabled. All schema changes are SQL files applied by
`npm run migrate` (`scripts/migrate.mjs`).

```
migrations/core/NNNN_name.sql     applied once, to the `core` schema
migrations/cohort/NNNN_name.sql   applied once to EVERY cohort schema (public, july, junedecember2026, any new cohort)
migrations/archive/               historical, never run
```

## Rules for writing a migration
1. Name it `NNNN_short_name.sql` with the next free four-digit number. **Never edit a migration after it has been applied** –
   the runner stores a sha256 checksum and aborts if it changed. Add a new one instead.
2. It must be idempotent (`IF NOT EXISTS`, guarded `DO $$ ... $$` blocks) and must not contain Supabase roles.
3. Cohort migrations are written without a schema qualifier. The runner runs each (cohort, file) in one transaction with
   `SET LOCAL search_path TO "<schema>", core` and substitutes `{{schema}}` (quoted identifier),
   `{{schema_literal}}` (quoted string) and `{{cohort_id}}` (number). Use them in dynamic SQL and function bodies.
4. Legacy cohorts (`core.cohorts.is_legacy`) must keep their data exactly as it is. Guard anything destructive.
5. Test on a copy first: `pg_dump -Fc` production, restore into a scratch database, run `npm run migrate -- --url <scratch>`.
   Then run `node scripts/check-schema-drift.mjs --url <scratch>`; it must pass.

## Commands
```bash
npm run migrate                          # core, then every cohort (running / archived / provisioning)
npm run migrate -- --dry-run             # list what would run
npm run migrate -- --cohort junedecember2026
npm run migrate -- --mark-applied 0001 --cohort <schema>    # record as applied WITHOUT running (baseline adoption)
npm run drift                            # compare every cohort with the newest running one
```
`npm run migrate` is run by the deploy workflow before the app is restarted, followed by `npm run drift`.
A failure in one cohort is logged and the others continue; the exit code is non-zero.

Existing cohorts that already have a `users` table are adopted at `0001_baseline` automatically (recorded with
`executed = false`). A brand-new cohort runs `0001_baseline`, `0002_reconcile`, ... in order.

## Ledger
`core.schema_migrations (scope, version, checksum, applied_at, executed)`; scope is `core` or the cohort schema name.
`core.cohorts.schema_version` holds the latest version applied to each cohort.

## Emergency: a migration failed for one cohort
The failing transaction is rolled back, so the cohort stays at its previous version and keeps working.
Fix the migration **before it has been applied anywhere** (editing is only safe then), or add a corrective migration,
and run `npm run migrate` again.

## Deleting a cohort
There is no HTTP delete. Use `node scripts/cohort-delete.mjs --cohort <schema> --confirm <schema>` (takes a pg_dump
backup first; refuses legacy, default and running cohorts).
