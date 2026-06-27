# CiPD 360 ERP — Features Module Handoff

**Purpose:** Train a new chat/agent to implement or fix missing product features.  
**Codebase root:** `cipd_erp/client-next/`  
**Last audited:** June 2026

---

## 1. Scope of This Handoff

This document covers **missing or incomplete product capabilities** — not wiring bugs (see `HANDOFF_WIRING.md`) or attendance/feedback logic (see other handoffs).

Features audited:

| ID | Severity | Title |
|----|----------|-------|
| FEA-1 | High | No faculty portal |
| FEA-2 | High | Assignment submission not implemented |
| FEA-3 | Medium | Session DELETE hard-deletes data |
| FEA-4 | Medium | Notification preferences not enforced by senders |
| FEA-5 | Medium | Student profile read-only + phantom fields |
| FEA-6 | Medium | No session materials upload |
| FEA-7 | Low | No notification deletion/cleanup |
| FEA-8 | Low | ~~Password change not wired~~ **CORRECTION: wired** — see note below |

---

## 2. Project Context

CiPD 360 is a Next.js 14 monorepo (React + API routes) with Supabase PostgreSQL. Roles: `admin`, `faculty`, `student`. Most work is complete for **admin** and **student** portals; **faculty** and several **student workflows** are stubs or admin-only.

---

## 3. Issues To Fix (Detailed)

### FEA-1 — No faculty portal [HIGH]

**Problem:** `faculty` role exists in DB and auth, but there is no faculty UX.

**Current behavior:**
- Login (`app/page.jsx`): `admin` → `/admin`, **everyone else** → `/dashboard`
- Faculty lands on student dashboard
- `AuthContext` supports `faculty_token`, but no `/faculty/*` pages exist
- Faculty hours/honarium: `GET /api/admin/faculty-hours` — **admin only** (`withRole(['admin'])`)
- Faculty directory for students: `GET /api/faculty` + `app/teachers/page.jsx`

**Expected behavior (minimum viable faculty portal):**

| Feature | Suggestion |
|---------|------------|
| Login routing | Faculty → `/faculty/dashboard` or `/faculty/schedule` |
| Own schedule | Read-only sessions where `sessions.faculty_id = req.user.id` |
| Own hours summary | New `GET /api/faculty/hours` scoped to logged-in faculty |
| Profile | View designation, honorarium rate (read-only) |

**Optional (stretch):** Upload session materials, view feedback analytics for own sessions.

**Files to create/modify:**
- `app/page.jsx` — role-based redirect
- New: `app/faculty/page.jsx`, layout with sidebar (mirror student/admin patterns)
- New: `app/api/faculty/schedule/route.js`, `app/api/faculty/hours/route.js` with `withRole(['faculty'])`
- `lib/api.js`, `app/contexts/AuthContext.js` — already handle `/faculty` prefix for tokens

**Acceptance criteria:**
- Faculty login does not 401 on API calls
- Faculty sees only their sessions, not full admin data
- Admin `faculty-hours` page unchanged

**Note:** Wiring issue WIR-4 (wrong token on `/dashboard`) must be fixed as part of this — see Wiring handoff.

---

### FEA-2 — Assignment submission not implemented [HIGH]

**Problem:** Students can view assignments but cannot submit files.

**Current behavior:**
- `GET /api/students/assignments` — lists assignments + merged `assignment_submissions` (read only)
- `app/grades/page.jsx` — graded items only, no upload
- `app/courses/[courseId]/page.jsx` — has upload UI but posts to **non-existent** route (WIR-1)
- DB: `assignments`, `assignment_submissions` with `file_url`, `grade`, `feedback`
- No Supabase Storage bucket integration in codebase

**Expected behavior:**
1. `POST /api/students/assignments/[id]/submit` (or `/api/assignments/[id]/submit`)
2. Accept multipart file upload OR signed URL flow via Supabase Storage
3. Insert/update `assignment_submissions` with `file_url`, `submitted_at`
4. Validate: student enrolled in course, not past due (or allow late with flag), one submission per assignment (or allow resubmit — product decision)
5. Admin/faculty grade via existing or new PATCH route (optional for this task)

**Implementation sketch:**

