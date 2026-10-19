#!/usr/bin/env node

/**
 * Background Daily Student Digest Worker
 * ---------------------------------------
 * Runs as a daemon process and dispatches daily activity digest emails to
 * each student every night at 9:00 PM IST (21:00 IST / 15:30 UTC).
 *
 * Each student's email includes:
 *   1. Today's attendance per session (status, in-class duration, points)
 *   2. First entry of the day in session (earliest Wi-Fi check-in time and venue)
 *   3. Feedback forms status (submitted vs. pending with direct links)
 *
 * Usage:
 *   node scripts/daily-digest-worker.js                  # Run as daemon (checks every 30s)
 *   node scripts/daily-digest-worker.js --now            # Run immediately once and exit
 *   node scripts/daily-digest-worker.js --now --dry-run  # Dry-run test (no emails sent)
 *   node scripts/daily-digest-worker.js --now --test-email=name@example.com
 *
 * Or run in background via nohup / systemd:
 *   nohup node scripts/daily-digest-worker.js >> logs/daily-digest-worker.log 2>&1 &
 *
 * Environment:
 *   APP_URL        - Base URL of the Next.js app (default: http://localhost:3000)
 *   CRON_SECRET    - Must match the server's CRON_SECRET
 *   TARGET_HOUR    - Target hour in IST (default: 21 for 9 PM)
 *   TARGET_MINUTE  - Target minute in IST (default: 0)
 */

const path = require('path');
const fs = require('fs');

// Load environment from .env or .env.local
const envPath = path.resolve(__dirname, '..', '.env');
const envLocalPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || '';
const TARGET_HOUR = parseInt(process.env.DAILY_DIGEST_HOUR || '21', 10); // 21 = 9 PM IST
const TARGET_MINUTE = parseInt(process.env.DAILY_DIGEST_MINUTE || '0', 10);

const CHECK_INTERVAL_MS = 30 * 1000; // Check clock every 30 seconds
const STATE_FILE = path.resolve(__dirname, '..', '.daily-digest-state.json');

function timestamp() {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

function getISTClock() {
  const now = new Date();
  const istString = now.toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Example: "10/19/2026, 21:00:15"
  const [datePart, timePart] = istString.split(', ');
  const [mm, dd, yyyy] = datePart.split('/');
  const [hour, minute, second] = timePart.split(':').map(Number);
  const dateStr = `${yyyy}-${mm}-${dd}`;

  return {
    dateStr,
    hour,
    minute,
    second,
    raw: istString,
  };
}

function readLastRunDate() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return data.lastRunDate || null;
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

function saveLastRunDate(dateStr) {
  try {
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ lastRunDate: dateStr, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error(`[${timestamp()}] Failed to persist state file:`, err.message);
  }
}

/**
 * Triggers the daily student digest API endpoint.
 */
async function triggerDailyDigest(options = {}) {
  const { dryRun = false, testEmail, date } = options;
  const url = new URL(`${APP_URL}/api/cron/daily-student-digest`);

  if (dryRun) url.searchParams.set('dry_run', 'true');
  if (testEmail) url.searchParams.set('test_email', testEmail);
  if (date) url.searchParams.set('date', date);

  const headers = {
    'Content-Type': 'application/json',
  };
  if (CRON_SECRET) {
    headers['Authorization'] = `Bearer ${CRON_SECRET}`;
    headers['x-cron-secret'] = CRON_SECRET;
  }

  console.log(`[${timestamp()}] 🚀 Triggering daily digest via ${url.toString()}...`);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API returned HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  return result;
}

/**
 * Run single cycle with retries if failure occurs.
 */
async function executeDigestCycle(dateStr, options = {}) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      console.log(`[${timestamp()}] 📩 Running daily student digest cycle (Attempt ${attempt}/${maxRetries}) for date ${dateStr}...`);
      const result = await triggerDailyDigest({ ...options, date: dateStr });

      console.log(`[${timestamp()}] ✅ Daily student digest completed successfully:`);
      console.log(`   - Date: ${result.date} (${result.formattedDate})`);
      console.log(`   - Sessions scheduled: ${result.totalSessions}`);
      console.log(`   - Students targeted: ${result.totalStudents || 0}`);
      console.log(`   - Emails dispatched: ${result.sentCount}`);
      if (result.failedCount > 0) {
        console.warn(`   - Failed dispatches: ${result.failedCount}`);
        if (result.errors) {
          console.warn(`   - Errors:`, JSON.stringify(result.errors, null, 2));
        }
      }

      saveLastRunDate(dateStr);
      return result;
    } catch (err) {
      console.error(`[${timestamp()}] ❌ Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        console.log(`[${timestamp()}] ⏳ Waiting 60s before retry...`);
        await new Promise((r) => setTimeout(r, 60000));
      } else {
        console.error(`[${timestamp()}] 💥 All ${maxRetries} attempts exhausted for ${dateStr}.`);
        throw err;
      }
    }
  }
}

// ── CLI Arg Parsing ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isNow = args.includes('--now') || args.includes('-n');
const isDryRun = args.includes('--dry-run') || args.includes('-d');
const testEmailArg = args.find((a) => a.startsWith('--test-email='));
const testEmail = testEmailArg ? testEmailArg.split('=')[1] : null;
const dateArg = args.find((a) => a.startsWith('--date='));
const overrideDate = dateArg ? dateArg.split('=')[1] : null;

if (isNow) {
  const clock = getISTClock();
  const targetDate = overrideDate || clock.dateStr;
  console.log(`[${timestamp()}] Manual trigger requested for date: ${targetDate} (Dry-run: ${isDryRun})`);

  executeDigestCycle(targetDate, { dryRun: isDryRun, testEmail })
    .then(() => {
      console.log(`[${timestamp()}] Done.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[${timestamp()}] Process failed:`, err);
      process.exit(1);
    });
} else {
  // ── Daemon Mode ─────────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(' CiPD 360 Daily Student Digest Worker Daemon');
  console.log(` • Target Schedule: Every day at ${String(TARGET_HOUR).padStart(2, '0')}:${String(TARGET_MINUTE).padStart(2, '0')} IST (9:00 PM IST)`);
  console.log(` • Server Target:   ${APP_URL}`);
  console.log(` • Secret Guard:    ${CRON_SECRET ? 'Configured' : 'Not set (Dev mode)'}`);
  console.log('══════════════════════════════════════════════════════════════════');

  let lastRunDate = readLastRunDate();
  console.log(`[${timestamp()}] Daemon started. Last recorded run date: ${lastRunDate || 'None'}`);

  async function checkAndRun() {
    const clock = getISTClock();

    // Check if IST clock matches target hour and minute
    const isTargetTime = clock.hour === TARGET_HOUR && clock.minute === TARGET_MINUTE;
    const alreadyRunToday = lastRunDate === clock.dateStr;

    if (isTargetTime && !alreadyRunToday) {
      console.log(`[${timestamp()}] ⏰ 9:00 PM IST reached! Initiating nightly student digest...`);
      lastRunDate = clock.dateStr;

      try {
        await executeDigestCycle(clock.dateStr);
      } catch (err) {
        console.error(`[${timestamp()}] Nightly digest failed:`, err.message);
        // Reset lastRunDate so it can retry on next interval within the minute if needed
        lastRunDate = null;
      }
    }
  }

  // Initial check on startup
  checkAndRun();

  // Periodic clock check
  setInterval(checkAndRun, CHECK_INTERVAL_MS);
}
