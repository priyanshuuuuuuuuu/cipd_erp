# Multi-Cohort Implementation Plan (authoritative)

Date: 2026-11-03. Background and evidence are in `HANDOFF_COHORTS_AUDIT.md`. Where the two documents disagree, **this plan wins**: it includes the owner's decisions and the live DB findings.

Audience: the coding model that will implement this. Each phase lists its files, exact actions and acceptance criteria. Paths are relative to `cipd_erp/`.

---

## 0. Ground rules and owner decisions

### Owner decisions (fixed, do not revisit)
1. **The Wi-Fi attendance data stays in Supabase.**
   - The Wi-Fi scanner (`RouterCodesForAttendance/`) runs on a separate network that cannot reach the college VM. It writes to `public.wifi_snapshots` in the Supabase cloud project.
   - The app keeps **reading** snapshots from Supabase.
   - **Do not modify** `RouterCodesForAttendance/`, the Supabase `wifi_snapshots` table, or the way snapshots are fetched (Supabase REST). Only wrap that access (Phase 1A).
   - Verified 2026-11-03: Supabase has live snapshots (latest a few minutes before the check, about 73.5k rows, about one every 3 minutes).
2. **Everything else moves to the VM PostgreSQL** (`192.168.3.190:5432/cipd`, PostgreSQL 16): the notification service, file storage, cohort and identity data, and migrations. No other Supabase usage may remain.
3. **Cohorts:**

   | schema | label | status after this work |
   |---|---|---|
   | `public` | Winter 2026 | `archived`, legacy |
   | `july` | change label to "July 2026" (owner may rename) | **`archived`**, legacy |
   | `junedecember2026` | June-December 2026 | **`running`, default** |

4. **Gaps in Wi-Fi attendance are expected.** The Wi-Fi system was disabled for a while, so periods without snapshots are not a bug.
5. The VM copy `public.wifi_snapshots` (61k rows, last 2026-09-22) is a stale, unused leftover. **Leave its data untouched.** `july.wifi_snapshots` is an empty, unused clone.

### Hard rules for the implementer
- **Never** run `drizzle-kit push`, `drizzle-kit migrate` or `drizzle-kit generate` against any database.
- **Never** delete or rewrite existing rows in `public`, `july` or `junedecember2026` except where a step explicitly says so.
- Before any DDL on the VM, take `pg_dump -Fc -d cipd -f cipd_<date>_pre_<phase>.dump`, and test every migration first on a staging copy: `createdb cipd_staging && pg_restore -d cipd_staging <dump>`. Add `STAGING_DATABASE_URL` to `.env.local` for this.
- Every SQL migration must be idempotent, run inside a transaction, and contain no Supabase roles (`anon`, `authenticated`, `service_role`); those roles do not exist on the VM.
- Use the `postgres` npm package (already a dependency) for all non-Drizzle DB access. Put every dynamic identifier through `qid()` from `client-next/lib/cohorts.js`, after validating it against the registry.
- Commit per phase on a feature branch (`feature/cohorts-core`). Phase order matters: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8**. Phase 1 is urgent and can ship alone.

---

## Phase 1 – Urgent operational fixes (no schema changes)

### 1A. Isolate and harden the Supabase Wi-Fi access (keep Supabase)
Today 9 server files call `supabaseAdmin.schema('public').from('wifi_snapshots')` directly. Errors are ignored: `const { data: snapshots } = …` never checks `error`. In `lib/process-session-attendance.js:158` a Supabase outage therefore gives `snapshots = []`, and the session is processed as if **nobody attended**.

