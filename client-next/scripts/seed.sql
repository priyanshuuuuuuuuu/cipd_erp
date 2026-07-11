--------------------------------------------------
-- SEED DATA: Demo users, courses, venues, etc.
-- Run this AFTER the schema.txt has been executed.
-- Passwords are hashed using bcryptjs (same as app).
--------------------------------------------------

-- bcrypt hash for 'student123' = $2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
-- bcrypt hash for 'faculty123'
-- bcrypt hash for 'admin123'
-- We'll use pgcrypto's crypt function since it's available

-- ========== ADMIN USER ==========
INSERT INTO users (id, email, password_hash, role, first_name, last_name)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'admin@cipd.edu',
  crypt('admin123', gen_salt('bf')),
  'admin',
  'Admin',
  'CiPD'
);

-- ========== FACULTY USERS ==========
INSERT INTO users (id, email, password_hash, role, first_name, last_name)
VALUES
  ('f0000000-0000-0000-0000-000000000001', 'anuj.grover@cipd.edu', crypt('faculty123', gen_salt('bf')), 'faculty', 'Anuj', 'Grover'),
  ('f0000000-0000-0000-0000-000000000002', 'priya.sharma@cipd.edu', crypt('faculty123', gen_salt('bf')), 'faculty', 'Priya', 'Sharma'),
  ('f0000000-0000-0000-0000-000000000003', 'rajesh.mehta@cipd.edu', crypt('faculty123', gen_salt('bf')), 'faculty', 'Rajesh', 'Mehta'),
  ('f0000000-0000-0000-0000-000000000004', 'kavita.iyer@cipd.edu', crypt('faculty123', gen_salt('bf')), 'faculty', 'Kavita', 'Iyer');

INSERT INTO faculty (id, designation, years_experience, honorarium_rate_per_hour)
VALUES
  ('f0000000-0000-0000-0000-000000000001', 'Professor', 12, 1500.00),
  ('f0000000-0000-0000-0000-000000000002', 'Associate Professor', 8, 1200.00),
  ('f0000000-0000-0000-0000-000000000003', 'Professor', 15, 1800.00),
  ('f0000000-0000-0000-0000-000000000004', 'Assistant Professor', 6, 1000.00);

-- ========== STUDENT USERS ==========
INSERT INTO users (id, email, password_hash, role, first_name, last_name)
VALUES
  ('s0000000-0000-0000-0000-000000000001', 'student@cipd.edu', crypt('student123', gen_salt('bf')), 'student', 'Akshat', 'Lakhera'),
  ('s0000000-0000-0000-0000-000000000002', 'rahul.kumar@cipd.edu', crypt('student123', gen_salt('bf')), 'student', 'Rahul', 'Kumar'),
  ('s0000000-0000-0000-0000-000000000003', 'sneha.patel@cipd.edu', crypt('student123', gen_salt('bf')), 'student', 'Sneha', 'Patel'),
  ('s0000000-0000-0000-0000-000000000004', 'amit.singh@cipd.edu', crypt('student123', gen_salt('bf')), 'student', 'Amit', 'Singh'),
  ('s0000000-0000-0000-0000-000000000005', 'priya.verma@cipd.edu', crypt('student123', gen_salt('bf')), 'student', 'Priya', 'Verma');

INSERT INTO students (id, enrollment_no, program_name, device_hash, mac_address, mac_verified)
VALUES
  ('s0000000-0000-0000-0000-000000000001', 'STU2021001', 'B.Tech CSE', 'dev_hash_001', 'AA:BB:CC:DD:EE:01', true),
  ('s0000000-0000-0000-0000-000000000002', 'STU2021002', 'B.Tech CSE', 'dev_hash_002', 'AA:BB:CC:DD:EE:02', true),
  ('s0000000-0000-0000-0000-000000000003', 'STU2021003', 'B.Tech ECE', 'dev_hash_003', 'AA:BB:CC:DD:EE:03', true),
  ('s0000000-0000-0000-0000-000000000004', 'STU2021004', 'B.Tech CSE', 'dev_hash_004', 'AA:BB:CC:DD:EE:04', false),
  ('s0000000-0000-0000-0000-000000000005', 'STU2021005', 'B.Tech ME', 'dev_hash_005', 'AA:BB:CC:DD:EE:05', true);

-- ========== COURSES ==========
INSERT INTO courses (id, name, description)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'CS301 - Data Structures', 'Advanced data structures and algorithms'),
  ('c0000000-0000-0000-0000-000000000002', 'PHY201 - Quantum Physics', 'Fundamentals of quantum mechanics'),
  ('c0000000-0000-0000-0000-000000000003', 'MTH101 - Calculus II', 'Multivariable calculus and series'),
  ('c0000000-0000-0000-0000-000000000004', 'CHM101 - Chemistry', 'Organic and inorganic chemistry');

-- ========== COURSE ENROLLMENTS ==========
INSERT INTO course_enrollments (course_id, student_id)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000004'),
  ('c0000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000005'),
  ('c0000000-0000-0000-0000-000000000004', 's0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000004', 's0000000-0000-0000-0000-000000000005');

-- ========== VENUES ==========
INSERT INTO venues (id, name, building, router_bssid)
VALUES
  ('v0000000-0000-0000-0000-000000000001', 'Room 204', 'Block A', 'C4:E9:84:A2:3F:01'),
  ('v0000000-0000-0000-0000-000000000002', 'Room 305', 'Block C', 'C4:E9:84:A2:3F:02'),
  ('v0000000-0000-0000-0000-000000000003', 'LHC 3', 'Block B', 'C4:E9:84:A2:3F:03'),
  ('v0000000-0000-0000-0000-000000000004', 'Lab 2', 'Block D', 'C4:E9:84:A2:3F:04');

