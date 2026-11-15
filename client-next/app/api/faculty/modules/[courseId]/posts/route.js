export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assignments, coursePosts, courses, sessions, users } from '@/drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { facultyOwnsCourse, forbidden, safeHttpUrl } from '@/lib/faculty-access';
import { listCoursePosts, POST_BUCKET } from '@/lib/course-posts';
import { validateUploadFile, sanitizeFilename, mimeToFileType } from '@/lib/file-validation';
import { uploadToStorage, deleteFromStorage } from '@/lib/storage';
import { notifyStudents, enrolledStudentIds } from '@/lib/notification-send';

const TYPES = ['announcement', 'material', 'link', 'assignment'];
const NOTIFY_TYPE = { announcement: 'course_announcement', material: 'material_posted', link: 'material_posted', assignment: 'assignment_posted' };
const LABEL = { announcement: 'New announcement', material: 'New material', link: 'New link', assignment: 'New assignment' };

async function getHandler(req, { params }) {
  try {
    const { courseId } = params;
    if (!(await facultyOwnsCourse(req.user.id, courseId))) return forbidden();
    const [course] = await db.select({ id: courses.id, name: courses.name, code: courses.code }).from(courses).where(eq(courses.id, courseId)).limit(1);
    if (!course) return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    const posts = await listCoursePosts(courseId);
    return NextResponse.json({ course, posts });
  } catch (err) {
    console.error('Faculty posts list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function postHandler(req, { params }) {
  let storedKey = null;
  try {
    const { courseId } = params;
    if (!(await facultyOwnsCourse(req.user.id, courseId))) return forbidden();

    const form = await req.formData();
    const type = String(form.get('type') || '');
    const title = String(form.get('title') || '').trim();
    const body = String(form.get('body') || '').trim() || null;
    const rawLink = String(form.get('link_url') || '').trim();
    const sessionId = String(form.get('session_id') || '').trim() || null;
    const pinned = form.get('pinned') === 'true';
    const notify = form.get('notify') !== 'false';
    const email = form.get('email') === 'true';
    const fileEntry = form.get('file');
    const hasFile = fileEntry instanceof File && fileEntry.size > 0;

    if (!TYPES.includes(type)) return NextResponse.json({ error: 'Invalid post type' }, { status: 400 });
    if (!title || title.length > 200) return NextResponse.json({ error: 'Title is required (max 200 characters)' }, { status: 400 });
    if (body && body.length > 5000) return NextResponse.json({ error: 'Text is too long (max 5000 characters)' }, { status: 400 });

    let linkUrl = null;
    if (type === 'link' || rawLink) {
      linkUrl = safeHttpUrl(rawLink);
      if (!linkUrl) return NextResponse.json({ error: 'Enter a valid http(s) link' }, { status: 400 });
    }
    if (type === 'material' && !hasFile) return NextResponse.json({ error: 'Attach a file for a material post' }, { status: 400 });

    if (sessionId) {
      const [s] = await db.select({ id: sessions.id }).from(sessions)
        .where(and(eq(sessions.id, sessionId), eq(sessions.courseId, courseId), eq(sessions.facultyId, req.user.id))).limit(1);
      if (!s) return NextResponse.json({ error: 'Class not found for this module' }, { status: 400 });
    }

    let dueDate = null; let totalMarks = 100; let allowLate = true;
    if (type === 'assignment') {
      const rawDue = String(form.get('due_date') || '').trim();
      if (rawDue) {
        if (Number.isNaN(new Date(rawDue).getTime())) return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
        dueDate = rawDue;
      }
      const tm = Number(form.get('total_marks') || 100);
      if (!Number.isFinite(tm) || tm <= 0 || tm > 1000) return NextResponse.json({ error: 'Total marks must be between 1 and 1000' }, { status: 400 });
      totalMarks = tm;
      allowLate = form.get('allow_late') !== 'false';
    }

    let fileType = null;
    if (hasFile) {
      const v = validateUploadFile(fileEntry);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      storedKey = `${courseId}/${Date.now()}-${sanitizeFilename(v.file.name)}`;
      await uploadToStorage(POST_BUCKET, storedKey, v.file);
      fileType = mimeToFileType(v.file.type || '');
    }

    const post = await db.transaction(async (tx) => {
      let assignmentId = null;
      if (type === 'assignment') {
        const [a] = await tx.insert(assignments).values({
          courseId, facultyId: req.user.id, title, description: body, dueDate, totalMarks: String(totalMarks),
          fileUrl: storedKey, allowLate,
        }).returning({ id: assignments.id });
        assignmentId = a.id;
      }
      const [p] = await tx.insert(coursePosts).values({
        courseId, authorId: req.user.id, type, title, body, fileUrl: storedKey, fileBucket: storedKey ? POST_BUCKET : null,
        fileType, linkUrl, sessionId, assignmentId, pinned,
      }).returning();
      return p;
    });
    storedKey = null; // committed

    let notified = { inApp: 0, emailQueued: 0 };
    if (notify) {
      try {
        const [course] = await db.select({ name: courses.name }).from(courses).where(eq(courses.id, courseId)).limit(1);
        const [me] = await db.select({ f: users.firstName, l: users.lastName }).from(users).where(eq(users.id, req.user.id)).limit(1);
        notified = await notifyStudents({
          studentIds: await enrolledStudentIds([courseId]),
          type: NOTIFY_TYPE[type],
          title: `${LABEL[type]}: ${course?.name || 'Module'}`,
          message: type === 'assignment' && dueDate ? `${title} (due ${dueDate.slice(0, 16).replace('T', ' ')})` : title,
          courseId, sentBy: req.user.id, senderName: `${me?.f || ''} ${me?.l || ''}`.trim(),
          courseName: course?.name || '', email,
        });
      } catch (e) {
        console.error('Post notification failed (post was created):', e);
      }
    }

    return NextResponse.json({ post, notified }, { status: 201 });
  } catch (err) {
    if (storedKey) await deleteFromStorage(POST_BUCKET, storedKey);
    console.error('Faculty post create error:', err);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['faculty']);
export const POST = withRole(postHandler, ['faculty']);
