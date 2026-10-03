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

    let facultyId = null;
    if (sessionId) {
      const [session] = await db
        .select({ id: sessions.id, course_id: sessions.courseId, faculty_id: sessions.facultyId })
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1);

      if (!session || session.course_id !== courseId) {
        return NextResponse.json({ error: 'Session not found for this course' }, { status: 400 });
      }
      facultyId = session.faculty_id || null;
    }

    const sessionFolder = sessionId || 'general';
    const safeName = sanitizeFilename(file.name);
    const storagePath = `${courseId}/${sessionFolder}/${Date.now()}-${safeName}`;

    await uploadToStorage(BUCKET, storagePath, file);

    const [material] = await db
      .insert(sessionMaterials)
      .values({
        title,
        courseId,
        sessionId,
        facultyId,
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

    if (!material) {
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
