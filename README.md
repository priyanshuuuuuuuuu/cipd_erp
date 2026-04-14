# CiPD ERP Portal

## Getting Started

### 1. Start the Next.js App

```bash
cd client-next
npm install
npm run dev
```

App runs at `http://localhost:3000`

---

### 2. Start the Attendance Worker

The **Attendance Worker** is a background process that automatically processes student attendance every 6 minutes using WiFi snapshots. It runs independently — no browser needed.

**What it does:**
- Detects all ongoing/recently-ended sessions for today
- Fetches WiFi snapshots within each session's time window (start → end + 2 min buffer)
- Rejects devices with signal strength ≤ 2
- Counts how many distinct snapshots each student appears in (pings)
- Marks students as `present` (≥ 3 pings), `partial`, or `absent`
- Writes results to `attendance_records` table in Supabase

**Start (foreground):**

```bash
cd client-next
npm run attendance-worker
```

**Start (background — persists after terminal closes):**

```bash
cd client-next
mkdir -p logs
nohup npm run attendance-worker >> logs/attendance-worker.log 2>&1 &
```

**Check logs:**

```bash
tail -f client-next/logs/attendance-worker.log
```

**Stop background worker:**

```bash
# Find the process
ps aux | grep attendance-worker

# Kill it
kill <PID>
```

**Environment variables** (in `client-next/.env`):

| Variable | Default | Description |
|---|---|---|
| `CRON_SECRET` | `[REMOVED-ROTATED]` | Auth token for the cron endpoint |
| `APP_URL` | `http://localhost:3000` | Base URL of the Next.js app |

> **Note:** The worker requires the Next.js app to be running. Start the app first, then the worker.

---

## Architecture

### Live Students Page (`/admin/live-students`)
- Shows the latest WiFi snapshot in real-time
- Timer syncs to the last snapshot's timestamp (refreshes at `captured_at + 6 min`)
- **No background worker needed** — works on page open

### Attendance Page (`/admin/attendance`)
- Shows computed attendance records per session
- For ongoing sessions: displays live updates with countdown timer
- **Requires the background worker** to keep `attendance_records` up-to-date automatically
