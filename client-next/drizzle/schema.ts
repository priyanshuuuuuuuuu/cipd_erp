import { pgTable, index, foreignKey, bigserial, uuid, text, integer, timestamp, unique, boolean, numeric, uniqueIndex, date, time, jsonb, check, smallint, bigint, primaryKey, pgView, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const attendanceStatus = pgEnum("attendance_status", ['present', 'absent', 'partial', 'present_online', 'half', 'leave', 'other'])
export const feedbackQuestionType = pgEnum("feedback_question_type", ['rating', 'yes_no', 'text', 'mcq'])
export const sessionStatus = pgEnum("session_status", ['scheduled', 'completed', 'cancelled'])
export const userRole = pgEnum("user_role", ['admin', 'faculty', 'student'])


export const attendancePingLogs = pgTable("attendance_ping_logs", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	sessionId: uuid("session_id"),
	studentId: uuid("student_id"),
	deviceHash: text("device_hash"),
	bssid: text(),
	signalStrength: integer("signal_strength"),
	pingTime: timestamp("ping_time", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_apl_ping_time").using("btree", table.pingTime.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_apl_session_id").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	index("idx_apl_student_id").using("btree", table.studentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [sessions.id],
			name: "attendance_ping_logs_session_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "attendance_ping_logs_student_id_fkey"
		}).onDelete("cascade"),
]);

export const students = pgTable("students", {
	id: uuid().primaryKey().notNull(),
	enrollmentNo: text("enrollment_no"),
	programName: text("program_name"),
	deviceHash: text("device_hash"),
	macAddress: text("mac_address"),
	macVerified: boolean("mac_verified").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	photoUrl: text("photo_url"),
}, (table) => [
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "students_id_fkey"
		}).onDelete("cascade"),
	unique("students_enrollment_no_key").on(table.enrollmentNo),
	unique("unique_enrollment_no").on(table.enrollmentNo),
]);

export const assignments = pgTable("assignments", {
	id: uuid().default(sql`extensions.uuid_generate_v4()`).primaryKey().notNull(),
	courseId: uuid("course_id"),
	facultyId: uuid("faculty_id"),
	title: text(),
	description: text(),
	dueDate: timestamp("due_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	totalMarks: numeric("total_marks").default('100'),
}, (table) => [
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "assignments_course_id_fkey"
		}),
	foreignKey({
			columns: [table.facultyId],
			foreignColumns: [faculty.id],
			name: "assignments_faculty_id_fkey"
		}),
]);

export const sessions = pgTable("sessions", {
	id: uuid().default(sql`extensions.uuid_generate_v4()`).primaryKey().notNull(),
	courseId: uuid("course_id"),
	facultyId: uuid("faculty_id"),
	title: text().notNull(),
	venueId: uuid("venue_id"),
	sessionDate: date("session_date").notNull(),
	startTime: time("start_time").notNull(),
	endTime: time("end_time").notNull(),
	status: sessionStatus().default('scheduled'),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	feedbackDeadline: timestamp("feedback_deadline", { withTimezone: true, mode: 'string' }),
	sessionTypeId: uuid("session_type_id"),
	categoryId: uuid("category_id"),
}, (table) => [
	index("idx_sessions_course").using("btree", table.courseId.asc().nullsLast().op("uuid_ops")),
	index("idx_sessions_date").using("btree", table.sessionDate.asc().nullsLast().op("date_ops")),
	index("idx_sessions_faculty").using("btree", table.facultyId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("unique_venue_schedule").using("btree", table.venueId.asc().nullsLast().op("time_ops"), table.sessionDate.asc().nullsLast().op("uuid_ops"), table.startTime.asc().nullsLast().op("uuid_ops"), table.endTime.asc().nullsLast().op("time_ops")).where(sql`(status <> 'cancelled'::session_status)`),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "sessions_category_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "sessions_course_id_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "sessions_created_by_fkey"
		}),
	foreignKey({
			columns: [table.facultyId],
			foreignColumns: [faculty.id],
			name: "sessions_faculty_id_fkey"
		}),
	foreignKey({
			columns: [table.sessionTypeId],
			foreignColumns: [sessionTypes.id],
			name: "sessions_session_type_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.venueId],
			foreignColumns: [venues.id],
			name: "sessions_venue_id_fkey"
		}),
]);

