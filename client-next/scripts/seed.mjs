/**
 * CIPD 360 ERP — Database Seed Script
 * 
 * Populates the Supabase/PostgreSQL database with realistic demo data.
 * 
 * Usage:
 *   cd client-next
 *   node scripts/seed.mjs
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// ─── Supabase connection ──────────────────────────────────────────
const SUPABASE_URL = 'https://pvqxzbabstyhskhydbvl.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cXh6YmFic3R5aHNraHlkYnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk4MDk1NiwiZXhwIjoyMDg4NTU2OTU2fQ.pAJKPZSmaKv60YVhtDBGGRg2bSH15ZmgV8hAeLWtMC4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const log = (msg) => console.log(`[seed] ${msg}`);
const err = (msg, e) => { console.error(`[seed] ❌ ${msg}`, e?.message || e); };

// ─── Helpers ──────────────────────────────────────────────────────
function uuid() {
  return crypto.randomUUID();
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// ─── Fixed UUIDs so relationships work ────────────────────────────
const IDS = {
  // Users
  student1: uuid(),
  faculty1: uuid(),
  faculty2: uuid(),
  faculty3: uuid(),
  faculty4: uuid(),
  faculty5: uuid(),
  admin1: uuid(),

  // Courses
  cs301: uuid(),
  phy201: uuid(),
  math101: uuid(),
  eng102: uuid(),
  cs202: uuid(),

  // Venues
  lhc101: uuid(),
  c102: uuid(),
  lhc201: uuid(),
  lab3: uuid(),
  lhB: uuid(),

  // Assignments
  a1: uuid(),
  a2: uuid(),
  a3: uuid(),
  a4: uuid(),
  a5: uuid(),
  a6: uuid(),

  // Feedback questions
  fq1: uuid(),
  fq2: uuid(),
  fq3: uuid(),
};

// ─── SEED ─────────────────────────────────────────────────────────
async function seed() {
  log('Starting seed...');

  // ── 0. CLEANUP — delete in FK-safe order (children first) ──
  log('Cleaning existing data...');
  const tables = [
    'feedback_responses',
    'feedback_questions',
    'assignment_submissions',
    'assignments',
    'session_materials',
    'attendance_ping_logs',
    'attendance_records',
    'sessions',
    'course_enrollments',
    'venues',
    'students',
    'faculty',
    'courses',
    'users',
  ];
  for (const table of tables) {
    let query = supabase.from(table).delete();
    if (table === 'attendance_ping_logs') {
      // It has a BIGSERIAL id, so handle it appropriately
      query = query.neq('id', -1);
    } else {
      query = query.neq('id', '00000000-0000-0000-0000-000000000000');
    }
    const { error } = await query;
    if (error) err(`Cleanup ${table}`, error);
  }
  log('Cleanup done.');

  const password = await bcrypt.hash('student123', 12);
  const facultyPwd = await bcrypt.hash('faculty123', 12);
  const adminPwd = await bcrypt.hash('admin123', 12);

  // ── 1. Users ──
  log('Creating users...');
  const users = [
    { id: IDS.student1, email: 'student@cipd.edu', password_hash: password, role: 'student', first_name: 'Virat', last_name: 'Kohli', is_active: true },
    { id: IDS.faculty1, email: 'anuj.grover@cipd.edu', password_hash: facultyPwd, role: 'faculty', first_name: 'Anuj', last_name: 'Grover', is_active: true },
    { id: IDS.faculty2, email: 'priya.sharma@cipd.edu', password_hash: facultyPwd, role: 'faculty', first_name: 'Pankaj', last_name: 'Jalote', is_active: true },
    { id: IDS.faculty3, email: 'amit.patel@cipd.edu', password_hash: facultyPwd, role: 'faculty', first_name: 'Sneh', last_name: 'Saurabh', is_active: true },
    { id: IDS.faculty4, email: 'neha.gupta@cipd.edu', password_hash: facultyPwd, role: 'faculty', first_name: 'Neha', last_name: 'Gupta', is_active: true },
    { id: IDS.faculty5, email: 'sameer.verma@cipd.edu', password_hash: facultyPwd, role: 'faculty', first_name: 'Sameer', last_name: 'Verma', is_active: true },
    { id: IDS.admin1, email: 'admin@cipd.edu', password_hash: adminPwd, role: 'admin', first_name: 'Admin', last_name: 'User', is_active: true },
  ];
  const { error: usersErr } = await supabase.from('users').insert(users);
  if (usersErr) { err('Users', usersErr); return; }

  // ── 2. Students ──
  log('Creating student profile...');
  const { error: studErr } = await supabase.from('students').insert([
    { id: IDS.student1, enrollment_no: 'EN21CS1042', program_name: 'B.Tech CSE' },
  ]);
  if (studErr) err('Students', studErr);

  // ── 3. Faculty ──
  log('Creating faculty profiles...');
  const { error: facErr } = await supabase.from('faculty').insert([
    { id: IDS.faculty1, designation: 'Professor', years_experience: 15, honorarium_rate_per_hour: 2500 },
    { id: IDS.faculty2, designation: 'Associate Professor', years_experience: 10, honorarium_rate_per_hour: 2000 },
    { id: IDS.faculty3, designation: 'Professor', years_experience: 20, honorarium_rate_per_hour: 3000 },
    { id: IDS.faculty4, designation: 'Assistant Professor', years_experience: 6, honorarium_rate_per_hour: 1500 },
    { id: IDS.faculty5, designation: 'Associate Professor', years_experience: 12, honorarium_rate_per_hour: 2200 },
  ]);
  if (facErr) err('Faculty', facErr);

  // ── 4. Venues ──
  log('Creating venues...');
  const { error: venErr } = await supabase.from('venues').insert([
    { id: IDS.lhc101, name: 'LHC-101', building: 'Lecture Hall Complex' },
    { id: IDS.c102, name: 'C-102', building: 'Science Block' },
    { id: IDS.lhc201, name: 'LHC-201', building: 'Lecture Hall Complex' },
    { id: IDS.lab3, name: 'Lab 3', building: 'Computer Centre' },
    { id: IDS.lhB, name: 'Lecture Hall B', building: 'Main Building' },
  ]);
  if (venErr) err('Venues', venErr);

  // ── 5. Courses ──
  log('Creating courses...');
  const { error: courseErr } = await supabase.from('courses').upsert([
    { id: IDS.cs301, name: 'Data Structures & Algorithms', description: 'Fundamental data structures and algorithm design techniques' },
    { id: IDS.phy201, name: 'Quantum Physics', description: 'Introduction to quantum mechanics and wave functions' },
    { id: IDS.math101, name: 'Calculus II', description: 'Integral calculus, series, and multivariable calculus' },
    { id: IDS.eng102, name: 'Technical Writing', description: 'Professional writing skills for engineers' },
    { id: IDS.cs202, name: 'Database Management Systems', description: 'Relational databases, SQL, and database design' },
  ], { onConflict: 'id' });
  if (courseErr) err('Courses', courseErr);

  // ── 6. Course Enrollments ──
  log('Enrolling student in courses...');
  const enrollments = [IDS.cs301, IDS.phy201, IDS.math101, IDS.eng102, IDS.cs202].map(cid => ({
    id: uuid(), course_id: cid, student_id: IDS.student1,
  }));
  const { error: enrErr } = await supabase.from('course_enrollments').upsert(enrollments, { ignoreDuplicates: true });
  if (enrErr) err('Enrollments', enrErr);

  // ── 7. Sessions (past 30 days — creates attendance data) ──
  log('Creating sessions...');
  const courseSchedule = [
    { course: IDS.cs301, faculty: IDS.faculty1, venue: IDS.lhc101, days: [1, 3, 5], start: '09:00', end: '10:00', title: 'DSA Lecture' },
    { course: IDS.phy201, faculty: IDS.faculty2, venue: IDS.c102, days: [2, 4], start: '11:00', end: '12:00', title: 'Physics Lecture' },
    { course: IDS.math101, faculty: IDS.faculty3, venue: IDS.lhc201, days: [1, 3], start: '14:00', end: '15:00', title: 'Calculus Lecture' },
    { course: IDS.eng102, faculty: IDS.faculty4, venue: IDS.lab3, days: [2], start: '10:00', end: '11:00', title: 'Writing Workshop' },
    { course: IDS.cs202, faculty: IDS.faculty5, venue: IDS.lhB, days: [3, 5], start: '15:00', end: '16:00', title: 'DBMS Lecture' },
  ];

  const sessions = [];
  const sessionMap = {}; // courseId -> [sessionIds]

  for (let daysBack = 42; daysBack >= -7; daysBack--) {
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    const dayOfWeek = date.getDay(); // 0=Sun
    const dateStr = date.toISOString().split('T')[0];
    const isPast = daysBack > 0;

    for (const sched of courseSchedule) {
      if (sched.days.includes(dayOfWeek)) {
        const sid = uuid();
        sessions.push({
          id: sid,
          course_id: sched.course,
          faculty_id: sched.faculty,
          title: sched.title,
          venue_id: sched.venue,
          session_date: dateStr,
          start_time: sched.start,
          end_time: sched.end,
          status: isPast ? 'completed' : 'scheduled',
          created_by: IDS.admin1,
        });
        if (!sessionMap[sched.course]) sessionMap[sched.course] = [];
        sessionMap[sched.course].push(sid);
      }
    }
  }

  // Insert sessions in batches
  for (let i = 0; i < sessions.length; i += 50) {
    const batch = sessions.slice(i, i + 50);
    const { error: sesErr } = await supabase.from('sessions').upsert(batch, { onConflict: 'id' });
    if (sesErr) err(`Sessions batch ${i}`, sesErr);
  }
  log(`Created ${sessions.length} sessions (past & future)`);

  // ── 8. Attendance Records ──
  log('Creating attendance records...');
  const attendanceRecords = [];
  for (const session of sessions) {
    if (session.status !== 'completed') continue;

    // ~80% present, ~10% partial, ~10% absent for realistic data
    const rand = Math.random();
    let status, pings;
    if (rand < 0.78) { status = 'present'; pings = 3 + Math.floor(Math.random() * 3); }
    else if (rand < 0.90) { status = 'partial'; pings = 2; }
    else { status = 'absent'; pings = Math.floor(Math.random() * 2); }

    attendanceRecords.push({
      id: uuid(),
      session_id: session.id,
      student_id: IDS.student1,
      ping_count: pings,
      status,
    });
  }

  for (let i = 0; i < attendanceRecords.length; i += 50) {
    const batch = attendanceRecords.slice(i, i + 50);
    const { error: attErr } = await supabase.from('attendance_records').upsert(batch, { onConflict: 'id' });
    if (attErr) err(`Attendance batch ${i}`, attErr);
  }
  log(`Created ${attendanceRecords.length} attendance records`);

  // ── 9. Session Materials ──
  log('Creating session materials...');
  const materials = [];
  const materialData = [
    { title: 'Intro to DSA', type: 'notes', content: 'Data structures are ways of organizing data.\n\nTypes:\n- Linear: Arrays, Linked Lists, Stacks, Queues\n- Non-linear: Trees, Graphs, Hash Tables\n\nBig-O Notation:\n- O(1) Constant, O(log n) Log, O(n) Linear, O(n²) Quadratic' },
    { title: 'Sorting Algorithms', type: 'slides', content: 'Sorting Algorithms Comparison\n\n1. Bubble Sort – O(n²), stable\n2. Merge Sort – O(n log n), stable, O(n) space\n3. Quick Sort – O(n log n) avg, O(n²) worst\n4. Heap Sort – O(n log n), O(1) space, not stable' },
    { title: 'Wave-Particle Duality', type: 'notes', content: 'Every particle can be described as a particle or a wave.\n\nde Broglie: λ = h / p\n\nHeisenberg Uncertainty Principle: position and momentum cannot both be known precisely.' },
    { title: 'Integration by Parts', type: 'notes', content: 'Formula: ∫u dv = uv - ∫v du\n\nLIATE Rule: Logarithmic > Inverse trig > Algebraic > Trig > Exponential' },
    { title: 'Taylor Series', type: 'pdf', content: 'f(x) = Σ [f⁽ⁿ⁾(a)/n!]·(x-a)ⁿ\n\nCommon:\n- eˣ = 1 + x + x²/2! + ...\n- sin(x) = x - x³/3! + ...\n- cos(x) = 1 - x²/2! + ...' },
    { title: 'Report Structure Guide', type: 'notes', content: '1. Title Page\n2. Abstract\n3. Introduction\n4. Literature Review\n5. Methodology\n6. Results and Discussion\n7. Conclusion\n8. References' },
    { title: 'SQL Joins Reference', type: 'notes', content: '1. INNER JOIN – matching rows in both tables\n2. LEFT JOIN – all left rows, matched right\n3. RIGHT JOIN – all right rows, matched left\n4. FULL OUTER JOIN – all rows from either\n5. CROSS JOIN – Cartesian product' },
    { title: 'Presentation Slides – Intro', type: 'slides', content: 'Slide 1: Welcome & Agenda\nSlide 2: Learning Objectives\nSlide 3: Assessment Breakdown\nSlide 4: Key Textbooks\nSlide 5: Weekly Schedule' },
  ]

  for (const session of sessions) {
    if (session.status !== 'completed') continue;
    
    // ~60% chance a session has a material
    if (Math.random() < 0.6) {
      const matTemplate = materialData[Math.floor(Math.random() * materialData.length)];
      materials.push({
        id: uuid(),
        session_id: session.id,
        course_id: session.course_id, // include course_id to make API easier
        faculty_id: session.faculty_id, // keep track of who uploaded it
        title: matTemplate.title,
        file_url: 'https://example.com/dummy.pdf', // valid URL
        file_type: matTemplate.type,
        content: matTemplate.content,
        created_at: session.session_date,
      });
    }
  }

  // Handle empty materials array (rare but possible if random chance fails for all)
  if (materials.length > 0) {
    const { error: matErr } = await supabase.from('session_materials').upsert(materials, { onConflict: 'id' });
    if (matErr) err('Session materials', matErr);
    log(`Created ${materials.length} materials`);
  } else {
    log('Created 0 materials');
  }
  // ── 10. Assignments ──
  log('Creating assignments...');
  const assignments = [
    { id: IDS.a1, course_id: IDS.cs301, faculty_id: IDS.faculty1, title: 'Linked List Operations', description: 'Implement singly and doubly linked list with all CRUD operations', due_date: daysAgo(30) + 'T23:59:00Z' },
    { id: IDS.a2, course_id: IDS.cs301, faculty_id: IDS.faculty1, title: 'Sorting Comparison Report', description: 'Compare time complexity of Merge Sort, Quick Sort and Heap Sort with benchmarks', due_date: daysAgo(14) + 'T23:59:00Z' },
    { id: IDS.a3, course_id: IDS.phy201, faculty_id: IDS.faculty2, title: 'Wave Equation Analysis', description: 'Analyze Schrodinger wave equation for a particle in a box', due_date: daysAgo(10) + 'T23:59:00Z' },
    { id: IDS.a4, course_id: IDS.cs301, faculty_id: IDS.faculty1, title: 'BST & AVL Trees', description: 'Implement self-balancing AVL tree with rotation operations', due_date: daysFromNow(6) + 'T23:59:00Z' },
    { id: IDS.a5, course_id: IDS.math101, faculty_id: IDS.faculty3, title: 'Integration Techniques', description: 'Solve problems on integration by parts and trigonometric substitution', due_date: daysFromNow(9) + 'T23:59:00Z' },
    { id: IDS.a6, course_id: IDS.eng102, faculty_id: IDS.faculty4, title: 'Technical Report Draft', description: 'Write a technical report on an engineering topic of your choice', due_date: daysFromNow(12) + 'T23:59:00Z' },
  ];

  const { error: asnErr } = await supabase.from('assignments').upsert(assignments, { onConflict: 'id' });
  if (asnErr) err('Assignments', asnErr);

  // ── 11. Assignment Submissions (graded + submitted) ──
  log('Creating assignment submissions...');
  const submissions = [
    { id: uuid(), assignment_id: IDS.a1, student_id: IDS.student1, file_url: 'https://example.com/submissions/linked_list.zip', submitted_at: daysAgo(31) + 'T20:30:00Z', grade: 18, feedback: 'Excellent implementation!' },
    { id: uuid(), assignment_id: IDS.a2, student_id: IDS.student1, file_url: 'https://example.com/submissions/sorting_report.pdf', submitted_at: daysAgo(15) + 'T22:00:00Z', grade: null, feedback: null },
    { id: uuid(), assignment_id: IDS.a3, student_id: IDS.student1, file_url: 'https://example.com/submissions/wave_eq.pdf', submitted_at: daysAgo(11) + 'T18:45:00Z', grade: 16, feedback: 'Good analysis but minor calculation errors in part 3.' },
  ];

  const { error: subErr } = await supabase.from('assignment_submissions').upsert(submissions, { onConflict: 'id' });
  if (subErr) err('Submissions', subErr);

  // ── 12. Feedback Questions ──
  log('Creating feedback questions...');
  const questions = [
    { id: IDS.fq1, question: 'How would you rate the clarity of the lecture?', category: 'Teaching Quality', type: 'rating', active: true },
    { id: IDS.fq2, question: 'Was the pace of the lecture comfortable?', category: 'Pace', type: 'yes_no', active: true },
    { id: IDS.fq3, question: 'Any additional comments or suggestions?', category: 'General', type: 'text', active: true },
  ];

  const { error: fqErr } = await supabase.from('feedback_questions').upsert(questions, { onConflict: 'id' });
  if (fqErr) err('Feedback questions', fqErr);

  // ── 13. Feedback Responses ──
  log('Creating feedback responses...');
  const recentSessions = sessions.slice(-20);
  const feedbackResponses = [];
  for (let i = 0; i < Math.min(8, recentSessions.length); i++) {
    const sid = recentSessions[i].id;
    feedbackResponses.push(
      { id: uuid(), session_id: sid, student_id: IDS.student1, question_id: IDS.fq1, rating: 3 + Math.floor(Math.random() * 3) },
      { id: uuid(), session_id: sid, student_id: IDS.student1, question_id: IDS.fq2, yes_no: Math.random() > 0.3 },
    );
    if (i < 4) {
      const comments = [
        'Great explanation of the concepts.',
        'Could use more real-world examples.',
        'Pace was a bit fast for complex topics.',
        'Very clear step-by-step approach.',
      ];
      feedbackResponses.push(
        { id: uuid(), session_id: sid, student_id: IDS.student1, question_id: IDS.fq3, text_answer: comments[i] },
      );
    }
  }

  const { error: frErr } = await supabase.from('feedback_responses').upsert(feedbackResponses, { onConflict: 'id' });
  if (frErr) err('Feedback responses', frErr);

  log('');
  log('✅ Seed complete!');
  log('');
  log('Login credentials:');
  log('  Student:  student@cipd.edu / student123');
  log('  Faculty:  anuj.grover@cipd.edu / faculty123');
  log('  Admin:    admin@cipd.edu / admin123');
  log('');
}

seed().catch(console.error);
