export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, sessionMaterials } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
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
    const sessionId = String(formData.get('session_id') || '').trim();
    const content = String(formData.get('content') || '').trim() || null;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    const validation = validateUploadFile(
      fileEntry instanceof File ? fileEntry : null
    );
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const file = validation.file;

    const [session] = await db
      .select({ id: sessions.id, course_id: sessions.courseId, faculty_id: sessions.facultyId })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.faculty_id !== req.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const safeName = sanitizeFilename(file.name);
    const storagePath = `${session.course_id}/${sessionId}/${Date.now()}-${safeName}`;

    await uploadToStorage(BUCKET, storagePath, file);

    const [material] = await db
      .insert(sessionMaterials)
      .values({
        title,
        courseId: session.course_id,
        sessionId: sessionId,
        facultyId: req.user.id,
        uploadedBy: req.user.id,
        fileUrl: storagePath,
        fileType: mimeToFileType(file.type),
        content,
      })
      .returning({
        id: sessionMaterials.id,
        title: sessionMaterials.title,
        file_url: sessionMaterials.fileUrl,
        file_type: sessionMaterials.fileType,
        content: sessionMaterials.content,
        created_at: sessionMaterials.createdAt,
        course_id: sessionMaterials.courseId,
        session_id: sessionMaterials.sessionId,
      });

    return NextResponse.json({ material });
  } catch (err) {
    console.error('Faculty materials upload error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to upload material' },
      { status: 500 }
    );
  }
}

export const POST = withRole(handler, ['faculty']);