export const faculty = pgTable("faculty", {
	id: uuid().primaryKey().notNull(),
	designation: text(),
	yearsExperience: integer("years_experience"),
	honorariumRatePerHour: numeric("honorarium_rate_per_hour", { precision: 10, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	department: text(),
	photoUrl: text("photo_url"),
	bankAccountNumber: text("bank_account_number"),
	bankAccountHolder: text("bank_account_holder"),
	bankIfscCode: text("bank_ifsc_code"),
	bankBranch: text("bank_branch"),
}, (table) => [
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "faculty_id_fkey"
		}).onDelete("cascade"),
]);

export const wifiSnapshots = pgTable("wifi_snapshots", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	capturedAt: timestamp("captured_at", { withTimezone: true, mode: 'string' }).notNull(),
	iwDump: jsonb("iw_dump").notNull(),
	error: text(),
});

export const courses = pgTable("courses", {
	id: uuid().default(sql`extensions.uuid_generate_v4()`).primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	code: text(),
}, (table) => [
	unique("courses_code_key").on(table.code),
]);

export const categories = pgTable("categories", {
	id: uuid().default(sql`extensions.uuid_generate_v4()`).primaryKey().notNull(),
	courseId: uuid("course_id"),
	name: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_categories_course").using("btree", table.courseId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "categories_course_id_fkey"
		}).onDelete("cascade"),
	unique("categories_course_id_name_key").on(table.courseId, table.name),
]);

export const leaveRequests = pgTable("leave_requests", {
	id: uuid().default(sql`extensions.uuid_generate_v4()`).primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	leaveDate: date("leave_date").notNull(),
	sessionId: uuid("session_id"),
	reason: text().notNull(),
	status: text().default('pending').notNull(),
	reviewedBy: uuid("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	adminNotes: text("admin_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_leave_requests_date").using("btree", table.leaveDate.asc().nullsLast().op("date_ops")),
	index("idx_leave_requests_session").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	index("idx_leave_requests_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_leave_requests_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [users.id],
			name: "leave_requests_reviewed_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [sessions.id],
			name: "leave_requests_session_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "leave_requests_student_id_fkey"
		}).onDelete("cascade"),
	check("leave_requests_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])`),
]);

export const notifications = pgTable("notifications", {
	id: uuid().default(sql`extensions.uuid_generate_v4()`).primaryKey().notNull(),
	recipientId: uuid("recipient_id"),
	type: text().default('general').notNull(),
	title: text().notNull(),
	message: text().notNull(),
	courseId: uuid("course_id"),
	sessionId: uuid("session_id"),
	isRead: boolean("is_read").default(false),
	sentBy: uuid("sent_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_notifications_read").using("btree", table.recipientId.asc().nullsLast().op("bool_ops"), table.isRead.asc().nullsLast().op("bool_ops")),
	index("idx_notifications_recipient").using("btree", table.recipientId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "notifications_course_id_fkey"
		}),
	foreignKey({
			columns: [table.recipientId],
			foreignColumns: [users.id],
			name: "notifications_recipient_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sentBy],
			foreignColumns: [users.id],
			name: "notifications_sent_by_fkey"
		}),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [sessions.id],
			name: "notifications_session_id_fkey"
		}),
]);

export const notificationStream = pgTable("notification_stream", {
	id: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
	dedupeKey: text("dedupe_key").notNull(),
	eventType: text("event_type").notNull(),
	channel: text().notNull(),
	recipientId: uuid("recipient_id"),
	recipientEmail: text("recipient_email").notNull(),
	recipientName: text("recipient_name"),
	payload: jsonb().default({}).notNull(),
	status: text().default('queued').notNull(),
	attempts: integer().default(0).notNull(),
	availableAt: timestamp("available_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lockedAt: timestamp("locked_at", { withTimezone: true, mode: 'string' }),
	lockedBy: text("locked_by"),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }),
	providerMessageId: text("provider_message_id"),
	lastError: text("last_error"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	sessionId: uuid("session_id"),
});

export const sessionMaterials = pgTable("session_materials", {
	id: uuid().default(sql`extensions.uuid_generate_v4()`).primaryKey().notNull(),
	sessionId: uuid("session_id"),
	uploadedBy: uuid("uploaded_by"),
	title: text(),
	fileUrl: text("file_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	content: text(),
	fileType: text("file_type").default('pdf'),
	courseId: uuid("course_id"),
	facultyId: uuid("faculty_id"),
}, (table) => [
	index("idx_session_materials_course_id").using("btree", table.courseId.asc().nullsLast().op("uuid_ops")),
	index("idx_session_materials_session_id").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "session_materials_course_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.facultyId],
			foreignColumns: [faculty.id],
			name: "session_materials_faculty_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [sessions.id],
			name: "session_materials_session_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "session_materials_uploaded_by_fkey"
		}),
]);

