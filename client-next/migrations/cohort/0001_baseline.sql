-- 0001_baseline: complete structure of a cohort schema, generated from junedecember2026 (after 0002 reconcile)
-- on 2026-11-03. Used to provision NEW cohorts. Existing cohorts (public, july, junedecember2026) are
-- adopted at this version by the runner without executing it.
-- Placeholders ({{schema}}, {{schema_literal}}, {{cohort_id}}) are substituted by lib/migrator.mjs, which also
-- runs this inside a transaction with: SET LOCAL search_path TO "<schema>", core.
-- NOTE: uuid defaults use gen_random_uuid() (built in); existing cohorts still use extensions.uuid_generate_v4(),
-- which scripts/check-schema-drift.mjs treats as equivalent.

--
--

--
-- Name: auto_enroll_all_in_new_course(); Type: FUNCTION; Schema: {{schema}}; Owner: -
--

CREATE FUNCTION {{schema}}.auto_enroll_all_in_new_course() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      INSERT INTO {{schema}}.course_enrollments (student_id, course_id, enrolled_at)
      SELECT s.id, NEW.id, now() FROM {{schema}}.students s
      ON CONFLICT (course_id, student_id) DO NOTHING;
      RETURN NEW;
    END;
    $$;

--
-- Name: auto_enroll_student_in_courses(); Type: FUNCTION; Schema: {{schema}}; Owner: -
--

CREATE FUNCTION {{schema}}.auto_enroll_student_in_courses() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
          INSERT INTO {{schema}}.course_enrollments (student_id, course_id)
          SELECT NEW.id, courses.id
          FROM {{schema}}.courses
          ON CONFLICT DO NOTHING;
          RETURN NEW;
      END;
      $$;

--
-- Name: assignment_submissions; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.assignment_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid,
    student_id uuid,
    file_url text,
    submitted_at timestamp without time zone DEFAULT now(),
    grade numeric(5,2),
    feedback text
);

--
-- Name: assignments; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid,
    faculty_id uuid,
    title text,
    description text,
    due_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    total_marks numeric DEFAULT 100
);

--
-- Name: COLUMN assignments.total_marks; Type: COMMENT; Schema: {{schema}}; Owner: -
--

COMMENT ON COLUMN {{schema}}.assignments.total_marks IS 'Maximum marks for this assignment (used in grade % calculation)';

--
-- Name: attendance_ping_logs; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.attendance_ping_logs (
    id bigint NOT NULL,
    session_id uuid,
    student_id uuid,
    device_hash text,
    bssid text,
    signal_strength integer,
    ping_time timestamp with time zone DEFAULT now()
);

--
-- Name: attendance_ping_logs_id_seq; Type: SEQUENCE; Schema: {{schema}}; Owner: -
--

CREATE SEQUENCE {{schema}}.attendance_ping_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: attendance_ping_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: {{schema}}; Owner: -
--

ALTER SEQUENCE {{schema}}.attendance_ping_logs_id_seq OWNED BY {{schema}}.attendance_ping_logs.id;

--
-- Name: attendance_records; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.attendance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    student_id uuid,
    ping_count integer DEFAULT 0,
    status core.attendance_status,
    calculated_at timestamp without time zone DEFAULT now(),
    first_seen_at timestamp without time zone,
    last_seen_at timestamp without time zone,
    duration_minutes numeric(6,1) DEFAULT 0,
    avg_signal_strength numeric(6,1),
    points numeric(3,2),
    admin_override boolean DEFAULT false,
    override_by text,
    penalty boolean DEFAULT false,
    penalty_reason text
);

--
-- Name: categories; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);

--
-- Name: course_enrollments; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.course_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid,
    student_id uuid,
    enrolled_at timestamp without time zone DEFAULT now()
);

--
-- Name: courses; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    code text
);

--
-- Name: COLUMN courses.code; Type: COMMENT; Schema: {{schema}}; Owner: -
--

COMMENT ON COLUMN {{schema}}.courses.code IS 'Short course code, e.g. CS101, EC204';