1. Create `client-next/lib/wifi-snapshots.js`. It becomes the **only** module that imports `@supabase/supabase-js`, and it must be server-only: add `import 'server-only'` if the package is available, otherwise a comment plus a runtime check `typeof window === 'undefined'`.
   - Client: `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'public' }, auth: { persistSession:false, autoRefreshToken:false }, global: { fetch: (u,o)=>fetch(u,{...o,cache:'no-store'}) } })`.
   - Env: read `process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   - Export these functions. Each one **throws** `WifiSourceUnavailableError` on a Supabase error, and none of them returns `[]` on failure:
     - `getSnapshotsBetween(startISO, endISO, { columns = 'id, iw_dump, captured_at' } = {})`: ordered ascending, and **paginated** with `.range()` in pages of 1000 until a short page comes back. PostgREST's default `max-rows` of 1000 otherwise truncates results silently.
     - `getLatestSnapshot()`: returns `{ captured_at } | null`.
     - `countSnapshotsBetween(startISO, endISO)`: uses `{ count: 'exact', head: true }`.
     - `getSnapshotsPage({ from, to, offset, limit, columns })`: used by `admin/wifi-logs`.
2. Replace the direct calls in the files below, keeping their filters, ordering and output exactly as they are:
   - `app/api/admin/attendance/session-students/route.js`
   - `app/api/admin/attendance/sessions-by-date/route.js`
   - `app/api/admin/live-students/route.js`
   - `app/api/admin/reports/wifi-slots/route.js`
   - `app/api/admin/wifi-logs/route.js` (it already paginates with `.range`; port it to `getSnapshotsPage`)
   - `app/api/cron/process-attendance/route.js`
   - `app/api/students/attendance/live/route.js`
   - `app/api/students/attendance/presence/route.js`
   - `lib/process-session-attendance.js`
3. Fail-safe in `lib/process-session-attendance.js`: if `getSnapshotsBetween` throws, **do not write any `attendance_records`** for that session. Return `{ skipped: true, reason: 'wifi_source_unavailable' }`, leave the session unprocessed so the next cron run retries it, and log the problem. `cron/process-attendance` should report the skipped sessions in its JSON. Read-only endpoints (live, presence, wifi-logs) return HTTP 503 with `{ error: 'Wi-Fi data source unavailable' }`.
4. Delete `getSchemaClient`, `getCohortConfig`, the anon `supabase` client and `supabaseAdmin` from `client-next/lib/supabase.js`, then delete the file. Nothing else may import `@supabase/supabase-js` (check with `grep -r "supabase" client-next/app client-next/lib`).
5. Remove `wifiSnapshots` and the three `pgView` exports (`adminDashboardSummary`, `facultyMonthlyHours`, `studentAttendanceSummary`) from `client-next/drizzle/schema.ts`. They are unused, and they invite queries against the stale VM copy or the legacy `public` views.
6. Env: add `SUPABASE_URL=` (server-only) to `.env.example`. Remove `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.example` and `.github/workflows/deploy.yml`, so that **no Supabase key is exposed to the browser bundle.** Keep `SUPABASE_SERVICE_ROLE_KEY` (server-only) and label it in comments as "Wi-Fi snapshots only".

**Acceptance:**
- `grep -rn "@supabase/supabase-js" client-next/app client-next/lib` matches only `lib/wifi-snapshots.js`.
- With `SUPABASE_URL` pointed at an invalid host, `GET /api/cron/process-attendance` writes no attendance rows and reports the sessions as skipped.
- Live-students and wifi-logs pages show the same data as before.

### 1B. Move the notification service onto the VM database, for all running cohorts
Today `notification-service/src/stream.mjs` reads `notification_stream` through Supabase REST, schema `july`. Meanwhile `junedecember2026.notification_stream` on the VM has **45 queued, 22 failed and 1 retry** messages, so password-reset, feedback and attendance-summary emails for the active cohort are not being sent.

1. `notification-service/package.json`: remove `@supabase/supabase-js` and add `postgres`.
2. `notification-service/src/config.mjs`:
   - require `DATABASE_URL` instead of `SUPABASE_*`;
   - remove `schema`;
   - keep the sender, sandbox, port, interval and token settings.
3. Rewrite `notification-service/src/stream.mjs` on top of `postgres`:
   - `listCohorts()`: before Phase 2, `SELECT schema_name FROM public.cohorts`; after Phase 2, `SELECT schema_name FROM core.cohorts WHERE status = 'running'`. Write it so it checks `to_regclass('core.cohorts')` and uses the first source that exists. Validate every name with `/^[a-z][a-z0-9_]{2,40}$/` and quote it.
   - `claimAvailableMessages(schema, limit)`: a single statement:
     ```sql
     UPDATE "<schema>".notification_stream n SET status='processing', attempts=n.attempts+1,
            locked_at=now(), locked_by='notification-service', updated_at=now()
     WHERE n.id IN (SELECT id FROM "<schema>".notification_stream
                    WHERE status IN ('queued','retry') AND available_at <= now()
                    ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED)
     RETURNING *;
     ```
   - **Stale-lock recovery:** at the start of each drain, `UPDATE … SET status='retry', locked_at=NULL, locked_by=NULL WHERE status='processing' AND locked_at < now() - interval '15 minutes'`.
   - `drainStream(limit)` loops over the cohorts. Sending and status handling stay the same as now, including the retry backoff and `maxAttempts = 6`. Results are reported per schema.
   - `getQueueCounts()` and `listMessages()` take an optional `schema`; the default is all running cohorts, and every result row is tagged with its `schema`.
   - `retryMessage(schema, id)`: the route becomes `POST /messages/:schema/:id/retry`.
   - The password-reset fallback URL hardcodes `https://cipd-erp-ic24.vercel.app/...`. Replace it with `process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL`.
4. Update `notification-service/README.md` (VM, `DATABASE_URL`, multi-cohort; delete the Supabase instructions). Add a PM2 process to `.github/workflows/deploy.yml`: `cd notification-service && npm ci && (pm2 restart cipd-notify || pm2 start npm --name cipd-notify -- start)`.
5. **Before the first run in production:** keep `NOTIFICATION_SANDBOX_MODE=true` and list the backlog (`GET /messages?status=queued`). The 45 messages queued in `junedecember2026` (2026-10-19 to 2026-10-21) may be stale, for example expired feedback windows or old reset links. Add a one-off script `notification-service/scripts/expire-stale.mjs --schema junedecember2026 --before 2026-10-25 --dry-run`. It marks old `queued` or `retry` messages `failed` with `last_error='expired_before_vm_cutover'`. **The owner decides** whether to run it without `--dry-run` before sandbox mode is turned off.

**Acceptance:**
- With sandbox mode on and a test recipient, a password reset requested in `junedecember2026` gets status `sent` within one worker interval.
- `/health` shows counts per cohort.
- `grep -rn supabase notification-service/src` returns nothing.

### 1C. Replace Supabase Storage with local disk
The VM DB has **no stored files**: `session_materials` and `assignment_submissions` are empty in `july` and `junedecember2026`, and `public` has only `example.com` seed URLs. **No data migration is needed.**

1. Rewrite `client-next/lib/storage.js` with the same exported function names:
   - `STORAGE_DIR` env, defaulting to `/var/lib/cipd/uploads`.
   - Physical path is `path.join(STORAGE_DIR, bucket, cohortSchema, key)`, where `cohortSchema = getRequestSchema()`. Reject any key that contains `..`, starts with `/`, or resolves outside `STORAGE_DIR`.
   - `uploadToStorage` creates the directories and writes the file atomically: write `*.tmp`, then rename.
   - `deleteFromStorage` ignores external URLs, as it does now.
   - `resolveFileUrl(bucket, key)` returns external URLs unchanged. Otherwise it returns `/api/files/<bucket>/<key>?t=<token>`, where the token is a signed JWT (`JWT_SECRET`, 1 hour) with claims `{bucket, key, schema}`.
2. Add `client-next/app/api/files/[...path]/route.js`:
   - verify the token and that its `schema` and `key` match the path;
   - stream the file with the right `Content-Type` and `Content-Disposition: inline; filename=…`;
   - return 404 if the file is missing.
   
   This route is the only way to read stored files.
3. File-size limits stay in `lib/file-validation.js`. Add `STORAGE_DIR` to `.env.example` and document creating the directory, owned by the PM2 user, in `client-next/README_part_*.md` (whichever part covers deployment).

**Acceptance:** upload a material as admin in `junedecember2026`; a student of that cohort can open it; a student of another cohort gets 403/404 with a token taken from a different cohort; `@supabase` is not imported by `lib/storage.js`.

