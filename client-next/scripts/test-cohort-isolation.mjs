// node scripts/test-cohort-isolation.mjs
//
// End-to-end checks of cohort isolation and the student/cohort lifecycle.
//   STAGING_DATABASE_URL  database the APP is also running against (NEVER production)
//   APP_URL               the running Next.js app (default http://localhost:3000)
// It creates its own admin/student/cohort ("zz_test_a") and cleans up after itself.
// Refuses to run if STAGING_DATABASE_URL equals DATABASE_URL from .env (production).
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkDrift } from './check-schema-drift.mjs';
import { main as deleteCohort } from './cohort-delete.mjs';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: false, quiet: true });

const STAGING = process.env.STAGING_DATABASE_URL;
const APP = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const PASSWORD = 'Test-Passw0rd!' + crypto.randomBytes(3).toString('hex');
const TEST_SCHEMA = 'zz_test_a';

if (!STAGING) { console.error('STAGING_DATABASE_URL is required'); process.exit(2); }
const prodUrl = (dotenv.parse(await fs.readFile('.env').catch(() => '')) || {}).DATABASE_URL;
if (prodUrl && prodUrl === STAGING) { console.error('Refusing to run against the production database.'); process.exit(2); }

const sql = postgres(STAGING, { max: 2, prepare: false });
let passed = 0;
const failures = [];

