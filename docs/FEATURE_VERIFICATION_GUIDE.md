# CiPD 360 ERP — Feature Verification Guide

This document summarizes **what each agent chat in the BTP project implemented**, and **how you can verify it works**. It is based on all parent chat transcripts under this workspace plus a cross-check of the current codebase in `cipd_erp/client-next/`.

**Last compiled:** June 27, 2026

---

## Quick start (run the app locally)

```powershell
cd c:\Users\parsh\OneDrive\Desktop\BTP\cipd_erp\client-next
npm install
npm run dev
```

Open `http://localhost:3000`. You need a working `.env.local` with Supabase URL, anon key, service role key, JWT secret, and (for email/cron) SMTP + `CRON_SECRET`.

**Production URL (from README):** `https://cipd-erp-ic24.vercel.app`

---

## Chat index (what each session did)

| Chat | Primary work | Code shipped? |
|------|----------------|---------------|
| [Gap analysis & handoffs](e8d3e97b-de13-4cb7-b3da-437dfedf8b8a) | Deep-dive audit of missing features; created handoff docs in `docs/handoffs/` | **Docs only** — no feature code |
| [Wiring completion](57cbd071-b05a-4341-b4d0-a7aba9edcfe9) | Notifications UI, preference enforcement, appearance theme, admin notification fixes | **Yes** |
| [Feedback fixes](cad90451-7f58-437b-b96d-b2052eacd8e1) | Eligibility, deadlines, duplicate prevention, analytics performance | **Yes** (migration required) |
| [Features FEA-1/2/6](9510fba8-4624-4cec-9a1e-7e71c37b9119) | Faculty portal, assignment upload, session materials upload | **Yes** (storage buckets required) |
| [Attendance & leave](f19c3a46-8368-4d86-9fc9-3892976fe2b2) | Wi-Fi scoring rewrite, leave requests, unified leaderboard/student UI | **Yes** (leave migration required) |
| [Features SQL Q&A](75592824-1c55-49b9-a79c-260bfb9ce082) | Duplicate of FEA planning; SQL safety questions only | **No new code** — use 9510fba8 results |

Handoff source documents (for context): `docs/handoffs/README.md`

---

## Prerequisites — run these SQL scripts first

Before testing, confirm these migrations were applied in **Supabase → SQL Editor**:

| Script | Required for | Verify with |
|--------|----------------|-------------|
| `client-next/scripts/migration_leave_requests.sql` | Leave requests, `leave` attendance status | `SELECT * FROM leave_requests LIMIT 1;` |
| `client-next/scripts/feedback_constraints_migration.sql` | Feedback duplicate block + index | See feedback section below |
| Storage buckets SQL from FEA chat (or `setup-storage-buckets`) | Assignment + materials upload | `SELECT id FROM storage.buckets WHERE id IN ('assignment-submissions','session-materials');` |
| `migration_phase2_columns.sql` (if not already run) | `total_marks`, `preferences`, etc. | Column checks in wiring chat |

---

## 1. Attendance system (Wi-Fi pipeline)

**Chat:** [Attendance & leave](f19c3a46-8368-4d86-9fc9-3892976fe2b2)

**What was built**

- New scoring in `lib/attendance-points.js` (first-ping timing + ping-% deductions)
- Shared processor `lib/process-session-attendance.js` used by cron + admin views
- Cron `api/cron/process-attendance` refactored; only **verified MAC** students get records
- Unverified MAC students: visible in live view only, **no attendance row**
- Unexcused absence: **−2 points**; approved leave: **0 points**
- Student APIs read `attendance_records` (not legacy Excel marks)
- Leaderboard uses `attendance_records.points` + feedback (+3/session, max 8/session)

**How to verify**

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Run unit tests: `node scripts/test-attendance-points.js` | **16/16 passed** |
| 2 | Log in as **admin** → `/admin/live-students` during a session | Students with unverified MAC may appear; they should not get attendance rows after processing |
| 3 | After session ends, trigger cron (or wait for scheduler): `curl -H "x-cron-secret: YOUR_SECRET" http://localhost:3000/api/cron/process-attendance` | `attendance_records` populated for verified-MAC enrolled students |
| 4 | Log in as **student** (verified MAC) → `/attendance` | Session history shows **points**, **pings**, status Present/Leave/Absent from Wi-Fi data |
| 5 | Student not detected, no approved leave | Status **absent**, points **−2** in DB: `SELECT status, points FROM attendance_records WHERE student_id = '...'` |
| 6 | Compare admin session detail `/admin/attendance` with student `/attendance` | Same statuses and points for the same session |