### 1D. Small safety fixes
1. `client-next/drizzle.config.js`: replace the contents with a config that throws `Error('drizzle-kit is disabled: use npm run migrate (see migrations/README.md)')` at load time. Keep `drizzle-orm`; the `drizzle-kit` devDependency can be removed.
2. Delete `client-next/app/api/admin/setup/route.js`. It runs DDL over HTTP and uses `uuid_generate_v4()` unqualified, which fails on the VM.
3. `client-next/app/api/admin/students/route.js`:
   - Wrap POST, PATCH and DELETE in `schemaDb.transaction(async (tx) => …)` and delete the manual "compensation" deletes.
   - Replace the default password `'12345678'` with `crypto.randomBytes(24).toString('base64url')`, hashed. The student uses "Forgot password".
   - Fix the misleading comment at about line 323. On the VM, `public` is the schema with ON DELETE CASCADE; `july` and `junedecember2026` mostly use NO ACTION and are missing 14 FKs.
   - DELETE must also remove rows in `leave_requests`, `attendance_ping_logs`, `student_attendance_marks`, `student_course_attendance` and `notification_stream` (`recipient_id`), inside the same transaction. Phase 5 replaces this endpoint, but it must be safe until then.
4. `client-next/lib/db.js`:
   - Remove the LRU eviction (`MAX_SCHEMA_POOLS` and the `while` loop).
   - Create each schema pool with `{ prepare:false, max:3, idle_timeout:20, max_lifetime:1800 }`.
   - `getCohortConfig`: fall back to env only on SQLSTATE `42P01` (undefined table). On any other error, return the last cached value if there is one, else rethrow.
5. `lib/cohorts.js`: export `invalidateMembershipCache`, and call it after student create, update and delete in `admin/students/route.js`.

---

## Phase 2 – `core` schema: registry, shared types, search_path isolation

Create `client-next/migrations/core/0001_core_registry.sql`. Phase 3's runner will apply it; until that runner exists, apply it with `psql -v ON_ERROR_STOP=1 -1 -f` on staging first.

```sql
CREATE SCHEMA IF NOT EXISTS core;

DO $$ BEGIN
  CREATE TYPE core.cohort_status AS ENUM ('provisioning','running','archived','failed','deleting');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS core.cohorts (
  id             smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schema_name    text NOT NULL UNIQUE CHECK (schema_name ~ '^[a-z][a-z0-9_]{2,40}$'),
  label          text NOT NULL CHECK (length(trim(label)) > 0),
  program        text,
  starts_on      date,
  ends_on        date,
  status         core.cohort_status NOT NULL DEFAULT 'provisioning',
  is_default     boolean NOT NULL DEFAULT false,
  is_legacy      boolean NOT NULL DEFAULT false,
  schema_version text,
  last_error     text,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
  CHECK (NOT is_default OR status = 'running')
);
CREATE UNIQUE INDEX IF NOT EXISTS cohorts_single_default ON core.cohorts ((true)) WHERE is_default;

CREATE TABLE IF NOT EXISTS core.schema_migrations (
  scope      text NOT NULL,          -- 'core' or a cohort schema_name
  version    text NOT NULL,
  checksum   text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  executed   boolean NOT NULL DEFAULT true,   -- false = marked as baseline only
  PRIMARY KEY (scope, version)
);

-- Seed from the existing registry (dates from session ranges on the VM).
INSERT INTO core.cohorts (schema_name, label, starts_on, ends_on, status, is_default, is_legacy)
VALUES ('public',           'Winter 2026',        '2026-01-05', '2026-07-01', 'archived', false, true),
       ('july',             'July 2026',          '2026-06-29', '2026-10-09', 'archived', false, true),
       ('junedecember2026', 'June-December 2026', '2026-10-19', NULL,         'running',  true,  false)
ON CONFLICT (schema_name) DO NOTHING;

-- Shared enum types: move out of the legacy cohort schema. Columns reference types by OID, so this is safe.
DO $$ BEGIN
  IF to_regtype('public.user_role') IS NOT NULL THEN ALTER TYPE public.user_role SET SCHEMA core; END IF;
  IF to_regtype('public.session_status') IS NOT NULL THEN ALTER TYPE public.session_status SET SCHEMA core; END IF;
  IF to_regtype('public.attendance_status') IS NOT NULL THEN ALTER TYPE public.attendance_status SET SCHEMA core; END IF;
  IF to_regtype('public.feedback_question_type') IS NOT NULL THEN ALTER TYPE public.feedback_question_type SET SCHEMA core; END IF;
END $$;
```

Keep `public.cohorts` (do not drop it) until Phase 5 is deployed. In the same release, change `lib/cohorts.js` `createCohort`/`setActiveCohort` so they write `core.cohorts` instead. Phase 5 replaces them anyway.

**Code changes:**
1. `client-next/lib/db.js`:
   - main connection: `search_path = core`;
   - schema pools: `search_path = "<schema>", core`;
   - **`public` is no longer on the path for non-public cohorts**; the `public` cohort itself uses `public, core`.
   - `getCohortConfig()` reads `core.cohorts` and returns:
     ```
     { cohorts: [{ id, schema, label, program, starts_on, ends_on, status, is_default, is_legacy }],
       schemas, labels, active }   // active = the is_default cohort; schemas/labels kept for compatibility
     ```
   - `getActiveSchema()` returns the `is_default` cohort. Add `getRunningSchemas()`, which returns the cohorts with `status='running'`.
2. `client-next/config.js`: keep `DEFAULT_SCHEMA` only as a last-resort server fallback, and set it to `'junedecember2026'`. Remove every frontend import of it (Phase 7).
3. Remove the hardcoded `'july'` in `app/components/CreateCohortModal.jsx` (Phase 7 rewrites it).

**Acceptance (on staging):**
- In a `junedecember2026` pool, `SELECT to_regclass('cohorts')` and `to_regclass('admin_dashboard_summary')` return NULL, which proves there is no fall-through.
- Every page works for `junedecember2026` and `public`.
- `\dT core.*` lists the four enums.

---

## Phase 3 – Migration runner, baseline and reconcile

### 3A. Runner: `client-next/scripts/migrate.mjs` (`npm run migrate`)
- Reads `DATABASE_URL` (or `--url`) and takes `pg_advisory_lock(hashtext('cipd_migrations'))`.
- **Core:** applies `migrations/core/*.sql` in lexical order, once each (scope `'core'`).
- **Cohorts:** for every row in `core.cohorts` with `status IN ('running','archived','provisioning')`, applies `migrations/cohort/*.sql` in order:
  - one transaction per (cohort, file), starting with `SET LOCAL search_path TO "<schema>", core`;
  - replace `{{schema}}` (quoted identifier), `{{schema_literal}}` and `{{cohort_id}}` placeholders before running;
  - record a sha256 checksum;
  - **abort if an already-applied file's checksum changed**;
  - set `core.cohorts.schema_version` to the last applied version.
