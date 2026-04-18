# Part 3 - Attendance Intelligence and Tracking (Detailed Analysis)

## 1. Scope and Objective

This document provides a deep system-level analysis of the Attendance Intelligence and Tracking module.

Primary objective of this module:

- Convert raw Wi-Fi network observations into student presence signals
- Convert presence signals into attendance records and quality points
- Provide student-facing attendance visibility (summary, calendar, history, live presence)
- Provide admin-facing real-time monitoring, forensic logs, and override control
- Keep attendance and feedback lifecycle synchronized through session completion flows

This analysis is feature-focused and architecture-focused for BTP reporting.

## 2. Files Analyzed (Part 3)

Frontend pages

- app/attendance/page.jsx
- app/admin/attendance/page.jsx
- app/admin/live-students/page.jsx
- app/admin/wifi-logs/page.jsx

Student attendance APIs

- app/api/students/attendance/summary/route.js
- app/api/students/attendance/sessions/route.js
- app/api/students/attendance/presence/route.js
- app/api/students/attendance/ping/route.js
- app/api/students/mac/route.js

Admin attendance and monitoring APIs

- app/api/admin/attendance/weekly/route.js
- app/api/admin/attendance/sessions-by-date/route.js
- app/api/admin/attendance/session-students/route.js
- app/api/admin/attendance/snapshot/route.js
- app/api/admin/attendance/override/route.js
- app/api/admin/live-students/route.js
- app/api/admin/wifi-logs/route.js
- app/api/admin/settings/config/route.js
- app/api/admin/settings/mac-approvals/route.js
- app/api/admin/settings/bssid/route.js

Cross-module API hooks touching attendance lifecycle

- app/api/admin/sessions/[id]/route.js
- app/api/cron/process-attendance/route.js

Shared services and scripts

- lib/attendance-points.js
- scripts/attendance-worker.js
- scripts/migration_wifi_attendance.sql
- scripts/migration_add_points.sql
- scripts/migration_override_columns.sql
- scripts/settings_migration.sql
- scripts/migration_phase2_rpc.sql
- scripts/migration_phase2_columns.sql
- scripts/test-attendance-points.js

Schema references

- schema.txt
- db.txt

## 3. Module Purpose in Overall Architecture

Attendance is the evidence-processing layer of the ERP.

It receives temporal anchors from scheduling and converts infrastructure telemetry into academic accountability data.

Conceptually, this module performs four transformations:

1. Detection transformation

- Wi-Fi snapshots and student MAC identities are matched into "seen/not seen" signals.

2. Session transformation

- Snapshot-level detections are collapsed into session-level attendance outcomes.

3. Scoring transformation

- Presence continuity and punctuality are converted into points in range 0.0 to 1.0.

4. Governance transformation

- Admin override pathways can correct, enforce, or penalize attendance outcomes.

This makes Part 3 both a data-processing subsystem and a policy-enforcement subsystem.

## 4. Functional Understanding (Feature-Level)

## 4.1 Student Attendance Experience

Entry page: app/attendance/page.jsx

What the student sees:

- Semester overview donut and aggregate metrics (attended, missed, total, streak)
- Course-wise attendance mini-donuts with per-course percentage
- Calendar heat map (full/partial/absent/no class)
- Session history for selected date and optional course filter
- Live presence badge (In Class / Not Detected + signal + recency)

Data sources used by the page:

- GET /api/students/attendance/summary
- GET /api/students/attendance/sessions?date=YYYY-MM-DD
- GET /api/students/attendance/presence

Important UI behavior:

- Date state is initialized client-side to avoid SSR hydration mismatch
- Summary, sessions, and presence are fetched in parallel
- Course chips and session list are rendered from backend-calculated values
- Presence recency is interpreted into "Just now", "Xm ago", or clock time

## 4.2 Admin Attendance Monitoring Console

Entry page: app/admin/attendance/page.jsx

What the admin sees:

- Session-level KPI cards (total, ongoing, detected, completed)
- Date-based session listing with status chips and detected counts
- Expandable session rows with per-student forensic table
- Live refresh countdown for ongoing classes
- Presence timeline graph per student (step graph by snapshot)
- Manual override controls (Present / Absent)
- Penalty confirmation modal for "Absent" override
- Pending MAC approval queue integrated in same console

Key operational features:

- Auto-refresh is synchronized to last snapshot time plus configured scanner interval
- Student table exposes signal, first seen, last seen, duration, ping count, points, status
- Penalized records are visually marked and protected from casual override churn

## 4.3 Admin Live Students View

Entry page: app/admin/live-students/page.jsx

Purpose:

