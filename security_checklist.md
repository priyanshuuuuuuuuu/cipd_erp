# 🔐 CiPD 360 ERP — Pre-Deployment Security Checklist

> **Project:** CiPD 360 ERP (Next.js 14 App Router + Supabase + Custom JWT)  
> **Analysed:** `client-next/` · `RouterCodesForAttendance/` · all API routes  
> **Date:** June 2026

---

## Legend
| Symbol | Meaning |
|--------|---------|
| 🔴 **CRITICAL** | Must fix before deploying — exploitable right now |
| 🟠 **HIGH** | Fix before going live — significant risk |
| 🟡 **MEDIUM** | Fix soon after launch — notable but lower immediate risk |
| 🟢 **LOW** | Good practice / hardening |

---

## 1. 🔴 CRITICAL — Secrets Exposed in Source Files

### 1.1 Supabase Service Role Key Hard-Coded in Python Script
- **File:** [`RouterCodesForAttendance/wifi_monitor.py`](file:///d:/cipd_erp/RouterCodesForAttendance/wifi_monitor.py#L50-L55)
- **Finding:** The full `SUPABASE_KEY` (service role JWT) is hard-coded as a string literal directly in source code. This key **bypasses all Row-Level Security** and grants full database access.
- **Impact:** Anyone with repo access (or who finds the script) can read/write/delete all data.
- **Fix:**
  ```python
  # Replace hard-coded key with environment variable
  import os
  SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
  ```
  Load from a `.env` file using `python-dotenv` or a Windows Service environment variable.

---

### 1.2 Router Admin Password Hard-Coded in Python Script
- **File:** [`RouterCodesForAttendance/wifi_monitor.py`](file:///d:/cipd_erp/RouterCodesForAttendance/wifi_monitor.py#L43)
- **Finding:** `PASSWORD = "[REMOVED-ROTATED]"` — the physical WiFi router admin password is hard-coded.
- **Impact:** If this file leaks, an attacker can log into the router, intercept traffic, redirect DNS, disable monitoring.
- **Fix:** Read from environment variable: `PASSWORD = os.environ.get("ROUTER_PASSWORD")`.

---

### 1.3 Demo Panel Password Hard-Coded in Frontend (Same as Router Password)
- **File:** [`client-next/app/page.jsx`](file:///d:/cipd_erp/client-next/app/page.jsx#L228)
- **Finding:** `if (pwd === "[REMOVED-ROTATED]")` — the demo panel unlock password is the same string as the router admin password, embedded in client-side JavaScript that is **served to every visitor**.
- **Impact:** Anyone can view page source to get the router password.
- **Fix:** Remove the demo credentials panel entirely before production, or use a completely separate random string that bears no relation to any real system credential.

---

### 1.4 Live Credentials Exposed in Demo Credentials Array
- **File:** [`client-next/app/page.jsx`](file:///d:/cipd_erp/client-next/app/page.jsx#L68-L72)
- **Finding:** The `demoCredentials` array contains what appear to be real account emails and passwords (e.g., `admin@cipd.edu / admin123`, `faculty123`). These are sent to every browser as part of the JavaScript bundle.
- **Impact:** Any visitor can inspect the page and obtain working credentials.
- **Fix:** **Remove the demo panel entirely from the production build.** Use environment-based feature flags (`NEXT_PUBLIC_DEMO_MODE=false`) to strip it at build time.

---

### 1.5 `.env` File Contains All Production Secrets (Git Ignored, but…)
- **File:** [`client-next/.env`](file:///d:/cipd_erp/client-next/.env)
- **Finding:** Contains live Supabase URL, anon key, service role key, and a weak `JWT_SECRET` (`cipd360_erp_jwt_s3cr3t_k3y...`).
- **File:** [`client-next/.env.local`](file:///d:/cipd_erp/client-next/.env.local)  
- **Finding:** Contains Gmail `EMAIL_PASSWORD` (an App Password), `CRON_SECRET=[REMOVED-ROTATED]`, and full Google OAuth `CLIENT_SECRET`.
- **Impact:** If these files are ever accidentally committed (check `git log --all` for past commits), all secrets are permanently compromised.
- **Fix:**
  - Run `git log --all --full-history -- "**/.env*"` to verify no past commits contain these files.
  - Rotate **all secrets** listed below before launch:
    - Supabase Service Role Key (in Supabase dashboard → Settings → API)
    - JWT Secret (generate with `openssl rand -base64 64`)
    - Gmail App Password (revoke and regenerate)
    - Google OAuth Client Secret (regenerate in Google Cloud Console)
    - Cron Secret (use a randomly generated 32+ char string)

---

## 2. 🔴 CRITICAL — Authentication & Token Security

### 2.1 JWT Secret Too Weak & Has a Fallback in Code
- **File:** [`client-next/lib/auth.js`](file:///d:/cipd_erp/client-next/lib/auth.js#L4)
- **Finding:** `const JWT_SECRET = process.env.JWT_SECRET || '[REMOVED-ROTATED]';`
- **Impact:** If `JWT_SECRET` is missing at runtime, any token signed with `'[REMOVED-ROTATED]'` is accepted. Attacker can forge admin tokens trivially.
- **Fix:** Remove the fallback. Throw on missing secret:
  ```js
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not set');
  ```

### 2.2 JWT Tokens Stored in `localStorage` — XSS Risk
- **File:** [`client-next/lib/api.js`](file:///d:/cipd_erp/client-next/lib/api.js#L22-L26)
- **Finding:** All role tokens (`student_token`, `admin_token`, `faculty_token`) are stored in `localStorage`.
- **Impact:** Any XSS vulnerability (e.g., in a third-party library, user-generated content) allows an attacker to steal all tokens and impersonate any logged-in user.
- **Fix:** Store tokens in `HttpOnly` cookies (which are inaccessible to JavaScript). Note that the signup route already sets an `HttpOnly` cookie — **extend this pattern to the login route** and remove `localStorage` storage entirely from the client.

### 2.3 Long-Lived 7-Day JWT With No Revocation Mechanism
- **File:** [`client-next/lib/auth.js`](file:///d:/cipd_erp/client-next/lib/auth.js#L5)
- **Finding:** `TOKEN_EXPIRY = '7d'` — once issued, a token is valid for a full week with no server-side invalidation.
- **Impact:** Compromised tokens remain valid for up to 7 days. Deactivating a user account (`is_active = false`) does not invalidate existing tokens.
- **Fix:** Implement token revocation (e.g., a `token_version` counter in the DB that increments on logout/password change, and is validated on every request). Alternatively, shorten expiry to 1–2 hours and use refresh tokens.

### 2.4 No Rate Limiting on Login Endpoint
- **File:** [`client-next/app/api/auth/login/route.js`](file:///d:/cipd_erp/client-next/app/api/auth/login/route.js)
- **Finding:** No rate limiting, account lockout, or CAPTCHA on the login API.
- **Impact:** Brute-force attacks can test unlimited passwords against any account.
- **Fix:** Implement rate limiting using Vercel's edge middleware (e.g., `next-rate-limit` or Upstash Redis rate limiter). Lock accounts after N failed attempts.

### 2.5 Password Minimum Length is Only 6 Characters for Signup
- **File:** [`client-next/app/api/auth/signup/route.js`](file:///d:/cipd_erp/client-next/app/api/auth/signup/route.js#L38)
- **Finding:** `if (password.length < 6)` — signup allows 6-character passwords. Update-password route requires 8, creating an inconsistency.
- **Fix:** Enforce a minimum of **12 characters** on signup, with at least one uppercase, one number, and one symbol. Align both routes.

---

## 3. 🔴 CRITICAL — Google OAuth Security Flaw

### 3.1 OAuth `state` Parameter Not Validated (CSRF + User ID Spoofing)
- **File:** [`client-next/app/api/auth/google/callback/route.js`](file:///d:/cipd_erp/client-next/app/api/auth/google/callback/route.js#L34-L41)
- **Finding:** The `state` parameter is a base64-encoded JSON object `{ userId, role }` — but it is **never cryptographically signed or verified**. Any attacker can forge a `state` value with any `userId` and `role`.
- **Impact:** Attacker can construct a crafted OAuth URL, complete the flow, and link their Google account to any victim's ERP account (or escalate to admin role).
- **Fix:**
  1. When initiating the OAuth flow, generate a random CSRF token and store it server-side (session/cookie) along with the user ID.
  2. In the callback, verify the `state` matches the stored CSRF token before using any values from it.
  3. Never trust user-controlled data (`state`) for authorization decisions without server-side verification.

---

## 4. 🟠 HIGH — Missing HTTP Security Headers

### 4.1 No Security Headers Configured
- **File:** [`client-next/next.config.js`](file:///d:/cipd_erp/client-next/next.config.js)
- **Finding:** `const nextConfig = {};` — completely empty. No HTTP security headers are set.
- **Impact:** Exposes to clickjacking, MIME-type sniffing, content injection, and missing CSP.
- **Fix:** Add to `next.config.js`:
  ```js
  const securityHeaders = [
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    {
      key: 'Content-Security-Policy',
      value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; img-src 'self' data:; connect-src 'self' *.supabase.co;"
    },
  ];
  
  module.exports = {
    async headers() {
      return [{ source: '/(.*)', headers: securityHeaders }];
    },
  };
  ```

---

## 5. 🟠 HIGH — Cron Job Security

### 5.1 Weak & Predictable Cron Secret
- **File:** [`.env.local`](file:///d:/cipd_erp/client-next/.env.local#L11) + [`process-attendance/route.js`](file:///d:/cipd_erp/client-next/app/api/cron/process-attendance/route.js#L31)
- **Finding:** `CRON_SECRET=[REMOVED-ROTATED]` is guessable. The process-attendance route also has a **hardcoded fallback**: `const cronSecret = process.env.CRON_SECRET || '[REMOVED-ROTATED]'` — making the secret useless if the env var is missing.
- **Impact:** Anyone can trigger attendance processing, mark sessions completed, and send feedback emails to all students.
- **Fix:** 
  - Replace `CRON_SECRET` with a cryptographically random 32-byte hex string.
  - Remove the fallback value in the route file.
  - On Vercel, use the Vercel Cron job secret header pattern.

### 5.2 Cron Endpoint Uses `GET` for Destructive Action
- **File:** [`client-next/app/api/cron/process-attendance/route.js`](file:///d:/cipd_erp/client-next/app/api/cron/process-attendance/route.js#L29)
- **Finding:** The attendance processing cron uses `GET`, which can be triggered accidentally by search crawlers, browser prefetching, or link previews.
- **Fix:** Change to `POST` method.

---

## 6. 🟠 HIGH — Input Validation & Injection Risks

### 6.1 No Input Sanitization Before Database Queries
- **File:** Multiple API routes (e.g., [`admin/students/search/route.js`](file:///d:/cipd_erp/client-next/app/api/admin/students/search/route.js#L20))
- **Finding:** User input is passed directly into Supabase filter calls (`.ilike.%${q}%`). While Supabase's PostgREST parameterizes queries (preventing classic SQL injection), there is no length limit, no character validation, and no protection against ReDoS attacks on regex-backed filters.
- **Fix:** 
  - Add maximum length checks on all user-provided search parameters.
  - Validate format (allow only alphanumeric + spaces + common punctuation).
  - Cap all pagination parameters (`pageSize`) to a maximum value server-side.

### 6.2 No Limit on `pageSize` in WiFi Logs Endpoint
- **File:** [`client-next/app/api/admin/wifi-logs/route.js`](file:///d:/cipd_erp/client-next/app/api/admin/wifi-logs/route.js#L15)
- **Finding:** `const pageSize = parseInt(searchParams.get('pageSize') || '100');` — no maximum cap. An attacker (or compromised admin account) can request unlimited rows, causing memory exhaustion.
- **Fix:** Add: `const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '100'), 500);`

### 6.3 Feedback Submission Has No Array Size Limit
- **File:** [`client-next/app/api/feedback/submit/route.js`](file:///d:/cipd_erp/client-next/app/api/feedback/submit/route.js#L8)
- **Finding:** The `responses` array is not length-checked. A student could submit thousands of entries.
- **Fix:** Validate `responses.length <= MAX_QUESTIONS` before inserting.

---

## 7. 🟠 HIGH — Signup is Open (No Invite/Approval Flow)

- **File:** [`client-next/app/api/auth/signup/route.js`](file:///d:/cipd_erp/client-next/app/api/auth/signup/route.js)
- **Finding:** Anyone with the URL can self-register as a student and immediately get a JWT token. There is no email verification, admin approval, or domain restriction.
- **Impact:** The system could be flooded with fake accounts. Fake students could access course materials, submit feedback, and pollute the leaderboard.
- **Fix (choose one based on need):**
  1. Add email domain restriction (`@cipd.edu` or `@iiitd.ac.in` only).
  2. Add email verification step before activating the account (`is_active = false` until email confirmed).
  3. Admin-invite-only registration flow.

---

## 8. 🟡 MEDIUM — Supabase Row-Level Security (RLS)

### 8.1 RLS Status Unknown — Critical for `supabase` (Anon Key) Client
- **File:** [`client-next/lib/supabase.js`](file:///d:/cipd_erp/client-next/lib/supabase.js)
- **Finding:** The project uses **two** Supabase clients: the anon-key client (`supabase`) and the service-role client (`supabaseAdmin` — bypasses RLS). All API routes currently use `supabaseAdmin`, which is correct server-side. However, if the anon-key client is ever used directly (e.g., in client components), RLS policies must be properly configured.
- **Action:** Verify in Supabase Dashboard → Authentication → Policies that:
  - `users` table: students cannot read other students' `password_hash`, `email`, etc.
  - `attendance_records`: students can only see their own records.
  - `feedback_responses`: students cannot read other students' responses.
  - `wifi_snapshots`: should be restricted to admin/service role only.
  - `students` MAC address: should not be readable by other students.

### 8.2 `google_tokens` Table Stores Raw OAuth Access Tokens in DB
- **File:** [`client-next/app/api/auth/google/callback/route.js`](file:///d:/cipd_erp/client-next/app/api/auth/google/callback/route.js#L59-L68)
- **Finding:** `access_token` and `refresh_token` from Google are stored as plaintext in the `google_tokens` table.
- **Impact:** A database breach exposes tokens that allow Google Classroom access on behalf of all connected users.
- **Fix:** Encrypt tokens at rest before storing (AES-256 with a server-side encryption key stored in env, not the DB).

---

## 9. 🟡 MEDIUM — Information Leakage

### 9.1 Detailed Error Messages Exposed to Clients
- **Files:** Multiple API routes (e.g., [`admin/reports/route.js`](file:///d:/cipd_erp/client-next/app/api/admin/reports/route.js#L81))
- **Finding:** `return NextResponse.json({ error: error.message }, { status: 500 })` — raw database error messages (including schema/column info) are returned to the client.
- **Fix:** Return a generic message to clients; log the real error server-side only:
  ```js
  console.error('Internal error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  ```

### 9.2 WiFi Logs Return MAC Addresses and Device Info to Admin
- **File:** [`client-next/app/api/admin/wifi-logs/route.js`](file:///d:/cipd_erp/client-next/app/api/admin/wifi-logs/route.js#L86)
- **Finding:** Raw MAC addresses, device names, and signal data are exposed to the admin panel. While admins need this, ensure this data is not cached or logged by any CDN.
- **Fix:** Set `Cache-Control: no-store, private` on all API responses that contain PII.

### 9.3 `db.txt` File in Repository
- **File:** [`client-next/db.txt`](file:///d:/cipd_erp/client-next/db.txt)
- **Finding:** Full database schema (all table names, column names, data types) committed to the repository.
- **Impact:** Gives attackers a complete map of your database structure.
- **Fix:** Delete this file and add `db.txt` to `.gitignore`. Keep schema documentation private.

---

## 10. 🟡 MEDIUM — WiFi Monitor Security (RouterCodesForAttendance)

### 10.1 Router Accessed Over Plain HTTP
- **File:** [`wifi_monitor.py`](file:///d:/cipd_erp/RouterCodesForAttendance/wifi_monitor.py#L42)
- **Finding:** `ROUTER_URL = "http://192.168.0.1"` — plain HTTP, no TLS.
- **Impact:** Router admin password and WiFi client data transmitted in cleartext on the local network.
- **Note:** Many router admin panels don't support HTTPS. If yours does, enable it. If not, ensure the monitoring machine is on an isolated VLAN.

### 10.2 Chrome `--ignore-certificate-errors` Flag
- **File:** [`wifi_monitor.py`](file:///d:/cipd_erp/RouterCodesForAttendance/wifi_monitor.py#L103)
- **Finding:** `options.add_argument("--ignore-certificate-errors")` disables all TLS verification in the headless browser.
- **Fix:** Only apply this flag if absolutely necessary for the router's self-signed cert. Use `--ignore-certificate-errors-spki-list=<fingerprint>` to pin the specific cert instead.

### 10.3 Nmap Network Scan Runs as SYSTEM
- **File:** [`wifi_monitor.py`](file:///d:/cipd_erp/RouterCodesForAttendance/wifi_monitor.py#L298-L325)
- **Finding:** `nmap -sn 192.168.0.0/24` runs with full `SYSTEM` privileges (since the script installs as a Windows Service).
- **Fix:** Create a dedicated low-privilege service account. Grant only the specific permissions needed (raw socket access if required by nmap, but not SYSTEM).

---

## 11. 🟡 MEDIUM — Dependency Security

### 11.1 Run a Dependency Audit
- **File:** [`client-next/package.json`](file:///d:/cipd_erp/client-next/package.json)
- **Action:** Run:
  ```powershell
  cd client-next
  npm audit
  npm audit fix
  ```
- Check specifically:
  - `jsonwebtoken` (CVEs exist in older versions — ensure `^9.0.3` is latest)
  - `next` (ensure `^14.2.0` is fully patched — Next.js has had path traversal CVEs)
  - `nodemailer` (check for known SMTP injection issues)
  - `xlsx` (has known prototype pollution CVEs — confirm if used in production or dev only)

### 11.2 `pdf-parse` and `xlsx` Listed Under `devDependencies` but May Run Server-Side
- **File:** [`client-next/package.json`](file:///d:/cipd_erp/client-next/package.json#L23-L26)
- **Finding:** These libraries are under `devDependencies` but may be imported in server routes. If they are, they should be in `dependencies` — and ensure they are not exposed to user-uploaded file parsing without sandboxing.

---

## 12. 🟢 LOW — Hardening & Best Practices

### 12.1 No `next/headers`-Based Middleware for Route Protection
- **Finding:** Route protection is implemented per-route via `withAuth`/`withRole` HOCs. There is no top-level Next.js `middleware.ts` that guards entire route groups (e.g., all `/admin/*` routes).
- **Risk:** A developer adding a new route under `/admin` might forget to add `withRole`.
- **Fix:** Add a `middleware.ts` at the project root that enforces auth for `/admin`, `/faculty`, and `/dashboard` route groups via JWT verification on every request.

### 12.2 Logging to Console (Not a Structured Logger)
- **Finding:** All logging uses `console.error()` / `console.log()`. On Vercel, these go to function logs but are not structured or filterable.
- **Fix:** Add a lightweight structured logger (e.g., `pino`) with log levels and context fields.

### 12.3 No CORS Configuration
- **Finding:** No explicit CORS headers are set on API routes. Next.js defaults to same-origin. Verify this is correct for your deployment.
- **Action:** If any external service or mobile app needs to call these APIs, configure explicit CORS headers.

### 12.4 Missing `Logout` Token Invalidation
- **File:** `app/api/auth/logout/` (directory exists but not inspected)
- **Action:** Verify the logout route clears cookies server-side. Since tokens are stored in localStorage client-side, confirm the client-side cleanup in `api.js` is complete.

### 12.5 `.env` in Root `.gitignore` is Correct — Verify It Works
- **Action:** Run `git check-ignore -v client-next/.env client-next/.env.local` to confirm both files are actually ignored.

### 12.6 `schema.sql` and `schema.txt` Committed to Repo
- **Files:** `client-next/schema.sql`, `client-next/schema.txt`
- **Risk:** Full database schema is committed to the repo.
- **Fix:** Add to `.gitignore` or move to private documentation.

---

## Summary — Priority Action Plan

| # | Priority | Action | File(s) |
|---|----------|--------|---------|
| 1 | 🔴 NOW | Remove Supabase service key from `wifi_monitor.py` | `wifi_monitor.py` |
| 2 | 🔴 NOW | Remove demo credentials panel from login page | `app/page.jsx` |
| 3 | 🔴 NOW | Rotate ALL secrets (JWT, Supabase, Gmail, Google OAuth, Cron) | `.env`, `.env.local` |
| 4 | 🔴 NOW | Fix OAuth `state` parameter CSRF vulnerability | `google/callback/route.js` |
| 5 | 🔴 NOW | Remove `[REMOVED-ROTATED]` from auth.js | `lib/auth.js` |
| 6 | 🟠 HIGH | Add rate limiting to login endpoint | `auth/login/route.js` |
| 7 | 🟠 HIGH | Migrate JWT tokens from localStorage to HttpOnly cookies | `lib/api.js`, `lib/auth.js` |
| 8 | 🟠 HIGH | Add security headers to `next.config.js` | `next.config.js` |
| 9 | 🟠 HIGH | Add email verification or domain restriction to signup | `auth/signup/route.js` |
| 10 | 🟠 HIGH | Fix cron secret fallback + change GET to POST | `cron/process-attendance/route.js` |
| 11 | 🟡 SOON | Verify Supabase RLS policies are configured correctly | Supabase Dashboard |
| 12 | 🟡 SOON | Encrypt OAuth tokens at rest in `google_tokens` table | `google/callback/route.js` |
| 13 | 🟡 SOON | Delete `db.txt`, `schema.sql`, `schema.txt` from repo | Repo cleanup |
| 14 | 🟡 SOON | Run `npm audit` and fix vulnerabilities | `package.json` |
| 15 | 🟢 LATER | Add top-level Next.js `middleware.ts` for route group protection | New file |
| 16 | 🟢 LATER | Add `Cache-Control: no-store` on all PII-containing API responses | All API routes |
