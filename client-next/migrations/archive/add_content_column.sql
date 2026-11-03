-- Add content column to session_materials for storing lecture notes text
ALTER TABLE session_materials ADD COLUMN IF NOT EXISTS content TEXT;

-- Add file_type column to distinguish between PDFs, slides, notes, links
ALTER TABLE session_materials ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'pdf';

-- Add course_id for efficient per-course material queries (avoids joining through sessions)
ALTER TABLE session_materials ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE;

-- Add faculty_id to track who uploaded the material
ALTER TABLE session_materials ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL;

-- Index for fast lookup by course
CREATE INDEX IF NOT EXISTS idx_session_materials_course_id ON session_materials(course_id);
