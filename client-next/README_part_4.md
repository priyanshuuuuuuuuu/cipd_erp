# Part 4 - Feedback Intelligence and Rollout (Detailed Analysis)

## 1. Scope and Objective

This document provides a deep system-level analysis of the Feedback Intelligence and Rollout module.

Primary objective of this module:

- Collect structured and descriptive student feedback for completed sessions
- Control feedback visibility windows and deadlines
- Convert attendance completion into feedback notification workflows
- Provide admin analytics for quality trends, response rates, and question-level signals
- Support operational follow-up via reminders, notifications, and email outreach

This analysis is feature-focused and architecture-focused for BTP reporting.

## 2. Files Analyzed (Part 4)

Frontend pages

- app/feedback/page.jsx
- app/admin/feedback/page.jsx
- app/admin/page.jsx
- app/admin/schedule/page.jsx (feedback rollout trigger controls)
- app/profile/page.jsx (feedback history integration point)
- app/settings/page.jsx (feedback notification preference surface)

Student feedback APIs

- app/api/feedback/pending/route.js
- app/api/feedback/submit/route.js
- app/api/feedback/my-response/route.js
- app/api/feedback/leaderboard/route.js

Admin feedback and control APIs

- app/api/admin/feedback/analytics/route.js
- app/api/admin/feedback/forms/route.js
- app/api/admin/feedback/questions/route.js
- app/api/admin/feedback/student-response/route.js
- app/api/admin/feedback/status/route.js
- app/api/admin/sessions/rollout-feedback/route.js
- app/api/admin/sessions/[id]/route.js
- app/api/admin/notifications/route.js

Cron and automation APIs

- app/api/cron/feedback-reminder/route.js
- app/api/cron/process-attendance/route.js (indirect feedback trigger path)

Shared services

- lib/feedback-rollout.js
- lib/emailer.js

Schema and scripts

- schema.txt
- db.txt
- scripts/feedback_migration.sql
- scripts/feedback_migration_step1.sql
- scripts/feedback_migration_step2.sql
- scripts/create_notifications_table.sql
- scripts/feedback_e2e_test.sql
- scripts/populate_feedback_data.sql
- scripts/test-feedback-rollout.mjs

## 3. Module Purpose in Overall Architecture

Feedback is the learning-quality intelligence layer of the ERP.

Where scheduling defines what happened and attendance defines who was present, feedback captures how the session was experienced by participants.

This module performs five transformations:

1. Eligibility transformation

- Determines which session-student pairs are allowed to submit feedback.

2. Collection transformation

- Converts question forms into persisted response records across multiple answer types.

3. Analytics transformation

- Converts raw responses into trends, distributions, lecture-level quality signals, and submission rates.

4. Engagement transformation

- Converts submissions into credits and comparative leaderboard standings.

5. Outreach transformation

- Converts completion and deadline conditions into notifications and emails.

This makes Part 4 both an analytics subsystem and an engagement workflow subsystem.

## 4. Functional Understanding (Feature-Level)

## 4.1 Student Feedback Experience

Entry page: app/feedback/page.jsx

What the student sees:

- Feedback tab with pending, expired, and submitted sections
- Leaderboard tab for engagement/credit ranking
- Form-level metadata: course, faculty, venue, deadline left
- Submitted response viewer modal

Form behavior in short:

- Active forms are shown in pending; old forms move to expired
- The page supports both submission and self-response viewing
- Deadlines are applied per session (custom or default)

## 4.2 Admin Feedback Analytics Experience

Entry page: app/admin/feedback/page.jsx

Tabs and functions:

- Overview and Analytics:
- summary strip (lectures, average rating, submission rate, descriptive count)
- rating distribution table
- average-rating and submission-rate trend charts
- lecture-wise analytics table with drill-down

- Feedback Forms:
- list completed-session feedback forms
- filter by active/expired
- edit per-session deadline
- monitor submissions vs enrolled counts

- Question Configuration:
- list/add/edit/delete questions
- activate/deactivate questions
- supports rating, yes_no, mcq, text types

Additional admin controls:

