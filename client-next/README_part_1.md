# Part 1 - Authentication and User Management (BTP Deep Analysis)

## 1. Scope and Objective

This document provides a deep system-level analysis of the Authentication and User Management module in the CIPD 360 Next.js ERP.

Primary objective of this module:

- Establish identity (login/signup)
- Maintain role-aware session state across the UI
- Protect backend routes using JWT-based authorization
- Provide user profile and settings persistence
- Support account security actions (password change)
- Support Google OAuth token linking for downstream academic integrations

This part focuses on implemented features and architectural behavior, not code quality review.

## 2. Files Analyzed (Complete Coverage for Part 1)

### 2.1 Frontend Entry and Session Layer

- app/layout.jsx
- app/providers.js
- app/contexts/AuthContext.js

### 2.2 Authentication UI

- app/page.jsx
- app/signup/page.jsx
- app/Login.css
- app/globals.css

### 2.3 User Management UI

- app/profile/page.jsx
- app/settings/page.jsx
- app/Dashboard.css

### 2.4 Shared Auth UI Components

- app/components/Button.jsx
- app/components/CardContainer.jsx
- app/components/EmailLabelText.jsx
- app/components/ForgotPasswordText.jsx
- app/components/InputField.jsx
- app/components/PasswordLabelText.jsx
- app/components/SubBrandText.jsx
- app/components/WelcomeText.jsx

### 2.5 Backend Auth APIs

- app/api/auth/login/route.js
- app/api/auth/signup/route.js
- app/api/auth/me/route.js
- app/api/auth/logout/route.js
- app/api/auth/update-password/route.js
- app/api/auth/google/connect/route.js
- app/api/auth/google/callback/route.js

### 2.6 Backend User Management APIs

- app/api/students/profile/route.js
- app/api/students/settings/route.js
- app/api/students/mac/route.js

### 2.7 Shared Backend Services

- lib/api.js
- lib/auth.js
- lib/middleware.js
- lib/supabase.js

### 2.8 Database/Schema References Used

- schema.txt
- scripts/migration_phase2_columns.sql
- scripts/settings_migration.sql
- scripts/seed.sql
- db.txt

## 3. Module Purpose in the Overall System

Authentication and User Management is the system gatekeeper and identity substrate.

It provides:

- Role-aware identity: student, admin, faculty
- Stateless API authorization through bearer JWT
- Frontend session restoration from browser storage
- Personalization persistence (notifications and appearance preferences)
- Device identity registration for attendance (MAC registration + verification lifecycle)
- Integration token attachment for Google-enabled workflows

Without this module, all other modules (attendance, schedule, feedback, reports, classroom) cannot safely execute role-specific behavior.

## 4. Functional Understanding (End-to-End Flows)

## 4.1 Login Flow (Email or Enrollment No.)

User flow:

1. User lands on app/page.jsx.
2. User enters identifier and password.
3. UI calls AuthContext.login(identifier, password).
4. AuthContext sends POST /api/auth/login.
5. Backend resolves user:
   - Email path: users table lookup
   - Enrollment path: students join users
6. Backend verifies password hash with bcrypt.
7. Backend signs JWT payload with role and identity fields.
8. Frontend stores token in role-scoped localStorage key:
   - student_token or admin_token or faculty_token
9. User is redirected:
   - admin -> /admin
   - non-admin -> /dashboard

Important implemented behavior:

- Identifier supports both email and enrollment number for students.
- Demo credential panel exists in login UI with gated visibility and one-click auto-login.

## 4.2 Signup Flow (Student Self-Registration)

User flow:

1. User opens app/signup/page.jsx.
2. User submits firstName, lastName, email, password, confirmPassword.
3. Client validates required fields, password match, min length.
4. UI sends POST /api/auth/signup.
5. Backend checks email uniqueness in users table.
6. Password is hashed with bcrypt.
7. users row is inserted with role=student.
8. Enrollment number is generated (CiPD_n pattern) by scanning existing student enrollment values.
9. students row is upserted with generated enrollment and mac_verified=false.
10. JWT is created and returned.
11. UI stores token/user in legacy localStorage keys and redirects to /dashboard after success card.

Distinct user-facing outcome:

- Enrollment number is generated and shown immediately after account creation.

## 4.3 Session Restore and Multi-Role Separation

At application start (AuthProvider effect):

1. URL path is inspected (/admin, /faculty, else student).
2. Matching role storage keys are checked first.
3. If not found, falls back to other roles.
4. If still not found, falls back to legacy token/user keys.

