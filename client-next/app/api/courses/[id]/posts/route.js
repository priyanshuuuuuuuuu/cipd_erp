export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { canViewCourse, forbidden } from '@/lib/faculty-access';
import { listCoursePosts } from '@/lib/course-posts';

// Module stream (announcements, materials, links, assignments). Visible to every student ENROLLED in the module,
// whether or not they attended any class; also to admins and to faculty who teach the module.
async function handler(req, { params }) {
  try {
    const { id } = params;
    if (!(await canViewCourse(req.user, id))) return forbidden('You are not enrolled in this module');
    return NextResponse.json({ posts: await listCoursePosts(id) });
  } catch (err) {
    console.error('Course posts error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