- Real-time network awareness independent of one specific session row
- Distinguish identified student devices from unidentified devices

Behavior:

- Reads latest Wi-Fi snapshot and compares with previous snapshot
- Detects stale/frozen scanner conditions
- Computes signal quality, counts, and average signal
- Auto-refresh schedules based on scanner interval from settings
- Warns on staleness (age threshold) and unchanged payload sequences

## 4.4 Admin Wi-Fi Logs View

Entry page: app/admin/wifi-logs/page.jsx

Purpose:

- Historical and forensic browsing over snapshot-derived client rows
- Search and filter by time window and identity fields

Behavior:

- Supports date/time filters and search
- Search mode scans all filtered snapshots and returns matching rows
- Browse mode paginates snapshot batches
- Sortable columns include timestamp, signal, MAC, student

## 4.5 MAC Governance Layer

Student registration path:

- Student submits MAC address via PATCH /api/students/mac
- Student record stores mac_address with mac_verified=false

Admin approval path:

- Admin reviews pending MACs via GET /api/admin/settings/mac-approvals
- Admin approves or rejects using PATCH /api/admin/settings/mac-approvals
- Reject clears MAC, forcing re-registration

Architectural implication:

- Attendance matching depends on verified device identity governance
- This reduces identity ambiguity in shared/lab Wi-Fi environments

## 5. API and Backend Logic (Detailed)

## 5.1 Student-side APIs

GET /api/students/attendance/summary

- Builds enrolled course list from course_enrollments
- Reads attendance_records joined with sessions
- Derives per-course attended/total/pct and overall metrics
- Computes streak by reverse date traversal
- Produces calendarData classification per date (full/partial/absent)

GET /api/students/attendance/sessions

- Reads attendance_records joined to sessions/courses
- Applies pagination at query level, then optional date and course post-filters
- Returns session objects with status, ping_count, points, timestamps

GET /api/students/attendance/presence

- Reads student's registered MAC
- Reads latest wifi_snapshots row
- Parses iw_dump and checks normalized MAC membership
- Returns present flag, signal, and snapshot timestamp

POST /api/students/attendance/ping

- Accepts session_id, device_hash, bssid, signal_strength
- Validates session existence
- Inserts raw ping into attendance_ping_logs
- Uses req.user.id via withAuth context

PATCH /api/students/mac

- Validates MAC pattern
- Updates student mac_address and resets mac_verified=false

## 5.2 Admin attendance APIs

GET /api/admin/attendance/sessions-by-date

- Fetches sessions for selected date with joins (course/faculty/venue)
- Resolves effective status as ongoing/completed/scheduled by date-time logic
- Builds session time window as start to end+2min
- Scans wifi_snapshots in window and counts unique student MAC detections above threshold
- Returns detectedStudents and snapshotCount per session

GET /api/admin/attendance/session-students

This is the core attendance computation endpoint used by the admin drilldown.

Flow:

1. Read session and scanner thresholds from system_settings
2. Compute expected snapshot count from duration/scanner interval
3. Load course enrollments for full student universe
4. Load student identities and existing attendance_records
5. Load snapshots in session time window
6. Parse and normalize Wi-Fi clients by snapshot
7. Build MAC timelines per student with signal and time
8. For each enrolled student:

- if admin override or penalty exists, preserve stored record
- else compute points and status using lib/attendance-points
- produce detailed response object for UI

9. Upsert auto-calculated attendance_records for non-overridden students
10. Return summary, snapshot timestamps, ongoing flag, and enriched student rows

GET /api/admin/attendance/snapshot

- Older/alternate session snapshot endpoint
- Aggregates enrollments, attendance_records, and ping logs for one session
- Produces present/partial/absent summary

POST /api/admin/attendance/override

Two actions:

- present:
- upserts attendance_records with status=present, points=0.5, admin_override=true

- absent:
- marks current session absent with penalty=true
- computes +/- 1 week window around target session date for same course
- upserts penalty records for neighboring sessions with 0 points and absent status

This endpoint implements explicit anti-faking governance policy.

GET /api/admin/attendance/weekly

- Builds Mon-Sat view for current week
- Loads sessions and attendance_records
- Computes daily percentages and average attendance

Observation:

- Present count logic currently checks status='present' only, while other parts use additional presence states (partial/present_online/half). This can produce percentage interpretation differences across pages.

## 5.3 Admin monitoring and settings APIs

GET /api/admin/live-students

- Reads latest two wifi_snapshots rows
- Computes stale age and unchanged payload warnings
- Parses latest clients and applies MAC normalization + signal filter
- Maps clients into identified students vs unidentified devices
- Returns monitoring payload with health flags

