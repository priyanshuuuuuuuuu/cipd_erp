export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  courseEnrollments,
  assignments,
  assignmentSubmissions,
  courses,
  faculty,
  users,
} from '@/drizzle/schema';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const courseIdFilter = searchParams.get('course_id');

    // Get enrolled courses
    const enrollments = await db
      .select({ course_id: courseEnrollments.courseId })
      .from(courseEnrollments)
      .where(eq(courseEnrollments.studentId, req.user.id));

    let courseIds = enrollments.map(e => e.course_id).filter(Boolean);

    if (courseIdFilter) {
      if (!courseIds.includes(courseIdFilter)) {
        return NextResponse.json({ assignments: [] });
      }
      courseIds = [courseIdFilter];
    }

    if (courseIds.length === 0) {
      return NextResponse.json({ assignments: [] });
    }

    // Get assignments for enrolled courses
    const asnRows = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        due_date: assignments.dueDate,
        created_at: assignments.createdAt,
        course_id: assignments.courseId,
        course_name: courses.name,
        faculty_id: faculty.id,
        faculty_first_name: users.firstName,
        faculty_last_name: users.lastName,
      })
      .from(assignments)
      .leftJoin(courses, eq(assignments.courseId, courses.id))
      .leftJoin(faculty, eq(assignments.facultyId, faculty.id))
      .leftJoin(users, eq(faculty.id, users.id))
      .where(inArray(assignments.courseId, courseIds))
      .orderBy(asc(assignments.dueDate));

    // Get student's submissions
    const assignmentIds = asnRows.map(a => a.id);
    let submissions = [];
    if (assignmentIds.length > 0) {
      submissions = await db
        .select({
          assignment_id: assignmentSubmissions.assignmentId,
          file_url: assignmentSubmissions.fileUrl,
          submitted_at: assignmentSubmissions.submittedAt,
          grade: assignmentSubmissions.grade,
          feedback: assignmentSubmissions.feedback,
        })
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.studentId, req.user.id),
            inArray(assignmentSubmissions.assignmentId, assignmentIds)
          )
        );
    }

    // Merge assignments with submissions
    const merged = asnRows.map(a => {
      const sub = submissions.find(s => s.assignment_id === a.id);
      const submission_status = sub?.grade != null
        ? 'graded'
        : sub
          ? 'submitted'
          : 'pending';

      return {
        id: a.id,
        title: a.title,
        description: a.description,
        due_date: a.due_date,
        created_at: a.created_at,
        total_marks: 100,
        course_id: a.course_id,
        courses: a.course_id ? { id: a.course_id, name: a.course_name } : null,
        faculty: a.faculty_id ? { id: a.faculty_id, users: { first_name: a.faculty_first_name, last_name: a.faculty_last_name } } : null,
        submission: sub || null,
        is_submitted: !!sub,
        is_overdue: !sub && new Date(a.due_date) < new Date(),
        submission_status,
        marks: sub?.grade ?? null,
        feedback: sub?.feedback ?? null,
      };
    });

    return NextResponse.json({ assignments: merged });
  } catch (err) {
    console.error('Assignments error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);

