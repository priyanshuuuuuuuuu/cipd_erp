-- Feedback module constraints & indexes (FDB-1, FDB-3)
-- Run against Supabase after reviewing for duplicate rows.

-- Composite index for student+session lookups (pending, submit guard)
CREATE INDEX IF NOT EXISTS idx_feedback_student_session
ON feedback_responses (student_id, session_id);

-- Prevent duplicate answers per question per student per session
ALTER TABLE feedback_responses
  DROP CONSTRAINT IF EXISTS feedback_responses_session_student_question_unique;

ALTER TABLE feedback_responses
  ADD CONSTRAINT feedback_responses_session_student_question_unique
  UNIQUE (session_id, student_id, question_id);