- lecture-level detail view for deeper inspection
- privacy confirmation before student-wise response viewing

## 4.3 Dashboard and Schedule Integration

Entry pages:

- app/admin/page.jsx
- app/admin/schedule/page.jsx

Integrated feedback behavior:

- Dashboard shows feedback pending counts and quick reminder actions
- Dashboard sends feedback reminders through admin notifications API
- Schedule management supports single-session and backfill feedback rollouts

This enables feedback operations both from analytics and from scheduling workflows.

## 5. API and Backend Overview

## 5.1 Student feedback APIs (Simplified)

Main student endpoints:

- GET /api/feedback/pending: returns pending/submitted forms for the logged-in student
- POST /api/feedback/submit: stores the submitted answers for a session
- GET /api/feedback/my-response: returns the student's own answers for one session
- GET /api/feedback/leaderboard: returns ranking and credits based on submissions

## 5.2 Admin feedback APIs (Simplified)

Main admin endpoints:

- GET /api/admin/feedback/analytics: returns summary metrics and lecture/session-level analytics
- GET/PATCH /api/admin/feedback/forms: lists forms and updates feedback deadlines
- GET/POST/PATCH/DELETE /api/admin/feedback/questions: manages question bank
- GET /api/admin/feedback/student-response: fetches one student's responses for a session
- GET /api/admin/feedback/status: returns pending/submitted status for reminder operations

## 5.3 Feedback rollout and notification APIs (Simplified)

Key workflow endpoints:

- POST /api/admin/sessions/rollout-feedback: sends feedback availability after session completion
- PATCH /api/admin/sessions/[id]: includes rollout trigger when a session is completed
- POST /api/admin/notifications: sends reminder notifications to pending students
- GET/PATCH /api/student/notifications: allows students to read and manage notification state

## 5.4 Cron-based reminder API (Simplified)

GET /api/cron/feedback-reminder

Security:

- x-cron-secret must match CRON_SECRET

Behavior in short:

- Checks nearing deadlines
- Finds students who still have not submitted feedback
- Sends reminder notifications and emails

## 6. Shared Helper Logic

Source: lib/feedback-rollout.js

rolloutFeedbackForSession(sessionId, onlyStudentIds)

Key logic:

- Loads session metadata
- Determines target students either from attendance_records or allowlist
- Deduplicates using existing feedback_available notifications
- Computes deadline as session end plus 24 hours
- Inserts notification rows for pending students
- Dispatches feedback-available emails asynchronously

Design strengths:

- idempotent by notification-based skip logic
- reusable from schedule API, admin backfill API, and cron flows

Source: lib/emailer.js

Feedback-specific templates:

- sendFeedbackAvailableEmail
- sendFeedbackReminderEmail

Role in architecture:

- Converts workflow events into user-facing communication artifacts

## 7. Data Flow (End-to-End)

## 7.1 Session completion to student form flow

1. Session is marked completed by admin or cron
2. Attendance is finalized
3. Feedback rollout helper determines eligible students
4. feedback_available notifications are created
5. Student feedback page loads pending forms from notifications
6. Student submits answers to feedback_responses

## 7.2 Deadline reminder flow

1. Cron checks sessions near deadline window
2. Computes pending students per session
3. Deduplicates previous reminder events
4. Sends feedback_deadline_reminder notifications and emails
5. Student sees reminder in notifications and can submit before expiry

## 7.3 Admin analytics flow

1. Admin analytics API aggregates sessions, responses, enrollments
2. UI renders summary metrics and trend charts
3. Drill-down computes question-level distributions and descriptive evidence
4. Student-wise inspection is gated by privacy confirmation flow

## 7.4 Dashboard operational flow

1. Dashboard fetches /api/admin/feedback/status
2. Shows pending counts per course
3. Admin sends reminders via /api/admin/notifications
4. Notifications and emails are queued asynchronously

## 8. UI and State Notes (Simplified)

Student page notes:

- separates pending, submitted, and expired forms
- supports quick submission and response viewing

Admin page notes:

