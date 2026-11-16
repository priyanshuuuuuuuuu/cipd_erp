-- Prerequisites for the core registry migration on an empty database.
-- Existing installations get their shared enums and schemas from the legacy tables.
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS july;
CREATE SCHEMA IF NOT EXISTS junedecember2026;

DO $$ BEGIN
  IF to_regtype('core.user_role') IS NULL AND to_regtype('public.user_role') IS NULL THEN
    CREATE TYPE core.user_role AS ENUM ('admin', 'faculty', 'student');
  END IF;
  IF to_regtype('core.session_status') IS NULL AND to_regtype('public.session_status') IS NULL THEN
    CREATE TYPE core.session_status AS ENUM ('scheduled', 'completed', 'cancelled');
  END IF;
  IF to_regtype('core.attendance_status') IS NULL AND to_regtype('public.attendance_status') IS NULL THEN
    CREATE TYPE core.attendance_status AS ENUM ('present', 'absent', 'partial', 'present_online', 'half', 'leave', 'other');
  END IF;
  IF to_regtype('core.feedback_question_type') IS NULL AND to_regtype('public.feedback_question_type') IS NULL THEN
    CREATE TYPE core.feedback_question_type AS ENUM ('rating', 'yes_no', 'text', 'mcq');
  END IF;
END $$;
