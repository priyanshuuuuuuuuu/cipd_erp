import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Replace with actual Supabase details or use .env
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvqxzbabstyhskhydbvl.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Export it before running.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runSeed() {
  console.log("Seeding weekly attendance data...");

  // Get Monday of current week
  const curr = new Date();
  const first = curr.getDate() - curr.getDay() + 1; // 1 means Monday
  const monday = new Date(curr.setDate(first));
  
  // 1. Get Faculty ID
  const { data: facultyData } = await supabase.from('users').select('id').eq('role', 'faculty').limit(1);
  if (!facultyData || facultyData.length === 0) { console.error("No faculty found"); return; }
  const facultyId = facultyData[0].id;

  // 2. Get Course ID
  const { data: courseData } = await supabase.from('courses').select('id').limit(1);
  if (!courseData || courseData.length === 0) { console.error("No courses found"); return; }
  const courseId = courseData[0].id;

  // 3. Get Venue ID
  const { data: venueData } = await supabase.from('venues').select('id').limit(1);
  const venueId = venueData?.[0]?.id || null;

  // 4. Get Enrolled Students for this course
  const { data: enrollments } = await supabase.from('enrollments').select('student_id').eq('course_id', courseId);
  const enrolledStudents = enrollments || [];

  if (enrolledStudents.length === 0) { console.error("No students enrolled in course", courseId); return; }

  console.log(`Course ${courseId} has ${enrolledStudents.length} enrolled students.`);

  // Loop from Monday to Friday (5 days)
  for (let i = 0; i < 5; i++) {
    const sessionDate = new Date(monday);
    sessionDate.setDate(monday.getDate() + i);
    const dateStr = sessionDate.toISOString().split('T')[0];

    // Check if a session already exists to avoid duplicates
    const { data: existingSessions } = await supabase.from('sessions')
        .select('id')
        .eq('course_id', courseId)
        .eq('session_date', dateStr)
        .limit(1);

    let sessionId;

    if (existingSessions && existingSessions.length > 0) {
        sessionId = existingSessions[0].id;
        console.log(`Using existing session for ${dateStr} with ID ${sessionId}`);
    } else {
        // Create session
        const { data: sessionData, error: sessionErr } = await supabase.from('sessions').insert({
          course_id: courseId,
          faculty_id: facultyId,
          venue_id: venueId,
          title: `Lec ${i + 1} - Core Topics (Seeded)`,
          session_date: dateStr,
          start_time: '10:00:00',
          end_time: '11:00:00',
          status: 'completed'
        }).select('id').single();

        if (sessionErr) { console.error("Error creating session:", sessionErr); continue; }
        sessionId = sessionData.id;
        console.log(`Created session for ${dateStr} with ID ${sessionId}`);
    }

    // Check if attendance already exists for this session
    const { data: existingAttendance } = await supabase.from('attendance_records')
        .select('id')
        .eq('session_id', sessionId)
        .limit(1);

    if (existingAttendance && existingAttendance.length > 0) {
        console.log(`Attendance already exists for session ${sessionId}, skipping insertion.`);
        continue;
    }

    // Create attendance records
    const attendanceRecords = enrolledStudents.map(student => {
      const rand = Math.random() * 100;
      let status = 'present';
      if (rand >= 85 && rand < 95) status = 'absent';
      else if (rand >= 95) status = 'late';

      return {
        session_id: sessionId,
        student_id: student.student_id,
        status: status,
        marked_by: facultyId,
        marked_at: new Date().toISOString()
      };
    });

    const { error: attErr } = await supabase.from('attendance_records').insert(attendanceRecords);
    if (attErr) {
        console.error("Error inserting attendance records:", attErr);
    } else {
        console.log(`  -> Inserted ${attendanceRecords.length} attendance records`);
    }
  }

  console.log("Seeding complete.");
}

runSeed().catch(console.error);
