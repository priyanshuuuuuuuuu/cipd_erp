# Part 2 - Scheduling and Session Management (Detailed Analysis)

## 1. Scope and Objective

This document provides a detailed system-level analysis of the Scheduling and Session Management module.

Primary objective of this module:

- Manage the full lifecycle of teaching sessions (create, update, classify, monitor)
- Serve role-specific schedule views to students and admins
- Connect session planning with attendance and feedback downstream workflows
- Maintain scheduling metadata needed for reporting (session types, categories, skills)

This is a feature-focused engineering analysis for BTP reporting.

## 2. Files Analyzed (Part 2)

Frontend pages

- app/calendar/page.jsx
- app/admin/schedule/page.jsx

Scheduling APIs

- app/api/calendar/sessions/route.js
- app/api/students/schedule/today/route.js
- app/api/students/schedule/week/route.js
- app/api/admin/schedule/route.js
- app/api/admin/sessions/route.js
- app/api/admin/sessions/[id]/route.js
- app/api/admin/session-types/route.js

Metadata and support APIs used by schedule page

- app/api/admin/lookup/route.js
- app/api/admin/skills/route.js
- app/api/admin/categories/route.js
- app/api/admin/sessions/rollout-feedback/route.js

Shared services involved

- lib/api.js
- lib/middleware.js
- lib/supabase.js
- lib/feedback-rollout.js

Schema/migration references

- schema.txt
- db.txt
- scripts/master_report_migration.sql
- scripts/seed_categories.sql

## 3. Module Purpose in Overall Architecture

Scheduling is the temporal orchestration layer of the ERP.

It defines:

- What class/event happens
- On which date/time
- For which course
- By which faculty member
- At which venue

Other modules consume these outputs:

- Attendance: session IDs anchor ping records and attendance calculations
- Feedback: completed sessions trigger feedback rollout
- Dashboard/reporting: session counts, status, and metadata feed analytics

Without reliable scheduling data, operational automation in attendance and feedback becomes inconsistent.

## 4. Functional Understanding (Feature-Level)

## 4.1 Student Schedule Experience

Entry page: app/calendar/page.jsx

What this page visually represents:

- A student-facing timetable view with sidebar + header + calendar workspace
- Three views: day, week, month
- Quick month navigation with previous/next controls

Implemented feature behavior:

1. On month change, UI fetches sessions for the full month range.
2. The same dataset is reshaped in-memory for:
   - Day view (hour blocks)
   - Week view (weekday columns)
   - Month view (day tiles with compact session chips)
3. Session cards display course/session title, time, and venue.
4. Sidebar provides movement to all major student modules.

Data fetched:

- GET /api/calendar/sessions?start=...&end=...

State managed:

- view: day/week/month
- viewDate: active month anchor
- sessions: fetched schedule data
- isCollapsed / isMobileMenuOpen: shell behavior

Unique logic:

- Safe date parsing from session_date to avoid timezone day-shift bugs when grouping by weekdays.

## 4.2 Admin Schedule Operations

Entry page: app/admin/schedule/page.jsx

What this page visually represents:

- Operations console for timetable control with admin navigation shell
- KPI summary cards
- Dual visualization modes:
  - List mode for management actions
  - Calendar grid mode for weekly load inspection
- Modal-based create/edit workflows

Implemented feature set:

- Filter bar (all/today/week/confirmed/pending)
- Sort by date direction toggle
- Loading skeleton for session table
- Status badges with color encoding
- Create session flow with validation and inline metadata creation
- Edit session flow with advanced metadata editing
- Skills tagging (multi-select + search + inline create)
- Category-based skill filtering in edit flow
- Session type creation inline from modal
- Feedback rollout actions:
  - Per completed session
  - Bulk backfill for all completed sessions

Data fetched/mutated:

- GET /api/admin/schedule
- GET /api/admin/lookup
- POST /api/admin/sessions
- PATCH /api/admin/sessions/[id]
- POST /api/admin/session-types
- GET /api/admin/session-types
- POST /api/admin/skills
- GET /api/admin/skills
- POST /api/admin/sessions/rollout-feedback

State managed (major):

- Table/view control: viewMode, activeFilter, dateSortDir
- Session datasets: sessions, loading
- Create modal: newClass, scheduleLoading, scheduleError
- Edit modal: editSession, editForm, editLoading, editError, editSuccess
- Metadata cache: lookupData (courses/faculty/venues/types/skills/categories)
- Rollout statuses: rollingOutId, backfilling, rolloutMsg
- Search/select UX helpers for skills and type adders

Complex UI logic:

- Create modal can infer end_time when not supplied (start + 1 hour)
- Edit modal supports both data edits and taxonomy maintenance (type/category/skills)
- Tooltips render skill names from skill_ids in list rows
- Backfill action includes explicit confirmation to avoid accidental mass notifications

## 5. API and Backend Logic (Detailed)

## 5.1 GET /api/calendar/sessions

Auth:

- withAuth (any authenticated role)

Inputs:

- start (required)
- end (required)

