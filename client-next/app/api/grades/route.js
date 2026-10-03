export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  courseEnrollments,
  assignmentSubmissions,
  assignments,
  courses,
  faculty,
  users,
} from '@/drizzle/schema';
import { eq, and, isNotNull, desc } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    // Get assignments for student's enrolled courses
    const enrollments = await db
      .select({ course_id: courseEnrollments.courseId })
      .from(courseEnrollments)
      .where(eq(courseEnrollments.studentId, req.user.id));

    const courseIds = enrollments.map(e => e.course_id).filter(Boolean);

    if (courseIds.length === 0) {
      return NextResponse.json({ grades: [] });
    }

    // Get all submissions with grades
    const rows = await db
      .select({
        id: assignmentSubmissions.id,
        grade: assignmentSubmissions.grade,
        feedback: assignmentSubmissions.feedback,
        submitted_at: assignmentSubmissions.submittedAt,
        file_url: assignmentSubmissions.fileUrl,
        asn_id: assignments.id,
        asn_title: assignments.title,
        asn_description: assignments.description,
        asn_due_date: assignments.dueDate,
        course_id: courses.id,
        course_name: courses.name,
        faculty_id: faculty.id,
        faculty_first_name: users.firstName,
        faculty_last_name: users.lastName,
      })
      .from(assignmentSubmissions)
      .leftJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .leftJoin(courses, eq(assignments.courseId, courses.id))
      .leftJoin(faculty, eq(assignments.facultyId, faculty.id))
      .leftJoin(users, eq(faculty.id, users.id))
      .where(
        and(
          eq(assignmentSubmissions.studentId, req.user.id),
          isNotNull(assignmentSubmissions.grade)
        )
      )
      .orderBy(desc(assignmentSubmissions.submittedAt));

    const grades = rows.map(r => ({
      id: r.id,
      grade: r.grade,
      feedback: r.feedback,
      submitted_at: r.submitted_at,
      file_url: r.file_url,
      assignments: r.asn_id ? {
        id: r.asn_id,
        title: r.asn_title,
        description: r.asn_description,
        due_date: r.asn_due_date,
        courses: r.course_id ? { id: r.course_id, name: r.course_name } : null,
        faculty: r.faculty_id ? { id: r.faculty_id, users: { first_name: r.faculty_first_name, last_name: r.faculty_last_name } } : null,
      } : null,
    }));

    return NextResponse.json({ grades });
  } catch (err) {
    console.error('Grades error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);