Why this matters:

- Allows multiple tabs with different active roles in same browser.
- Prevents cross-role accidental session takeover.

## 4.4 Protected User Profile Retrieval

User flow:

1. Profile page loads and calls /api/students/profile.
2. API wrapper attaches bearer token automatically.
3. Backend withAuth validates token.
4. Data returned by joining users + students slices.
5. UI renders personal and academic identity metadata.

## 4.5 Settings and Preference Persistence

User flow:

1. Settings page calls GET /api/students/settings and GET /api/students/profile.
2. Notification and appearance preferences are read from users.preferences JSONB.
3. Toggles/theme/font controls issue PATCH /api/students/settings.
4. Backend deep-merges partial preference updates into existing JSON.
5. UI reflects instant local state and backend persistence.

## 4.6 Password Change Flow

User flow:

1. Settings account section collects current and new password.
2. UI calls POST /api/auth/update-password.
3. Backend validates token, verifies current hash, blocks same-password reuse, hashes new password, updates users.password_hash.
4. Success toast shown in UI.

## 4.7 MAC Registration and Verification Lifecycle

User flow:

1. Settings Device section accepts MAC input with strict format normalization.
2. UI calls PATCH /api/students/mac.
3. Backend writes students.mac_address and resets students.mac_verified=false.
4. UI shows pending status until admin approval occurs.
5. Client periodically refreshes profile status (polling + tab visibility refresh).

Purpose in system:

- Links user identity to network device identity for attendance module automation.

## 4.8 Google OAuth Connect Callback Linking

User flow:

1. Authenticated user calls GET /api/auth/google/connect.
2. Backend constructs Google consent URL with encoded state (userId + role).
3. Google redirects to /api/auth/google/callback.
4. Callback exchanges code for tokens.
5. Access/refresh token are upserted in google_tokens storage.
6. User is redirected back to role-appropriate settings/dashboard with status query.

This flow is an integration bridge for classroom-related backend modules.

## 5. UI and Component Design Analysis

## 5.1 Login Page (app/page.jsx)

Visual/functional structure:

- Full-screen branded background image with glassmorphism card
- Identifier input (email or enrollment)
- Password input with show/hide eye toggle
- Error banner for auth failures
- CTA login button
- Demo access floating panel (password-gated)

Interaction patterns:

- Optimistic loading state during login
- Explicit role-based redirect after successful auth
- Auto-login from demo cards for rapid role switching

## 5.2 Signup Page (app/signup/page.jsx)

Visual/functional structure:

- Reuses login visual language and card container
- Student registration form
- Client-side validation before API call
- Enrollment ID success panel after account creation

Interaction patterns:

- Error-first validation flow
- Success state temporarily replaces form
- Time-delayed redirect to dashboard

## 5.3 Profile Page (app/profile/page.jsx)

User management role in this page:

- Identity display and student account context
- Combined overview of profile, attendance, assignments, feedback
- User-controlled logout from sidebar

State patterns:

- activeTab state controls sub-views
- Promise.allSettled aggregation of profile-related datasets
- loading skeleton placeholder for smooth first paint

## 5.4 Settings Page (app/settings/page.jsx)

User management role in this page:

- Core account operations (profile metadata, password change)
- Preference storage (notifications/appearance)
- Device identity registration (MAC)
- Privacy/security section and sign-out actions

Unique logic:

- MAC status polling every 20s while pending verification
- Auto-refresh on tab visibility return
- Deep partial preference updates mapped to backend JSON storage

## 5.5 Shared Component Layer

Primary role:

- Lightweight auth-specific presentational primitives for consistent login/signup branding
- Most logic remains in pages; components are mostly styling wrappers

Observations:

- app/page.jsx currently directly uses native input controls for identifier/password and does not use all label/input components uniformly.
- Component design is intentionally simple, enabling rapid visual iteration.

## 6. Data Flow Analysis (Critical)

## 6.1 Token and Identity Flow

Frontend:

- AuthContext stores user + token in memory.
- localStorage stores role-scoped credentials.

Transport:

- lib/api.js reads route context and attaches Authorization: Bearer token.

Backend:

- lib/middleware.withAuth -> lib/auth.getUserFromRequest -> jwt.verify.
- req.user payload is attached and used in handlers.

Persistence:

- JWT is not session-backed server-side; authorization is stateless per request.

## 6.2 Signup Data Flow

Input:

- firstName, lastName, email, password, optional programName

Processing:

- validate -> hash -> insert users -> generate enrollment -> upsert students -> sign token

