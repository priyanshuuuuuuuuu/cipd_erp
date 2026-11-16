# CiPD 360 regression test report

**Run date** 16 November 2026 (IST)  
**Deployment checked** `http://ipdcp-erp.iiitd.edu.in/`  
**Baseline source** `7682793`, Next.js 14.2.35, Chrome, PostgreSQL 18.1

The initial deployment check found public pages served over HTTP and no reachable HTTPS connection on port 443. The authenticated regression and the continuation ran on a local production build with synthetic admin, faculty and student accounts. The continuation exercised PostgreSQL, the standalone notification worker, a local SMTP sink, a simulated Wi-Fi snapshot feed and a simulated Google provider.

## Local fixes and verification

| Finding | Verified local result |
|---|---|
| Automatic attendance rejected the worker's request | The cron accepts a valid Bearer token or `x-cron-secret` at one entry point. A Bearer-only request can complete snapshot scoring and backfill; a missing secret still gets `401`. |
| Cancelled sessions received attendance | The cron excludes cancelled sessions. Admin and faculty attendance details reject cancelled sessions before scoring. Opening a future session no longer records absences. |
| Attendance used the wrong time on an IST-configured server | Session windows use the campus clock or absolute timestamps. The cron distinguishes recently ended classes from overdue backfill regardless of server time zone. |
| Both manual email retry routes failed | Both route forms requeue a retryable job in the correct running cohort and clear the attempt counter. A local SMTP delivery confirmed the retry. |
| Faculty self-service reset link contained `token=undefined` | The reset endpoint queues a JSON object. The worker can also deliver valid older jobs stored as JSON strings. The local reset email changes the faculty password and the new password signs in. |
| Wi-Fi slot Excel export returned `500` | The production build loads the workbook library correctly. The Excel file opens with an Attendance Grid worksheet, and CSV and JSON still work. |
| Student Attendance failed to hydrate | Responsive styles are served as CSS instead of an HTML-escaped inline stylesheet. Chrome renders the seeded attendance history on direct navigation without a hydration error. |
| Fresh migrations stopped partway | The migration runner supplies missing bootstrap prerequisites for empty databases. Fresh migration, a repeat run, an existing fixture database and schema drift checks passed. |
| Account forms had accessibility issues | Account pages now have associated labels, headings and main landmarks. Recovery text has stronger contrast, and the reset password visibility buttons have accessible names. |

The final production build passed. The three-role integration suite passed all 97 checks. The assignment and faculty leave suite passed all 37 checks, and all 39 protected-page browser checks passed. The separate IST clock and notification sandbox checks passed, along with 21 cohort lifecycle cases and 18 attendance scoring cases. All 10 account-page views passed the automated accessibility checks in desktop and mobile Chrome. [Build log](../.next/regression-2026-11-16/fixed-build-final.log) · [Integration log](../.next/regression-2026-11-16/fixed-integration-final.log) · [Role and browser log](../.next/regression-2026-11-16/fixed-role-browser-final.log) · [Migration log](../.next/regression-2026-11-16/fixed-migrate-final.log) · [Accessibility log](../.next/regression-2026-11-16/fixed-accessibility-final.log)

This fix pass ran locally. Google Classroom, Google sign-in, and deployed HTTPS were outside its scope. Wi-Fi capture from physical hardware and external email delivery still require an integration environment.

## Initial findings

### P1 — Live login is served over HTTP and HTTPS is unreachable

