# CiPD 360 ERP — Feedback Module Handoff

**Purpose:** Train a new chat/agent to fix all identified feedback gaps.  
**Codebase root:** `cipd_erp/client-next/`  
**Last audited:** June 2026

---

## 1. What Feedback Is Supposed To Do

Feedback is **workflow-integrated**, not a standalone survey:

```
Session completes → rolloutFeedbackForSession()
    → Notify attended students (in-app + email)
    → Student submits form (18 questions, 6 categories)
    → Admin analytics + instructor insights
    → Leaderboard credits (+3 pts per session feedback)
```

Eligibility should follow **attendance** (present/partial). Deadline default: **24h after session end** (IST), overridable via `sessions.feedback_deadline`.

---

## 2. Architecture Overview

| Layer | Files |
|-------|-------|
| Rollout service | `lib/feedback-rollout.js` |
| Email templates | `lib/emailer.js` — `sendFeedbackAvailableEmail`, `sendFeedbackReminderEmail` |
| Student APIs | `app/api/feedback/pending`, `submit`, `my-response`, `leaderboard` |
| Admin APIs | `app/api/admin/feedback/analytics`, `forms`, `questions`, `status`, `student-response` |
| Cron | `app/api/cron/feedback-reminder/route.js` |
| Triggers | Cron on session complete, `app/api/admin/sessions/[id]/route.js`, `app/api/admin/sessions/rollout-feedback/route.js` |
| UI | `app/feedback/page.jsx`, `app/admin/feedback/page.jsx` |

**Tables:**
- `feedback_questions` — question bank (rating, yes_no, text, mcq)
- `feedback_responses` — one row per question per student per session
- `notifications` — type `feedback_available`, `feedback_deadline_reminder`
- `sessions.feedback_deadline` — optional admin override

---

## 3. Key Files (Read These First)

| File | Role |
|------|------|
| `lib/feedback-rollout.js` | Post-session notify + email |
| `app/api/feedback/submit/route.js` | Student submission (has gaps) |
| `app/api/feedback/pending/route.js` | Eligibility + deadline display |
| `app/api/admin/feedback/forms/route.js` | Form lifecycle (active/expired) |
| `app/api/admin/feedback/analytics/route.js` | Aggregations (no cache) |
| `app/api/cron/feedback-reminder/route.js` | ~4h before deadline reminders |
| `scripts/feedback_migration.sql` | Seeds 18 questions |

---

## 4. Issues To Fix (Prioritized)

### FDB-1 — No duplicate submission prevention [HIGH]

**Problem:** Student can POST `/api/feedback/submit` multiple times for the same session.

**Current behavior** (`submit/route.js`):

```javascript
const { error } = await supabaseAdmin
  .from('feedback_responses')
  .insert(records);
// No prior check; no unique constraint in schema
```

**Expected behavior:**
- Reject with 409 if any response exists for `(session_id, student_id)`
- OR use upsert with unique constraint on `(session_id, student_id, question_id)`

**Schema change (recommended):**

```sql
ALTER TABLE feedback_responses
  ADD CONSTRAINT feedback_responses_session_student_question_unique
  UNIQUE (session_id, student_id, question_id);
```

**Files:**
- `app/api/feedback/submit/route.js`
- New migration in `client-next/scripts/`
- `client-next/schema.txt` (update for docs)

**Acceptance criteria:**
- Second submit for same session returns clear error
- Analytics counts do not double after duplicate attempts

---

### FDB-2 — Deadline not enforced server-side [MEDIUM]

**Problem:** UI marks forms expired via `pending` API, but `submit` accepts any POST.

**Current behavior:**
- `pending/route.js` computes `expired` from `feedback_deadline` or end+24h IST
- `submit/route.js` has no deadline or eligibility check

**Expected behavior on submit:**
1. Verify student eligible (notification OR present/partial in `attendance_records`)
2. Load session + compute deadline (same logic as pending/forms)
3. Reject 403 if `now > deadline`
4. Reject if session cancelled

**Shared helper suggestion:** `lib/feedback-deadline.js` with `getFeedbackDeadline(session)` used by pending, submit, cron, rollout.

**Files:**
- `app/api/feedback/submit/route.js`
- `app/api/feedback/pending/route.js` (refactor to shared helper)
- `app/api/admin/feedback/forms/route.js`

**Acceptance criteria:**
- Direct API POST after deadline returns 403
- Expired forms still visible in history but not submittable

---

### FDB-3 — Analytics computed on every request [MEDIUM]

**Problem:** Admin analytics loads all completed sessions + all responses + enrollments on every GET. No caching.

**Current behavior:** `app/api/admin/feedback/analytics/route.js` — in-memory aggregation, `dynamic = 'force-dynamic'`

**Expected behavior (pick one):**
- **Light:** Add DB indexes on `feedback_responses(session_id)`, `(student_id, session_id)`; reduce N+1 in detail view
- **Medium:** Materialized view or summary table updated on submit
- **Heavy:** Redis/in-memory cache with TTL (probably overkill for BTP)

