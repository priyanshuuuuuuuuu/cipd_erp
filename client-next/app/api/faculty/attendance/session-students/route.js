export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { getOwnedSession, forbidden } from '@/lib/faculty-access';
import { sessionStudentsHandler } from '@/lib/attendance/session-students';

// Read-only view of who attended one of the caller's own sessions. Devices, MACs, signal data and
// penalty/override details stay admin-only.
async function handler(req) {
  const sessionId = new URL(req.url).searchParams.get('session_id');
  if (!sessionId) return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  if (!(await getOwnedSession(req.user.id, sessionId))) return forbidden();

  const res = await sessionStudentsHandler(req);
  if (!res.ok) return res;
  const data = await res.json();

  return NextResponse.json({
    session: data.session,
    summary: {
      total: data.summary.total,
      enrolled: data.summary.enrolled,
      present: data.summary.present,
      partial: data.summary.partial,
      absent: data.summary.absent,
      leave: data.summary.leave,
    },
    isOngoing: data.isOngoing,
    students: (data.students || []).map((s) => ({
      studentId: s.studentId,
      enrollmentNo: s.enrollmentNo,
      name: s.name,
      status: s.status,
      firstSeen: s.firstSeen,
      lastSeen: s.lastSeen,
      durationMinutes: s.durationMinutes,
    })),
  });
}

export const GET = withRole(handler, ['faculty']);
