# CiPD 360 ERP — Frontend ↔ Backend Wiring Handoff

**Purpose:** Train a new chat/agent to fix disconnects between UI and API layers.  
**Codebase root:** `cipd_erp/client-next/`  
**Last audited:** June 2026  
**Wiring pass completed:** June 2026 — see status table below

---

## Wiring Status Summary

| ID | Status | Notes |
|----|--------|-------|
| WIR-1 | **Resolved** | Submit route, `api.upload`, `course_id` filter, response shape all wired |
| WIR-2 | **Resolved** | `NotificationBell` on dashboard/leaderboard; `/notifications` page |
| WIR-3 | **Resolved** | `lib/should-notify.js` integrated in cron, rollout, admin senders |
| WIR-4 | **Resolved** | Faculty → `/faculty/dashboard`; path-scoped tokens in `api.js` + AuthContext |
| WIR-5 | **Partial** | `program_name` + `total_marks` fixed; phone/dept/semester/batch still N/A in DB |
| WIR-6 | **Resolved** | Removed dead "Sign out all"; forgot-password is non-clickable helper text |
| WIR-7 | **Resolved** | `AppearanceContext` applies theme/fontSize via `data-theme` on `<html>` |
| WIR-8 | **Resolved** | Admin compose requires session picker for `class_reminder` |

**Still out of scope (Features handoff):** faculty grading UI, assignment CRUD, full profile schema, realtime push, cron deployment config.

---

## 1. What “Wiring” Means Here

These are bugs where **UI exists but backend doesn’t**, **backend exists but UI doesn’t call it**, **API response shape ≠ what UI expects**, or **auth/token routing breaks requests**. Unlike Features handoff (net-new capability), wiring is mostly **connecting existing pieces**.

---

## 2. Architecture Quick Reference

| Layer | Location |
|-------|----------|
| Pages | `app/**/*.jsx` |
| API routes | `app/api/**/route.js` |
| Client fetch | `lib/api.js` — attaches JWT from localStorage by URL path |
| Auth state | `app/contexts/AuthContext.js` — `{role}_token`, `{role}_user` |
| Guards | `lib/middleware.js` — `withAuth`, `withRole` |

**Token selection** (`lib/api.js`):
- `/admin/*` → `admin_token`
- `/faculty/*` → `faculty_token`
- else → `student_token`

**Login redirect** (`app/page.jsx`):
- `admin` → `/admin`
- `faculty` → `/faculty/dashboard`
- else → `/dashboard`

---

## 3. Issues To Fix (Detailed)

### WIR-1 — Assignment submission completely unwired [HIGH]

**Symptoms:** Course page upload fails; assignments always show Pending.

**Broken chain:**

| Step | Status |
|------|--------|
| UI upload form | Exists in `app/courses/[courseId]/page.jsx` |
| API route | **Missing** — UI calls `POST /api/assignments/${id}/submit` |
| `lib/api.js` | **Broken for files** — always `Content-Type: application/json` + `JSON.stringify` |
| Response mapping | **Mismatch** — see below |

**UI expects** (from `[courseId]/page.jsx`):

```javascript
asn.submission_status  // 'pending' | 'submitted' | 'graded'
asn.marks
asn.feedback
// Badge: submission_status || 'pending'
```

**API returns** (`app/api/students/assignments/route.js`):

```javascript
is_submitted
submission  // nested object
grade
// No submission_status field
```

**Query param ignored:**

```javascript
// Course page calls:
/api/students/assignments?course_id=${courseId}
// Route never reads course_id — returns ALL enrolled courses' assignments
```

**Fix checklist:**

1. Create `POST /api/students/assignments/[id]/submit/route.js` (or fix path UI uses)
2. Add to `lib/api.js`:

```javascript
export async function apiUpload(path, formData) {
  const token = getToken();
  return fetch(path, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData, // NO Content-Type — browser sets multipart boundary
  });
}
```

3. Map API response to UI shape OR update UI to use `is_submitted` / `submission`:

```javascript
submission_status: row.is_submitted ? 'submitted' : (row.grade != null ? 'graded' : 'pending')
marks: row.grade
```

4. Filter assignments by `course_id` when query param present

**Files:**
- `app/courses/[courseId]/page.jsx`
- `lib/api.js`
- `app/api/students/assignments/route.js`
- New submit route

**Acceptance criteria:**
- Upload succeeds; status badge updates to Submitted
- Course page only shows that course’s assignments

**Related feature doc:** FEA-2 (full product spec)

---

### WIR-2 — Student notifications UI non-functional [MEDIUM]

**Symptoms:** Bell icons do nothing; notifications never marked read in UI.

