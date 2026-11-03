// node scripts/create-app-role.mjs --url <ADMIN/SUPERUSER DATABASE_URL> [--role cipd_app] [--apply]
//
// Creates a non-superuser login role for the app and the notification service, and makes it the OWNER of the
// objects in `core` and every cohort schema, so the app no longer runs as `postgres`.
//   - dry run (default) prints the SQL
//   - --apply runs it in ONE transaction
//   - the password is read from APP_DB_PASSWORD (never put it on the command line)
// Afterwards point DATABASE_URL (app + notification-service) at the new role. Keep `postgres` for manual admin
// work and for `npm run migrate` on deploy if you prefer (owners can run the migrations too).
// Row-level security is already disabled on all tables (cohort/0002), so behaviour does not change.
import postgres from 'postgres';
import dotenv from 'dotenv';
import { pathToFileURL } from 'node:url';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: false, quiet: true });

const qid = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";

export async function buildStatements(sql, role, password, dbName) {
  const out = [];
  const exists = (await sql`SELECT 1 FROM pg_roles WHERE rolname = ${role}`).length > 0;
  out.push(exists
    ? `ALTER ROLE ${qid(role)} LOGIN PASSWORD ${lit(password)} NOSUPERUSER NOCREATEDB NOCREATEROLE`
    : `CREATE ROLE ${qid(role)} LOGIN PASSWORD ${lit(password)} NOSUPERUSER NOCREATEDB NOCREATEROLE`);
  out.push(`GRANT CONNECT, CREATE ON DATABASE ${qid(dbName)} TO ${qid(role)}`);

  const cohorts = await sql`SELECT schema_name FROM core.cohorts WHERE status IN ('running','archived','provisioning','failed') ORDER BY id`;
  const schemas = ['core', ...cohorts.map((c) => c.schema_name)].filter((s, i, a) => a.indexOf(s) === i);

  for (const s of schemas) {
    const [{ ok }] = await sql`SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = ${s}) AS ok`;
    if (!ok) continue;
    out.push(`ALTER SCHEMA ${qid(s)} OWNER TO ${qid(role)}`);
    const tables = await sql`SELECT c.relname, c.relkind FROM pg_class c
                              WHERE c.relnamespace = ${s}::regnamespace AND c.relkind IN ('r','p','v','m','S')
                                AND NOT (${s} = 'public' AND c.relname = 'wifi_snapshots')
                                AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype IN ('a','i') AND d.classid = 'pg_class'::regclass AND c.relkind = 'S')`;
    for (const t of tables) {
      const kind = { r: 'TABLE', p: 'TABLE', v: 'VIEW', m: 'MATERIALIZED VIEW', S: 'SEQUENCE' }[t.relkind];
      out.push(`ALTER ${kind} ${qid(s)}.${qid(t.relname)} OWNER TO ${qid(role)}`);
    }
    const funcs = await sql`SELECT p.oid::regprocedure::text AS sig FROM pg_proc p WHERE p.pronamespace = ${s}::regnamespace AND p.prokind = 'f'`;
    for (const f of funcs) out.push(`ALTER FUNCTION ${f.sig} OWNER TO ${qid(role)}`);
    const types = await sql`SELECT t.typname FROM pg_type t WHERE t.typnamespace = ${s}::regnamespace AND t.typtype = 'e'`;
    for (const t of types) out.push(`ALTER TYPE ${qid(s)}.${qid(t.typname)} OWNER TO ${qid(role)}`);
  }

  // Legacy column defaults call extensions.uuid_generate_v4(); the role must be able to run it.
  const [{ ext }] = await sql`SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') AS ext`;
  if (ext) {
    out.push(`GRANT USAGE ON SCHEMA extensions TO ${qid(role)}`);
    out.push(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO ${qid(role)}`);
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const url = opt('url') || process.env.DATABASE_URL;
  const role = opt('role') || 'cipd_app';
  const apply = argv.includes('--apply');
  const password = process.env.APP_DB_PASSWORD;
  if (!url) { console.error('--url (a superuser DATABASE_URL) is required'); return 2; }
  if (!/^[a-z_][a-z0-9_]*$/.test(role)) { console.error('invalid role name'); return 2; }
  if (!password || password.length < 16) { console.error('Set APP_DB_PASSWORD (at least 16 characters) in the environment.'); return 2; }

  const u = new URL(url);
  console.log(`target: ${u.hostname}:${u.port || 5432}${u.pathname}  role: ${role}  mode: ${apply ? 'APPLY' : 'dry run'}`);
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const stmts = await buildStatements(sql, role, password, u.pathname.slice(1));
    if (!apply) {
      for (const s of stmts) console.log(s.replace(/PASSWORD '.*?'/, "PASSWORD '********'") + ';');
      console.log(`\n${stmts.length} statements. Re-run with --apply to execute.`);
      return 0;
    }
    await sql.begin(async (tx) => { for (const s of stmts) await tx.unsafe(s); });
    console.log(`applied ${stmts.length} statements. Now point DATABASE_URL at ${role}.`);
    return 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c), (e) => { console.error(e.message || e); process.exit(1); });
}
