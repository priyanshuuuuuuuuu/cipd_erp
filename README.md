# CiPD 360 — ERP Portal
> **Centre for Intelligent Product Development (CiPD)**  
> Academic ERP + LMS for IIIT Delhi's iPD CP (Industry Professional Development Capstone Programme)

---

## 1. What Kind of System Is This?

CiPD 360 is a **full-stack Academic ERP / Learning Management System** purpose-built for a professional development programme at IIIT Delhi. It is NOT a generic LMS — it is tightly coupled to the CiPD programme's operational workflow:

- **Students** attend industry expert sessions, tracked automatically via Wi-Fi (MAC address detection)
- **Admin** schedules sessions, monitors live attendance, manages feedback, and generates program-level analytics
- **Faculty/Instructors** are industry professionals whose hours and honoraria are tracked
- **Data pipeline** imports session data from an Excel master sheet (iPD CP Review Sheet)

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, Vanilla CSS |
| **Backend** | Next.js API Route Handlers (same monorepo) |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Custom JWT (bcryptjs + jsonwebtoken) — NOT Supabase Auth |
| **Email** | Nodemailer via Gmail SMTP |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Data Import** | xlsx (Node.js) — Excel → Supabase pipeline |
| **Deployment** | Vercel (`https://cipd-erp-ic24.vercel.app`) |

---

## 3. Repository Structure

```
cipd_erp/
├── client-next/              # Main Next.js 14 monorepo (frontend + backend)
│   ├── app/
│   │   ├── page.jsx          # Login page (root)
│   │   ├── signup/           # Student registration
│   │   ├── dashboard/        # Student home dashboard
│   │   ├── attendance/       # Student attendance viewer
│   │   ├── grades/           # Student grades
│   │   ├── courses/          # Course listing + detail pages
│   │   ├── calendar/         # Weekly schedule calendar
│   │   ├── feedback/         # Session feedback submission + leaderboard
│   │   ├── teachers/         # Faculty directory
│   │   ├── profile/          # Student profile
│   │   ├── settings/         # Student settings
│   │   ├── admin/            # Full admin portal (multi-page)
│   │   │   ├── page.jsx      # Admin dashboard
│   │   │   ├── attendance/   # Attendance monitoring
│   │   │   ├── schedule/     # Session schedule view
│   │   │   ├── live-students/# Real-time Wi-Fi student tracker
│   │   │   ├── wifi-logs/    # Raw Wi-Fi ping log viewer
│   │   │   ├── feedback/     # Feedback analytics + question management
│   │   │   ├── leaderboard/  # Student leaderboard
│   │   │   ├── faculty-hours/# Instructor hours + honorarium
│   │   │   ├── reports/      # Master analytics report
│   │   │   ├── notifications/# Notification broadcast center
│   │   │   └── settings/     # BSSID/Venue + system config
│   │   ├── api/              # All backend route handlers
│   │   │   ├── auth/         # login, logout, signup, me, update-password
│   │   │   ├── admin/        # All admin endpoints
│   │   │   ├── feedback/     # Student feedback endpoints
│   │   │   ├── student/      # Student notifications
│   │   │   ├── students/     # Student data (profile, attendance, schedule)
│   │   │   ├── courses/      # Course detail + materials
│   │   │   ├── grades/       # Grades
│   │   │   ├── faculty/      # Faculty list
│   │   │   ├── calendar/     # Calendar sessions
│   │   │   ├── classroom/    # Classroom data
│   │   │   └── cron/         # Automated cron jobs
│   │   │       ├── reminder/ # Daily "class tomorrow" reminder
│   │   │       └── feedback-reminder/ # Feedback deadline reminder
│   │   ├── components/       # Shared UI primitives (login form)
│   │   └── contexts/         # AuthContext (React Context)
│   ├── lib/
│   │   ├── api.js            # Client-side fetch wrapper (auto-attaches JWT)
│   │   ├── auth.js           # bcryptjs + jsonwebtoken helpers
│   │   ├── middleware.js      # withAuth / withRole HOF guards
│   │   ├── supabase.js       # Lazy Supabase clients (anon + service role)
│   │   ├── emailer.js        # 5 email templates (weekly schedule, reminders, feedback)
│   │   ├── attendance-points.js  # Gamified points calculator (0–6 scale)
│   │   └── feedback-rollout.js   # Feedback notification rollout service
│   ├── scripts/              # 38 Node.js admin/migration scripts
│   │   ├── import_excel_data.mjs # PRIMARY: Excel → DB idempotent import
│   │   ├── seed.mjs          # Full seed from scratch
│   │   ├── attendance-worker.js  # Background Wi-Fi scanner process
│   │   ├── migrate-attendance-points.mjs
│   │   └── *.sql             # SQL migrations
│   ├── schema.sql / schema.txt   # PostgreSQL schema definition
│   └── package.json
├── Data/                     # Source Excel files (iPD CP Review Sheet)
├── BTP_Report/               # Academic report (LaTeX/PDF)
├── Designs/                  # UI design files
├── Documents/                # Project documentation
├── backups/                  # DB backup snapshots
├── attendance/               # Legacy attendance scripts
├── progress.md               # Full codebase audit + gap analysis
└── schema.sql                # Root-level schema reference
```