--
-- Name: faculty; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.faculty (
    id uuid NOT NULL,
    designation text,
    years_experience integer,
    honorarium_rate_per_hour numeric(10,2),
    created_at timestamp without time zone DEFAULT now(),
    department text,
    photo_url text,
    bank_account_number text,
    bank_account_holder text,
    bank_ifsc_code text,
    bank_branch text
);

--
-- Name: COLUMN faculty.department; Type: COMMENT; Schema: {{schema}}; Owner: -
--

COMMENT ON COLUMN {{schema}}.faculty.department IS 'Department name, e.g. Computer Science, Electronics';

--
-- Name: COLUMN faculty.photo_url; Type: COMMENT; Schema: {{schema}}; Owner: -
--

COMMENT ON COLUMN {{schema}}.faculty.photo_url IS 'URL to faculty profile photo (Supabase Storage or external)';

--
-- Name: feedback_questions; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.feedback_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question text NOT NULL,
    category text,
    type core.feedback_question_type,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);

--
-- Name: feedback_responses; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.feedback_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    student_id uuid,
    question_id uuid,
    rating integer,
    yes_no boolean,
    text_answer text,
    submitted_at timestamp without time zone DEFAULT now()
);

--
-- Name: google_tokens; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.google_tokens (
    user_id uuid NOT NULL,
    access_token text,
    refresh_token text NOT NULL,
    expiry_time bigint,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    role text DEFAULT 'student'::text
);

--
-- Name: leave_requests; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    leave_date date NOT NULL,
    session_id uuid,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT leave_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

--
-- Name: notification_stream; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.notification_stream (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dedupe_key text NOT NULL,
    event_type text NOT NULL,
    channel text NOT NULL,
    recipient_id uuid,
    recipient_email text NOT NULL,
    recipient_name text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    locked_by text,
    sent_at timestamp with time zone,
    provider_message_id text,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    session_id uuid,
    CONSTRAINT notification_stream_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT notification_stream_channel_check CHECK ((channel = 'email'::text)),
    CONSTRAINT notification_stream_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'retry'::text, 'sent'::text, 'failed'::text])))
);

--
-- Name: notifications; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid,
    type text DEFAULT 'general'::text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    course_id uuid,
    session_id uuid,
    is_read boolean DEFAULT false,
    sent_by uuid,
    created_at timestamp without time zone DEFAULT now()
);

--
-- Name: session_materials; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.session_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    uploaded_by uuid,
    title text,
    file_url text,
    created_at timestamp without time zone DEFAULT now(),
    content text,
    file_type text DEFAULT 'pdf'::text,
    course_id uuid,
    faculty_id uuid
);

--
-- Name: session_skills; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.session_skills (
    session_id uuid NOT NULL,
    skill_id uuid NOT NULL
);

--
-- Name: session_types; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.session_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);

--
-- Name: sessions; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid,
    faculty_id uuid,
    title text NOT NULL,
    venue_id uuid,
    session_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    status core.session_status DEFAULT 'scheduled'::core.session_status,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    feedback_deadline timestamp with time zone,
    session_type_id uuid,
    category_id uuid
);

--
-- Name: skills; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    category_id uuid,
    details text
);

--
-- Name: student_attendance_marks; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.student_attendance_marks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    session_date date NOT NULL,
    session_slot smallint NOT NULL,
    status text NOT NULL,
    session_id uuid,
    course_id uuid,
    source_domain text,
    source_sheet text,
    iso_week text,
    ingested_at timestamp with time zone DEFAULT now()
);

--
-- Name: student_course_attendance; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.student_course_attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    course_id uuid NOT NULL,
    attendance_percentage numeric NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: students; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.students (
    id uuid NOT NULL,
    enrollment_no text,
    program_name text,
    device_hash text,
    mac_address text,
    mac_verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    photo_url text
);

--
-- Name: COLUMN students.photo_url; Type: COMMENT; Schema: {{schema}}; Owner: -
--

COMMENT ON COLUMN {{schema}}.students.photo_url IS 'URL to student profile photo';