**Key files:** `lib/attendance-points.js`, `lib/process-session-attendance.js`, `app/api/cron/process-attendance/route.js`, `app/api/students/attendance/summary/route.js`, `app/api/students/attendance/sessions/route.js`

---

## 2. Leave requests

**Chat:** [Attendance & leave](f19c3a46-8368-4d86-9fc9-3892976fe2b2)

**What was built**

- Table `leave_requests` (+ `leave` enum value on `attendance_status`)
- Student: `POST/GET /api/students/leave-requests`
- Admin: `GET /api/admin/leave-requests`, `PATCH /api/admin/leave-requests/[id]`
- Student UI on `/attendance` (Request Leave form)
- Admin UI at `/admin/leave-requests`
- Admins notified when a student submits leave
- Approved leave exempts **−2** penalty at attendance finalization

**How to verify**

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Run `migration_leave_requests.sql` if not done | Table exists |
| 2 | Log in as **student** → `/attendance` → **Request Leave** | Form accepts date + reason (min 5 chars); success message |
| 3 | Log in as **admin** → `/admin/leave-requests` | Pending request visible with student name, date, reason |
| 4 | Admin clicks **Approve** | Status → `approved` |
| 5 | After session processing for that date | Student gets `status = leave`, `points = 0` (not −2) |
| 6 | Check admin notifications | Leave submission created an in-app notification for admins |

**Key files:** `scripts/migration_leave_requests.sql`, `app/api/students/leave-requests/route.js`, `app/admin/leave-requests/page.jsx`

---

## 3. Feedback system fixes

**Chat:** [Feedback fixes](cad90451-7f58-437b-b96d-b2052eacd8e1)

**What was built**

- `lib/feedback-deadline.js` — default deadline = session end + 24h IST; overridable via `sessions.feedback_deadline`
- `lib/feedback-eligibility.js` — only `present` / `partial` students can submit
- Submit route blocks: cancelled session, not attended, past deadline, duplicate (409)
- Pending route lists only attendance-eligible sessions
- Admin forms/analytics use **attended count** (not enrollment) as denominator
- DB unique constraint on `(session_id, student_id, question_id)`

**How to verify**

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Confirm migration ran: `feedback_constraints_migration.sql` | Index `idx_feedback_student_session` + constraint `feedback_responses_session_student_question_unique` exist |
| 2 | Student **with** present/partial on a completed session → `/feedback` | Session appears in pending forms |
| 3 | Student **without** attendance for that session | Session **not** listed |
| 4 | Submit feedback once | Success |
| 5 | Submit again for same session | **409** “already submitted” |
| 6 | After deadline (or set `feedback_deadline` in past) | Submit returns **403** |
| 7 | Admin → `/admin/feedback` | Completion rate uses attended students, not total enrolled |

**Key files:** `lib/feedback-deadline.js`, `lib/feedback-eligibility.js`, `app/api/feedback/submit/route.js`, `app/api/feedback/pending/route.js`, `scripts/feedback_constraints_migration.sql`

Optional scripted test: `scripts/feedback_e2e_test.sql`

---

## 4. Faculty portal (FEA-1)

**Chat:** [Features FEA-1/2/6](9510fba8-4624-4cec-9a1e-7e71c37b9119)

**What was built**

- Login redirect: faculty → `/faculty/dashboard`
- Portal pages: Dashboard, Schedule, Hours & Profile
- APIs: `GET /api/faculty/schedule`, `GET /api/faculty/hours`
- Faculty-scoped data (only sessions where `faculty_id = req.user.id`)