---

## 4. Database Schema (19 Tables)

```sql
users              -- All users: role ENUM(admin, faculty, student)
students           -- Extends users: enrollment_no, mac_address, device_hash
faculty            -- Extends users: designation, years_experience, honorarium_rate
courses            -- Domain/course definitions (8 domains)
course_enrollments -- Student ↔ Course many-to-many
venues             -- Physical rooms with router BSSID (Wi-Fi identifier)
sessions           -- Individual class sessions: date, time, status, venue, faculty
session_types      -- Lecture, Workshop, Lab, Tool Training, Industry Visit, etc.
session_materials  -- Per-session uploaded files
session_skills     -- Session ↔ Skills many-to-many (junction)
skills             -- Curriculum skill catalogue
attendance_records -- Final status per student/session (present/absent/partial)
attendance_ping_logs -- Raw Wi-Fi ping events with signal strength
wifi_snapshots     -- Raw router `iw dev` JSON dumps (JSONB)
wifi_clients       -- Parsed live clients
assignments        -- Assignments per course
assignment_submissions -- Student file submissions + grades
feedback_questions -- Admin-managed question bank (rating/yes_no/text)
feedback_responses -- Student answers per session/question
notifications      -- In-app + email notifications
system_settings    -- Global config: ping interval, attendance threshold, etc.
```

**Views:**
- `faculty_monthly_hours` — hours per faculty per month
- `student_attendance_summary` — attendance % per student
- `admin_dashboard_summary` — total students, faculty, sessions

---

## 5. Features — Complete Breakdown

### 5.1 Authentication
- Login with **email OR enrollment number** + password
- Role-based routing: admin → `/admin`, others → `/dashboard`
- Custom JWT (7-day expiry), stored in localStorage + Bearer header
- Google OAuth route exists (`/api/auth/google`)
- Demo access panel with password-gated credential display
- `withAuth` / `withRole` HOF middleware guards all API routes

### 5.2 Student Portal

| Feature | Details |
|---|---|
| **Dashboard** | Today's schedule, weekly calendar, attendance bar, pending assignments, feedback alert, MAC registration overlay |
| **Attendance** | Donut chart (overall %), monthly calendar heatmap, per-course mini-charts, session history with ping counts |
| **Grades** | Assignment submissions with grades, average score summary |
| **Courses** | Enrolled courses with session/material/assignment counts; course detail pages |
| **Calendar** | Week view of scheduled sessions |
| **Feedback** | Multi-step form (rating 1–5, yes/no, text); auto-populated for last unsubmitted session; leaderboard tab |
| **Faculty Directory** | Faculty cards with designation and experience |
| **Profile** | Personal info from DB |
| **Settings** | MAC address registration, password change, notification prefs (UI only) |
| **Notifications** | In-app notification feed from `notifications` table |

### 5.3 Wi-Fi Attendance System
- **Attendance Worker** (`scripts/attendance-worker.js`): background Node.js process that scans the classroom Wi-Fi router via `iw dev` and logs connected MAC addresses to `wifi_snapshots`
- **Ping Matching**: Student MAC addresses registered in `students.mac_address` are matched against live scans
- **Points System** (0–6 scale per session):
  - ≥85% presence → 5 pts
  - ≥70% → 4 pts
  - ≥45% → 3 pts
  - <45% → 0 pts (absent)
  - +1 bonus if present in first 2 scans (within ~8 min of start)
- **Override**: Admin can manually override any student's attendance status
- **Live View**: `/admin/live-students` shows identified vs unidentified devices in real time
- **Venue BSSID**: Each venue has a unique router BSSID stored in DB for session matching

### 5.4 Admin Portal

