-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'partial', 'present_online', 'half', 'leave', 'other');--> statement-breakpoint
CREATE TYPE "public"."feedback_question_type" AS ENUM('rating', 'yes_no', 'text', 'mcq');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'faculty', 'student');--> statement-breakpoint
CREATE TABLE "attendance_ping_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid,
	"student_id" uuid,
	"device_hash" text,
	"bssid" text,
	"signal_strength" integer,
	"ping_time" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "attendance_ping_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY NOT NULL,
	"enrollment_no" text,
	"program_name" text,
	"device_hash" text,
	"mac_address" text,
	"mac_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"photo_url" text,
	CONSTRAINT "students_enrollment_no_key" UNIQUE("enrollment_no"),
	CONSTRAINT "unique_enrollment_no" UNIQUE("enrollment_no")
);
--> statement-breakpoint
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"course_id" uuid,
	"faculty_id" uuid,
	"title" text,
	"description" text,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"total_marks" numeric DEFAULT '100'
);
--> statement-breakpoint
ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"course_id" uuid,
	"faculty_id" uuid,
	"title" text NOT NULL,
	"venue_id" uuid,
	"session_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"status" "session_status" DEFAULT 'scheduled',
	"created_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"feedback_deadline" timestamp with time zone,
	"session_type_id" uuid,
	"category_id" uuid
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "faculty" (
	"id" uuid PRIMARY KEY NOT NULL,
	"designation" text,
	"years_experience" integer,
	"honorarium_rate_per_hour" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"department" text,
	"photo_url" text
);
--> statement-breakpoint
ALTER TABLE "faculty" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wifi_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"iw_dump" jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "wifi_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"code" text,
	CONSTRAINT "courses_code_key" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"course_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "categories_course_id_name_key" UNIQUE("course_id","name")
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"student_id" uuid NOT NULL,
	"leave_date" date NOT NULL,
	"session_id" uuid,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"admin_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_requests_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))
);
--> statement-breakpoint
ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"recipient_id" uuid,
	"type" text DEFAULT 'general' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"course_id" uuid,
	"session_id" uuid,
	"is_read" boolean DEFAULT false,
	"sent_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session_materials" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"session_id" uuid,
	"uploaded_by" uuid,
	"title" text,
	"file_url" text,
	"created_at" timestamp DEFAULT now(),
	"content" text,
	"file_type" text DEFAULT 'pdf',
	"course_id" uuid,
	"faculty_id" uuid
);
--> statement-breakpoint
ALTER TABLE "session_materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_course_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"attendance_percentage" numeric NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "student_course_attendance_student_course_uq" UNIQUE("student_id","course_id"),
	CONSTRAINT "student_course_attendance_student_id_course_id_key" UNIQUE("student_id","course_id")
);
--> statement-breakpoint
ALTER TABLE "student_course_attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "session_types_name_key" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "session_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_attendance_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"session_slot" smallint NOT NULL,
	"status" text NOT NULL,
	"session_id" uuid,
	"course_id" uuid,
	"source_domain" text,
	"source_sheet" text,
	"iso_week" text,
	"ingested_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "student_attendance_marks_student_id_session_date_session_sl_key" UNIQUE("student_id","session_date","session_slot")
);
--> statement-breakpoint
ALTER TABLE "student_attendance_marks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"category_id" uuid,
	"details" text,
	CONSTRAINT "skills_name_key" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"ping_interval" integer DEFAULT 10,
	"pings_per_session" integer DEFAULT 6,
	"presence_threshold" integer DEFAULT 3,
	"attendance_window" integer DEFAULT 60,
	"updated_at" timestamp DEFAULT now(),
	"scanner_interval_minutes" integer DEFAULT 6,
	"min_signal" integer DEFAULT 2
);
--> statement-breakpoint
ALTER TABLE "system_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"session_id" uuid,
	"student_id" uuid,
	"ping_count" integer DEFAULT 0,
	"status" "attendance_status",
	"calculated_at" timestamp DEFAULT now(),
	"first_seen_at" timestamp,
	"last_seen_at" timestamp,
	"duration_minutes" numeric(6, 1) DEFAULT '0',
	"avg_signal_strength" numeric(6, 1),
	"points" numeric(3, 2),
	"admin_override" boolean DEFAULT false,
	"override_by" text,
	"penalty" boolean DEFAULT false,
	"penalty_reason" text,
	CONSTRAINT "attendance_records_session_id_student_id_key" UNIQUE("session_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feedback_questions" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"question" text NOT NULL,
	"category" text,
	"type" "feedback_question_type",
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "feedback_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "course_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"course_id" uuid,
	"student_id" uuid,
	"enrolled_at" timestamp DEFAULT now(),
	CONSTRAINT "course_enrollments_course_id_student_id_key" UNIQUE("course_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "course_enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "google_tokens" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"access_token" text,
	"refresh_token" text NOT NULL,
	"expiry_time" bigint,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"role" text DEFAULT 'student'
);
--> statement-breakpoint
ALTER TABLE "google_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"first_name" text,
	"last_name" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"preferences" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "users_email_key" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"name" text NOT NULL,
	"building" text,
	"router_bssid" text,
	"created_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	CONSTRAINT "venues_router_bssid_key" UNIQUE("router_bssid")
);
--> statement-breakpoint
ALTER TABLE "venues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feedback_responses" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"session_id" uuid,
	"student_id" uuid,
	"question_id" uuid,
	"rating" integer,
	"yes_no" boolean,
	"text_answer" text,
	"submitted_at" timestamp DEFAULT now(),
	CONSTRAINT "feedback_responses_session_student_question_unique" UNIQUE("session_id","student_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "feedback_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assignment_submissions" (
	"id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
	"assignment_id" uuid,
	"student_id" uuid,
	"file_url" text,
	"submitted_at" timestamp DEFAULT now(),
	"grade" numeric(5, 2),
	"feedback" text
);
--> statement-breakpoint
ALTER TABLE "assignment_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session_skills" (
	"session_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	CONSTRAINT "session_skills_pkey" PRIMARY KEY("session_id","skill_id")
);
--> statement-breakpoint
ALTER TABLE "session_skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attendance_ping_logs" ADD CONSTRAINT "attendance_ping_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_ping_logs" ADD CONSTRAINT "attendance_ping_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculty"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculty"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_session_type_id_fkey" FOREIGN KEY ("session_type_id") REFERENCES "public"."session_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faculty" ADD CONSTRAINT "faculty_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_materials" ADD CONSTRAINT "session_materials_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_materials" ADD CONSTRAINT "session_materials_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculty"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_materials" ADD CONSTRAINT "session_materials_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_materials" ADD CONSTRAINT "session_materials_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_course_attendance" ADD CONSTRAINT "student_course_attendance_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_course_attendance" ADD CONSTRAINT "student_course_attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_attendance_marks" ADD CONSTRAINT "student_attendance_marks_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_attendance_marks" ADD CONSTRAINT "student_attendance_marks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_attendance_marks" ADD CONSTRAINT "student_attendance_marks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_tokens" ADD CONSTRAINT "google_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."feedback_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_skills" ADD CONSTRAINT "session_skills_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_skills" ADD CONSTRAINT "session_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_apl_ping_time" ON "attendance_ping_logs" USING btree ("ping_time" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_apl_session_id" ON "attendance_ping_logs" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_apl_student_id" ON "attendance_ping_logs" USING btree ("student_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sessions_course" ON "sessions" USING btree ("course_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sessions_date" ON "sessions" USING btree ("session_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_sessions_faculty" ON "sessions" USING btree ("faculty_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "unique_venue_schedule" ON "sessions" USING btree ("venue_id" time_ops,"session_date" uuid_ops,"start_time" uuid_ops,"end_time" time_ops) WHERE (status <> 'cancelled'::session_status);--> statement-breakpoint
CREATE INDEX "idx_categories_course" ON "categories" USING btree ("course_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_leave_requests_date" ON "leave_requests" USING btree ("leave_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_leave_requests_session" ON "leave_requests" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_leave_requests_status" ON "leave_requests" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_leave_requests_student" ON "leave_requests" USING btree ("student_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_read" ON "notifications" USING btree ("recipient_id" bool_ops,"is_read" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient" ON "notifications" USING btree ("recipient_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_session_materials_course_id" ON "session_materials" USING btree ("course_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_session_materials_session_id" ON "session_materials" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sca_student" ON "student_course_attendance" USING btree ("student_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sam_course" ON "student_attendance_marks" USING btree ("course_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sam_date" ON "student_attendance_marks" USING btree ("session_date" date_ops);--> statement-breakpoint
CREATE INDEX "idx_sam_session_id" ON "student_attendance_marks" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sam_student" ON "student_attendance_marks" USING btree ("student_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_skills_category" ON "skills" USING btree ("category_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_attendance_session" ON "attendance_records" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_attendance_student" ON "attendance_records" USING btree ("student_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_feedback_session" ON "feedback_responses" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_feedback_student" ON "feedback_responses" USING btree ("student_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_feedback_student_session" ON "feedback_responses" USING btree ("student_id" uuid_ops,"session_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_assignment_submissions_student_assignment" ON "assignment_submissions" USING btree ("assignment_id" uuid_ops,"student_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_session_skills_session" ON "session_skills" USING btree ("session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_session_skills_skill" ON "session_skills" USING btree ("skill_id" uuid_ops);--> statement-breakpoint
CREATE VIEW "public"."admin_dashboard_summary" WITH (security_invoker = on) AS (SELECT count(DISTINCT students.id) AS total_students, count(DISTINCT faculty.id) AS total_faculty, count(DISTINCT sessions.id) AS total_sessions FROM students, faculty, sessions);--> statement-breakpoint
CREATE VIEW "public"."faculty_monthly_hours" WITH (security_invoker = on) AS (SELECT faculty_id, date_trunc('month'::text, session_date::timestamp with time zone) AS month, count(*) AS sessions, sum(EXTRACT(epoch FROM end_time - start_time) / 3600::numeric) AS hours FROM sessions WHERE status = 'completed'::session_status GROUP BY faculty_id, (date_trunc('month'::text, session_date::timestamp with time zone)));--> statement-breakpoint
CREATE VIEW "public"."student_attendance_summary" WITH (security_invoker = on) AS (SELECT student_id, count(*) FILTER (WHERE status = 'present'::attendance_status)::numeric * 100.0 / count(*)::numeric AS attendance_percentage FROM attendance_records GROUP BY student_id);
*/