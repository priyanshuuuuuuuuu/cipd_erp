# Cohort Architecture Audit & Implementation Plan

Date: 2026-11-03. Scope: multi-cohort (schema-per-cohort) support, Supabase → college VM migration, structured cohort/student model.
Status: **audit only, no code or DB changed.**

> **Superseded for implementation by `HANDOFF_COHORTS_IMPLEMENTATION_PLAN.md`.** Owner corrections: (1) the Wi-Fi scanner runs on a separate network and writes to **Supabase on purpose**. Reading Wi-Fi snapshots from Supabase stays; the app does **not** read the stale VM table `public.wifi_snapshots`. Supabase had live snapshots on 2026-11-03, so the claim in §10.5 that "Wi-Fi attendance is not being collected" is **wrong**. D2/B13 are not issues, and Step 9.2 (ingest endpoint) is cancelled. (2) `july` is to be archived; `junedecember2026` is the running cohort. (3) Wi-Fi was disabled for a while, so gaps in the data are expected.
>
> **Update (same day):** the VM database (`192.168.3.190:5432/cipd`) was later reached over the college VPN and inspected with **read-only transactions only**. **§10 records the live results and overrides anything earlier in this doc that it contradicts.** Most important: there are **three** cohorts (`public`, `july`, `junedecember2026`), and the registry is already correct.

Paths below are relative to `cipd_erp/`.

---

## 1. Current architecture (as built)

| Layer | File | What it does |
|---|---|---|
| Default schema | `client-next/config.js` | Hardcodes `DEFAULT_SCHEMA = 'july'` |
| Cohort registry | `client-next/migrations/001_cohorts_registry.sql` | `public.cohorts(schema_name PK, label, is_active, created_at, created_by)`, single-active partial unique index. **Seeds only `july`.** |
| Registry reader | `client-next/lib/db.js` `getCohortConfig()` | Reads `public.cohorts` (30 s per-process cache). Falls back to env `COHORT_SCHEMAS`/`COHORT_LABELS` if the table is missing **or empty** |
| Connection pools | `client-next/lib/db.js` `getSchemaDb()` | One `postgres.js` pool per schema (`max: 3`), `search_path = <schema>, public` set as a startup parameter. LRU cap of 6 pools; evicted pools get `conn.end({timeout:5})` |
| Request scoping | `client-next/lib/db.js` `runWithSchema`/`db` Proxy | `AsyncLocalStorage` holds the schema. The exported `db` Proxy resolves to `getSchemaDb(currentSchema)` on every property access |
| Schema resolution | `client-next/lib/cohorts.js` `resolveRequestSchema()` | Admin/faculty: `x-cohort` header if registered, else the active cohort. Student: header if they are a member (a `users` row exists in that schema), else active, else their latest cohort |
| Middleware | `client-next/lib/middleware.js` `withAuth`/`withRole` | Resolves the schema and runs the handler inside `runWithSchema` |
| Frontend header | `client-next/lib/api.js` | `apiFetch`/`apiUpload` add `x-cohort` from `localStorage[<role>_cohort]` |
| Frontend state | `client-next/app/contexts/CohortContext.js`, `app/components/CohortSwitcher.jsx`, `GlobalCohortBar.jsx` (portal into `#cohort-switcher-portal` in each admin page) | Switching writes localStorage, then calls `window.location.reload()` |
| Cohort creation | `client-next/lib/cohorts.js` `createCohort()`; `app/api/admin/cohorts/route.js` (GET/POST/PATCH); `app/components/CreateCohortModal.jsx` | Clones table structure from a **live source schema** with `CREATE TABLE … (LIKE … INCLUDING ALL)`, re-creates FKs, copies staff and reference data, enrols the pasted students, and registers the cohort, all in one transaction |
| Student membership | Implicit: a student belongs to cohort X if `X.users` has a row with their id | No explicit relationship exists anywhere |
| Shared data | `public.wifi_snapshots` (not cloned) | Read through the **Supabase REST client** |
| Legacy Supabase client | `client-next/lib/supabase.js`, `lib/storage.js` | Still used by 9 server files plus Storage |

The data in the cohorts:
- `public` is the original cohort ("Winter 2026", Jan–Jun). It also holds the enum types, `wifi_snapshots` and the `cohorts` registry.
- `july` is the second cohort ("Monsoon 2026"). Labels come from `.env.local` `COHORT_LABELS`.

---

## 2. What is implemented correctly

1. **The request-scoping pattern is sound.** The `db` Proxy re-resolves on every property access (`lib/db.js:46-52`). `AsyncLocalStorage` context carries through awaited promises, so a request stays pinned to its schema, including `db.transaction` (`app/api/admin/faculty-hours/route.js:147,245`).
2. **Every authenticated route uses `withAuth`/`withRole`.** Only `app/api/auth/*` and `app/api/cron/*` do not (verified by scanning all `route.js` files). Those wrap themselves in `runWithSchema(await getActiveSchema())` where they use `db`.
3. **The `x-cohort` header is validated on the server.** It is checked against the registry. Students are limited to cohorts they belong to (`lib/cohorts.js:76-94`). An arbitrary schema name never reaches SQL.
4. **The Drizzle tables are unqualified** (`client-next/drizzle/schema.ts`), so `search_path` decides the target schema.
5. **DDL identifiers are validated and quoted.** See `COHORT_NAME_RE`, `RESERVED_SCHEMAS` and `qid()` in `lib/cohorts.js`.
6. **`createCohort` runs in one transaction**, and PostgreSQL DDL is transactional, so a failure rolls back the schema too. Each student insert uses a savepoint.
7. **The single active cohort is enforced** by the `cohorts_single_active` partial unique index.
8. **Switching reloads the page**, so every page refetches with the new header.
9. **A student keeps one id across cohorts.** `findExistingStudent*` reuses the id, password hash, MAC and device data when the same email is added to a new cohort.
10. **The search_path startup parameter works on the VM** with a direct PostgreSQL connection. On Supabase's transaction pooler it was unreliable; that is no longer a factor unless PgBouncer is added.

---

## 3. Incomplete or broken (with locations)

### 3.1 Registry and configuration
- **B1 – The `public` cohort may be invisible.** `migrations/001_cohorts_registry.sql` seeds only `('july','July',true)`. If the migration ran on the VM, the registry has one row, the env fallback is never used, and:
  - `public` is missing from the switcher;
  - login (`app/api/auth/login/route.js:28`) never searches `public.users`, so students and staff who exist only in `public` **cannot log in**;
  - `resolveRequestSchema` rejects `x-cohort: public`.
  
  If the registry table is missing, the code silently uses `COHORT_SCHEMAS="july,public"` from env, but `createCohort` then fails at the final `INSERT INTO public.cohorts`. **Check V1 in §9.**