| Page | Key Features |
|---|---|
| **Dashboard** | Quick actions, weekly attendance bar chart, upcoming classes list with Notify All button, feedback status progress bars, recent activity feed |
| **Schedule** | Upcoming + past sessions with filtering |
| **Schedule New Class** | Modal: course, title, faculty, date, time, venue with conflict detection |
| **Attendance Monitoring** | Date picker → sessions list → per-student ping timeline → manual override |
| **Live Students** | Real-time MAC-to-student identification from latest Wi-Fi snapshots |
| **Wi-Fi Logs** | Raw `attendance_ping_logs` with signal strength stats |
| **Feedback Analytics** | Rating distributions, per-domain averages, question CRUD |
| **Leaderboard** | Student ranking by attendance points + feedback credits |
| **Faculty Hours** | Instructor hours and honorarium tracking |
| **Reports** | 4-tab analytics: Program Analytics, Master Sheet, Instructors, Skills Matrix |
| **Notifications** | Broadcast: class reminder, feedback reminder, general announcements |
| **Settings** | BSSID/venue CRUD, system config (ping interval, threshold), password change |

### 5.5 Reports & Analytics (Admin)

The `/admin/reports` page (`app/admin/reports/page.jsx`, 774 lines) has 4 tabs:

1. **Program Analytics**: Sessions by domain (bar), session type mix (donut), monthly volume (area chart), avg rating by domain (horizontal bar), feedback rating trend (line), instructor workload (horizontal bar), teaching hours per month (bar)
2. **Master Sheet**: Filterable table of all sessions with domain/category/instructor/type filters + CSV export
3. **Instructors**: Full instructor table with hours, sessions, rating, domains taught
4. **Skills Matrix**: Coverage donut + per-domain stacked bar + full skill-by-skill coverage table (✓ YES / ✗ NO)

### 5.6 Email Notifications (5 Templates)

All templates in `lib/emailer.js` (704 lines) use HTML email with Inter font, mobile-responsive:

| Template | Trigger |
|---|---|
| **Weekly Schedule** | Admin "Notify All" → sends calendar grid with `.ics` attachment |
| **Day-Before Reminder** | Cron job 24h before session |
| **General Notification** | Admin broadcast for any message type |
| **Feedback Available** | Auto-rollout after session completes |
| **Feedback Reminder** | Cron job when feedback deadline approaching |

### 5.7 Data Pipeline (Excel Import)

`scripts/import_excel_data.mjs` — **Idempotent, zero-deletion import**:

1. Reads `Data/Copy of iPD CP Review Sheet.xlsx` (sheets: `main`, `Instructors`)
2. Upserts 8 course domains
3. Upserts 8 session types
4. Upserts faculty users (email: `firstname.lastname@cipd.edu`, password: `faculty123`)
5. Removes Holiday sessions from DB
6. Upserts sessions by natural key `(session_date, start_time, course_id)` — never touches attendance/feedback
7. Upserts skills and session_skills links (additive only)

**CUTOFF_DATE** = `2026-04-20` — only historical data is imported.

**Slot times:**
- Slot 1: 09:00–10:30
- Slot 2: 10:45–12:15
- Slot 3: 13:30–15:00
- Slot 4: 15:15–16:45

---

## 6. API Routes Reference

### Auth
| Endpoint | Method | Auth |
|---|---|---|
| `/api/auth/login` | POST | None |
| `/api/auth/signup` | POST | None |
| `/api/auth/logout` | POST | None |
| `/api/auth/me` | GET | Any |
| `/api/auth/update-password` | POST | Any |
| `/api/auth/google` | GET/POST | None |

### Student
| Endpoint | Method |
|---|---|
| `/api/students/profile` | GET |
| `/api/students/mac` | PATCH |
| `/api/students/attendance/ping` | POST |
| `/api/students/attendance/summary` | GET |
| `/api/students/attendance/sessions` | GET |
| `/api/students/schedule/today` | GET |
| `/api/students/schedule/week` | GET |
| `/api/students/assignments` | GET |
| `/api/student/notifications` | GET/PATCH |
| `/api/feedback/pending` | GET |
| `/api/feedback/submit` | POST |
| `/api/feedback/leaderboard` | GET |
| `/api/grades` | GET |
| `/api/courses` | GET |
| `/api/courses/[id]` | GET |
| `/api/faculty` | GET |
| `/api/calendar/sessions` | GET |

