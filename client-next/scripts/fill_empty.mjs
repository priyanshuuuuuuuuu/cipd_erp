import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fillEmpty() {
  const dates = ['2026-03-15', '2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20', '2026-03-21'];
  
  const { data: sessions } = await supabase.from('sessions').select('id, session_date').in('session_date', dates);
  const { data: students } = await supabase.from('course_enrollments').select('student_id').limit(1);
  const { data: faculty } = await supabase.from('faculty').select('id').limit(1);

  if (!students || students.length === 0 || !faculty || faculty.length === 0) {
      console.log("No students or faculty to map attendance.");
      return;
  }

  const sid = students[0].student_id;
  const fid = faculty[0].id;

  for (let s of sessions) {
      const { data: exist } = await supabase.from('attendance_records').select('id').eq('session_id', s.id);
      if (!exist || exist.length === 0) {
          const { error } = await supabase.from('attendance_records').insert({
              session_id: s.id,
              student_id: sid,
              status: 'present'
          });
          if (error) {
              console.error('Insert Error for', s.id, ':', error);
          } else {
              console.log(`Filled 100% attendance for session ${s.id} on ${s.session_date}`);
          }
      } else {
          await supabase.from('attendance_records').update({ status: 'present' }).eq('session_id', s.id);
          console.log(`Updated attendance for session ${s.id} on ${s.session_date}`);
      }
  }
}

fillEmpty().catch(console.error);
