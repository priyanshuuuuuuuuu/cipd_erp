# CiPD 360 ERP — Attendance System: Complete Analysis & Fix Handoff

**Document type:** Training handoff for a new agent/chat session  
**Project:** CiPD 360 ERP (BTP — IIIT Delhi iPD-CIPD programme)  
**Codebase root:** `cipd_erp/client-next/`  
**Last analyzed:** June 2026  

**Use this document to:** understand how attendance works today, why student and admin views disagree, and what to fix — without re-auditing the repo from scratch.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Research Intent vs Production Reality](#2-research-intent-vs-production-reality)
3. [System Architecture](#3-system-architecture)
4. [Database Model](#4-database-model)
5. [Pipeline A — Wi-Fi Live Attendance](#5-pipeline-a--wi-fi-live-attendance)
6. [Pipeline B — Excel Legacy Attendance](#6-pipeline-b--excel-legacy-attendance)
7. [Scoring Systems Compared](#7-scoring-systems-compared)
8. [MAC Registration & Verification](#8-mac-registration--verification)
9. [API Route Inventory](#9-api-route-inventory)
10. [Frontend Pages & Data Sources](#10-frontend-pages--data-sources)
11. [Admin Override & Penalty Logic](#11-admin-override--penalty-logic)
12. [Downstream Consumers](#12-downstream-consumers)
13. [Identified Issues (Full Catalog)](#13-identified-issues-full-catalog)
14. [Timezone & Cron Bugs](#14-timezone--cron-bugs)
15. [Recommended Fix Strategy](#15-recommended-fix-strategy)
16. [Implementation Phases](#16-implementation-phases)
17. [Testing Playbook](#17-testing-playbook)
18. [File Index](#18-file-index)
19. [Prompt Starter for New Chat](#19-prompt-starter-for-new-chat)

---

## 1. Executive Summary

CiPD 360’s attendance subsystem is **two systems running in parallel** that were never unified:

| | **Wi-Fi Live System** | **Excel Legacy System** |
|---|----------------------|-------------------------|
| **Purpose** | Real-time cyber-physical attendance from router telemetry | Historical programme attendance from Excel sheets |
| **Primary tables** | `wifi_snapshots`, `attendance_records` | `student_attendance_marks`, `student_course_attendance` |
| **Who writes** | Cron, admin session-students recalc, admin override | `attendance/ingest-attendance-new.js` (external script) |
| **Who reads** | Admin UI, feedback eligibility, admin weekly chart, CSV export | **Student dashboard, `/attendance`, leaderboard** |

**Critical consequence:** A student can be marked **present by Wi-Fi** (visible to admin) but show **no attendance or wrong %** on their student portal because those pages read Excel-imported marks, not `attendance_records`.

**Secondary issues:** MAC approval is cosmetic (not enforced in cron), venue BSSID is stored but never used for matching, manual session-complete still calls a legacy ping-based RPC, and leaderboard uses a third scoring model.

---

## 2. Research Intent vs Production Reality

### Intended (from project vision)

```
Student registers device MAC
    → Admin verifies MAC
    → Classroom router scanned every ~3 min (Python)
    → Snapshots stored in wifi_snapshots
    → Cron every 6 min matches MAC → scores presence
    → attendance_records written (status + 0–6 points)
    → Student sees attendance → Feedback released to attendees
    → Admin can override → Reports/analytics updated
```

### What actually happens

```
                    ┌─────────────────────────────────────┐
                    │         Wi-Fi Pipeline              │
                    │  wifi_monitor.py → wifi_snapshots   │
                    │  → process-attendance cron          │
                    │  → attendance_records               │
                    └──────────────┬──────────────────────┘
                                   │
         Admin sees ◄──────────────┤ Feedback rollout ◄───┐
         Live students            │ Leaderboard NO       │
         Override                 │ Student UI NO        │
                                   │                      │
                    ┌──────────────▼──────────────────────┐
                    │       Excel Pipeline                │
                    │  ingest-attendance-new.js           │
                    │  → student_attendance_marks         │
                    │  → student_course_attendance        │
                    └──────────────┬──────────────────────┘
                                   │
         Student sees ◄────────────┤ Leaderboard ◄────────┘
         Dashboard /attendance
```

The Wi-Fi pipeline is **real and functional** for admin operations. The student experience is still wired to **pre-Wi-Fi Excel data**.

---

## 3. System Architecture

### 3.1 Physical / cyber-physical layer

| Component | Location | Role |
|-----------|----------|------|
| `RouterCodesForAttendance/wifi_monitor.py` | Campus Windows machine | Selenium login to router admin + nmap ARP scan; inserts into Supabase |
| `RouterCodesForAttendance/watchdog.py` | Same machine | Restarts monitor on failure |
| `client-next/scripts/attendance-worker.js` | Server or local daemon | HTTP GET to `/api/cron/process-attendance` every 6 min |

**Scanner interval:** ~180 seconds in Python (`SCAN_INTERVAL` env), ~6 minutes for cron worker (configurable via `system_settings.scanner_interval_minutes`).

### 3.2 Application layer

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 App Router, React, Recharts |
| API | Next.js Route Handlers in `app/api/` |
| DB | Supabase PostgreSQL via `supabaseAdmin` (service role) |
| Auth | JWT in localStorage; `withAuth` / `withRole` on routes |

### 3.3 Data flow diagram

```mermaid
flowchart TB
  subgraph physical [Campus Hardware]
    R[Classroom Router]
    PY[wifi_monitor.py]
    R --> PY
  end

  subgraph db [Supabase PostgreSQL]
    WS[wifi_snapshots]
    AR[attendance_records]
    SAM[student_attendance_marks]
    SCA[student_course_attendance]
    STU[students.mac_address]
  end

  subgraph automation [Automation]
    W[attendance-worker.js]
    CRON[process-attendance route]
    W --> CRON
    CRON --> AR
    PY --> WS
    CRON --> WS
  end

  subgraph excel [Offline Import]
    XLS[ingest-attendance-new.js]
    XLS --> SAM
    XLS --> SCA
  end

  subgraph adminUI [Admin Portal]
    A1[/admin/attendance]
    A2[/admin/live-students]
    A3[/admin/wifi-logs]
  end

  subgraph studentUI [Student Portal]
    S1[/dashboard]
    S2[/attendance]
    S3[/leaderboard]
  end

  WS --> CRON
  STU --> CRON
  AR --> A1
  AR --> A2
  SAM --> S1
  SAM --> S2
  SAM --> S3
  AR -.->|NOT CONNECTED| S1
```

---

## 4. Database Model

### 4.1 Core Wi-Fi tables

#### `wifi_snapshots`

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint | PK |
| `captured_at` | timestamptz | When scan ran |
| `iw_dump` | jsonb | Array of `{ mac, signal, name?, ip? }` — may be double JSON-encoded string |
| `error` | text | Scanner error if any |

**Not in `schema.txt`** — defined in `supabase/schemas/schema_update.sql` only.

#### `attendance_records`

Base (`schema.txt`):

| Column | Type |
|--------|------|
| `id` | uuid |
| `session_id` | uuid FK → sessions |
| `student_id` | uuid FK → students |
| `ping_count` | int |
| `status` | enum: `present`, `partial`, `absent` |
| `calculated_at` | timestamp |

**Added by migrations:**

| Column | Migration | Purpose |
|--------|-----------|---------|
| `points` | `migration_add_points.sql` | 0–6 gamified score |
| `first_seen_at`, `last_seen_at`, `duration_minutes`, `avg_signal_strength` | `migration_wifi_attendance.sql` | Timeline metadata |
| `admin_override`, `override_by`, `penalty`, `penalty_reason` | `migration_override_columns.sql` | Manual admin actions |

**Unique constraint:** `(session_id, student_id)`

#### `students` (attendance-relevant columns)

| Column | Purpose |
|--------|---------|
| `mac_address` | Registered device MAC |
| `mac_verified` | Admin approval flag (default false) |
| `device_hash` | Legacy client ping identifier |

#### `venues`

| Column | Purpose |
|--------|---------|
| `router_bssid` | Unique router identifier — **stored but not used in matching** |

#### `system_settings` (row id=1)

| Column | Used by |
|--------|---------|
| `scanner_interval_minutes` / `ping_interval` | Expected snapshot count in scoring |
| `min_signal` / `presence_threshold` | Minimum Wi-Fi signal to count detection |
| `attendance_window` | Documented in migration comments |

### 4.2 Excel legacy tables

**No CREATE TABLE in `client-next/scripts/`** — tables exist in production from manual setup or ingest script side effects.

#### `student_attendance_marks` (inferred from code)

| Column | Source |
|--------|--------|
| `id` | sessions route |
| `student_id` | All student attendance APIs |
| `session_id` | Nullable — linked sessions only counted |
| `session_date` | Calendar/streak logic |
| `session_slot` | Slot position (1–4 per day) |
| `status` | `P`, `PO`, `H`, `A`, `L`, `C` |
| `course_id` | Per-course breakdown |
| `source_domain`, `source_sheet`, `iso_week` | Ingest metadata |

#### `student_course_attendance` (inferred)

| Column | Purpose |
|--------|---------|
| `student_id`, `course_id` | PK pair |
| `attendance_percentage` | Pre-computed % shown on student dashboard |

### 4.3 Legacy ping table (superseded)

#### `attendance_ping_logs`

Written by `POST /api/students/attendance/ping` (no active frontend caller found). Still used by:

- `calculate_attendance()` PostgreSQL RPC in `schema.txt`
- `GET /api/admin/attendance/snapshot` (hybrid with records)

### 4.4 Status enum mapping (if unifying)

| Wi-Fi `attendance_records.status` | Excel `student_attendance_marks.status` | Suggested unified display |
|--------------------------------|----------------------------------------|---------------------------|
| `present` | `P`, `PO`, `C` | Present |
| `partial` | `H` | Partial / Half |
| `absent` | `A` | Absent |
| — | `L` | Leave (Excel only today) |

---

## 5. Pipeline A — Wi-Fi Live Attendance

### 5.1 Step 1: Snapshot collection

**File:** `cipd_erp/RouterCodesForAttendance/wifi_monitor.py`

- Headless Chrome logs into router admin UI
- Scrapes connected devices; supplements with `nmap` ARP scan
- Merges by MAC, filters weak signals
- Inserts row into `wifi_snapshots` with JSON array in `iw_dump`
- Runs every `SCAN_INTERVAL` seconds (default 180)
- Requires env: `ROUTER_PASSWORD`, `SUPABASE_SNAPSHOTS_URL`, `SUPABASE_SERVICE_KEY`

### 5.2 Step 2: Cron trigger

**File:** `client-next/scripts/attendance-worker.js`

- Polls `GET ${APP_URL}/api/cron/process-attendance`
- Header: `Authorization: Bearer ${CRON_SECRET}`
- Interval: 6 minutes
- Retry + alert email on failure during “class hours” (uses **server local time**, not IST)

### 5.3 Step 3: Process attendance (Pass 1)

**File:** `client-next/app/api/cron/process-attendance/route.js`

**Auth:** `Authorization: Bearer ${CRON_SECRET}`

**Algorithm (per active session today):**

1. Load `system_settings` → `SCANNER_INTERVAL_MIN`, `MIN_SIGNAL`
2. Compute IST “today” and `currentTime` via UTC+5.5h offset (see §14 for bugs)
3. Fetch all sessions where `session_date = today`
4. Filter **active sessions:**
   - `isOngoing`: `start_time <= now <= end_time`
   - `justEnded`: ended within last 10 minutes (buggy time comparison — see §14)
5. Load **all students** with non-null `mac_address` — **does NOT filter `mac_verified`**
6. Build `macToStudent` map with `normalizeMac()`
7. For each active session:
   - Compute session window: `[start, end+2min]` in IST (`+05:30`)
   - `expectedTotalSnapshots = floor(durationMin / SCANNER_INTERVAL_MIN)`
   - Query `wifi_snapshots` in time window
   - Parse each snapshot’s `iw_dump` → extract clients with `mac`, `signal`
   - Skip if `signal <= MIN_SIGNAL` or invalid MAC format
   - Build `macTimeline[mac]` → list of `{ snapshotId, time, signal }`
8. For each matched student:
   - `uniqueSnapshots` = set of snapshot IDs seen
   - Call `calculatePoints(uniqueSnapshots, orderedSnapshotIds, expectedTotalSnapshots)`
   - If ongoing and `0 < pingCount < 3` → force `status = 'partial'`
   - Build upsert row with timing fields
9. Skip upsert for students with `admin_override=true` OR `penalty=true` on existing row
10. Upsert into `attendance_records` on conflict `(session_id, student_id)`
11. If session just ended → set `sessions.status = 'completed'` → call `rolloutFeedbackForSession()`

**MAC normalization** (used everywhere):

```javascript
mac.trim().toUpperCase()
  .replace(/[-.\s]/g, ':')
  .replace(/:+/g, ':')
  .replace(/^:|:$/g, '');
// Valid: /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/
```

### 5.4 Step 4: Pass 2 — Missed session sweep

Same file, lines ~218–254:

- Finds sessions where `status NOT IN (completed, cancelled)` AND (date < today OR ended before now)
- Marks each `completed`
- Calls `rolloutFeedbackForSession(session.id, null)` — loads attendees from DB
- **Does NOT re-process Wi-Fi attendance** for missed sessions in Pass 2

**Gap:** If cron was down during a session, Pass 2 completes the session and rolls out feedback but may never write attendance records unless Pass 1 runs while snapshots still exist in window.

### 5.5 Scoring function

**File:** `client-next/lib/attendance-points.js`

```
presencePercent = (studentSnapshotsSeen / max(actualSnapshots, expectedSnapshots)) * 100

Attendance points (0–5):
  ≥85% → 5
  ≥70% → 4
  ≥45% → 3
  <45% → 0 (status: absent)

Bonus (+1):
  Seen in any of first 2 snapshots in session → early arrival

Total points: 0–6
Final status from scoring: 'present' or 'absent'
(Cron may override to 'partial' for ongoing sessions)
```

**Design intent:** Using `max(actual, expected)` prevents scanner downtime from inflating presence percentage.

---

## 6. Pipeline B — Excel Legacy Attendance

### 6.1 Ingest script

**File:** `cipd_erp/attendance/ingest-attendance-new.js`

**What it does:**

1. Reads Excel workbook (programme attendance sheets Jan–Apr 2026)
2. Matches rows to DB sessions by `(date, slot position)` — does **not** modify `sessions` table
3. Upserts `student_attendance_marks` with status codes P/PO/H/A/L/C
4. Recomputes and upserts `student_course_attendance.attendance_percentage`

**Status mapping:**

| Excel code | DB status |
|------------|-----------|
| P | P |
| P(O), PO | PO |
| H | H |
| A | A |
| L | L |
| C | C |

**Security note:** This script contains hardcoded Supabase URL and service key — should be moved to env vars (out of scope for attendance logic fix, but flag for security chat).

**Important:** Re-running ingest does **not** touch `attendance_records` or `wifi_snapshots`.

### 6.2 Student API consumption

**`GET /api/students/attendance/summary`** reads:

1. `course_enrollments` → enrolled courses
2. `student_course_attendance` → pre-computed % per course
3. `student_attendance_marks` → all marks for calendar, streak, weekly charts

Overall % formula (Excel-based):

```
P/PO/C → +1.0 point each
H → +0.5
A → -1.0
L → leave (not in point divisor logic the same way)
overallPct = max(0, (overallPoints / overallTotal) * 100)
```

**`GET /api/students/attendance/sessions`** reads:

- `student_attendance_marks` joined to `sessions`
- Maps status to display strings via `mapStatusForDisplay()` and `statusToPoints()` (1.0 / 0.5 / -1.0 scale — **not** Wi-Fi 0–6 scale)
- Comment in code says: *"Map to the shape the frontend expects (same as old attendance_records shape)"* — but data source is marks table, not records

---

## 7. Scoring Systems Compared

Three different models exist in the codebase:

| Context | Scale | Source |
|---------|-------|--------|
| Wi-Fi cron / admin | **0–6 points** per session | `lib/attendance-points.js` → `attendance_records.points` |
| Student summary/sessions | **-1 to +1** per session | Derived from Excel status in sessions route |
| Leaderboard | **0–9** per session (5+1+3) | `student_attendance_marks` + feedback | 

**Leaderboard** (`app/api/feedback/leaderboard/route.js`):

```javascript
// Comment: "Built from student_attendance_marks (the authoritative attendance table)"
P/PO/C → 5 attendance pts + 1 bonus
H → 3 pts
Feedback submitted → +3 pts
Max 9 per session
```

**Admin override present** assigns `points: 0.5` manually — inconsistent with 0–6 Wi-Fi scale.

---

## 8. MAC Registration & Verification

### 8.1 Intended workflow

```
Student PATCH /api/students/mac
    → students.mac_address set, mac_verified = false
Student sees "Pending Verification" in settings
Admin GET/PATCH /api/admin/settings/mac-approvals
    → approve: mac_verified = true
    → reject: mac_address cleared
Cron matches MAC → attendance_records
```

### 8.2 Actual enforcement gap

| Step | Enforces `mac_verified`? |
|------|--------------------------|
| Student register MAC | Sets `mac_verified=false` ✅ |
| Admin approve | Sets `mac_verified=true` ✅ |
| Cron `process-attendance` | **NO** — any non-null MAC matched |
| Admin `session-students` | Shows flag but still matches unverified MACs |
| Admin `live-students` | Shows `macVerified` in UI but matches all MACs |

**Fix:** Add `.eq('mac_verified', true)` to student queries in cron and matching routes. Live view should still **display** unverified devices as unidentified/pending.

### 8.3 Relevant files

| File | Role |
|------|------|
| `app/api/students/mac/route.js` | Student registers MAC |
| `app/api/students/profile/route.js` | Returns `mac_verified` (no-cache) |
| `app/api/admin/settings/mac-approvals/route.js` | Admin approve/reject |
| `app/settings/page.jsx` | Student MAC UI + polling |
| `app/admin/attendance/page.jsx` | Admin MAC approval tab |

---

## 9. API Route Inventory

### 9.1 Wi-Fi / live system

| Route | Method | Auth | Reads | Writes |
|-------|--------|------|-------|--------|
| `/api/cron/process-attendance` | GET | CRON_SECRET Bearer | `wifi_snapshots`, `sessions`, `students`, `system_settings`, `attendance_records` | `attendance_records`, `sessions.status` |
| `/api/admin/attendance/session-students` | GET | admin | snapshots, records, enrollments | **Upserts** `attendance_records` (live recalc) |
| `/api/admin/attendance/override` | POST | admin | sessions | **Upserts** `attendance_records` (+ penalty cascade) |
| `/api/admin/attendance/weekly` | GET | admin | `attendance_records`, `sessions` | — |
| `/api/admin/attendance/sessions-by-date` | GET | admin | sessions, snapshot counts | — |
| `/api/admin/attendance/snapshot` | GET | admin | records, **ping_logs** (legacy) | — |
| `/api/admin/live-students` | GET | admin | latest `wifi_snapshots` | — |
| `/api/admin/wifi-logs` | GET | admin | `wifi_snapshots` paginated | — |
| `/api/students/attendance/presence` | GET | student | latest snapshots vs own MAC | — |
| `/api/students/attendance/ping` | POST | student | — | `attendance_ping_logs` (legacy, unused UI) |
| `/api/admin/reports/export` | GET | admin | `attendance_records`, ping logs | — |

### 9.2 Excel / student-facing system

| Route | Method | Auth | Reads | Writes |
|-------|--------|------|-------|--------|
| `/api/students/attendance/summary` | GET | student | `student_attendance_marks`, `student_course_attendance` | — |
| `/api/students/attendance/sessions` | GET | student | `student_attendance_marks` | — |
| `/api/feedback/leaderboard` | GET | any auth | `student_attendance_marks`, `feedback_responses` | — |

### 9.3 Session lifecycle (affects attendance)

| Route | Attendance impact |
|-------|-------------------|
| `PATCH /api/admin/sessions/[id]` status=completed | Calls **`calculate_attendance()` RPC** (ping-based legacy) + feedback rollout |
| Cron Pass 1 end of session | Marks completed + Wi-Fi records + feedback |
| Cron Pass 2 | Marks completed + feedback only (no Wi-Fi reprocess) |

---

## 10. Frontend Pages & Data Sources

| Page | API calls | Data source | Shows Wi-Fi? |
|------|-----------|-------------|--------------|
| `app/dashboard/page.jsx` | `/api/students/attendance/summary` | Excel marks | **No** |
| `app/attendance/page.jsx` | summary + sessions | Excel marks | **No** |
| `app/profile/page.jsx` | summary | Excel marks | **No** |
| `app/admin/attendance/page.jsx` | sessions-by-date, session-students, override, mac-approvals | Wi-Fi records | **Yes** |
| `app/admin/live-students/page.jsx` | live-students | wifi_snapshots | **Yes** |
| `app/admin/wifi-logs/page.jsx` | wifi-logs | wifi_snapshots | **Yes** |
| `app/admin/page.jsx` | attendance/weekly | attendance_records | **Yes** |
| `app/leaderboard/page.jsx` | feedback/leaderboard | Excel marks | **No** |
| `app/admin/leaderboard/page.jsx` | same | Excel marks | **No** |
| `app/settings/page.jsx` | mac, profile | MAC registration | N/A |

**Student attendance page expectations** (from sessions API mapping):

- Expects fields: `status`, `points`, `ping_count`, nested `sessions` object
- Sessions route **fabricates** these from Excel marks — `ping_count: null`, points from 1.0/0.5/-1.0 scale

---

## 11. Admin Override & Penalty Logic

**File:** `app/api/admin/attendance/override/route.js`

### Present override

```javascript
{ status: 'present', points: 0.5, admin_override: true, penalty: false }
```

Cron **skips upsert** for rows where `admin_override=true` OR `penalty=true`.

### Absent override (faking attendance)

1. Mark target session: absent, points 0, penalty=true
2. Find all sessions same course ±7 days from session date
3. Upsert penalty records for all those sessions: absent, points 0, penalty=true

**Inconsistency:** Override present gives 0.5 points; Wi-Fi scale is 0–6. Product decision needed on unified override points.

---

## 12. Downstream Consumers

Attendance records affect modules outside the attendance UI:

| Consumer | Uses | Condition |
|----------|------|-----------|
| `lib/feedback-rollout.js` | `attendance_records` present/partial | Who gets feedback notifications |
| `app/api/feedback/pending/route.js` | notifications + attendance_records fallback | Student feedback eligibility |
| `app/api/cron/feedback-reminder/route.js` | attendance_records | Reminder recipients |
| `app/api/admin/sessions/[id]/route.js` | RPC + rollout on manual complete | Legacy ping aggregation |

**If student APIs switch to `attendance_records`**, leaderboard (ATT-2) and summary % formulas must be redesigned together.

---

## 13. Identified Issues (Full Catalog)

### ATT-1 — Dual systems not unified [CRITICAL]

**Symptom:** Admin shows Wi-Fi present; student portal empty or shows old Excel data.

**Root cause:** No sync between `attendance_records` and `student_attendance_marks`.

**Fix options:** See §15.

---

### ATT-2 — Leaderboard / scoring mismatch [HIGH]

**Symptom:** Leaderboard ranks don’t match Wi-Fi points or student attendance page.

**Root cause:** Three scoring models (§7).

**Fix:** After ATT-1, point leaderboard at `attendance_records.points` + feedback credits with documented formula.

---

### ATT-3 — `mac_verified` not enforced [HIGH]

**Symptom:** Student gets attendance credit before admin approves MAC.

**Root cause:** Cron line 77–80 loads all MACs without verification filter.

**Fix:** `.eq('mac_verified', true)` in cron + session-students matching; keep live view showing unverified as pending.

---

### ATT-4 — Venue BSSID unused [HIGH]

**Symptom:** Student detected anywhere on campus network marked present for any concurrent session.

**Root cause:** Snapshots filtered by time only; `venues.router_bssid` never compared to client BSSID in `iw_dump`.

**Fix steps:**
1. Inspect real `iw_dump` JSON for BSSID field name
2. Join session → venue → `router_bssid`
3. Filter clients per session by matching BSSID
4. If single global scanner: assign default venue to scanner or document single-venue limitation

---

### ATT-5 — Legacy RPC on manual complete [MEDIUM]

**Symptom:** Admin “mark completed” may write different attendance than cron.

**Root cause:** `sessions/[id]/route.js` calls `supabaseAdmin.rpc('calculate_attendance', { p_session: id })` which aggregates `attendance_ping_logs` with 3-ping rule.

**Fix:** Remove RPC call; extract shared `processSessionAttendance(sessionId)` from cron logic; call from admin PATCH and cron.

---

### ATT-6 — Legacy tables undocumented [MEDIUM]

**Symptom:** Fresh DB from migrations missing `student_attendance_marks`.

**Fix:** Add migration SQL OR deprecate tables after student API migration.

---

### ATT-7 — Admin snapshot uses ping logs [LOW]

**File:** `app/api/admin/attendance/snapshot/route.js`

**Fix:** Align with `session-students` — use `wifi_snapshots` timeline.

---

### ATT-8 — Pass 2 doesn’t backfill Wi-Fi attendance [MEDIUM]

**Symptom:** Missed cron window → session marked completed, feedback sent, but no attendance records.

**Fix:** In Pass 2 loop, run same snapshot processing as Pass 1 before marking completed (if snapshots still in DB window).

---

### ATT-9 — Override points inconsistent [LOW]

Admin present override = 0.5 pts; Wi-Fi max = 6. Document or align.

---

## 14. Timezone & Cron Bugs

### Bug 1: Mixed UTC/IST in “just ended” window

**File:** `process-attendance/route.js` lines 49–51 vs 68–69

- `currentTime` derived from IST-shifted Date
- `tenMinAgoTime` derived from **UTC** `now.getHours()`

On Vercel (UTC), “just ended” window is ~5.5 hours too wide → sessions reprocessed every cron cycle (upserts safe, wasteful).

### Bug 2: IST offset only valid on UTC servers

`nowIST = new Date(now.getTime() + 5.5h)` then uses `getHours()` — if server already in IST, double-shifts.

**Fix:** Use `Intl.DateTimeFormat` with `timeZone: 'Asia/Kolkata'` or `date-fns-tz`.

### Bug 3: `session-students` uses UTC for `today`/`currentTime`

Line 62–65: `now.toISOString().split('T')[0]` for today — may differ from IST date near midnight.

### Bug 4: Worker class hours

`attendance-worker.js` `isClassHours()` uses server local hour, not IST.

---

## 15. Recommended Fix Strategy

### Primary recommendation: Option A — Student APIs read `attendance_records`

**Why:** Wi-Fi is the intended production path; Excel is historical backfill.

**Steps:**

1. **Create shared module** `lib/process-session-attendance.js`
   - Export: `processSessionAttendance(sessionId)`, `buildMacTimeline(snapshots, minSignal)`, `matchStudents(macTimeline, students)`
   - Used by cron Pass 1, Pass 2 backfill, admin session-students, admin manual complete

2. **Rewrite student APIs**
   - `summary/route.js`: Query `attendance_records` JOIN `sessions` JOIN `courses` for enrolled student
   - Compute % as: `present+s partial / total sessions` OR sum of `points / (sessions * 6)`
   - Optionally merge historical Excel marks for dates before Wi-Fi go-live with `source: 'legacy'` flag

3. **Update leaderboard** to use `attendance_records.points`

4. **Enforce mac_verified** in shared matching logic

5. **Add venue BSSID filter** in shared snapshot parsing

6. **Migration:** Keep Excel tables read-only for archive; stop ingest for new dates OR run ingest only for pre-cutoff dates

### Alternative: Option B — Sync cron → Excel marks

After each cron upsert, write derived rows to `student_attendance_marks`. **Not recommended** — duplicates data, maintains two schemas, mapping bugs likely.

### Historical data policy (decide with user)

| Policy | Behavior |
|--------|----------|
| **Replace** | Student UI shows only Wi-Fi from go-live date forward |
| **Merge** | Union Excel + Wi-Fi; Wi-Fi wins on conflict for same session_id |
| **Split UI** | Tab: “Live (Wi-Fi)” vs “Historical (Excel)” |

---

## 16. Implementation Phases

### Phase 0 — Quick fixes (1 session)

- [ ] ATT-3: Enforce `mac_verified` in cron
- [ ] ATT-5: Remove `calculate_attendance` RPC call on manual complete
- [ ] Fix timezone bug in `tenMinAgoTime`
- [ ] Remove stack trace from weekly route error response (security)

### Phase 1 — Shared processing module (1–2 sessions)

- [ ] Extract `lib/process-session-attendance.js` from cron
- [ ] ATT-5: Admin complete uses shared module
- [ ] ATT-8: Pass 2 backfill uses shared module
- [ ] ATT-7: Fix snapshot route

### Phase 2 — Student API unification (2–3 sessions)

- [ ] Rewrite `students/attendance/summary`
- [ ] Rewrite `students/attendance/sessions`
- [ ] Update `app/attendance/page.jsx` if response shape changes
- [ ] Update dashboard attendance widget
- [ ] Document historical merge policy

### Phase 3 — Scoring alignment (1 session)

- [ ] ATT-2: Leaderboard from `attendance_records`
- [ ] Align override points with 0–6 scale
- [ ] Single exported scoring doc in `lib/attendance-points.js`

### Phase 4 — Venue scoping (1 session, may need hardware validation)

- [ ] ATT-4: BSSID filtering
- [ ] Admin settings validation that venue has BSSID before scheduling

### Phase 5 — Schema hygiene

- [ ] ATT-6: Migration for legacy tables OR deprecation notice
- [ ] Update `schema.txt` with all attendance tables/columns

---

## 17. Testing Playbook

### Manual test matrix

| # | Scenario | Setup | Expected |
|---|----------|-------|----------|
| T1 | Unverified MAC | Register MAC, don’t approve | Cron: no record |
| T2 | Verified MAC, in class | Approve MAC, connect Wi-Fi during session | Record: present/partial, points > 0 |
| T3 | Student UI after T2 | Same student, open /attendance | Session visible (after Phase 2) |
| T4 | Admin override present | Override in admin UI | Cron does not overwrite |
| T5 | Admin penalty absent | Mark absent with penalty | ±7 day sessions zeroed |
| T6 | Manual complete | Admin marks session completed | Same records as cron (after ATT-5) |
| T7 | Missed cron | Session ended, cron down, then Pass 2 | Records backfilled (after ATT-8) |
| T8 | Cross-venue | Two sessions same time, different venues | No cross-attendance (after ATT-4) |

### SQL verification queries

```sql
-- Wi-Fi records for a student/session
SELECT * FROM attendance_records
WHERE student_id = '<uuid>' AND session_id = '<uuid>';

-- Excel marks for same
SELECT * FROM student_attendance_marks
WHERE student_id = '<uuid>' AND session_id = '<uuid>';

-- Snapshots in session window
SELECT id, captured_at FROM wifi_snapshots
WHERE captured_at BETWEEN '<start>' AND '<end>'
ORDER BY captured_at;

-- MAC verification state
SELECT enrollment_no, mac_address, mac_verified FROM students
WHERE id = '<uuid>';
```

### Cron test (local)

```bash
cd client-next
# Terminal 1
npm run dev

# Terminal 2
CRON_SECRET=your-secret APP_URL=http://localhost:3000 node scripts/attendance-worker.js

# Or one-shot:
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/process-attendance
```

---

## 18. File Index

### Must-read before coding

| Path | Why |
|------|-----|
| `app/api/cron/process-attendance/route.js` | Core Wi-Fi processor |
| `lib/attendance-points.js` | Scoring algorithm |
| `app/api/students/attendance/summary/route.js` | Student % (Excel) |
| `app/api/students/attendance/sessions/route.js` | Student history (Excel) |
| `app/api/admin/attendance/session-students/route.js` | Admin live + recalc |
| `app/api/admin/attendance/override/route.js` | Override/penalty |
| `app/api/admin/sessions/[id]/route.js` | Legacy RPC trigger |
| `attendance/ingest-attendance-new.js` | Excel pipeline |

### Automation & hardware

| Path | Why |
|------|-----|
| `scripts/attendance-worker.js` | Cron poller |
| `RouterCodesForAttendance/wifi_monitor.py` | Snapshot source |
| `scripts/migration_wifi_attendance.sql` | Record columns |
| `scripts/migration_override_columns.sql` | Override columns |
| `scripts/migration_add_points.sql` | Points column |

### Frontend

| Path | Why |
|------|-----|
| `app/attendance/page.jsx` | Main student attendance UI |
| `app/dashboard/page.jsx` | Summary widget |
| `app/admin/attendance/page.jsx` | Admin monitoring |
| `app/settings/page.jsx` | MAC registration |

### Migrations / schema

| Path | Why |
|------|-----|
| `client-next/schema.txt` | Base schema (outdated) |
| `supabase/schemas/schema_update.sql` | More complete |

---

## 19. Prompt Starter for New Chat

Copy everything below into a new agent session:

---

```
You are implementing fixes for the CiPD 360 ERP Wi-Fi attendance system.

READ FIRST (in order):
1. cipd_erp/docs/handoffs/HANDOFF_ATTENDANCE_ANALYSIS.md  (this document — full context)
2. cipd_erp/client-next/lib/attendance-points.js
3. cipd_erp/client-next/app/api/cron/process-attendance/route.js
4. cipd_erp/client-next/app/api/students/attendance/summary/route.js
5. cipd_erp/client-next/app/api/students/attendance/sessions/route.js
6. cipd_erp/client-next/app/api/admin/attendance/session-students/route.js

PROJECT CONTEXT:
- Next.js 14 monorepo, JavaScript, Supabase PostgreSQL
- Two parallel attendance systems: Wi-Fi (attendance_records) vs Excel (student_attendance_marks)
- Student UI reads Excel; admin/cron reads Wi-Fi — THEY ARE NOT CONNECTED (ATT-1)

YOUR TASK (specify one phase at a time):
Phase 0: Enforce mac_verified in cron, remove legacy RPC on manual complete, fix tenMinAgo IST bug
Phase 1: Extract lib/process-session-attendance.js shared by cron and admin routes
Phase 2: Rewrite student attendance APIs to read attendance_records (with historical Excel merge if needed)
Phase 3: Align leaderboard scoring with attendance_records.points

RULES:
- Match existing code patterns (JS, supabaseAdmin, withAuth/withRole)
- Do not break admin_override / penalty skip logic in cron upsert
- Session times are IST (+05:30) in DB
- Minimal diff — one phase per session unless asked otherwise
- Do not commit hardcoded secrets; use env vars

When done, list: files changed, acceptance criteria checked, manual test steps for user.
```

---

## Appendix A — `iw_dump` Client Shape (expected)

Based on cron parsing code, each client in the JSON array should look like:

```json
{
  "mac": "AA:BB:CC:DD:EE:FF",
  "signal": -45,
  "name": "Device Name",
  "ip": "192.168.0.42"
}
```

May be double-encoded as a string inside JSONB. BSSID field presence **must be verified against production data** before implementing ATT-4.

---

## Appendix B — Related Issues Outside Strict Attendance Scope

These affect attendance operations but are tracked elsewhere:

| ID | Module | Issue |
|----|--------|-------|
| CRN-1 | Cron | Timezone fragile on Vercel |
| FDB-* | Feedback | Eligibility reads attendance_records |
| WIR-* | Wiring | Unrelated UI/API gaps |

Fix attendance first; feedback eligibility improves automatically when `attendance_records` is accurate and unified.

---

*End of handoff document.*
