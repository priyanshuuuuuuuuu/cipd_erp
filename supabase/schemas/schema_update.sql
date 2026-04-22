-- 0. EXTENSIONS

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. CREATE TABLES



CREATE TABLE IF NOT EXISTS assignment_submissions (
  submitted_at timestamp without time zone,
  feedback text,
  file_url text,
  grade numeric,
  student_id uuid,
  assignment_id uuid,
  id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
  course_id uuid,
  title text,
  description text,
  created_at timestamp without time zone,
  due_date timestamp without time zone,
  faculty_id uuid,
  total_marks numeric DEFAULT 100,
  id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_ping_logs (
  id bigint NOT NULL,
  session_id uuid,
  student_id uuid,
  device_hash text,
  bssid text,
  signal_strength integer,
  ping_time timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  session_id uuid,
  avg_signal_strength numeric,
  duration_minutes numeric,
  last_seen_at timestamp without time zone,
  first_seen_at timestamp without time zone,
  calculated_at timestamp without time zone,
  status attendance_status,
  ping_count integer,
  student_id uuid,
  id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS course_enrollments (
  student_id uuid,
  id uuid NOT NULL,
  course_id uuid,
  enrolled_at timestamp without time zone
);

CREATE TABLE IF NOT EXISTS courses (
  id uuid NOT NULL,
  created_at timestamp without time zone,
  description text,
  name text NOT NULL,
  code text UNIQUE
);

CREATE TABLE IF NOT EXISTS faculty (
  id uuid NOT NULL,
  designation text,
  honorarium_rate_per_hour numeric,
  years_experience integer,
  created_at timestamp without time zone,
  department text,
  photo_url text
);



CREATE TABLE IF NOT EXISTS feedback_questions (
  created_at timestamp without time zone,
  question text NOT NULL,
  category text,
  id uuid NOT NULL,
  type feedback_question_type,
  active boolean
);

CREATE TABLE IF NOT EXISTS feedback_responses (
  text_answer text,
  rating integer,
  session_id uuid,
  yes_no boolean,
  student_id uuid,
  submitted_at timestamp without time zone,
  question_id uuid,
  id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  sent_by uuid,
  is_read boolean,
  session_id uuid,
  title text NOT NULL,
  type text NOT NULL,
  id uuid NOT NULL,
  recipient_id uuid,
  message text NOT NULL,
  course_id uuid,
  created_at timestamp without time zone
);

CREATE TABLE IF NOT EXISTS session_materials (
  content text,
  uploaded_by uuid,
  session_id uuid,
  file_url text,
  id uuid NOT NULL,
  course_id uuid,
  faculty_id uuid,
  title text,
  file_type text,
  created_at timestamp without time zone
);

CREATE TABLE IF NOT EXISTS sessions (
  start_time time without time zone NOT NULL,
  id uuid NOT NULL,
  course_id uuid,
  faculty_id uuid,
  venue_id uuid,
  session_date date NOT NULL,
  end_time time without time zone NOT NULL,
  status session_status,
  created_by uuid,
  created_at timestamp without time zone,
  title text NOT NULL
);



CREATE TABLE IF NOT EXISTS students (
  program_name text,
  mac_address text,
  id uuid NOT NULL,
  mac_verified boolean,
  created_at timestamp without time zone,
  enrollment_no text,
  device_hash text,
  photo_url text
);

CREATE TABLE IF NOT EXISTS system_settings (
  attendance_window integer,
  id integer NOT NULL,
  ping_interval integer,
  updated_at timestamp without time zone,
  pings_per_session integer,
  presence_threshold integer
);

CREATE TABLE IF NOT EXISTS users (
  is_active boolean,
  email text NOT NULL,
  password_hash text NOT NULL,
  first_name text,
  last_name text,
  id uuid NOT NULL,
  role user_role NOT NULL,
  updated_at timestamp without time zone,
  created_at timestamp without time zone,
  preferences jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS venues (
  name text NOT NULL,
  created_at timestamp without time zone,
  id uuid NOT NULL,
  building text,
  router_bssid text,
  is_active boolean
);

CREATE TABLE wifi_snapshots (
  captured_at timestamp with time zone NOT NULL,
  id bigint NOT NULL,
  error text,
  iw_dump jsonb NOT NULL
);

-- 2. PRIMARY KEYS

ALTER TABLE assignment_submissions ADD CONSTRAINT assignment_submissions_pkey PRIMARY KEY (id);

ALTER TABLE assignments ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);

ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);

ALTER TABLE course_enrollments ADD CONSTRAINT course_enrollments_pkey PRIMARY KEY (id);

ALTER TABLE courses ADD CONSTRAINT courses_pkey PRIMARY KEY (id);

ALTER TABLE faculty ADD CONSTRAINT faculty_pkey PRIMARY KEY (id);

ALTER TABLE feedback_questions ADD CONSTRAINT feedback_questions_pkey PRIMARY KEY (id);

ALTER TABLE feedback_responses ADD CONSTRAINT feedback_responses_pkey PRIMARY KEY (id);

ALTER TABLE notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE session_materials ADD CONSTRAINT session_materials_pkey PRIMARY KEY (id);

ALTER TABLE sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (id, id);

ALTER TABLE students ADD CONSTRAINT students_pkey PRIMARY KEY (id);

ALTER TABLE system_settings ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);

ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id, id);