```
Student selects file
  → POST multipart to API
  → Upload to Supabase Storage bucket `assignment-submissions/{studentId}/{assignmentId}/`
  → Insert assignment_submissions row
  → Return updated assignment with is_submitted: true
```

**Files:**
- New: `app/api/students/assignments/[id]/submit/route.js` (or under `app/api/assignments/`)
- `lib/api.js` — add `api.upload()` that does NOT force JSON Content-Type
- `app/courses/[courseId]/page.jsx` — fix field names (WIR-1)
- Supabase: create bucket + RLS or server-only upload via service role
- Optional: `app/api/admin/assignments/...` for creating assignments (currently seed/import only)

**Acceptance criteria:**
- Student uploads PDF → appears in submissions → grades page shows submitted state
- Non-enrolled student cannot submit
- File size/type validation

**Dependencies:** Fix WIR-1 (API shape + upload helper) in same or prior chat.

---

### FEA-3 — Session DELETE permanently removes data [MEDIUM]

**Problem:** Deleting a session cascades to attendance and feedback.

**Current behavior** (`app/api/admin/sessions/[id]/route.js`):

```javascript
await supabaseAdmin.from('sessions').delete().eq('id', id);
```

UI (`app/admin/schedule/page.jsx`) confirms “delete this class” — user may expect cancel, not destroy.

**Expected behavior (recommended):**
- **Soft delete:** `PATCH` with `status: 'cancelled'` (already supported)
- Change UI “Delete” to “Cancel session” OR keep delete only for sessions with no attendance/feedback
- If hard delete retained: block when `attendance_records` or `feedback_responses` exist

**Files:**
- `app/api/admin/sessions/[id]/route.js`
- `app/admin/schedule/page.jsx`

**Acceptance criteria:**
- Cancelled sessions remain in DB with status `cancelled`
- Historical reports still show cancelled sessions (filtered appropriately)
- No orphaned feedback analytics gaps without admin warning

---

### FEA-4 — Notification preferences saved but not enforced [MEDIUM]

**Problem:** Students toggle preferences; cron/email ignore them.

**Current behavior:**
- Settings UI saves to `users.preferences.notifications` via `PATCH /api/students/settings` ✅
- Keys: `scheduleReminders`, `attendanceAlerts`, `assignmentDeadlines`, `feedbackRequests`, `gradeUpdates`, `systemAnnouncements`
- Cron `reminder`, `feedback-reminder`, admin `notifications` POST send to all enrolled/active students without reading preferences

**Expected behavior:**
Before sending email/inserting notification, load recipient preferences:

```javascript
const prefs = user.preferences?.notifications ?? DEFAULT;
if (type === 'class_reminder' && prefs.scheduleReminders === false) skip;
if (type === 'feedback_available' && prefs.feedbackRequests === false) skip;
// etc.
```

**Files:**
- `app/api/cron/reminder/route.js`
- `app/api/cron/feedback-reminder/route.js`
- `lib/feedback-rollout.js`
- `app/api/admin/notifications/route.js`
- Helper: `lib/notification-preferences.js`

**Acceptance criteria:**
- Student disables schedule reminders → no day-before email
- In-app notification row also skipped OR still created (product decision — document choice)

**Note:** Overlaps WIR-3 — same fix; can be one chat.

---

### FEA-5 — Student profile read-only + phantom fields [MEDIUM]

**Problem:** Profile page shows data that does not exist in API/schema.

**Current behavior:**
- `GET /api/students/profile` — returns: `enrollment_no`, `program_name`, `mac_address`, `mac_verified`, names, email
- `app/profile/page.jsx` displays: `phone`, `department`, `semester`, `batch`, `program` (wrong key — API has `program_name`)
- Assignments tab hardcodes `total = 20` instead of `assignment.total_marks`
- No PATCH endpoint for profile updates

**Expected behavior (pick scope):**

**Minimal:** Remove or hide fields not in DB; fix `program_name`; use real `total_marks`.

**Full:** Add columns + migration for editable fields (phone optional); `PATCH /api/students/profile` for allowed fields.

**Files:**
- `app/profile/page.jsx`
- `app/api/students/profile/route.js`
- Optional migration for new columns

**Acceptance criteria:**
- No blank/misleading fields unless marked “Not provided”
- If edit enabled: PATCH persists and GET reflects changes

---

### FEA-6 — No session materials upload [MEDIUM]

