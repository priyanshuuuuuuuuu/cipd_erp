-- ================================================================
-- CiPD 360 Master Report Migration
-- Run this in the Supabase SQL Editor
-- ================================================================

-- 1. CATEGORIES TABLE
-- Links a category to a course (domain). e.g., Microcontroller → Embedded Systems & IoT
CREATE TABLE IF NOT EXISTS categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id   UUID REFERENCES courses(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT now(),
    UNIQUE(course_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_course ON categories(course_id);

-- 2. SKILLS TABLE — update to support categories and detail
-- Add category_id and details columns if they don't exist yet
ALTER TABLE skills
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS details     TEXT;

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category_id);

-- 3. SESSION_SKILLS MAPPING TABLE
-- Tracks which skills were taught in each session (post-class tagging)
CREATE TABLE IF NOT EXISTS session_skills (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
    skill_id    UUID REFERENCES skills(id) ON DELETE CASCADE NOT NULL,
    created_at  TIMESTAMP DEFAULT now(),
    UNIQUE(session_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_session_skills_session ON session_skills(session_id);
CREATE INDEX IF NOT EXISTS idx_session_skills_skill   ON session_skills(skill_id);

-- 4. Add category_id to sessions (optional — which category does this session fall under)
ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- ================================================================
-- Done. You can now populate:
--   - categories (linked to your existing courses)
--   - skills (linked to categories, with details)
--   - session_skills (post-class, via edit session modal)
--   - sessions.category_id (set when editing a completed session)
-- ================================================================