--
-- Name: system_settings; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.system_settings (
    id integer DEFAULT 1 NOT NULL,
    ping_interval integer DEFAULT 10,
    pings_per_session integer DEFAULT 6,
    presence_threshold integer DEFAULT 3,
    attendance_window integer DEFAULT 60,
    updated_at timestamp without time zone DEFAULT now(),
    scanner_interval_minutes integer DEFAULT 6,
    min_signal integer DEFAULT 2
);

--
-- Name: users; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role core.user_role NOT NULL,
    first_name text,
    last_name text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    preferences jsonb DEFAULT '{}'::jsonb
);

--
-- Name: COLUMN users.preferences; Type: COMMENT; Schema: {{schema}}; Owner: -
--

COMMENT ON COLUMN {{schema}}.users.preferences IS 'User-specific preferences: notifications, theme, font_size, etc.';

--
-- Name: venues; Type: TABLE; Schema: {{schema}}; Owner: -
--

CREATE TABLE {{schema}}.venues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    building text,
    router_bssid text,
    created_at timestamp without time zone DEFAULT now(),
    is_active boolean DEFAULT true
);

--
-- Name: attendance_ping_logs id; Type: DEFAULT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.attendance_ping_logs ALTER COLUMN id SET DEFAULT nextval('{{schema}}.attendance_ping_logs_id_seq'::regclass);

--
-- Name: assignment_submissions assignment_submissions_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.assignment_submissions
    ADD CONSTRAINT assignment_submissions_pkey PRIMARY KEY (id);

--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);

--
-- Name: attendance_ping_logs attendance_ping_logs_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.attendance_ping_logs
    ADD CONSTRAINT attendance_ping_logs_pkey PRIMARY KEY (id);

--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);

--
-- Name: attendance_records attendance_records_session_id_student_id_key; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.attendance_records
    ADD CONSTRAINT attendance_records_session_id_student_id_key UNIQUE (session_id, student_id);

--
-- Name: categories categories_course_id_name_key; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.categories
    ADD CONSTRAINT categories_course_id_name_key UNIQUE (course_id, name);

--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);

--
-- Name: course_enrollments course_enrollments_course_id_student_id_key; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.course_enrollments
    ADD CONSTRAINT course_enrollments_course_id_student_id_key UNIQUE (course_id, student_id);

--
-- Name: course_enrollments course_enrollments_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.course_enrollments
    ADD CONSTRAINT course_enrollments_pkey PRIMARY KEY (id);

--
-- Name: courses courses_code_key; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.courses
    ADD CONSTRAINT courses_code_key UNIQUE (code);

--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);

--
-- Name: faculty faculty_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.faculty
    ADD CONSTRAINT faculty_pkey PRIMARY KEY (id);

--
-- Name: feedback_questions feedback_questions_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.feedback_questions
    ADD CONSTRAINT feedback_questions_pkey PRIMARY KEY (id);

--
-- Name: feedback_responses feedback_responses_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.feedback_responses
    ADD CONSTRAINT feedback_responses_pkey PRIMARY KEY (id);

--
-- Name: feedback_responses feedback_responses_session_id_student_id_question_id_key; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.feedback_responses
    ADD CONSTRAINT feedback_responses_session_id_student_id_question_id_key UNIQUE (session_id, student_id, question_id);

--
-- Name: google_tokens google_tokens_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.google_tokens
    ADD CONSTRAINT google_tokens_pkey PRIMARY KEY (user_id);

--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);

--
-- Name: notification_stream notification_stream_dedupe_key_key; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.notification_stream
    ADD CONSTRAINT notification_stream_dedupe_key_key UNIQUE (dedupe_key);

--
-- Name: notification_stream notification_stream_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.notification_stream
    ADD CONSTRAINT notification_stream_pkey PRIMARY KEY (id);

--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

--
-- Name: session_materials session_materials_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.session_materials
    ADD CONSTRAINT session_materials_pkey PRIMARY KEY (id);

--
-- Name: session_skills session_skills_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.session_skills
    ADD CONSTRAINT session_skills_pkey PRIMARY KEY (session_id, skill_id);

