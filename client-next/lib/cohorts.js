import crypto from 'node:crypto';
import { connection, getCohortConfig, invalidateCohortCache, COHORT_NAME_RE } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

const RESERVED_SCHEMAS = new Set([
  'public', 'auth', 'storage', 'vault', 'realtime', 'extensions',
  'graphql', 'graphql_public', 'information_schema', 'pgbouncer',
]);

// Tables never cloned into a new cohort. wifi_snapshots stays a single shared table in `public`.
const SKIP_TABLES = new Set(['wifi_snapshots']);

// Reference tables copied (in FK-safe order). `users` and `faculty` are handled separately.
// session_skills is intentionally NOT copied: its rows only link sessions to skills and a fresh
// cohort has no sessions, so the copied rows would be orphans.
const COPY_TABLES = [
  'courses',
  'categories',
  'skills',
  'session_types',
  'venues',
  'system_settings',
  'feedback_questions',
  'google_tokens',
];

/** Quote a (pre-validated) identifier for use in dynamic SQL. */
export function qid(id) {
  return '"' + String(id).replace(/"/g, '""') + '"';
}

// ── Student → cohort membership ──────────────────────────────────────────────
const MEMBERSHIP_TTL_MS = 60_000;
const _membershipCache = new Map(); // userId -> { at, cohorts }

export function invalidateMembershipCache() {
  _membershipCache.clear();
}

/**
 * Cohorts (in registry order, oldest first) in which `userId` has a users row.
 * Cached briefly so it can be used on every request.
 */
export async function getUserCohorts(userId) {
  const hit = _membershipCache.get(userId);
  if (hit && Date.now() - hit.at < MEMBERSHIP_TTL_MS) return hit.cohorts;

  const { schemas } = await getCohortConfig(); // validated registry names only
  if (!schemas.length) return [];
  const query = schemas
    .map((s, i) => `SELECT ${i} AS idx FROM ${qid(s)}.users WHERE id = $1`)
    .join(' UNION ALL ');
  const rows = await connection.unsafe(query, [userId]);
  const cohorts = rows.map(r => schemas[Number(r.idx)]).filter(Boolean);
  _membershipCache.set(userId, { at: Date.now(), cohorts });
  return cohorts;
}

/**
 * Decide which cohort schema a request operates on.
 *  - admin/faculty: x-cohort header if registered, else the active cohort.
 *  - student: x-cohort header if they belong to it; otherwise the active cohort if they belong
 *    to it; otherwise the most recent cohort they belong to.
 */
export async function resolveRequestSchema(req, user) {
  const { schemas, active } = await getCohortConfig();
  const requested = req.headers.get('x-cohort');

  if (user.role !== 'student') {
    return requested && schemas.includes(requested) ? requested : active;
  }

  let members = [];
  try {
    members = await getUserCohorts(user.id);
  } catch (err) {
    console.error('resolveRequestSchema: membership lookup failed:', err.message);
  }
  if (requested && members.includes(requested)) return requested;
  if (members.includes(active)) return active;
  if (members.length) return members[members.length - 1];
  return active;
}

/** Default cohort for a user at login time, from the cohorts they belong to. */
export function pickDefaultCohort(role, members, active) {
  if (members.includes(active)) return active;
  if (!members.length) return null;
  return role === 'student' ? members[members.length - 1] : members[0];
}

// ── Create a new cohort ──────────────────────────────────────────────────────
function normalizeStudents(rows) {
  const seen = new Set();
  const out = [];
  const errors = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const email = String(r?.email || '').trim().toLowerCase();
    const name = String(r?.name || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ email: r?.email || '', error: 'Invalid email' });
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    const [first, ...rest] = name.split(/\s+/).filter(Boolean);
    out.push({
      email,
      firstName: first || email.split('@')[0],
      lastName: rest.join(' '),
      enrollmentNo: r?.enrollment_no ? String(r.enrollment_no).trim() : null,
      programName: r?.program_name ? String(r.program_name).trim() : null,
    });
  }
  return { students: out, errors };
}

/**
 * Lookup an existing student's account and profile data across registered cohorts.
 * Merges profile data, giving priority to schemas with populated MAC address or preferredSourceSchema.
 *
 * @param {string} email
 * @param {string} [excludeSchema]
 * @param {string} [preferredSourceSchema]
 * @returns {Promise<Object|null>}
 */
