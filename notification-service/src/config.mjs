import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '../client-next/.env'), override: false });
dotenv.config({ path: resolve(process.cwd(), '../client-next/.env.local'), override: false });

const required = ['SUPABASE_SERVICE_ROLE_KEY', 'EMAIL_FROM', 'EMAIL_PASSWORD'];
for (const key of required) {
  if (!process.env[key]) throw new Error(key + ' is required.');
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.');

const sender = process.env.EMAIL_FROM.trim().toLowerCase();
if (sender !== 'cipd@iiitd.ac.in') {
  throw new Error('EMAIL_FROM must be cipd@iiitd.ac.in.');
}

export const config = {
  supabaseUrl,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  schema: process.env.SUPABASE_SCHEMA || 'july',
  sender,
  port: Number(process.env.PORT || 3100),
  workerIntervalMs: Math.max(10000, Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS || 30000)),
  serviceToken: process.env.NOTIFICATION_SERVICE_TOKEN || process.env.CRON_SECRET || '',
  sandbox: process.env.NOTIFICATION_SANDBOX_MODE === 'true',
  sandboxRecipients: new Set(
    (process.env.NOTIFICATION_SANDBOX_RECIPIENTS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  ),
};

