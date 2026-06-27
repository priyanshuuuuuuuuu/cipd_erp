# CiPD 360 ERP — Attendance Module Handoff

**Purpose:** Train a new chat/agent to fix all identified attendance gaps.  
**Codebase root:** `cipd_erp/client-next/`  
**Related repo:** `cipd_erp/RouterCodesForAttendance/` (Python Wi-Fi scanner), `cipd_erp/attendance/` (Excel ingest)  
**Last audited:** June 2026

---

## 1. What Attendance Is Supposed To Do

CiPD 360’s core research contribution is **Wi-Fi–based attendance intelligence**: classroom router snapshots → MAC matching → presence scoring → verified academic records.

Intended flow:

```
Student registers MAC → Admin approves MAC
    → wifi_monitor.py writes wifi_snapshots every ~3 min
    → attendance-worker.js calls /api/cron/process-attendance every 6 min
    → Cron matches MACs → upserts attendance_records (status, points, timing)
    → Admin verifies/overrides → Student sees attendance → Feedback eligibility
```

**Today, that flow only partially works.** Admin tooling reads Wi-Fi data; student-facing pages mostly read a **separate Excel-imported table** that never syncs with live Wi-Fi records.

---

## 2. Architecture Today (Two Parallel Systems)

| System | Primary tables | Written by | Read by |
|--------|----------------|------------|---------|
| **Wi-Fi live** | `wifi_snapshots`, `attendance_records` | Cron, admin override routes | Admin UI, feedback rollout, admin reports export |
| **Excel legacy** | `student_attendance_marks`, `student_course_attendance` | `attendance/ingest-attendance-new.js` | Student dashboard, `/attendance`, leaderboard |

Status enums differ:

- Wi-Fi: `present`, `partial`, `absent` (+ `points` 0–6 on `attendance_records`)
- Excel: `P`, `PO`, `C`, `H`, `A`, `L` on `student_attendance_marks`

Scoring differs:

- Wi-Fi: `lib/attendance-points.js` — presence % tiers + early bonus (max 6/session)
- Leaderboard: reads Excel marks with 5+1+3 model (max 9/session) — see Feedback handoff for overlap

---

## 3. Key Files (Read These First)

| File | Role |
|------|------|
| `app/api/cron/process-attendance/route.js` | Main Wi-Fi processor (2-pass cron) |
| `lib/attendance-points.js` | 0–6 point scoring algorithm |
| `scripts/attendance-worker.js` | Polls cron every 6 min |
| `RouterCodesForAttendance/wifi_monitor.py` | Inserts `wifi_snapshots` |
| `app/api/admin/attendance/session-students/route.js` | Live session view + recalc |
| `app/api/admin/attendance/override/route.js` | Manual override |
| `app/api/students/attendance/summary/route.js` | Student % — uses **Excel tables** |
| `app/api/students/attendance/sessions/route.js` | Student history — uses **Excel tables** |
| `app/api/feedback/leaderboard/route.js` | Uses **Excel marks** as “authoritative” |
| `attendance/ingest-attendance-new.js` | External Excel → marks ingest |
| `client-next/schema.txt` | Base schema (outdated; missing many tables) |

---

## 4. Issues To Fix (Prioritized)

### ATT-1 — Dual attendance systems not unified [CRITICAL]

**Problem:** Students never see Wi-Fi attendance on their dashboard if only `attendance_records` is populated.

**Current behavior:**
- Cron writes `attendance_records` from `wifi_snapshots`
- `GET /api/students/attendance/summary` and `.../sessions` read `student_attendance_marks` + `student_course_attendance`
- No sync job bridges the two

**Expected behavior:** Single source of truth for student and admin views. Pick one approach:

**Option A (recommended):** Migrate student APIs to read `attendance_records` (+ join `sessions`, `courses`). Keep Excel ingest only for historical backfill, or write a one-time migration script.

**Option B:** After each cron cycle, upsert derived rows into `student_attendance_marks` with mapped statuses (`present`→`P`, etc.).

