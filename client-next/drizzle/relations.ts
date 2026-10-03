import { relations } from "drizzle-orm/relations";
import { sessions, attendancePingLogs, students, users, courses, assignments, faculty, categories, sessionTypes, venues, leaveRequests, notifications, sessionMaterials, studentCourseAttendance, studentAttendanceMarks, skills, attendanceRecords, courseEnrollments, googleTokens, feedbackQuestions, feedbackResponses, assignmentSubmissions, sessionSkills } from "./schema";

export const attendancePingLogsRelations = relations(attendancePingLogs, ({one}) => ({
	session: one(sessions, {
		fields: [attendancePingLogs.sessionId],
		references: [sessions.id]
	}),
	student: one(students, {
		fields: [attendancePingLogs.studentId],
		references: [students.id]
	}),
}));

export const sessionsRelations = relations(sessions, ({one, many}) => ({
	attendancePingLogs: many(attendancePingLogs),
	category: one(categories, {
		fields: [sessions.categoryId],
		references: [categories.id]
	}),
	course: one(courses, {
		fields: [sessions.courseId],
		references: [courses.id]
	}),
	user: one(users, {
		fields: [sessions.createdBy],
		references: [users.id]
	}),
	faculty: one(faculty, {
		fields: [sessions.facultyId],
		references: [faculty.id]
	}),
	sessionType: one(sessionTypes, {
		fields: [sessions.sessionTypeId],
		references: [sessionTypes.id]
	}),
	venue: one(venues, {
		fields: [sessions.venueId],
		references: [venues.id]
	}),
	leaveRequests: many(leaveRequests),
	notifications: many(notifications),
	sessionMaterials: many(sessionMaterials),
	studentAttendanceMarks: many(studentAttendanceMarks),
	attendanceRecords: many(attendanceRecords),
	feedbackResponses: many(feedbackResponses),
	sessionSkills: many(sessionSkills),
}));

export const studentsRelations = relations(students, ({one, many}) => ({
	attendancePingLogs: many(attendancePingLogs),
	user: one(users, {
		fields: [students.id],
		references: [users.id]
	}),
	leaveRequests: many(leaveRequests),
	studentCourseAttendances: many(studentCourseAttendance),
	studentAttendanceMarks: many(studentAttendanceMarks),
	attendanceRecords: many(attendanceRecords),
	courseEnrollments: many(courseEnrollments),
	feedbackResponses: many(feedbackResponses),
	assignmentSubmissions: many(assignmentSubmissions),
}));

export const usersRelations = relations(users, ({many}) => ({
	students: many(students),
	sessions: many(sessions),
	faculties: many(faculty),
	leaveRequests: many(leaveRequests),
	notifications_recipientId: many(notifications, {
		relationName: "notifications_recipientId_users_id"
	}),
	notifications_sentBy: many(notifications, {
		relationName: "notifications_sentBy_users_id"
	}),
	sessionMaterials: many(sessionMaterials),
	googleTokens: many(googleTokens),
}));

export const assignmentsRelations = relations(assignments, ({one, many}) => ({
	course: one(courses, {
		fields: [assignments.courseId],
		references: [courses.id]
	}),
	faculty: one(faculty, {
		fields: [assignments.facultyId],
		references: [faculty.id]
	}),
	assignmentSubmissions: many(assignmentSubmissions),
}));

export const coursesRelations = relations(courses, ({many}) => ({
	assignments: many(assignments),
	sessions: many(sessions),
	categories: many(categories),
	notifications: many(notifications),
	sessionMaterials: many(sessionMaterials),
	studentCourseAttendances: many(studentCourseAttendance),
	studentAttendanceMarks: many(studentAttendanceMarks),
	courseEnrollments: many(courseEnrollments),
}));

export const facultyRelations = relations(faculty, ({one, many}) => ({
	assignments: many(assignments),
	sessions: many(sessions),
	user: one(users, {
		fields: [faculty.id],
		references: [users.id]
	}),
	sessionMaterials: many(sessionMaterials),
}));

export const categoriesRelations = relations(categories, ({one, many}) => ({
	sessions: many(sessions),
	course: one(courses, {
		fields: [categories.courseId],
		references: [courses.id]
	}),
	skills: many(skills),
}));

export const sessionTypesRelations = relations(sessionTypes, ({many}) => ({
	sessions: many(sessions),
}));

