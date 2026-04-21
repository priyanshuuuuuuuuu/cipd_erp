# Part 5 - Coursework, Materials, and Academic Performance (Detailed Analysis)

## 1. Scope and Objective

This document analyzes the coursework and performance layer of the CIPD ERP.

Primary objective of this module:

- Show students their enrolled courses and course details
- Deliver class materials in a course-centric view
- Track assignment status (pending, submitted, graded)
- Present grades and performance summaries
- Extend pending-assignment visibility through Google Classroom sync

This part is feature-focused for BTP reporting with simplified API and UI behavior notes.

## 2. Files Analyzed (Part 5)

Frontend pages

- app/courses/page.jsx
- app/courses/[courseId]/page.jsx
- app/grades/page.jsx
- app/dashboard/page.jsx
- app/admin/settings/page.jsx (Google Classroom setup text and flow touchpoint)

Student and shared APIs

- app/api/courses/route.js
- app/api/courses/[id]/route.js
- app/api/courses/[id]/materials/route.js
- app/api/students/assignments/route.js
- app/api/grades/route.js
- app/api/classroom/assignments/route.js

Google OAuth support used by coursework integration

- app/api/auth/google/connect/route.js
- app/api/auth/google/callback/route.js

Shared services

- lib/api.js
- lib/middleware.js
- lib/supabase.js

Schema references

- schema.txt
- db.txt
- supabase/schemas/tables.json

## 3. Module Purpose in Overall Architecture

This module is the academic delivery and evaluation layer.

It sits on top of enrollments and sessions and provides:

- learning content access (materials)
- task tracking (assignments)
- outcome visibility (grades)
- dashboard-level planning support (upcoming dues)

In system terms, it connects course membership with student execution and measurable performance.

## 4. Functional Understanding (Feature-Level)

## 4.1 Courses Listing Experience

Entry page: app/courses/page.jsx

What it provides:

- list of courses available to the logged-in user context
- searchable course cards
- quick signals: sessions count, materials count, assignments count
- navigation to course detail view

User value:

- one place to discover all active academic workload for each course

## 4.2 Course Detail Experience

Entry page: app/courses/[courseId]/page.jsx

What it provides:

- course metadata and recent sessions
- course material list with preview and download flow
- course-scoped assignment list with submit action

Material behavior in short:

- supports content preview when stored text is available
- supports file download when file URL exists

Assignment behavior in short:

- shows assignment status from merged assignment + submission data
- submission action is available from inside the course page

## 4.3 Grades Experience

Entry page: app/grades/page.jsx

What it provides:

- graded assignment list
- searchable grade entries
- computed average percentage summary

Data interpretation:

- page focuses only on graded submissions and omits ungraded items

## 4.4 Dashboard Assignment Integration

Entry page: app/dashboard/page.jsx

What it provides:

- pending assignment block for ERP assignments
- optional Google Classroom assignment merge in the same list
- due-date ordered combined view for quick action

This makes the dashboard a planning surface, while course pages remain the execution surface.

## 5. API and Backend Overview

## 5.1 Course and Material APIs

Main endpoints:

- GET /api/courses: returns role-aware course list
- GET /api/courses/[id]: returns one course detail and recent sessions
- GET /api/courses/[id]/materials: returns materials for that course

## 5.2 Assignment and Grade APIs

Main endpoints:

- GET /api/students/assignments: returns assignments for enrolled courses with merged submission state
- GET /api/grades: returns graded submissions with assignment context

## 5.3 External Classroom API Integration

Main endpoints:

- GET /api/classroom/assignments: returns pending Google Classroom assignments using admin-connected token
- GET /api/auth/google/connect and callback route: supports OAuth token setup and storage

## 6. Data Flow (End-to-End)

## 6.1 ERP Assignment Visibility Flow

1. Student enrollments define eligible courses
2. Assignment list is loaded for those courses
3. Submission records are merged for the student
4. UI marks items as submitted, pending, or overdue

## 6.2 Course Material Flow

1. Student opens a course
2. Backend fetches course-linked materials
3. UI renders preview where content exists
4. File download is offered when file_url is present

## 6.3 Grading Visibility Flow

1. Faculty/admin grading updates assignment_submissions
2. Student page fetches graded records
3. UI computes percentages and aggregates
4. Student sees performance trend snapshot

## 6.4 Google Classroom Enrichment Flow

1. Admin connects Google account via OAuth
2. Token is stored in google_tokens
3. Student dashboard fetches published coursework across active classes
4. Items already turned in or overdue are filtered out
5. Remaining items merge with ERP pending assignments

## 7. UI and State Notes (Simplified)

Student-facing patterns:

- list + detail navigation for courses
- search-first filtering for large lists
- merged assignment source presentation (ERP + Google Classroom)
- lightweight success/error handling around submission and refresh actions

Dashboard pattern:

- compact, actionable view for pending work
- source-aware rendering for external vs internal assignments

## 8. Database Interaction and Entities

Core entities used:

- courses
- course_enrollments
- sessions
- session_materials
- assignments
- assignment_submissions
- users/faculty metadata joins for display labels
- google_tokens for Classroom integration

Observed schema support:

- assignments include total_marks (default available in schema snapshots)
- assignment_submissions include grade, feedback, and file reference fields

## 9. Engineering Decisions and Trade-offs

1. Course-first information architecture

- Benefit: students view content and workload in one place per course
- Trade-off: some dashboard-level duplication is needed for quick planning

2. Merged assignment model

- Benefit: combines ERP and Classroom workload into one student-facing queue
- Trade-off: requires clear source labeling and fallback behavior when Classroom is not connected

3. Student-specific submission merge

- Benefit: each assignment card can show real progress state
- Trade-off: merge logic depends on stable assignment-submission relationships

## 10. Edge Cases, Gaps, and Risks Observed

1. Missing assignment submit backend route

- course detail page calls /api/assignments/:id/submit
- no corresponding route handler was found under app/api in this analysis pass
- likely impact: submission action can fail at runtime

2. Request wrapper mismatch for file upload submission

- course page builds FormData for file upload
- shared api.post wrapper JSON-stringifies body and sets application/json
- likely impact: multipart file upload cannot be sent correctly through current wrapper

3. Dual grade data paths

- app/grades/page.jsx reads /api/students/assignments and filters graded items
- a dedicated /api/grades endpoint also exists
- risk: parallel logic may drift over time

4. Generated/fallback course metadata

- course list synthesizes fallback schedule/code values in API response when needed
- risk: displayed schedule formatting may diverge from real timetable semantics

## 11. Module Contribution to Overall System

This module contributes:

- student-facing academic workload visibility
- material consumption and assignment completion workflows
- performance transparency through grades
- cross-platform assignment visibility through optional Classroom sync

For BTP narrative, this module represents the learning execution and performance surface built on top of enrollment and scheduling foundations.

## 12. Part 5 Summary for Report Use

The coursework and performance subsystem organizes how students consume materials, complete assignments, and track grades. It combines ERP-native academic data with optional Google Classroom assignment enrichment at dashboard level. The module is operationally strong in visibility and aggregation, with notable integration risks around assignment submission endpoint completeness and upload request handling consistency.
