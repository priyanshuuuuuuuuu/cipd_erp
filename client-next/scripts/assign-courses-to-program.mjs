// Moves the legacy/unassigned domain courses of a cohort into a program
// (default: iPD-CP in the "july" cohort), so they show under
// /admin/programs instead of "Shared / legacy courses".
//
// It UPDATES existing rows (program_id, and code when missing) rather than
// inserting copies and deleting the originals, so sessions, enrollments,
// categories and faculty links that reference the course ids stay intact.
//
// Usage (point DATABASE_URL at the cipd DB; dry-run unless --apply):
//   DATABASE_URL=postgres://... node scripts/assign-courses-to-program.mjs
//   DATABASE_URL=postgres://... node scripts/assign-courses-to-program.mjs --apply
// Options: --cohort=july  --program=iPD-CP
import postgres from 'postgres';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const APPLY = process.argv.includes('--apply');
const COHORT = arg('cohort', 'july');
const PROGRAM = arg('program', 'iPD-CP');

const DOMAINS = [
  ['Business & Leadership', 'BL101'],
  ['Capstone', 'CAP101'],
  ['Design & UI', 'DUI101'],
  ['Electronics & Basics', 'EB101'],
  ['Embedded Systems & IOT', 'ESI101'],
  ['Entrepreneurship', 'ENT101'],
  ['Product Development', 'PD101'],
  ['Software & App Development', 'SAD101'],
];

if (!process.env.DATABASE_URL) { console.error('Set DATABASE_URL.'); process.exit(1); }
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const [cohort] = await sql`SELECT schema_name, label, status FROM core.cohorts WHERE schema_name = ${COHORT} OR lower(label) = lower(${COHORT}) LIMIT 1`;
  if (!cohort) throw new Error(`Cohort "${COHORT}" not found in core.cohorts.`);
  const [program] = await sql`SELECT id, name FROM core.programs WHERE lower(name) = lower(${PROGRAM})`;
  if (!program) throw new Error(`Program "${PROGRAM}" not found in core.programs.`);
  const schema = sql(cohort.schema_name);
  console.log(`Cohort: ${cohort.label} (${cohort.schema_name}, ${cohort.status}) | Program: ${program.name} (#${program.id}) | ${APPLY ? 'APPLY' : 'dry run'}`);

  const existing = await sql`SELECT id, name, code, program_id FROM ${schema}.courses`;
  const usedCodes = new Set(existing.map((c) => c.code).filter(Boolean));

  await sql.begin(async (tx) => {
    for (const [name, defaultCode] of DOMAINS) {
      const row = existing.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
      if (!row) {
        console.log(`  + insert   ${name} [${defaultCode}] (not present)`);
        if (APPLY) await tx`INSERT INTO ${schema}.courses (name, code, description, program_id) VALUES (${name}, ${defaultCode}, ${name + ' domain - iPD CP programme'}, ${program.id})`;
        continue;
      }
      if (row.program_id === program.id && row.code) { console.log(`  = ok       ${name} (already in program)`); continue; }
      let code = row.code || defaultCode;
      if (!row.code && usedCodes.has(code)) throw new Error(`Code ${code} already used by another course; edit DOMAINS.`);
      usedCodes.add(code);
      console.log(`  ~ assign   ${name} [${code}] (was program_id=${row.program_id ?? 'NULL'}, code=${row.code ?? 'NULL'})`);
      if (APPLY) await tx`UPDATE ${schema}.courses SET program_id = ${program.id}, code = ${code} WHERE id = ${row.id}`;
    }
  });
  console.log(APPLY ? 'Done.' : 'Dry run only. Re-run with --apply to write.');
} catch (e) {
  console.error('Failed:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
