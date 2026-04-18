# Part 7 - Automation, Data Operations, and Reliability Layer (Concise Analysis)

## 1. Scope and Objective

This part covers the operational layer that keeps the ERP healthy beyond normal page-based usage.

Main objective:

- run background attendance and reminder automation
- support schema evolution and controlled data changes
- provide seed and repair scripts for test/demo environments
- provide quick diagnostics and script-based validation

This document is intentionally concise, with feature coverage prioritized over deep internals.

## 2. Files Analyzed (Part 7)

Automation endpoints

- app/api/cron/process-attendance/route.js
- app/api/cron/feedback-reminder/route.js
- app/api/cron/reminder/route.js

Background worker

- scripts/attendance-worker.js

Migration scripts

- scripts/migration_phase2_columns.sql
- scripts/migration_phase2_rpc.sql
- scripts/migration_wifi_attendance.sql
- scripts/migration_add_points.sql
- scripts/migration_override_columns.sql
- scripts/settings_migration.sql
- scripts/master_report_migration.sql
- scripts/feedback_migration.sql
- scripts/feedback_migration_step1.sql
- scripts/feedback_migration_step2.sql
- scripts/create_notifications_table.sql

Seed and data setup scripts

- scripts/seed.mjs
- scripts/seed.sql
- scripts/seed_weekly_attendance.sql
- scripts/run_seed_weekly.mjs
- scripts/direct_seed.mjs
- scripts/force_seed.mjs
- scripts/fill_empty.mjs
- scripts/fix_data.mjs
- scripts/populate_feedback_data.sql
- scripts/populate_test_snapshots.js
- scripts/update_bssids.mjs

Testing and diagnostics scripts

- scripts/test-attendance-points.js
- scripts/test-feedback-rollout.mjs
- scripts/test_api_logic.mjs
- scripts/check_db.mjs
- scripts/check_records.mjs
- scripts/check_raw.mjs
- scripts/check_monday.mjs

Operational references

- README.md
- package.json

## 3. Module Purpose in Overall Architecture

This layer is the reliability backbone of the ERP.

It ensures that:

- attendance and feedback automation continue without manual admin clicks
- stale sessions are recovered and completed automatically
- reminder communication is sent on schedule
- schema and data stay aligned with feature growth
- teams can debug quickly when analytics or attendance behavior looks wrong

## 4. Core Feature Coverage

## 4.1 Continuous Attendance Automation

Primary path:

- scripts/attendance-worker.js calls /api/cron/process-attendance on a fixed interval.

Implemented behavior:

- periodic cycle execution (6-minute cadence)
- immediate retry path on failure
- class-hours-aware alerting when repeated failures occur
- snapshot staleness detection and alerting

## 4.2 Attendance Cron Self-Healing

Endpoint:

- /api/cron/process-attendance

Key features:

- CRON_SECRET guard (Authorization header)
- reads runtime system_settings for scanner interval and min signal
- pass 1: processes ongoing/recent sessions for the day
- writes/upserts attendance_records while preserving manual overrides
- auto-completes just-ended sessions and triggers feedback rollout
- pass 2: sweep for overdue non-completed sessions (self-healing)
- returns operational summary payload for monitoring

## 4.3 Feedback Reminder Automation

Endpoint:

- /api/cron/feedback-reminder

Key features:

- x-cron-secret guard
- scans completed sessions
- checks deadline window (about 3 to 5 hours left)
- finds attended but not-submitted students
- deduplicates by existing feedback_deadline_reminder notifications
- inserts notifications and triggers reminder emails

## 4.4 Day-Before Class Reminder Automation

Endpoint:

- /api/cron/reminder

Key features:

- daily reminder flow for next-day sessions
- targets enrolled students per course
- sends email and logs notification rows

## 4.5 Schema and Feature Evolution Support

Migration coverage includes:

- attendance enhancements (points, override, signal metadata)
- settings and venue activation controls
- feedback deadline and question-type expansion
- reports metadata (categories, skills, session_skills)
- attendance RPC function for status computation

Operational value:

- keeps DB structure synchronized with incremental feature rollout across modules

## 4.6 Seeding, Repair, and Dataset Preparation

Seed/repair feature set:

- full demo seed for core entities
- week-specific and direct attendance seeding variants
- targeted data repair scripts for known dataset gaps
- Wi-Fi snapshot population for attendance simulation
- venue BSSID backfill utility

Use-case value:

- fast environment bring-up
- reproducible demos
- controlled restoration after data inconsistencies

## 4.7 Script-Based Validation and Diagnostics

Implemented diagnostics:

- attendance points unit tests
- feedback rollout end-to-end test
- weekly attendance logic verification script
- DB/session/attendance check scripts for quick triage

This provides lightweight QA coverage outside full CI pipelines.

## 5. Operational Runbook (Condensed)

Typical lifecycle:

1. run migrations in SQL editor or approved migration flow
2. seed baseline data when needed
3. start application server
4. start attendance worker process
5. confirm cron endpoint health and snapshot freshness
6. monitor reminder/rollout notification outputs
7. run diagnostic scripts for anomalies

## 6. Engineering Trade-offs

1. Script-heavy operations model

- Benefit: fast iteration and easy local control
- Trade-off: operational consistency depends on manual discipline

2. Cron endpoint orchestration in app layer

- Benefit: business logic stays near product code
- Trade-off: requires strong secret handling and uptime coordination

3. Self-healing attendance completion

- Benefit: reduces missed workflow transitions
- Trade-off: can mask upstream scheduling/scanner issues if not observed

4. Multiple narrow utility scripts

- Benefit: targeted fixes are quick
- Trade-off: script sprawl can cause overlap and maintenance drift

## 7. Gaps and Risks Observed

1. Secret exposure risk in utility scripts

- some scripts include hardcoded service credentials and should be rotated/removed.

2. Inconsistent table naming in scripts

- several scripts refer to enrollments while app runtime uses course_enrollments.

3. Status compatibility risk in seed scripts

- some seed logic uses status values like late that may not match active enums used by APIs.

4. Timezone handling variability

- cron and scripts use mixed timezone assumptions; this can affect edge-window processing.

5. Duplicate utility overlap

- multiple fix/seed scripts perform similar actions with slight variations, increasing accidental misuse risk.

## 8. Contribution to the Overall System

Part 7 enables operational continuity.

It turns the ERP from a purely request-response app into a system that:

- heals missed workflow transitions
- keeps attendance/feedback lifecycle moving in background
- supports fast environment setup and recovery
- provides practical diagnostics for administrators and developers

## 9. Part 7 Summary for Report Use

The automation and data-operations layer provides the runtime reliability infrastructure of the CIPD ERP. Through cron endpoints, worker processes, migrations, seed/repair scripts, and script-based diagnostics, it sustains attendance and communication workflows with minimal manual intervention. The layer is functionally strong, with key hardening priorities around secret hygiene, script consistency, and timezone-uniform execution.