Output:

- token
- user payload
- enrollment number

## 6.3 Settings Preference Flow

Input:

- PATCH body with partial notifications/appearance keys

Processing:

- fetch current preferences -> deep merge top-level sections -> update users.preferences JSONB

Output:

- updated merged preference object

## 6.4 MAC Registration Flow

Input:

- mac_address in XX:XX:XX:XX:XX:XX format

Processing:

- regex validation -> uppercase normalization -> write students.mac_address -> reset students.mac_verified false

Output:

- saved mac + verification false state

## 6.5 Google OAuth Token Flow

Input:

- authorization code + state

Processing:

- decode state -> token exchange -> conditional refresh token handling -> upsert google_tokens

Output:

- role-based redirect with success/error flag

## 7. API and Backend Logic (Detailed)

## 7.1 Authentication Endpoints

### POST /api/auth/login

Auth:

- Public endpoint

Request:

- identifier (email or enrollment)
- password

Core logic:

- Branch lookup by identifier type
- Password verification with bcrypt
- JWT signing with role metadata

Response:

- token
- user payload (id/email/role/name)

### POST /api/auth/signup

Auth:

- Public endpoint

Request:

- firstName, lastName, email, password, optional programName

Core logic:

- Validate input
- Ensure email uniqueness
- Insert users row
- Generate enrollment ID
- Upsert students row
- Rollback users insert if student profile write fails

Response:

- token
- user payload
- enrollmentNo

### GET /api/auth/me

Auth:

- Bearer token required

Core logic:

- Resolve base user
- Enrich by role-specific table (students or faculty)

Response:

- consolidated user profile

### POST /api/auth/logout

Auth:

- Not token-validated in handler

Core logic:

- Clears token cookie in response

Note:

- Frontend primarily relies on localStorage token clearing for effective logout.

### POST /api/auth/update-password

Auth:

- withAuth protected

Core logic:

- Validate current/new password
- Verify current hash
- Block same password reuse
- Hash and store new password

Response:

- success message

### GET /api/auth/google/connect

Auth:

- withAuth protected

Core logic:

- Generate consent URL with scoped state

Response:

- { url }

### GET /api/auth/google/callback

Auth:

- OAuth callback endpoint

Core logic:

- Handle denial/errors/missing params
- Exchange code for tokens
- Upsert google_tokens
- Redirect by role and status

## 7.2 User Management Endpoints

### GET /api/students/profile

Auth:

- withAuth protected

Core logic:

- Fetch users identity row
- Fetch students row
- Return merged profile
- Returns no-store headers to avoid stale MAC status

### GET /api/students/settings

Auth:

- withAuth protected

Core logic:

- Read users.preferences JSON
- Merge defaults to guarantee full shape

### PATCH /api/students/settings

Auth:

- withAuth protected

Core logic:

- Accept only notifications and appearance keys
- Deep-merge partial updates into stored JSON
- Write back to users.preferences and updated_at

### PATCH /api/students/mac

Auth:

- withAuth protected

Core logic:

- Validate MAC format
- Save uppercase MAC
- Reset verification state

## 8. State Management Analysis

## 8.1 Global Auth State (AuthContext)

State variables:

- user
- token
- loading

Actions:

- login(identifier, password)
- logout()

Derived state:

- authReady = !loading

Session behavior:

- Restores role-scoped credentials based on current URL role context.

## 8.2 Page-Level State

Login page:

- identifier, password, showPassword, error, isLoading, demoVisible

Signup page:

- form object, error, isLoading, successData

Profile page:

- activeTab, profile, attendance, assignments, feedback, loading

Settings page:

- activeSection
- profile and fetch loaders
- macInput, macSaving, macMsg, showMac, statusRefreshing
- notifSettings
- theme/font
- pwForm and pwMsg
- prefSaving/prefMsg

Pattern summary:

- Local React state drives UI responsiveness.
- API persistence is explicit and imperative.
- No global cache/query library is used for this module.

## 9. Database Interaction and Inferred Model

## 9.1 Primary Tables Used by Part 1

- users
  - identity and security: email, password_hash, role, first_name, last_name, is_active
  - personalization: preferences JSONB (introduced via migration)

- students
  - student extension: enrollment_no, program_name, device_hash, mac_address, mac_verified

- faculty
  - used by /auth/me enrichment for faculty role

- google_tokens (inferred operational table)
  - stores access/refresh credentials and expiry for Google integration
  - referenced by callback and classroom module routes

## 9.2 Relationships

