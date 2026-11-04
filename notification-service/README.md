# CiPD Notification Service

A standalone delivery microservice for the CiPD notification stream powered by Drizzle ORM and PostgreSQL.

The Next.js application writes jobs to the `notification_stream` outbox in each cohort schema.
This service owns SMTP delivery, retry backoff, delivery history, multi-cohort stream polling, and stream operations.

## Run locally

1. Ensure PostgreSQL is configured with `DATABASE_URL` in `.env`.
2. Copy `.env.example` to `.env` (or let it auto-inherit from `../client-next/.env`).
3. Install dependencies and start:

```bash
cd notification-service
npm install
npm run dev # or npm start
```

## Management Endpoints

- `GET /health?schema=<cohort>` — service health and queue counts across active or specified cohort
- `GET /messages?limit=50&schema=<cohort>` — stream history
- `POST /drain` — process queued messages immediately (optional `{ "limit": 20, "schema": "<cohort>" }`)
- `POST /messages/:id/retry` — reset and retry a failed or retry-status message

All management endpoints except `/health` require:

```
Authorization: Bearer NOTIFICATION_SERVICE_TOKEN
```

Supported event types:
- `feedback_available`
- `feedback_reminder`
- `password_reset`
- `attendance_summary`
- `weekly_schedule`
- `general_notification`
- `class_reminder`
- `day_before_reminder`
- `daily_digest`