export async function findExistingStudentAcrossCohorts(email, excludeSchema = null, preferredSourceSchema = null) {
  if (!email) return null;
  const normalizedEmail = email.toLowerCase().trim();
  const { schemas, active } = await getCohortConfig();
  if (!schemas || !schemas.length) return null;

  // Order schemas: preferredSourceSchema first, then active, then remaining schemas
  const schemaOrder = [];
  if (preferredSourceSchema && schemas.includes(preferredSourceSchema)) {
    schemaOrder.push(preferredSourceSchema);
  }
  if (active && schemas.includes(active) && !schemaOrder.includes(active)) {
    schemaOrder.push(active);
  }
  for (let i = schemas.length - 1; i >= 0; i--) {
    const s = schemas[i];
    if (!schemaOrder.includes(s)) schemaOrder.push(s);
  }

  const targetSchemas = schemaOrder.filter(s => s !== excludeSchema);
  let bestRecord = null;

  for (const s of targetSchemas) {
    try {
      const rows = await connection.unsafe(
        `SELECT u.id, u.email, u.password_hash, u.role, u.first_name, u.last_name, u.is_active, u.preferences,
                st.enrollment_no, st.program_name, st.device_hash, st.mac_address, st.mac_verified, st.photo_url
         FROM ${qid(s)}.users u
         LEFT JOIN ${qid(s)}.students st ON u.id = st.id
         WHERE lower(u.email) = $1 AND u.role = 'student'
         LIMIT 1`,
        [normalizedEmail]
      );
      if (rows && rows.length > 0) {
        const r = rows[0];
        if (!bestRecord) {
          bestRecord = { ...r, sourceSchema: s };
        } else {
          // If this record has mac_address and bestRecord didn't, upgrade
          if (!bestRecord.mac_address && r.mac_address) {
            bestRecord.mac_address = r.mac_address;
            bestRecord.mac_verified = r.mac_verified;
          }
          if (!bestRecord.device_hash && r.device_hash) bestRecord.device_hash = r.device_hash;
          if (!bestRecord.enrollment_no && r.enrollment_no) bestRecord.enrollment_no = r.enrollment_no;
          if (!bestRecord.program_name && r.program_name) bestRecord.program_name = r.program_name;
          if (!bestRecord.photo_url && r.photo_url) bestRecord.photo_url = r.photo_url;
        }
        if (bestRecord.mac_address && s === preferredSourceSchema) break;
      }
    } catch (err) {
      console.warn(`findExistingStudentAcrossCohorts: error querying ${s}:`, err.message);
    }
  }

  return bestRecord;
}

/**
 * Batch lookup existing students across registered cohorts.
 * Returns Map: email (lowercase) -> studentRecord
 */
export async function findExistingStudentsBatch(emails, excludeSchema = null, preferredSourceSchema = null) {
  const result = new Map();
  if (!emails || !emails.length) return result;

  const normalizedEmails = [...new Set(emails.map(e => String(e).toLowerCase().trim()).filter(Boolean))];
  if (!normalizedEmails.length) return result;

  const { schemas, active } = await getCohortConfig();
  if (!schemas || !schemas.length) return result;

  const schemaOrder = [];
  if (preferredSourceSchema && schemas.includes(preferredSourceSchema)) {
    schemaOrder.push(preferredSourceSchema);
  }
  if (active && schemas.includes(active) && !schemaOrder.includes(active)) {
    schemaOrder.push(active);
  }
  for (let i = schemas.length - 1; i >= 0; i--) {
    const s = schemas[i];
    if (!schemaOrder.includes(s)) schemaOrder.push(s);
  }

  const targetSchemas = schemaOrder.filter(s => s !== excludeSchema);

  for (const s of targetSchemas) {
    try {
      const rows = await connection.unsafe(
        `SELECT u.id, u.email, u.password_hash, u.role, u.first_name, u.last_name, u.is_active, u.preferences,
                st.enrollment_no, st.program_name, st.device_hash, st.mac_address, st.mac_verified, st.photo_url
         FROM ${qid(s)}.users u
         LEFT JOIN ${qid(s)}.students st ON u.id = st.id
         WHERE lower(u.email) = ANY($1) AND u.role = 'student'`,
        [normalizedEmails]
      );
      for (const r of rows) {
        const key = r.email.toLowerCase();
        const existing = result.get(key);
        if (!existing) {
          result.set(key, { ...r, sourceSchema: s });
        } else {
          // Merge in missing details (mac_address, verified status, device_hash, photo_url, etc.)
          if (!existing.mac_address && r.mac_address) {
            existing.mac_address = r.mac_address;
            existing.mac_verified = r.mac_verified;
          }
          if (!existing.device_hash && r.device_hash) existing.device_hash = r.device_hash;
          if (!existing.enrollment_no && r.enrollment_no) existing.enrollment_no = r.enrollment_no;
          if (!existing.program_name && r.program_name) existing.program_name = r.program_name;
          if (!existing.photo_url && r.photo_url) existing.photo_url = r.photo_url;
        }
      }
    } catch (err) {
      console.warn(`findExistingStudentsBatch: error querying ${s}:`, err.message);
    }
  }

  return result;
}