**How to verify**

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Log in with a **faculty** account | Redirects to `/faculty/dashboard` (not `/dashboard`) |
| 2 | Open `/faculty/schedule` | Only that faculty member's sessions listed |
| 3 | Open `/faculty/profile` | Hours summary, designation, honorarium (read-only) |
| 4 | Open browser DevTools → Network | API calls use faculty token; no 401 on `/api/faculty/*` |
| 5 | Log in as **admin** → schedule | Unchanged; admin sees all sessions |

**Key files:** `app/faculty/layout.jsx`, `app/faculty/dashboard/page.jsx`, `app/faculty/schedule/page.jsx`, `app/faculty/profile/page.jsx`, `app/api/faculty/schedule/route.js`, `app/api/faculty/hours/route.js`

---

## 5. Assignment submission (FEA-2)

**Chat:** [Features FEA-1/2/6](9510fba8-4624-4cec-9a1e-7e71c37b9119) + wiring pass

**What was built**

- `api.upload()` in `lib/api.js` for multipart file POST
- `POST /api/students/assignments/[id]/submit` → Supabase Storage bucket `assignment-submissions`
- Resubmit allowed (upsert on `assignment_id + student_id`)
- GET assignments returns `submission_status`, `marks`, `feedback`, supports `?course_id=`

**How to verify**

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Confirm storage bucket exists (see prerequisites) | `assignment-submissions` bucket present |
| 2 | Log in as **student** → `/courses/[courseId]` → Assignments tab | Upload control visible |
| 3 | Upload a PDF (< 10 MB) | Status badge → **Submitted** |
| 4 | Upload again (resubmit) | Still **Submitted**; old file replaced in storage |
| 5 | Try wrong file type or > 10 MB | **400** error shown in UI |
| 6 | Student not enrolled in course | **403** on submit API |
| 7 | `/grades` page | Shows graded submissions with correct `total_marks` (not hardcoded /20) |

**Key files:** `lib/api.js`, `lib/storage.js`, `lib/file-validation.js`, `app/api/students/assignments/[id]/submit/route.js`, `app/courses/[courseId]/page.jsx`

---

## 6. Session materials upload (FEA-6)

**Chat:** [Features FEA-1/2/6](9510fba8-4624-4cec-9a1e-7e71c37b9119)

**What was built**

- `POST /api/admin/materials` — admin upload from schedule page
- `POST /api/faculty/materials` — faculty upload from faculty schedule (own sessions only)
- GET materials returns **signed URLs** for private storage paths
- Bucket: `session-materials`

**How to verify**

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Confirm `session-materials` bucket exists | See prerequisites |
| 2 | **Admin** → `/admin/schedule` → Upload Material on a session | Modal: title + file; success toast |
| 3 | **Faculty** → `/faculty/schedule` → Upload on own session | Same flow; posts to faculty API |
| 4 | **Student** → `/courses/[courseId]` → Materials tab | New material listed with working download link |
| 5 | Faculty tries to upload on another faculty's session | **403** |

**Key files:** `app/api/admin/materials/route.js`, `app/api/faculty/materials/route.js`, `app/api/courses/[id]/materials/route.js`, `app/admin/schedule/page.jsx`, `app/faculty/schedule/page.jsx`

---

## 7. Wiring & UX fixes (notifications, preferences, theme)

**Chat:** [Wiring completion](57cbd071-b05a-4341-b4d0-a7aba9edcfe9)

**What was built**

| ID | Feature |
|----|---------|
| WIR-1 | Assignment submit wired end-to-end |
| WIR-2 | `NotificationBell` on dashboard + leaderboard; full inbox at `/notifications` |
| WIR-3 | `lib/should-notify.js` — crons and admin senders respect user preferences |
| WIR-4 | Faculty login redirect + path-scoped tokens |
| WIR-5 | Profile uses `program_name`; grades use `total_marks` |
| WIR-6 | Removed broken “Sign out all” / fake forgot-password link |
| WIR-7 | `AppearanceContext` — dark theme + font size via `data-theme` on `<html>` |
| WIR-8 | Admin class reminder requires session picker |