--
-- Name: session_types session_types_name_key; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.session_types
    ADD CONSTRAINT session_types_name_key UNIQUE (name);

--
-- Name: session_types session_types_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.session_types
    ADD CONSTRAINT session_types_pkey PRIMARY KEY (id);

--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

--
-- Name: skills skills_name_key; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.skills
    ADD CONSTRAINT skills_name_key UNIQUE (name);

--
-- Name: skills skills_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (id);

--
-- Name: student_attendance_marks student_attendance_marks_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.student_attendance_marks
    ADD CONSTRAINT student_attendance_marks_pkey PRIMARY KEY (id);

--
-- Name: student_attendance_marks student_attendance_marks_student_id_session_date_session_sl_key; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.student_attendance_marks
    ADD CONSTRAINT student_attendance_marks_student_id_session_date_session_sl_key UNIQUE (student_id, session_date, session_slot);

--
-- Name: student_course_attendance student_course_attendance_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.student_course_attendance
    ADD CONSTRAINT student_course_attendance_pkey PRIMARY KEY (id);

--
-- Name: student_course_attendance student_course_attendance_student_id_course_id_key; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.student_course_attendance
    ADD CONSTRAINT student_course_attendance_student_id_course_id_key UNIQUE (student_id, course_id);

--
-- Name: student_course_attendance student_course_attendance_student_id_course_id_key1; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.student_course_attendance
    ADD CONSTRAINT student_course_attendance_student_id_course_id_key1 UNIQUE (student_id, course_id);

--
-- Name: students students_enrollment_no_key; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.students
    ADD CONSTRAINT students_enrollment_no_key UNIQUE (enrollment_no);

--
-- Name: students students_enrollment_no_key1; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.students
    ADD CONSTRAINT students_enrollment_no_key1 UNIQUE (enrollment_no);

--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);

--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);

--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: venues venues_pkey; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.venues
    ADD CONSTRAINT venues_pkey PRIMARY KEY (id);

--
-- Name: venues venues_router_bssid_key; Type: CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.venues
    ADD CONSTRAINT venues_router_bssid_key UNIQUE (router_bssid);

--
-- Name: assignment_submissions_assignment_id_student_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE UNIQUE INDEX assignment_submissions_assignment_id_student_id_idx ON {{schema}}.assignment_submissions USING btree (assignment_id, student_id);

--
-- Name: attendance_ping_logs_ping_time_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX attendance_ping_logs_ping_time_idx ON {{schema}}.attendance_ping_logs USING btree (ping_time DESC);

--
-- Name: attendance_ping_logs_session_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX attendance_ping_logs_session_id_idx ON {{schema}}.attendance_ping_logs USING btree (session_id);

--
-- Name: attendance_ping_logs_student_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX attendance_ping_logs_student_id_idx ON {{schema}}.attendance_ping_logs USING btree (student_id);

--
-- Name: attendance_records_session_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX attendance_records_session_id_idx ON {{schema}}.attendance_records USING btree (session_id);

--
-- Name: attendance_records_student_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX attendance_records_student_id_idx ON {{schema}}.attendance_records USING btree (student_id);

--
-- Name: categories_course_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX categories_course_id_idx ON {{schema}}.categories USING btree (course_id);

--
-- Name: feedback_responses_session_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX feedback_responses_session_id_idx ON {{schema}}.feedback_responses USING btree (session_id);

--
-- Name: feedback_responses_student_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX feedback_responses_student_id_idx ON {{schema}}.feedback_responses USING btree (student_id);

--
-- Name: feedback_responses_student_id_session_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX feedback_responses_student_id_session_id_idx ON {{schema}}.feedback_responses USING btree (student_id, session_id);

--
-- Name: leave_requests_leave_date_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX leave_requests_leave_date_idx ON {{schema}}.leave_requests USING btree (leave_date);

--
-- Name: leave_requests_session_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX leave_requests_session_id_idx ON {{schema}}.leave_requests USING btree (session_id);

--
-- Name: leave_requests_status_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX leave_requests_status_idx ON {{schema}}.leave_requests USING btree (status);

