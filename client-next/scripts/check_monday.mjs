import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: sessions } = await supabase.from('sessions').select('*').in('session_date', ['2026-03-09']);
  console.log('Sessions for 2026-03-09:');
  console.log(sessions.map(s => ({ id: s.id, status: s.status })));
  
  const { data: records, error } = await supabase.from('attendance_records').select('*').in('session_id', ['dcd4b897-e8a1-4049-ac22-9a5c530b9c40']);
  
  console.log('Attendance records for explicitly filled session:');
  console.log(records);
  if (error) console.error(error);
}

check().catch(console.error);