GET /api/admin/wifi-logs

- Parses query filters and pagination
- Maps snapshot clients to students by normalized MAC
- Search mode scans all filtered snapshots in batches
- Browse mode loads snapshot pages
- Returns flattened client rows and stats for table rendering

GET/PUT /api/admin/settings/config

- GET reads system_settings row id=1
- PUT updates scanner interval and min signal aliases
- Keeps old and new setting columns synchronized

GET/PATCH /api/admin/settings/mac-approvals

- GET lists students with mac_verified=false and non-null MAC
- PATCH approves (set verified) or rejects (clear MAC)

GET/POST/PATCH/DELETE /api/admin/settings/bssid

- Venue router BSSID management layer
- Controls active venue-device mapping metadata

## 5.4 Cross-module hooks that affect attendance lifecycle

PATCH /api/admin/sessions/[id]

- When status changes to completed:
- calls calculate_attendance RPC
- triggers rolloutFeedbackForSession asynchronously

GET /api/cron/process-attendance

- CRON_SECRET-protected endpoint
- Pass 1: process ongoing/recent sessions for today from Wi-Fi snapshots
- Pass 2: self-heal missed ended sessions not marked completed
- Marks sessions completed and triggers feedback rollout when applicable

This endpoint is the automation backbone of attendance finalization.

## 6. Scoring and Decision Logic

Source: lib/attendance-points.js

Scoring model:

- Base score = 1.0
- Late penalty = -0.5 if absent in first two snapshots
- Presence percentage penalty:
- <30% => absent and points=0
- <50% => -0.3
- <75% => -0.2
- > =75% => no extra deduction

Design nuance:

- Denominator uses max(actualSnapshots, expectedSnapshots)
- This prevents inflated presence percentages when scanner snapshots are sparse

Output contract:

- points
- status
- breakdown (base, penalties, presencePercent, reason)

Validation support:

- scripts/test-attendance-points.js covers boundaries, combinations, and edge scenarios

## 7. Data Flow (End-to-End)

## 7.1 Real-time presence flow (student badge)

1. Student MAC is read from students table
2. Latest wifi_snapshots payload is parsed
3. MAC presence match determines in-class flag
4. UI shows live badge and recency timestamp

## 7.2 Session-level admin analytics flow

1. Admin selects date and session
2. Backend computes session-specific snapshot window
3. Snapshot clients are filtered by signal and mapped to students
4. Timelines and points are computed per enrolled student
5. Non-overridden records are upserted into attendance_records
6. UI renders row table + optional timeline graph

## 7.3 Historical forensic flow

1. Admin opens Wi-Fi logs
2. API flattens snapshot client arrays into searchable rows
3. Student identity and signal metadata are attached
4. UI enables temporal and identity forensics

## 7.4 Automation flow (cron + worker)

1. scripts/attendance-worker.js periodically calls /api/cron/process-attendance
2. Cron endpoint processes active sessions and overdue sessions
3. Attendance records are upserted
4. Sessions are auto-completed when appropriate
5. Feedback rollout is triggered for attendance-complete sessions
6. Worker monitors staleness and can dispatch alert emails

## 8. Operational Reliability and Background Processing

Source: scripts/attendance-worker.js and cron route

Implemented resilience features:

- periodic daemon execution
- immediate retry on failure
- class-hours sensitive alerting logic
- stale snapshot detection across cycles
- alert cooldown to avoid email storms
- pass-2 self-healing for missed session completion events

Architecture implication:

- Attendance finalization does not depend only on UI actions
- Operations can continue even if admins do not manually open dashboards

## 9. Database Interaction and Schema Evolution

## 9.1 Core attendance entities

- wifi_snapshots: source telemetry (captured_at, iw_dump)
- attendance_ping_logs: raw ping events from student app/API
- attendance_records: computed/overridden outcomes per session-student
- sessions: temporal anchors and completion lifecycle
- course_enrollments: enrollment boundaries for expected attendees
- students: MAC registration and verification fields
- system_settings: threshold and interval controls
- venues: BSSID metadata for network context

## 9.2 Key attendance schema changes from migrations

migration_add_points.sql

- attendance_records.points added for quality score

migration_override_columns.sql

- attendance_records.admin_override
- attendance_records.override_by
- attendance_records.penalty
- attendance_records.penalty_reason

migration_wifi_attendance.sql

- attendance_records.first_seen_at
- attendance_records.last_seen_at
- attendance_records.duration_minutes
- attendance_records.avg_signal_strength

settings_migration.sql and config API model