- **B2 – Silent env fallback on any error** (`lib/db.js:127-130`). A transient DB error makes cohorts come from env for 30 s. Labels and the active cohort can flip between requests.
- **B3 – Hardcoded `'july'`** in `config.js`, `app/components/CreateCohortModal.jsx:16,94`, `lib/supabase.js`, and as the `DEFAULT_SCHEMA` fallback in many routes (for example `app/api/admin/students/route.js:23,30`). Future cohorts work through the registry, but these fallbacks will point at a stale cohort later.
- **B4 – The registry lives in `public`, which is also a cohort's data schema.** If `public` is used as `sourceSchema`, `createCohort` clones `public.cohorts` (and any other public-only table) into the new cohort (`lib/cohorts.js:325-334` excludes only `wifi_snapshots`).
- **B5 – Edit, delete and archive are not implemented.** `app/api/admin/cohorts/route.js` exposes only GET, POST and PATCH (set active). There are no metadata fields such as dates, status or program.

### 3.2 Schema provisioning (`lib/cohorts.js` `createCohort`)
- **B6 – New cohorts are cloned from a live schema, not from a versioned definition.** `LIKE … INCLUDING ALL` copies columns, defaults, constraints and indexes. It does **not** copy triggers, functions, views, RLS policies, grants, or comments.
  - The code adds one trigger by hand (`trg_auto_enroll_student`).
  - It does **not** add `trg_auto_enroll_course`, which `client-next/scripts/enroll_student.sql:60` creates. In new cohorts, adding a course does not enrol existing students.
  - The views `admin_dashboard_summary`, `faculty_monthly_hours` and `student_attendance_summary` and the RPC `calculate_attendance` are not cloned. The app does not use them today.
- **B7 – Sequence sharing.** `attendance_ping_logs.id` is `bigserial` (`drizzle/schema.ts:11`). `LIKE … INCLUDING DEFAULTS` copies `DEFAULT nextval('<source>.attendance_ping_logs_id_seq')`, so the new cohort uses the **source cohort's sequence**. That is a hidden cross-schema dependency: `DROP SCHEMA <source>` fails or, with CASCADE, removes the new cohort's default. **Check V4.**
- **B8 – Drift between schemas is propagated.** A comment at `app/api/admin/students/route.js:323-324` says `public` lacks the `ON DELETE CASCADE` FKs that `july` has, so the legacy schemas already differ. Cloning copies whichever variant the source has.
- **B9 – No schema version tracking.** Nothing records which migrations each cohort schema has received.

### 3.3 Migrations and tooling
- **B10 – There is no migration runner.** `client-next/scripts/*.sql` are ad-hoc and were applied by hand in the Supabase SQL editor, each to whichever schema was on the path:
  - `migration_notification_stream*.sql` use `SET search_path TO july, public`;
  - `migration_phase2_*.sql` and `settings_migration.sql` hardcode `public.` and `GRANT … TO anon, authenticated, service_role`. Those are Supabase roles that do not exist on a vanilla VM, so the scripts fail there.
  
  `migrations/README.md` still documents `supabase db push`.
- **B11 – Dangerous `drizzle-kit` config.** `client-next/drizzle.config.js` points `schema` at `./lib/schema.js`, which is `export {}` (empty), and the default schema filter is `public`. Running `npx drizzle-kit push` would propose **dropping every table in `public`, which is the original cohort's data.** `drizzle/0000_square_callisto.sql` is a snapshot introspected from `public`. It must never be applied with `drizzle-kit migrate` against a populated DB.

### 3.4 Coverage gaps (routes, workers, services)
- **B12 – `wifi_snapshots` is read through the Supabase REST client** (`supabaseAdmin.schema('public').from('wifi_snapshots')`) in:
  - `app/api/admin/attendance/session-students/route.js:99`
  - `app/api/admin/attendance/sessions-by-date/route.js:92`
  - `app/api/admin/live-students/route.js:14`
  - `app/api/admin/reports/wifi-slots/route.js:104`
  - `app/api/admin/wifi-logs/route.js:50,56`
  - `app/api/cron/process-attendance/route.js:208`
  - `app/api/students/attendance/live/route.js:96`
  - `app/api/students/attendance/presence/route.js:31`
  - `lib/process-session-attendance.js:158`
  
  On the VM these calls either fail or read the **old Supabase cloud project**, not the VM DB.
- **B13 – The router writer posts to Supabase.** `RouterCodesForAttendance/wifi_monitor.py:56-63,365-380` sends `curl -X POST` to `SUPABASE_SNAPSHOTS_URL` with the service key. No snapshots reach the VM DB, so all Wi-Fi attendance on the VM is empty or stale.
- **B14 – File storage uses Supabase Storage.** `lib/storage.js` is used by `app/api/admin/materials`, `app/api/courses/[id]/materials`, `app/api/faculty/materials` and `app/api/students/assignments/[id]/submit`. Existing `file_url` values are bucket paths inside the Supabase project.
- **B15 – The notification service uses Supabase REST and only one schema.** `notification-service/src/config.mjs` requires `SUPABASE_SERVICE_ROLE_KEY`, and `stream.mjs` uses `createClient(...).from('notification_stream')` with `schema = SUPABASE_SCHEMA || 'july'`. Emails queued in any other cohort's `notification_stream` are never sent.
- **B16 – Background jobs process only the active cohort.** These all call `getActiveSchema()`:
  - `app/api/cron/process-attendance/route.js:232`
  - `cron/reminder:152`
  - `cron/feedback-reminder:171`
  - `cron/daily-student-digest:51`
  - `lib/daily-digest.js:106`
  
  When cohorts overlap (a new one starts before the old one ends), the non-active one gets no attendance processing, reminders or digests. `scripts/attendance-worker.js` and `daily-digest-worker.js` pass no schema.
- **B17 – `app/api/admin/setup/route.js`** runs `CREATE TABLE IF NOT EXISTS notifications … DEFAULT uuid_generate_v4()` unqualified. On the VM, uuid-ossp lives in the `extensions` schema, which is not on the search path, so this fails. It is one-off DDL from an HTTP route and should be removed.

### 3.5 Frontend
- **B18 – Duplicate in-page cohort selectors.**
  - `app/admin/students/page.jsx:790-886,1011-1022` keeps its own `schema` state and pills. It writes `localStorage.admin_cohort` without a reload and sends both `?schema=` and `x-cohort`, so the sidebar shows a different cohort until the next reload.
  - `app/admin/reports/page.jsx:323,343` defaults the student-report export to the **active** cohort, not the selected one, and uses a raw `fetch` (line 980) instead of `apiFetch`.
