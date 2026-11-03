import crypto from 'node:crypto';
import { connection } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { qid, HttpError } from '@/lib/sql-ident';
import { getAccountContext, invalidateAccountCache } from '@/lib/accounts';
import { queueSetPasswordEmail } from '@/lib/student-service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_RATE = 2000;

/**
 * Add a faculty member to a RUNNING cohort. One global account per person: if the email already belongs to a faculty
 * account (taught in another cohort) it is reused; otherwise a new account with a random password is created and a
 * set-password email is queued. Membership + users + faculty rows are written in one transaction.
 */
export async function createFaculty(cohort, { firstName, lastName, email, designation, yearsExperience }) {
  if (!cohort || cohort.status !== 'running') throw new HttpError(409, 'Faculty can only be added to a running cohort.');
  const addr = String(email || '').trim().toLowerCase();
  if (!firstName?.trim() || !lastName?.trim() || !addr) throw new HttpError(400, 'First name, last name, and email are required.');
  if (!EMAIL_RE.test(addr)) throw new HttpError(400, 'Invalid email address.');

  const schema = qid(cohort.schema_name);
  const out = await connection.begin(async (tx) => {
    let [account] = await tx`
      SELECT id, email, password_hash, role, first_name, last_name, is_active
        FROM core.accounts WHERE lower(email) = ${addr} AND merged_into IS NULL`;
    let created = false;
    if (account) {
      if (account.role !== 'faculty') throw new HttpError(409, `A ${account.role} account already uses this email.`);
      const ctx = await getAccountContext(account.id);
      if (ctx?.memberships.some((m) => m.cohort_id === cohort.id)) throw new HttpError(409, 'A user with this email already exists in this cohort.');
    } else {
      const hash = await hashPassword(crypto.randomBytes(24).toString('base64url'));
      [account] = await tx`
        INSERT INTO core.accounts (id, email, password_hash, role, first_name, last_name)
        VALUES (${crypto.randomUUID()}, ${addr}, ${hash}, 'faculty', ${firstName.trim()}, ${lastName.trim()})
        RETURNING id, email, password_hash, role, first_name, last_name, is_active`;
      created = true;
    }

    await tx`INSERT INTO core.cohort_memberships (account_id, cohort_id, status) VALUES (${account.id}, ${cohort.id}, 'active')`;
    await tx.unsafe(
      `INSERT INTO ${schema}.users (id, email, password_hash, role, first_name, last_name, is_active, cohort_id)
       VALUES ($1, $2, $3, 'faculty', $4, $5, true, $6)`,
      [account.id, account.email, account.password_hash, firstName.trim(), lastName.trim(), cohort.id]);
    await tx.unsafe(
      `INSERT INTO ${schema}.faculty (id, designation, years_experience, honorarium_rate_per_hour) VALUES ($1, $2, $3, $4)`,
      [account.id, designation?.trim() || null, yearsExperience ? parseInt(yearsExperience, 10) : null, DEFAULT_RATE]);
    if (created) await queueSetPasswordEmail(tx, cohort, account);
    return { id: account.id, created };
  });
  invalidateAccountCache();
  return out;
}
