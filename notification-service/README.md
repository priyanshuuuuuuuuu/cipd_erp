# CiPD Notification Service

A standalone delivery service for the CiPD notification stream. It runs on the college VM and reads
the outbox directly from the VM PostgreSQL (`DATABASE_URL`). **Supabase is not used.**

The Next.js application only writes jobs to `"<cohort schema>".notification_stream`. This service owns
SMTP delivery, retry backoff, delivery history and stream operations, and serves **every running
cohort** (`core.cohorts WHERE status = 'running'`; before the core migration it serves the single active
cohort of the legacy `public.cohorts` registry).

## Configuration

Required: `DATABASE_URL`, `EMAIL_FROM` (must be `cipd@iiitd.ac.in`), `EMAIL_PASSWORD`.
Optional: `PORT` (3100), `NOTIFICATION_WORKER_INTERVAL_MS`, `NOTIFICATION_SERVICE_TOKEN` (falls back to
`CRON_SECRET`), `APP_URL` (used to build password-reset links when a message has no `resetUrl`),
`NOTIFICATION_SANDBOX_MODE`, `NOTIFICATION_SANDBOX_RECIPIENTS`.

Env files are read from `./.env`, `../client-next/.env` and `../client-next/.env.local`.

## Run

```bash
cd notification-service
npm ci
npm start        # or: npm run dev
```

Production runs under PM2 (`cipd-notify`); see `.github/workflows/deploy.yml`.

## Behaviour

- Claims messages with `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)`, so several workers are safe.
- Messages stuck in `processing` for more than 15 minutes are returned to `retry`.
- Retry backoff: 1 min doubling up to 30 min; `failed` after 6 attempts.
- **Sandbox mode**: only messages addressed to `NOTIFICATION_SANDBOX_RECIPIENTS` are claimed. Everything else stays
  queued and untouched (it is not burned as a failure).

## Management endpoints

- `GET /health` – service health and queue counts per cohort
- `GET /messages?limit=50&schema=<cohort>&status=<status>` – stream history (all running cohorts by default)
- `POST /drain` – process queued messages immediately
- `POST /messages/:schema/:id/retry` – retry a failed message

All endpoints except `/health` require `Authorization: Bearer <NOTIFICATION_SERVICE_TOKEN>`.

## Expiring a stale backlog (one-off, owner decision)

Before turning sandbox mode off for the first time on the VM, check what is queued:

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3100/messages?status=queued"
node scripts/expire-stale.mjs --schema junedecember2026 --before 2026-10-25 --dry-run
# if the owner agrees:
node scripts/expire-stale.mjs --schema junedecember2026 --before 2026-10-25
```

This marks old `queued`/`retry` messages `failed` with `last_error='expired_before_vm_cutover'`.
Note: some queued messages have event types this service does not send (for example `weekly_schedule`);
those end up `failed` with "Unsupported event".