- **B19 – Routes accept `?schema=` or `body.schema` in addition to the header:**
  - `app/api/admin/students/route.js`
  - `admin/enrollments`
  - `admin/students/attendance-summary`
  - `admin/reports/students`
  - `admin/students/reset-password`
  
  These are validated, but having two sources of truth makes mismatches possible: for example, courses come from the header and students from the query.

### 3.6 Identity and authentication across schemas
- **B20 – Password reset is broken for multi-cohort users.**
  - `app/api/auth/reset-password/route.js:56-74` updates the hash in the **first** schema (registry order, oldest first) and `break`s.
  - Login (`auth/login`) checks the hash from `pickDefaultCohort`, which prefers the **active** cohort.
  - So a student in both `public` and `july` resets the password in `public`, then logs in against `july`'s old hash and fails.
  - `app/api/auth/update-password` and `app/api/admin/settings/password` update only the currently selected schema.
  
  Passwords diverge per cohort.
- **B21 – Staff identity is per schema, but admin access is global.** An admin JWT can act on any registered cohort. If the admin's `users` row is absent there (for example an admin created after the cohort was cloned), FK columns fail with FK violations: `sessions.created_by` (`admin/sessions/route.js:110`), `leave_requests.reviewed_by` (`admin/leave-requests/[id]/route.js:49`), `session_materials.uploaded_by`. Deactivating an admin in one schema does not revoke access to the others.
- **B22 – The membership cache** (`lib/cohorts.js` `_membershipCache`, 60 s) is invalidated on cohort creation only, not when admins add or delete students.

---

## 4. Critical data-isolation and integrity risks (ranked)

1. **Silent fall-through to `public` (cross-cohort read/write).** Every cohort pool uses `search_path = <cohort>, public` (`lib/db.js:21,77`), and `public` *is* the Winter 2026 cohort. If a table is missing from a cohort schema, which happens with drift (B8) and hand-applied migrations (B10), unqualified queries **silently read and write the Winter cohort's table** with no error. This is the most dangerous isolation flaw. Run check V3.
2. **`drizzle-kit push` footgun (B11)** could drop the original cohort's tables.
3. **Pool eviction mid-request.**
   - At most 6 schema pools are kept. `auth/login`, `auth/me`, `auth/reset-password` and `students/profile` loop over **all** schemas, and each iteration calls `getSchemaDb`.
   - With 6 or more cohorts, a login evicts pools that other in-flight requests still use. `conn.end({timeout:5})` then kills their queries after 5 s, and later calls through the stale reference fail.
   - Budget: up to (6 × 3) + 3 = 21 connections per Next.js process, plus workers, against PostgreSQL's default `max_connections = 100`.
4. **Non-transactional multi-step writes.**
   - `DELETE /api/admin/students` (`route.js:327-366`) deletes from 7 tables in sequence without a transaction. It misses `leave_requests`, `attendance_ping_logs`, `student_attendance_marks`, `student_course_attendance` and `notification_stream`, which cascade in `july` but per the comment not in `public`, so it can fail halfway and leave a half-deleted student.
   - `POST` uses manual compensation (insert user, then insert student, deleting the user on failure) instead of a transaction.
5. **Password divergence (B20)** leads to locked-out students and security confusion. Revoking access in one cohort does not revoke the others (B21).
6. **Hidden sequence dependency (B7)** makes safe cohort deletion impossible today.
7. **Wi-Fi data from the wrong database (B12/B13).** Attendance on the VM is computed from Supabase-cloud data or from nothing.
8. **Weak default password for new students.** `POST /api/admin/students` sets the password to the constant `'12345678'` (`route.js:184`). `createCohort` uses a random one (inconsistent).
9. **Cohort membership is implicit.** Nothing stops a student row being inserted into the wrong cohort, because "cohort" is just whatever `schema` the client sent.

---

## 5. Deployment issues (Supabase → college VM)

| # | Issue | Where | Action |
|---|---|---|---|
| D1 | `wifi_snapshots` read via Supabase REST | 9 files (B12) | Replace with direct SQL through `connection` |
| D2 | Router posts snapshots to Supabase REST | `RouterCodesForAttendance/wifi_monitor.py` | Add an app ingest endpoint and repoint the router |
| D3 | Supabase Storage for materials and submissions | `lib/storage.js` | Local filesystem storage plus an authenticated download route; migrate existing bucket objects **while the Supabase project still exists** |
| D4 | notification-service on Supabase REST, single schema | `notification-service/src/*.mjs` | Rewrite on `postgres` and loop over the running cohorts |
| D5 | `extensions.uuid_generate_v4()` column defaults | `drizzle/schema.ts` (15 uses); real DB defaults | VM must have `CREATE SCHEMA extensions; CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;` (check V5); long term, switch to built-in `gen_random_uuid()` |
| D6 | Supabase roles in SQL (`anon`, `authenticated`, `service_role`), RLS enabled without policies | `scripts/migration_phase2_*.sql`, `settings_migration.sql`; `createCohort` copies `relrowsecurity` | Don't reuse. If the app ever connects as a non-owner role, RLS-enabled tables with no policies return **zero rows**; decide explicitly (check V6) |
| D7 | Supabase env and secrets still configured | `client-next/.env`, `.env.example`, `.github/workflows/deploy.yml` | Remove after D1–D4. Rotate the Supabase service key. `.env` also has a stray trailing comment that looks like a credential fragment; clean it up |
| D8 | Migration docs and tools assume Supabase | `migrations/README.md`, `drizzle.config.js` | Replace with the runner in Step 3 |
| D9 | App likely connects as `postgres` superuser | `.env` `DATABASE_URL` | Create a least-privilege `cipd_app` role that owns the cohort schemas (Step 10) |

---

## 6. Student and cohort data model: problems and recommendation

### Problems
- A "cohort" is only a schema name string. It has no id, dates, status, program or description, and it is entered as free text in `CreateCohortModal`.
- Student-to-cohort membership is implicit, inferred by probing `"<schema>".users` with a `UNION ALL` (`lib/cohorts.js` `getUserCohorts`). One missing `users` table breaks the probe for all cohorts.
- Which cohort a student is added to is decided by the request's `schema`, query or body, or the header. Nothing in the DB states or checks it.
- Identity (email, password, active flag) is duplicated per schema and drifts (B20, B21).
- `program_name` is free text ("e.g. MBA, BBA").
- There is no transfer or "change cohort" operation. Doing it by hand means deleting the student (and their history) from one schema and re-adding them in another.

### Recommendation: keep schema-per-cohort, add a central `core` schema