ALTER TABLE venues ADD CONSTRAINT venues_pkey PRIMARY KEY (id);

ALTER TABLE wifi_snapshots ADD CONSTRAINT wifi_snapshots_pkey PRIMARY KEY (id);

-- 3. FOREIGN KEYS

ALTER TABLE students ADD CONSTRAINT students_id_fkey FOREIGN KEY (id) REFERENCES users(id);

ALTER TABLE faculty ADD CONSTRAINT faculty_id_fkey FOREIGN KEY (id) REFERENCES users(id);

ALTER TABLE course_enrollments ADD CONSTRAINT course_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE course_enrollments ADD CONSTRAINT course_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id);

ALTER TABLE sessions ADD CONSTRAINT sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE sessions ADD CONSTRAINT sessions_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES faculty(id);

ALTER TABLE sessions ADD CONSTRAINT sessions_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id);

ALTER TABLE sessions ADD CONSTRAINT sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES sessions(id);

ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id);

ALTER TABLE feedback_responses ADD CONSTRAINT feedback_responses_session_id_fkey FOREIGN KEY (session_id) REFERENCES sessions(id);

ALTER TABLE feedback_responses ADD CONSTRAINT feedback_responses_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id);

ALTER TABLE feedback_responses ADD CONSTRAINT feedback_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES feedback_questions(id);

ALTER TABLE session_materials ADD CONSTRAINT session_materials_session_id_fkey FOREIGN KEY (session_id) REFERENCES sessions(id);

ALTER TABLE session_materials ADD CONSTRAINT session_materials_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id);

ALTER TABLE assignments ADD CONSTRAINT assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE assignments ADD CONSTRAINT assignments_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES faculty(id);

ALTER TABLE assignment_submissions ADD CONSTRAINT assignment_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id);

ALTER TABLE assignment_submissions ADD CONSTRAINT assignment_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id);

ALTER TABLE session_materials ADD CONSTRAINT session_materials_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE session_materials ADD CONSTRAINT session_materials_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES faculty(id);

ALTER TABLE notifications ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES users(id);

ALTER TABLE notifications ADD CONSTRAINT notifications_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE notifications ADD CONSTRAINT notifications_session_id_fkey FOREIGN KEY (session_id) REFERENCES sessions(id);

ALTER TABLE notifications ADD CONSTRAINT notifications_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES users(id);

-- 4. INDEXES

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE INDEX idx_users_role ON public.users USING btree (role);

CREATE UNIQUE INDEX students_pkey ON public.students USING btree (id);

CREATE UNIQUE INDEX students_enrollment_no_key ON public.students USING btree (enrollment_no);

CREATE UNIQUE INDEX faculty_pkey ON public.faculty USING btree (id);

CREATE UNIQUE INDEX courses_pkey ON public.courses USING btree (id);

CREATE UNIQUE INDEX course_enrollments_pkey ON public.course_enrollments USING btree (id);

CREATE UNIQUE INDEX course_enrollments_course_id_student_id_key ON public.course_enrollments USING btree (course_id, student_id);

CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (id);

CREATE INDEX idx_sessions_date ON public.sessions USING btree (session_date);

CREATE INDEX idx_sessions_faculty ON public.sessions USING btree (faculty_id);

CREATE INDEX idx_sessions_course ON public.sessions USING btree (course_id);

CREATE UNIQUE INDEX unique_venue_schedule ON public.sessions USING btree (venue_id, session_date, start_time, end_time) WHERE (status <> 'cancelled'::session_status);

CREATE UNIQUE INDEX attendance_records_pkey ON public.attendance_records USING btree (id);

CREATE UNIQUE INDEX attendance_records_session_id_student_id_key ON public.attendance_records USING btree (session_id, student_id);

CREATE INDEX idx_attendance_student ON public.attendance_records USING btree (student_id);

CREATE INDEX idx_attendance_session ON public.attendance_records USING btree (session_id);

CREATE UNIQUE INDEX feedback_responses_pkey ON public.feedback_responses USING btree (id);

CREATE INDEX idx_feedback_session ON public.feedback_responses USING btree (session_id);

CREATE INDEX idx_feedback_student ON public.feedback_responses USING btree (student_id);

CREATE UNIQUE INDEX feedback_questions_pkey ON public.feedback_questions USING btree (id);

CREATE UNIQUE INDEX assignments_pkey ON public.assignments USING btree (id);

CREATE UNIQUE INDEX session_materials_pkey ON public.session_materials USING btree (id);

CREATE INDEX idx_session_materials_course_id ON public.session_materials USING btree (course_id);

CREATE UNIQUE INDEX assignment_submissions_pkey ON public.assignment_submissions USING btree (id);

CREATE UNIQUE INDEX wifi_snapshots_pkey ON public.wifi_snapshots USING btree (id);

CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);

CREATE INDEX idx_notifications_recipient ON public.notifications USING btree (recipient_id);

CREATE INDEX idx_notifications_read ON public.notifications USING btree (recipient_id, is_read);

CREATE UNIQUE INDEX venues_pkey ON public.venues USING btree (id);

CREATE UNIQUE INDEX venues_router_bssid_key ON public.venues USING btree (router_bssid);

CREATE UNIQUE INDEX system_settings_pkey ON public.system_settings USING btree (id);