**Files:**
- `app/api/admin/feedback/analytics/route.js`
- Optional migration for indexes/views

**Acceptance criteria:**
- Overview page loads in acceptable time with 100+ sessions
- Detail view for one session does not load entire response history unnecessarily

---

### FDB-4 — Eligibility uses two inconsistent sources [LOW]

**Problem:** `pending/route.js` unions:
1. `notifications` where `type = 'feedback_available'`
2. Fallback: `attendance_records` with present/partial

Fallback can expose old sessions if legacy attendance data exists without notification.

**Expected behavior:**
- Primary: notification OR explicit rollout flag
- Fallback: only for sessions completed within last N days AND attended
- Exclude cancelled sessions
- Align with `feedback-reminder` cron (uses attendance_records only)

**Files:**
- `app/api/feedback/pending/route.js`
- `lib/feedback-rollout.js`

**Acceptance criteria:** Student only sees feedback for sessions they actually attended and that are within deadline window.

---

## 5. Cross-Module Issues (Fix While Here)

These were found in cron/rollout audit and directly affect feedback:

### ROLLOUT-1 — `feedback-rollout.js` ignores admin `feedback_deadline`

**Current behavior** (`lib/feedback-rollout.js` ~62–64):

```javascript
const deadline = new Date(`${session.session_date}T${session.end_time}+05:30`);
deadline.setHours(deadline.getHours() + 24);
// Does NOT read session.feedback_deadline
```

**Expected:** Use same deadline logic as `pending` and `feedback-reminder`:

```javascript
if (session.feedback_deadline) {
  deadline = new Date(session.feedback_deadline);
} else {
  // default end + 24h IST
}
```

**Acceptance criteria:** Email “deadline” text matches admin-set deadline in forms UI.

---

### ROLLOUT-2 — No check for active questions before rollout

Rollout sends notifications even if all questions are inactive. Consider skipping or warning admin.

---

### ROLLOUT-3 — Race condition / duplicate rollout triggers

Both cron (`process-attendance`) and admin PATCH (`sessions/[id]` mark completed) call `rolloutFeedbackForSession`.

**Mitigation:** Dedup exists via `notifications` check, but TOCTOU gap possible. Consider unique constraint on `(recipient_id, session_id, type)` for `feedback_available`.

---

### CRON-FDB — `feedback-reminder` not scheduled in repo

`app/api/cron/feedback-reminder/route.js` exists but no `vercel.json` cron config. Must be triggered externally (same as `reminder` cron).

**Also:** Reminder dedup is per-session (one notification blocks all future reminders for that session even if new students become pending).

---

### FORMS-1 — Submission rate denominator mismatch

`admin/feedback/forms` uses **enrolled** students as denominator; eligibility uses **attended**. Completion % looks wrong.

**Fix:** Use attended count or eligible count for stats.

---

## 6. Data Model Reference

**Question types:** `rating` (1–5), `yes_no`, `text`, `mcq`

**Response columns:** `rating`, `yes_no`, `text_answer` — only one populated per type

**Leaderboard feedback credit:** Any row in `feedback_responses` for `(student_id, session_id)` counts as submitted (+3 pts) — see `leaderboard/route.js`

---

## 7. Suggested Implementation Order

1. **FDB-1** — Duplicate prevention (DB constraint + API guard)  
2. **FDB-2** — Server-side deadline + eligibility on submit  
3. **ROLLOUT-1** — Align rollout deadline with admin override  
4. **FDB-4** — Tighten pending eligibility  
5. **FORMS-1** — Fix completion rate denominator  
6. **FDB-3** — Performance (indexes first, then caching if needed)  
7. **CRON-FDB** — Document or add vercel.json schedule  

---

## 8. Testing Checklist

- [ ] Attended student receives notification after session complete  
- [ ] Non-attended student does not see pending form  
- [ ] Submit once → success; submit again → 409  
- [ ] Submit after deadline → 403  
- [ ] Admin changes `feedback_deadline` → email + pending UI match  
- [ ] Analytics overview matches manual count for a test session  
- [ ] Feedback reminder cron fires once per session in 3–5h window  

**Test SQL:** `client-next/scripts/feedback_e2e_test.sql`  
**Test script:** `client-next/scripts/test-feedback-rollout.mjs`

---

## 9. Constraints for Implementer

- Use `withAuth` on student routes, `withRole(['admin'])` on admin routes
- Emails: fire-and-forget pattern already used — maintain non-blocking behavior
- IST (+05:30) for session times unless migrating to proper timezone library
- Do not break idempotent rollout (safe to call multiple times)

---

## 10. Prompt Starter for New Chat

```
You are fixing CiPD 360 ERP feedback module gaps. Read:
- cipd_erp/docs/handoffs/HANDOFF_FEEDBACK.md
- lib/feedback-rollout.js
- app/api/feedback/submit/route.js
- app/api/feedback/pending/route.js

Implement: duplicate submission prevention, server-side deadline enforcement, 
and align feedback-rollout deadline with sessions.feedback_deadline.
Add migration for unique constraint if needed. Match existing JS patterns.
```