- split into analytics, forms, and question configuration sections
- supports deadline updates and question management

Dashboard notes:

- shows pending feedback counts
- allows reminder actions from admin workflows

## 9. Database Interaction and Schema Evolution

## 9.1 Core entities used

- feedback_questions
- feedback_responses
- notifications
- sessions (status, feedback_deadline)
- attendance_records (eligibility basis)
- course_enrollments (expected denominator)
- users and students (identity and communication)

## 9.2 Feedback schema baseline

schema.txt includes:

- feedback_question_type enum with rating, yes_no, text
- feedback_questions table
- feedback_responses table

## 9.3 Feedback and notification migration signals

feedback_migration scripts introduce:

- sessions.feedback_deadline
- mcq enum extension and expanded question seeds

create_notifications_table.sql introduces:

- notifications table and indexes

This shows progressive evolution from simple feedback capture to workflow-driven feedback operations.

## 10. Engineering Decisions and Trade-offs

1. Notification-first eligibility model

- Decision: use feedback_available notifications as primary visibility gate
- Benefit: explicit, event-driven control over who receives forms
- Trade-off: requires strong notification pipeline reliability

2. Attendance fallback for eligibility

- Decision: include attended sessions even without notification in edge cases
- Benefit: prevents missed forms if rollout is delayed
- Trade-off: dual-source eligibility logic increases complexity

3. Denominator model for submission rate

- Decision: expected submissions equals enrolled multiplied by completed sessions
- Benefit: clear operational KPI for response completeness
- Trade-off: assumes all enrolled students are expected responders unless filtered by attendance in specific flows

4. Prefilled defaults for rapid student submission

- Decision: initialize optimistic answer defaults
- Benefit: higher completion speed and likely higher submission rates
- Trade-off: risk of low-effort confirmations reducing response variance

5. Privacy gate for student-wise response access

- Decision: explicit confirm-before-unlock workflow
- Benefit: introduces friction for sensitive access and improves governance posture
- Trade-off: not an access-control barrier at backend level, only a frontend intentionality barrier

## 11. Edge Cases, Gaps, and Risks Observed

Implemented edge handling includes:

- reminder deduplication by feedback_deadline_reminder notification existence
- rollout deduplication by feedback_available notification existence
- default deadline derivation when feedback_deadline is null
- graceful empty states across student and admin UIs

Observed gaps and risks:

1. Missing student feedback history endpoint

- app/profile/page.jsx calls /api/students/feedback/history
- no matching route file exists under app/api
- this creates an integration mismatch for profile feedback tab data

2. Potential duplicate submissions

- feedback submit route inserts rows directly into feedback_responses
- no visible unique constraint on session_id, student_id, question_id in analyzed schema snapshot
- repeated submits may duplicate records unless constrained elsewhere

3. Schema snapshot drift

- schema.txt enum does not include mcq, while migrations and UI rely on mcq
- schema snapshots may be behind runtime DB state

4. Reminder dedup granularity

- cron reminder skips if any prior feedback_deadline_reminder exists for session
- re-reminding closer to deadline is not currently supported by design

5. Runtime table bootstrap dependency

- admin notifications route attempts dynamic table ensure via exec_sql RPC
- behavior depends on RPC availability and privileges in deployment

## 12. Module Contribution to Overall System

Feedback Intelligence and Rollout contributes:

- qualitative learning signal collection
- operational response-rate visibility
- workflow automation from completion to reminder stages
- admin control over question bank and deadline tuning
- engagement gamification through leaderboard credits

For BTP narrative, this module should be positioned as:

- the quality-observability layer of instruction delivery
- the bridge between attendance-confirmed participation and pedagogical improvement data
- a workflow-integrated analytics subsystem rather than a standalone survey form

## 13. Part 4 Summary for Report Use

The feedback subsystem is implemented as a notification-aware, attendance-linked intelligence pipeline. It combines structured question management, student-side rapid submission UX, admin analytics and drill-down tooling, and automation paths for rollout and reminders. By integrating with session completion and communication channels, it turns post-class feedback into a measurable and actionable operational process across the ERP.
