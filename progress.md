# CIPD ERP — Full Codebase Audit & Progress Tracker

> **Project:** CIPD ERP (Centre for Intelligent Product Development — Education Resource Platform)
> **Stack:** Next.js 14 (App Router), Supabase (PostgreSQL), JWT Auth, Recharts
> **Last Audited:** 2026-03-30

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Database Layer](#2-database-layer)
3. [Backend API Layer](#3-backend-api-layer)
4. [Frontend Layer](#4-frontend-layer)
5. [Frontend ↔ Backend Gap Analysis](#5-frontend--backend-gap-analysis)
6. [Database Schema Review](#6-database-schema-review)
7. [Pending Requirements & Next Steps](#7-pending-requirements--next-steps)

---

## 1. Architecture Overview

```
cipd_erp/
└── client-next/               # Single Next.js 14 monorepo (frontend + backend API routes)
    ├── app/
    │   ├── page.jsx            # Login page (root)
    │   ├── signup/             # Signup page
    │   ├── dashboard/          # Student dashboard
    │   ├── attendance/         # Student attendance tracker
    │   ├── grades/             # Student grades viewer
    │   ├── courses/            # Course listing + detail
    │   ├── calendar/           # Student schedule calendar
    │   ├── feedback/           # Student feedback submission
    │   ├── teachers/           # Faculty directory
    │   ├── profile/            # Student profile page
    │   ├── settings/           # Student settings page
    │   ├── admin/              # Admin portal (multi-sub-page)
    │   ├── api/                # All Next.js Route Handlers (backend)
    │   └── contexts/           # React context (AuthContext)
    ├── lib/
    │   ├── api.js              # Client-side fetch wrapper (auto-attaches JWT)
    │   ├── auth.js             # bcryptjs + jsonwebtoken helpers
    │   ├── middleware.js        # withAuth / withRole HOF wrappers
    │   └── supabase.js         # Lazy Supabase client (anon + service role)
    └── package.json
```

**Auth Flow:** Custom JWT (not Supabase Auth). Login → `/api/auth/login` → bcrypt verify → `jsonwebtoken.sign` → token stored in `localStorage` + `httpOnly` cookie. `withAuth` / `withRole` HOFs decode JWT per-request.

---

## 2. Database Layer

### 2.1 Tables (19 total)

| Table | Purpose | PKs / Notes |
|---|---|---|
| `users` | All users (students, faculty, admin) | `id UUID`, `role ENUM(student, faculty, admin)` |
| `students` | Student-specific data, extends `users` | `id` → FK to `users.id` |
| `faculty` | Faculty-specific data, extends `users` | `id` → FK to `users.id` |
| `courses` | Course definitions | `id UUID` |
| `course_enrollments` | Student ↔ Course many-to-many | Unique: `(course_id, student_id)` |
| `sessions` | Individual class sessions | `status ENUM(scheduled, completed, cancelled)` |
| `venues` | Physical rooms with router BSSID | `router_bssid` UNIQUE |
| `attendance_records` | Final attendance decision per student/session | `status ENUM(present, absent, partial)` |
| `attendance_ping_logs` | Raw Wi-Fi ping events | `id BIGINT` |
| `wifi_snapshots` | Raw router `iw dev` JSON dumps | `id BIGINT`, `iw_dump JSONB` |
| `wifi_clients` | Parsed live clients from router | `mac_address VARCHAR` |
| `assignments` | Assignments per course | `id UUID` |
| `assignment_submissions` | Student submission + grade | `id UUID` |
| `session_materials` | Uploaded materials per session/course | `id UUID` |
| `feedback_questions` | Admin-managed question bank | `type ENUM(rating, yes_no, text)` |
| `feedback_responses` | Student feedback answers | `id UUID` |
| `notifications` | In-app notifications | `type TEXT`, `recipient_id UUID` |
| `system_settings` | Global attendance config | Single row (`id = 1`) |
| `admin_dashboard_summary` | Materialized view / view | `total_students, total_faculty, total_sessions` |
| `student_attendance_summary` | View | `student_id, attendance_percentage` |
| `faculty_monthly_hours` | View | `faculty_id, month, hours, sessions` |

### 2.2 Foreign Key Relationships (Complete)
- `students.id` → `users.id`
- `faculty.id` → `users.id`
- `course_enrollments.course_id` → `courses.id`
- `course_enrollments.student_id` → `students.id`
- `sessions.course_id` → `courses.id`
- `sessions.faculty_id` → `faculty.id`
- `sessions.venue_id` → `venues.id`
- `sessions.created_by` → `users.id`
- `attendance_records.session_id` → `sessions.id`
- `attendance_records.student_id` → `students.id`
- `feedback_responses.session_id` → `sessions.id`
- `feedback_responses.student_id` → `students.id`
- `feedback_responses.question_id` → `feedback_questions.id`
- `session_materials.session_id` → `sessions.id`
- `session_materials.uploaded_by` → `users.id`
- `session_materials.course_id` → `courses.id`
- `session_materials.faculty_id` → `faculty.id`
- `assignments.course_id` → `courses.id`
- `assignments.faculty_id` → `faculty.id`
- `assignment_submissions.assignment_id` → `assignments.id`
- `assignment_submissions.student_id` → `students.id`
- `notifications.recipient_id` → `users.id`
- `notifications.course_id` → `courses.id`
- `notifications.session_id` → `sessions.id`
- `notifications.sent_by` → `users.id`

### 2.3 Indexes (Complete)
- `users`: PK, UNIQUE email, index on `role`
- `students`: PK, UNIQUE `enrollment_no`
- `faculty`: PK
- `courses`: PK
- `course_enrollments`: PK, UNIQUE `(course_id, student_id)`
- `sessions`: PK, index on `session_date`, `faculty_id`, `course_id`, UNIQUE `(venue_id, session_date, start_time, end_time)` WHERE not cancelled
- `attendance_records`: PK, UNIQUE `(session_id, student_id)`, index on `student_id`, `session_id`
- `feedback_responses`: PK, index on `session_id`, `student_id`
- `feedback_questions`: PK
- `assignments`, `assignment_submissions`, `session_materials`, `wifi_snapshots`, `notifications`: PKs
- `notifications`: index on `recipient_id`, composite on `(recipient_id, is_read)`
- `venues`: PK, UNIQUE `router_bssid`
- `system_settings`: PK

---

## 3. Backend API Layer

### 3.1 Auth Routes
| Endpoint | Method | Auth | Status |
|---|---|---|---|
| `/api/auth/login` | POST | None | ✅ Complete |
| `/api/auth/signup` | POST | None | ✅ Complete — auto-generates `CiPD_N` enrollment no. |
| `/api/auth/logout` | POST | None | ✅ Complete |
| `/api/auth/me` | GET | Any | ✅ Complete — returns role-specific profile |

### 3.2 Student Routes
| Endpoint | Method | Auth | Status |
|---|---|---|---|
| `/api/students/profile` | GET | Student | ✅ Returns `users + students` merged |
| `/api/students/mac` | PATCH | Student | ✅ Validates MAC format, updates UNVERIFIED |
| `/api/students/attendance/ping` | POST | Student | ✅ Logs to `attendance_ping_logs` |
| `/api/students/attendance/summary` | GET | Student | ✅ Returns overall + per-course breakdown + streak |
| `/api/students/attendance/sessions` | GET | Student | ✅ Returns paginated `attendance_records` with session details |
| `/api/students/assignments` | GET | Student | ✅ Returns assignments + merged submissions for enrolled courses |
| `/api/students/schedule/today` | GET | Student | ✅ Returns today's sessions for enrolled courses |
| `/api/students/schedule/week` | GET | Student | ✅ Returns week's sessions, supports `?start=&end=` |
| `/api/student/notifications` | GET/PATCH | Student | ✅ Fetch notifications + mark read |

### 3.3 Shared Routes (Student + Admin)
| Endpoint | Method | Auth | Status |
|---|---|---|---|
| `/api/faculty` | GET | Any | ✅ Returns faculty list (lacks `department` column — see gaps) |
| `/api/courses` | GET | Any | ✅ Admin: all courses. Student: enrolled courses with enriched data |
| `/api/courses/[id]` | GET | Any | ✅ Course detail + enrolled count + sessions |
| `/api/courses/[id]/materials` | GET | Any | ✅ Materials by `course_id` |
| `/api/grades` | GET | Student | ✅ Assignment submissions with non-null grade |
| `/api/calendar/sessions` | GET | Any | ❓ File exists but not audited (calendar page may use `/students/schedule/week` instead) |
| `/api/feedback/pending` | GET | Student | ✅ Returns next un-submitted session + active questions |
| `/api/feedback/submit` | POST | Student | ✅ Bulk inserts `feedback_responses` |
| `/api/feedback/leaderboard` | GET | Student | ✅ Ranks students by feedback submission credits |

### 3.4 Admin Routes
| Endpoint | Method | Auth | Status |
|---|---|---|---|
| `/api/admin/dashboard` | GET | Admin | ✅ Summary view + today's sessions + recent activity |
| `/api/admin/sessions` | GET/POST | Admin | ✅ List with filters; Create with venue conflict check |
| `/api/admin/sessions/[id]` | PATCH | Admin | ✅ Update status; triggers `calculate_attendance` RPC on complete |
| `/api/admin/attendance/snapshot` | GET | Admin | ✅ Per-session snapshot: enrolled students + ping log status |
| `/api/admin/attendance/override` | PATCH | Admin | ✅ Upsert attendance record with manual status |
| `/api/admin/attendance/weekly` | GET | Admin (no role check!) | ⚠️ Missing `withRole` — exposed without auth guard |
| `/api/admin/attendance/sessions-by-date` | GET | Admin | ✅ Lists sessions for a date; computes detected students from `wifi_snapshots` |
| `/api/admin/attendance/session-students` | GET | Admin | ✅ Deep per-student timeline from `wifi_snapshots` |
| `/api/admin/faculty-hours` | GET | None (!) | ❌ Uses anon key, no auth. References non-existent `departments` table |
| `/api/admin/feedback/analytics` | GET | Admin | ✅ Overview + per-session detail with rating distributions |
| `/api/admin/feedback/questions` | GET/POST/PATCH/DELETE | Admin | ✅ Full CRUD on `feedback_questions` |
| `/api/admin/feedback/status` | GET | Admin | ✅ Per-course pending/submitted feedback tracking |
| `/api/admin/live-students` | GET | Admin | ✅ Parses latest `wifi_snapshots` → identifies students by MAC |
| `/api/admin/lookup` | GET | Admin | ✅ Returns courses, faculty, venues for dropdowns |
| `/api/admin/notifications` | GET/POST | Admin | ✅ Broadcast notifications (general, class_reminder, feedback_reminder) |
| `/api/admin/reports` | GET | None (!) | ❌ No auth. Mocked metrics (hard-coded `totalReports: 142`). Not connected to real data |
| `/api/admin/schedule` | GET | None (!) | ❌ No auth. Uses anon key. Hard-coded `simulatedStudentsCount` |
| `/api/admin/settings/bssid` | GET/POST/PATCH/DELETE | Admin | ✅ Full CRUD on `venues` |
| `/api/admin/settings/config` | GET/PUT | Admin | ✅ Read/write `system_settings` row |
| `/api/admin/settings/password` | POST | Admin | ✅ Change own password with current verification |
| `/api/admin/setup` | POST | Admin | ✅ Table creation via RPC (legacy, notifications table already in schema) |
| `/api/admin/wifi-logs` | GET | Admin | ✅ Filtered `attendance_ping_logs` with stats |
| `/api/admin/lookup` | GET | Admin | ✅ Dropdown data for session creation form |

---

## 4. Frontend Layer

### 4.1 Student / General Pages

#### `/` — Login Page
- **Status:** ✅ Complete & connected
- Login form → `AuthContext.login()` → `POST /api/auth/login`
- Role-based redirect (admin → `/admin`, others → `/dashboard`)
- Demo credential auto-fill cards

#### `/signup` — Signup Page
- **Status:** ✅ Complete & connected
- Fields: first name, last name, email, password, program name
- Calls `POST /api/auth/signup`, auto-generates `CiPD_N` enrollment no

#### `/dashboard` — Student Home
- **Status:** ✅ Complete & connected
- Calls: `schedule/today`, `schedule/week`, `attendance/summary`, `students/assignments`, `feedback/pending`, `students/profile`
- Weekly schedule calendar view (rendered from API data)
- Attendance bar chart (Recharts)
- Pending assignments list (top 3, due-date countdown)
- Pending feedback alert → navigates to `/feedback`
- MAC address registration overlay → `PATCH /api/students/mac`

#### `/attendance` — My Attendance
- **Status:** ✅ Complete & connected
- Calls: `attendance/summary`, `attendance/sessions`
- Donut chart for overall %
- Monthly calendar with present/absent day coloring
- Course-wise mini donut widgets
- Session history timeline with ping counts

#### `/grades` — My Grades
- **Status:** ✅ Complete & connected
- Calls: `GET /api/students/assignments` (filters submissions with non-null grade)
- Average score summary + graded assignments table
- **Note:** Total marks hardcoded to `20` (schema has no `total_marks` column on `assignments`)

#### `/courses` — Course List
- **Status:** ✅ Complete & connected
- Calls: `GET /api/courses`
- Shows enrollments data enriched with sessions count, materials count, assignments count
- **Note:** Schedule string is mock-computed (`Mon, Wed · HH:MM AM`)
- Course code is mock-generated from initials

#### `/courses/[courseId]` — Course Detail
- **Status:** ✅ Complete & connected
- Calls: `GET /api/courses/[id]`, `GET /api/courses/[id]/materials`
- Tabs for Sessions and Materials

#### `/calendar` — Schedule Calendar
- **Status:** ✅ Complete & connected
- Calls: `GET /api/students/schedule/week` (or `/api/calendar/sessions`)

#### `/feedback` — Feedback Submission
- **Status:** ✅ Complete & connected
- Calls: `GET /api/feedback/pending`, `POST /api/feedback/submit`
- Leaderboard tab calls: `GET /api/feedback/leaderboard`
- Multi-step form: rating, yes/no, and text questions from `feedback_questions`

#### `/teachers` — Faculty Directory
- **Status:** ✅ Complete & partially connected
- Calls: `GET /api/faculty`
- **Gap:** `department` filter UI built, but `faculty` table has no `department` column — always shows "All Teachers"
- **Gap:** Mail/Phone/More action buttons are decorative (no handlers)

#### `/profile` — Student Profile
- **Status:** ✅ Complete & connected (shares data with `/settings` and dashboard)
- Calls: `GET /api/students/profile`

#### `/settings` — Student Settings
- **Status:** ⚠️ Partially connected
- Device & Attendance tab: ✅ MAC update connected to `PATCH /api/students/mac`
- Account tab: Profile info displayed (no edit). **Password change form is UI-only, no API call**
- Notifications tab: Toggle switches exist but state is **local only, no API endpoint, no persistence**
- Appearance tab: Theme/font-size selectors are **local only, no persistence**

---

### 4.2 Admin Portal Pages

#### `/admin` — Admin Dashboard
- **Status:** ✅ Complete & connected
- Calls: `GET /api/admin/dashboard`, `GET /api/admin/attendance/weekly`
- KPI cards, weekly attendance bar chart, recent sessions table

#### `/admin/attendance` — Attendance Management
- **Status:** ✅ Complete & connected
- Calls: `GET /api/admin/attendance/sessions-by-date`, `GET /api/admin/attendance/session-students`, `PATCH /api/admin/attendance/override`
- Date-picker, sessions list, per-session student detail with override buttons

#### `/admin/live-students` — Live Student Tracker
- **Status:** ✅ Complete & connected
- Calls: `GET /api/admin/live-students`
- Shows identified vs unidentified devices from latest `wifi_snapshots`

#### `/admin/wifi-logs` — Wi-Fi Ping Logs
- **Status:** ✅ Complete & connected
- Calls: `GET /api/admin/wifi-logs`
- Filterable log table with signal strength stats

#### `/admin/faculty-hours` — Faculty Hours & Honorarium
- **Status:** ⚠️ Partially broken
- Calls: `GET /api/admin/faculty-hours`
- **Critical Bug:** API references `department:departments(name)` — `departments` table **does not exist in schema**
- **Bug:** API uses anon key (not service role), no auth guard
- Status column hardcoded to `'Pending'`

#### `/admin/feedback` — Feedback Administration
- **Status:** ✅ Complete & connected
- Calls: `GET /api/admin/feedback/analytics`, `GET /api/admin/feedback/status`, `GET /api/admin/feedback/questions`
- CRUD on feedback questions: `POST/PATCH/DELETE /api/admin/feedback/questions`
- Rating charts and per-session breakdown

#### `/admin/notifications` — Notification Center
- **Status:** ✅ Complete & connected
- Calls: `GET /api/admin/notifications`, `POST /api/admin/notifications`
- Supports general, class_reminder, and feedback_reminder broadcasts

#### `/admin/reports` — Reports
- **Status:** ❌ Mostly fake/mock
- Calls: `GET /api/admin/reports`
- Metrics are hardcoded (`totalReports: 142`, `avgScore` derived from UUID char codes)
- No real report generation (PDF/CSV export is decorative)

#### `/admin/schedule` — Session Schedule
- **Status:** ⚠️ Partially connected – uses wrong API
- Calls: `GET /api/admin/schedule` (uses anon key, no auth)
- `students` count per session is **simulated** (not real enrollment count)
- **Gap:** No way to create/cancel sessions from this page (separate in `/admin/sessions`)

#### `/admin/sessions` — Session Management
- **Status:** ✅ Complete & connected
- Calls: `GET/POST /api/admin/sessions`, `PATCH /api/admin/sessions/[id]`
- Uses `GET /api/admin/lookup` for form dropdowns
- Can create sessions; changing status to `completed` triggers `calculate_attendance` RPC

#### `/admin/settings` — System Settings
- **Status:** ✅ Complete & connected
- BSSID/Venue management: `GET/POST/PATCH/DELETE /api/admin/settings/bssid`
- Attendance config: `GET/PUT /api/admin/settings/config`
- Password change: `POST /api/admin/settings/password`

---

## 5. Frontend ↔ Backend Gap Analysis

### 🔴 Critical Gaps (broken features)

| Feature | Page | Expected API | Status |
|---|---|---|---|
| Faculty Hours | `/admin/faculty-hours` | `GET /api/admin/faculty-hours` | ❌ Crashes: references non-existent `departments` table |
| Reports (real data) | `/admin/reports` | `GET /api/admin/reports` | ❌ Returns mocked/hardcoded data, no actual reporting |
| Schedule (student count) | `/admin/schedule` | `GET /api/admin/schedule` | ❌ Student count simulated; no auth guard |
| Weekly Attendance | `/admin` (dashboard) | `GET /api/admin/attendance/weekly` | ⚠️ Route exports `GET = handler` without `withRole` — **publicly accessible** |

### 🟡 Incomplete Features (UI present, backend missing or disconnected)

| Feature | Page | Gap |
|---|---|---|
| Password Change (Student) | `/settings` (Account tab) | Form exists, no API call. Needs a `POST /api/auth/update-password` or student-accessible password route |
| Notification Preferences | `/settings` (Notifications tab) | Local state only, no DB persistence. Needs `user_preferences` table/column + API |
| Theme / Appearance | `/settings` (Appearance tab) | Local state only, no persistence |
| Faculty Department Filter | `/teachers` | `faculty` table has no `department` column. Filter runs on empty data |
| Faculty Contact Buttons | `/teachers` | Mail/Phone/More buttons have no `onClick` handlers |
| Assignment Submission | `/grades`, `/dashboard` | Students can VIEW assignments but **cannot submit files**. `POST /api/students/assignments/submit` missing |
| Total Marks on Grades | `/grades` | `total_marks` hardcoded to `20`. No `total_marks` column in DB |
| Course Code | `/courses` | Fake code generated from initials. No `code` column in `courses` table |
| Course Schedule String | `/courses` | "Mon, Wed · HH:MM AM" is mock-computed, not real schedule data |
| Real Report Generation | `/admin/reports` | PDF/CSV export buttons are decorative |
| Session Student Count | `/admin/schedule` | Simulated random count, should come from `course_enrollments` |
| Attendance Calculation | `/admin/sessions/[id]` PATCH | Calls `calculate_attendance` RPC — **this RPC must exist in Supabase DB** (not verified in schema files) |

### 🟢 Fully Connected Features

| Feature | Page | APIs Used |
|---|---|---|
| Login / Logout | `/` | `/api/auth/login`, `/api/auth/logout` |
| Signup | `/signup` | `/api/auth/signup` |
| Student Dashboard | `/dashboard` | 6 endpoints |
| Attendance Tracking | `/attendance` | `/api/students/attendance/summary`, `/api/students/attendance/sessions` |
| MAC Registration | `/dashboard`, `/settings` | `PATCH /api/students/mac` |
| Grades View | `/grades` | `GET /api/students/assignments` |
| Feedback Submit | `/feedback` | `GET /api/feedback/pending`, `POST /api/feedback/submit` |
| Feedback Leaderboard | `/feedback` | `GET /api/feedback/leaderboard` |
| Course Listing + Detail | `/courses`, `/courses/[id]` | Full enriched data |
| Calendar | `/calendar` | `GET /api/students/schedule/week` |
| Teacher Directory | `/teachers` | `GET /api/faculty` |
| Admin Dashboard | `/admin` | Full live data |
| Attendance Management | `/admin/attendance` | Session-students, override |
| Live Students (Wi-Fi) | `/admin/live-students` | WiFi snapshot parsing |
| WiFi Logs | `/admin/wifi-logs` | Full log table |
| Feedback Admin | `/admin/feedback` | Questions CRUD + analytics |
| Notifications | `/admin/notifications` | Broadcast all types |
| Session Management | `/admin/sessions` | Full CRUD + status updates |
| BSSID / Venue Settings | `/admin/settings` | Full venue CRUD |
| System Config | `/admin/settings` | Ping/threshold config |

---

## 6. Database Schema Review

### 6.1 Schema Issues Found

#### ❌ CRITICAL: Missing `departments` Table
- `GET /api/admin/faculty-hours` queries `department:departments(name)` — this table **does not exist**.
- **Fix:** Either add a `departments` table with FK from `faculty.department_id`, or add a `department TEXT` column directly to `faculty`.

#### ❌ CRITICAL: Missing `calculate_attendance` PostgreSQL RPC Function
- `PATCH /api/admin/sessions/[id]` calls `supabaseAdmin.rpc('calculate_attendance', { p_session: id })` when a session is completed.
- This stored procedure is **NOT defined in any schema file**. Its absence means attendance will never auto-calculate.
- **Fix:** Create this RPC in Supabase SQL Editor. It should count pings per student per session and insert/update `attendance_records`.

#### ❌ CRITICAL: `attendance_ping_logs` Table Not in Schema Files
- `db.txt` lists `attendance_ping_logs` columns (`id bigint, session_id, student_id, device_hash, bssid, signal_strength, ping_time`), but this table is **NOT in `tables.json`**.
- The API at `/api/students/attendance/ping` and `/api/admin/wifi-logs` both write/read from it.
- **Fix:** Add `attendance_ping_logs` table definition to schema and verify the table exists in Supabase with proper indexes.

#### ⚠️ Schema Bug: Duplicate Primary Key Columns
- `primaryKey.json` declares: `PRIMARY KEY (id, id)` for both `sessions` and `users` tables.
- This is malformed SQL — PKs should be `PRIMARY KEY (id)` only.
- **Fix:** Correct the primary key definitions (likely a schema export artifact, but verify in Supabase).

#### ⚠️ Missing: `total_marks` Column on `assignments`
- Grades page hardcodes `total = 20`. The `assignments` table has no `total_marks` column.
- **Fix:** Add `total_marks NUMERIC DEFAULT 100` to `assignments` table.

#### ⚠️ Missing: `department` Column on `faculty`
- Teachers page tries to filter by department. Faculty table only has `designation TEXT`.
- **Fix:** Add `department TEXT` column to `faculty` table.

#### ⚠️ Missing: `code` and `schedule` Columns on `courses`
- Course listing generates mock codes and schedule strings.
- **Fix:** Add `code TEXT UNIQUE` and optionally a `schedule` TEXT or structured `course_schedule` join table.

#### ⚠️ Missing: `photo_url` Column on `faculty` / `students`
- Teachers page references `teacher.photo_url` with fallback to `/anujsir.jpg`.
- Profile pages use static `/studentPic.png`.
- **Fix:** Add `photo_url TEXT` to `faculty` and optionally `students`.

#### ⚠️ Missing: User Preferences Storage
- Settings page notification toggles and theme preferences have no persistence.
- **Fix:** Add `preferences JSONB DEFAULT '{}'` to `users` table, or create a separate `user_preferences` table.

#### ⚠️ Missing: File Upload for Assignment Submissions
- `assignment_submissions.file_url TEXT` exists in schema, but there is NO API endpoint for students to submit assignments.
- Supabase Storage bucket for files is not configured.
- **Fix:** Add `POST /api/students/assignments/submit` and configure Supabase Storage.

#### ℹ️ No RLS Policies Defined
- The schema files contain no `CREATE POLICY` / `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements.
- All API routes use `supabaseAdmin` (service role key) which bypasses RLS — this is intentional for the current architecture, but means if the anon key is ever used directly from client, all data is exposed.
- **Fix for long-term:** Define RLS policies appropriate to roles. Currently not critical since all data access goes through authenticated Next.js API routes.

#### ℹ️ `wifi_clients` Table Purpose Unclear
- `wifi_clients` table (columns: `mac_address, signal_level, status, updated_at`) exists in `db.txt` but is not referenced by any API route or schema file.
- The live-students feature reads `wifi_snapshots.iw_dump` JSONB instead.
- **Fix:** Clarify if `wifi_clients` is being populated by an external script. If not, it may be vestigial.

### 6.2 Schema Completeness Summary

| Area | Status |
|---|---|
| User/Auth tables | ✅ Complete |
| Academic tables (courses, sessions, enrollments) | ✅ Complete |
| Attendance tables (records, ping logs, wifi snapshots) | ⚠️ `attendance_ping_logs` missing from schema files |
| Feedback tables | ✅ Complete |
| Notification table | ✅ Complete |
| Assignments + submissions | ⚠️ Missing `total_marks` column |
| Faculty enrichment | ❌ Missing `department`, `photo_url` |
| Course enrichment | ❌ Missing `code`, schedule structure |
| Settings/Preferences | ❌ No user preferences table |
| File storage | ❌ No Supabase Storage configured |
| Database functions (RPCs) | ❌ `calculate_attendance` RPC missing |

---

## 7. Pending Requirements & Next Steps

### Priority 1 — Bug Fixes (Breaking Issues)

- [ ] **Fix faculty-hours API**: Remove reference to `departments` table. Add `department TEXT` column to `faculty` table or use `designation` as fallback.
- [ ] **Fix weekly attendance auth**: Add `withRole(handler, ['admin'])` to `GET /api/admin/attendance/weekly`.
- [ ] **Fix admin/reports auth**: Add `withRole(handler, ['admin'])` to `GET /api/admin/reports`.
- [ ] **Fix admin/schedule auth**: Add `withRole(handler, ['admin'])` to `GET /api/admin/schedule`. Replace simulated student count with real enrollment count from `course_enrollments`.
- [ ] **Create `calculate_attendance` RPC**: Write and deploy a PostgreSQL function that reads `attendance_ping_logs` for a session, applies the threshold from `system_settings`, and upserts `attendance_records`.
- [ ] **Verify `attendance_ping_logs` table** exists in Supabase with correct schema and is indexed on `(session_id, student_id)`.

### Priority 2 — Missing Core Features

- [ ] **Student assignment submission**: Create `POST /api/students/assignments/[id]/submit` with Supabase Storage upload. Add file upload UI to assignments view.
- [ ] **Student password change**: Create `POST /api/auth/update-password` accessible to all authenticated users (not just admin). Connect the Settings page Account tab form.
- [ ] **Real reports generation**: Replace mocked admin reports with real aggregated data (attendance + feedback + grades). Add CSV export endpoint.

### Priority 3 — Schema Migrations

- [ ] **Add `department TEXT` to `faculty` table**
- [ ] **Add `photo_url TEXT` to `faculty` and `students` tables**
- [ ] **Add `total_marks NUMERIC DEFAULT 100` to `assignments` table**
- [ ] **Add `code TEXT UNIQUE` to `courses` table**
- [ ] **Add `preferences JSONB DEFAULT '{}'` to `users` table** (for notification/appearance settings)
- [ ] **Add `attendance_ping_logs` to `tables.json` schema file** (verify table exists)
- [ ] **Fix primary key schema**: `PRIMARY KEY (id, id)` → `PRIMARY KEY (id)` in `primaryKey.json` for `sessions` and `users`

### Priority 4 — API Enhancements

- [ ] **Notification preferences API**: `GET/PATCH /api/students/settings` to persist `preferences` JSONB from `users` table
- [ ] **Department query support**: Fix `GET /api/faculty` to return `department` once column is added. Faculty directory filter will then work.
- [ ] **Faculty monthly hours**: Fix `/api/admin/faculty-hours` to use `supabaseAdmin` (service key), add `withRole` auth guard, remove `departments` join.
- [ ] **`/api/calendar/sessions` review**: Audit this route and confirm whether it duplicates `/api/students/schedule/week`.

### Priority 5 — Quality & Security

- [ ] **RLS Policies**: Define Row Level Security policies for all tables. Currently running fully server-side with service key (safe), but no client-side data protection exists.
- [ ] **Remove hardcoded credentials** from login page for production builds.
- [ ] **Add `total_marks` to seed data** once column is added.
- [ ] **Supabase Storage bucket**: Create `assignments` bucket for file submission flows.
