import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check notification-service/.env first
dotenv.config({ path: resolve(__dirname, '../.env') });
// Check client-next/.env
dotenv.config({ path: resolve(__dirname, '../../client-next/.env'), override: false });
dotenv.config({ path: resolve(__dirname, '../../client-next/.env.local'), override: false });
// Check process.cwd() locations
dotenv.config({ path: resolve(process.cwd(), '.env'), override: false });
dotenv.config({ path: resolve(process.cwd(), '../client-next/.env'), override: false });

const required = ['DATABASE_URL', 'EMAIL_PASSWORD'];
for (const key of required) {
  if (!process.env[key]) throw new Error(key + ' environment variable is required.');
}

const sender = (process.env.EMAIL_FROM || 'cipd@iiitd.ac.in').trim().toLowerCase();

const DEFAULT_SANDBOX_RECIPIENTS = [
  'priyanshupandey18112005@gmail.com',
  'p18nov2005@gmail.com',
  'parsh23368@iiitd.ac.in',
  'mayank23315@iiitd.ac.in',
  'parshjain.j@gmail.com',
  'parshslox@gmail.com',
  'chuhanmayank865@gmail.com',
  'aaman23006@iiitd.ac.in',
  'aamanprime@gmail.com',
  'karan23271@iiitd.ac.in',
  'aamanprime.1@gmail.com',
  'aamanprime.2@gmail.com',
  'aamanprime.3@gmail.com',
  'aamanprime.4@gmail.com',
];

const parsedRecipients = (process.env.NOTIFICATION_SANDBOX_RECIPIENTS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  defaultSchema: process.env.DB_SCHEMA || process.env.SUPABASE_SCHEMA || 'july',
  sender,
  port: Number(process.env.PORT || 3100),
  workerIntervalMs: Math.max(10000, Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS || 30000)),
  serviceToken: process.env.NOTIFICATION_SERVICE_TOKEN || process.env.CRON_SECRET || '',
  sandbox: process.env.NOTIFICATION_SANDBOX_MODE === 'true',
  sandboxRecipients: new Set(parsedRecipients.length ? parsedRecipients : DEFAULT_SANDBOX_RECIPIENTS),
};