/**
 * Creates a fresh cohort schema by cloning the structure of `sourceSchema`, copying reference data
 * and non-student users, and enrolling the provided students. Everything runs in one transaction.
 *
 * @param {{ schemaName: string, label: string, students?: {name:string,email:string}[],
 *           makeActive?: boolean, createdBy?: string, sourceSchema?: string, copyAllStudents?: boolean }} opts
 */
export async function createCohort(opts) {
  const schemaName = String(opts.schemaName || '').trim();
  const label = String(opts.label || '').trim() || schemaName.charAt(0).toUpperCase() + schemaName.slice(1);

  if (!COHORT_NAME_RE.test(schemaName) || RESERVED_SCHEMAS.has(schemaName) || schemaName.startsWith('pg_')) {
    const err = new Error('Invalid cohort name. Use 3-41 chars: lowercase letters, digits, underscore; must start with a letter.');
    err.status = 400;
    throw err;
  }

  const { schemas, active } = await getCohortConfig();
  if (schemas.includes(schemaName)) {
    const err = new Error('A cohort with this name already exists');
    err.status = 409;
    throw err;
  }
  const source = opts.sourceSchema || active;
  if (!schemas.includes(source)) {
    const err = new Error('Invalid source cohort');
    err.status = 400;
    throw err;
  }

  const { students: studentRows, errors: inputErrors } = normalizeStudents(opts.students);

  // If copyAllStudents is requested, pull all active students from the source cohort
  if (opts.copyAllStudents) {
    try {
      const srcStudents = await connection.unsafe(
        `SELECT u.email, u.first_name, u.last_name, st.enrollment_no, st.program_name
         FROM ${qid(source)}.users u
         JOIN ${qid(source)}.students st ON u.id = st.id
         WHERE u.role = 'student' AND u.is_active = true`
      );
      const existingEmails = new Set(studentRows.map(s => s.email));
      for (const s of srcStudents) {
        if (!existingEmails.has(s.email.toLowerCase())) {
          studentRows.push({
            email: s.email.toLowerCase(),
            firstName: s.first_name || '',
            lastName: s.last_name || '',
            enrollmentNo: s.enrollment_no || null,
            programName: s.program_name || null,
          });
          existingEmails.add(s.email.toLowerCase());
        }
      }
    } catch (srcErr) {
      console.warn('createCohort: failed to read source students for copyAllStudents:', srcErr.message);
    }
  }

  // Look up existing student accounts across previous cohorts (including MAC address, verified, device hash)
  const existingByEmail = studentRows.length
    ? await findExistingStudentsBatch(studentRows.map(s => s.email), null, source)
    : new Map();

  const src = qid(source);
  const dst = qid(schemaName);
  const result = { schema: schemaName, label, created: 0, reused: 0, failed: [...inputErrors], tables: 0 };

  await connection.begin(async (sql) => {
    const [{ exists }] = await sql.unsafe(
      `SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS exists`, [schemaName]
    );
    if (exists) {
      const err = new Error('A database schema with this name already exists');
      err.status = 409;
      throw err;
    }

    await sql.unsafe(`CREATE SCHEMA ${dst}`);

    // 1. Clone table structure (columns, defaults, PK/unique/check constraints, indexes).
    const tables = (await sql.unsafe(
      `SELECT c.relname AS name, c.relrowsecurity AS rls
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relkind = 'r' ORDER BY c.relname`, [source]
    )).filter(t => !SKIP_TABLES.has(t.name));

    for (const t of tables) {
      await sql.unsafe(`CREATE TABLE ${dst}.${qid(t.name)} (LIKE ${src}.${qid(t.name)} INCLUDING ALL)`);
      if (t.rls) await sql.unsafe(`ALTER TABLE ${dst}.${qid(t.name)} ENABLE ROW LEVEL SECURITY`);
    }
    result.tables = tables.length;

    // 2. Recreate foreign keys (LIKE does not copy them), re-pointed at the new schema.
    await sql.unsafe(`SET LOCAL search_path TO ${src}, public`);
    const fks = await sql.unsafe(
      `SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint WHERE contype = 'f' AND connamespace = $1::regnamespace`, [source]
    );
    await sql.unsafe(`SET LOCAL search_path TO ${dst}, public`);
    const srcPrefix = new RegExp(`REFERENCES\\s+"?${source}"?\\.`, 'g');
    for (const fk of fks) {
      const tbl = fk.tbl.replace(/^"?[^".]+"?\./, '').replace(/"/g, '');
      if (SKIP_TABLES.has(tbl)) continue;
      const def = fk.def.replace(srcPrefix, 'REFERENCES ');
      await sql.unsafe(`ALTER TABLE ${dst}.${qid(tbl)} ADD CONSTRAINT ${qid(fk.conname)} ${def}`);
    }
    await sql.unsafe(`SET LOCAL search_path TO public`);

    // 3. Copy non-student users and their faculty rows, then reference tables.
    await sql.unsafe(`INSERT INTO ${dst}.users SELECT * FROM ${src}.users WHERE role <> 'student'`);
    await sql.unsafe(`INSERT INTO ${dst}.faculty SELECT * FROM ${src}.faculty WHERE id IN (SELECT id FROM ${dst}.users)`);
    for (const t of COPY_TABLES) {
      await sql.unsafe(`INSERT INTO ${dst}.${qid(t)} SELECT * FROM ${src}.${qid(t)}`);
    }

    // Auto-enroll trigger for any student created in this cohort
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION ${dst}.auto_enroll_student_in_courses()
      RETURNS TRIGGER AS $$
      BEGIN
          INSERT INTO ${dst}.course_enrollments (student_id, course_id)
          SELECT NEW.id, courses.id
          FROM ${dst}.courses
          ON CONFLICT DO NOTHING;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_auto_enroll_student ON ${dst}.students;
      CREATE TRIGGER trg_auto_enroll_student
      AFTER INSERT ON ${dst}.students
      FOR EACH ROW
      EXECUTE FUNCTION ${dst}.auto_enroll_student_in_courses();
    `);

    // 4. Enrol students.
    for (const s of studentRows) {
      try {
        await sql.savepoint(async (sp) => {
          const prev = existingByEmail.get(s.email);
          let id;
          if (prev) {
            id = prev.id;
            await sp.unsafe(
              `INSERT INTO ${dst}.users (id, email, password_hash, role, first_name, last_name, is_active, preferences)
               VALUES ($1, $2, $3, 'student', $4, $5, true, $6)`,
              [prev.id, s.email, prev.password_hash, s.firstName || prev.first_name, s.lastName || prev.last_name, prev.preferences ?? null]
            );
            await sp.unsafe(
              `INSERT INTO ${dst}.students (id, enrollment_no, program_name, device_hash, mac_address, mac_verified, photo_url)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                prev.id,
                s.enrollmentNo || prev.enrollment_no || null,
                s.programName || prev.program_name || null,
                prev.device_hash || null,
                prev.mac_address || null,
                prev.mac_verified ?? false,
                prev.photo_url || null,
              ]
            );
            result.reused++;
          } else {
            // Random password: the student sets their own via "Forgot password".
            const hash = await hashPassword(crypto.randomBytes(24).toString('base64url'));
            const [row] = await sp.unsafe(
              `INSERT INTO ${dst}.users (email, password_hash, role, first_name, last_name, is_active)
               VALUES ($1, $2, 'student', $3, $4, true) RETURNING id`,
              [s.email, hash, s.firstName, s.lastName]
            );
            id = row.id;
            await sp.unsafe(
              `INSERT INTO ${dst}.students (id, enrollment_no, program_name) VALUES ($1, $2, $3)`,
              [id, s.enrollmentNo || null, s.programName || null]
            );
            result.created++;
          }
        });
      } catch (err) {
        result.failed.push({ email: s.email, error: err.message });
      }
    }

    // Auto-enroll all students in all courses of this cohort
    try {
      await sql.unsafe(`
        INSERT INTO ${dst}.course_enrollments (student_id, course_id)
        SELECT s.id, c.id
        FROM ${dst}.students s
        CROSS JOIN ${dst}.courses c
        ON CONFLICT DO NOTHING
      `);
    } catch (enrollErr) {
      console.warn('Cohort creation auto-enroll error:', enrollErr.message);
    }

    // 5. Register the cohort.
    if (opts.makeActive) await sql.unsafe(`UPDATE public.cohorts SET is_active = false WHERE is_active`);
    await sql.unsafe(
      `INSERT INTO public.cohorts (schema_name, label, is_active, created_by) VALUES ($1, $2, $3, $4)`,
      [schemaName, label, !!opts.makeActive, opts.createdBy || null]
    );
  });

  invalidateCohortCache();
  invalidateMembershipCache();
  return result;
}

/** Marks `schemaName` as the single active cohort. */
export async function setActiveCohort(schemaName) {
  const { schemas } = await getCohortConfig();
  if (!schemas.includes(schemaName)) {
    const err = new Error('Unknown cohort');
    err.status = 404;
    throw err;
  }
  await connection.begin(async (sql) => {
    await sql`UPDATE public.cohorts SET is_active = false WHERE is_active`;
    await sql`UPDATE public.cohorts SET is_active = true WHERE schema_name = ${schemaName}`;
  });
  invalidateCohortCache();
}
