-- 0008_session_faculty: a class can have several faculty. session_faculty is the source of truth;
-- sessions.faculty_id is kept (legacy / first faculty) so the change can be rolled back, but the app no longer reads it.
-- Idempotent. Runs per cohort with search_path set to the cohort schema.

CREATE TABLE IF NOT EXISTS session_faculty (
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  faculty_id  uuid NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  position    smallint NOT NULL DEFAULT 0,
  assigned_at timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, faculty_id)
);
CREATE INDEX IF NOT EXISTS session_faculty_faculty_idx ON session_faculty (faculty_id);

INSERT INTO session_faculty (session_id, faculty_id, position)
SELECT s.id, s.faculty_id, 0
  FROM sessions s
 WHERE s.faculty_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM faculty f WHERE f.id = s.faculty_id)
ON CONFLICT DO NOTHING;