Query behavior:

- Reads sessions between date bounds
- Joins courses, faculty->users, venues, session_types
- Orders by session_date then start_time

Output:

- sessions[] with related entities for rendering

## 5.2 GET /api/students/schedule/today

Auth:

- withAuth (student context expected by usage)

Inputs:

- optional date param (frontend local date can be passed)

Business logic:

1. Resolve student's enrolled courses from course_enrollments.
2. If none, return empty list.
3. Fetch sessions for that date where course_id in enrollment set.
4. Exclude cancelled sessions.

Output:

- sessions[] ordered by start_time

## 5.3 GET /api/students/schedule/week

Auth:

- withAuth

Inputs:

- optional startDate/endDate

Business logic:

- Defaults to current week window if omitted
- Uses enrollment filter + non-cancelled sessions
- Orders by date and time

Output:

- sessions[] for weekly student timetable

## 5.4 GET /api/admin/schedule

Auth:

- withRole(['admin'])

Inputs:

- filter: all/today/week/confirmed/pending/cancelled

Business logic:

1. Reads sessions with joins for course/faculty/venue/type.
2. Applies filter translation (confirmed -> scheduled in DB terms).
3. Batch-loads session skills from session_skills.
4. Batch-loads enrollment counts from course_enrollments.
5. Transforms DB rows into admin-friendly view model.
6. Computes display status:
   - scheduled -> Confirmed
   - if scheduled but end_time in past -> Completed (display-level derivation)

Output:

- sessions[] with display-ready fields and raw IDs used by edit modal

## 5.5 GET/POST /api/admin/sessions

Auth:

- withRole(['admin'])

GET behavior:

- Returns sessions with optional status/upcoming filters
- Adds enrolled student counts per course

POST behavior:

- Validates required scheduling fields
- Inserts new sessions row with status='scheduled'
- Handles venue conflict via unique constraint path
- Optionally inserts session_skills mappings

## 5.6 PATCH /api/admin/sessions/[id]

Auth:

- withRole(['admin'])

Dual-mode behavior:

- Mode A: status-only update
- Mode B: full edit update (title/course/faculty/venue/type/category/date/time/status/skills)

Important logic:

- Validates status enum
- Validates end_time > start_time when both present
- Rewrites session_skills mapping when skill_ids is provided
- If status changed to completed:
  - invokes calculate_attendance RPC
  - triggers async rolloutFeedbackForSession

## 5.7 GET/POST /api/admin/session-types

Auth:

- withRole(['admin'])

Behavior:

- GET returns sorted session type dictionary
- POST inserts new type and handles duplicate constraint conflict

## 5.8 GET /api/admin/lookup

Auth:

- withRole(['admin'])

Behavior:

- One-shot lookup payload for schedule UI:
  - courses
  - faculty
  - venues
  - session types
  - skills (+ category mapping)
  - categories

Role in system:

- Reduces frontend round-trips for create/edit modals.

## 5.9 GET/POST /api/admin/skills and /api/admin/categories

Auth:

- withRole(['admin'])

Behavior:

- Provide CRUD-lite taxonomy operations directly from schedule UX
- Support optional filtering (skills by category, categories by course)

## 5.10 POST /api/admin/sessions/rollout-feedback

Auth:

- withRole(['admin'])

Modes:

- Single session rollout by session_id
- Backfill all completed sessions with all_completed=true

Internals:

- Delegates to rolloutFeedbackForSession helper
- Returns notified/skipped summaries and activity list

## 6. Data Flow (End-to-End)

## 6.1 Student Calendar Flow

1. Student picks month or navigates month controls.
2. UI derives start/end date boundaries.
3. API returns enriched sessions dataset.
4. UI groups dataset into view-specific structures.
5. Student consumes as day/week/month timetable.

## 6.2 Admin Scheduling Flow - Create

1. Admin opens "Schedule New Class" modal.
2. UI loads lookup dictionaries (courses/faculty/venues/types/skills/categories).
3. Admin enters session details and optional metadata.
4. UI validates and submits POST /api/admin/sessions.
5. API inserts session, optional session_skills rows.
6. UI refreshes sessions list.

## 6.3 Admin Scheduling Flow - Edit

1. Admin selects a row and opens edit modal.
2. UI preloads raw IDs from admin schedule payload into form state.
3. Admin updates fields and submits PATCH /api/admin/sessions/[id].
4. API updates session row and synchronizes session_skills mapping.
5. UI shows success and refreshes list.

## 6.4 Completion-Triggered Downstream Flow

1. Session marked completed (status update path).
2. Backend triggers attendance calculation RPC.
3. Backend triggers feedback rollout helper.
4. Notifications/emails are sent to eligible attendees.

This creates a direct orchestration bridge between scheduling, attendance, and feedback modules.

## 7. State Management Analysis

Student page pattern:

- Local component state for view toggles and fetched sessions.
- One useEffect keyed by month anchor and auth readiness.

Admin page pattern:

