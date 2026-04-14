-- ============================================================
-- E2E TEST: Create a session that ended 5 minutes ago
-- with Mayank marked as present, so feedback form appears
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Get IDs we need
DO $$
DECLARE
  v_student_id UUID;
  v_course_id UUID;
  v_faculty_id UUID;
  v_venue_id UUID;
  v_session_id UUID;
BEGIN
  -- Get Mayank's user ID
  SELECT id INTO v_student_id FROM users WHERE email = 'mayank.chauhan@cipd.com' LIMIT 1;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Student mayank.chauhan@cipd.com not found';
  END IF;

  -- Get any course Mayank is enrolled in
  SELECT ce.course_id INTO v_course_id 
  FROM course_enrollments ce 
  WHERE ce.student_id = v_student_id 
  LIMIT 1;
  IF v_course_id IS NULL THEN
    -- fallback: any course
    SELECT id INTO v_course_id FROM courses LIMIT 1;
  END IF;

  -- Get any faculty
  SELECT id INTO v_faculty_id FROM faculty LIMIT 1;

  -- Get any venue
  SELECT id INTO v_venue_id FROM venues LIMIT 1;

  -- 2. Create a session that ended 5 minutes ago
  INSERT INTO sessions (
    title, course_id, faculty_id, venue_id,
    session_date, start_time, end_time,
    status
  ) VALUES (
    'E2E Test Session - Feedback System',
    v_course_id,
    v_faculty_id,
    v_venue_id,
    CURRENT_DATE,
    (NOW() - INTERVAL '35 minutes')::TIME,
    (NOW() - INTERVAL '5 minutes')::TIME,
    'completed'
  ) RETURNING id INTO v_session_id;

  -- 3. Insert attendance record for Mayank
  INSERT INTO attendance_records (
    session_id, student_id, status
  ) VALUES (
    v_session_id, v_student_id, 'present'
  );

  RAISE NOTICE 'Test session created: % | Student: % | Session: %', v_session_id, v_student_id, v_session_id;
END $$;
--remember mayank is the test student