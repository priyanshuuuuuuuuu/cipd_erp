export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assignments, assignmentSubmissions, courseEnrollments, students, users, courses } from '@/drizzle/schema';
import { eq, inArray } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { facultyOwnsCourse, forbidden } from '@/lib/faculty-access';
import { resolveFileUrl } from '@/lib/storage';

const BUCKET = 'assignment-submissions';

// Every enrolled student with their submission (if any) for one assignment of a module the caller teaches.
async function handler(req, { params }) {
  try {
    const [a] = await db
      .select({
        id: assignments.id, title: assignments.title, description: assignments.description, due_date: assignments.dueDate,
        total_marks: assignments.totalMarks, course_id: assignments.courseId, course_name: courses.name,
      })
      .from(assignments).leftJoin(courses, eq(assignments.courseId, courses.id))
      .where(eq(assignments.id, params.id)).limit(1);
    if (!a) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    if (!(await facultyOwnsCourse(req.user.id, a.course_id))) return forbidden();

    const enrolled = await db.select({ id: courseEnrollments.studentId }).from(courseEnrollments)
      .where(eq(courseEnrollments.courseId, a.course_id));
    const ids = [...new Set(enrolled.map((e) => e.id).filter(Boolean))];

    const [people, subs] = ids.length ? await Promise.all([
      db.select({ id: students.id, enrollment_no: students.enrollmentNo, first_name: users.firstName, last_name: users.lastName })
        .from(students).innerJoin(users, eq(students.id, users.id)).where(inArray(students.id, ids)),
      db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.assignmentId, a.id)),
    ]) : [[], []];
    const subMap = Object.fromEntries(subs.map((s) => [s.studentId, s]));

    const rows = await Promise.all(people.map(async (p) => {
      const s = subMap[p.id];
      return {
        student_id: p.id,
        enrollment_no: p.enrollment_no || '',
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        submission: s ? {
          id: s.id,
          file_url: s.fileUrl ? await resolveFileUrl(BUCKET, s.fileUrl) : null,
          submitted_at: s.submittedAt,
          late: !!(a.due_date && s.submittedAt && new Date(s.submittedAt) > new Date(a.due_date)),
          grade: s.grade != null ? Number(s.grade) : null,
          feedback: s.feedback,
          graded_at: s.gradedAt,
        } : null,
      };
    }));
    rows.sort((x, y) => x.name.localeCompare(y.name));

    return NextResponse.json({
      assignment: { ...a, total_marks: Number(a.total_marks ?? 100) },
      students: rows,
      summary: {
        enrolled: rows.length,
        submitted: rows.filter((r) => r.submission).length,
        graded: rows.filter((r) => r.submission?.grade != null).length,
      },
    });
  } catch (err) {
    console.error('Faculty submissions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['faculty']);