- A failure in one cohort is logged and the other cohorts continue; the exit code is non-zero.
- Flags: `--dry-run`, `--cohort <schema>`, `--mark-applied <version> --cohort <schema>` (records `executed=false`).
- Export the per-cohort apply function (`applyCohortMigrations(sql, schema, cohortId)`) so `createCohort` can reuse it (Phase 5).
- Add `"migrate": "node scripts/migrate.mjs"` to `client-next/package.json` and run `npm run migrate` in `deploy.yml` **before** `pm2 restart`.
- Rewrite `client-next/migrations/README.md` for the VM and this runner. Move `client-next/scripts/*.sql` and `client-next/migrations/001_cohorts_registry.sql` to `client-next/migrations/archive/` with a README saying they are historical and must not be rerun.

### 3B. Baseline for future cohorts: `migrations/cohort/0001_baseline.sql`
1. On staging, **after** 3C has been applied: `pg_dump --schema-only --no-owner --no-privileges -n junedecember2026 cipd_staging`.
2. Edit the dump so it uses the placeholders:
   - remove the `junedecember2026.` qualifiers so objects land in the `SET LOCAL search_path` schema;
   - remove `CREATE SCHEMA`, RLS, policies and grants;
   - change `extensions.uuid_generate_v4()` defaults to `gen_random_uuid()`;
   - make `attendance_ping_logs.id` `bigint GENERATED BY DEFAULT AS IDENTITY`;
   - qualify enum types as `core.<type>`;
   - make the trigger functions reference tables unqualified (they resolve through the search_path at runtime) **or**, better, through `{{schema}}`;
   - include `trg_auto_enroll_student` and `trg_auto_enroll_course`.
3. For all three existing cohorts, mark it applied with `--mark-applied 0001 --cohort <schema>`.
4. Test: create a scratch schema `zz_baseline_check` on staging, apply 0001, run the drift checker (3D) against `junedecember2026`; the result must be **zero differences**. Then drop the scratch schema.

### 3C. Reconcile migration: `migrations/cohort/0002_reconcile.sql` (written to be safe on all three cohorts)
Guard every change with a catalog check, `DO $$ … $$`. The steps:
1. **Own sequences.** For each `bigserial`/serial column whose default depends on a sequence in another schema (live: `july.attendance_ping_logs`, `junedecember2026.attendance_ping_logs`, `july.wifi_snapshots`, all using sequences in `public`):
   ```sql
   CREATE SEQUENCE IF NOT EXISTS {{schema}}.attendance_ping_logs_id_seq OWNED BY {{schema}}.attendance_ping_logs.id;
   SELECT setval('{{schema_literal}}.attendance_ping_logs_id_seq', COALESCE((SELECT max(id) FROM attendance_ping_logs), 0) + 1, false);
   ALTER TABLE attendance_ping_logs ALTER COLUMN id SET DEFAULT nextval('{{schema_literal}}.attendance_ping_logs_id_seq');
   ```
   (`setval` with `false` makes the next value exactly `max+1`.) Skip any table whose default already points at its own schema; this is always the case for `public`.
2. **Drop `july.wifi_snapshots`**, but only if the schema is `july` and the table has 0 rows (`RAISE NOTICE` and skip otherwise). Never touch `public.wifi_snapshots`.
3. **Missing FKs (non-legacy cohorts only, i.e. `junedecember2026`).** Add the 14 FKs that `public` has, with `public`'s ON DELETE rules:

   | FK | ON DELETE |
   |---|---|
   | `attendance_ping_logs_session_id_fkey`, `attendance_ping_logs_student_id_fkey` | CASCADE |
   | `google_tokens_user_id_fkey` | CASCADE |
   | `leave_requests_student_id_fkey` | CASCADE |
   | `leave_requests_reviewed_by_fkey`, `leave_requests_session_id_fkey` | SET NULL |
   | `session_skills_session_id_fkey`, `session_skills_skill_id_fkey` | CASCADE |
   | `sessions_category_id_fkey` | SET NULL |
   | `student_attendance_marks_student_id_fkey` | CASCADE |
   | `student_attendance_marks_course_id_fkey`, `student_attendance_marks_session_id_fkey` | SET NULL |
   | `student_course_attendance_course_id_fkey`, `student_course_attendance_student_id_fkey` | CASCADE |

   Copy the exact referenced columns from `pg_get_constraintdef` on `public`.
   - Before each FK, count orphan rows. If there are any, `CREATE TABLE IF NOT EXISTS _orphans_<table> (LIKE <table>)`, move the orphans there (`WITH moved AS (DELETE … RETURNING *) INSERT …`), and `RAISE NOTICE` the count. `junedecember2026` had **no** orphans on 2026-11-03.
   - **Do not change the existing FKs' ON DELETE rules.**
   - **Do not add these FKs to the legacy archived schemas** (`july` has 443 orphan `session_skills` rows; leave that data exactly as it is).
4. **`trg_auto_enroll_course`** on `courses`, for every cohort that lacks it (`july` and `junedecember2026`). Create a schema-local function `{{schema}}.auto_enroll_all_in_new_course()` that inserts `(student_id, course_id)` for every student into `course_enrollments ON CONFLICT DO NOTHING`. It is harmless on archived cohorts, which are read-only from Phase 5 on.
5. **RLS off:** `ALTER TABLE … DISABLE ROW LEVEL SECURITY` for every table in the schema that has `relrowsecurity` (there are no policies anywhere). Access control lives in the app.

Leave alone: `public`'s views and `calculate_attendance` (legacy, unused, and no longer reachable through the search path), and `public.wifi_snapshots`.

### 3D. Drift checker: `client-next/scripts/check-schema-drift.mjs`
- Compares every cohort against the newest non-legacy `running` cohort. It checks:
  - tables;
  - columns (name, type, nullability, default with the schema name normalised);
  - unique and PK constraints;
  - FKs (name and ON DELETE);
  - indexes (definition with the schema name normalised);
  - triggers.
- **Strict** for non-legacy cohorts (any difference fails).
- For `is_legacy` cohorts it is **strict for tables and columns**, because app code must work on them, and **report-only** for FKs, triggers and indexes.
- Ignore the `_orphans_*` tables, and `wifi_snapshots`/`cohorts` in `public`.
- Exit non-zero on a strict failure. Run it in `deploy.yml` after `npm run migrate`.

**Acceptance:** on staging, `npm run migrate` applies 0002 to all three cohorts; the drift checker passes; running `npm run migrate` again does nothing; `npm run build` and a smoke test of the admin pages for each cohort pass.