**How to verify**

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | **Student** → dashboard header bell | Unread count; dropdown lists notifications |
| 2 | Click a notification | Marks read; count decreases |
| 3 | “View all” → `/notifications` | Full inbox with mark-all-read |
| 4 | Settings → turn off **Schedule Reminders** → save | Preference persisted in `users.preferences` |
| 5 | Trigger `/api/cron/reminder` | That student skipped if pref off |
| 6 | Settings → **Dark theme** | Page restyles without full reload |
| 7 | Admin → Notifications → **Class Reminder** | Must pick a session before send |

**Key files:** `app/components/NotificationBell.jsx`, `app/notifications/page.jsx`, `lib/should-notify.js`, `app/contexts/AppearanceContext.js`, `app/admin/notifications/page.jsx`

Status table also updated in `docs/handoffs/HANDOFF_WIRING.md`.

---

## 8. Documentation-only work (no code to test)

**Chat:** [Gap analysis & handoffs](e8d3e97b-de13-4cb7-b3da-437dfedf8b8a)

**What was produced**

- Full gap analysis of the CiPD 360 ERP codebase
- Four handoff documents for follow-up chats:
  - `docs/handoffs/HANDOFF_ATTENDANCE.md`
  - `docs/handoffs/HANDOFF_FEEDBACK.md`
  - `docs/handoffs/HANDOFF_FEATURES.md`
  - `docs/handoffs/HANDOFF_WIRING.md`
- Detailed attendance analysis: `docs/handoffs/HANDOFF_ATTENDANCE_ANALYSIS.md`

**How to verify:** Open the files above; they describe problems and fix plans. Subsequent chats implemented many of the items listed there.

---

## Automated checks you can run without UI

```powershell
cd c:\Users\parsh\OneDrive\Desktop\BTP\cipd_erp\client-next

# Attendance scoring logic (16 tests)
node scripts/test-attendance-points.js

# Production build sanity check
npm run build
```

---

## Cron jobs (need external scheduler)

These routes exist but are **not** scheduled in-repo (no `vercel.json` cron). Call them manually or via your scheduler with header `x-cron-secret: CRON_SECRET`:

| Endpoint | Purpose |
|----------|---------|
| `/api/cron/process-attendance` | Finalize Wi-Fi attendance after sessions |
| `/api/cron/reminder` | Class tomorrow reminders |
| `/api/cron/feedback-reminder` | Feedback deadline reminders |

Example:

```powershell
curl -H "x-cron-secret: YOUR_CRON_SECRET" http://localhost:3000/api/cron/process-attendance
```

---

## Known gaps (not implemented by these chats)

These were identified in handoffs or marked out-of-scope; **do not expect them to work yet**:

- Timezone bug in attendance (explicitly deferred)
- Faculty assignment **grading** UI
- Real PDF/CSV report generation (`/admin/reports` may still use mock data)
- Student password change from Settings (may need `/api/auth/update-password`)
- Full profile fields (phone, department filter on `/teachers`)
- Faculty notification bell (faculty has no student notifications API)
- Cron deployment configuration in Vercel
- Legacy Excel `student_attendance_marks` — no longer used by student APIs after attendance chat

---

## Suggested end-to-end test order

1. Apply all SQL migrations (leave, feedback, storage buckets)
2. `node scripts/test-attendance-points.js`
3. `npm run dev` — smoke-test login redirects (admin / faculty / student)
4. Faculty portal → schedule → materials upload
5. Student → course → assignment upload
6. Student → attendance → leave request → admin approve
7. Run process-attendance cron after a test session
8. Student → `/attendance` + `/leaderboard` — points match DB
9. Student → `/feedback` — eligibility + submit once
10. Student → notification bell + preferences + dark theme

---

## Reference: chat transcript locations

Parent chats live under Cursor agent transcripts (UUID folders). Use these links when you need the full conversation history:

- [Gap analysis & handoffs](e8d3e97b-de13-4cb7-b3da-437dfedf8b8a)
- [Wiring completion](57cbd071-b05a-4341-b4d0-a7aba9edcfe9)
- [Feedback fixes](cad90451-7f58-437b-b96d-b2052eacd8e1)
- [Features FEA-1/2/6](9510fba8-4624-4cec-9a1e-7e71c37b9119)
- [Attendance & leave](f19c3a46-8368-4d86-9fc9-3892976fe2b2)