### Admin
| Endpoint | Method |
|---|---|
| `/api/admin/dashboard` | GET |
| `/api/admin/sessions` | GET/POST |
| `/api/admin/sessions/[id]` | PATCH |
| `/api/admin/lookup` | GET |
| `/api/admin/attendance/snapshot` | GET |
| `/api/admin/attendance/override` | PATCH |
| `/api/admin/attendance/weekly` | GET |
| `/api/admin/attendance/sessions-by-date` | GET |
| `/api/admin/attendance/session-students` | GET |
| `/api/admin/live-students` | GET |
| `/api/admin/wifi-logs` | GET |
| `/api/admin/faculty-hours` | GET |
| `/api/admin/feedback/analytics` | GET |
| `/api/admin/feedback/status` | GET |
| `/api/admin/feedback/questions` | GET/POST/PATCH/DELETE |
| `/api/admin/notifications` | GET/POST |
| `/api/admin/reports/master` | GET |
| `/api/admin/schedule` | GET |
| `/api/admin/categories` | GET |
| `/api/admin/skills` | GET |
| `/api/admin/enrollments` | GET |
| `/api/admin/settings/bssid` | GET/POST/PATCH/DELETE |
| `/api/admin/settings/config` | GET/PUT |
| `/api/admin/settings/password` | POST |
| `/api/admin/setup` | POST |

### Cron (automated)
| Endpoint | Trigger |
|---|---|
| `/api/cron/reminder` | Daily — "Class Tomorrow" emails |
| `/api/cron/feedback-reminder` | Daily — Feedback deadline emails |
| `/api/cron/process-attendance` | Post-session attendance calculation |

---

## 7. Getting Started

### Prerequisites
- Node.js 18+
- Supabase project with schema applied
- Gmail account for email (App Password required)

### Setup

```bash
cd client-next
npm install
```

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
EMAIL_FROM=your-gmail@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Run Development Server
```bash
npm run dev
```

### Run Attendance Worker (background process)
```bash
npm run attendance-worker
```

### Import Excel Data (idempotent — safe to re-run)
```bash
cd client-next
node scripts/import_excel_data.mjs
```

### Demo Login Credentials
| Role | Email | Password |
|---|---|---|
| Admin | `admin@cipd.edu` | `admin123` |
| Faculty | `anuj.grover@cipd.edu` | `faculty123` |
| Student | `mayank.chauhan@cipd.com` | `23456789` |

<<<<<<< HEAD
> Demo panel is accessible on the login page with password: `CiPDCiPD@`
=======
> Demo panel is accessible on the login page with password: `*(removed — ask an admin; rotate before reuse)*`
>>>>>>> 7658f2ac563b0494eb5d492cf1cc267b94a33e63

---

## 8. Architecture Flow

```
Browser (React + Next.js)
    │
    ├─► AuthContext (JWT in localStorage)
    │       └─► lib/api.js (auto-attaches Bearer token)
    │
    ├─► Next.js API Routes (server-side)
    │       ├─► lib/middleware.js (withAuth / withRole)
    │       ├─► lib/supabase.js (supabaseAdmin — service key)
    │       ├─► lib/emailer.js (Nodemailer → Gmail)
    │       └─► lib/feedback-rollout.js
    │
    └─► Supabase PostgreSQL
            ├─► 19 tables
            ├─► 3 views
            └─► calculate_attendance() RPC
```

**Attendance Data Flow:**
```
Router (classroom Wi-Fi)
    └─► attendance-worker.js (iw dev scan every N sec)
            └─► wifi_snapshots table (JSONB dump)
                    └─► /api/admin/live-students (parses MACs)
                            └─► attendance_records (present/absent/partial)
                                    └─► attendance_points (0–6 per session)
```

---

## 9. Known Issues & Gaps

| Severity | Issue |
|---|---|
| ⚠️ Bug | `faculty-hours` API references non-existent `departments` table |
| ⚠️ Bug | `/api/admin/attendance/weekly` missing `withRole` auth guard |
| ⚠️ Missing | Student assignment file submission (UI exists, no API) |
| ⚠️ Missing | Student password change API not connected in Settings |
| ⚠️ Missing | Notification preferences have no DB persistence |
| ℹ️ Schema | `faculty` table missing `department` and `photo_url` columns |
| ℹ️ Schema | `courses` table missing `code` column (mock-generated in UI) |
| ℹ️ Schema | No RLS policies — all access via service role key (secure by design) |

---

## 10. Programme Context

This system serves the **iPD CP (Industry Professional Development Capstone Programme)** at IIIT Delhi. The programme brings **industry experts** to deliver sessions across 8 domains:

1. Business & Leadership
2. Capstone
3. Design & UI
4. Electronics & Basics
5. Embedded Systems & IoT
6. Entrepreneurship
7. Product Development
8. Software & App Development

Session types include: Lectures, Workshops, Labs, Tool Training, Industry Visits, Self Work, and Capstone sessions.

The programme tracks which **skills** from the curriculum have been covered across sessions via the Skills Matrix in the Reports dashboard.

---

*Built as a BTP (Bachelor's Thesis Project) — CiPD 360 · IIIT Delhi · 2026*