You don't need a rewrite. Per-cohort operational data stays in the cohort schemas. Add a small central schema that **owns identity, cohorts and membership**, and use cross-schema foreign keys (PostgreSQL supports these within one database) so the database enforces the rules.

```sql
CREATE SCHEMA core;

CREATE TYPE core.cohort_status AS ENUM ('provisioning','running','archived','failed','deleting');

CREATE TABLE core.cohorts (
  id            smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug          text NOT NULL UNIQUE CHECK (slug ~ '^[a-z][a-z0-9_]{2,40}$'),
  schema_name   text NOT NULL UNIQUE,            -- immutable after creation
  label         text NOT NULL,
  program       text,                            -- or FK to core.programs
  starts_on     date,
  ends_on       date,
  status        core.cohort_status NOT NULL DEFAULT 'provisioning',
  is_default    boolean NOT NULL DEFAULT false,  -- replaces is_active: admin UI default only
  schema_version int NOT NULL DEFAULT 0,
  is_legacy     boolean NOT NULL DEFAULT false,  -- true for public/july: never droppable
  created_by    uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);
CREATE UNIQUE INDEX cohorts_single_default ON core.cohorts ((true)) WHERE is_default;

CREATE TABLE core.accounts (            -- global identity; ids = existing users.id values
  id            uuid PRIMARY KEY,
  email         text NOT NULL,
  password_hash text NOT NULL,
  role          public.user_role NOT NULL,  -- moved to core.user_role in step 2
  is_active     boolean NOT NULL DEFAULT true,
  enrollment_no text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX accounts_email_uq ON core.accounts (lower(email));
CREATE UNIQUE INDEX accounts_enrollment_uq ON core.accounts (enrollment_no) WHERE enrollment_no IS NOT NULL;

CREATE TABLE core.cohort_memberships (
  account_id uuid NOT NULL REFERENCES core.accounts(id) ON DELETE RESTRICT,
  cohort_id  smallint NOT NULL REFERENCES core.cohorts(id) ON DELETE RESTRICT,
  status     text NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled','transferred_out','withdrawn','completed')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  left_at    timestamptz,
  PRIMARY KEY (account_id, cohort_id)
);

CREATE TABLE core.schema_migrations (
  cohort_id  smallint REFERENCES core.cohorts(id) ON DELETE CASCADE,  -- NULL = core migration
  version    text NOT NULL,
  checksum   text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, version)
);
```

**Enforcement inside each cohort schema.** These are added by a cohort migration, with `<ID>` replaced at provisioning time:

```sql
ALTER TABLE students ADD COLUMN cohort_id smallint;
UPDATE students SET cohort_id = <ID>;
ALTER TABLE students
  ALTER COLUMN cohort_id SET NOT NULL,
  ALTER COLUMN cohort_id SET DEFAULT <ID>,
  ADD CONSTRAINT students_cohort_is_this CHECK (cohort_id = <ID>),
  ADD CONSTRAINT students_membership_fk FOREIGN KEY (id, cohort_id)
      REFERENCES core.cohort_memberships (account_id, cohort_id) ON DELETE RESTRICT;
ALTER TABLE users ADD CONSTRAINT users_account_fk FOREIGN KEY (id) REFERENCES core.accounts(id) ON DELETE RESTRICT;
```

What this guarantees at the DB level:
- A `students` row cannot exist in a schema without a membership row for **that** cohort.
- A membership cannot point at a nonexistent cohort.
- A cohort that still has members cannot be deleted from the registry (`RESTRICT`).
- Every per-schema user is a real global account.

**Application rules:**
- Add a student: `POST /api/admin/students` with a required `cohort_id` chosen from a dropdown fed by `GET /api/cohorts`. The backend validates that the cohort exists and is `running` or `provisioning` (not archived, failed or deleting). In **one transaction** it upserts `core.accounts`, inserts `core.cohort_memberships`, then inserts `<schema>.users` and `<schema>.students` (and course enrolments).
- The x-cohort header no longer decides where a student is created. The body's `cohort_id` does, and it is validated.
- Edit student: identity fields (name, email, enrollment_no, password, is_active) are updated in `core.accounts` and mirrored to every schema where a membership exists, in one transaction. Cohort-specific fields (MAC, program) stay in the cohort schema.
- Change cohort (transfer): one transaction. Insert a membership plus schema rows in the target cohort. Set the source membership to `transferred_out` with `left_at`, and set the source `users.is_active=false`. History stays in the source cohort. Never delete and re-create.
- Remove a student from a cohort: soft (`withdrawn`, deactivate). A hard delete is a separate admin action, done in one transaction, that relies on FK cascades fixed by migration.
- Login, reset and update password read and write only `core.accounts`. Membership comes from `core.cohort_memberships`, which replaces the `UNION ALL` probe.
- `program_name`: optional. Add `core.programs(id, name)` and a FK, or at least a dropdown of distinct values. Lower priority.

---

## 7. Is the architecture suitable for future cohorts?

**Not reliably as it stands, but yes after the fixes below**, with no rewrite. Schema-per-cohort fits this ERP well: cohorts are independent, all code is unqualified Drizzle, and request scoping already works. The blockers are:
- the fall-through `search_path`;
- cloning from a live, drifting schema with no versioned migrations;
- per-schema identity;
- LRU pool eviction;
- background jobs that only see the active cohort;
- the Supabase leftovers.

Once those are fixed, adding a cohort becomes a registry insert plus running the versioned cohort migrations into a new schema, with no code changes. That scales comfortably to dozens of cohorts. Archived cohorts can be dumped and dropped later.

---

## 8. Implementation plan (prioritized, for the implementing model)

General rules for every step:
- **Never** modify or drop data in `public` or `july` except through the migrations listed here.
- Take a `pg_dump -Fc` of the whole DB before Steps 2, 4 and 5.
- Every SQL migration must be idempotent and run inside a transaction.
- Do not run `drizzle-kit push` or `drizzle-kit migrate` at any point.

### Step 0 – Verify the live state (blocking)
Run the read-only queries in §9 on the VM and record the results in this file. In particular:
- Is `public.cohorts` present, and with which rows (V1)?
- Do the table sets differ between `public` and `july` (V2, V3)?
- Are sequences shared (V4)?
- Does `extensions.uuid_generate_v4` exist (V5)?
- Which role does the app connect as (V6)?

