#!/usr/bin/env node

/**
 * Background Attendance Worker
 * 
 * Runs as a daemon process and calls the attendance processing
 * endpoint every 6 minutes — no browser needed.
 * 
 * Retry logic:
 *   If a cycle returns 0 sessions processed (during class hours 8AM-6PM),
 *   it retries immediately once. If the retry also fails or returns 0,
 *   an alert email is sent to admin contacts.
 * 
 * Usage:
 *   node scripts/attendance-worker.js
 *   
 * Or run in background:
 *   nohup node scripts/attendance-worker.js >> logs/attendance-worker.log 2>&1 &
 * 
 * Environment:
 *   APP_URL        - Base URL of the Next.js app (default: http://localhost:3000)
 *   CRON_SECRET    - Must match the server's CRON_SECRET (default: cipd-attendance-cron-2026)
 *   EMAIL_FROM     - Gmail address for sending alerts
 *   EMAIL_PASSWORD - Gmail app password
 */

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'cipd-attendance-cron-2026';
const INTERVAL_MS = 6 * 60 * 1000; // 6 minutes

const ALERT_RECIPIENTS = ['aaman23006@iiitd.ac.in'];

// Track state across cycles
let lastAlertSentAt = 0;
let lastSnapshotTimestamp = null; // Track previous cycle's latest snapshot
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // Don't send more than 1 alert per 5 minutes

function timestamp() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function isClassHours() {
  const now = new Date();
  const hour = now.getHours();
  // Only consider it a failure if we're between 8 AM and 6 PM (class hours)
  return hour >= 8 && hour <= 18;
}

/**
 * Send alert email using nodemailer directly
 */
