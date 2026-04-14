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

async function fixData() {
    // 1. Get faculty
    const { data: faculty } = await supabase.from('users').select('id').eq('role', 'faculty').limit(1);
    const fid = faculty[0].id;

    // 2. Get course
    const { data: courses } = await supabase.from('courses').select('id').limit(1);
    const cid = courses[0].id;

    // 3. Get student
    const { data: enrolls } = await supabase.from('enrollments').select('student_id').eq('course_id', cid).limit(1);
    const sid = enrolls[0].student_id;

    console.log(`Using Faculty ${fid}, Course ${cid}, Student ${sid}`);

    // Delete existing sessions for Mar 9 to ensure fresh state
    await supabase.from('sessions').delete().eq('course_id', cid).eq('session_date', '2026-03-09');

    // 4. Create Mar 9 Session
    const { data: session } = await supabase.from('sessions').insert({
        course_id: cid,
        faculty_id: fid,
        title: 'Guaranteed Mon Class',
        session_date: '2026-03-09',
        start_time: '12:00',
        end_time: '13:00',
        status: 'completed'
    }).select('id').single();

    console.log(`Created Session ${session.id} for 2026-03-09`);

    // 5. Create Attendance for that session
    const { error } = await supabase.from('attendance_records').insert({
        session_id: session.id,
        student_id: sid,
        status: 'present',
        marked_by: fid
    });

    if (error) {
        console.error('Error adding attendance:', error);
    } else {
        console.log('Successfully marked student PRESENT.');
    }
}

fixData().catch(console.error);
