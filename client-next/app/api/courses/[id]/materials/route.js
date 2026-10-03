import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionMaterials, sessions, faculty, users } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';
import { resolveFileUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const BUCKET = 'session-materials';

async function handler(req, { params }) {
  try {
    const { id } = params;

    const rows = await db
      .select({
        id: sessionMaterials.id,
        title: sessionMaterials.title,
        file_url: sessionMaterials.fileUrl,
        file_type: sessionMaterials.fileType,
        content: sessionMaterials.content,
        created_at: sessionMaterials.createdAt,
        session_id: sessions.id,
        session_title: sessions.title,
        session_date: sessions.sessionDate,
        faculty_id: faculty.id,
        faculty_first_name: users.firstName,
        faculty_last_name: users.lastName,
      })
      .from(sessionMaterials)
      .leftJoin(sessions, eq(sessionMaterials.sessionId, sessions.id))
      .leftJoin(faculty, eq(sessionMaterials.facultyId, faculty.id))
      .leftJoin(users, eq(faculty.id, users.id))
      .where(eq(sessionMaterials.courseId, id))
      .orderBy(desc(sessionMaterials.createdAt));

    const formatted = rows.map(r => ({
      id: r.id,
      title: r.title,
      file_url: r.file_url,
      file_type: r.file_type,
      content: r.content,
      created_at: r.created_at,
      sessions: r.session_id ? { id: r.session_id, title: r.session_title, session_date: r.session_date } : null,
      faculty: r.faculty_id ? { id: r.faculty_id, users: { first_name: r.faculty_first_name, last_name: r.faculty_last_name } } : null,
    }));

    const withUrls = await Promise.all(
      formatted.map(async (mat) => ({
        ...mat,
        file_url: mat.file_url ? await resolveFileUrl(BUCKET, mat.file_url) : null,
      }))
    );

    return NextResponse.json({ materials: withUrls });
  } catch (err) {
    console.error('Course materials error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);