export const venuesRelations = relations(venues, ({many}) => ({
	sessions: many(sessions),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({one}) => ({
	user: one(users, {
		fields: [leaveRequests.reviewedBy],
		references: [users.id]
	}),
	session: one(sessions, {
		fields: [leaveRequests.sessionId],
		references: [sessions.id]
	}),
	student: one(students, {
		fields: [leaveRequests.studentId],
		references: [students.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	course: one(courses, {
		fields: [notifications.courseId],
		references: [courses.id]
	}),
	user_recipientId: one(users, {
		fields: [notifications.recipientId],
		references: [users.id],
		relationName: "notifications_recipientId_users_id"
	}),
	user_sentBy: one(users, {
		fields: [notifications.sentBy],
		references: [users.id],
		relationName: "notifications_sentBy_users_id"
	}),
	session: one(sessions, {
		fields: [notifications.sessionId],
		references: [sessions.id]
	}),
}));

export const sessionMaterialsRelations = relations(sessionMaterials, ({one}) => ({
	course: one(courses, {
		fields: [sessionMaterials.courseId],
		references: [courses.id]
	}),
	faculty: one(faculty, {
		fields: [sessionMaterials.facultyId],
		references: [faculty.id]
	}),
	session: one(sessions, {
		fields: [sessionMaterials.sessionId],
		references: [sessions.id]
	}),
	user: one(users, {
		fields: [sessionMaterials.uploadedBy],
		references: [users.id]
	}),
}));

export const studentCourseAttendanceRelations = relations(studentCourseAttendance, ({one}) => ({
	course: one(courses, {
		fields: [studentCourseAttendance.courseId],
		references: [courses.id]
	}),
	student: one(students, {
		fields: [studentCourseAttendance.studentId],
		references: [students.id]
	}),
}));

export const studentAttendanceMarksRelations = relations(studentAttendanceMarks, ({one}) => ({
	course: one(courses, {
		fields: [studentAttendanceMarks.courseId],
		references: [courses.id]
	}),
	session: one(sessions, {
		fields: [studentAttendanceMarks.sessionId],
		references: [sessions.id]
	}),
	student: one(students, {
		fields: [studentAttendanceMarks.studentId],
		references: [students.id]
	}),
}));

export const skillsRelations = relations(skills, ({one, many}) => ({
	category: one(categories, {
		fields: [skills.categoryId],
		references: [categories.id]
	}),
	sessionSkills: many(sessionSkills),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({one}) => ({
	session: one(sessions, {
		fields: [attendanceRecords.sessionId],
		references: [sessions.id]
	}),
	student: one(students, {
		fields: [attendanceRecords.studentId],
		references: [students.id]
	}),
}));

export const courseEnrollmentsRelations = relations(courseEnrollments, ({one}) => ({
	course: one(courses, {
		fields: [courseEnrollments.courseId],
		references: [courses.id]
	}),
	student: one(students, {
		fields: [courseEnrollments.studentId],
		references: [students.id]
	}),
}));

export const googleTokensRelations = relations(googleTokens, ({one}) => ({
	user: one(users, {
		fields: [googleTokens.userId],
		references: [users.id]
	}),
}));

export const feedbackResponsesRelations = relations(feedbackResponses, ({one}) => ({
	feedbackQuestion: one(feedbackQuestions, {
		fields: [feedbackResponses.questionId],
		references: [feedbackQuestions.id]
	}),
	session: one(sessions, {
		fields: [feedbackResponses.sessionId],
		references: [sessions.id]
	}),
	student: one(students, {
		fields: [feedbackResponses.studentId],
		references: [students.id]
	}),
}));

export const feedbackQuestionsRelations = relations(feedbackQuestions, ({many}) => ({
	feedbackResponses: many(feedbackResponses),
}));

export const assignmentSubmissionsRelations = relations(assignmentSubmissions, ({one}) => ({
	assignment: one(assignments, {
		fields: [assignmentSubmissions.assignmentId],
		references: [assignments.id]
	}),
	student: one(students, {
		fields: [assignmentSubmissions.studentId],
		references: [students.id]
	}),
}));

export const sessionSkillsRelations = relations(sessionSkills, ({one}) => ({
	session: one(sessions, {
		fields: [sessionSkills.sessionId],
		references: [sessions.id]
	}),
	skill: one(skills, {
		fields: [sessionSkills.skillId],
		references: [skills.id]
	}),
}));