async function sendAlertEmail(reason, details) {
  // Cooldown check
  if (Date.now() - lastAlertSentAt < ALERT_COOLDOWN_MS) {
    console.log(`[${timestamp()}] ⏳ Alert suppressed (cooldown active, last sent ${Math.round((Date.now() - lastAlertSentAt) / 60000)}m ago)`);
    return;
  }

  const emailFrom = process.env.EMAIL_FROM;
  const emailPass = process.env.EMAIL_PASSWORD;

  if (!emailFrom || !emailPass) {
    console.error(`[${timestamp()}] ⚠ Cannot send alert email — EMAIL_FROM or EMAIL_PASSWORD not set`);
    return;
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailFrom, pass: emailPass },
    });

    const now = new Date();
    const timeStr = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' });

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:24px 28px;border-radius:16px 16px 0 0;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1.5px;">⚠️ SYSTEM ALERT</p>
          <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">Attendance Worker Failure</p>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px 28px;border-radius:0 0 16px 16px;">
          <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">
            The attendance processing worker failed to retrieve new data after <strong>two consecutive attempts</strong>.
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr>
              <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #f3f4f6;">Time</td>
              <td style="padding:8px 12px;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6;">${timeStr}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #f3f4f6;">Reason</td>
              <td style="padding:8px 12px;font-size:13px;color:#dc2626;font-weight:600;border-bottom:1px solid #f3f4f6;">${reason}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #f3f4f6;">Server</td>
              <td style="padding:8px 12px;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6;">${APP_URL}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#6b7280;">Details</td>
              <td style="padding:8px 12px;font-size:12px;color:#6b7280;font-family:monospace;">${details || 'N/A'}</td>
            </tr>
          </table>
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
            Please check the Wi-Fi scanner hardware, network connectivity, and the Next.js server status.
            This alert won't repeat for 5 minutes.
          </p>
        </div>
        <p style="text-align:center;font-size:10px;color:#d1d5db;margin-top:16px;">CiPD 360 Attendance Worker · Automated Alert</p>
      </div>`;

    await transporter.sendMail({
      from: `"CiPD 360 Alert" <${emailFrom}>`,
      to: ALERT_RECIPIENTS.join(', '),
      subject: `⚠️ Attendance Worker Failure — ${timeStr}`,
      html,
    });

    lastAlertSentAt = Date.now();
    console.log(`[${timestamp()}] 📧 Alert email sent to: ${ALERT_RECIPIENTS.join(', ')}`);
  } catch (emailErr) {
    console.error(`[${timestamp()}] ✗ Failed to send alert email:`, emailErr.message);
  }
}

/**
 * Call the cron endpoint once. Returns { ok, sessionsProcessed, error, data }
 */
async function callCronEndpoint() {
  try {
    const res = await fetch(`${APP_URL}/api/cron/process-attendance`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
    });

    const data = await res.json();

    if (!res.ok) {
      return { ok: false, sessionsProcessed: 0, error: data.error || `HTTP ${res.status}`, data };
    }

    return { ok: true, sessionsProcessed: data.sessionsProcessed || 0, data };
  } catch (err) {
    return { ok: false, sessionsProcessed: 0, error: err.message, data: null };
  }
}

/**
 * Main processing cycle with retry logic
 */
async function processAttendance() {
  console.log(`\n[${timestamp()}] Processing attendance...`);

  // ── Attempt 1 ──
  const attempt1 = await callCronEndpoint();

  if (!attempt1.ok) {
    console.error(`[${timestamp()}] ✗ Attempt 1 failed:`, attempt1.error);

    // ── Immediate Retry ──
    console.log(`[${timestamp()}] 🔄 Retrying immediately...`);
    const attempt2 = await callCronEndpoint();

    if (!attempt2.ok) {
      console.error(`[${timestamp()}] ✗ Attempt 2 also failed:`, attempt2.error);
      if (isClassHours()) {
        await sendAlertEmail(
          'Connection failed on both attempts',
          `Attempt 1: ${attempt1.error} | Attempt 2: ${attempt2.error}`
        );
      }
      return;
    }

    // Retry succeeded
    logSuccess(attempt2);
    return;
  }

  // Attempt 1 succeeded, but check if 0 sessions processed during class hours
  if (attempt1.sessionsProcessed === 0 && isClassHours()) {
    console.log(`[${timestamp()}] — No active sessions found. Retrying once to confirm...`);

    // Wait 10 seconds before retry (data might still be propagating)
    await new Promise(r => setTimeout(r, 10000));

    const attempt2 = await callCronEndpoint();

    if (!attempt2.ok) {
      console.error(`[${timestamp()}] ✗ Retry failed:`, attempt2.error);
      await sendAlertEmail(
        'Retry after 0-sessions also failed',
        `Attempt 1: 0 sessions | Attempt 2 error: ${attempt2.error}`
      );
      return;
    }

    if (attempt2.sessionsProcessed === 0) {
      // Both attempts returned 0 during class hours — alert
      console.log(`[${timestamp()}] ⚠ Both attempts returned 0 sessions during class hours`);
      await sendAlertEmail(
        'No sessions processed in 2 consecutive attempts during class hours',
        `Both attempts at ${timestamp()} returned 0 sessions. Wi-Fi scanner may be offline or no sessions scheduled.`
      );
      return;
    }

    // Retry got data
    logSuccess(attempt2);
    return;
  }

  // Normal success path
  logSuccess(attempt1);
}

/**
 * Check if the latest snapshot timestamp is unchanged from last cycle
 */
async function checkSnapshotStaleness(result) {
  const currentSnapshot = result.data?.latestSnapshotAt || null;

  if (!currentSnapshot) {
    // No snapshots at all — could be fresh DB
    return;
  }

  if (lastSnapshotTimestamp && currentSnapshot === lastSnapshotTimestamp && isClassHours()) {
    console.log(`[${timestamp()}] ⚠ Stale data: latest snapshot unchanged (${currentSnapshot})`);
    await sendAlertEmail(
      'Wi-Fi scanner data is stale — no new snapshots',
      `Latest snapshot timestamp is stuck at: ${currentSnapshot}. No new Wi-Fi data since last cycle. Scanner may be offline or disconnected.`
    );
  } else if (currentSnapshot !== lastSnapshotTimestamp) {
    console.log(`[${timestamp()}] 📡 New snapshot: ${currentSnapshot}`);
  }

  lastSnapshotTimestamp = currentSnapshot;
}

function logSuccess(result) {
  if (result.sessionsProcessed === 0) {
    console.log(`[${timestamp()}] — No active sessions right now`);
  } else {
    console.log(`[${timestamp()}] ✓ Processed ${result.sessionsProcessed} session(s):`);
    (result.data?.results || []).forEach(r => {
      console.log(`    ${r.title} [${r.status}] — ${r.present} present, ${r.partial} partial (${r.snapshotsAnalyzed} snapshots)`);
    });
  }

  // Also check staleness on any successful response
  checkSnapshotStaleness(result);
}

// ── Main ──

console.log('╔═══════════════════════════════════════════╗');
console.log('║   CIPD Attendance Worker  (v2 + retry)    ║');
console.log('╠═══════════════════════════════════════════╣');
console.log(`║  Server:   ${APP_URL.padEnd(30)}║`);
console.log(`║  Interval: Every 6 minutes                ║`);
console.log(`║  Retry:    Immediate retry on failure      ║`);
console.log(`║  Alerts:   ${ALERT_RECIPIENTS.join(', ').slice(0, 30).padEnd(30)}║`);
console.log(`║  Started:  ${timestamp().padEnd(30)}║`);
console.log('╚═══════════════════════════════════════════╝');
console.log('');
console.log('Press Ctrl+C to stop.\n');

// Run immediately, then every 6 minutes
processAttendance();
const interval = setInterval(processAttendance, INTERVAL_MS);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n[${timestamp()}] Stopping attendance worker...`);
  clearInterval(interval);
  process.exit(0);
});

process.on('SIGTERM', () => {
  clearInterval(interval);
  process.exit(0);
});