### Step 1 – Immediate safety fixes (small, no schema change)
1. `client-next/drizzle.config.js`: make it unusable for push. Either delete the file and remove the `drizzle-kit` devDependency, or set `schemaFilter: ['__none__']` and add a big warning comment. Add a note to `migrations/README.md`.
2. Register `public` if V1 shows it missing. Do this through the migration in Step 2, or as a temporary `INSERT INTO public.cohorts(schema_name,label,is_active) VALUES ('public','Winter 2026',false) ON CONFLICT DO NOTHING;` (label from `.env.local`). Also update the label of `july` to "Monsoon 2026".
3. `lib/db.js` `getCohortConfig`:
   - fall back to env **only** when the table does not exist (SQLSTATE `42P01`);
   - on other errors, serve the last good cached value, or throw.
4. `lib/db.js` pools:
   - remove the LRU eviction;
   - create each schema pool with `{ max: 2, idle_timeout: 20, max_lifetime: 60*30, prepare: false }` so idle pools release their connections on their own;
   - keep the Map on `globalThis`.
5. `auth/login`, `auth/me`, `auth/reset-password`, `students/profile`, `students/attendance/sessions`, `admin/students/reset-password`: stop looping `getSchemaDb` over all schemas. For now, use a single `connection.unsafe` query with `qid()`-qualified table names (as `getUserCohorts` does). Step 6 replaces this with `core.accounts`.
6. Wrap `POST`, `PATCH` and `DELETE` in `app/api/admin/students/route.js` in `schemaDb.transaction(async tx => …)`. Remove the manual compensation deletes. Add the missing child tables to DELETE (leave_requests, attendance_ping_logs, student_attendance_marks, student_course_attendance, notification_stream by recipient_id). Replace the `'12345678'` default with a random password plus a reset email (as `createCohort` does).
7. Call `invalidateMembershipCache()` after student add, delete and transfer.

### Step 2 – The `core` schema and moving shared objects out of `public`
Create `client-next/migrations/core/0001_core.sql`:
1. `CREATE SCHEMA IF NOT EXISTS core;`
2. Create the `core.*` tables from §6.
3. Copy the registry into `core.cohorts`: `public` → `is_legacy=true`, status `archived` or `running` as the admin decides; `july` → `is_legacy=true`, `running`, `is_default=true`. Keep `public.cohorts` until Step 6 is deployed, then drop it in a later migration.
4. Move the shared objects with `ALTER … SET SCHEMA core`. Columns reference types by OID, so this is safe for every schema:
   - `public.attendance_status`, `feedback_question_type`, `session_status`, `user_role`
   - `public.wifi_snapshots` and its sequence
5. Change pool search paths in `lib/db.js`:
   - cohort pools: `search_path = "<schema>", core`;
   - main connection: `core`;
   - legacy `public` cohort: `public, core`.
   
   **This removes the silent fall-through to the Winter cohort.**
6. Update `lib/db.js` and `lib/cohorts.js` to read `core.cohorts`. `getCohortConfig` returns `{ cohorts: [{id, slug, schema, label, status, is_default, starts_on, ends_on}], default }`. Keep the `schemas`, `labels` and `active` keys as derived fields so existing callers keep working, with `active` becoming the `is_default` cohort.

### Step 3 – Migration runner (VM-native, no Supabase)
Create `client-next/scripts/migrate.mjs` (node + `postgres`, reads `DATABASE_URL`):
- Take `pg_advisory_lock(hashtext('cipd_migrations'))`.
- Apply `migrations/core/NNNN_*.sql` once each, recorded with `cohort_id = NULL`.
- For each cohort in `core.cohorts` where status is not `deleting`, apply `migrations/cohort/NNNN_*.sql` in order:
  - one transaction per cohort per file;
  - `SET LOCAL search_path TO "<schema>", core` before the file;
  - substitute `:cohort_id` and `:schema` placeholders;
  - record a sha256 checksum in `core.schema_migrations`;
  - refuse to run if the checksum of an already-applied file has changed;
  - update `core.cohorts.schema_version`.
- Continue with the other cohorts if one fails. Mark the failed cohort in the output and exit non-zero.
- Support `--dry-run` and `--cohort <slug>`.
- Add `"migrate": "node scripts/migrate.mjs"` to `package.json` and a `npm run migrate` step to `.github/workflows/deploy.yml` before `pm2 restart`.

Rewrite `migrations/README.md` for this runner. Move `client-next/scripts/*.sql` to `migrations/archive/` as reference only.

### Step 4 – Baseline and reconcile the legacy schemas
1. Generate `migrations/cohort/0001_baseline.sql` from **`july`** with `pg_dump --schema-only --schema=july --no-owner --no-privileges`, then strip the `july.` qualifiers. Remove RLS, policies and Supabase GRANTs. Use `gen_random_uuid()` defaults. Use `bigint GENERATED BY DEFAULT AS IDENTITY` instead of `bigserial`, so each cohort gets its own sequence. Include both auto-enroll triggers and functions, and all FKs with the intended `ON DELETE` rules.
2. The baseline is **only applied to new cohorts**. For `july` and `public`, write `migrations/cohort/0002_reconcile_legacy.sql`. It must be idempotent and guarded with `IF NOT EXISTS` and `DO $$ … $$` blocks, and it brings an existing schema up to the baseline:
   - creates missing tables (`notification_stream`, etc., per V2);
   - adds missing columns and indexes;
   - replaces FKs to match the cascade rules;
   - recreates triggers;
   - for each `bigserial` column whose default points at another schema's sequence (V4), creates a schema-local sequence, sets its value to `max(id)+1` and repoints the default.
   
   The runner records `0001` as applied for legacy cohorts **without executing it** (`is_legacy` → mark baseline only).
3. Add a `scripts/check-schema-drift.mjs` that compares `information_schema.columns`, `pg_constraint` and `pg_indexes` for every cohort against the newest non-legacy cohort, or against a scratch schema built from the baseline and then dropped. Run it in CI and deploy and fail on any difference.

### Step 5 – Identity and membership (structured student model)
1. `migrations/core/0002_accounts_backfill.sql`:
   - insert into `core.accounts` from all cohort `users` tables, deduplicated by id;
   - on email conflicts with different ids, **stop and report**: write the conflicts to `core.account_conflicts` and resolve by hand;
   - `password_hash` comes from the default cohort's row if present, else the most recently updated one;
   - insert `core.cohort_memberships` for every (users.id, cohort) pair where role = 'student'; staff need no membership, because admins are global.
2. `migrations/cohort/0003_membership_fk.sql`: add the `students.cohort_id`, CHECK, composite FK and `users_account_fk` from §6 to every cohort.
3. Keep `users.password_hash` in the schemas for now (NOT NULL), but stop reading it. A later migration can relax it.

