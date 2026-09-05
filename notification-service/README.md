# CiPD Notification Service

A standalone delivery microservice for the CiPD notification stream.

The Next.js application only writes jobs to the `july.notification_stream` outbox.
This service owns SMTP delivery, retry backoff, delivery history, and stream operations.

## Run locally

1. Apply `../client-next/scripts/migration_notification_stream.sql` in Supabase.
2. Copy `.env.example` to `.env` and provide the required secure values.
3. Install and start:

```powershell
cd notification-service
npm install
npm run dev
```

## Management endpoints

- `GET /health` — service health and queue counts
- `GET /messages?limit=50` — stream history
- `POST /drain` — process queued messages immediately
- `POST /messages/:id/retry` — retry a failed message

All management endpoints except `/health` require:

```
Authorization: Bearer NOTIFICATION_SERVICE_TOKEN
```

In sandbox mode, feedback messages go exclusively to the configured sandbox recipients.

