# Part 6 - Administrative Intelligence, Governance, and Communication (Detailed Analysis)

## 1. Scope and Objective

This document analyzes the admin control-plane layer of the CIPD ERP.

Primary objective of this module:

- Provide a command center for daily academic operations
- Convert raw module outputs into actionable admin intelligence
- Support institution-wide communication (class reminders, feedback reminders, announcements)
- Manage faculty profile and workload records
- Configure system-level operational controls (scanner settings, venue BSSID registry, credentials)
- Export cross-functional reports for governance and audit

Part 6 focuses on implemented feature behavior and operational architecture.

## 2. Files Analyzed (Part 6)

Admin frontend pages

- app/admin/page.jsx
- app/admin/notifications/page.jsx
- app/admin/reports/page.jsx
- app/admin/faculty-hours/page.jsx
- app/admin/settings/page.jsx

Faculty/student-facing support page

- app/teachers/page.jsx

Admin APIs

- app/api/admin/dashboard/route.js
- app/api/admin/notifications/route.js
- app/api/admin/reports/route.js
- app/api/admin/reports/master/route.js
- app/api/admin/reports/export/route.js
- app/api/admin/faculty-hours/route.js
- app/api/admin/settings/config/route.js
- app/api/admin/settings/bssid/route.js
- app/api/admin/settings/password/route.js
- app/api/admin/setup/route.js
- app/api/admin/students/search/route.js

Student/shared APIs used by this layer

- app/api/student/notifications/route.js
- app/api/faculty/route.js

Shared services used by this layer

- lib/api.js
- lib/middleware.js
- lib/supabase.js
- lib/auth.js
- lib/emailer.js

## 3. Module Purpose in Overall Architecture

If Parts 2 to 5 define operations, evidence, quality, and academic delivery, Part 6 is the system governance layer that coordinates them.

This module acts as:

- an operations cockpit for admins
- an institutional communication hub
- a reporting and export plane
- a policy/configuration console
- a faculty administration surface

It does not replace attendance, feedback, or scheduling logic. It orchestrates and supervises those modules.

## 4. Functional Understanding (Feature-Level)

## 4.1 Admin Dashboard Command Center

Entry page: app/admin/page.jsx

Implemented feature blocks:

- Quick Actions panel:
  - schedule class modal launch
  - attendance view shortcut
  - visual actions for notifications/reports
- Weekly Attendance mini-analytics:
  - day-wise percentage bars
  - weekly average indicator
  - pending feedback count summary
- Upcoming Classes panel:
  - next sessions list with faculty, venue, date, student count
  - inline "Notify All" action per class
- Feedback Status panel:
  - per-course pending/submitted context
  - progress bars and pending counts
- Recent Activity feed:
  - recency formatting (minutes/hours/days)
  - session-level status timeline

Data aggregation pattern:

- page fetches sessions, feedback status, weekly attendance, dashboard summary, and lookup metadata in parallel
- each panel degrades gracefully if one data source fails

Operational significance:

- this dashboard is optimized for short-cycle decisions, not deep analytics

## 4.2 Admin Notifications Center

Entry page: app/admin/notifications/page.jsx

Implemented communication features:

- compose panel with target scope:
  - all students
  - specific student (search and select)
- trigger categories:
  - class reminder
  - feedback reminder
  - schedule change
  - attendance warning
  - general
- student search with debounce and live results
- send lifecycle states:
  - validation
  - sending
  - success/failure feedback
- notification history table and summary stats:
  - total sent
  - unread
  - recent records

Behavior detail:

- reminders and broadcasts are stored in notifications first
- email delivery is queued asynchronously in background
- UI receives response quickly while email dispatch continues out-of-band

## 4.3 Reports and Analytics Console

Entry page: app/admin/reports/page.jsx

Tabbed analytics architecture:

1. Program Analytics

- sessions by domain (bars)
- session type mix (donut)
- monthly volume and completion trend (area)
- rating trend and domain rating comparisons
- instructor workload distribution
- teaching hours by month

2. Master Sheet

- filterable session-level registry
- filters by domain, category, instructor, type, and text search
- CSV export of filtered rows from frontend

3. Instructors

- instructor sessions, completed count, total minutes/hours, experience bucket, average rating, domains taught

4. Skills Matrix

- skill coverage status (covered/not covered)
- domain/category mapping
- skill-to-session date visibility

Primary backend payload source:

- /api/admin/reports/master returns pre-aggregated analytics blocks for all tabs