**Problem:** Materials are read-only from DB seed/import.

**Current behavior:**
- `GET /api/courses/[id]/materials` — reads `session_materials`
- Course UI Materials tab: download/view only
- No POST route, no Storage upload, no admin UI for upload

**Expected behavior:**
- Admin or faculty upload PDF/link per session or course
- `POST /api/admin/materials` or `/api/faculty/materials` with file upload
- Store `file_url`, `title`, `content`, link to `session_id` + `course_id`

**Files:**
- New API route(s)
- `app/admin/schedule/page.jsx` or course admin UI — upload button
- Supabase Storage bucket `session-materials`

**Acceptance criteria:**
- Admin uploads file → student sees on course Materials tab
- File access secured (signed URLs or server proxy)

---

### FEA-7 — No notification deletion/cleanup [LOW]

**Problem:** `notifications` table grows forever.

**Current behavior:**
- Student: GET + PATCH mark read only
- Admin: GET history + POST send
- No DELETE endpoint, no TTL job

**Expected behavior (pick one):**
- `DELETE /api/student/notifications` with `{ older_than_days: 90 }` or mark-all-read + archive
- Admin purge for broadcast history
- Optional cron to delete read notifications older than N days

**Files:**
- `app/api/student/notifications/route.js`
- Optional `app/api/admin/notifications/route.js` DELETE

**Acceptance criteria:**
- Student can clear read notifications
- Admin can bulk delete old broadcast records (with confirm)

---

### FEA-8 — Password change [CORRECTION — ALREADY WIRED]

**Audit note:** Initial gap list flagged settings password as unwired. **Code review shows it works:**

- `app/settings/page.jsx` calls `api.post('/api/auth/update-password', { currentPassword, newPassword })` (~line 282)
- `app/api/auth/update-password/route.js` enforces min 8 characters

**Remaining gap (if any):** Admin password route (`/api/admin/settings/password`) has **no** min length validation — fix in Security workstream, not Features.

**Action for this handoff:** No work unless UI bug found in testing.

---

## 4. Feature Dependencies Map

```
FEA-1 (Faculty portal)
  └── requires WIR-4 (faculty token routing)

FEA-2 (Assignment submit)
  └── requires WIR-1 (upload API + lib/api.js + UI field alignment)

FEA-4 (Preference enforcement)
  └── overlaps WIR-3 (same cron changes)

FEA-6 (Materials upload)
  └── similar pattern to FEA-2 (Storage + multipart)
```

---

## 5. Suggested Implementation Order

1. **FEA-3** — Soft cancel vs hard delete (small, admin-facing)  
2. **FEA-1 + WIR-4** — Faculty portal MVP  
3. **FEA-2 + WIR-1** — Assignment submission end-to-end  
4. **FEA-4** — Preference enforcement in crons  
5. **FEA-5** — Profile cleanup or edit  
6. **FEA-6** — Materials upload  
7. **FEA-7** — Notification cleanup  

---

## 6. Testing Checklist

- [ ] Faculty login → faculty pages load with auth  
- [ ] Student submits assignment → DB row + file in storage  
- [ ] Cancel session → status cancelled, data preserved  
- [ ] Disable feedback preference → no feedback email/notification  
- [ ] Profile shows only real fields  
- [ ] Upload material → visible on student course page  

---

## 7. Constraints for Implementer

- Match existing UI: `Dashboard.css`, sidebar layouts, `api` helper from `lib/api.js`
- Use `withRole` for new admin/faculty routes
- Supabase Storage: use service role on server, never expose service key to client
- Do not add TypeScript unless user explicitly requests migration
- Keep changes scoped — one feature per PR/chat when possible

---

## 8. Prompt Starter for New Chat

```
You are implementing CiPD 360 ERP missing features. Read:
- cipd_erp/docs/handoffs/HANDOFF_FEATURES.md
- For faculty: app/page.jsx, app/admin/faculty-hours/page.jsx
- For assignments: app/api/students/assignments/route.js, app/courses/[courseId]/page.jsx

Pick ONE feature ID from the handoff (e.g. FEA-2) and implement end-to-end 
including API, storage if needed, and UI. Follow acceptance criteria in the doc.
Also read HANDOFF_WIRING.md for related wiring fixes.
```