### Step 6 – Backend rewrite of auth and student and cohort APIs
1. `lib/accounts.js` (new): `findAccountByLogin(identifier)`, `getMemberships(accountId)`, `updateAccount(id, patch)`. `updateAccount` writes to `core.accounts` and mirrors name, email and active flag to each member schema's `users` in **one** transaction via `connection.begin`.
2. `auth/login`: authenticate against `core.accounts`. Default cohort: the default cohort if the user is a member, else the latest running membership. Staff get all cohorts.
3. `auth/reset-password`, `auth/update-password` and `admin/settings/password`: update only `core.accounts.password_hash`.
4. `lib/cohorts.js` `getUserCohorts`: read `core.cohort_memberships` where status = 'enrolled'.
5. `resolveRequestSchema`:
   - admin: any non-`deleting` cohort;
   - faculty: cohorts where their `users` row exists, or a later `core.cohort_staff` table;
   - student: memberships only.
   - Before running an admin handler, ensure the admin's `users` row exists in that schema (`INSERT … SELECT FROM core.accounts ON CONFLICT DO NOTHING`), which fixes B21.
6. Students API: replace `app/api/admin/students/route.js` with:
   - `GET /api/admin/students` (cohort from header only; drop `?schema=`).
   - `POST /api/admin/students` with body `{cohort_id (required), first_name, last_name, email, enrollment_no?, program?}`. Validate that the cohort exists and is `running` or `provisioning`, then do everything in one transaction as in §6. Return 422 if the cohort is invalid.
   - `PATCH /api/admin/students/[id]`: identity fields go through `updateAccount`; cohort-scoped fields are updated in the selected schema.
   - `POST /api/admin/students/[id]/transfer` with body `{from_cohort_id, to_cohort_id}`: one transaction, as in §6.
   - `DELETE /api/admin/students/[id]?mode=withdraw|purge`: the default `withdraw` is soft; `purge` is one transaction.
7. Remove the `schema` query/body overrides from `admin/enrollments`, `admin/students/attendance-summary`, `admin/reports/students` and `admin/students/reset-password`. Use `req.cohort` only.
8. Delete `app/api/admin/setup/route.js`.

### Step 7 – Cohort lifecycle APIs
In `lib/cohorts.js` plus `app/api/admin/cohorts/route.js` and `[id]/route.js`:
- **Create** `POST {slug, label, program?, starts_on, ends_on, copy_reference_from?: cohort_id, students?: [...], make_default}`:
  1. Insert into `core.cohorts` with status `provisioning`, and commit, so a failure is visible and retryable.
  2. In one transaction: `CREATE SCHEMA`, run every `migrations/cohort/*` file through the shared runner function (not `LIKE` cloning), copy the reference tables from `copy_reference_from` (`COPY_TABLES` minus `google_tokens`), insert staff `users` rows from `core.accounts`, enrol the students through the same function the students API uses, and set status `running`.
  3. On failure, roll back the schema, set status `failed` with an `error` column, and let the admin retry or delete.
  
  Remove the `LIKE`-based clone code completely.
- **Edit** `PATCH /api/admin/cohorts/[id]`: label, program, dates, status (`running`↔`archived`), `is_default`. `slug` and `schema_name` are immutable.
- **Delete** `DELETE /api/admin/cohorts/[id]`:
  - reject if `is_legacy`, `is_default`, or status `running`;
  - require the typed slug as confirmation in the body;
  - set status `deleting`, run `pg_dump -n <schema>` to `BACKUP_DIR` (or require the admin to confirm a backup exists);
  - `DROP SCHEMA … CASCADE` and delete the memberships and the registry row in one transaction.
  
  Prefer **archive** in the UI; make hard delete a secondary action.
- `invalidateCohortCache()` after every mutation. Note that the cache is per process: with PM2 cluster mode, keep the TTL short or use `LISTEN/NOTIFY` on a `cohorts_changed` channel.

### Step 8 – Background processes over all running cohorts
1. Add `lib/cohort-jobs.js` with `forEachRunningCohort(fn)`. It loops over cohorts with status `running` and calls `runWithSchema(schema, fn)` for each, catching errors per cohort.
2. Use it in `cron/process-attendance`, `cron/reminder`, `cron/feedback-reminder`, `cron/daily-student-digest` and `lib/daily-digest.js` (keep the optional `?cohort=` filter).
3. `notification-service`: drop `@supabase/supabase-js`. Use `postgres` with `DATABASE_URL`, read `core.cohorts`, and for each running cohort poll `"<schema>".notification_stream` with `FOR UPDATE SKIP LOCKED` (the same claim logic as now, rewritten in SQL). Remove the `SUPABASE_*` requirements from `config.mjs`.

### Step 9 – Remove the Supabase dependencies (VM deployment)
1. Replace every `supabaseAdmin.schema('public').from('wifi_snapshots')` call (the 9 files in B12) with a helper in `lib/wifi-snapshots.js` that queries `core.wifi_snapshots` via `connection`. Keep the same filters, ordering and limits; map PostgREST `.gte/.lte/.order/.limit/.range/count:'exact'` one to one.
2. Add `POST /api/ingest/wifi-snapshots` (auth with the `x-ingest-secret` header, `WIFI_INGEST_SECRET` env var; body `{captured_at, iw_dump, error?}`) that inserts into `core.wifi_snapshots`. Update `RouterCodesForAttendance/wifi_monitor.py` to POST there (`SNAPSHOT_INGEST_URL`, `SNAPSHOT_INGEST_SECRET`) and update its `.env.example`.
3. Storage: rewrite `lib/storage.js` against the local filesystem (`STORAGE_DIR`, with sanitized paths under `<cohort>/<bucket>/…`). Add an authenticated `GET /api/files/[...path]` that checks the requester's cohort and role, and make `resolveFileUrl` return that route. Write `scripts/migrate-supabase-storage.mjs` to download all existing bucket objects into `STORAGE_DIR` with the same keys. **Run it before the Supabase project is shut down** (check whether it still exists).
4. Delete `lib/supabase.js`, remove `@supabase/supabase-js` from `client-next` and `notification-service`, and remove the `SUPABASE_*` variables from `.env.example`, `deploy.yml` and the docs. Rotate or revoke the old Supabase keys.
5. Make sure the VM DB has the `extensions` schema with `uuid-ossp` until the baseline (`gen_random_uuid`) has replaced all defaults (V5).

### Step 10 – Database roles (VM hardening)
- Create the role `cipd_app` (LOGIN, non-superuser).
- Make it the owner of `core` and of all cohort schemas, so it can provision new schemas: `GRANT CREATE ON DATABASE cipd TO cipd_app`.
- Point `DATABASE_URL` at it.
- Disable RLS on cohort tables (`ALTER TABLE … DISABLE ROW LEVEL SECURITY` in a cohort migration), since access control is done in the app. This keeps behaviour unchanged when the app no longer runs as the owner or superuser.