**Files:**
- `app/api/students/attendance/summary/route.js`
- `app/api/students/attendance/sessions/route.js`
- `app/api/cron/process-attendance/route.js`
- `app/attendance/page.jsx`, `app/dashboard/page.jsx`

**Acceptance criteria:**
- After a live session with Wi-Fi detection, student `/attendance` shows that session within one cron cycle
- Overall % and calendar reflect Wi-Fi records for enrolled courses
- Historical Excel data still visible (if required) or clearly labeled as legacy

**Dependencies:** Resolve ATT-2 if leaderboard should stay aligned.

---

### ATT-2 — Leaderboard uses different points scale [HIGH]

**Problem:** Leaderboard comment says `student_attendance_marks` is “authoritative”; Wi-Fi uses `attendance_records.points` (0–6).

**Current behavior:**
- `app/api/feedback/leaderboard/route.js` paginates `student_attendance_marks`, maps P/PO/C→5+1 bonus, H→3, feedback→3 pts
- Cron stores `points` on `attendance_records` via `calculatePoints()`

**Expected behavior:** One scoring model everywhere, or explicit dual display with labels.

**Suggested fix:**
- After ATT-1 unification, rebuild leaderboard from `attendance_records.points` + feedback credits
- Or document and implement a mapping layer in `lib/attendance-points.js` exported for leaderboard use

**Files:**
- `app/api/feedback/leaderboard/route.js`
- `lib/attendance-points.js`
- `app/leaderboard/page.jsx`, `app/admin/leaderboard/page.jsx`

**Acceptance criteria:** Leaderboard ranks match student attendance page points for the same sessions.

---

### ATT-3 — `mac_verified` not enforced in cron [HIGH]

**Problem:** MAC approval workflow exists but matching ignores verification flag.

**Current behavior** (`process-attendance/route.js` ~lines 77–80):

```javascript
.from('students')
.select('id, enrollment_no, mac_address')
.not('mac_address', 'is', null);
// NO .eq('mac_verified', true)
```

**Expected behavior:** Only students with `mac_verified === true` are matched for attendance credit.

**Also update:** `session-students`, `live-students`, any route building `macToStudent` maps.

**Files:**
- `app/api/cron/process-attendance/route.js`
- `app/api/admin/attendance/session-students/route.js`
- `app/api/admin/live-students/route.js`

**Acceptance criteria:**
- Student with unapproved MAC never gets `attendance_records` from cron
- Admin live view still shows unverified MACs as “unidentified” or “pending approval”

---

### ATT-4 — Venue BSSID not used to filter snapshots [HIGH]

**Problem:** All snapshots in a time window apply to every session that day, regardless of room.

**Current behavior:**
- Sessions fetched without venue join for filtering
- Snapshots filtered by `captured_at` only, not by venue/router BSSID
- `venues.router_bssid` exists and is editable in admin settings but unused in matching logic

**Expected behavior:**
- Join session → venue → `router_bssid`
- Filter snapshot clients by BSSID when available, OR scope scanner per venue
- If single global scanner: document limitation and match only sessions at the scanner’s venue

**Files:**
- `app/api/cron/process-attendance/route.js`
- `app/api/admin/attendance/session-students/route.js`
- `app/api/admin/settings/bssid/route.js` (config source)

**Acceptance criteria:**
- Student in Room A not marked present for simultaneous session in Room B (when BSSIDs differ)

**Note:** Confirm `iw_dump` JSON structure includes BSSID per client — inspect sample rows in `wifi_snapshots`.

---

### ATT-5 — Legacy `calculate_attendance()` RPC on manual complete [MEDIUM]

**Problem:** Admin marking session `completed` triggers old ping-based RPC, not Wi-Fi logic.

**Current behavior** (`app/api/admin/sessions/[id]/route.js`):

```javascript
if (status === 'completed') {
  await supabaseAdmin.rpc('calculate_attendance', { p_session: id });
  rolloutFeedbackForSession(id)...
}
```

RPC aggregates `attendance_ping_logs` with simple 3-ping threshold — superseded by cron + snapshots.

**Expected behavior:** On manual complete, either:
- Trigger same logic as cron for that session (extract shared function), OR
- Skip RPC and rely on cron pass 2, OR
- Call cron endpoint internally for one session

