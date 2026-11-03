-- Seed Attendance Data for the Current Week
-- Run this script to generate realistic attendance data for the dashboard chart

DO $$
DECLARE
    curr_week_start DATE;
    v_date DATE;
    v_session_id UUID;
    v_course_id UUID;
    v_faculty_id UUID;
    v_student_id UUID;
    v_student_record RECORD;
    i INT;
    attendance_status TEXT;
    status_random INT;
BEGIN
    -- Get Monday of the current week (or last Monday if today is Sunday, depending on PostgreSQL's date_trunc)
    curr_week_start := date_trunc('week', current_date)::DATE;

    -- Get a faculty member (e.g. Faculty One)
    SELECT id INTO v_faculty_id FROM users WHERE role = 'faculty' LIMIT 1;
    IF v_faculty_id IS NULL THEN
        RAISE NOTICE 'No faculty found.';
        RETURN;
    END IF;

    -- Get a course
    SELECT id INTO v_course_id FROM courses LIMIT 1;
    IF v_course_id IS NULL THEN
        RAISE NOTICE 'No courses found.';
        RETURN;
    END IF;

    -- Loop from Monday (0) to Friday (4) to create sessions
    FOR i IN 0..4 LOOP
        v_date := curr_week_start + i;
        
        -- Create a session for each day
        INSERT INTO sessions (course_id, faculty_id, venue_id, title, session_date, start_time, end_time, status)
        VALUES (v_course_id, v_faculty_id, (SELECT id FROM venues LIMIT 1), 'Lec ' || (i+1) || ' - Core Topics', v_date, '10:00:00', '11:00:00', 'completed')
        RETURNING id INTO v_session_id;

        -- For each session, add attendance records for enrolled students
        FOR v_student_record IN (SELECT student_id FROM enrollments WHERE course_id = v_course_id) LOOP
            -- Randomize attendance (approx 85% present, 15% absent/late)
            status_random := random() * 100;
            IF status_random < 85 THEN
                attendance_status := 'present';
            ELSIF status_random < 95 THEN
                attendance_status := 'absent';
            ELSE
                attendance_status := 'late';
            END IF;

            -- Insert the attendance record
            -- Handle potential conflicts if the record already exists
            INSERT INTO attendance_records (session_id, student_id, status, marked_by, marked_at)
            VALUES (v_session_id, v_student_record.student_id, attendance_status, v_faculty_id, (v_date + time '10:05:00'))
            ON CONFLICT (session_id, student_id) DO UPDATE SET status = EXCLUDED.status;
        END LOOP;
        
        RAISE NOTICE 'Created session for % with ID %', v_date, v_session_id;
    END LOOP;
END $$;