---

## Phase 4 – Central identity and cohort membership

### Design (supersedes audit §6)
- One global **account** per person. Per-cohort `users` rows remain, because they are the FK targets of every cohort table, but they are tied to the account and to a membership in that specific cohort.
- Legacy duplicates (the same person under different ids in different cohorts) are handled as **aliases**: alias accounts point at a canonical account with `merged_into`. Historical ids never change.

`migrations/core/0002_identity.sql`:
```sql
CREATE TABLE IF NOT EXISTS core.accounts (
  id            uuid PRIMARY KEY,                          -- = users.id in the cohort schemas
  merged_into   uuid REFERENCES core.accounts(id),         -- NULL = canonical
  email         text NOT NULL,
  password_hash text NOT NULL,
  role          core.user_role NOT NULL,
  first_name    text, last_name text,
  enrollment_no text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (merged_into IS NULL OR merged_into <> id)
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_canonical_uq ON core.accounts (lower(email)) WHERE merged_into IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_enrollment_canonical_uq ON core.accounts (enrollment_no) WHERE merged_into IS NULL AND enrollment_no IS NOT NULL;

DO $$ BEGIN
  CREATE TYPE core.membership_status AS ENUM ('active','completed','transferred_out','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS core.cohort_memberships (
  account_id uuid     NOT NULL REFERENCES core.accounts(id) ON DELETE RESTRICT,
  cohort_id  smallint NOT NULL REFERENCES core.cohorts(id)  ON DELETE RESTRICT,
  status     core.membership_status NOT NULL DEFAULT 'active',
  joined_at  timestamptz NOT NULL DEFAULT now(),
  left_at    timestamptz,
  note       text,
  PRIMARY KEY (account_id, cohort_id)
);
CREATE INDEX IF NOT EXISTS cohort_memberships_cohort_idx ON core.cohort_memberships (cohort_id, status);

CREATE TABLE IF NOT EXISTS core.account_conflicts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL, details jsonb NOT NULL, resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.programs (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);
```

### Backfill script: `client-next/scripts/backfill-identity.mjs` (not a SQL migration, because it needs judgement and a dry run)
1. Read every `users` row (joined with `students`) from all cohorts in `core.cohorts`.
2. Group the rows by id. Rows with the same id are one account. Live data: 67 ids are shared between `july` and `junedecember2026`; `public` shares no ids with the others.
3. Group the ids by `lower(email)`. When one email has several ids (live: **5 student cases and possibly the 2 admin accounts**):
   - the **canonical** id is the one present in the most recent cohort (order `junedecember2026` > `july` > `public`);
   - the other ids become alias accounts with `merged_into = canonical`;
   - insert a row into `core.account_conflicts` (`kind='email_split_id'`) for each group, so the admin can review it.
4. For each canonical account, take `password_hash`, names and `is_active` from its row in the most recent cohort it belongs to. Use the same source for alias accounts, from their own rows. Take `enrollment_no` from the most recent `students` row. If that enrollment number collides with another canonical account, set it to NULL and log a conflict (`kind='enrollment_collision'`).
5. Memberships, one per (users row, cohort):
   - `status = 'active'` if the cohort is `running`, otherwise `'completed'`;
   - `joined_at` = `users.created_at`;
   - for `users.is_active = false` in a running cohort, use `status = 'withdrawn'`.
   
   Alias accounts get the memberships for their own rows.
6. Programs: normalise the distinct `students.program_name` values with this map, and store the mapping in the script so it can be reviewed:

   | raw value | program |
   |---|---|
   | `iPD-CP`, `ipdcp`, `IPDCP 2026` | `iPD-CP` |
   | `B.Tech`, `B.Tech CSE` | `B.Tech CSE` |

   Insert the programs into `core.programs`. **Do not rewrite `students.program_name`** in the archived cohorts.
7. Flags: `--dry-run` (the default) prints the plan and the conflicts; `--apply` writes everything in one transaction. Re-running is idempotent (`ON CONFLICT DO NOTHING/UPDATE`).
8. **The owner reviews `core.account_conflicts` before Phase 5 is deployed.**

### Cohort-schema enforcement: `migrations/cohort/0003_membership_fk.sql` (all cohorts)
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS cohort_id smallint;
UPDATE users SET cohort_id = {{cohort_id}} WHERE cohort_id IS DISTINCT FROM {{cohort_id}};
ALTER TABLE users ALTER COLUMN cohort_id SET DEFAULT {{cohort_id}};
ALTER TABLE users ALTER COLUMN cohort_id SET NOT NULL;
-- guarded with DO blocks / pg_constraint checks:
ALTER TABLE users ADD CONSTRAINT users_cohort_is_this CHECK (cohort_id = {{cohort_id}});
ALTER TABLE users ADD CONSTRAINT users_membership_fk FOREIGN KEY (id, cohort_id)
  REFERENCES core.cohort_memberships (account_id, cohort_id) ON DELETE RESTRICT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS program_id smallint REFERENCES core.programs(id);