export const studentCourseAttendance = pgTable("student_course_attendance", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	courseId: uuid("course_id").notNull(),
	attendancePercentage: numeric("attendance_percentage").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_sca_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "student_course_attendance_course_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "student_course_attendance_student_id_fkey"
		}).onDelete("cascade"),
	unique("student_course_attendance_student_course_uq").on(table.studentId, table.courseId),
	unique("student_course_attendance_student_id_course_id_key").on(table.studentId, table.courseId),
]);

export const sessionTypes = pgTable("session_types", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("session_types_name_key").on(table.name),
]);

export const studentAttendanceMarks = pgTable("student_attendance_marks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	sessionDate: date("session_date").notNull(),
	sessionSlot: smallint("session_slot").notNull(),
	status: text().notNull(),
	sessionId: uuid("session_id"),
	courseId: uuid("course_id"),
	sourceDomain: text("source_domain"),
	sourceSheet: text("source_sheet"),
	isoWeek: text("iso_week"),
	ingestedAt: timestamp("ingested_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_sam_course").using("btree", table.courseId.asc().nullsLast().op("uuid_ops")),
	index("idx_sam_date").using("btree", table.sessionDate.asc().nullsLast().op("date_ops")),
	index("idx_sam_session_id").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	index("idx_sam_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "student_attendance_marks_course_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [sessions.id],
			name: "student_attendance_marks_session_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "student_attendance_marks_student_id_fkey"
		}).onDelete("cascade"),
	unique("student_attendance_marks_student_id_session_date_session_sl_key").on(table.studentId, table.sessionDate, table.sessionSlot),
]);

export const skills = pgTable("skills", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	categoryId: uuid("category_id"),
	details: text(),
}, (table) => [
	index("idx_skills_category").using("btree", table.categoryId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "skills_category_id_fkey"
		}).onDelete("set null"),
	unique("skills_name_key").on(table.name),
]);

export const systemSettings = pgTable("system_settings", {
	id: integer().default(1).primaryKey().notNull(),
	pingInterval: integer("ping_interval").default(10),
	pingsPerSession: integer("pings_per_session").default(6),
	presenceThreshold: integer("presence_threshold").default(3),
	attendanceWindow: integer("attendance_window").default(60),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	scannerIntervalMinutes: integer("scanner_interval_minutes").default(6),
	minSignal: integer("min_signal").default(2),
});

export const attendanceRecords = pgTable("attendance_records", {
	id: uuid().default(sql`extensions.uuid_generate_v4()`).primaryKey().notNull(),
	sessionId: uuid("session_id"),
	studentId: uuid("student_id"),
	pingCount: integer("ping_count").default(0),
	status: attendanceStatus(),
	calculatedAt: timestamp("calculated_at", { mode: 'string' }).defaultNow(),
	firstSeenAt: timestamp("first_seen_at", { mode: 'string' }),
	lastSeenAt: timestamp("last_seen_at", { mode: 'string' }),
	durationMinutes: numeric("duration_minutes", { precision: 6, scale:  1 }).default('0'),
	avgSignalStrength: numeric("avg_signal_strength", { precision: 6, scale:  1 }),
	points: numeric({ precision: 3, scale:  2 }),
	adminOverride: boolean("admin_override").default(false),
	overrideBy: text("override_by"),
	penalty: boolean().default(false),
	penaltyReason: text("penalty_reason"),
}, (table) => [
	index("idx_attendance_session").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	index("idx_attendance_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [sessions.id],
			name: "attendance_records_session_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "attendance_records_student_id_fkey"
		}),
	unique("attendance_records_session_id_student_id_key").on(table.sessionId, table.studentId),
]);