- Large local state graph due operational complexity.
- useCallback used for fetch functions and async handlers.
- useMemo used for sorted session projection.
- Modal-scoped state segmented cleanly (create/edit/add-taxonomy/rollout).

Implication:

- This module intentionally keeps orchestration in one page-level component for operational speed, at the cost of large component complexity.

## 8. Database Interaction and Inferred Schema Behavior

## 8.1 Core Tables

- sessions
  - key scheduling entity (title, date, start/end time, course/faculty/venue, status)

- course_enrollments
  - used to derive student counts and student-scoped schedule visibility

- courses, faculty, users, venues
  - joined for human-readable session payloads

## 8.2 Metadata/Tagging Tables

- session_types
  - dictionary table for class type labels

- categories
  - course-linked domains for class taxonomy

- skills
  - skill dictionary with optional category linkage

- session_skills
  - many-to-many mapping between sessions and skills taught

## 8.3 Downstream Tables Touched Through Schedule Events

- attendance_records (calculate_attendance path)
- notifications (feedback rollout path)

## 8.4 Migration Signals Relevant to This Module

scripts/master_report_migration.sql shows scheduling metadata extension:

- categories table creation
- skills table extension (category_id, details)
- session_skills mapping creation
- sessions.category_id addition

Important architecture note:

- Runtime APIs rely on session_types too, but explicit creation for session_types was not found in the subset analyzed for this part, suggesting it exists via prior setup/migration not included here.

## 9. Engineering Decisions and Trade-offs

1. Role-separated scheduling endpoints

- Decision: dedicated student and admin API surfaces
- Benefit: clearer authorization and payload purpose
- Trade-off: duplicated query concerns across handlers

2. View-model transformation in admin schedule API

- Decision: API returns UI-ready fields (course/faculty labels, display status)
- Benefit: thinner frontend rendering logic
- Trade-off: API mixes domain data with presentation semantics

3. Modal-based operational design in admin page

- Decision: create/edit and taxonomy actions are inline in one page
- Benefit: high operational speed for administrators
- Trade-off: large local state footprint and heavier component complexity

4. Completion-triggered side effects in session patch route

- Decision: schedule completion triggers attendance and feedback flows
- Benefit: strong workflow automation
- Trade-off: tighter coupling between modules; status update can trigger multiple side effects

5. Extensible metadata layer (type/category/skills)

- Decision: enrich sessions with pedagogical metadata
- Benefit: future-proof reporting and analytics
- Trade-off: more validation and consistency constraints across forms/APIs

## 10. Edge Cases and Special Logic

Implemented special handling includes:

- Missing enrollment for student schedule returns empty list instead of error
- Cancelled sessions excluded from student schedule endpoints
- Venue conflict handling on session creation/update
- Safe no-op behavior when session_skills table unavailable (admin schedule mapping path guarded)
- Skill selection cap (max 4) enforced in UI and API sync path
- Backfill feedback action confirmation to prevent unintended broad sends
- Display-status computation can mark past scheduled sessions as Completed in admin list model
- Time ordering validation prevents invalid time intervals

## 11. Per-File Feature Notes (Quick Reference)

app/calendar/page.jsx

- Student calendar rendering (day/week/month)
- Monthly range fetch + in-memory grouping logic

app/admin/schedule/page.jsx

- Admin operations console for scheduling lifecycle
- Rich modal workflows + rollout controls + taxonomy management

app/api/calendar/sessions/route.js

- Generic authenticated schedule range API

app/api/students/schedule/today/route.js

- Enrollment-scoped daily schedule

app/api/students/schedule/week/route.js

- Enrollment-scoped weekly schedule with default current-week window

app/api/admin/schedule/route.js

- Admin list payload builder with filters, enrollment counts, skill mapping, computed display statuses

app/api/admin/sessions/route.js

- Admin session listing and creation

app/api/admin/sessions/[id]/route.js

- Admin status/full edit updates with attendance/feedback side-effect hooks

app/api/admin/session-types/route.js

- Session type dictionary management

app/api/admin/lookup/route.js

- Aggregated lookup payload for scheduling UI

app/api/admin/skills/route.js and app/api/admin/categories/route.js

- Inline taxonomy CRUD support from schedule page

app/api/admin/sessions/rollout-feedback/route.js

- Session-level and global feedback rollout operations

## 12. Module Contribution to Overall System

Scheduling and Session Management is the operational timeline backbone of CIPD ERP.

It contributes:

- Event planning and execution control
- Student-facing timetable visibility
- Admin-facing scheduling governance
- Metadata enrichment for reporting quality
- Trigger points for attendance and feedback automation

For BTP system narrative, this module should be described as:

- A control plane for academic session lifecycle
- A data-source module feeding multiple downstream analytics and engagement subsystems

## 13. Part 2 Summary for Report Use

The implemented scheduling subsystem combines role-aware APIs, rich admin operations UI, and relational session modeling to manage class lifecycle from planning to completion. It is not just a display calendar; it is a process orchestrator that coordinates timetable visibility, session metadata, attendance calculation triggers, and feedback rollout workflows.