**Files:**
- `app/api/admin/sessions/[id]/route.js`
- `schema.txt` (RPC definition)
- Consider new `lib/process-session-attendance.js` shared by cron and admin

**Acceptance criteria:** Manual “mark completed” produces same `attendance_records` as cron would.

---

### ATT-6 — Legacy tables undocumented in migrations [MEDIUM]

**Problem:** `student_attendance_marks` and `student_course_attendance` used in production but no DDL in `client-next/scripts/`.

**Inferred columns (from code):**

`student_attendance_marks`: `student_id`, `session_id`, `session_date`, `session_slot`, `status`, `course_id`, …

`student_course_attendance`: `student_id`, `course_id`, `attendance_percentage`

**Expected behavior:** Add proper migration SQL under `client-next/scripts/` OR deprecate tables after ATT-1 migration.

**Files:**
- `attendance/ingest-attendance-new.js`
- New: `client-next/scripts/migration_student_attendance_marks.sql` (if keeping)

**Acceptance criteria:** Fresh DB setup from migrations includes all tables student APIs need, OR student APIs no longer reference these tables.

---

### ATT-7 — Admin snapshot route uses legacy ping logs [LOW]

**Problem:** `GET /api/admin/attendance/snapshot` reads `attendance_ping_logs`; live system uses `wifi_snapshots`.

**Files:** `app/api/admin/attendance/snapshot/route.js`

**Suggested fix:** Align with `session-students` route — use `wifi_snapshots` timeline + `attendance_records`.

**Acceptance criteria:** Snapshot view consistent with admin attendance monitoring page.

---

## 5. Related Cron/Timezone Issues (Cross-Cutting)

These affect attendance processing — fix if working on cron:

| Issue | File | Summary |
|-------|------|---------|
| `tenMinAgo` uses UTC, `currentTime` uses IST hack | `process-attendance/route.js` ~68–74 | “Just ended” window wrong on Vercel |
| IST offset breaks on non-UTC servers | Same file ~49–51 | Use `Intl` or `date-fns-tz` with `Asia/Kolkata` |
| Worker class hours use server local time | `scripts/attendance-worker.js` | Alerts may fire at wrong times |

---

## 6. Suggested Implementation Order

1. **ATT-3** — Quick win, security/workflow integrity  
2. **ATT-5** — Stop RPC from writing conflicting records  
3. **ATT-1** — Core unification (largest effort)  
4. **ATT-2** — Align leaderboard after source of truth chosen  
5. **ATT-4** — Venue scoping (may need hardware/schema confirmation)  
6. **ATT-6, ATT-7** — Schema/docs cleanup  

---

## 7. Testing Checklist

- [ ] Register MAC → unverified → cron run → no record  
- [ ] Admin approves MAC → cron run → record with correct `points`  
- [ ] Student `/attendance` shows session after cron  
- [ ] Admin override with `admin_override` → cron does not overwrite  
- [ ] Manual session complete → feedback rollout + attendance consistent with cron  
- [ ] Two overlapping sessions different venues → no cross-attendance (if ATT-4 done)  

---

## 8. Constraints for Implementer

- Stack: Next.js 14 App Router, JavaScript (not TypeScript in existing code), Supabase PostgreSQL
- Auth: JWT via `withAuth` / `withRole`; server uses `supabaseAdmin`
- Do not break Excel historical data without migration plan
- Session times stored as IST values in DB
- Cron secured with `CRON_SECRET` (Bearer for process-attendance)

---

## 9. Prompt Starter for New Chat

Copy into a new agent session:

```
You are fixing CiPD 360 ERP attendance gaps. Read:
- cipd_erp/docs/handoffs/HANDOFF_ATTENDANCE.md
- lib/attendance-points.js
- app/api/cron/process-attendance/route.js
- app/api/students/attendance/summary/route.js

Goal: Unify student-facing attendance with Wi-Fi attendance_records, enforce mac_verified, 
and fix legacy RPC/snapshot inconsistencies. Follow acceptance criteria in the handoff doc.
Do not change unrelated modules. Match existing JS patterns.
```