- system_settings row introduced
- thresholds and intervals exposed for runtime tuning

## 9.3 RPC layer alignment

migration_phase2_rpc.sql defines calculate_attendance RPC using ping counts and system thresholds.

Current runtime also includes richer Wi-Fi snapshot-based scoring through cron and session-students APIs.

This indicates hybrid evolution:

- legacy/simple path: ping-count threshold classification
- current/intelligence path: timeline + points + policy-aware computation

## 10. Authentication, Authorization, and Control Boundaries

Student endpoints:

- wrapped by withAuth
- scoped to req.user.id

Admin endpoints:

- wrapped by withRole(['admin'])
- expose override, logs, monitoring, settings controls

Cron endpoint:

- protected using Authorization Bearer CRON_SECRET

Control boundary outcome:

- Students can observe and submit signals
- Admin controls interpretation, correction, and enforcement
- Automation pipeline controls completion and periodic reconciliation

## 11. State Management and UX Engineering Patterns

Student page patterns:

- parallel fetch with Promise.allSettled for resilient partial rendering
- explicit loading fallback and skeleton placeholders
- per-date filtering and compact course selection state

Admin attendance page patterns:

- large operational local state for filters, expanded rows, override actions
- timer refs for synchronized refresh scheduling
- countdown UX tied to backend scanner interval
- row-level loading and modal confirmations for high-impact actions

Live students and Wi-Fi logs pages:

- staleness banners and diagnostic status cues
- mixed auto-refresh and manual refresh options
- search/filter pipelines designed for monitoring workloads

## 12. Engineering Decisions and Trade-offs

1. Wi-Fi snapshot-first attendance model

- Decision: derive attendance from infrastructure snapshots and MAC mapping
- Benefit: low-touch attendance, scalable for large classes
- Trade-off: dependent on scanner uptime, signal quality, and device registration quality

2. Hybrid scoring model with point semantics

- Decision: move beyond binary present/absent into quality points
- Benefit: captures punctuality and continuity
- Trade-off: increased complexity and denominator sensitivity

3. Admin override and penalty policy inside API

- Decision: encode anti-faking governance in backend route
- Benefit: consistent enforcement and auditable policy behavior
- Trade-off: high-impact action complexity, requires careful role control and UX confirmations

4. Real-time UI synchronized to snapshot cadence

- Decision: schedule refresh from last snapshot plus interval buffer
- Benefit: lower waste and better perceived liveness
- Trade-off: time math and timezone consistency become critical

5. Self-healing cron pass for missed session completion

- Decision: periodic reconciliation for overdue sessions
- Benefit: prevents lifecycle deadlocks and missed feedback rollout
- Trade-off: coupling to background worker reliability and secret management

## 13. Edge Cases, Failure Modes, and Observed Risks

Implemented edge handling includes:

- no MAC registered -> student presence endpoint returns graceful not-registered state
- no snapshots available -> monitoring endpoints return empty+stale payloads
- weak signal rejection using configurable threshold
- malformed or double-encoded iw_dump handling with safe parse fallback
- overridden/penalized students protected from recalculation overwrite
- countdown and retry logic for ongoing session refresh failures

Observed technical risks from current implementation:

- multiple attendance truth paths exist (RPC ping-threshold vs snapshot scoring), requiring governance on which source is authoritative per workflow
- some status semantics vary across handlers (for example weekly summary counts only strict 'present')
- default CRON_SECRET fallback in codebase increases risk if environment hardening is incomplete
- schema snapshots (schema.txt/db.txt) may not fully reflect latest runtime migration columns, increasing onboarding friction

## 14. Module Contribution to Overall System

Attendance Intelligence and Tracking acts as the trust and evidence core of CIPD ERP.

It contributes:

- real-time visibility for students and admins
- automated attendance computation from network telemetry
- quality-based attendance scoring for richer analytics
- forensic observability through logs and timeline views
- policy enforcement through admin overrides and penalties
- lifecycle synchronization with feedback through completion hooks

For BTP narrative, this module should be positioned as:

- a cyber-physical integration layer (network telemetry -> academic records)
- a reliability-aware operations subsystem with human-in-the-loop governance
- a decision engine that converts noisy presence signals into institution-grade attendance outcomes

## 15. Part 3 Summary for Report Use

The attendance subsystem is implemented as a multi-layer intelligence pipeline, not a simple checkbox system. It combines Wi-Fi telemetry parsing, identity governance, points-based scoring, live and historical observability, and admin correction controls. Through cron-driven self-healing and session-completion hooks, it links operational attendance tracking with broader educational workflows such as feedback rollout, making it a central data-trust module in the ERP architecture.
