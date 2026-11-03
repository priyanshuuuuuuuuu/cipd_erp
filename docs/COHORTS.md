# Cohorts: how they work and how to operate them

## Model in one minute
- The database is `cipd` on the college VM (PostgreSQL 16). **Each cohort is a PostgreSQL schema** (`public` = "Winter 2026",
  `july`, `junedecember2026`, ...). Sessions, attendance, feedback, courses and the per-cohort copy of each person live there.
- The schema `core` holds what is shared and decides everything else:
  - `core.cohorts`: the registry (label, dates, **status** `provisioning | running | archived | failed | deleting`, **default** flag, **legacy** flag)
  - `core.accounts`: one row per **person** (one email, one password). Old duplicates of the same person are aliases (`merged_into`)
  - `core.cohort_memberships`: which person belongs to which cohort and in what state (`active | completed | transferred_out | withdrawn`)
  - `core.programs`, `core.schema_migrations`, `core.account_conflicts`
- The database enforces the rules: a `users` row in a cohort schema cannot exist without a membership **in that cohort**
  (composite foreign key + CHECK), and a membership cannot point at a missing cohort or person.
- The API never trusts the browser for the cohort. The `x-cohort` header is only a *preference*; the server resolves the cohort
  from the person's memberships (admins: any running/archived cohort). **Archived cohorts are read-only** at the API (HTTP 409).
- Students log in once. Their JWT identifies the person, not a cohort.

## Day-to-day (Admin UI)
| Task | Where |
|---|---|
| Create a cohort | Sidebar switcher > **New cohort** (or Admin > Cohorts > New cohort) |
| Edit label / program / dates | Admin > Cohorts > Edit (the schema name never changes) |
| Make a cohort the default (new sign-ups, background jobs, landing cohort) | Admin > Cohorts > Make default |
| Archive / un-archive | Admin > Cohorts > Archive. Archiving marks active members `completed` |
| Retry a failed creation | Admin > Cohorts > Retry (status `failed` shows the error) |
| Add a student | Admin > Student Management > Add Student. The **cohort** (running ones only) and **program** are dropdowns |
| Move a student to another cohort | Student drawer > Cohort membership > Transfer. History stays in the old cohort |
| Remove a student from a cohort but keep data | Withdraw |
| Delete a student's data in a cohort | Delete, then type the student's email. Irreversible |

New cohorts are built from the versioned migrations (`client-next/migrations/cohort/*.sql`), never by copying another
cohort's tables. "Reference cohort" only supplies courses, categories, skills, session types, venues, settings, feedback
questions and the active faculty.

## Deleting a cohort (deliberately not in the UI)
```bash
cd client-next
node scripts/cohort-delete.mjs --cohort <schema> --confirm <schema>
```
Refuses legacy (`public`, `july`), default and running cohorts. Takes a `pg_dump` backup into `BACKUP_DIR` first and aborts if
it is empty. Needs `pg_dump` on the PATH (or `PG_DUMP=/path/to/pg_dump`).

## Changing the schema (adding a migration)
See `client-next/migrations/README.md`. In short: add `migrations/cohort/NNNN_name.sql` (or `core/`), idempotent, with
`{{schema}}` placeholders; test on a restored copy; `npm run migrate`; `npm run drift` must pass. The deploy workflow runs both
before restarting the app. **Never edit a migration that has been applied.**

## Wi-Fi attendance and Supabase (the only remaining Supabase use)
The Wi-Fi scanner runs on a separate network that cannot reach the VM, so it writes `public.wifi_snapshots` to a Supabase
cloud project. The ERP **only reads** that table, through one server-only module, `client-next/lib/wifi-snapshots.js`:
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server env, never `NEXT_PUBLIC_`). If Supabase is unreachable the module throws,
attendance processing **skips** the session (it is retried on the next cron run) instead of marking everybody absent, and the
read-only Wi-Fi pages return HTTP 503. Gaps in snapshots (the scanner was off) are expected and are not an error.
`RouterCodesForAttendance/` and the Supabase table are untouched by this work.

## Files
Uploaded materials and submissions are stored on the VM under `STORAGE_DIR/<bucket>/<cohort schema>/...` (default
`/var/lib/cipd/uploads`; create it and give the PM2 user write access). They are only served through
`/api/files/...?t=<signed token>` (1 hour, bound to bucket, key and cohort).

## Notifications
`notification-service/` reads the VM database and serves **every running cohort**. See its README. Keep
`NOTIFICATION_SANDBOX_MODE=true` until the backlog has been reviewed (`scripts/expire-stale.mjs`).

## Database role
The app should not run as `postgres`. `client-next/scripts/create-app-role.mjs` creates `cipd_app` (non-superuser), makes it the
owner of `core` and every cohort schema, and prints the SQL first (dry run by default). Then point `DATABASE_URL` at it for the
app and the notification service.

## First deployment of this change (runbook)
Do these in order, on the VM, and keep the backup.
1. `pg_dump -Fc -d cipd -f cipd_<date>_pre_cohorts.dump` (and test a restore into a scratch database).
2. Deploy **notification-service** and storage settings first if you want the backlog handled before anything else (Phase 1 is independent).
3. `cd client-next && node scripts/migrate.mjs --dry-run` and read what it would do.
4. `npm run migrate`. The `core` migrations apply (registry, ledger, accounts tables), the three existing cohorts are adopted at
   `0001` and receive `0002_reconcile`, and each cohort then **stops at `0003`** with "users row(s) have no membership".
   That failure and the non-zero exit code are expected until the backfill has run; nothing is half-applied.
5. `node scripts/backfill-identity.mjs` (dry run). **Review `core.account_conflicts`-to-be: the email-split cases it prints.**
   Then `node scripts/backfill-identity.mjs --apply`.
6. `npm run migrate` again: `0003` now applies. Run `node scripts/backfill-identity.mjs --apply` once more (fills `students.program_id`).
7. `npm run drift` must pass. Then deploy the app (the GitHub workflow runs migrate + drift before `pm2 restart`).
8. Smoke test: log in as an admin, as a current student and as a student who only belonged to `public`; open Wi-Fi Logs and Live Students.
9. Later, once verified: `DROP TABLE public.cohorts` (legacy registry; nothing reads it any more), create `cipd_app`, rotate the
   Supabase service key, and have the owner remove the old ERP tables from the Supabase project (keep only `wifi_snapshots`).

## Verifying isolation (staging only)
`client-next/scripts/test-cohort-isolation.mjs` creates its own cohort/admin/student and checks: provisioning, drift, required
`cohort_id`, 422 for missing/archived cohorts, the membership FK, header-vs-membership resolution, one password, transfer,
read-only archived cohorts, no schema fall-through, and the delete CLI. Run it against a **restored copy** with the app started
on that copy (`STAGING_DATABASE_URL`, `APP_URL`). It refuses to run if `STAGING_DATABASE_URL` equals the production URL in `.env`.