async function check(name, fn) {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${e.message}`); }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

async function api(method, p, { token, cohort, body } = {}) {
  const res = await fetch(APP + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cohort ? { 'x-cohort': cohort } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
}

const tag = crypto.randomBytes(3).toString('hex');
const adminEmail = `zz-admin-${tag}@test.invalid`;
const studentEmail = `zz-student-${tag}@test.invalid`;
let adminId, adminToken, studentId, studentToken, cohortAId, defaultCohort;

try {
  console.log(`app: ${APP}\ndb:  ${new URL(STAGING).hostname}:${new URL(STAGING).port}${new URL(STAGING).pathname}\n`);

  [defaultCohort] = await sql`SELECT id, schema_name FROM core.cohorts WHERE is_default`;
  assert(defaultCohort, 'no default cohort in registry');
  const [archived] = await sql`SELECT id FROM core.cohorts WHERE status = 'archived' ORDER BY id LIMIT 1`;

  // test admin (a global account; the app creates its users row in each running cohort on first use)
  adminId = crypto.randomUUID();
  await sql`INSERT INTO core.accounts (id, email, password_hash, role, first_name, last_name)
            VALUES (${adminId}, ${adminEmail}, ${await bcrypt.hash(PASSWORD, 10)}, 'admin', 'ZZ', 'Admin')`;
  const login = await api('POST', '/api/auth/login', { body: { email: adminEmail, password: PASSWORD } });
  assert(login.status === 200 && login.json.token, `admin login failed: ${login.status} ${JSON.stringify(login.json)}`);
  adminToken = login.json.token;

  console.log('1. provision a cohort');
  await check('POST /api/admin/cohorts creates zz_test_a and it reaches running', async () => {
    const r = await api('POST', '/api/admin/cohorts', { token: adminToken, body: { schema_name: TEST_SCHEMA, label: 'ZZ Test A', starts_on: '2026-11-01' } });
    assert(r.status === 201, `status ${r.status}: ${JSON.stringify(r.json)}`);
    cohortAId = r.json.id;
    const [c] = await sql`SELECT status FROM core.cohorts WHERE id = ${cohortAId}`;
    assert(c.status === 'running', `status is ${c.status}`);
  });
  await check('drift checker passes for the new cohort', async () => {
    const rep = await checkDrift(sql, { only: TEST_SCHEMA, reference: defaultCohort.schema_name });
    assert(rep.length === 1 && rep[0].strict.length === 0, JSON.stringify(rep[0]?.strict?.slice(0, 5)));
  });

  console.log('2. student creation is tied to a cohort');
  await check('create student in zz_test_a; absent from the default cohort list', async () => {
    const r = await api('POST', '/api/admin/students', { token: adminToken, cohort: defaultCohort.schema_name,
      body: { cohort_id: cohortAId, first_name: 'ZZ', last_name: 'Student', email: studentEmail } });
    assert(r.status === 201, `create: ${r.status} ${JSON.stringify(r.json)}`);
    studentId = r.json.student.id;
    const inDefault = await api('GET', '/api/admin/students', { token: adminToken, cohort: defaultCohort.schema_name });
    assert(!inDefault.json.students.some((s) => s.email === studentEmail), 'student leaked into the default cohort');
    const inA = await api('GET', '/api/admin/students', { token: adminToken, cohort: TEST_SCHEMA });
    assert(inA.json.students.some((s) => s.email === studentEmail), 'student missing from zz_test_a');
  });
  await check('cohort_id is required', async () => {
    const r = await api('POST', '/api/admin/students', { token: adminToken, body: { first_name: 'A', last_name: 'B', email: `x-${tag}@test.invalid` } });
    assert(r.status === 400, `status ${r.status}`);
  });
  await check('nonexistent and archived cohort ids are rejected with 422', async () => {
    const bad = await api('POST', '/api/admin/students', { token: adminToken, body: { cohort_id: 32000, first_name: 'A', last_name: 'B', email: `y-${tag}@test.invalid` } });
    assert(bad.status === 422, `nonexistent: ${bad.status}`);
    if (archived) {
      const arch = await api('POST', '/api/admin/students', { token: adminToken, body: { cohort_id: archived.id, first_name: 'A', last_name: 'B', email: `z-${tag}@test.invalid` } });
      assert(arch.status === 422, `archived: ${arch.status}`);
    }
  });
  await check('duplicate membership is rejected with 409', async () => {
    const r = await api('POST', '/api/admin/students', { token: adminToken, body: { cohort_id: cohortAId, first_name: 'ZZ', last_name: 'Student', email: studentEmail } });
    assert(r.status === 409, `status ${r.status}`);
  });
  await check('direct SQL insert into zz_test_a.users without a membership fails (FK)', async () => {
    let code = null;
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL search_path TO "${TEST_SCHEMA}", core`);
        await tx.unsafe(`INSERT INTO users (email, password_hash, role) VALUES ('nomember-${tag}@test.invalid', 'x', 'student')`);
      });
    } catch (e) { code = e.code; }
    assert(code === '23503', `expected FK violation 23503, got ${code}`);
  });

  await check('adding faculty creates a global account + membership (no default password)', async () => {
    const email = `zz-faculty-${tag}@test.invalid`;
    const r = await api('POST', '/api/admin/faculty-hours', { token: adminToken, cohort: TEST_SCHEMA, body: { firstName: 'ZZ', lastName: 'Faculty', email, designation: 'Test' } });
    assert(r.status === 200 && r.json.success, `create faculty: ${r.status} ${JSON.stringify(r.json)}`);
    const [a] = await sql`SELECT id, role FROM core.accounts WHERE email = ${email}`;
    assert(a && a.role === 'faculty', 'account missing');
    const [m] = await sql`SELECT status FROM core.cohort_memberships WHERE account_id = ${a.id} AND cohort_id = ${cohortAId}`;
    assert(m?.status === 'active', 'membership missing');
    const bad = await api('POST', '/api/auth/login', { body: { email, password: 'cipd@123' } });
    assert(bad.status === 401, 'the old default password must not work: ' + bad.status);
    const dup = await api('POST', '/api/admin/faculty-hours', { token: adminToken, cohort: TEST_SCHEMA, body: { firstName: 'ZZ', lastName: 'Faculty', email } });
    assert(dup.status === 409, 'duplicate faculty: ' + dup.status);
  });

  console.log('3. cohort resolution follows memberships, not the header');
  await sql`UPDATE core.accounts SET password_hash = ${await bcrypt.hash(PASSWORD, 10)} WHERE id = ${studentId}`;
  await sql`SELECT pg_notify('cohorts_changed', 'test')`; // what another app process would send; clears the app's caches
  await new Promise((r) => setTimeout(r, 500));
  const sl = await api('POST', '/api/auth/login', { body: { email: studentEmail, password: PASSWORD } });
  studentToken = sl.json?.token;
  await check('student login works and defaults to their cohort', async () => {
    assert(sl.status === 200 && studentToken, `login: ${sl.status}`);
    assert(sl.json.defaultCohort === TEST_SCHEMA, `defaultCohort=${sl.json.defaultCohort}`);
  });
  await check('student sending x-cohort for another cohort is served their own', async () => {
    const r = await api('GET', '/api/auth/me', { token: studentToken, cohort: defaultCohort.schema_name });
    assert(r.status === 200 && r.json.user.cohort === TEST_SCHEMA, `me.cohort=${r.json?.user?.cohort} status=${r.status}`);
  });
  await check('a student cannot reach admin APIs', async () => {
    const r = await api('GET', '/api/admin/students', { token: studentToken });
    assert(r.status === 403, `status ${r.status}`);
  });

  console.log('4. one password per person');
  await check('change password, then log in again with the new one', async () => {
    const np = PASSWORD + 'x1';
    const r = await api('POST', '/api/auth/update-password', { token: studentToken, body: { currentPassword: PASSWORD, newPassword: np } });
    assert(r.status === 200, `update-password: ${r.status} ${JSON.stringify(r.json)}`);
    const again = await api('POST', '/api/auth/login', { body: { email: studentEmail, password: np } });
    assert(again.status === 200, `re-login: ${again.status}`);
    const me = await api('GET', '/api/auth/me', { token: again.json.token, cohort: defaultCohort.schema_name });
    assert(me.status === 200, `me: ${me.status}`);
    studentToken = again.json.token;
  });

  console.log('5. transfer keeps history');
  await check('transfer zz_test_a -> default cohort', async () => {
    const r = await api('POST', `/api/admin/students/${studentId}/transfer`, { token: adminToken, cohort: TEST_SCHEMA, body: { to_cohort_id: defaultCohort.id } });
    assert(r.status === 200, `transfer: ${r.status} ${JSON.stringify(r.json)}`);
    const m = await sql`SELECT cohort_id, status FROM core.cohort_memberships WHERE account_id = ${studentId} ORDER BY cohort_id`;
    const old = m.find((x) => x.cohort_id === cohortAId), cur = m.find((x) => x.cohort_id === defaultCohort.id);
    assert(old?.status === 'transferred_out', `old membership ${old?.status}`);
    assert(cur?.status === 'active', `new membership ${cur?.status}`);
    const [u] = await sql.unsafe(`SELECT is_active FROM "${TEST_SCHEMA}".users WHERE id = $1`, [studentId]);
    assert(u && u.is_active === false, 'old users row should be inactive but still exist');
  });
  await check('transferred-out membership is read-only for the student', async () => {
    const r = await api('PATCH', '/api/students/mac', { token: studentToken, cohort: TEST_SCHEMA, body: { mac_address: 'AA:BB:CC:DD:EE:FF' } });
    assert(r.status === 409, `status ${r.status}`);
  });

  console.log('6. archived cohorts are read-only');
  await check('archive zz_test_a; reads work, writes get 409', async () => {
    const r = await api('PATCH', `/api/admin/cohorts/${cohortAId}`, { token: adminToken, body: { status: 'archived' } });
    assert(r.status === 200, `archive: ${r.status} ${JSON.stringify(r.json)}`);
    const read = await api('GET', '/api/admin/students', { token: adminToken, cohort: TEST_SCHEMA });
    assert(read.status === 200, `read: ${read.status}`);
    const write = await api('POST', '/api/admin/sessions', { token: adminToken, cohort: TEST_SCHEMA, body: {} });
    assert(write.status === 409, `write: ${write.status}`);
  });
  await check('cannot add students to an archived cohort', async () => {
    const r = await api('POST', '/api/admin/students', { token: adminToken, body: { cohort_id: cohortAId, first_name: 'N', last_name: 'M', email: `late-${tag}@test.invalid` } });
    assert(r.status === 422, `status ${r.status}`);
  });
  await check('schema_name is immutable', async () => {
    const r = await api('PATCH', `/api/admin/cohorts/${cohortAId}`, { token: adminToken, body: { schema_name: 'zz_other' } });
    assert(r.status === 400, `status ${r.status}`);
  });

  console.log('7. no fall-through between schemas');
  await check("default cohort's search_path cannot see public-only objects", async () => {
    const [{ v, c }] = await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO "${defaultCohort.schema_name}", core`);
      return tx.unsafe(`SELECT to_regclass('admin_dashboard_summary') AS v, to_regclass('public.cohorts') AS c`);
    });
    assert(v === null, `admin_dashboard_summary resolved to ${v}`);
    void c;
  });

  console.log('8. cleanup & hard delete');
  await check('delete the student from the default cohort (typed-email confirmation)', async () => {
    const wrong = await api('DELETE', `/api/admin/students/${studentId}`, { token: adminToken, cohort: defaultCohort.schema_name, body: { confirm: 'nope@x.invalid' } });
    assert(wrong.status === 400, `wrong confirm: ${wrong.status}`);
    const ok = await api('DELETE', `/api/admin/students/${studentId}`, { token: adminToken, cohort: defaultCohort.schema_name, body: { confirm: studentEmail } });
    assert(ok.status === 200, `delete: ${ok.status} ${JSON.stringify(ok.json)}`);
  });
  await check('cohort-delete.mjs backs up and removes zz_test_a', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cipd-backup-'));
    const code = await deleteCohort(['--cohort', TEST_SCHEMA, '--confirm', TEST_SCHEMA, '--url', STAGING, '--backup-dir', dir]);
    assert(code === 0, `exit ${code}`);
    const files = await fs.readdir(dir);
    assert(files.length === 1 && (await fs.stat(path.join(dir, files[0]))).size > 0, 'backup file missing/empty');
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM pg_namespace WHERE nspname = ${TEST_SCHEMA}`;
    const [{ m }] = await sql`SELECT count(*)::int AS m FROM core.cohort_memberships WHERE cohort_id = ${cohortAId}`;
    const [{ r }] = await sql`SELECT count(*)::int AS r FROM core.cohorts WHERE id = ${cohortAId}`;
    assert(n === 0 && m === 0 && r === 0, `leftovers: schema=${n} memberships=${m} registry=${r}`);
    await fs.rm(dir, { recursive: true, force: true });
  });
  await check('the default cohort cannot be hard-deleted', async () => {
    const code = await deleteCohort(['--cohort', defaultCohort.schema_name, '--confirm', defaultCohort.schema_name, '--url', STAGING]);
    assert(code !== 0, 'delete of the default cohort was not refused');
  });
} finally {
  // best-effort cleanup of everything this run created
  try {
    await sql.begin(async (tx) => {
      for (const c of await tx`SELECT schema_name FROM core.cohorts WHERE status IN ('running','archived')`) {
        await tx.unsafe(`DELETE FROM "${c.schema_name}".users WHERE id = $1`, [adminId]).catch(() => {});
      }
    }).catch(() => {});
    if (adminId) {
      await sql`DELETE FROM core.cohort_memberships WHERE account_id = ${adminId}`;
      await sql`DELETE FROM core.accounts WHERE id = ${adminId}`;
    }
    await sql`DELETE FROM core.accounts WHERE email LIKE ${'%' + tag + '@test.invalid'} AND id <> ${adminId ?? crypto.randomUUID()}`.catch(() => {});
  } catch (e) { console.log('cleanup warning:', e.message); }
  await sql.end({ timeout: 5 });
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('Failed:\n - ' + failures.join('\n - ')); process.exit(1); }
