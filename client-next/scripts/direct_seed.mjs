import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function directSeed() {
  const dates = ['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13'];
  
  // Get components
  const { data: faculty } = await supabase.from('users').select('id').eq('role', 'faculty').limit(1);
  const facultyId = faculty[0].id;
  
  const { data: courses } = await supabase.from('courses').select('id').limit(1);
  const courseId = courses[0].id;
  
  const { data: students } = await supabase.from('enrollments').select('student_id').eq('course_id', courseId);
  
  for (let i = 0; i < dates.length; i++) {
    const dateStr = dates[i];
    
    // Check if session exists for this strict date
    let { data: session } = await supabase.from('sessions').select('id').eq('course_id', courseId).eq('session_date', dateStr).limit(1);
    let sessionId;
    
    if (session && session.length > 0) {
       sessionId = session[0].id;
       await supabase.from('sessions').update({ status: 'completed' }).eq('id', sessionId);
    } else {
       const { data: newSess } = await supabase.from('sessions').insert({
          course_id: courseId, faculty_id: facultyId, title: 'Seeded Lec ' + i, 
          session_date: dateStr, start_time: '10:00', end_time: '11:00', status: 'completed'
       }).select('id').single();
       sessionId = newSess.id;
    }
    
    // Check attendance
    const { data: existAtt } = await supabase.from('attendance_records').select('id').eq('session_id', sessionId);
    if (!existAtt || existAtt.length === 0) {
        const records = students.map(s => {
          return { session_id: sessionId, student_id: s.student_id, status: 'present', marked_by: facultyId };
        });
        await supabase.from('attendance_records').insert(records);
        console.log(`Inserted ${records.length} records for ${dateStr}`);
    } else {
        // Force update to present to fix previous broken loops
        await supabase.from('attendance_records').update({ status: 'present' }).eq('session_id', sessionId);
        console.log(`Updated attendance to present for ${dateStr}`);
    }
  }
}

directSeed().catch(console.error);
