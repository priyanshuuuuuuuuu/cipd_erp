-- =====================================================================================================================
-- Test data for cohort "Test#1" (schema test_1) in the SANDBOX database cipd_test.
--
--   psql "postgresql://postgres:***@192.168.3.190:5432/cipd_test" -v ON_ERROR_STOP=1 -f scripts/test-data/test_1_seed.sql
--
-- * Re-runnable: it first deletes everything a previous run created, then inserts again.
-- * Every row it creates has an id starting with 5eed5eed-, so scripts/test-data/test_1_cleanup.sql can remove it all.
-- * Dates are relative to "today" in IST (the day you run it).
-- * It does NOT queue any emails (notification_stream). In-app notifications are inserted directly. To test the
--   email path, use the app (see the notes at the bottom).
-- * Attendance rows use admin_override = true so the Wi-Fi attendance worker does not overwrite them.
-- * Never run this against the real database `cipd`.
-- =====================================================================================================================

BEGIN;

DO $$ BEGIN
  IF current_database() <> 'cipd_test' THEN
    RAISE EXCEPTION 'Refusing to run: connected to %, expected cipd_test', current_database();
  END IF;
END $$;

SET LOCAL search_path = test_1, core, public;

-- Deterministic seed ids: 5eed5eed + 24 hex chars from md5(key).
CREATE FUNCTION pg_temp.sid(k text) RETURNS uuid LANGUAGE sql IMMUTABLE AS
$$ SELECT ('5eed5eed' || substr(md5(k), 9))::uuid $$;
-- IST wall-clock timestamp -> UTC timestamp (the app stores created_at etc. as UTC).
CREATE FUNCTION pg_temp.utc(ts timestamp) RETURNS timestamp LANGUAGE sql IMMUTABLE AS
$$ SELECT (ts AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'UTC' $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 0. Remove a previous run (same statements as test_1_cleanup.sql)
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TEMP TABLE seed_old_sessions ON COMMIT DROP AS SELECT id FROM sessions WHERE id::text LIKE '5eed5eed%';
CREATE TEMP TABLE seed_old_assign   ON COMMIT DROP AS SELECT id FROM assignments WHERE id::text LIKE '5eed5eed%';

DELETE FROM notification_stream    WHERE id::text LIKE '5eed5eed%' OR session_id IN (SELECT id FROM seed_old_sessions);
DELETE FROM notifications          WHERE id::text LIKE '5eed5eed%' OR session_id IN (SELECT id FROM seed_old_sessions);
DELETE FROM feedback_responses     WHERE id::text LIKE '5eed5eed%' OR session_id IN (SELECT id FROM seed_old_sessions)
                                      OR question_id::text LIKE '5eed5eed%';
DELETE FROM attendance_records     WHERE id::text LIKE '5eed5eed%' OR session_id IN (SELECT id FROM seed_old_sessions);
DELETE FROM session_materials      WHERE session_id IN (SELECT id FROM seed_old_sessions);
DELETE FROM student_attendance_marks WHERE session_id IN (SELECT id FROM seed_old_sessions);
DELETE FROM leave_requests         WHERE id::text LIKE '5eed5eed%' OR session_id IN (SELECT id FROM seed_old_sessions);
DELETE FROM session_change_requests WHERE id::text LIKE '5eed5eed%';
DELETE FROM faculty_leave          WHERE id::text LIKE '5eed5eed%';
DELETE FROM course_posts           WHERE id::text LIKE '5eed5eed%';
DELETE FROM assignment_submissions WHERE id::text LIKE '5eed5eed%' OR assignment_id IN (SELECT id FROM seed_old_assign);
DELETE FROM assignments            WHERE id::text LIKE '5eed5eed%';
DELETE FROM sessions               WHERE id::text LIKE '5eed5eed%';
DELETE FROM feedback_questions     WHERE id::text LIKE '5eed5eed%';

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Lookups (existing Test#1 users / courses / venues)
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TEMP TABLE seed_ctx ON COMMIT DROP AS
SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date AS d,
       (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1) AS admin_id,
       (SELECT id FROM session_types ORDER BY created_at LIMIT 1)            AS stype_id;

CREATE TEMP TABLE seed_fac ON COMMIT DROP AS
SELECT v.key, u.id, u.first_name || ' ' || u.last_name AS name
  FROM (VALUES ('devesh', 'devesh23193@iiitd.ac.in'),   -- COM, Course1
               ('parsh',  'parshjain.j@gmail.com'),     -- IP
               ('fac1',   'parshjain.j1@gmail.com'),    -- Course1
               ('fac2',   'parshslox@gmail.com'))       -- LA
       AS v(key, email)
  JOIN users u ON lower(u.email) = v.email AND u.role = 'faculty';

CREATE TEMP TABLE seed_course ON COMMIT DROP AS SELECT name AS key, id, name FROM courses WHERE name IN ('COM', 'Course1', 'IP', 'LA');

CREATE TEMP TABLE seed_venue ON COMMIT DROP AS
SELECT v.key, (SELECT id FROM venues WHERE name = v.vname LIMIT 1) AS id, v.vname AS name
  FROM (VALUES ('room1', 'CiPD Room1'), ('rnd', 'B001, RnD')) AS v(key, vname);

-- Attendance pattern over the 13 past sessions (session n = character n):
--   P = present, H = partial, A = absent, L = on approved leave.   submits = has filled some feedback forms.
CREATE TEMP TABLE seed_student ON COMMIT DROP AS
SELECT v.email, v.pattern, v.submits, u.id, u.first_name
  FROM (VALUES
          ('parsh23368@iiitd.ac.in',            'PPPPPPPPPPPPP', true ),  -- perfect attendance
          ('priyanshu23406@iiitd.ac.in',        'PPPHPPPPPPHPP', true ),  -- two partials
          ('deveshr51432@gmail.com',            'PAAPAAPAAPAAP', false),  -- ~38%: attendance warnings everywhere
          ('aamanprime+1@gmail.com',            'PPPPLPPPPAPPP', false),  -- one approved leave, one absence
          ('priyanshupandey18112005@gmail.com', 'PPAPPPPPPPPPA', false),  -- LA drops below 75%
          ('priyanshupandeynov18@gmail.com',    'PPPPPPAPHPPPP', false))
       AS v(email, pattern, submits)
  JOIN users u ON lower(u.email) = v.email AND u.role = 'student' AND u.is_active;

DO $$ BEGIN
  IF (SELECT count(*) FROM seed_fac) <> 4 THEN RAISE EXCEPTION 'Expected 4 faculty in test_1, found %', (SELECT count(*) FROM seed_fac); END IF;
  IF (SELECT count(*) FROM seed_course) <> 4 THEN RAISE EXCEPTION 'Expected courses COM, Course1, IP, LA in test_1'; END IF;
  IF (SELECT count(*) FROM seed_student) <> 6 THEN RAISE EXCEPTION 'Expected 6 active students, found %', (SELECT count(*) FROM seed_student); END IF;
  IF EXISTS (SELECT 1 FROM seed_venue WHERE id IS NULL) THEN RAISE EXCEPTION 'Venue CiPD Room1 or "B001, RnD" missing'; END IF;
  IF (SELECT admin_id FROM seed_ctx) IS NULL THEN RAISE EXCEPTION 'No admin user in test_1'; END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Schedule: 28 classes from 3 days ago to 8 days ahead
--    fb: default = deadline 24h after class (already expired), soon = closes in 3 hours, open = closes in 2 days
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TEMP TABLE seed_sess (n int PRIMARY KEY, course text, fac text, day int, st time, et time, status text,
                             title text, venue text, fb text) ON COMMIT DROP;
INSERT INTO seed_sess VALUES
  ( 1, 'COM',     'devesh', -3, '09:30', '11:00', 'completed', 'Business Communication: Foundations',  'room1', 'default'),
  ( 2, 'IP',      'parsh',  -3, '11:15', '12:45', 'completed', 'Python: Variables and Data Types',     'room1', 'default'),
  ( 3, 'LA',      'fac2',   -3, '14:00', '15:30', 'completed', 'Linear Algebra: Vectors',              'rnd',   'default'),
  ( 4, 'Course1', 'fac1',   -3, '15:45', '17:15', 'completed', 'Course1: Orientation',                 'rnd',   'default'),
  ( 5, 'IP',      'parsh',  -2, '09:30', '11:00', 'completed', 'Python: Control Flow',                 'room1', 'soon'),
  ( 6, 'LA',      'fac2',   -2, '11:15', '12:45', 'completed', 'Linear Algebra: Matrices',             'rnd',   'soon'),
  ( 7, 'COM',     'devesh', -2, '14:00', '15:30', 'completed', 'Email and Workplace Etiquette',        'room1', 'default'),
  ( 8, 'Course1', 'devesh', -2, '15:45', '17:15', 'completed', 'Course1: Case Study Discussion',       'rnd',   'default'),
  ( 9, 'LA',      'fac2',   -1, '09:30', '11:00', 'completed', 'Linear Algebra: Systems of Equations', 'rnd',   'open'),
  (10, 'Course1', 'fac1',   -1, '11:15', '12:45', 'completed', 'Course1: Group Activity',              'room1', 'open'),
  (11, 'COM',     'devesh', -1, '14:00', '15:30', 'completed', 'Presentation Skills',                  'room1', 'open'),
  (12, 'IP',      'parsh',  -1, '15:45', '17:15', 'completed', 'Python: Functions',                    'room1', 'open'),
  -- 13: attendance marked but NO feedback notification yet -> test "roll out feedback" from the admin panel
  (13, 'COM',     'devesh',  0, '09:30', '11:00', 'completed', 'Active Listening Workshop',            'room1', 'open'),
  -- 14: class happened today but faculty has not marked attendance / completed it -> test the faculty portal
  (14, 'IP',      'parsh',   0, '14:00', '15:30', 'scheduled', 'Python: Lists and Dictionaries',       'room1', NULL),
  (15, 'LA',      'fac2',    1, '09:30', '11:00', 'scheduled', 'Linear Algebra: Determinants',         'rnd',   NULL),
  (16, 'COM',     'devesh',  1, '11:15', '12:45', 'scheduled', 'Writing Reports',                      'room1', NULL),
  (17, 'Course1', 'fac1',    1, '14:00', '15:30', 'scheduled', 'Course1: Mid-module Review',           'rnd',   NULL),
  (18, 'IP',      'parsh',   2, '09:30', '11:00', 'scheduled', 'Python: File Handling',                'room1', NULL),
  (19, 'LA',      'fac2',    2, '11:15', '12:45', 'cancelled', 'Linear Algebra: Eigenvalues',          'rnd',   NULL),
  (20, 'COM',     'devesh',  2, '14:00', '15:30', 'scheduled', 'Negotiation Basics',                   'room1', NULL),
  (21, 'IP',      'parsh',   3, '09:30', '11:00', 'scheduled', 'Python: Error Handling',               'room1', NULL),
  (22, 'Course1', 'devesh',  3, '14:00', '15:30', 'scheduled', 'Course1: Guest Lecture',               'rnd',   NULL),
  (23, 'LA',      'fac2',    4, '09:30', '11:00', 'scheduled', 'Linear Algebra: Eigenvalues',          'rnd',   NULL),
  (24, 'COM',     'devesh',  4, '11:15', '12:45', 'scheduled', 'Interview Skills',                     'room1', NULL),
  (25, 'IP',      'parsh',   7, '09:30', '11:00', 'scheduled', 'Python: Modules and Packages',         'room1', NULL),
  (26, 'LA',      'fac2',    7, '14:00', '15:30', 'scheduled', 'Linear Algebra: Orthogonality',        'rnd',   NULL),
  (27, 'Course1', 'fac1',    8, '11:15', '12:45', 'scheduled', 'Course1: Project Kick-off',            'room1', NULL),
  (28, 'COM',     'devesh',  8, '14:00', '15:30', 'scheduled', 'Business Writing Clinic',              'room1', NULL);

ALTER TABLE seed_sess ADD COLUMN id uuid, ADD COLUMN course_id uuid, ADD COLUMN course_name text,
                      ADD COLUMN faculty_id uuid, ADD COLUMN venue_id uuid, ADD COLUMN venue_name text,
                      ADD COLUMN sdate date, ADD COLUMN t0 timestamp, ADD COLUMN t1 timestamp;
UPDATE seed_sess s
   SET id = pg_temp.sid('session:' || s.n), course_id = c.id, course_name = c.name, faculty_id = f.id,
       venue_id = v.id, venue_name = v.name, sdate = x.d + s.day, t0 = (x.d + s.day) + s.st, t1 = (x.d + s.day) + s.et
  FROM seed_course c, seed_fac f, seed_venue v, seed_ctx x
 WHERE c.key = s.course AND f.key = s.fac AND v.key = s.venue;

INSERT INTO sessions (id, course_id, faculty_id, title, venue_id, session_date, start_time, end_time, status,
                      created_by, created_at, feedback_deadline, session_type_id)
SELECT s.id, s.course_id, s.faculty_id, s.title, s.venue_id, s.sdate, s.st, s.et, s.status::core.session_status,
       x.admin_id, now() AT TIME ZONE 'UTC' - interval '5 days',
       CASE s.fb WHEN 'soon' THEN now() + interval '3 hours' WHEN 'open' THEN now() + interval '2 days' END,
       x.stype_id
  FROM seed_sess s CROSS JOIN seed_ctx x;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Attendance for the 13 completed classes (enrolled active students only)
-- ---------------------------------------------------------------------------------------------------------------------
INSERT INTO attendance_records (id, session_id, student_id, ping_count, status, calculated_at, first_seen_at,
                                last_seen_at, duration_minutes, avg_signal_strength, points, admin_override, override_by)
SELECT pg_temp.sid('att:' || s.n || ':' || st.id), s.id, st.id,
       CASE a.code WHEN 'P' THEN (a.dur / 5)::int WHEN 'H' THEN 7 ELSE 0 END,
       (CASE a.code WHEN 'P' THEN 'present' WHEN 'H' THEN 'partial' WHEN 'L' THEN 'leave' ELSE 'absent' END)::core.attendance_status,
       s.t1 + interval '15 minutes',
       CASE a.code WHEN 'P' THEN s.t0 + a.late * interval '1 minute' WHEN 'H' THEN s.t0 + interval '35 minutes' END,
       CASE a.code WHEN 'P' THEN s.t1 - interval '3 minutes'         WHEN 'H' THEN s.t0 + interval '70 minutes' END,
       CASE a.code WHEN 'P' THEN a.dur - a.late - 3 WHEN 'H' THEN 35 ELSE 0 END,
       CASE WHEN a.code IN ('P', 'H') THEN -50 - (abs(hashtext(s.n || st.email)) % 20) END,
       CASE a.code WHEN 'P' THEN 5 WHEN 'H' THEN 0.5 WHEN 'L' THEN 0 ELSE -2 END,
       true, 'seed:test_1'
  FROM seed_sess s
  JOIN seed_student st ON true
  JOIN course_enrollments ce ON ce.course_id = s.course_id AND ce.student_id = st.id
 CROSS JOIN LATERAL (SELECT substr(st.pattern, s.n, 1) AS code,
                            extract(epoch FROM s.et - s.st)::int / 60 AS dur,
                            2 + abs(hashtext(st.email || s.n)) % 4 AS late) a
 WHERE s.n <= 13;

-- Student leave requests: approved (matches the 'L'), pending, rejected
INSERT INTO leave_requests (id, student_id, leave_date, session_id, reason, status, reviewed_by, reviewed_at, admin_notes, created_at)
SELECT pg_temp.sid('leave:' || v.k), st.id, s.sdate, s.id, v.reason, v.status,
       CASE WHEN v.status <> 'pending' THEN x.admin_id END,
       CASE WHEN v.status <> 'pending' THEN now() - interval '2 days' END,
       v.notes, now() - interval '3 days'
  FROM (VALUES ('approved', 'aamanprime+1@gmail.com',            5, 'Fever, doctor''s note attached',   'approved',  'Get well soon'),
               ('pending',  'priyanshupandey18112005@gmail.com', 16, 'Medical appointment',            'pending',   NULL),
               ('rejected', 'deveshr51432@gmail.com',            9, 'Family function',                 'rejected',  'Not a valid reason for missing class'))
       AS v(k, email, n, reason, status, notes)
  JOIN seed_student st ON st.email = v.email
  JOIN seed_sess s ON s.n = v.n
 CROSS JOIN seed_ctx x;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Feedback questions (categories match the student feedback page) and some submitted responses
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TEMP TABLE seed_q (n int, category text, type text, question text) ON COMMIT DROP;
INSERT INTO seed_q VALUES
  ( 1, 'Structure',  'rating', 'The session was well organised and followed a clear structure'),
  ( 2, 'Structure',  'yes_no', 'The session started and ended on time'),
  ( 3, 'Content',    'rating', 'The content was relevant and useful to me'),
  ( 4, 'Content',    'rating', 'The difficulty level of the content was appropriate'),
  ( 5, 'Faculty',    'rating', 'The instructor explained concepts clearly'),
  ( 6, 'Faculty',    'yes_no', 'The instructor encouraged questions and participation'),
  ( 7, 'Logistics',  'rating', 'The venue, audio/visual setup and Wi-Fi were adequate'),
  ( 8, 'Engagement', 'mcq',    'How engaging was this session?'),
  ( 9, 'General',    'text',   'What did you like most about this session?'),
  (10, 'General',    'text',   'What could be improved?');

INSERT INTO feedback_questions (id, question, category, type, active, created_at)
SELECT pg_temp.sid('fq:' || n), question, category, type::core.feedback_question_type, true,
       now() AT TIME ZONE 'UTC' - interval '7 days' + n * interval '1 second'
  FROM seed_q;

-- Two students have submitted feedback for sessions 1, 2, 3, 4, 5 and 9 (where they attended)
INSERT INTO feedback_responses (id, session_id, student_id, question_id, rating, yes_no, text_answer, submitted_at)
SELECT pg_temp.sid('fr:' || s.n || ':' || st.id || ':' || q.n), s.id, st.id, pg_temp.sid('fq:' || q.n),
       CASE WHEN q.type = 'rating' THEN 3 + h.v % 3 END,
       CASE WHEN q.type = 'yes_no' THEN h.v % 5 <> 0 END,
       CASE q.type
         WHEN 'mcq' THEN (ARRAY['Highly Engaging', 'Engaging', 'Average'])[1 + h.v % 3]
         WHEN 'text' THEN CASE q.n
           WHEN 9  THEN (ARRAY['Clear real-world examples', 'Good pace and structure', 'Hands-on exercises were useful', 'The Q&A at the end'])[1 + h.v % 4]
           ELSE         (ARRAY['More practice problems please', 'Share slides before class', 'Slightly slower pace', 'Room was too cold'])[1 + h.v % 4]
         END
       END,
       pg_temp.utc(s.t1 + interval '2 hours')
  FROM seed_sess s
  JOIN seed_student st ON st.submits
  JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = st.id AND ar.status IN ('present', 'partial')
 CROSS JOIN seed_q q
 CROSS JOIN LATERAL (SELECT abs(hashtext(s.n || ':' || st.email || ':' || q.n)) AS v) h
 WHERE s.n IN (1, 2, 3, 4, 5, 9);

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Faculty portal: assignments, submissions, classroom posts (announcements / materials / links / assignments)
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TEMP TABLE seed_asg (k text, course text, fac text, title text, descr text, due_day int, marks int, allow_late boolean, ago interval) ON COMMIT DROP;
INSERT INTO seed_asg VALUES
  ('a1', 'COM', 'devesh', 'Assignment 1: Write a formal email',
   'Write a formal email to a client explaining a delayed delivery. Max 200 words. Upload a PDF.', 3, 10, true, '1 day'),
  ('a2', 'IP',  'parsh',  'Problem Set 0: Python basics',
   'Five short problems on variables, types and input/output. Submit a single .py file or PDF.', -1, 20, false, '3 days'),
  ('a3', 'IP',  'parsh',  'Problem Set 1: Control flow',
   'Loops and conditionals. Submit before the deadline; late submissions are allowed with a penalty.', 2, 20, true, '2 hours'),
  ('a4', 'LA',  'fac2',   'Worksheet 1: Vectors and Matrices',
   'Solve questions 1-10 from the attached worksheet. Show all working.', 5, 25, true, '1 day');

INSERT INTO assignments (id, course_id, faculty_id, title, description, due_date, created_at, total_marks, file_url, allow_late)
SELECT pg_temp.sid('asg:' || a.k), c.id, f.id, a.title, a.descr, (x.d + a.due_day) + time '23:59',
       now() AT TIME ZONE 'UTC' - a.ago, a.marks,
       'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', a.allow_late
  FROM seed_asg a JOIN seed_course c ON c.key = a.course JOIN seed_fac f ON f.key = a.fac CROSS JOIN seed_ctx x;

-- Submissions: a2 (past due) has 2 graded + 1 ungraded; a1 has 2 ungraded (to grade in the portal)
INSERT INTO assignment_submissions (id, assignment_id, student_id, file_url, submitted_at, grade, feedback, graded_at, graded_by)
SELECT pg_temp.sid('sub:' || v.k || ':' || st.id), pg_temp.sid('asg:' || v.k), st.id,
       'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
       now() AT TIME ZONE 'UTC' - v.ago, v.grade, v.fb,
       CASE WHEN v.grade IS NOT NULL THEN now() AT TIME ZONE 'UTC' - interval '6 hours' END,
       CASE WHEN v.grade IS NOT NULL THEN f.id END
  FROM (VALUES ('a2', 'parsh23368@iiitd.ac.in',         interval '2 days', 18, 'Well done. Watch variable naming.', 'parsh'),
               ('a2', 'priyanshu23406@iiitd.ac.in',     interval '2 days', 15, 'Q4 is missing edge cases.',         'parsh'),
               ('a2', 'aamanprime+1@gmail.com',         interval '1 day',  NULL, NULL,                              'parsh'),
               ('a1', 'parsh23368@iiitd.ac.in',         interval '5 hours', NULL, NULL,                             'devesh'),
               ('a1', 'priyanshupandeynov18@gmail.com', interval '3 hours', NULL, NULL,                             'devesh'))
       AS v(k, email, ago, grade, fb, fac)
  JOIN seed_student st ON st.email = v.email
  JOIN seed_fac f ON f.key = v.fac;

CREATE TEMP TABLE seed_post (n int, course text, fac text, type text, title text, body text, file boolean,
                             link text, sess int, asg text, pinned boolean, ago interval) ON COMMIT DROP;
INSERT INTO seed_post VALUES
  ( 1, 'COM',     'devesh', 'announcement', 'Welcome to Business Communication',
       'Hi everyone! Classes run Mon-Fri. Please bring a notebook; we will do a lot of in-class writing.', false, NULL, NULL, NULL, true,  '4 days'),
  ( 2, 'COM',     'devesh', 'material',     'Session 1 slides: Communication basics',
       'Slides from our first session.', true, NULL, 1, NULL, false, '3 days'),
  ( 3, 'COM',     'devesh', 'link',         'Reading: Plain language guidelines',
       'Read sections 1-3 before the next class.', false, 'https://www.plainlanguage.gov/guidelines/', NULL, NULL, false, '2 days'),
  ( 4, 'COM',     'devesh', 'assignment',   'Assignment 1: Write a formal email',
       'Details are in the assignment. Due in 3 days.', true, NULL, NULL, 'a1', false, '1 day'),
  ( 5, 'IP',      'parsh',  'announcement', 'Install Python 3.12 before class',
       'Please install Python 3.12 and VS Code on your laptop before our next class. Ping me if you get stuck.', false, NULL, NULL, NULL, true, '4 days'),
  ( 6, 'IP',      'parsh',  'material',     'Python cheat sheet',
       'One-page reference for syntax we covered.', true, NULL, 2, NULL, false, '3 days'),
  ( 7, 'IP',      'parsh',  'link',         'Official Python tutorial',
       'Chapters 3 and 4 are recommended.', false, 'https://docs.python.org/3/tutorial/', NULL, NULL, false, '3 days'),
  ( 8, 'IP',      'parsh',  'assignment',   'Problem Set 0: Python basics',
       'Late submissions are not accepted for this one.', true, NULL, NULL, 'a2', false, '3 days'),
  ( 9, 'IP',      'parsh',  'assignment',   'Problem Set 1: Control flow',
       'Due in 2 days.', true, NULL, NULL, 'a3', false, '2 hours'),
  (10, 'LA',      'fac2',   'announcement', 'Eigenvalues class moved',
       'The Eigenvalues class in 2 days is cancelled and will happen later in the week instead. Check the calendar.', false, NULL, NULL, NULL, false, '5 hours'),
  (11, 'LA',      'fac2',   'material',     'Lecture notes: Vectors',
       'Notes for the first lecture.', true, NULL, 3, NULL, false, '3 days'),
  (12, 'LA',      'fac2',   'link',         '3Blue1Brown: Essence of Linear Algebra',
       'Great visual intuition for this module.', false, 'https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab', NULL, NULL, false, '2 days'),
  (13, 'LA',      'fac2',   'assignment',   'Worksheet 1: Vectors and Matrices',
       'Due in 5 days.', true, NULL, NULL, 'a4', false, '1 day'),
  (14, 'Course1', 'fac1',   'announcement', 'Course1 orientation recap',
       'Thanks for attending the orientation. Group allocations will be shared in the next class.', false, NULL, NULL, NULL, true, '3 days'),
  (15, 'Course1', 'devesh', 'material',     'Course1 handbook',
       'Module handbook with the evaluation scheme.', true, NULL, 8, NULL, false, '2 days');

INSERT INTO course_posts (id, course_id, author_id, type, title, body, file_url, file_bucket, file_type, link_url,
                          session_id, assignment_id, pinned, created_at, updated_at)
SELECT pg_temp.sid('post:' || p.n), c.id, f.id, p.type, p.title, p.body,
       CASE WHEN p.file THEN 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' END,
       NULL, CASE WHEN p.file THEN 'pdf' END, p.link,
       CASE WHEN p.sess IS NOT NULL THEN pg_temp.sid('session:' || p.sess) END,
       CASE WHEN p.asg  IS NOT NULL THEN pg_temp.sid('asg:' || p.asg) END,
       p.pinned, now() AT TIME ZONE 'UTC' - p.ago, now() AT TIME ZONE 'UTC' - p.ago
  FROM seed_post p JOIN seed_course c ON c.key = p.course JOIN seed_fac f ON f.key = p.fac;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Faculty requests: approved cancel (session 19), pending reschedule (28), pending cancel (22); faculty leave
-- ---------------------------------------------------------------------------------------------------------------------
INSERT INTO session_change_requests (id, session_id, faculty_id, kind, proposed_date, proposed_start, proposed_end,
                                     reason, status, admin_notes, decided_by, decided_at, created_at)
SELECT pg_temp.sid('scr:' || v.n), s.id, s.faculty_id, v.kind,
       CASE WHEN v.kind = 'reschedule' THEN x.d + 9 END,
       CASE WHEN v.kind = 'reschedule' THEN time '14:00' END,
       CASE WHEN v.kind = 'reschedule' THEN time '15:30' END,
       v.reason, v.status, v.notes,
       CASE WHEN v.status <> 'pending' THEN x.admin_id END,
       CASE WHEN v.status <> 'pending' THEN now() - interval '5 hours' END,
       now() - interval '1 day'
  FROM (VALUES (19, 'cancel',     'Invigilation duty at that time',         'approved', 'Approved, students notified'),
               (28, 'reschedule', 'Clash with a departmental meeting',      'pending',  NULL),
               (22, 'cancel',     'Travelling for a conference',            'pending',  NULL))
       AS v(n, kind, reason, status, notes)
  JOIN seed_sess s ON s.n = v.n CROSS JOIN seed_ctx x;

INSERT INTO faculty_leave (id, faculty_id, from_date, to_date, reason, status, admin_notes, reviewed_by, reviewed_at, created_at)
SELECT pg_temp.sid('fleave:' || v.k), f.id, x.d + v.f, x.d + v.t, v.reason, v.status, v.notes,
       CASE WHEN v.status <> 'pending' THEN x.admin_id END,
       CASE WHEN v.status <> 'pending' THEN now() - interval '1 day' END,
       now() - interval '2 days'
  FROM (VALUES ('l1', 'fac1',   10, 11, 'Personal work',          'pending',  NULL),
               ('l2', 'devesh', 14, 14, 'Attending a workshop',   'approved', 'Approved'))
       AS v(k, fac, f, t, reason, status, notes)
  JOIN seed_fac f ON f.key = v.fac CROSS JOIN seed_ctx x;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. In-app notifications (no emails)
-- ---------------------------------------------------------------------------------------------------------------------
-- 7a. Feedback available: open/closing-soon sessions 5, 6, 9-12 for students who attended and have not submitted.
--     Session 13 is left out on purpose.
INSERT INTO notifications (id, recipient_id, type, title, message, course_id, session_id, is_read, sent_by, created_at)
SELECT pg_temp.sid('n:fb:' || s.n || ':' || ar.student_id), ar.student_id, 'feedback_available',
       '📝 Feedback: ' || s.course_name,
       'Your feedback form for "' || s.title || '" is ready. Deadline: '
         || to_char(se.feedback_deadline AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY, HH12:MI:SS am') || '. Submit now!',
       s.course_id, s.id, false, NULL, pg_temp.utc(s.t1 + interval '20 minutes')
  FROM seed_sess s
  JOIN sessions se ON se.id = s.id
  JOIN attendance_records ar ON ar.session_id = s.id AND ar.status IN ('present', 'partial')
 WHERE s.n <= 12 AND s.fb IN ('soon', 'open')
   AND NOT EXISTS (SELECT 1 FROM feedback_responses r WHERE r.session_id = s.id AND r.student_id = ar.student_id);

-- 7b. Attendance warnings: per course, attended (present/partial) below 75% of marked classes (leave excluded)
INSERT INTO notifications (id, recipient_id, type, title, message, course_id, is_read, created_at)
SELECT pg_temp.sid('n:warn:' || w.student_id || ':' || w.course_id), w.student_id, 'attendance_warning',
       '⚠️ Low attendance: ' || w.course_name,
       'Your attendance in ' || w.course_name || ' is ' || w.pct || '%. A minimum of 75% is required for end-semester exam eligibility.',
       w.course_id, false, now() AT TIME ZONE 'UTC' - interval '1 hour'
  FROM (SELECT ar.student_id, s.course_id, s.course_name,
               round(100.0 * count(*) FILTER (WHERE ar.status IN ('present', 'partial'))
                     / nullif(count(*) FILTER (WHERE ar.status <> 'leave'), 0)) AS pct
          FROM attendance_records ar JOIN seed_sess s ON s.id = ar.session_id
         GROUP BY 1, 2, 3) w
 WHERE w.pct < 75;

-- 7c. Class reminder for tomorrow's first class (session 15) to its students and its faculty
INSERT INTO notifications (id, recipient_id, type, title, message, course_id, session_id, is_read, created_at)
SELECT pg_temp.sid('n:remind:' || r.id), r.id, 'class_reminder',
       '⏰ Class tomorrow: ' || s.title,
       s.course_name || ': "' || s.title || '" on ' || to_char(s.sdate, 'Dy DD Mon') || ' at '
         || to_char(s.st, 'HH12:MI AM') || ' in ' || s.venue_name || '.',
       s.course_id, s.id, false, now() AT TIME ZONE 'UTC' - interval '30 minutes'
  FROM seed_sess s
  JOIN LATERAL (SELECT st.id FROM seed_student st
                  JOIN course_enrollments ce ON ce.student_id = st.id AND ce.course_id = s.course_id
                UNION SELECT s.faculty_id) r ON true
 WHERE s.n = 15;

-- 7d. Cancelled class (session 19) to its students and its faculty
INSERT INTO notifications (id, recipient_id, type, title, message, course_id, session_id, is_read, sent_by, created_at)
SELECT pg_temp.sid('n:cancel:' || r.id), r.id, 'schedule_change',
       '❌ Class cancelled: ' || s.title,
       s.course_name || ': "' || s.title || '" on ' || to_char(s.sdate, 'Dy DD Mon') || ' at '
         || to_char(s.st, 'HH12:MI AM') || ' has been cancelled.',
       s.course_id, s.id, false, x.admin_id, now() AT TIME ZONE 'UTC' - interval '5 hours'
  FROM seed_sess s CROSS JOIN seed_ctx x
  JOIN LATERAL (SELECT st.id FROM seed_student st
                  JOIN course_enrollments ce ON ce.student_id = st.id AND ce.course_id = s.course_id
                UNION SELECT s.faculty_id) r ON true
 WHERE s.n = 19;

-- 7e. Classroom posts -> enrolled students (same types/titles the faculty portal uses). Older ones partly read.
INSERT INTO notifications (id, recipient_id, type, title, message, course_id, session_id, is_read, sent_by, created_at)
SELECT pg_temp.sid('n:post:' || p.n || ':' || st.id), st.id,
       CASE p.type WHEN 'announcement' THEN 'course_announcement' WHEN 'assignment' THEN 'assignment_posted' ELSE 'material_posted' END,
       CASE p.type WHEN 'announcement' THEN 'New announcement' WHEN 'material' THEN 'New material'
                   WHEN 'link' THEN 'New link' ELSE 'New assignment' END || ': ' || c.name,
       CASE WHEN p.asg IS NOT NULL
            THEN p.title || ' (due ' || to_char(a.due_date, 'YYYY-MM-DD HH24:MI') || ')'
            ELSE p.title END,
       c.id, CASE WHEN p.sess IS NOT NULL THEN pg_temp.sid('session:' || p.sess) END,
       p.ago >= interval '2 days' AND abs(hashtext(p.n || st.email)) % 2 = 0,
       f.id, now() AT TIME ZONE 'UTC' - p.ago
  FROM seed_post p
  JOIN seed_course c ON c.key = p.course
  JOIN seed_fac f ON f.key = p.fac
  LEFT JOIN assignments a ON a.id = pg_temp.sid('asg:' || p.asg)
  JOIN course_enrollments ce ON ce.course_id = c.id
  JOIN seed_student st ON st.id = ce.student_id;

-- 7f. Grades released
INSERT INTO notifications (id, recipient_id, type, title, message, course_id, is_read, sent_by, created_at)
SELECT pg_temp.sid('n:grade:' || sub.id), sub.student_id, 'grade_update',
       'Grade posted: ' || a.title,
       'You scored ' || sub.grade::int || '/' || a.total_marks::int || '. Feedback: ' || sub.feedback,
       a.course_id, false, sub.graded_by, sub.graded_at
  FROM assignment_submissions sub JOIN assignments a ON a.id = sub.assignment_id
 WHERE sub.id::text LIKE '5eed5eed%' AND sub.grade IS NOT NULL;

-- ---------------------------------------------------------------------------------------------------------------------
-- Summary
-- ---------------------------------------------------------------------------------------------------------------------
SELECT 'sessions' AS what, count(*) FROM sessions WHERE id::text LIKE '5eed5eed%'
UNION ALL SELECT 'attendance_records', count(*) FROM attendance_records WHERE id::text LIKE '5eed5eed%'
UNION ALL SELECT 'leave_requests', count(*) FROM leave_requests WHERE id::text LIKE '5eed5eed%'
UNION ALL SELECT 'feedback_questions', count(*) FROM feedback_questions WHERE id::text LIKE '5eed5eed%'
UNION ALL SELECT 'feedback_responses', count(*) FROM feedback_responses WHERE id::text LIKE '5eed5eed%'
UNION ALL SELECT 'assignments', count(*) FROM assignments WHERE id::text LIKE '5eed5eed%'
UNION ALL SELECT 'assignment_submissions', count(*) FROM assignment_submissions WHERE id::text LIKE '5eed5eed%'
UNION ALL SELECT 'course_posts', count(*) FROM course_posts WHERE id::text LIKE '5eed5eed%'
UNION ALL SELECT 'session_change_requests', count(*) FROM session_change_requests WHERE id::text LIKE '5eed5eed%'
UNION ALL SELECT 'faculty_leave', count(*) FROM faculty_leave WHERE id::text LIKE '5eed5eed%'
UNION ALL SELECT 'notifications', count(*) FROM notifications WHERE id::text LIKE '5eed5eed%';

COMMIT;

-- =====================================================================================================================
-- What to test after seeding
--   Student (e.g. parsh23368@iiitd.ac.in / deveshr51432@gmail.com):
--     * Calendar: past, today, upcoming and one cancelled class.
--     * Attendance: present / partial / absent / leave mix; deveshr51432 is well below 75%.
--     * Feedback: sessions 5-6 close in ~3 h, 9-12 are open for 2 days, 1-4/7-8 are expired,
--       parsh23368 + priyanshu23406 already submitted some.
--     * Notifications: feedback, low attendance, class reminder, cancellation, posts, grades.
--   Faculty (devesh23193 / parshjain.j / parshjain.j1 / parshslox):
--     * Modules: announcements (pinned), materials, links, assignments; grade the 3 ungraded submissions.
--     * Today's "Python: Lists and Dictionaries" (parshjain.j) is still scheduled with no attendance -> mark it.
--     * Requests: one approved cancel, two pending (visible to admin); faculty leave pending/approved.
--   Admin:
--     * "Active Listening Workshop" (today, COM) is completed with attendance but feedback was never rolled out ->
--       roll out feedback from the session page to test the real in-app + email path.
--     * Approve / reject the pending change requests, faculty leave and student leave.
-- =====================================================================================================================
