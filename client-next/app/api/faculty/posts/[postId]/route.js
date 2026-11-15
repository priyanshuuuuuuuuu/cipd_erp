export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assignments, assignmentSubmissions, coursePosts } from '@/drizzle/schema';
import { and, count, eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { safeHttpUrl } from '@/lib/faculty-access';
import { deleteFromStorage } from '@/lib/storage';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadOwn(req, postId) {
  if (!UUID_RE.test(postId)) return null; // e.g. legacy-<id> materials are read-only here
  const [post] = await db.select().from(coursePosts)
    .where(and(eq(coursePosts.id, postId), eq(coursePosts.authorId, req.user.id))).limit(1);
  return post || null;
}

async function patchHandler(req, { params }) {
  try {
    const post = await loadOwn(req, params.postId);
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    const b = await req.json();

    const set = { updatedAt: new Date().toISOString() };
    if (b.title !== undefined) {
      const t = String(b.title).trim();
      if (!t || t.length > 200) return NextResponse.json({ error: 'Title is required (max 200 characters)' }, { status: 400 });
      set.title = t;
    }
    if (b.body !== undefined) {
      const body = String(b.body || '').trim() || null;
      if (body && body.length > 5000) return NextResponse.json({ error: 'Text is too long' }, { status: 400 });
      set.body = body;
    }
    if (b.pinned !== undefined) set.pinned = !!b.pinned;
    if (b.link_url !== undefined) {
      if (b.link_url) {
        const u = safeHttpUrl(b.link_url);
        if (!u) return NextResponse.json({ error: 'Enter a valid http(s) link' }, { status: 400 });
        set.linkUrl = u;
      } else if (post.type === 'link') {
        return NextResponse.json({ error: 'A link post needs a link' }, { status: 400 });
      } else set.linkUrl = null;
    }

    if (post.assignmentId) {
      const aSet = {};
      if (set.title) aSet.title = set.title;
      if ('body' in set) aSet.description = set.body;
      if (b.due_date !== undefined) {
        if (b.due_date && Number.isNaN(new Date(b.due_date).getTime())) return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
        aSet.dueDate = b.due_date || null;
      }
      if (b.total_marks !== undefined) {
        const tm = Number(b.total_marks);
        if (!Number.isFinite(tm) || tm <= 0 || tm > 1000) return NextResponse.json({ error: 'Total marks must be between 1 and 1000' }, { status: 400 });
        aSet.totalMarks = String(tm);
      }
      if (b.allow_late !== undefined) aSet.allowLate = !!b.allow_late;
      if (Object.keys(aSet).length) await db.update(assignments).set(aSet).where(eq(assignments.id, post.assignmentId));
    }

    const [updated] = await db.update(coursePosts).set(set).where(eq(coursePosts.id, post.id)).returning();
    return NextResponse.json({ post: updated });
  } catch (err) {
    console.error('Faculty post update error:', err);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}

async function deleteHandler(req, { params }) {
  try {
    const post = await loadOwn(req, params.postId);
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    if (post.assignmentId) {
      const [{ n }] = await db.select({ n: count() }).from(assignmentSubmissions)
        .where(eq(assignmentSubmissions.assignmentId, post.assignmentId));
      if (Number(n) > 0) {
        return NextResponse.json({ error: 'This assignment already has submissions and cannot be deleted.' }, { status: 409 });
      }
    }
    await db.transaction(async (tx) => {
      await tx.delete(coursePosts).where(eq(coursePosts.id, post.id));
      if (post.assignmentId) await tx.delete(assignments).where(eq(assignments.id, post.assignmentId));
    });
    if (post.fileUrl) await deleteFromStorage(post.fileBucket || 'course-posts', post.fileUrl);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Faculty post delete error:', err);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}

export const PATCH = withRole(patchHandler, ['faculty']);
export const DELETE = withRole(deleteHandler, ['faculty']);
