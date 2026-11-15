-- 0006_faculty_portal: modules (courses) classroom stream, faculty<->module assignment, assignment grading metadata,
-- session change requests and faculty leave. Idempotent. Runs per cohort with search_path set to the cohort schema.

-- Which faculty teach which module. Faculty also get implicit access to modules they have sessions in (lib/faculty-access.js).
CREATE TABLE IF NOT EXISTS course_faculty (
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  faculty_id  uuid NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  assigned_at timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, faculty_id)
);
CREATE INDEX IF NOT EXISTS course_faculty_faculty_idx ON course_faculty (faculty_id);

INSERT INTO course_faculty (course_id, faculty_id)
SELECT DISTINCT s.course_id, s.faculty_id
  FROM sessions s
 WHERE s.course_id IS NOT NULL AND s.faculty_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM faculty f WHERE f.id = s.faculty_id)
ON CONFLICT DO NOTHING;

-- Classroom stream: announcements, materials, links and assignments of a module.
CREATE TABLE IF NOT EXISTS course_posts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id          uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  author_id          uuid REFERENCES users(id) ON DELETE SET NULL,
  type               text NOT NULL CHECK (type IN ('announcement','material','link','assignment')),
  title              text NOT NULL,
  body               text,
  file_url           text,
  file_bucket        text,
  file_type          text,
  link_url           text,
  session_id         uuid REFERENCES sessions(id) ON DELETE SET NULL,
  assignment_id      uuid REFERENCES assignments(id) ON DELETE SET NULL,
  pinned             boolean NOT NULL DEFAULT false,
  legacy_material_id uuid UNIQUE,
  created_at         timestamp without time zone NOT NULL DEFAULT now(),
  updated_at         timestamp without time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_posts_course_idx ON course_posts (course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS course_posts_author_idx ON course_posts (author_id);

-- Existing session materials become 'material' posts (files stay in their original bucket).
INSERT INTO course_posts (course_id, author_id, type, title, body, file_url, file_bucket, file_type, session_id, legacy_material_id, created_at)
SELECT m.course_id,
       (SELECT u.id FROM users u WHERE u.id IN (m.uploaded_by, m.faculty_id) ORDER BY (u.id = m.uploaded_by) DESC LIMIT 1),
       'material', COALESCE(NULLIF(m.title, ''), 'Material'),
       m.content, m.file_url, 'session-materials', m.file_type,
       (SELECT s.id FROM sessions s WHERE s.id = m.session_id),
       m.id, COALESCE(m.created_at, now())
  FROM session_materials m
 WHERE m.course_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM courses c WHERE c.id = m.course_id)
ON CONFLICT (legacy_material_id) DO NOTHING;

-- Assignments: optional attachment, late-submission switch, grading metadata.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS allow_late boolean NOT NULL DEFAULT true;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS graded_at timestamp without time zone;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS graded_by uuid;

-- Faculty asks the admin to cancel / move one of their sessions.
CREATE TABLE IF NOT EXISTS session_change_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  faculty_id     uuid NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('cancel','reschedule')),
  proposed_date  date,
  proposed_start time without time zone,
  proposed_end   time without time zone,
  reason         text NOT NULL,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes    text,
  decided_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_at     timestamp with time zone,
  created_at     timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS session_change_requests_status_idx ON session_change_requests (status);
CREATE INDEX IF NOT EXISTS session_change_requests_faculty_idx ON session_change_requests (faculty_id);

-- Faculty leave (leave_requests is student-only).
CREATE TABLE IF NOT EXISTS faculty_leave (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id  uuid NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
  from_date   date NOT NULL,
  to_date     date NOT NULL,
  reason      text NOT NULL,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes text,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp with time zone,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  CHECK (to_date >= from_date)
);
CREATE INDEX IF NOT EXISTS faculty_leave_faculty_idx ON faculty_leave (faculty_id);
CREATE INDEX IF NOT EXISTS faculty_leave_status_idx ON faculty_leave (status);