export const feedbackQuestions = pgTable("feedback_questions", {
	id: uuid().default(sql`extensions.uuid_generate_v4()`).primaryKey().notNull(),
	question: text().notNull(),
	category: text(),
	type: feedbackQuestionType(),
	active: boolean().default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const courseEnrollments = pgTable("course_enrollments", {
	id: uuid().default(sql`extensions.uuid_generate_v4()`).primaryKey().notNull(),
	courseId: uuid("course_id"),
	studentId: uuid("student_id"),
	enrolledAt: timestamp("enrolled_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "course_enrollments_course_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "course_enrollments_student_id_fkey"
		}).onDelete("cascade"),
	unique("course_enrollments_course_id_student_id_key").on(table.courseId, table.studentId),
]);

export const googleTokens = pgTable("google_tokens", {
	userId: uuid("user_id").primaryKey().notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	expiryTime: bigint("expiry_time", { mode: "number" }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	role: text().default('student'),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "google_tokens_user_id_fkey"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: uuid().default(sql`extensions.uuid_generate_v4()`).primaryKey().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	role: userRole().notNull(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	preferences: jsonb().default({}),
}, (table) => [
	index("idx_users_role").using("btree", table.role.asc().nullsLast().op("enum_ops")),
	unique("users_email_key").on(table.email),
]);

export const venues = pgTable("venues", {
	id: uuid().default(sql`extensions.uuid_generate_v4()`).primaryKey().notNull(),
	name: text().notNull(),
	building: text(),
	routerBssid: text("router_bssid"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	isActive: boolean("is_active").default(true),
}, (table) => [
	unique("venues_router_bssid_key").on(table.routerBssid),
]);

export const feedbackResponses = pgTable("feedback_responses", {
	id: uuid().default(sql`extensions.uuid_generate_v4()`).primaryKey().notNull(),
	sessionId: uuid("session_id"),
	studentId: uuid("student_id"),
	questionId: uuid("question_id"),
	rating: integer(),
	yesNo: boolean("yes_no"),
	textAnswer: text("text_answer"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_feedback_session").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	index("idx_feedback_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops")),
	index("idx_feedback_student_session").using("btree", table.studentId.asc().nullsLast().op("uuid_ops"), table.sessionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [feedbackQuestions.id],
			name: "feedback_responses_question_id_fkey"
		}),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [sessions.id],
			name: "feedback_responses_session_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "feedback_responses_student_id_fkey"
		}),
	unique("feedback_responses_session_student_question_unique").on(table.sessionId, table.studentId, table.questionId),
]);

export const assignmentSubmissions = pgTable("assignment_submissions", {
	id: uuid().default(sql`extensions.uuid_generate_v4()`).primaryKey().notNull(),
	assignmentId: uuid("assignment_id"),
	studentId: uuid("student_id"),
	fileUrl: text("file_url"),
	submittedAt: timestamp("submitted_at", { mode: 'string' }).defaultNow(),
	grade: numeric({ precision: 5, scale:  2 }),
	feedback: text(),
}, (table) => [
	uniqueIndex("idx_assignment_submissions_student_assignment").using("btree", table.assignmentId.asc().nullsLast().op("uuid_ops"), table.studentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.assignmentId],
			foreignColumns: [assignments.id],
			name: "assignment_submissions_assignment_id_fkey"
		}),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "assignment_submissions_student_id_fkey"
		}),
]);

export const sessionSkills = pgTable("session_skills", {
	sessionId: uuid("session_id").notNull(),
	skillId: uuid("skill_id").notNull(),
}, (table) => [
	index("idx_session_skills_session").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	index("idx_session_skills_skill").using("btree", table.skillId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [sessions.id],
			name: "session_skills_session_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.skillId],
			foreignColumns: [skills.id],
			name: "session_skills_skill_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.sessionId, table.skillId], name: "session_skills_pkey"}),
]);
export const adminDashboardSummary = pgView("admin_dashboard_summary", {	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalStudents: bigint("total_students", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalFaculty: bigint("total_faculty", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalSessions: bigint("total_sessions", { mode: "number" }),
}).with({"securityInvoker":"on"}).as(sql`SELECT count(DISTINCT students.id) AS total_students, count(DISTINCT faculty.id) AS total_faculty, count(DISTINCT sessions.id) AS total_sessions FROM students, faculty, sessions`);

export const facultyMonthlyHours = pgView("faculty_monthly_hours", {	facultyId: uuid("faculty_id"),
	month: timestamp({ withTimezone: true, mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sessions: bigint({ mode: "number" }),
	hours: numeric(),
}).with({"securityInvoker":"on"}).as(sql`SELECT faculty_id, date_trunc('month'::text, session_date::timestamp with time zone) AS month, count(*) AS sessions, sum(EXTRACT(epoch FROM end_time - start_time) / 3600::numeric) AS hours FROM sessions WHERE status = 'completed'::session_status GROUP BY faculty_id, (date_trunc('month'::text, session_date::timestamp with time zone))`);

export const studentAttendanceSummary = pgView("student_attendance_summary", {	studentId: uuid("student_id"),
	attendancePercentage: numeric("attendance_percentage"),
}).with({"securityInvoker":"on"}).as(sql`SELECT student_id, count(*) FILTER (WHERE status = 'present'::attendance_status)::numeric * 100.0 / count(*)::numeric AS attendance_percentage FROM attendance_records GROUP BY student_id`);