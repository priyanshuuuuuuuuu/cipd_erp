DO $$
DECLARE
    v_venue_id UUID;
    v_faculty_anuj UUID;
    v_faculty_arani UUID;
    
    v_course_personal UUID;
    v_course_product UUID;
    v_course_software UUID;
    v_course_capstone UUID;
BEGIN
    -- 1. Fetch Venue (Preferably 'CiPD training room' from the previous conversation)
    SELECT id INTO v_venue_id FROM venues WHERE name ILIKE '%CiPD training room%' LIMIT 1;
    IF v_venue_id IS NULL THEN
        SELECT id INTO v_venue_id FROM venues LIMIT 1;
    END IF;

    -- 2. Fetch Faculty IDs (By name matching)
    SELECT id INTO v_faculty_anuj FROM users WHERE (first_name ILIKE '%Anuj%' OR last_name ILIKE '%Grover%') AND role = 'faculty' LIMIT 1;
    SELECT id INTO v_faculty_arani FROM users WHERE (first_name ILIKE '%Arani%' OR last_name ILIKE '%Bhattacharya%') AND role = 'faculty' LIMIT 1;

    -- 3. Fetch Courses based on the provided categories
    SELECT id INTO v_course_personal FROM courses WHERE name ILIKE '%Personal Leadership%' LIMIT 1;
    SELECT id INTO v_course_product FROM courses WHERE name ILIKE '%Product Development%' LIMIT 1;
    SELECT id INTO v_course_software FROM courses WHERE name ILIKE '%Software & App Development%' OR name ILIKE '%Software%' LIMIT 1;
    SELECT id INTO v_course_capstone FROM courses WHERE name ILIKE '%Capstone%' LIMIT 1;

    ---------------------------------------------------------------------------
    -- Insert Sessions for Week 16 (20-04-2026 to 24-04-2026)
    ---------------------------------------------------------------------------

    -- MONDAY: 20-04-2026
    INSERT INTO sessions (title, session_date, start_time, end_time, venue_id, faculty_id, course_id, status) VALUES
    ('S1. Leading Self to Excellence-13', '2026-04-20', '09:30:00', '11:00:00', v_venue_id, v_faculty_anuj, v_course_personal, 'scheduled'),
    ('S2. Project Session',               '2026-04-20', '11:15:00', '13:00:00', v_venue_id, NULL,           v_course_product,  'scheduled'),
    ('S3. Self-Work Session',             '2026-04-20', '14:00:00', '15:00:00', v_venue_id, NULL,           v_course_capstone, 'scheduled'),
    ('S4. Project Session',               '2026-04-20', '15:15:00', '17:30:00', v_venue_id, NULL,           v_course_product,  'scheduled');

    -- TUESDAY: 21-04-2026
    INSERT INTO sessions (title, session_date, start_time, end_time, venue_id, faculty_id, course_id, status) VALUES
    ('S1. Project Session',                         '2026-04-21', '09:30:00', '11:00:00', v_venue_id, NULL,            v_course_product,  'scheduled'),
    ('S2. Practice Session on Network Programming', '2026-04-21', '13:30:00', '15:00:00', v_venue_id, v_faculty_arani, v_course_software, 'scheduled'),
    ('S3. Self-Work Session',                       '2026-04-21', '15:00:00', '16:30:00', v_venue_id, NULL,            v_course_capstone, 'scheduled'),
    ('S4. Project Session',                         '2026-04-21', '16:45:00', '18:00:00', v_venue_id, NULL,            v_course_product,  'scheduled');

    -- WEDNESDAY: 22-04-2026
    INSERT INTO sessions (title, session_date, start_time, end_time, venue_id, faculty_id, course_id, status) VALUES
    ('S1. Practice Session on Cloud Programming', '2026-04-22', '09:30:00', '11:00:00', v_venue_id, v_faculty_arani, v_course_software, 'scheduled'),
    ('S2. Self-Work Session',                     '2026-04-22', '11:15:00', '12:30:00', v_venue_id, NULL,            v_course_capstone, 'scheduled'),
    ('S3. Project Session',                       '2026-04-22', '13:30:00', '15:00:00', v_venue_id, NULL,            v_course_product,  'scheduled'),
    ('S4. Project Session',                       '2026-04-22', '15:15:00', '17:30:00', v_venue_id, NULL,            v_course_product,  'scheduled');

    -- THURSDAY: 23-04-2026
    INSERT INTO sessions (title, session_date, start_time, end_time, venue_id, faculty_id, course_id, status) VALUES
    ('S1. Project Session',                                '2026-04-23', '09:30:00', '11:00:00', v_venue_id, NULL, v_course_product, 'scheduled'),
    ('Session with CA & STM Facilitation (Project Demos)', '2026-04-23', '11:00:00', '18:00:00', v_venue_id, NULL, v_course_product, 'scheduled');

    -- FRIDAY: 24-04-2026
    INSERT INTO sessions (title, session_date, start_time, end_time, venue_id, faculty_id, course_id, status) VALUES
    ('S1. Project Session',   '2026-04-24', '09:30:00', '11:00:00', v_venue_id, NULL, v_course_product,  'scheduled'),
    ('S2. Project Session',   '2026-04-24', '11:15:00', '13:00:00', v_venue_id, NULL, v_course_product,  'scheduled'),
    ('S3. Self-Work Session', '2026-04-24', '14:30:00', '16:30:00', v_venue_id, NULL, v_course_capstone, 'scheduled'),
    ('S4. Project Session',   '2026-04-24', '16:45:00', '18:00:00', v_venue_id, NULL, v_course_product,  'scheduled');

    RAISE NOTICE 'Week 16 schedule seeded successfully!';
END $$;