### Step 11 – Frontend
1. `app/admin/students/page.jsx`:
   - remove the local `schema` state, the pills and the `cohorts` fetch (lines ~787-886, 1004-1030); use `useCohort().selectedCohort`;
   - `AddStudentModal`: add a **required `<select>` of cohorts** (from `useCohort().cohorts`, filtered to status `running`/`provisioning`, defaulting to the selected cohort) that sends `cohort_id`;
   - `StudentDrawer`: add a "Transfer to cohort" action that calls the transfer endpoint;
   - replace the free-text `program_name` with a select if `core.programs` is added.
2. `app/admin/reports/page.jsx`: default `studSchema` to `selectedCohort`, and use `apiFetch` (or add a `apiDownload` helper in `lib/api.js` that sends `x-cohort`) instead of the raw `fetch` at line 980.
3. `CreateCohortModal.jsx`:
   - fields for label, slug (auto from label), program, start and end dates, the reference-data source (dropdown of cohorts, default = the default cohort, no hardcoded `'july'`), and students;
   - show the `provisioning`/`failed` status and a retry button.
4. `CohortSwitcher.jsx`: list cohorts grouped by status (Running / Archived), show dates, and add an admin "Manage cohorts" entry that opens a new `app/admin/cohorts/page.jsx` (edit, archive, delete).
5. `config.js`: remove `DEFAULT_SCHEMA` usage from frontend code. The server's default comes from the registry.

### Step 12 – Tests and verification
- `scripts/test-cohort-isolation.mjs`, run against a scratch database:
  1. provision two cohorts;
  2. create a student in A;
  3. check that GET students with `x-cohort: B` does not return them;
  4. check that a student token with `x-cohort: B` resolves to A;
  5. drop a table from B and check that queries **error** rather than reading A or `public`;
  6. transfer A→B and check that the memberships and `is_active` are correct;
  7. check that inserting into `B.students` without a membership fails on the FK;
  8. check that deleting a cohort with members fails.
- Run `scripts/check-schema-drift.mjs` after each migration.
- By hand on the VM: log in as a student who is in both `public` and `july`, reset the password, and log in again.

---

## 9. Read-only verification queries for the VM (Step 0)

```sql
-- V1 registry contents
SELECT * FROM public.cohorts ORDER BY created_at;

-- V2 table-set differences between legacy cohorts
SELECT table_name, array_agg(table_schema ORDER BY table_schema) AS present_in
FROM information_schema.tables
WHERE table_schema IN ('public','july') AND table_type='BASE TABLE'
GROUP BY table_name HAVING count(*) < 2 ORDER BY 1;

-- V3 column differences
SELECT table_name, column_name, string_agg(table_schema||':'||data_type, ', ') d
FROM information_schema.columns WHERE table_schema IN ('public','july')
GROUP BY table_name, column_name HAVING count(DISTINCT data_type) > 1 OR count(*) < 2 ORDER BY 1,2;

-- V4 defaults pointing at another schema's sequence
SELECT n.nspname, c.relname, a.attname, pg_get_expr(d.adbin, d.adrelid) AS default_expr
FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
WHERE pg_get_expr(d.adbin, d.adrelid) LIKE 'nextval%';

-- V5 uuid functions available
SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.proname IN ('uuid_generate_v4','gen_random_uuid');

-- V6 connecting role and RLS state
SELECT current_user, usesuper FROM pg_user WHERE usename=current_user;
SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relrowsecurity AND n.nspname IN ('public','july');

-- V7 identity overlap / divergence across legacy cohorts
SELECT p.id, p.email, (p.password_hash = j.password_hash) AS same_hash
FROM public.users p JOIN july.users j ON j.id = p.id;
SELECT p.email, p.id AS public_id, j.id AS july_id
FROM public.users p JOIN july.users j ON lower(j.email)=lower(p.email) AND j.id <> p.id;

-- V8 triggers per schema
SELECT event_object_schema, event_object_table, trigger_name FROM information_schema.triggers
WHERE event_object_schema IN ('public','july') ORDER BY 1,2;

-- V9 is wifi_snapshots being written on the VM?
SELECT max(captured_at), count(*) FROM public.wifi_snapshots;
```

Use V7 to plan the identity backfill in Step 5. Rows with the same email but different ids must be resolved by hand before `core.accounts` gets its unique email index.

---

## 10. Live VM database findings (2026-11-03, read-only)

Server: PostgreSQL 16.15 (Ubuntu 24.04), database `cipd`, `max_connections = 100`. The app connects as **`postgres` (superuser)**.

### 10.1 Cohorts and registry
`public.cohorts` exists, and all three cohort schemas are registered:

| schema | registry label | is_active | sessions (dates) | users (admin / faculty / student) |
|---|---|---|---|---|
| `public` | Winter 2026 | false | 2026-01-05 → 2026-07-01 (367) | 1 / 38 / 21 |
| `july` | July | false | 2026-06-29 → 2026-10-09 (183) | 1 / 44 / 26 |
| `junedecember2026` | June-December 2026 | **true** | 2026-10-19 → 2026-10-23 (16) | 1 / 44 / 24 |

- **B1 does not apply on the VM.** `public` is registered and visible. The `july` label is still "July", while `.env.local` calls it "Monsoon 2026"; fix the label in the registry.
- `junedecember2026` was created through the app's `createCohort` on 2026-10-18, with `july` as the source. It shares **67 user ids with `july`** (22 students and all the staff), and they still have identical password hashes. **Question for the owner:** is `junedecember2026` a new batch, or the second phase of the `july` batch? 22 of its 24 students are the same people. The answer decides whether `july` should be marked `archived`.
- Other schemas restored from Supabase still exist: `auth`, `storage`, `realtime`, `vault`, `graphql`, `graphql_public`, `extensions`. Supabase roles (`anon`, `authenticated`, `service_role`) do **not** exist. `storage.objects` is empty.
- `extensions.uuid_generate_v4` and `gen_random_uuid` are both available. Each of `public` and `july` has 14 columns defaulting to `extensions.uuid_generate_v4()`, which works. **Do not drop the `extensions` schema** until Step 4 replaces those defaults.

