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

async function forceSeed() {
  const curr = new Date();
  const currentDay = curr.getDay();
  // We need to match the API's date calculation exactly where Monday is diffToMonday days ago
  const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
  const monday = new Date();
  monday.setDate(curr.getDate() - diffToMonday);

  // Force time to midnight for clean splitting
  monday.setHours(0,0,0,0);
  
  // Get components
  const { data: faculty } = await supabase.from('users').select('id').eq('role', 'faculty').limit(1);
  const facultyId = faculty[0].id;
  const { data: courses } = await supabase.from('courses').select('id').limit(1);
  const courseId = courses[0].id;
  const { data: students } = await supabase.from('enrollments').select('student_id').eq('course_id', courseId);
  
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    
    // Find session or create it
    let { data: session } = await supabase.from('sessions').select('id').eq('course_id', courseId).eq('session_date', dateStr).limit(1);
    let sessionId;
    
    if (session && session.length > 0) {
       sessionId = session[0].id;
       // force it to completed
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
          const rand = Math.random();
          let status = 'present';
          if (rand > 0.85) status = 'absent';
          return { session_id: sessionId, student_id: s.student_id, status, marked_by: facultyId };
        });
        await supabase.from('attendance_records').insert(records);
        console.log(`Inserted ${records.length} records for ${dateStr}`);
    } else {
        console.log(`Attendance already exists for ${dateStr}`);
    }
  }
}

forceSeed().catch(console.error);