-- ========== SESSIONS (some completed, some scheduled) ==========
INSERT INTO sessions (id, course_id, faculty_id, title, venue_id, session_date, start_time, end_time, status, created_by)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Lec 14 - Binary Search Trees', 'v0000000-0000-0000-0000-000000000001', '2026-03-10', '09:00', '10:00', 'completed', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Lec 15 - AVL Trees', 'v0000000-0000-0000-0000-000000000001', '2026-03-12', '09:00', '10:00', 'scheduled', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'Lec 8 - Wave Optics', 'v0000000-0000-0000-0000-000000000002', '2026-03-10', '11:00', '12:00', 'completed', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', 'Lec 12 - Eigenvalues', 'v0000000-0000-0000-0000-000000000003', '2026-03-11', '14:00', '15:30', 'completed', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'Lec 9 - Diffraction', 'v0000000-0000-0000-0000-000000000002', '2026-03-13', '11:00', '12:00', 'scheduled', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000004', 'Lec 6 - Chemical Bonding', 'v0000000-0000-0000-0000-000000000004', '2026-03-11', '10:00', '11:00', 'completed', 'a0000000-0000-0000-0000-000000000001');

-- ========== ATTENDANCE RECORDS for completed sessions ==========
INSERT INTO attendance_records (session_id, student_id, ping_count, status)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 5, 'present'),
  ('e0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000002', 4, 'present'),
  ('e0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000004', 1, 'absent'),
  ('e0000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000001', 6, 'present'),
  ('e0000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000003', 2, 'partial'),
  ('e0000000-0000-0000-0000-000000000004', 's0000000-0000-0000-0000-000000000002', 5, 'present'),
  ('e0000000-0000-0000-0000-000000000004', 's0000000-0000-0000-0000-000000000005', 3, 'present'),
  ('e0000000-0000-0000-0000-000000000006', 's0000000-0000-0000-0000-000000000003', 4, 'present'),
  ('e0000000-0000-0000-0000-000000000006', 's0000000-0000-0000-0000-000000000005', 0, 'absent');

-- ========== FEEDBACK QUESTIONS ==========
INSERT INTO feedback_questions (id, question, category, type, active)
VALUES
  ('q0000000-0000-0000-0000-000000000001', 'Rate the overall quality of this lecture', 'Teaching', 'rating', true),
  ('q0000000-0000-0000-0000-000000000002', 'How clear was the explanation of concepts?', 'Clarity', 'rating', true),
  ('q0000000-0000-0000-0000-000000000003', 'Was the lecture well-structured and organized?', 'Organization', 'rating', true),
  ('q0000000-0000-0000-0000-000000000004', 'Did the lecture meet your learning expectations?', 'Satisfaction', 'yes_no', true),
  ('q0000000-0000-0000-0000-000000000005', 'What specific improvement would you suggest?', 'Improvement', 'text', true);

-- ========== FEEDBACK RESPONSES ==========
INSERT INTO feedback_responses (session_id, student_id, question_id, rating, text_answer)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'q0000000-0000-0000-0000-000000000001', 5, NULL),
  ('e0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'q0000000-0000-0000-0000-000000000005', NULL, 'Great lecture! More live coding examples would be helpful.'),
  ('e0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000002', 'q0000000-0000-0000-0000-000000000001', 4, NULL),
  ('e0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000002', 'q0000000-0000-0000-0000-000000000002', 4, NULL),
  ('e0000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000001', 'q0000000-0000-0000-0000-000000000001', 3, NULL),
  ('e0000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000003', 'q0000000-0000-0000-0000-000000000001', 4, NULL),
  ('e0000000-0000-0000-0000-000000000004', 's0000000-0000-0000-0000-000000000002', 'q0000000-0000-0000-0000-000000000001', 5, NULL),
  ('e0000000-0000-0000-0000-000000000004', 's0000000-0000-0000-0000-000000000005', 'q0000000-0000-0000-0000-000000000005', NULL, 'Eigenvalues section was excellent. Please cover more applications.');

-- ========== SAMPLE PING LOGS ==========
INSERT INTO attendance_ping_logs (session_id, student_id, device_hash, bssid, signal_strength, ping_time)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'dev_hash_001', 'C4:E9:84:A2:3F:01', -45, '2026-03-10 09:05:00'),
  ('e0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'dev_hash_001', 'C4:E9:84:A2:3F:01', -42, '2026-03-10 09:15:00'),
  ('e0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'dev_hash_001', 'C4:E9:84:A2:3F:01', -48, '2026-03-10 09:25:00'),
  ('e0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000002', 'dev_hash_002', 'C4:E9:84:A2:3F:01', -55, '2026-03-10 09:05:00'),
  ('e0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000002', 'dev_hash_002', 'C4:E9:84:A2:3F:01', -60, '2026-03-10 09:15:00'),
  ('e0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000004', 'dev_hash_004', 'C4:E9:84:A2:3F:01', -75, '2026-03-10 09:10:00'),
  ('e0000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000001', 'dev_hash_001', 'C4:E9:84:A2:3F:02', -40, '2026-03-10 11:05:00'),
  ('e0000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000003', 'dev_hash_003', 'C4:E9:84:A2:3F:02', -68, '2026-03-10 11:10:00');