--
-- Name: leave_requests_student_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX leave_requests_student_id_idx ON {{schema}}.leave_requests USING btree (student_id);

--
-- Name: notification_stream_recipient_email_created_at_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX notification_stream_recipient_email_created_at_idx ON {{schema}}.notification_stream USING btree (recipient_email, created_at DESC);

--
-- Name: notification_stream_session_id_created_at_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX notification_stream_session_id_created_at_idx ON {{schema}}.notification_stream USING btree (session_id, created_at DESC);

--
-- Name: notification_stream_status_available_at_created_at_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX notification_stream_status_available_at_created_at_idx ON {{schema}}.notification_stream USING btree (status, available_at, created_at);

--
-- Name: notifications_recipient_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX notifications_recipient_id_idx ON {{schema}}.notifications USING btree (recipient_id);

--
-- Name: notifications_recipient_id_is_read_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX notifications_recipient_id_is_read_idx ON {{schema}}.notifications USING btree (recipient_id, is_read);

--
-- Name: session_materials_course_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX session_materials_course_id_idx ON {{schema}}.session_materials USING btree (course_id);

--
-- Name: session_materials_session_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX session_materials_session_id_idx ON {{schema}}.session_materials USING btree (session_id);

--
-- Name: session_skills_session_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX session_skills_session_id_idx ON {{schema}}.session_skills USING btree (session_id);

--
-- Name: session_skills_skill_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX session_skills_skill_id_idx ON {{schema}}.session_skills USING btree (skill_id);

--
-- Name: sessions_course_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX sessions_course_id_idx ON {{schema}}.sessions USING btree (course_id);

--
-- Name: sessions_faculty_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX sessions_faculty_id_idx ON {{schema}}.sessions USING btree (faculty_id);

--
-- Name: sessions_session_date_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX sessions_session_date_idx ON {{schema}}.sessions USING btree (session_date);

--
-- Name: sessions_venue_id_session_date_start_time_end_time_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE UNIQUE INDEX sessions_venue_id_session_date_start_time_end_time_idx ON {{schema}}.sessions USING btree (venue_id, session_date, start_time, end_time) WHERE (status <> 'cancelled'::core.session_status);

--
-- Name: skills_category_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX skills_category_id_idx ON {{schema}}.skills USING btree (category_id);

--
-- Name: student_attendance_marks_course_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX student_attendance_marks_course_id_idx ON {{schema}}.student_attendance_marks USING btree (course_id);

--
-- Name: student_attendance_marks_session_date_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX student_attendance_marks_session_date_idx ON {{schema}}.student_attendance_marks USING btree (session_date);

--
-- Name: student_attendance_marks_session_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX student_attendance_marks_session_id_idx ON {{schema}}.student_attendance_marks USING btree (session_id);

--
-- Name: student_attendance_marks_student_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX student_attendance_marks_student_id_idx ON {{schema}}.student_attendance_marks USING btree (student_id);

--
-- Name: student_course_attendance_student_id_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX student_course_attendance_student_id_idx ON {{schema}}.student_course_attendance USING btree (student_id);

--
-- Name: users_role_idx; Type: INDEX; Schema: {{schema}}; Owner: -
--

CREATE INDEX users_role_idx ON {{schema}}.users USING btree (role);

--
-- Name: courses trg_auto_enroll_course; Type: TRIGGER; Schema: {{schema}}; Owner: -
--

CREATE TRIGGER trg_auto_enroll_course AFTER INSERT ON {{schema}}.courses FOR EACH ROW EXECUTE FUNCTION {{schema}}.auto_enroll_all_in_new_course();

--
-- Name: students trg_auto_enroll_student; Type: TRIGGER; Schema: {{schema}}; Owner: -
--

CREATE TRIGGER trg_auto_enroll_student AFTER INSERT ON {{schema}}.students FOR EACH ROW EXECUTE FUNCTION {{schema}}.auto_enroll_student_in_courses();

--
-- Name: assignment_submissions assignment_submissions_assignment_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.assignment_submissions
    ADD CONSTRAINT assignment_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES {{schema}}.assignments(id);

