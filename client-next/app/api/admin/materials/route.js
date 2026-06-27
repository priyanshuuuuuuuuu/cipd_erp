export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import {
  validateUploadFile,
  sanitizeFilename,
  mimeToFileType,
} from '@/lib/file-validation';
import { uploadToStorage } from '@/lib/storage';

const BUCKET = 'session-materials';

async function handler(req) {
  try {
    const formData = await req.formData();
    const fileEntry = formData.get('file');
    const title = String(formData.get('title') || '').trim();
    const courseId = String(formData.get('course_id') || '').trim();
    const sessionId = String(formData.get('session_id') || '').trim() || null;
    const content = String(formData.get('content') || '').trim() || null;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!courseId) {
      return NextResponse.json({ error: 'course_id is required' }, { status: 400 });
    }

    const validation = validateUploadFile(
      fileEntry instanceof File ? fileEntry : null
    );
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const file = validation.file;

    if (sessionId) {
      const { data: session } = await supabaseAdmin
        .from('sessions')
        .select('id, course_id, faculty_id')
        .eq('id', sessionId)
        .single();

      if (!session || session.course_id !== courseId) {
        return NextResponse.json({ error: 'Session not found for this course' }, { status: 400 });
      }
    }

    const sessionFolder = sessionId || 'general';
    const safeName = sanitizeFilename(file.name);
    const storagePath = `${courseId}/${sessionFolder}/${Date.now()}-${safeName}`;

    await uploadToStorage(BUCKET, storagePath, file);

    let facultyId = null;
    if (sessionId) {
      const { data: session } = await supabaseAdmin
        .from('sessions')
        .select('faculty_id')
        .eq('id', sessionId)
        .single();
      facultyId = session?.faculty_id || null;
    }

    const { data: material, error: insertErr } = await supabaseAdmin
      .from('session_materials')
      .insert({
        title,
        course_id: courseId,
        session_id: sessionId,
        faculty_id: facultyId,
        uploaded_by: req.user.id,
        file_url: storagePath,
        file_type: mimeToFileType(file.type),
        content,
      })
      .select('id, title, file_url, file_type, content, created_at, course_id, session_id')
      .single();

    if (insertErr) {
      console.error('Material insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to save material record' }, { status: 500 });
    }

    return NextResponse.json({ material });
  } catch (err) {
    console.error('Admin materials upload error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to upload material' },
      { status: 500 }
    );
  }
}

export const POST = withRole(handler, ['admin']);
