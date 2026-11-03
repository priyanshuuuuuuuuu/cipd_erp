-- ============================================================
-- CIPD ERP — Phase 2 Migration: calculate_attendance RPC
-- Run this in: Supabase Dashboard → SQL Editor
-- Run AFTER migration_phase2_columns.sql
--
-- This function is called automatically when an admin marks
-- a session as "completed" via PATCH /api/admin/sessions/[id]
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_attendance(p_session UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_setting       RECORD;
    v_enrollment    RECORD;
    v_ping_count    INTEGER;
    v_req_pings     INTEGER;
    v_status        TEXT;
BEGIN
    -- 1. Read presence threshold from system_settings (default: 3 pings = present)
    SELECT presence_threshold, pings_per_session
    INTO v_setting
    FROM public.system_settings
    WHERE id = 1;

    v_req_pings := COALESCE(v_setting.presence_threshold, 3);

    -- 2. Loop through every student enrolled in this session's course
    FOR v_enrollment IN
        SELECT ce.student_id
        FROM public.course_enrollments ce
        INNER JOIN public.sessions s ON s.course_id = ce.course_id
        WHERE s.id = p_session
    LOOP
        -- 3. Count how many ping_logs this student has for this session
        SELECT COUNT(*)
        INTO v_ping_count
        FROM public.attendance_ping_logs
        WHERE session_id = p_session
          AND student_id = v_enrollment.student_id;

        -- 4. Determine attendance status
        IF v_ping_count >= v_req_pings THEN
            v_status := 'present';
        ELSIF v_ping_count > 0 THEN
            v_status := 'partial';
        ELSE
            v_status := 'absent';
        END IF;

        -- 5. Upsert into attendance_records (insert or update if already exists)
        INSERT INTO public.attendance_records (
            session_id,
            student_id,
            ping_count,
            status,
            calculated_at
        )
        VALUES (
            p_session,
            v_enrollment.student_id,
            v_ping_count,
            v_status::public.attendance_status,   -- cast to the ENUM type
            now()
        )
        ON CONFLICT (session_id, student_id)
        DO UPDATE SET
            ping_count    = EXCLUDED.ping_count,
            status        = EXCLUDED.status,
            calculated_at = EXCLUDED.calculated_at;

    END LOOP;

END;
$$;

-- Grant execute permission so the service role (used by Next.js API) can call it
GRANT EXECUTE ON FUNCTION public.calculate_attendance(UUID) TO service_role;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