```

- The runner refuses to apply 0003 to a cohort unless the backfill has created a membership for every `users` row in it. 0003 starts with a check that counts `users` rows without a matching membership and `RAISE EXCEPTION`s if there are any.
- Add `cohortId: smallint('cohort_id').notNull()` to `users` and `programId` to `students` in `client-next/drizzle/schema.ts`. Leave out a Drizzle default, because the DB default supplies it.
- `users.password_hash` stays in the cohort schemas (NOT NULL, untouched) but **is no longer read** after Phase 5.

What the DB now guarantees:
- No `users` row (student or staff) can exist in a cohort schema without a membership in **that** cohort.
- A membership cannot reference a nonexistent cohort or account.
- A cohort or account that still has memberships cannot be deleted from the registry.

**Acceptance:** on staging, the backfill dry run lists the 5 student email conflicts and the admin accounts; `--apply` succeeds; `npm run migrate` applies 0003 to all three cohorts; inserting a `users` row in `junedecember2026` without a membership fails with an FK violation.

---

## Phase 5 – Backend: auth, cohort resolution, students, cohort lifecycle

### 5A. New module `client-next/lib/accounts.js` (uses `connection` from `lib/db.js`)
- `findCanonicalAccountByLogin(identifier)`:
  - by email: `lower(email)` with `merged_into IS NULL`;
  - by enrollment number: `core.accounts.enrollment_no`, falling back to a scan of `students.enrollment_no` in the running cohorts, mapped to the canonical account.
- `getAccountIds(canonicalId)`: the canonical id plus every alias id.
- `getMemberships(canonicalId)`: rows `{ cohort_id, schema, status, local_user_id }`, where `local_user_id` is whichever account (canonical or alias) holds the membership. The query covers `account_id IN (canonical + aliases)`.
- `updateAccount(canonicalId, patch)`: in one `connection.begin` transaction, update `core.accounts`. Mirror `first_name`, `last_name`, `email` and `is_active` to the `users` rows of the **running** cohorts where `local_user_id` has a row. Archived cohorts are left as historical records.
- `setPassword(canonicalId, hash)`: updates `core.accounts` only.

### 5B. Auth routes
- `app/api/auth/login/route.js`:
  - authenticate against `core.accounts`, rejecting inactive accounts;
  - the JWT payload carries `{ id: canonicalId, email, role, firstName, lastName }`, and **no `schema`**;
  - the response also includes `defaultCohort`: the `is_default` cohort if the user has an active membership there, else their most recent active membership, else (students with only completed memberships) their most recent cohort. Admins get the `is_default` cohort.
- `app/api/auth/reset-password`, `app/api/auth/update-password`, `app/api/admin/settings/password`: change `core.accounts.password_hash` via `setPassword`, and nothing else.
- `app/api/auth/me`, `app/api/students/profile`, `app/api/students/attendance/sessions`, `app/api/admin/students/reset-password`: delete the loops over every schema. Use the request's cohort and `req.user.localId` (see 5C).
- `app/api/auth/signup`, `app/api/auth/google/*`: create or match the account in `core.accounts` and a membership in the `is_default` cohort, using the same function as the student-create flow (5D).

### 5C. `lib/cohorts.js` `resolveRequestSchema` and `lib/middleware.js` `withAuth`
1. Resolve the cohort:
   - **admin:** any cohort with status in (`running`, `archived`) from the `x-cohort` header, else the default cohort;
   - **faculty and student:** only cohorts where they have a membership (any status), with the header when valid, else the default cohort if they are a member, else their most recent membership.
   
   Replace `getUserCohorts` (the `UNION ALL` probe) with `getMemberships`, keeping its 60-second cache and invalidating it on every membership change.
2. Set `req.user.localId` to the cohort-local user id from the membership (canonical or alias). **Every route that uses `req.user.id` for a cohort-table query or FK must switch to `req.user.localId`.** Grep for `req.user.id` in `app/api`; known places include `admin/leave-requests/[id]`, `admin/materials`, `admin/sessions`, `faculty/*` and `students/*`. Keep `req.user.id` as the canonical id for account operations.
3. **Admins with no row in a running cohort:** before the handler runs, `INSERT INTO "<schema>".users (id, email, password_hash, role, first_name, last_name, is_active, cohort_id)` using the canonical account (`password_hash` gets the account's hash; it is unused but NOT NULL), after inserting a membership `(account, cohort, 'active')`. Do both in one transaction with `ON CONFLICT DO NOTHING`, and only for `running` cohorts. If the cohort already has a different users row with the same email (the alias case), use that row's id as `localId`.
4. **Archived cohorts are read-only.**
   - If the resolved cohort's status is not `running` or `provisioning` and the method is not GET, HEAD or OPTIONS, return `409 { error: 'This cohort is archived and read-only.' }`.
   - Allowlist exceptions (account-level, not cohort data): `/api/auth/*`, `/api/admin/cohorts*`, `/api/students/settings`, `/api/student/notifications` (mark as read).
   - Implement this as an option on `withAuth(handler, { allowArchivedWrites: true })` and use the option on those routes.
5. Remove the `?schema=` and `body.schema` overrides from:
   - `app/api/admin/students/route.js`
   - `app/api/admin/enrollments/route.js`
   - `app/api/admin/students/attendance-summary/route.js`
   - `app/api/admin/reports/students/route.js`
   - `app/api/admin/students/reset-password/route.js`
   
   The cohort comes **only** from the middleware (`req.cohort` / `getRequestSchema()`). Exception: `POST /api/admin/students` uses the explicit `cohort_id` in the body (5D).

### 5D. Student management (structured)
Shared service: `client-next/lib/student-service.js`. Every function runs in **one** transaction on `connection.begin`, using `qid(schema)` with schemas taken only from `core.cohorts`.
- `createStudent({ cohortId, firstName, lastName, email, enrollmentNo, programId, createdBy })`:
  1. Load the cohort by id. Return 422 if it is missing or its status is not `running` or `provisioning`.
  2. Find the canonical account by email. If there is none, create one: role `student`, random password hash, `enrollment_no`.
  3. If the account has the role `faculty` or `admin`, return 409. If it already has a membership in this cohort, return 409 "Student already in this cohort".
  4. Check the enrollment number for uniqueness across canonical accounts (except this one) and in this cohort's `students`; return 409 on a clash.
  5. Insert the membership `active`.
  6. Insert `"<schema>".users`, using the account id, the account's `password_hash` (unused) and `cohort_id`.
  7. Insert `"<schema>".students`, copying `mac_address`, `mac_verified`, `device_hash` and `photo_url` from the account's most recent other cohort, as `findExistingStudentAcrossCohorts` does today.
  8. Insert `course_enrollments` for all courses `ON CONFLICT DO NOTHING`. The trigger also does this; keep both.
  9. Queue a password-set email into `"<schema>".notification_stream` (`event_type='password_reset'`), as the reset flow does.
- `updateStudent(canonicalId, cohortSchema, patch)`: identity fields go through `updateAccount`; `mac_address`, `mac_verified`, `program_id` and `enrollment_no` are updated in the given cohort. Validate the MAC format as now.
- `transferStudent(canonicalId, fromCohortId, toCohortId)`:
  - the target cohort must be `running` and the source membership `active`;
  - create the membership and rows in the target as in `createStudent`;
  - set the source membership to `transferred_out` with `left_at = now()`;
  - set the source `users.is_active = false` (this is the one allowed write into a cohort that may be archived; perform it inside the service, which bypasses the HTTP read-only guard).
  - **Never delete history.**
- `withdrawStudent(canonicalId, cohortId)`: membership `withdrawn`, `users.is_active=false`.
- `purgeStudentFromCohort(canonicalId, cohortId, { confirm })`:
  - admin only, running cohorts only, `confirm` must equal the student's email;
  - deletes the cohort rows in dependency order (Phase 1D list) and the membership;
  - deletes the account if it has no memberships left.

Routes (replacing `app/api/admin/students/route.js`):

| Route | Notes |
|---|---|
| `GET /api/admin/students` | Cohort from the middleware. Include `program` (joined to `core.programs`) and `membership_status`. |
| `POST /api/admin/students` | Body `{ cohort_id, first_name, last_name, email, enrollment_no?, program_id? }`; `cohort_id` is **required** |
| `PATCH /api/admin/students/[id]` | |
| `POST /api/admin/students/[id]/transfer` | Body `{ to_cohort_id }` |
| `POST /api/admin/students/[id]/withdraw` | |
| `DELETE /api/admin/students/[id]` | Body `{ confirm }` |
| `GET /api/admin/programs`, `POST /api/admin/programs` | Programs dropdown |

Keep the old bulk delete (`student_ids`) only as "withdraw many".

### 5E. Cohort lifecycle (`lib/cohorts.js`, `app/api/admin/cohorts/route.js`, `app/api/admin/cohorts/[id]/route.js`)
- `GET /api/cohorts` (all roles): the cohorts the user may use, with `{ id, schema, label, program, starts_on, ends_on, status, is_default }`, plus `current` and `default`.
- `POST /api/admin/cohorts`, body `{ schema_name, label, program?, starts_on, ends_on?, reference_from_cohort_id, students?: [{name,email,enrollment_no?}], copy_active_students_from_cohort_id?, make_default }`:
  1. Validate as now (regex, reserved names, not already in `core.cohorts`, no `pg_namespace` clash).
  2. Insert into `core.cohorts` with status `provisioning`, and **commit**.
  3. In one transaction:
     1. `CREATE SCHEMA`;
     2. `applyCohortMigrations` (all `migrations/cohort/*`, starting from 0001) — **this replaces the `LIKE … INCLUDING ALL` clone, which must be deleted**;
     3. copy the reference tables from the reference cohort: `courses`, `categories`, `skills`, `session_types`, `venues`, `system_settings`, `feedback_questions` (not `google_tokens`);
     4. insert staff: a `users` row plus membership for every account with role `admin`, and for faculty with an `active` membership in the reference cohort, together with their `faculty` rows;
     5. create the students through `createStudent` logic (same transaction, savepoint per student, failures collected);
     6. set status `running`, and `is_default` if requested (clear the old default in the same transaction).
  4. On failure, roll back, then in a separate statement set status `failed` and `last_error`. The admin can **retry** with `POST /api/admin/cohorts/[id]/retry`, which drops the half-created schema if it exists and re-runs step 3.
- `PATCH /api/admin/cohorts/[id]`: `label`, `program`, `starts_on`, `ends_on`, `status` (`running` ↔ `archived` only), `is_default` (only for `running`). `schema_name` is immutable; reject attempts to change it.
  - Archiving sets every `active` membership in that cohort to `completed`.
  - Un-archiving does not change memberships.
- **No hard delete over HTTP.** Add the CLI `client-next/scripts/cohort-delete.mjs --cohort <schema> --confirm <schema>`. It:
  1. refuses `is_legacy`, `is_default` and `running` cohorts;
  2. runs `pg_dump -Fc -n <schema>` into `BACKUP_DIR` and verifies the file is non-empty;
  3. sets status `deleting`;
  4. in one transaction: `DROP SCHEMA … CASCADE`, delete the cohort's memberships, delete accounts left with no memberships and no aliases, delete the `core.cohorts` row and its `core.schema_migrations` rows.
  
  Document it in `migrations/README.md`.
- Every mutation calls `invalidateCohortCache()` and `invalidateMembershipCache()`. With PM2 cluster mode, also run `NOTIFY cohorts_changed` and `LISTEN` on the main connection to invalidate the caches in the other processes.
- After this phase ships and is verified, `migrations/core/0003_drop_legacy_registry.sql` runs `DROP TABLE IF EXISTS public.cohorts`.

---

## Phase 6 – Background jobs cover every running cohort
1. `client-next/lib/cohort-jobs.js`: `forEachRunningCohort(fn, { only } = {})` iterates `getRunningSchemas()` (filtered by `only` if given) and calls `runWithSchema(schema, () => fn(schema))`. It catches and collects errors per cohort and returns `{ [schema]: result | { error } }`.
2. Use it in:
   - `app/api/cron/process-attendance/route.js`
   - `app/api/cron/reminder/route.js`
   - `app/api/cron/feedback-reminder/route.js`
   - `app/api/cron/daily-student-digest/route.js` (keep `?schema=` as the `only` filter, validated against the registry)
   - `lib/daily-digest.js` (take the schema as a parameter instead of calling `getActiveSchema`)
   
   The response JSON is keyed by cohort.
3. The workers (`scripts/attendance-worker.js`, `scripts/daily-digest-worker.js`, `scripts/notification-stream-worker.mjs`) need no cohort logic; check that their success heuristics, such as "0 sessions processed ⇒ alert", sum across cohorts.

Currently there is only one running cohort, so the behaviour does not change until a second cohort is running.

---

## Phase 7 – Frontend
1. `app/contexts/CohortContext.js`:
   - store cohort objects (`id`, `schema`, `label`, `status`, dates, `is_default`);
   - expose `selectedCohortObj`, `isReadOnly` (`status !== 'running'`) and `runningCohorts`;
   - `makeActive` becomes "set default" (`PATCH /api/admin/cohorts/[id] { is_default: true }`).
   
   On login, use `defaultCohort` from the login response as the initial selection when nothing valid is stored.
2. `app/components/CohortSwitcher.jsx`:
   - group the list into **Running** and **Archived**, show the dates, and badge the default cohort;
   - admins get a "Manage cohorts" link to the new `app/admin/cohorts/page.jsx`;
   - when an archived cohort is selected, show a global "Archived – read-only" banner from `GlobalCohortBar.jsx`.
3. New `app/admin/cohorts/page.jsx`:
   - a table of cohorts showing label, schema, program, dates, status, member counts and schema version;
   - actions: edit (label, program, dates), archive or un-archive, set default, retry a failed provisioning, and create (opens `CreateCohortModal`).
4. `app/components/CreateCohortModal.jsx`:
   - fields: label, `schema_name` (auto-generated from the label and editable, validated with the same regex), program, start and end dates;
   - "Copy reference data from" (a dropdown of cohorts, defaulting to the default cohort; no hardcoded `'july'`);
   - "Copy active students from" (optional dropdown), CSV or paste of students, and "Make default";
   - show `provisioning` or `failed` with `last_error` and a retry button.
5. `app/admin/students/page.jsx`:
   - remove the page's own cohort state, pills and `/api/admin/cohorts` fetch (about lines 787–886 and 1004–1030), and use `useCohort()`;
   - **`AddStudentModal`:** add a required **Cohort `<select>`** listing `runningCohorts` (default: the selected cohort if it is running) and a **Program `<select>`** from `/api/admin/programs` (with an admin "add program" option); send `cohort_id` and `program_id`. Remove the free-text program input.
   - `StudentDrawer`: add a program select, a membership status display, a **"Transfer to cohort…"** action (dropdown of the other running cohorts, then a confirm dialog) and a "Withdraw" action. Keep "Delete permanently" behind typing the email.
   - When `isReadOnly`, disable every mutating control on admin pages (students, schedule, attendance overrides, leave requests, notifications, settings, feedback forms). This is a UX convenience only; the server enforces it in 5C.4.
6. `app/admin/reports/page.jsx`:
   - remove the `studSchema` state (about lines 323–345 and 1047) and use the selected cohort;
   - replace the raw `fetch` at about line 980 with a new `apiDownload(path)` helper in `lib/api.js` that sends `Authorization` and `x-cohort` and returns a Blob.
7. Remove every frontend import of `DEFAULT_SCHEMA` (`app/admin/students/page.jsx` and `app/admin/reports/page.jsx`).

---

## Phase 8 – VM hardening and cleanup
1. **DB role:**
   ```sql
   CREATE ROLE cipd_app LOGIN PASSWORD '…';
   GRANT CONNECT, CREATE ON DATABASE cipd TO cipd_app;
   ALTER SCHEMA core OWNER TO cipd_app;   -- and each cohort schema
   ALTER TABLE … OWNER TO cipd_app;       -- generated over every table, sequence and function in core and the cohort schemas
   ```
   Point `DATABASE_URL` (app and notification-service) at `cipd_app`. Keep `postgres` for manual admin only. RLS is already disabled (3C.5), so behaviour does not change.
2. **Env and secrets:**
   - remove `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `COHORT_SCHEMAS` and `COHORT_LABELS` from `.env.example` and `deploy.yml`;
   - keep the `getCohortConfig` env fallback only for the "core table missing" bootstrap case;
   - clean `client-next/.env`: it ends with a stray comment that looks like a credential fragment;
   - rotate the Supabase service key once 1A ships, and store the new one only on the VM.
3. **Supabase project (owner action, not the implementer's):** the Supabase cloud project probably still holds copies of the pre-migration ERP tables, including `users` with password hashes. Once the VM is confirmed as the source of truth, export a backup and then delete every table except `public.wifi_snapshots` from the Supabase project. A leaked service key would then expose only Wi-Fi data. Also consider a retention job for old snapshots.
4. **Docs:**
   - update `client-next/migrations/README.md`, `notification-service/README.md` and `.env.example`;
   - add `docs/COHORTS.md`, explaining how to create, archive and delete a cohort, how to add a migration, and what the Wi-Fi Supabase dependency is.
5. **Leftover Supabase schemas on the VM** (`auth`, `storage`, `realtime`, `vault`, `graphql`, `graphql_public`): leave them for now. **Keep `extensions`**, because the legacy schemas' column defaults call `extensions.uuid_generate_v4()`.

---

## Phase 9 – Tests and verification (run on staging, then production after deploy)
Add `client-next/scripts/test-cohort-isolation.mjs`. It runs against `STAGING_DATABASE_URL` and the app at `APP_URL`, using test accounts it creates and cleans up itself:
1. Provision cohort `zz_test_a`, which must reach status `running`, and check that the drift checker passes for it.
2. Create a student in `zz_test_a` via `POST /api/admin/students` with `cohort_id`, and check they are absent from `GET /api/admin/students` with `x-cohort: junedecember2026`.
3. Log in as that student and send `x-cohort: junedecember2026`; the server must resolve the request to `zz_test_a`.
4. `POST /api/admin/students` with a nonexistent `cohort_id` returns 422; with an archived cohort's id, it returns 422.
5. A direct SQL insert into `zz_test_a.users` without a membership must fail on the FK.
6. Transfer the student to the default cohort: the old membership becomes `transferred_out`, the old users row inactive, and the new membership `active`.
7. Archive `zz_test_a`; then `POST /api/admin/sessions` with `x-cohort: zz_test_a` returns 409.
8. Reset the password, then log in again with an `x-cohort` for a different cohort; it must succeed (one password).
9. Run `cohort-delete.mjs --cohort zz_test_a --confirm zz_test_a`; the backup file exists, and the schema, memberships and registry row are gone.
10. In a `junedecember2026` pool, `SELECT to_regclass('cohorts')` returns NULL (no fall-through to `public`).

Manual checks in production after each phase:
- Wi-Fi live page and attendance processing for `junedecember2026`; compare with the Supabase snapshot timestamps.
- Notification `/health`.
- Log in as a `public`-only student: they can view their history read-only.
- Log in as one of the 5 split-email students (check `core.account_conflicts`).

---

## Deliverables checklist
- [ ] Phase 1A `lib/wifi-snapshots.js` + 9 call sites + fail-safe
- [ ] Phase 1B notification-service on VM, multi-cohort, plus the stale-message script
- [ ] Phase 1C local storage + `/api/files` route
- [ ] Phase 1D safety fixes (drizzle-kit disabled, setup route removed, student route transactions, pools)
- [ ] Phase 2 `core.cohorts`, enums moved, search_path without `public`
- [ ] Phase 3 runner, baseline, reconcile, drift checker, deploy hooks
- [ ] Phase 4 identity tables, backfill (owner reviews conflicts), membership FK
- [ ] Phase 5 auth on `core.accounts`, `localId`, archived read-only, student service and routes, cohort lifecycle, delete CLI
- [ ] Phase 6 cron over running cohorts
- [ ] Phase 7 frontend (cohort dropdown in Add Student, transfer, programs, manage-cohorts page, read-only UX)
- [ ] Phase 8 `cipd_app` role, env cleanup, docs
- [ ] Phase 9 isolation tests pass