--
-- Name: assignment_submissions assignment_submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.assignment_submissions
    ADD CONSTRAINT assignment_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES {{schema}}.students(id);

--
-- Name: assignments assignments_course_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.assignments
    ADD CONSTRAINT assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES {{schema}}.courses(id);

--
-- Name: assignments assignments_faculty_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.assignments
    ADD CONSTRAINT assignments_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES {{schema}}.faculty(id);

--
-- Name: attendance_ping_logs attendance_ping_logs_session_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.attendance_ping_logs
    ADD CONSTRAINT attendance_ping_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES {{schema}}.sessions(id) ON DELETE CASCADE;

--
-- Name: attendance_ping_logs attendance_ping_logs_student_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.attendance_ping_logs
    ADD CONSTRAINT attendance_ping_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES {{schema}}.students(id) ON DELETE CASCADE;

--
-- Name: attendance_records attendance_records_session_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.attendance_records
    ADD CONSTRAINT attendance_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES {{schema}}.sessions(id);

--
-- Name: attendance_records attendance_records_student_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.attendance_records
    ADD CONSTRAINT attendance_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES {{schema}}.students(id);

--
-- Name: categories categories_course_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.categories
    ADD CONSTRAINT categories_course_id_fkey FOREIGN KEY (course_id) REFERENCES {{schema}}.courses(id);

--
-- Name: course_enrollments course_enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.course_enrollments
    ADD CONSTRAINT course_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES {{schema}}.courses(id);

--
-- Name: course_enrollments course_enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.course_enrollments
    ADD CONSTRAINT course_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES {{schema}}.students(id);

--
-- Name: faculty faculty_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.faculty
    ADD CONSTRAINT faculty_id_fkey FOREIGN KEY (id) REFERENCES {{schema}}.users(id);

--
-- Name: feedback_responses feedback_responses_question_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.feedback_responses
    ADD CONSTRAINT feedback_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES {{schema}}.feedback_questions(id);

--
-- Name: feedback_responses feedback_responses_session_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.feedback_responses
    ADD CONSTRAINT feedback_responses_session_id_fkey FOREIGN KEY (session_id) REFERENCES {{schema}}.sessions(id);

--
-- Name: feedback_responses feedback_responses_student_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.feedback_responses
    ADD CONSTRAINT feedback_responses_student_id_fkey FOREIGN KEY (student_id) REFERENCES {{schema}}.students(id);

--
-- Name: google_tokens google_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.google_tokens
    ADD CONSTRAINT google_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES {{schema}}.users(id) ON DELETE CASCADE;

--
-- Name: leave_requests leave_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.leave_requests
    ADD CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES {{schema}}.users(id) ON DELETE SET NULL;

--
-- Name: leave_requests leave_requests_session_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.leave_requests
    ADD CONSTRAINT leave_requests_session_id_fkey FOREIGN KEY (session_id) REFERENCES {{schema}}.sessions(id) ON DELETE SET NULL;

--
-- Name: leave_requests leave_requests_student_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.leave_requests
    ADD CONSTRAINT leave_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES {{schema}}.students(id) ON DELETE CASCADE;

--
-- Name: notification_stream notification_stream_recipient_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.notification_stream
    ADD CONSTRAINT notification_stream_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES {{schema}}.users(id) ON DELETE SET NULL;

--
-- Name: notification_stream notification_stream_session_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.notification_stream
    ADD CONSTRAINT notification_stream_session_id_fkey FOREIGN KEY (session_id) REFERENCES {{schema}}.sessions(id) ON DELETE CASCADE;

--
-- Name: notifications notifications_course_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.notifications
    ADD CONSTRAINT notifications_course_id_fkey FOREIGN KEY (course_id) REFERENCES {{schema}}.courses(id);

--
-- Name: notifications notifications_recipient_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.notifications
    ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES {{schema}}.users(id);

--
-- Name: notifications notifications_sent_by_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.notifications
    ADD CONSTRAINT notifications_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES {{schema}}.users(id);

