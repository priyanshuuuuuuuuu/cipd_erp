-- ============================================================
-- Feedback System Migration — STEP 1: Run this FIRST
-- Adds feedback_deadline column and mcq enum value
-- ============================================================

-- 1. Add feedback_deadline column to sessions (admin can override)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS feedback_deadline TIMESTAMPTZ;

-- 2. Add 'mcq' to the feedback question type enum
-- NOTE: This must be committed BEFORE using 'mcq' in any INSERT.
ALTER TYPE feedback_question_type ADD VALUE IF NOT EXISTS 'mcq';
