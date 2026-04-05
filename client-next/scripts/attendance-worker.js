#!/usr/bin/env node

/**
 * Background Attendance Worker
 * 
 * Runs as a daemon process and calls the attendance processing
 * endpoint every 6 minutes — no browser needed.
 * 
 * Usage:
 *   node scripts/attendance-worker.js
 *   
 * Or run in background:
 *   nohup node scripts/attendance-worker.js >> logs/attendance-worker.log 2>&1 &
 * 
 * Environment:
 *   APP_URL     - Base URL of the Next.js app (default: http://localhost:3000)
 *   CRON_SECRET - Must match the server's CRON_SECRET (default: [REMOVED-ROTATED])
 */

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || '[REMOVED-ROTATED]';
const INTERVAL_MS = 6 * 60 * 1000; // 6 minutes

function timestamp() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

async function processAttendance() {
  console.log(`\n[${timestamp()}] Processing attendance...`);

  try {
    const res = await fetch(`${APP_URL}/api/cron/process-attendance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`[${timestamp()}] ✗ Error (${res.status}):`, data.error || data);
      return;
    }

    if (data.sessionsProcessed === 0) {
      console.log(`[${timestamp()}] — No active sessions right now`);
    } else {
      console.log(`[${timestamp()}] ✓ Processed ${data.sessionsProcessed} session(s):`);
      (data.results || []).forEach(r => {
        console.log(`    ${r.title} [${r.status}] — ${r.present} present, ${r.partial} partial (${r.snapshotsAnalyzed} snapshots)`);
      });
    }
  } catch (err) {
    console.error(`[${timestamp()}] ✗ Connection error:`, err.message);
    console.error(`    Is the Next.js server running at ${APP_URL}?`);
  }
}

// ── Main ──

console.log('╔═══════════════════════════════════════════╗');
console.log('║   CIPD Attendance Worker                  ║');
console.log('╠═══════════════════════════════════════════╣');
console.log(`║  Server:   ${APP_URL.padEnd(30)}║`);
console.log(`║  Interval: Every 6 minutes                ║`);
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
