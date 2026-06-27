export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
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

    const { data: assignment, error: asnErr } = await supabaseAdmin
      .from('assignments')
      .select('id, course_id, title, due_date, total_marks')
      .eq('id', assignmentId)
      .single();

    if (asnErr || !assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const { data: enrollment } = await supabaseAdmin
      .from('course_enrollments')
      .select('id')
      .eq('course_id', assignment.course_id)
      .eq('student_id', req.user.id)
      .maybeSingle();

    if (!enrollment) {
      return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 });
    }

    const safeName = sanitizeFilename(file.name);
    const storagePath = `${req.user.id}/${assignmentId}/${Date.now()}-${safeName}`;

    const { data: existing } = await supabaseAdmin
      .from('assignment_submissions')
      .select('id, file_url')
      .eq('assignment_id', assignmentId)
      .eq('student_id', req.user.id)
      .maybeSingle();

    await uploadToStorage(BUCKET, storagePath, file);

    const submittedAt = new Date().toISOString();
    let submission;

    if (existing) {
      if (existing.file_url) {
        await deleteFromStorage(BUCKET, existing.file_url);
      }
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('assignment_submissions')
        .update({ file_url: storagePath, submitted_at: submittedAt })
        .eq('id', existing.id)
        .select('assignment_id, file_url, submitted_at, grade, feedback')
        .single();

      if (updateErr) throw updateErr;
      submission = updated;
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('assignment_submissions')
        .insert({
          assignment_id: assignmentId,
          student_id: req.user.id,
          file_url: storagePath,
          submitted_at: submittedAt,
        })
        .select('assignment_id, file_url, submitted_at, grade, feedback')
        .single();

      if (insertErr) throw insertErr;
      submission = inserted;
    }

    return NextResponse.json({
      assignment: {
        id: assignment.id,
        title: assignment.title,
        due_date: assignment.due_date,
        total_marks: assignment.total_marks,
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