## 4.4 Faculty Management Console

Entry page: app/admin/faculty-hours/page.jsx

Implemented features:

- summary cards:
  - total sessions
  - total hours
  - total honorarium
  - pending payments count
- faculty table with per-row metrics:
  - department/designation badge
  - years experience
  - sessions/hours
  - rate and computed honorarium
  - status chip (Paid/Pending)
- row actions:
  - session detail expansion
  - edit profile modal
  - mark paid action surface
- manage faculty panel:
  - add new faculty member
  - default password assignment flow
  - validation and success/error handling
- edit faculty modal:
  - name, designation, department, experience, honorarium rate

This console mixes HR profile management with instructional workload visibility.

## 4.5 Admin Settings Control Plane

Entry page: app/admin/settings/page.jsx

Implemented settings domains:

1. Attendance Detection Configuration

- scanner interval control
- minimum signal threshold control
- explanatory derived summary for expected snapshots

2. Venue BSSID Whitelist

- list venue routers
- add router BSSID with venue name
- toggle active/inactive
- edit router and venue details
- delete venue entry

3. Account Security

- admin password update with current-password verification
- success/error states in UI

4. Google Classroom Integration

- status-aware connection feedback
- OAuth connect button to admin teacher account flow
- guidance text for one-time admin-only linkage

## 4.6 Teacher Directory (Student Visibility)

Entry page: app/teachers/page.jsx

Implemented features:

- faculty listing for authenticated users
- department-based filtering chips
- email visibility for teacher contacts
- card-based rendering with fallback image and quick action icons

This is a student information surface, but it depends on governance data maintained by admin and faculty records.

## 5. API and Backend Logic (Detailed)

## 5.1 Dashboard and Search APIs

GET /api/admin/dashboard

- returns admin summary from admin_dashboard_summary view
- returns today session count (excluding cancelled)
- returns recent sessions ordered by creation time

GET /api/admin/students/search

- role-protected student search for notifications UI
- supports name/email partial matching
- returns active students only

## 5.2 Notification and Outreach APIs

POST /api/admin/notifications

Behavior by mode:

- feedback_reminder:
  - derives pending students from feedback gap calculation
  - generates per-student reminder notification rows
- class_reminder with session_id:
  - targets enrolled students for that session course
  - creates class reminder notifications
- explicit recipients:
  - sends targeted notifications to selected users
- fallback general:
  - broadcasts to all active students

Dispatch behavior:

- inserts notifications first
- returns immediate response
- performs email sending asynchronously in background

GET /api/admin/notifications

- returns history with recipient/course/sender joins
- supports limit and type filter
- returns global stats (total sent, unread)

GET/PATCH /api/student/notifications

- student notification fetch and mark-read lifecycle support

## 5.3 Reporting APIs

GET /api/admin/reports

- lightweight report summary endpoint (recent reports + top metrics)

GET /api/admin/reports/master

- full analytics payload used by reports page:
  - masterRows
  - domain analytics
  - monthly timelines
  - rating timelines
  - session type chart
  - experience pivot
  - instructor analytics
  - skills coverage
  - summary block

GET /api/admin/reports/export

- server-side CSV export endpoint
- supports export type selectors:
  - attendance
  - feedback
  - faculty
  - wifi
  - sessions
- supports date and entity filters

## 5.4 Faculty Governance API

GET /api/admin/faculty-hours

- merges faculty profile data with completed sessions
- computes hours, rate-based honorarium, and session detail rows

POST /api/admin/faculty-hours

- creates faculty user + faculty profile
- assigns default password hash for bootstrap login
- validates unique email and required identity fields

PATCH /api/admin/faculty-hours

- updates user identity fields and faculty profile attributes
- supports designation, department, years experience, and rate updates

## 5.5 Settings and Bootstrap APIs

GET/PUT /api/admin/settings/config

- reads and updates system_settings row id=1
- keeps legacy and new config columns synchronized

GET/POST/PATCH/DELETE /api/admin/settings/bssid

- CRUD for venues and router BSSID registry
- supports activation toggles used in ops workflows

POST /api/admin/settings/password

- validates current password against custom users table hash
- updates password hash securely

POST /api/admin/setup

- attempts runtime creation of notifications table and indexes via exec_sql RPC

## 5.6 Faculty Directory API

GET /api/faculty

- returns flattened faculty profile for authenticated users
- includes department/designation/experience/profile metadata

## 6. Data Flows (End-to-End)

## 6.1 Class Reminder Dispatch Flow

