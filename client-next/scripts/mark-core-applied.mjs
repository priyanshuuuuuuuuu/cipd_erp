// node scripts/mark-core-applied.mjs 0001 0002 0003 0004 [--url <DATABASE_URL>] [--yes]
//
// Records core migrations as applied WITHOUT running them (the core counterpart of
// `npm run migrate -- --mark-applied <v> --cohort <schema>`). Use it when a database was set up
// outside the runner and already contains the objects those migrations create.
// Without --yes it only prints what it would record.
import postgres from 'postgres';
import dotenv from 'dotenv';
import { loadMigrations, acquireLock } from '../lib/migrator.mjs';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: false, quiet: true });

const argv = process.argv.slice(2);
const urlIdx = argv.indexOf('--url');
const url = urlIdx >= 0 ? argv[urlIdx + 1] : process.env.DATABASE_URL;
const yes = argv.includes('--yes');
const versions = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--url');

if (!url || !versions.length) {
  console.error('usage: node scripts/mark-core-applied.mjs <version...> [--url <DATABASE_URL>] [--yes]');
  process.exit(2);
}
const u = new URL(url);
console.log(`target: ${u.hostname}:${u.port || 5432}${u.pathname}`);

const files = await loadMigrations('core');
const chosen = versions.map((v) => {
  const f = files.find((x) => x.version === v);
  if (!f) { console.error(`No core migration with version ${v}`); process.exit(2); }
  return f;
});

const sql = postgres(url, { max: 3, prepare: false }); // the advisory lock reserves one connection
const release = await acquireLock(sql);
try {
  for (const f of chosen) {
    const [row] = await sql`SELECT executed FROM core.schema_migrations WHERE scope = 'core' AND version = ${f.version}`;
    if (row) { console.log(`core/${f.file}: already recorded`); continue; }
    if (!yes) { console.log(`core/${f.file}: would record as applied (re-run with --yes)`); continue; }
    await sql`INSERT INTO core.schema_migrations (scope, version, checksum, executed) VALUES ('core', ${f.version}, ${f.checksum}, false)`;
    console.log(`core/${f.file}: recorded as applied (not executed)`);
  }
} finally {
  await release();
  await sql.end();
}
