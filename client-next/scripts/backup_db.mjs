/**
 * CiPD ERP — Full Database Backup Script
 * Uses Supabase REST API (HTTPS) — works even when direct PostgreSQL is blocked.
 * Run from: d:\cipd_erp\client-next
 * Usage: node scripts/backup_db.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabase = createClient(
  'https://pvqxzbabstyhskhydbvl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cXh6YmFic3R5aHNraHlkYnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk4MDk1NiwiZXhwIjoyMDg4NTU2OTU2fQ.pAJKPZSmaKv60YVhtDBGGRg2bSH15ZmgV8hAeLWtMC4',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TABLES = [
  'users', 'students', 'faculty', 'courses', 'course_enrollments',
  'sessions', 'session_types', 'categories', 'skills', 'session_skills',
  'venues', 'attendance_records', 'attendance_ping_logs', 'assignments',
  'assignment_submissions', 'feedback_questions', 'feedback_responses',
  'feedback_sessions', 'notifications', 'session_materials',
  'student_performance_snapshots', 'system_settings',
];

async function fetchAllRows(table) {
  let allRows = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1);
    if (error) { console.log(`  ⚠ ${table}: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return allRows;
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.resolve(__dirname, '../../backups/cipd_backup_' + timestamp);
  fs.mkdirSync(backupDir, { recursive: true });

  console.log('\n📦 CiPD Database Backup');
  console.log('📁 Saving to: ' + backupDir + '\n');

  const summary = {};
  for (const table of TABLES) {
    process.stdout.write('  Backing up ' + table + '...');
    const rows = await fetchAllRows(table);
    fs.writeFileSync(path.join(backupDir, table + '.json'), JSON.stringify(rows, null, 2));
    summary[table] = rows.length;
    console.log(' ✓ ' + rows.length + ' rows');
  }

  const manifest = {
    backup_time: new Date().toISOString(),
    project: 'pvqxzbabstyhskhydbvl',
    tables: summary,
    total_rows: Object.values(summary).reduce((a, b) => a + b, 0),
  };
  fs.writeFileSync(path.join(backupDir, '_manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('\n═══════════════════════════════════════');
  console.log('✅ Backup Complete!');
  console.log('📁 Location: ' + backupDir);
  console.log('📊 Total rows: ' + manifest.total_rows);
  console.log('═══════════════════════════════════════\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