### 10.2 Structural consistency
- **Columns:** `public`, `july` and `junedecember2026` have identical columns for every shared table. There is no column drift.
- **Tables:** `cohorts` exists only in `public`. `wifi_snapshots` exists in `public` and in `july`; `july.wifi_snapshots` is an empty, unused copy, and `junedecember2026` correctly has none. The views (`admin_dashboard_summary`, `faculty_monthly_hours`, `student_attendance_summary`) and the function `calculate_attendance` exist **only in `public`**. Under the current `search_path`, querying one of these views from `july` or `junedecember2026` would silently return **Winter 2026 data**. That is a live example of risk §4.1. The app does not use them today, but `drizzle/schema.ts` exports them.
- **Foreign keys: `public` has 44 and `july`/`junedecember2026` have 30.** The 14 missing from `july` (and so from its clone `junedecember2026`):
  - `attendance_ping_logs_session_id_fkey`, `attendance_ping_logs_student_id_fkey`
  - `google_tokens_user_id_fkey`
  - `leave_requests_reviewed_by_fkey`, `leave_requests_session_id_fkey`, `leave_requests_student_id_fkey`
  - `session_skills_session_id_fkey`, `session_skills_skill_id_fkey`
  - `sessions_category_id_fkey`
  - `student_attendance_marks_course_id_fkey`, `student_attendance_marks_session_id_fkey`, `student_attendance_marks_student_id_fkey`
  - `student_course_attendance_course_id_fkey`, `student_course_attendance_student_id_fkey`
  
  The `ON DELETE` rules also differ: `public` mostly uses CASCADE, `july` mostly NO ACTION. **The comment at `app/api/admin/students/route.js:323` has it backwards.**
- **Existing orphans:** `july.session_skills` has **443 rows that point at sessions that don't exist**. `junedecember2026` has none, and `july.leave_requests` has no student orphans. Step 4's reconcile migration **must move those 443 rows into an archive table** (for example `july._orphan_session_skills`) **before** adding the FK; do not delete them. Adding the FK without that step fails.
- **Triggers:** `trg_auto_enroll_course` (on `courses`) exists only in `public`. All three schemas have `trg_auto_enroll_student`. `public` also has the extra functions `auto_enroll_all_in_new_course` and `auto_enroll_new_student`.
- **RLS:** enabled on 25 tables in `public` and 1 each in `july` and `junedecember2026`, with **no policies**. It is harmless only because the app is a superuser (D6, Step 10).
- **Indexes:** 76 in `public`, 75 in `july`, 74 in `junedecember2026` (the difference is `wifi_snapshots` and `cohorts`). This needs no action beyond the drift checker.

### 10.3 Sequences (B7 confirmed, and worse than predicted)
`july.attendance_ping_logs.id`, `junedecember2026.attendance_ping_logs.id` and `july.wifi_snapshots.id` all take their ids from **`public.attendance_ping_logs_id_seq` / `public.wifi_snapshots_id_seq`**. All cohorts therefore depend on objects in `public`. Step 4 must give each cohort its own identity column or sequence. Currently `last_value = 46`, and the ping-log tables in `july` and `junedecember2026` are empty, so the change is trivial now.

### 10.4 Identity
- `july`∩`public` share **0** ids. `junedecember2026`∩`july` share 67. `junedecember2026`∩`public` share 0.
- **Two different admin accounts exist.** One is only in `public`. The other is in `july` and `junedecember2026` (this one created the newest cohort). Each admin cannot safely act on the other admin's cohorts, because FK columns such as `sessions.created_by` and `leave_requests.reviewed_by` will fail (B21 confirmed).
- **Same email, different id:** 2 students across `july`/`public`, 2 across `junedecember2026`/`public`, and 1 across `junedecember2026`/`july`. These must be resolved by hand before `core.accounts` gets its unique email index (Step 5). Write them to `core.account_conflicts` and have the admin decide.
- No case-insensitive duplicate emails exist within a schema. No duplicate enrollment numbers exist across `public`/`july`. There are no `students` rows without a `users` row, and no student users without a `students` row.
- `program_name` really is loosely structured: the values are `iPD-CP`, `IPDCP 2026`, `ipdcp`, `B.Tech`, `B.Tech CSE` and NULL. One `junedecember2026` student has NULL `enrollment_no` and NULL `program_name`. This supports adding `core.programs` (optional §6 item); normalise those values during the backfill.

### 10.5 Production symptoms of the Supabase leftovers
- **Wi-Fi attendance is not being collected on the VM.** The newest row in `public.wifi_snapshots` is **2026-09-22** (61,481 rows since 2026-03-12). Nothing has arrived since the move, including the whole `junedecember2026` cohort, which started 2026-10-19. `attendance_ping_logs` is empty in `july` and `junedecember2026`. **This makes Step 9.1–9.2 (snapshot reads and ingest endpoint) the top priority.**
- **Emails are stuck.** `junedecember2026.notification_stream` has **45 `queued`, 22 `failed` and 1 `retry`**, the newest from 2026-10-21. `july` shows 93 sent and 20 failed, with the last activity on 2026-10-14. The notification service (Supabase REST, schema `july`) is not delivering the active cohort's emails (B15 confirmed). Once Step 8.3 is done, review the 45 queued rows before draining them; they may be stale reminders.
- **Storage:** there are no uploaded materials or submissions in `july` or `junedecember2026`. The only 16 file URLs in `public` point at `example.com` (seed data), and `storage.objects` is empty. **No file migration is needed.** Step 9.3 reduces to building local filesystem storage; drop `scripts/migrate-supabase-storage.mjs`.
- `google_tokens` is empty in every cohort.

### 10.6 Plan adjustments
1. **New Step 0.5 (urgent, operational):** restore Wi-Fi ingestion (Step 9.1–9.2) and notification delivery (Step 8.3) for `junedecember2026` **before** the structural work. They are the parts that are failing today.
2. Step 1.2 is not needed. Just update the label of `july`.
3. Step 2: register `junedecember2026` as `running` with `is_default`. Mark `public` `archived` and `is_legacy`. Set `july` according to the owner's answer in 10.1 (`is_legacy=true` either way). **`junedecember2026` is not legacy, but it was cloned, not baselined**, so treat it like the legacy schemas in Step 4: mark the baseline applied, then run the reconcile.
4. Step 4 reconcile must, in order:
   1. archive orphan rows (the 443 in `july.session_skills`; re-check every table for orphans just before running);
   2. add the 14 missing FKs to `july` and `junedecember2026`, with the ON DELETE rules chosen for the baseline;
   3. add `trg_auto_enroll_course` to `july` and `junedecember2026`;
   4. give each cohort its own sequences;
   5. drop the empty `july.wifi_snapshots` (check that it has 0 rows first);
   6. move the views and `calculate_attendance` out of `public`: recreate them per cohort, or drop them, since the app does not use them.
5. Step 5 backfill: resolve the 5 email-vs-id conflicts and the 2 admin accounts by hand first. Merging the admins means choosing one canonical id and inserting that account's `users` row into every cohort.
6. Step 9.3: no data migration (see 10.5).

The read-only check scripts (`verify.mjs`, `verify2.mjs`, `verify3.mjs`) are in the session scratchpad, not in the repo.
