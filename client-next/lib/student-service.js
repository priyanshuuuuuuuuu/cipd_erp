import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { connection } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { qid, HttpError } from '@/lib/sql-ident';
import { getAccountContext, invalidateAccountCache } from '@/lib/accounts';

/**
 * Student lifecycle. Every function runs in ONE transaction, takes cohort schemas only from core.cohorts
 * (never from client input) and is enforced by the database as well (users_membership_fk, CHECKs, unique indexes).
 *
 * Model: one person = one canonical core.accounts row. Joining a cohort = a membership + a users row + a students
 * row in that cohort's schema, all keyed by the canonical account id. History is never deleted by a transfer.
 */

const MAC_RE = /^([A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JOINABLE = new Set(['running', 'provisioning']);

/** Join the caller's transaction (savepoint) when given one, otherwise open our own. */
function inTx(tx, fn) {
  return tx ? tx.savepoint(fn) : connection.begin(fn);
}

async function loadCohort(q, cohortId) {
  const [c] = await q`SELECT id, schema_name, label, status FROM core.cohorts WHERE id = ${Number(cohortId) || 0}`;
  return c || null;
}

function requireJoinable(cohort) {
  if (!cohort) throw new HttpError(422, 'Cohort does not exist.');
  if (!JOINABLE.has(cohort.status)) throw new HttpError(422, `Cohort "${cohort.label}" is ${cohort.status}; students can only be added to a running cohort.`);
}

async function programName(q, programId) {
  if (programId == null || programId === '') return { id: null, name: null };
  const [p] = await q`SELECT id, name FROM core.programs WHERE id = ${Number(programId) || 0}`;
  if (!p) throw new HttpError(422, 'Unknown program.');
  return p;
}

/** Profile/device data to carry over from the person's most recent other cohort. */
async function previousProfile(accountCtx, excludeCohortId) {
  if (!accountCtx) return null;
  const rows = [];
  for (const m of [...accountCtx.memberships].reverse()) {
    if (m.cohort_id === excludeCohortId) continue;
    const [r] = await connection.unsafe(
      `SELECT s.enrollment_no, s.program_id, s.program_name, s.mac_address, s.mac_verified, s.device_hash, s.photo_url, u.preferences
         FROM ${qid(m.schema)}.students s JOIN ${qid(m.schema)}.users u ON u.id = s.id WHERE s.id = $1`,
      [m.local_user_id]);
    if (r) rows.push(r);
  }
  return rows.find((r) => r.mac_address) || rows[0] || null;
}

async function assertEnrollmentFree(tx, cohort, enrollmentNo, accountId) {
  if (!enrollmentNo) return;
  const [dup] = await tx`
    SELECT id FROM core.accounts
     WHERE enrollment_no = ${enrollmentNo} AND merged_into IS NULL AND id <> ${accountId ?? '00000000-0000-0000-0000-000000000000'}`;
  if (dup) throw new HttpError(409, 'A student with this enrollment number already exists.');
  const rows = await tx.unsafe(
    `SELECT id FROM ${qid(cohort.schema_name)}.students WHERE enrollment_no = $1 AND id <> $2::uuid`,
    [enrollmentNo, accountId ?? '00000000-0000-0000-0000-000000000000']);
  if (rows.length) throw new HttpError(409, 'A student with this enrollment number already exists in this cohort.');
}

/** Membership + users + students + enrollments for an existing canonical account. */
async function enrollAccount(tx, { account, cohort, firstName, lastName, enrollmentNo, program, prev }) {
  const schema = qid(cohort.schema_name);

  await tx`INSERT INTO core.cohort_memberships (account_id, cohort_id, status) VALUES (${account.id}, ${cohort.id}, 'active')`;

  await tx.unsafe(
    `INSERT INTO ${schema}.users (id, email, password_hash, role, first_name, last_name, is_active, preferences, cohort_id)
     VALUES ($1, $2, $3, 'student', $4, $5, true, $6::jsonb, $7)`,
    [account.id, account.email, account.password_hash, firstName ?? account.first_name ?? '', lastName ?? account.last_name ?? '',
     JSON.stringify(prev?.preferences ?? {}), cohort.id]);

  await tx.unsafe(
    `INSERT INTO ${schema}.students (id, enrollment_no, program_name, program_id, device_hash, mac_address, mac_verified, photo_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [account.id, enrollmentNo || null, program.name || prev?.program_name || null, program.id ?? prev?.program_id ?? null,
     prev?.device_hash || null, prev?.mac_address || null, prev?.mac_verified ?? false, prev?.photo_url || null]);

  // The students trigger already does this; keep both so a missing trigger can never leave a gap.
  await tx.unsafe(
    `INSERT INTO ${schema}.course_enrollments (student_id, course_id) SELECT $1, id FROM ${schema}.courses ON CONFLICT DO NOTHING`,
    [account.id]);
}

/** Queue a "set your password" email (7-day link) in the cohort's notification outbox. */
export async function queueSetPasswordEmail(tx, cohort, account) {
  const resetToken = jwt.sign({ user_id: account.id, purpose: 'password_reset' }, process.env.JWT_SECRET, { expiresIn: '7d' });
  await tx.unsafe(
    `INSERT INTO ${qid(cohort.schema_name)}.notification_stream
       (dedupe_key, event_type, channel, recipient_id, recipient_email, recipient_name, payload, status, available_at)
     VALUES ($1, 'password_reset', 'email', $2, $3, $4, $5::jsonb, 'queued', now())
     ON CONFLICT (dedupe_key) DO NOTHING`,
    ['password_reset:' + account.id + ':' + resetToken.slice(-16), account.id, account.email, account.first_name || null,
     JSON.stringify({ resetToken })]);
}

/**
 * Add a student to a cohort. `cohortId` is REQUIRED and must be a running (or provisioning) cohort.
 * Creates the global account if the email is new; reuses it (keeping password, MAC, device, preferences) otherwise.
 *
 * @param {{ cohortId:number, firstName:string, lastName?:string, email:string, enrollmentNo?:string, programId?:number,
 *           passwordHash?:string }} input  passwordHash: self-service signup supplies its own; otherwise a random one is set
 * @param {{ tx?: any, sendEmail?: boolean }} [opts] pass `tx` to join an outer transaction (cohort provisioning)
 */
export async function createStudent(input, { tx = null, sendEmail = true } = {}) {
  const email = String(input.email || '').trim().toLowerCase();
  const firstName = String(input.firstName || '').trim();
  const lastName = String(input.lastName || '').trim();
  const enrollmentNo = input.enrollmentNo ? String(input.enrollmentNo).trim() : null;
  if (!input.cohortId) throw new HttpError(400, 'cohort_id is required.');
  if (!firstName || !email) throw new HttpError(400, 'First name and email are required.');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Invalid email address.');

  const out = await inTx(tx, async (q) => {
    const cohort = await loadCohort(q, input.cohortId);
    requireJoinable(cohort);

    let [account] = await q`
      SELECT id, email, password_hash, role, first_name, last_name, enrollment_no, is_active
        FROM core.accounts WHERE lower(email) = ${email} AND merged_into IS NULL`;
    let created = false;

    if (account) {
      if (account.role !== 'student') throw new HttpError(409, `This email belongs to a ${account.role} account and cannot be added as a student.`);
      if (account.is_active === false) throw new HttpError(409, 'This account is deactivated.');
      const ctx = await getAccountContext(account.id);
      if (ctx?.memberships.some((m) => m.cohort_id === cohort.id)) {
        throw new HttpError(409, 'Student already in this cohort.');
      }
    } else {
      await assertEnrollmentFree(q, cohort, enrollmentNo, null);
      const hash = input.passwordHash || await hashPassword(crypto.randomBytes(24).toString('base64url'));
      [account] = await q`
        INSERT INTO core.accounts (id, email, password_hash, role, first_name, last_name, enrollment_no)
        VALUES (${crypto.randomUUID()}, ${email}, ${hash}, 'student', ${firstName}, ${lastName}, ${enrollmentNo})
        RETURNING id, email, password_hash, role, first_name, last_name, enrollment_no, is_active`;
      created = true;
    }

    const ctx = created ? null : await getAccountContext(account.id);
    const prev = await previousProfile(ctx, cohort.id);
    const chosenEnrollment = enrollmentNo || account.enrollment_no || prev?.enrollment_no || null;
    if (!created) await assertEnrollmentFree(q, cohort, chosenEnrollment, account.id);
    const program = await programName(q, input.programId);

    await enrollAccount(q, { account, cohort, firstName: firstName || null, lastName: lastName || null, enrollmentNo: chosenEnrollment, program, prev });
    if (created && sendEmail) await queueSetPasswordEmail(q, cohort, account);

    return {
      created,
      reused: !created,
      student: {
        id: account.id, email: account.email, first_name: firstName || account.first_name, last_name: lastName || account.last_name,
        enrollment_no: chosenEnrollment, cohort_id: cohort.id, cohort: cohort.schema_name, program_id: program.id ?? prev?.program_id ?? null,
        mac_address: prev?.mac_address || null, mac_verified: prev?.mac_verified ?? false,
      },
    };
  });
  invalidateAccountCache();
  return out;
}

/** Resolve a cohort-local student id to { ctx, membership } inside a cohort. */
async function locate(localId, cohort) {
  const ctx = await getAccountContext(localId);
  if (!ctx) throw new HttpError(404, 'Student not found.');
  const membership = ctx.memberships.find((m) => m.cohort_id === cohort.id);
  if (!membership) throw new HttpError(404, 'Student not found in this cohort.');
  return { ctx, membership };
}

/**
 * Edit a student in `cohort` (an object from core.cohorts). Identity fields (name, email) go to the global account
 * and are mirrored to running cohorts; MAC, program and enrollment number belong to this cohort's student record.
 * `is_active` is the membership state in THIS cohort (it never deactivates the person's login).
 */
export async function updateStudent(localId, cohort, patch) {
  const { ctx, membership } = await locate(localId, cohort);
  const schema = qid(cohort.schema_name);

  if (patch.mac_address !== undefined && patch.mac_address !== '' && patch.mac_address !== null && !MAC_RE.test(patch.mac_address)) {
    throw new HttpError(400, 'Invalid MAC address format. Use XX:XX:XX:XX:XX:XX');
  }
  if (patch.email !== undefined) {
    const email = String(patch.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Invalid email address.');
    const [dup] = await connection`SELECT id FROM core.accounts WHERE lower(email) = ${email} AND merged_into IS NULL AND id <> ${ctx.canonicalId}`;
    if (dup) throw new HttpError(409, 'This email is already used by another user.');
    patch = { ...patch, email };
  }

  await connection.begin(async (tx) => {
    // identity -> account (+ mirror into running cohorts)
    const identity = {};
    for (const k of ['first_name', 'last_name', 'email']) if (patch[k] !== undefined) identity[k] = typeof patch[k] === 'string' ? patch[k].trim() : patch[k];
    if (Object.keys(identity).length) {
      const next = {
        first_name: identity.first_name ?? ctx.account.first_name, last_name: identity.last_name ?? ctx.account.last_name,
        email: identity.email ?? ctx.account.email,
      };
      await tx`UPDATE core.accounts SET first_name = ${next.first_name}, last_name = ${next.last_name}, email = ${next.email}, updated_at = now()
                WHERE id = ${ctx.canonicalId}`;
      for (const m of ctx.memberships.filter((x) => x.cohort_status === 'running')) {
        await tx.unsafe(`UPDATE ${qid(m.schema)}.users SET first_name = $2, last_name = $3, email = $4, updated_at = now() WHERE id = $1`,
          [m.local_user_id, next.first_name, next.last_name, next.email]);
      }
    }

    // cohort-specific student record
    const sets = [];
    const params = [membership.local_user_id];
    const add = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };

    if (patch.enrollment_no !== undefined) {
      const e = patch.enrollment_no ? String(patch.enrollment_no).trim() : null;
      await assertEnrollmentFree(tx, cohort, e, ctx.canonicalId);
      add('enrollment_no', e);
      await tx`UPDATE core.accounts SET enrollment_no = ${e}, updated_at = now() WHERE id = ${ctx.canonicalId}`;
    }
    if (patch.program_id !== undefined) {
      const p = await programName(tx, patch.program_id);
      add('program_id', p.id);
      add('program_name', p.name);
    }
    if (patch.mac_verified !== undefined) add('mac_verified', Boolean(patch.mac_verified));
    if (patch.mac_address !== undefined) {
      if (patch.mac_address === '' || patch.mac_address === null) {
        add('mac_address', null);
        if (patch.mac_verified === undefined) add('mac_verified', false);
      } else {
        add('mac_address', String(patch.mac_address).toUpperCase());
        if (patch.mac_verified === undefined) add('mac_verified', true); // admin-set MACs are trusted immediately
      }
    }
    if (sets.length) await tx.unsafe(`UPDATE ${schema}.students SET ${sets.join(', ')} WHERE id = $1`, params);

    if (patch.is_active !== undefined) {
      const active = Boolean(patch.is_active);
      await tx.unsafe(`UPDATE ${schema}.users SET is_active = $2, updated_at = now() WHERE id = $1`, [membership.local_user_id, active]);
      await tx`UPDATE core.cohort_memberships
                  SET status = ${active ? 'active' : 'withdrawn'}, left_at = ${active ? null : new Date()}
                WHERE account_id = ${membership.local_user_id} AND cohort_id = ${cohort.id}
                  AND status IN ('active','withdrawn')`;
    }
  });
  invalidateAccountCache();
}

/**
 * Move a student from one cohort to another running cohort, keeping all history in the source cohort.
 * The source membership becomes `transferred_out` and its users row inactive. This is the one write that is
 * allowed into a non-running source cohort, because it happens inside the service, not through the HTTP guard.
 */
export async function transferStudent(localId, fromCohortId, toCohortId, { programId } = {}) {
  if (Number(fromCohortId) === Number(toCohortId)) throw new HttpError(400, 'Source and target cohort are the same.');
  const out = await connection.begin(async (tx) => {
    const from = await loadCohort(tx, fromCohortId);
    const to = await loadCohort(tx, toCohortId);
    if (!from) throw new HttpError(404, 'Source cohort does not exist.');
    if (!to || to.status !== 'running') throw new HttpError(422, 'The target cohort must be a running cohort.');

    const ctx = await getAccountContext(localId);
    if (!ctx) throw new HttpError(404, 'Student not found.');
    const src = ctx.memberships.find((m) => m.cohort_id === from.id);
    if (!src) throw new HttpError(404, 'Student not found in the source cohort.');
    if (src.status !== 'active') throw new HttpError(409, `The student's membership in the source cohort is ${src.status}, not active.`);
    if (ctx.memberships.some((m) => m.cohort_id === to.id)) throw new HttpError(409, 'Student already in the target cohort.');
    if (ctx.account.is_active === false) throw new HttpError(409, 'This account is deactivated.');

    const prev = await previousProfile(ctx, to.id);
    // prefer the SOURCE cohort's record as the profile to carry over
    const [srcRow] = await tx.unsafe(
      `SELECT s.enrollment_no, s.program_id, s.program_name, s.mac_address, s.mac_verified, s.device_hash, s.photo_url, u.preferences
         FROM ${qid(from.schema_name)}.students s JOIN ${qid(from.schema_name)}.users u ON u.id = s.id WHERE s.id = $1`, [src.local_user_id]);
    const profile = srcRow || prev;
    const program = programId != null ? await programName(tx, programId) : { id: profile?.program_id ?? null, name: profile?.program_name ?? null };
    const enrollmentNo = profile?.enrollment_no || ctx.account.enrollment_no || null;
    await assertEnrollmentFree(tx, to, enrollmentNo, ctx.canonicalId);

    await enrollAccount(tx, { account: ctx.account, cohort: to, enrollmentNo, program, prev: profile });

    await tx`UPDATE core.cohort_memberships SET status = 'transferred_out', left_at = now()
              WHERE account_id = ${src.local_user_id} AND cohort_id = ${from.id}`;
    await tx.unsafe(`UPDATE ${qid(from.schema_name)}.users SET is_active = false, updated_at = now() WHERE id = $1`, [src.local_user_id]);
    return { from: from.schema_name, to: to.schema_name, student_id: ctx.account.id };
  });
  invalidateAccountCache();
  return out;
}

/** Mark a student as having left a cohort without deleting anything. */
export async function withdrawStudent(localId, cohortId) {
  await connection.begin(async (tx) => {
    const cohort = await loadCohort(tx, cohortId);
    if (!cohort) throw new HttpError(404, 'Cohort does not exist.');
    const { membership } = await locate(localId, cohort);
    if (membership.status !== 'active') throw new HttpError(409, `Membership is already ${membership.status}.`);
    await tx`UPDATE core.cohort_memberships SET status = 'withdrawn', left_at = now()
              WHERE account_id = ${membership.local_user_id} AND cohort_id = ${cohort.id}`;
    await tx.unsafe(`UPDATE ${qid(cohort.schema_name)}.users SET is_active = false, updated_at = now() WHERE id = $1`, [membership.local_user_id]);
  });
  invalidateAccountCache();
}

// Child rows removed before the students/users rows, in dependency order. Only `public` has ON DELETE CASCADE on
// all of these; the other cohorts do not, so the order is explicit.
const STUDENT_CHILD_TABLES = [
  ['attendance_records', 'student_id'], ['feedback_responses', 'student_id'], ['assignment_submissions', 'student_id'],
  ['course_enrollments', 'student_id'], ['leave_requests', 'student_id'], ['attendance_ping_logs', 'student_id'],
  ['student_attendance_marks', 'student_id'], ['student_course_attendance', 'student_id'],
  ['notifications', 'recipient_id'], ['notification_stream', 'recipient_id'],
];

/**
 * Permanently remove a student from a RUNNING cohort (all their data in that cohort). `confirm` must equal their
 * email. The global account is deleted only if the person has no other memberships.
 */
export async function purgeStudentFromCohort(localId, cohortId, { confirm } = {}) {
  const out = await connection.begin(async (tx) => {
    const cohort = await loadCohort(tx, cohortId);
    if (!cohort) throw new HttpError(404, 'Cohort does not exist.');
    if (cohort.status !== 'running') throw new HttpError(409, 'Students can only be deleted from a running cohort.');
    const { ctx, membership } = await locate(localId, cohort);
    if (!confirm || String(confirm).trim().toLowerCase() !== ctx.account.email.toLowerCase()) {
      throw new HttpError(400, 'Type the student\'s email to confirm permanent deletion.');
    }
    const schema = qid(cohort.schema_name);
    const id = membership.local_user_id;
    for (const [table, col] of STUDENT_CHILD_TABLES) {
      await tx.unsafe(`DELETE FROM ${schema}.${qid(table)} WHERE ${qid(col)} = $1`, [id]);
    }
    await tx.unsafe(`DELETE FROM ${schema}.students WHERE id = $1`, [id]);
    await tx.unsafe(`DELETE FROM ${schema}.users WHERE id = $1`, [id]);
    await tx`DELETE FROM core.cohort_memberships WHERE account_id = ${id} AND cohort_id = ${cohort.id}`;

    const ids = [ctx.canonicalId, ...ctx.aliasIds];
    const [{ n }] = await tx`SELECT count(*)::int AS n FROM core.cohort_memberships WHERE account_id IN ${tx(ids)}`;
    let accountDeleted = false;
    if (n === 0) {
      await tx`DELETE FROM core.accounts WHERE merged_into = ${ctx.canonicalId}`;
      await tx`DELETE FROM core.accounts WHERE id = ${ctx.canonicalId}`;
      accountDeleted = true;
    }
    return { deleted: id, accountDeleted };
  });
  invalidateAccountCache();
  return out;
}

export async function listPrograms() {
  return connection`SELECT id, name FROM core.programs ORDER BY name`;
}

export async function createProgram(name) {
  const n = String(name || '').trim();
  if (!n) throw new HttpError(400, 'Program name is required.');
  const [row] = await connection`INSERT INTO core.programs (name) VALUES (${n})
                                  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id, name`;
  return row;
}

/** Students of a cohort for the admin list (includes program and membership state). */
export async function listCohortStudents(cohort) {
  const schema = qid(cohort.schema_name);
  const rows = await connection.unsafe(`
    SELECT s.id, u.email, u.first_name, u.last_name, u.is_active, s.enrollment_no, s.program_name, s.program_id,
           p.name AS program, s.mac_address, s.mac_verified, s.created_at, m.status AS membership_status
      FROM ${schema}.students s
      JOIN ${schema}.users u ON u.id = s.id
      LEFT JOIN core.programs p ON p.id = s.program_id
      LEFT JOIN core.cohort_memberships m ON m.account_id = u.id AND m.cohort_id = ${Number(cohort.id)}
     ORDER BY s.created_at DESC NULLS LAST`);
  const enr = await connection.unsafe(`
    SELECT e.student_id, e.course_id, e.enrolled_at, c.name AS course_name, c.code AS course_code
      FROM ${schema}.course_enrollments e LEFT JOIN ${schema}.courses c ON c.id = e.course_id`);
  const byStudent = new Map();
  for (const e of enr) {
    if (!byStudent.has(e.student_id)) byStudent.set(e.student_id, []);
    byStudent.get(e.student_id).push({
      course_id: e.course_id, course_name: e.course_name || 'Unknown', course_code: e.course_code || '', enrolled_at: e.enrolled_at,
    });
  }
  return rows.map((s) => ({
    id: s.id, first_name: s.first_name || '', last_name: s.last_name || '', email: s.email || '',
    is_active: s.is_active ?? true, enrollment_no: s.enrollment_no || '',
    program_name: s.program || s.program_name || '', program_id: s.program_id ?? null,
    mac_address: s.mac_address || '', mac_verified: s.mac_verified ?? false, created_at: s.created_at,
    membership_status: s.membership_status || null, courses: byStudent.get(s.id) || [],
  }));
}