**Backend (working):**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/student/notifications` | GET | List + `unread_count` |
| `/api/student/notifications` | PATCH | `{ mark_all: true }` or `{ notification_ids: [...] }` |

**Frontend (missing):**

- No `app/notifications/page.jsx`
- `app/dashboard/page.jsx` — bell icon, no `onClick`, no fetch
- `app/leaderboard/page.jsx` — same
- **Zero** frontend calls to PATCH mark-read

**Fix checklist:**

1. Create reusable `components/NotificationBell.jsx`:
   - Fetch `GET /api/student/notifications?unread=true` on mount
   - Dropdown list with mark read on click
   - Badge with `unread_count`
2. Wire into dashboard, leaderboard, optional global layout
3. Optional full page at `/notifications` with mark all read

**Files:**
- New component + optional page
- `app/dashboard/page.jsx`, `app/leaderboard/page.jsx`
- `app/api/student/notifications/route.js` (no backend change needed)

**Acceptance criteria:**
- Unread count visible; click notification marks read via PATCH
- New `feedback_available` notification appears after session complete

---

### WIR-3 — Notification preferences saved but never enforced [MEDIUM]

**Symptoms:** Student toggles reminders off; still receives emails.

**Wired (save/load):**

- `app/settings/page.jsx` → `savePreference('notifications', key, value)`
- `PATCH /api/students/settings` → merges into `users.preferences` JSONB ✅
- `GET /api/students/settings` returns defaults + stored ✅

**Not wired (consumers):**

| Sender | Reads preferences? |
|--------|-------------------|
| `app/api/cron/reminder/route.js` | No |
| `app/api/cron/feedback-reminder/route.js` | No |
| `lib/feedback-rollout.js` | No |
| `app/api/admin/notifications/route.js` | No |

**Preference keys** (defaults in `app/api/students/settings/route.js`):

```javascript
scheduleReminders, attendanceAlerts, assignmentDeadlines,
feedbackRequests, gradeUpdates, systemAnnouncements
```

**Fix checklist:**

1. Create `lib/should-notify.js`:

```javascript
export function shouldNotify(preferences, channel, type) {
  const n = preferences?.notifications ?? {};
  // map notification type → preference key
}
```

2. Before each send/insert, fetch user preferences (batch query for cron loops)
3. Map types:
   - Day-before email → `scheduleReminders`
   - Feedback available → `feedbackRequests`
   - Feedback reminder → `feedbackRequests`
   - General admin broadcast → `systemAnnouncements`
   - Grade-related → `gradeUpdates`

**Files:**
- `lib/should-notify.js` (new)
- Cron routes + `feedback-rollout.js` + admin notifications

**Acceptance criteria:**
- Toggle off `scheduleReminders` → cron reminder skips that student

**Related:** FEA-4 in Features handoff (same work)

---

### WIR-4 — Faculty login uses wrong token on student routes [MEDIUM]

**Symptoms:** Faculty user gets 401 on dashboard API calls.

**Root cause chain:**

1. Login stores `faculty_token` in localStorage
2. Redirect to `/dashboard` (student path)
3. `lib/api.js` on `/dashboard` looks for `student_token` → not found → no Authorization header
4. APIs return 401; `api.js` clears tokens and redirects to login

**AuthContext** has same path logic but **falls through** to other role tokens on restore — UI may show faculty name while API uses wrong/missing token.

**Fix options:**

**A (minimal):** Redirect faculty to `/faculty/dashboard` on login; build faculty pages under `/faculty/*`

**B (quick hack):** In `getToken()`, if on student routes and `student_token` missing, fall back to `faculty_token` when `faculty_user` exists — **not recommended** long term

**Recommended:** Option A + faculty portal (FEA-1)

**Files:**
- `app/page.jsx` — login redirect
- `app/contexts/AuthContext.js` — align restore logic with `api.js`
- `lib/api.js`
- New `app/faculty/**` pages

**Acceptance criteria:**
- Faculty login → faculty route → all API calls include valid Bearer token
- Student and faculty sessions can coexist in different tabs (role-scoped tokens)

---

### WIR-5 — Profile page field mismatches [LOW]

**Symptoms:** Empty phone, department, semester, batch; wrong program label.

| UI field | API field | In DB? |
|----------|-----------|--------|
| `profile.program` | `program_name` | Yes |
| `phone` | — | No |
| `department` | — | No |
| `semester` | — | No |
| `batch` | — | No |
| Assignment total | hardcoded `20` | Should use `total_marks` |

**Fix (minimal wiring):**
- Change `profile.program` → `profile.program_name`
- Remove or label “Not available” for missing fields
- Use `asn.total_marks ?? '—'` from assignments API

**Fix (full):** Add schema + PATCH — see FEA-5

**Files:** `app/profile/page.jsx`, `app/api/students/profile/route.js`

---

### WIR-6 — Dead UI controls [LOW]

**Sign out all sessions** (`app/settings/page.jsx`):
- Button in Privacy section with **no onClick**
- No backend for session revocation (JWT has no server-side session store)
- **Fix:** Remove button OR implement token blocklist (large scope) OR document as future work

**Forgot password** (`app/components/ForgotPasswordText.jsx`):
- `<a href="#">` — no route, no API
- **Fix:** Implement forgot-password flow (email token + reset route) OR remove link

**Acceptance criteria:** No clickable UI that silently does nothing

---

### WIR-7 — Appearance preferences not applied [LOW]

**Wired:** Settings save `appearance.theme`, `appearance.fontSize` to `users.preferences`

**Not wired:** No theme provider reads values; `globals.css` static

**Fix options:**
- Read preferences in root `app/providers.js` or layout; set `data-theme` on `<html>`
- Map fontSize to CSS variable

**Files:** `app/settings/page.jsx`, `app/providers.js`, `app/globals.css`

**Acceptance criteria:** Change theme in settings → page restyles without reload (or after reload)

---

### WIR-8 — Admin Class Reminder never sends weekly schedule email [LOW]

**Symptoms:** Admin expects “Notify All” to send calendar grid email; gets generic notification instead.

**Backend logic** (`app/api/admin/notifications/route.js`):

```javascript
// Weekly schedule email ONLY when:
if (type === 'class_reminder' && session_id) {
  sendWeeklyScheduleEmail(...)
}
```

**Admin UI** (`app/admin/notifications/page.jsx`):
- Sends `{ type, message, title, recipients? }` — **never passes `session_id`**
- Therefore always hits generic email branch

**Fix options:**

**A:** Add session picker to admin UI when type is `class_reminder`

**B:** Add new type `weekly_schedule` that sends schedule email to all students without requiring `session_id`

**C:** Change class_reminder without session_id to send weekly schedule (match user expectation)

**Files:**
- `app/admin/notifications/page.jsx`
- `app/api/admin/notifications/route.js`

**Acceptance criteria:** Admin action sends HTML weekly calendar email with `.ics` when intended

---

## 4. Additional Wiring Notes (Not Separate IDs)

| Topic | Detail |
|-------|--------|
| `/api/grades` | Route exists; `app/grades/page.jsx` uses `/api/students/assignments` instead — dead route or switch UI |
| Settings detection rules | Student settings shows hardcoded ping thresholds; real values in `system_settings` via admin — fetch and display or link to admin |
| Google Classroom | Dashboard connect button wired; read `app/api/classroom/assignments` |
| Password change | **Wired** — settings calls `/api/auth/update-password` (not a wiring gap) |

---

## 5. Suggested Implementation Order

1. **WIR-4** — Faculty token routing (unblocks faculty testing)  
2. **WIR-1** — Assignment submit path + API shape + upload helper  
3. **WIR-2** — Notification bell component  
4. **WIR-3** — Preference enforcement in senders  
5. **WIR-8** — Admin weekly email trigger  
6. **WIR-5, WIR-6, WIR-7** — Polish  

---

## 6. Testing Checklist

- [ ] Course assignment upload → 200, UI status Submitted  
- [ ] `?course_id=` returns filtered list  
- [ ] Notification bell shows unread; PATCH marks read  
- [ ] Faculty on `/faculty` → API calls authenticated  
- [ ] Profile shows `program_name` correctly  
- [ ] Toggle appearance → visible change  
- [ ] Admin notify → correct email template  

---

## 7. Debugging Tips

**401 on student pages:** Check Application → Local Storage for `{role}_token` vs current URL prefix.

**API shape bugs:** Network tab → compare JSON keys to what page reads in `useState` / render.

**FormData failures:** Ensure no `Content-Type: application/json` on multipart requests.

---

## 8. Prompt Starter for New Chat

```
You are fixing CiPD 360 ERP frontend-backend wiring gaps. Read:
- cipd_erp/docs/handoffs/HANDOFF_WIRING.md
- lib/api.js
- app/courses/[courseId]/page.jsx
- app/api/students/assignments/route.js

Start with WIR-1: create assignment submit API, add apiUpload helper, align 
response fields with UI, and filter by course_id. Then WIR-2 notification bell.
Match existing JSX/CSS patterns. Do not refactor unrelated code.
```

---

## 9. Cross-Reference to Other Handoffs

| Wiring ID | Related doc |
|-----------|-------------|
| WIR-1 | HANDOFF_FEATURES.md → FEA-2 |
| WIR-3 | HANDOFF_FEATURES.md → FEA-4 |
| WIR-4 | HANDOFF_FEATURES.md → FEA-1 |
| WIR-1 leaderboard fields | HANDOFF_ATTENDANCE.md → ATT-2 |
