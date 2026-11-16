-- 0006_dropdown_options: admin-editable dropdown lists shared by every admin and cohort
-- (faculty designation and department in Admin > Faculty Hours). Idempotent.
CREATE TABLE IF NOT EXISTS core.dropdown_options (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       text NOT NULL CHECK (kind IN ('faculty_designation','faculty_department')),
  value      text NOT NULL CHECK (length(trim(value)) > 0 AND length(value) <= 120),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dropdown_options_kind_value_uq ON core.dropdown_options (kind, lower(value));

INSERT INTO core.dropdown_options (kind, value, sort_order) VALUES
  ('faculty_designation', 'Professor', 1),
  ('faculty_designation', 'Visiting Professor', 2),
  ('faculty_designation', 'Guest Lecturer', 3),
  ('faculty_designation', 'Instructor', 4),
  ('faculty_designation', 'Other', 5),
  ('faculty_department', 'Computer Science and Engineering (CSE)', 1),
  ('faculty_department', 'Electronics and Communication Engineering (ECE)', 2),
  ('faculty_department', 'Computational Biology (CB)', 3),
  ('faculty_department', 'Human-Centered Design (HCD)', 4),
  ('faculty_department', 'Mathematics (Math)', 5),
  ('faculty_department', 'Social Sciences and Humanities (SSH)', 6),
  ('faculty_department', 'Other', 7)
ON CONFLICT DO NOTHING;
