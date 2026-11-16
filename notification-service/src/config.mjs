import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '../client-next/.env.local'), override: false });
dotenv.config({ path: resolve(process.cwd(), '../client-next/.env'), override: false });

const required = ['DATABASE_URL', 'EMAIL_FROM', 'EMAIL_PASSWORD'];
for (const key of required) {
  if (!process.env[key]) throw new Error(key + ' is required.');
}

const sender = process.env.EMAIL_FROM.trim().toLowerCase();
if (sender !== 'cipd@iiitd.ac.in') {
  throw new Error('EMAIL_FROM must be cipd@iiitd.ac.in.');
}

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  sender,
  appUrl: (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, ''),
  port: Number(process.env.PORT || 3100),
  workerIntervalMs: Math.max(10000, Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS || 30000)),
  serviceToken: process.env.NOTIFICATION_SERVICE_TOKEN || process.env.CRON_SECRET || '',
  sandbox: process.env.NOTIFICATION_SANDBOX_MODE === 'true',
  unrestrictedTestCohort: (() => {
    try { const url = new URL(process.env.DATABASE_URL); return process.env.NOTIFICATION_TEST_COHORT_UNRESTRICTED === 'true' && url.hostname === '192.168.3.190' && url.pathname === '/cipd_test'; }
    catch { return false; }
  })(),
  sandboxRecipients: new Set(
    (process.env.NOTIFICATION_SANDBOX_RECIPIENTS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  ),
};

if (config.sandbox && config.sandboxRecipients.size === 0) {
  throw new Error('Sandbox mode requires NOTIFICATION_SANDBOX_RECIPIENTS; no mail will be sent.');
}
