import { db } from '@/lib/db';
import { coursePosts, sessionMaterials, assignments, users } from '@/drizzle/schema';
import { and, desc, eq, isNotNull, notInArray } from 'drizzle-orm';
import { resolveFileUrl } from '@/lib/storage';

export const POST_BUCKET = 'course-posts';
const LEGACY_BUCKET = 'session-materials';

const fullName = (u) => `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || null;

/**
 * Stream of a module: course_posts plus any session_materials not yet copied into course_posts, with signed file URLs.
 * Pinned first, then newest first. Callers must already have authorised access to the course.
 */
export async function listCoursePosts(courseId, { limit = 100 } = {}) {
  const rows = await db
    .select({
      id: coursePosts.id,
      type: coursePosts.type,
      title: coursePosts.title,
      body: coursePosts.body,
      file_url: coursePosts.fileUrl,
      file_bucket: coursePosts.fileBucket,
      file_type: coursePosts.fileType,
      link_url: coursePosts.linkUrl,
      pinned: coursePosts.pinned,
      session_id: coursePosts.sessionId,
      author_id: coursePosts.authorId,
      created_at: coursePosts.createdAt,
      updated_at: coursePosts.updatedAt,
      first_name: users.firstName,
      last_name: users.lastName,
      assignment_id: assignments.id,
      due_date: assignments.dueDate,
      total_marks: assignments.totalMarks,
      allow_late: assignments.allowLate,
    })
    .from(coursePosts)
    .leftJoin(users, eq(coursePosts.authorId, users.id))
    .leftJoin(assignments, eq(coursePosts.assignmentId, assignments.id))
    .where(eq(coursePosts.courseId, courseId))
    .orderBy(desc(coursePosts.pinned), desc(coursePosts.createdAt))
    .limit(limit);

  const migrated = await db.select({ id: coursePosts.legacyMaterialId }).from(coursePosts)
    .where(and(eq(coursePosts.courseId, courseId), isNotNull(coursePosts.legacyMaterialId)));
  const migratedIds = migrated.map((m) => m.id);

  const legacyWhere = migratedIds.length
    ? and(eq(sessionMaterials.courseId, courseId), notInArray(sessionMaterials.id, migratedIds))
    : eq(sessionMaterials.courseId, courseId);
  const legacy = await db
    .select({
      id: sessionMaterials.id,
      title: sessionMaterials.title,
      content: sessionMaterials.content,
      file_url: sessionMaterials.fileUrl,
      file_type: sessionMaterials.fileType,
      session_id: sessionMaterials.sessionId,
      author_id: sessionMaterials.uploadedBy,
      created_at: sessionMaterials.createdAt,
      first_name: users.firstName,
      last_name: users.lastName,
    })
    .from(sessionMaterials)
    .leftJoin(users, eq(sessionMaterials.uploadedBy, users.id))
    .where(legacyWhere)
    .orderBy(desc(sessionMaterials.createdAt))
    .limit(limit);

  const posts = [
    ...rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      file_url: r.file_url,
      file_bucket: r.file_bucket || POST_BUCKET,
      file_type: r.file_type,
      link_url: r.link_url,
      pinned: r.pinned,
      session_id: r.session_id,
      author: r.author_id ? { id: r.author_id, name: fullName(r) } : null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      assignment: r.assignment_id
        ? { id: r.assignment_id, due_date: r.due_date, total_marks: Number(r.total_marks ?? 100), allow_late: r.allow_late }
        : null,
    })),
    ...legacy.map((m) => ({
      id: `legacy-${m.id}`,
      type: 'material',
      title: m.title || 'Material',
      body: m.content,
      file_url: m.file_url,
      file_bucket: LEGACY_BUCKET,
      file_type: m.file_type,
      link_url: null,
      pinned: false,
      session_id: m.session_id,
      author: m.author_id ? { id: m.author_id, name: fullName(m) } : null,
      created_at: m.created_at,
      updated_at: m.created_at,
      assignment: null,
      legacy: true,
    })),
  ].sort((a, b) => (b.pinned - a.pinned) || String(b.created_at).localeCompare(String(a.created_at)));

  return Promise.all(posts.slice(0, limit).map(async ({ file_bucket, ...p }) => ({
    ...p,
    file_url: p.file_url ? await resolveFileUrl(file_bucket, p.file_url) : null,
  })));
}