- **Affected roles** Admin, faculty and students.
- **Reproduce** Request the public root over HTTP, then request the same host over HTTPS. Assess the protocol before submitting the form.
- **Expected** A valid HTTPS endpoint with HTTP redirected to it before users reach the sign-in form.
- **Observed** HTTP returned `200 OK` and served the login form directly. The HTTPS request could not connect to port 443. The account form posts to a relative endpoint, so the page protocol also governs the credential request.
- **Impact** Users can reach sign-in over an unencrypted connection. This blocked authenticated live regression testing in this run. [Login request code](../client-next/app/contexts/AuthContext.js#L62)

### P2 — Wi-Fi slot Excel export returns HTTP 500

- **Affected role and environment** Admin, reproduced in the local production build with a loopback Wi-Fi fixture.
- **Reproduce** Open Admin → Reports and request the Wi-Fi slot **Download Excel** export. The request uses `/api/admin/reports/wifi-slots?format=xlsx`.
- **Expected** An `.xlsx` workbook containing the Attendance Grid.
- **Observed** The route returned `500` with `Cannot read properties of undefined (reading 'utils')`. JSON and CSV returned successfully with the same fixture. The production compiler also reported that `xlsx` has no default export, which matches the failing `XLSX.utils` call. [Wi-Fi export handler](../client-next/app/api/admin/reports/wifi-slots/route.js#L204)

### P2 — Student Attendance reports hydration errors on direct load

- **Affected role and environment** Student, reproduced twice in Chrome on the local production build.
- **Reproduce** Sign in as a student, then directly open or reload `/attendance` with the browser console open.
- **Expected** The server-rendered page hydrates without errors.
- **Observed** Chrome recorded React production errors `#425`, `#418`, and `#423` on direct navigation. The page displayed content after React recovered. The attendance summary API returned `200`. [Attendance page](../client-next/app/attendance/page.jsx)

### P2 — Fresh-database migrations stop after partially applying

- **Affected environment** Fresh local PostgreSQL installation. The migration documentation describes starting from an existing database or restored copy.
- **Reproduce** Run `npm run migrate` against an empty PostgreSQL database. Use a disposable database.
- **Expected** The database initializes, or the runner reports the prerequisites before partially applying migrations.
- **Observed** `0001_core_registry.sql` applied, then migration `0002_identity.sql` failed with PostgreSQL error `42704` because `core.user_role` did not exist. After supplying the four enum definitions, the runner also reported that the registered `july` and `junedecember2026` schemas were absent. With the enums and empty schemas provided as fixtures, migrations completed and drift checks passed. [Core registry migration](../client-next/migrations/core/0001_core_registry.sql#L45) · [Identity migration](../client-next/migrations/core/0002_identity.sql#L6)

### P3 — Account pages lack form label associations and accessibility landmarks

- **Affected pages** Sign-in, sign-up, forgot-password and reset-password.
- **Reproduce** Inspect the live form markup on `/`, `/signup` and `/forgot-password`. Run axe in Chrome on all four public pages in the local production build at mobile or desktop width.
- **Expected** Inputs have explicitly associated labels. Each screen provides a primary heading and main landmark. Text and links meet contrast requirements.
- **Observed** Sign-in and sign-up render visible labels without input associations. The password-recovery email field relies on placeholder text. On the local build, axe reported missing main landmarks and level-one headings on all four pages. It flagged low contrast on the forgot-password **Back to login** link and text on the reset-password page without a token. [Sign-in form](../client-next/app/page.jsx#L154) · [Sign-up form](../client-next/app/signup/page.jsx#L225) · [Forgot-password form](../client-next/app/forgot-password/page.jsx#L24)

## Coverage

| Area | Result |
|---|---|
| Public deployment | `/`, `/signup`, `/forgot-password` and `/reset-password` returned `200`. All 11 Next.js scripts and stylesheets referenced by the login page returned `200`. Signed-out `/api/auth/me` returned `401`. The live browser navigation returned `ERR_BLOCKED_BY_CLIENT` in the test browser, so rendered browser checks used the local build. |
| Local public browser | Four routes at 1366 px and 390 px. Eight views rendered without horizontal overflow or uncaught JavaScript exceptions during the observation window. Accessibility findings are above. |
| Build and lint | Local production build completed with the Excel import warning. Lint exited successfully with 196 warnings. |
| Attendance scoring | 18 existing checks passed, including arrival and duration scoring, attendance status, and ongoing-session behavior. |
| Cohorts and account lifecycle | 21 existing checks passed, including provisioning, cohort access, password change, transfers, archived read-only behavior, backup and deletion. With the legacy fixtures in place, schema drift reported zero differences for the two archived cohorts. |
| Local workflows | 37 passed and 1 failed. Verified role login, wrong-password handling, selected admin, faculty and student reads, role boundaries, disconnected Classroom behavior, an in-app assignment notification, PDF submission and grading, and faculty leave approval. Excel export failed as reported above. |
| Local signed-out requests | Seven representative protected endpoints returned `401`, including admin, student, faculty and Classroom endpoints. The retired notification cron endpoint returned its documented `410`. |
| Local signed-in browser | Admin, student and faculty each reached the correct landing page after submitting the login form. Of 39 protected page smoke checks, 38 passed and 1 failed. The student Attendance hydration error is listed above. |

## Findings from the local continuation

### P1 — The bundled worker cannot run automatic attendance

- **Reproduce** Call `GET /api/cron/process-attendance` with the configured secret using the bundled worker's Bearer header. Repeat with only the `x-cron-secret` header from the verification guide.
- **Expected** The worker processes each running cohort and reports the actual result.
- **Observed** The Bearer-only request gets `401`. The `x-cron-secret`-only request gets `200` with `Unauthorized` inside the cohort result and processes zero sessions. Supplying both headers in the local harness allowed the downstream scoring checks to proceed. [Bundled worker](../client-next/scripts/attendance-worker.js#L134) · [Cron route](../client-next/app/api/cron/process-attendance/route.js#L251)

### P2 — Cancelled sessions receive attendance records

- **Reproduce** Schedule and cancel a class whose time window includes the current time. Provide snapshots showing a verified enrolled device, then invoke the attendance cron with both headers. The scheduled control class uses the same time window.
- **Expected** The active scheduled class records partial attendance. The cancelled class has zero attendance records.
- **Observed** The scheduled control recorded partial attendance, and the cancelled class also received an attendance record. The active-session query and filter include cancelled classes. [Active-session filter](../client-next/app/api/cron/process-attendance/route.js#L30)

### P2 — Attendance uses the wrong class time on an IST-configured server

- **Reproduce** Start the app with `TZ=Asia/Kolkata`, invoke the attendance cron and compare the returned cohort time with the campus clock.
- **Expected** The returned time matches IST, regardless of host time zone.
- **Observed** The cron reported `00:09` when campus time was `18:39`. It adds 5 hours 30 minutes and then reads host-local clock fields, applying the offset twice. The scheduled local control processed under a UTC-configured app. [Attendance clock](../client-next/app/api/cron/process-attendance/route.js#L25)

### P2 — Operators cannot manually retry failed email delivery

- **Reproduce** In the standalone service, stop delivery with a local SMTP failure, reach the sixth attempt and retry the failed notification through each advertised route.
- **Expected** The failed job moves back to `queued` with its attempt counter reset.
- **Observed** The documented `/messages/<schema>/<id>/retry` route gives `404`. The implemented `/messages/<id>/retry` route gives `400` because the handler passes the message ID where the service expects the schema. The normal automatic retry recovered after a temporary failure. [Retry route](../notification-service/src/server.mjs#L48) · [Retry function](../notification-service/src/stream.mjs#L216)

### P2 — Faculty self-service password reset sends an unusable link

- **Reproduce** Request a faculty password reset from Forgot Password and drain the outbox into local SMTP.
- **Expected** The delivered reset link contains a usable token.
- **Observed** The queue stored the payload as a JSON string and the delivered link contained `token=undefined`. The admin-issued reset produced a valid email; its link changed the password and the new password could log in. [Self-service reset](../client-next/app/api/auth/forgot-password/route.js#L41) · [Email worker](../notification-service/src/stream.mjs#L136)

### P2 — Google Classroom shifts midnight assignment deadlines

- **Reproduce** Connect a Classroom fixture with an assignment due at `00:00` UTC and load pending assignments as the student.
- **Expected** The assignment retains a deadline of `2099-10-04T00:00:00.000Z`.
- **Observed** The API returns `2099-10-04T23:59:00.000Z`. Zero-valued hours and minutes are replaced by defaults, so overdue filtering can keep the assignment visible for almost a day longer. [Due-time conversion](../client-next/app/api/classroom/assignments/route.js#L127)

### P2 — Google Classroom omits assignments on later course pages

- **Reproduce** Return a course list with a `nextPageToken` and place a published pending assignment in a course on the second page.
- **Expected** The dashboard includes the pending assignment.
- **Observed** The route requests the first page and ignores the page token. The assignment from the second page is missing. [Course list call](../client-next/app/api/classroom/assignments/route.js#L70)

## Local continuation coverage

**106 checks across three runs.** The main run in a freshly migrated fixture database finished with 96 passed and 8 failed. The notification sandbox check passed. The separate IST clock check failed. The nine failures represent the seven continuation findings above. [Main test log](../.next/regression-2026-11-16/continuation-clean.log) · [Notification sandbox log](../.next/regression-2026-11-16/continuation-sandbox.log) · [IST clock log](../.next/regression-2026-11-16/continuation-clock.log)

| Workflow | Result |
|---|---|
| Notifications | Admin targeting, student opt-out and read state, faculty module permissions and send history, stand-alone queue delivery to local SMTP, concurrent drains, automatic retry, terminal failure, stale-lock recovery, and sandbox recipient filtering passed. Both manual retry routes failed. |
| Wi-Fi attendance | MAC registration and approval, student signal and missing device, provider outage handling, and rerun idempotency passed. With both headers supplied, the scoring fixture produced Present 5 points, Absent −2, Leave 0, and no row for an unverified MAC. Admin, faculty and student views agreed on Present. The normal worker request, cancelled-class case, and IST clock case failed. |
| Feedback and scheduled email | Attendance completion queued feedback for an eligible student. Eligibility, one-time submission, deadline, admin analytics, the four-hour feedback reminder, next-day class reminder, and daily digest passed. Email was captured at the local SMTP sink. |
| Google Classroom | Mock-provider OAuth callback, consent cancellation, pending assignment filtering, empty state, provider errors, token refresh and revocation, and student dashboard rendering passed. Midnight deadline and course pagination failed. |
| Student, faculty and admin workflows | Signup and duplicate handling, password change, logout, faculty payout profile, admin-issued password reset, student leave approval, session scheduling and rescheduling, enrollment changes, signed course material download, attendance override, reporting, and program/course/faculty setup passed. Faculty self-service password reset failed. |
| Reports and read APIs | All five CSV reports and the student Excel workbook passed. The separate Wi-Fi slot Excel failure from the initial pass remains open. The continuation also exercised admin, faculty and student read APIs against seeded records. |
| Browser | Verified live data in the local admin notification history, faculty session detail and materials, student Classroom dashboard, and student notification feed. The previously untested faculty index redirect also passed. |

## Scope and remaining coverage

- **Blocked for real integration verification.** Google consent and IIIT Delhi Google sign-in against real accounts, Gmail authentication and external mailbox delivery, and physical router scanner capture and delivery to Supabase require their respective test services or hardware. The fixtures exercised the application's handling of these provider interfaces locally.
- **Untested combinations.** The runs cover the page inventory at smoke-test depth, representative API reads and writes, key cross-role flows, and selected failures. Browser/OS combinations beyond Chrome, every input and API method permutation, and migration against a production-sized restored database remain unverified.
- **Test isolation.** The initial direct-reminder and digest attempts reached Gmail because the compiled app used a bundled mail transport. Gmail rejected the synthetic login before sending. The final suite routed both mail paths to local SMTP and blocked external connections in the test servers. The supplied account credentials were not used.
