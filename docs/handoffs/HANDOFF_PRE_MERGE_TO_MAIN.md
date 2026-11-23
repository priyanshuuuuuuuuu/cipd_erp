# Handoff — merging `feature/cohorts-core` into `main` (state as of 2026-11-16)

## Branch state
- Branch `feature/cohorts-core`, pushed, HEAD `7682793`. Merge-base with `origin/main`: `c335224b`.
- 10 commits on the branch not on main: cohorts/VM work (`f7ab7d0`, `00645ab`, `0d5dda6`: central accounts, core registry, migration runner, membership-based cohort resolution), `fd8162d` custom programs/courses, `d065555` forced first login for faculty, `4379cef` faculty tab, `ac88a81` + `86691eb` (notification fixes, from a teammate via `git pull`), `d9af31f` + `7682793` (my merge + session work, below).
- `main` is 1 commit ahead of the merge-base: `c6150d3` "changes in the notification service" (2026-11-14). It touches only `notification-service/`.
- **Deploy caveat:** the branch includes DB migrations that were run on the VM. Follow `docs/COHORTS.md` (rollout runbook) before deploying main; nothing here is live-tested.

## Predicted conflicts when merging `origin/main` into the branch
Dry run (`git merge-tree`) conflicts in exactly three files, all under `notification-service/`:
- `src/stream.mjs`, `src/config.mjs`, `package-lock.json` (`package.json` and `.env.example` auto-merge).

`c6150d3` is an earlier take on the same rewrite the branch already contains in a later, larger form (Supabase client -> `postgres`, DB URL instead of Supabase keys, `sendGeneralNotificationEmail` / `sendWeeklyScheduleEmail`). **Recommended resolution:** keep the branch's `stream.mjs` and `config.mjs` (multi-cohort schema draining, `student_welcome`, `class_reminder`, sandbox + unrestricted test cohort, `appUrl`, course-message routing), take main's side only for anything the branch lacks, and regenerate `package-lock.json` with `npm install` after confirming `postgres` is in `package.json`. Note main's `config.mjs` loads `.env.local` before `.env`; the branch loads the service's own `.env` first, then `client-next/.env.local`, then `client-next/.env` (none override).

## What came in via `git pull` (teammate, `ac88a81`, `86691eb`)
Email delivery logging and notification fixes: `api/admin/email-log` + `EmailDeliveryLog.jsx`, `lib/notification-stream.js`, `lib/emailer.js` (adds `sendStudentWelcomeEmail`), `lib/faculty-service.js`, `lib/student-service.js`, admin students/faculty-hours/notifications routes, `notification-service/src/{stream,config,server}.mjs`, plus `scripts/clear-test-queue.mjs` and `diagnose-queue.mjs`. The only real merge conflict was `notification-service/src/stream.mjs`: both sides edited the `general_notification` handling. Resolution (commit `7682793`): keep upstream's `sendJob(job, schema)` and event list, and add a check so a `general_notification` carrying `senderName`/`courseName` (faculty course messages) uses `sendCourseMessageEmail`; everything else uses `sendGeneralNotificationEmail`. Imports are the union of both.

## Changes made in this session (commit `d9af31f`)
1. **localhost -> ERP URL** (`http://ipdcp-erp.iiitd.edu.in`, no trailing slash). Root cause of reset emails linking to localhost: duplicate `NEXT_PUBLIC_APP_URL` in `client-next/.env.local` overrode the real one. Fixed in env files, `lib/emailer.js` fallback (also strips trailing slash), `.env.example`, `README.md`, `notification-service/.env.example` (now documents `APP_URL`). Localhost intentionally kept for worker->app calls and test scripts.
2. **Admin sends password reset to faculty:** new `POST /api/admin/faculty-hours/reset-password` (mirrors the student route: 15-min JWT, `enqueuePasswordResetEmail`, admin-only, checks cohort membership and `role === 'faculty'`); button in the Edit Faculty modal in `admin/faculty-hours/page.jsx`.
3. **Inline "Add new venue" / "Add new course"** under the dropdowns in the Schedule New Class and Edit Session modals (`admin/schedule/page.jsx`) and the dashboard schedule modal (`admin/page.jsx`). New `POST /api/admin/venues`; courses reuse `POST /api/admin/programs/:id/courses` (needs name, code, program; running cohort).
4. **Settings page** (`admin/settings/page.jsx`): "BSSID Whitelist" renamed **Venues** and moved above Attendance Detection; BSSID now optional when adding/editing a venue (blank stored as NULL because the column is unique; previously editing a BSSID-less venue silently failed); Building field added; `api/admin/settings/bssid/route.js` validates names. Cohorts and Programs pages got a "Back to Settings" button.
5. **Editable programs/courses** (`admin/programs/page.jsx`): rename program (`PATCH /api/admin/programs/[id]`, global, case-insensitive uniqueness) and edit course name/code/description (`PATCH /api/admin/courses/[id]`, cohort-scoped, running cohort only). Logic in `lib/program-service.js` (`updateProgram`, `updateCourse`). No delete.

## Env (not in git — both files are gitignored)
- `client-next/.env` and `notification-service/.env` are the source of truth. `client-next/.env.local` was **deleted** (it silently overrode `.env`); its needed keys (`COHORT_LABELS`, `GOOGLE_SIGNIN_*`, `NOTIFICATION_SANDBOX_*`) moved into `.env`.
- The notification service refuses to start unless `EMAIL_FROM=cipd@iiitd.ac.in`, and builds reset links from `APP_URL`/`NEXT_PUBLIC_APP_URL` (must be the ERP URL). `NOTIFICATION_SANDBOX_MODE=true` is still on.
- Both services need a restart after env or `stream.mjs` changes.

## Not verified
No build or browser test was run for items 2-5; only syntax/config-load checks. Nothing has been sent via the live notification path since the merge.