- students.id references users.id (1:1 role extension)
- faculty.id references users.id (1:1 role extension)
- auth identity starts at users, then role-specific enrichment joins extension tables.

## 9.3 Schema Evolution Signals Relevant to This Module

- scripts/migration_phase2_columns.sql adds users.preferences JSONB for settings persistence.
- scripts/seed.sql includes seeded users/students with mac fields.
- settings migration and attendance migrations establish configuration and MAC-attendance context.

## 10. Engineering Decisions and Trade-Offs (BTP-Oriented)

## 10.1 Role-Scoped localStorage Tokens

Decision:

- Store per-role tokens instead of one global token.

Benefit:

- Enables concurrent student/admin/faculty sessions in different tabs.

Trade-off:

- More client logic complexity and potential inconsistencies with legacy key fallback.

## 10.2 Bearer Header Auth over Cookie-Centric Auth

Decision:

- API authorization uses Authorization header from frontend helper.

Benefit:

- Explicit and role-sensitive identity transmission.

Trade-off:

- Requires all protected calls to use helper correctly; direct fetch calls must add header manually.

## 10.3 Stateless JWT with Middleware Wrappers

Decision:

- withAuth/withRole wrappers for consistent authorization guard.

Benefit:

- Centralized and reusable access control pattern.

Trade-off:

- Revocation/session invalidation depends on token expiry and client cleanup strategy.

## 10.4 JSONB-Based Preferences

Decision:

- Store notification/appearance preferences in users.preferences JSONB.

Benefit:

- Flexible schema for evolving UI settings.

Trade-off:

- Validation and shape guarantees must be enforced in app logic.

## 10.5 MAC Verification as Two-Step Process

Decision:

- Student submits MAC, admin verifies later.

Benefit:

- Prevents self-trusting attendance identity.

Trade-off:

- Introduces pending state and UX delay; requires polling/refresh logic.

## 10.6 OAuth Token Upsert

Decision:

- Persist Google tokens per user with refresh token preservation behavior.

Benefit:

- Supports long-lived integration without repeated user consent.

Trade-off:

- Requires secure token storage model and migration presence for google_tokens.

## 11. Edge Cases, Conditional Paths, and Special Logic

Implemented edge handling includes:

- Login invalid credentials and inactive account block
- Signup duplicate email handling and rollback on partial failure
- Password update rejects incorrect current and same-as-old new password
- Settings preference API rejects unknown top-level update keys
- MAC format strict validation and uppercase normalization
- Profile API marked no-store to avoid stale verification status
- OAuth callback handles denied access, invalid state, missing tokens
- Auto-clear local credentials and redirect on API 401 in helper

## 12. Notable Integration Observations (System Context)

These are architecture-level observations useful for BTP discussion:

1. app/profile/page.jsx calls /api/students/feedback/history, but no matching route handler was found in app/api/students for this path in current snapshot.
2. Signup writes legacy localStorage keys (token/user), while login uses role-scoped keys through AuthContext.
3. Signup response sets cookie token, but server auth helpers are currently header-focused.
4. google_tokens table is referenced in runtime routes but was not found in analyzed schema.txt/scripts subset for Part 1.

These observations indicate ongoing transition from earlier auth/storage patterns to newer role-scoped bearer strategy.

## 13. Performance and Scalability Considerations (As Implemented)

- Most auth/user APIs are lightweight single-user lookups/updates.
- Settings page does polling every 20s only while MAC is pending; bounded conditional polling minimizes constant load.
- Promise.allSettled in profile page allows partial data render when one endpoint fails.
- no-store on profile route avoids stale status but increases backend hit frequency when repeatedly opened.

## 14. Module Contribution to Overall ERP

Authentication and User Management contributes the following foundational capabilities:

- Identity and access boundary for all other modules
- Role-aware navigation and authorization routing
- Persistent user personalization and account controls
- Device identity bridge required for attendance automation
- OAuth credential bridge required for classroom integration

In system terms, this module is both:

- A control plane (who can do what), and
- A profile substrate (who the user is, and how their client behavior should be configured).

## 15. Part 1 Summary for BTP Report

If this module is described in the report, it should be presented as a hybrid identity subsystem combining:

- JWT-based stateless backend authorization
- Role-scoped client session management
- User profile/settings persistence in Supabase
- Security operations (password update, logout)
- Device and OAuth credential binding for downstream functional modules

This architecture enables modular expansion of attendance, feedback, scheduling, and classroom workflows while keeping identity and authorization centralized.
