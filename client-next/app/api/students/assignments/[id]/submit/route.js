export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assignments, courseEnrollments, assignmentSubmissions } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';
import {
  validateUploadFile,
  sanitizeFilename,
  mimeToFileType,
} from '@/lib/file-validation';
import { uploadToStorage, deleteFromStorage } from '@/lib/storage';

const BUCKET = 'assignment-submissions';

async function handler(req, { params }) {
  try {
    if (req.user.role !== 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const assignmentId = params.id;
    const formData = await req.formData();
    const fileEntry = formData.get('file');

    const validation = validateUploadFile(
      fileEntry instanceof File ? fileEntry : null
    );
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const file = validation.file;

    const [assignment] = await db
      .select({
        id: assignments.id,
        course_id: assignments.courseId,
        title: assignments.title,
        due_date: assignments.dueDate,
      })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const [enrollment] = await db
      .select({ id: courseEnrollments.id })
      .from(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.courseId, assignment.course_id),
          eq(courseEnrollments.studentId, req.user.id)
        )
      )
      .limit(1);

    if (!enrollment) {
      return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 });
    }

    const safeName = sanitizeFilename(file.name);
    const storagePath = `${req.user.id}/${assignmentId}/${Date.now()}-${safeName}`;

    const [existing] = await db
      .select({ id: assignmentSubmissions.id, file_url: assignmentSubmissions.fileUrl })
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.assignmentId, assignmentId),
          eq(assignmentSubmissions.studentId, req.user.id)
        )
      )
      .limit(1);

    await uploadToStorage(BUCKET, storagePath, file);

    const submittedAt = new Date().toISOString();
    let submission;

    if (existing) {
      if (existing.file_url) {
        await deleteFromStorage(BUCKET, existing.file_url);
      }
      const [updated] = await db
        .update(assignmentSubmissions)
        .set({ fileUrl: storagePath, submittedAt })
        .where(eq(assignmentSubmissions.id, existing.id))
        .returning({
          assignment_id: assignmentSubmissions.assignmentId,
          file_url: assignmentSubmissions.fileUrl,
          submitted_at: assignmentSubmissions.submittedAt,
          grade: assignmentSubmissions.grade,
          feedback: assignmentSubmissions.feedback,
        });

      submission = updated;
    } else {
      const [inserted] = await db
        .insert(assignmentSubmissions)
        .values({
          assignmentId,
          studentId: req.user.id,
          fileUrl: storagePath,
          submittedAt,
        })
        .returning({
          assignment_id: assignmentSubmissions.assignmentId,
          file_url: assignmentSubmissions.fileUrl,
          submitted_at: assignmentSubmissions.submittedAt,
          grade: assignmentSubmissions.grade,
          feedback: assignmentSubmissions.feedback,
        });

      submission = inserted;
    }

    return NextResponse.json({
      assignment: {
        id: assignment.id,
        title: assignment.title,
        due_date: assignment.due_date,
        total_marks: 100,
        submission,
        is_submitted: true,
        submission_status: submission.grade != null ? 'graded' : 'submitted',
        marks: submission.grade ?? null,
        feedback: submission.feedback ?? null,
      },
    });
  } catch (err) {
    console.error('Assignment submit error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to submit assignment' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);