--
-- Name: notifications notifications_session_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.notifications
    ADD CONSTRAINT notifications_session_id_fkey FOREIGN KEY (session_id) REFERENCES {{schema}}.sessions(id);

--
-- Name: session_materials session_materials_course_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.session_materials
    ADD CONSTRAINT session_materials_course_id_fkey FOREIGN KEY (course_id) REFERENCES {{schema}}.courses(id);

--
-- Name: session_materials session_materials_faculty_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.session_materials
    ADD CONSTRAINT session_materials_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES {{schema}}.faculty(id);

--
-- Name: session_materials session_materials_session_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.session_materials
    ADD CONSTRAINT session_materials_session_id_fkey FOREIGN KEY (session_id) REFERENCES {{schema}}.sessions(id);

--
-- Name: session_materials session_materials_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.session_materials
    ADD CONSTRAINT session_materials_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES {{schema}}.users(id);

--
-- Name: session_skills session_skills_session_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.session_skills
    ADD CONSTRAINT session_skills_session_id_fkey FOREIGN KEY (session_id) REFERENCES {{schema}}.sessions(id) ON DELETE CASCADE;

--
-- Name: session_skills session_skills_skill_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.session_skills
    ADD CONSTRAINT session_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES {{schema}}.skills(id) ON DELETE CASCADE;

--
-- Name: sessions sessions_category_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.sessions
    ADD CONSTRAINT sessions_category_id_fkey FOREIGN KEY (category_id) REFERENCES {{schema}}.categories(id) ON DELETE SET NULL;

--
-- Name: sessions sessions_course_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.sessions
    ADD CONSTRAINT sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES {{schema}}.courses(id) ON DELETE CASCADE;

--
-- Name: sessions sessions_created_by_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.sessions
    ADD CONSTRAINT sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES {{schema}}.users(id);

--
-- Name: sessions sessions_faculty_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.sessions
    ADD CONSTRAINT sessions_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES {{schema}}.faculty(id);

--
-- Name: sessions sessions_session_type_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.sessions
    ADD CONSTRAINT sessions_session_type_id_fkey FOREIGN KEY (session_type_id) REFERENCES {{schema}}.session_types(id);

--
-- Name: sessions sessions_venue_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.sessions
    ADD CONSTRAINT sessions_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES {{schema}}.venues(id);

--
-- Name: skills skills_category_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.skills
    ADD CONSTRAINT skills_category_id_fkey FOREIGN KEY (category_id) REFERENCES {{schema}}.categories(id);

--
-- Name: student_attendance_marks student_attendance_marks_course_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.student_attendance_marks
    ADD CONSTRAINT student_attendance_marks_course_id_fkey FOREIGN KEY (course_id) REFERENCES {{schema}}.courses(id) ON DELETE SET NULL;

--
-- Name: student_attendance_marks student_attendance_marks_session_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.student_attendance_marks
    ADD CONSTRAINT student_attendance_marks_session_id_fkey FOREIGN KEY (session_id) REFERENCES {{schema}}.sessions(id) ON DELETE SET NULL;

--
-- Name: student_attendance_marks student_attendance_marks_student_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.student_attendance_marks
    ADD CONSTRAINT student_attendance_marks_student_id_fkey FOREIGN KEY (student_id) REFERENCES {{schema}}.students(id) ON DELETE CASCADE;

--
-- Name: student_course_attendance student_course_attendance_course_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.student_course_attendance
    ADD CONSTRAINT student_course_attendance_course_id_fkey FOREIGN KEY (course_id) REFERENCES {{schema}}.courses(id) ON DELETE CASCADE;

--
-- Name: student_course_attendance student_course_attendance_student_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.student_course_attendance
    ADD CONSTRAINT student_course_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES {{schema}}.students(id) ON DELETE CASCADE;

--
-- Name: students students_id_fkey; Type: FK CONSTRAINT; Schema: {{schema}}; Owner: -
--

ALTER TABLE ONLY {{schema}}.students
    ADD CONSTRAINT students_id_fkey FOREIGN KEY (id) REFERENCES {{schema}}.users(id) ON DELETE CASCADE;

--
--
