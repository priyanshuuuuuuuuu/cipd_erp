export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assignments, assignmentSubmissions } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { facultyOwnsCourse, forbidden } from '@/lib/faculty-access';
import { notifyStudents } from '@/lib/notification-send';

// Grade (and give feedback on) one submission. grade: null clears the grade.
async function handler(req, { params }) {
  try {
    const [a] = await db.select({ id: assignments.id, title: assignments.title, course_id: assignments.courseId, total_marks: assignments.totalMarks })
      .from(assignments).where(eq(assignments.id, params.id)).limit(1);
    if (!a) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    if (!(await facultyOwnsCourse(req.user.id, a.course_id))) return forbidden();

    const [sub] = await db.select().from(assignmentSubmissions)
      .where(and(eq(assignmentSubmissions.id, params.submissionId), eq(assignmentSubmissions.assignmentId, a.id))).limit(1);
    if (!sub) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

    const b = await req.json();
    const total = Number(a.total_marks ?? 100);
    const set = {};

    if (b.grade !== undefined) {
      if (b.grade === null || b.grade === '') {
        set.grade = null; set.gradedAt = null; set.gradedBy = null;
      } else {
        const g = Number(b.grade);
        if (!Number.isFinite(g) || g < 0 || g > total || g > 999.99) {
          return NextResponse.json({ error: `Marks must be between 0 and ${total}` }, { status: 400 });
        }
        set.grade = String(Math.round(g * 100) / 100);
        set.gradedAt = new Date().toISOString();
        set.gradedBy = req.user.id;
      }
    }
    if (b.feedback !== undefined) {
      const fb = String(b.feedback || '').trim();
      if (fb.length > 2000) return NextResponse.json({ error: 'Feedback is too long (max 2000 characters)' }, { status: 400 });
      set.feedback = fb || null;
    }
    if (!Object.keys(set).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    const [updated] = await db.update(assignmentSubmissions).set(set).where(eq(assignmentSubmissions.id, sub.id)).returning();

    if (set.grade) {
      try {
        await notifyStudents({
          studentIds: [sub.studentId], type: 'grade_update', title: 'Assignment graded',
          message: `${a.title}: ${set.grade} / ${total}`, courseId: a.course_id, sentBy: req.user.id,
        });
      } catch (e) { console.error('Grade notification failed:', e); }
    }

    return NextResponse.json({ submission: { id: updated.id, grade: updated.grade != null ? Number(updated.grade) : null, feedback: updated.feedback, graded_at: updated.gradedAt } });
  } catch (err) {
    console.error('Faculty grade error:', err);
    return NextResponse.json({ error: 'Failed to save grade' }, { status: 500 });
  }
}

export const PATCH = withRole(handler, ['faculty']);