1. Admin initiates reminder from dashboard or notifications page
2. Backend resolves recipient students from enrollments
3. Notifications are inserted into notifications table
4. API returns success quickly
5. Email jobs execute asynchronously
6. Students consume reminder via app notification feed and email

## 6.2 Feedback Reminder Governance Flow

1. Admin triggers feedback reminder mode
2. Backend computes missing session-student submission pairs
3. Reminder notifications are created per pending pair
4. Optional email follow-up is queued
5. Dashboard and history reflect new communication state

## 6.3 Program Analytics Flow

1. Reports API reads sessions with metadata joins
2. Feedback ratings and skill mappings are aggregated
3. Multiple analytics datasets are precomputed server-side
4. Reports UI renders chart tabs and table views from one payload
5. Filter/export operations produce governance-ready extracts

## 6.4 Faculty Onboarding and Workload Flow

1. Admin adds faculty in Faculty Management console
2. Backend creates users + faculty records
3. Session completion data contributes to workload totals
4. Honorarium estimates are computed from hours and configured rate
5. Admin can edit faculty profile and compensation metadata

## 6.5 Settings-to-Operations Flow

1. Admin updates scanner/signal thresholds in settings
2. system_settings persists controls
3. Attendance monitoring endpoints consume these controls
4. Detection behavior changes across live and historical attendance computations

## 7. Database Interaction and Entities

Core entities used in Part 6:

- notifications
- users
- students
- faculty
- sessions
- courses
- course_enrollments
- feedback_responses
- feedback_questions (through report joins)
- venues
- system_settings
- session_types
- categories
- session_skills
- skills
- attendance_records
- attendance_ping_logs
- admin_dashboard_summary view

Cross-module significance:

- this layer performs broad joins across scheduling, attendance, feedback, and faculty metadata
- it is one of the highest integration-density subsystems in the platform

## 8. Engineering Decisions and Trade-offs

1. Asynchronous email dispatch after notification insert

- Benefit: fast API responses for bulk sends
- Trade-off: email failures happen after request success and require separate observability

2. Single payload analytics strategy for reports

- Benefit: fewer round trips and smoother frontend chart rendering
- Trade-off: heavier backend compute per request

3. Runtime table-ensure helpers

- Benefit: resilience in partially initialized environments
- Trade-off: relies on privileged RPC and deployment-specific SQL execution permissions

4. Faculty + workload consolidation in one module

- Benefit: admin gets profile and workload in one place
- Trade-off: payroll-like status can drift if not persisted server-side

5. Config alias synchronization in system settings

- Benefit: backward compatibility with legacy columns
- Trade-off: dual-column maintenance complexity

## 9. Edge Cases, Gaps, and Risks Observed

1. Dashboard quick-action placeholders

- Send Notification and Generate Reports quick-action buttons are visible but not wired to concrete actions on the dashboard page.

2. Faculty payment state persistence gap

- Paid/Pending representation is currently UI-driven in faculty management and not persisted as a dedicated backend payment ledger.

3. Dual report API surface

- /api/admin/reports and /api/admin/reports/master coexist with overlapping intent, increasing maintenance drift risk if only one path evolves.

4. Notification type behavior asymmetry

- UI offers several semantic types, but backend applies special logic only for class_reminder and feedback_reminder; remaining types follow general broadcast/targeted behavior.

5. Runtime bootstrap dependency

- setup and notification ensure helpers depend on exec_sql RPC availability; environments without it need manual SQL migration execution.

6. Settings account email field behavior

- admin settings UI shows editable email value, but only password update path is wired through backend in this flow.

7. Workload duration tolerance

- faculty workload calculation uses absolute duration difference, which prevents crash on bad time data but may hide data quality issues.

## 10. Module Contribution to Overall System

Part 6 contributes the institutional control and governance capability of the ERP:

- real-time operational oversight
- structured communication and reminders
- multi-dimensional analytics and exportability
- faculty administration workflows
- system policy configuration

Without this module, other modules can function individually, but coordinated administration, compliance reporting, and organization-wide intervention become weak.

## 11. Part 6 Summary for Report Use

The administrative intelligence layer transforms the ERP from a collection of academic features into an operationally governed platform. It combines dashboard decision support, notification orchestration, faculty management, report analytics, and settings control into a single admin command plane. The module is strong in visibility and orchestration, with key improvement areas around action wiring completeness, persistence consistency for finance-like states, and reduction of parallel endpoint drift.
