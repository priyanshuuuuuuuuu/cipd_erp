-- ============================================================
-- CIPD ERP — Phase 2 Migration: Schema Enhancements
-- Run this in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (all statements use IF NOT EXISTS
-- or IF EXISTS guards).
-- ============================================================

BEGIN;

-- --------------------------------------------------------
-- 1. faculty: add department + photo_url
-- --------------------------------------------------------
ALTER TABLE public.faculty
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS photo_url  TEXT;

COMMENT ON COLUMN public.faculty.department IS 'Department name, e.g. Computer Science, Electronics';
COMMENT ON COLUMN public.faculty.photo_url  IS 'URL to faculty profile photo (Supabase Storage or external)';

-- --------------------------------------------------------
-- 2. students: add photo_url
-- --------------------------------------------------------
ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN public.students.photo_url IS 'URL to student profile photo';

-- --------------------------------------------------------
-- 3. assignments: add total_marks
-- --------------------------------------------------------
ALTER TABLE public.assignments
    ADD COLUMN IF NOT EXISTS total_marks NUMERIC DEFAULT 100;

COMMENT ON COLUMN public.assignments.total_marks IS 'Maximum marks for this assignment (used in grade % calculation)';

-- --------------------------------------------------------
-- 4. courses: add code
-- --------------------------------------------------------
ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS code TEXT;

-- Add unique constraint only if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'courses_code_key' AND conrelid = 'public.courses'::regclass
    ) THEN
        ALTER TABLE public.courses ADD CONSTRAINT courses_code_key UNIQUE (code);
    END IF;
END $$;

COMMENT ON COLUMN public.courses.code IS 'Short course code, e.g. CS101, EC204';

-- --------------------------------------------------------
-- 5. users: add preferences (JSONB) for settings persistence
-- --------------------------------------------------------
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

COMMENT ON COLUMN public.users.preferences IS 'User-specific preferences: notifications, theme, font_size, etc.';

-- --------------------------------------------------------
-- 6. attendance_ping_logs: create if not exists
--    (referenced by /api/students/attendance/ping and
--     /api/admin/wifi-logs but missing from schema files)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_ping_logs (
    id              BIGSERIAL PRIMARY KEY,
    session_id      UUID        REFERENCES public.sessions(id)  ON DELETE CASCADE,
    student_id      UUID        REFERENCES public.students(id)  ON DELETE CASCADE,
    device_hash     TEXT,
    bssid           TEXT,
    signal_strength INTEGER,
    ping_time       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apl_session_id ON public.attendance_ping_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_apl_student_id ON public.attendance_ping_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_apl_ping_time  ON public.attendance_ping_logs(ping_time DESC);

COMMENT ON TABLE public.attendance_ping_logs IS 'Raw Wi-Fi ping events sent by the student client app during a session';

-- --------------------------------------------------------
-- 7. Grant permissions to all roles
-- --------------------------------------------------------
GRANT ALL ON public.attendance_ping_logs TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.attendance_ping_logs_id_seq TO anon, authenticated, service_role;

-- --------------------------------------------------------
-- 8. Reload PostgREST schema cache
-- --------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;
