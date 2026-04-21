/**
 * Fix session_skills: re-links skills to sessions using existing DB data
 */
import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE_URL         = 'https://pvqxzbabstyhskhydbvl.supabase.co';
const SUPABASE_SERVICE_KEY = '[REMOVED-ROTATED]';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const EXCEL_PATH = path.resolve(__dirname, '../../Data/Copy of iPD CP Review Sheet.xlsx');

async function main() {
  console.log('\n▶ Reading Excel...');
  const wb = xlsx.readFile(EXCEL_PATH);
  const mainData = xlsx.utils.sheet_to_json(wb.Sheets['main'], { defval: '' });
  console.log(`  ✓ ${mainData.length} rows`);

  // Fetch all sessions from DB (title + date to match)
  console.log('▶ Fetching sessions from DB...');
  const { data: dbSessions } = await supabase
    .from('sessions').select('id, title, session_date');
  console.log(`  ✓ ${dbSessions?.length} sessions`);

  // Build a lookup: "date::title" → session_id
  const sessionLookup = {};
  for (const s of (dbSessions || [])) {
    const key = `${s.session_date}::${(s.title || '').slice(0, 100)}`;
    sessionLookup[key] = s.id;
  }

  // Fetch all skills
  const { data: dbSkills } = await supabase.from('skills').select('id, name');
  const skillByName = {};
  for (const sk of (dbSkills || [])) skillByName[sk.name] = sk.id;
  console.log(`  ✓ ${dbSkills?.length} skills in DB`);

  // Clear existing session_skills
  console.log('▶ Clearing old session_skills...');
  const { error: delErr } = await supabase.from('session_skills').delete().not('session_id', 'is', null);
  if (delErr) console.log(`  ⚠ ${delErr.message}`);

  // Build session_skills from Excel
  const rows = [];
  const seen = new Set();

  for (const row of mainData) {
    const rawDate = row['Date'];
    if (!rawDate) continue;

    let sessionDate;
    if (typeof rawDate === 'number') {
      const d = xlsx.SSF.parse_date_code(rawDate);
      sessionDate = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    } else if (rawDate instanceof Date) {
      sessionDate = rawDate.toISOString().split('T')[0];
    } else {
      sessionDate = String(rawDate).slice(0, 10);
    }

    const topic = String(row['Topic / Module'] || '').trim();
    const domain = String(row['Domain'] || '').trim();
    const instructor = String(row['Instructor'] || '').trim();
    const title = (topic || `${domain || instructor || 'Session'} — ${sessionDate}`).slice(0, 100);
    const key = `${sessionDate}::${title}`;
    const sessionId = sessionLookup[key];
    if (!sessionId) continue;

    const skills = [row['Skill 1'], row['Skill 2'], row['Skill 3'], row['Skill 4']]
      .map(s => String(s || '').trim())
      .filter(s => s && s.toLowerCase() !== 'na');

    for (const skillName of skills) {
      const skillId = skillByName[skillName];
      if (!skillId) continue;
      const dedup = `${sessionId}::${skillId}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      rows.push({ session_id: sessionId, skill_id: skillId });
    }
  }

  console.log(`▶ Inserting ${rows.length} session_skills...`);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('session_skills').insert(rows.slice(i, i+200));
    if (error) console.log(`  ⚠ batch ${i}: ${error.message}`);
    else inserted += Math.min(200, rows.length - i);
  }
  console.log(`  ✓ Inserted ${inserted} session_skills`);
  console.log('\n✅ Done!\n');
}

main().catch(console.error);
