export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, courseEnrollments, attendanceRecords, attendancePingLogs } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Get session details
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
      with: {
        course: { columns: { id: true, name: true } },
        faculty: {
          columns: { id: true },
          with: { user: { columns: { firstName: true, lastName: true } } }
        },
        venue: { columns: { id: true, name: true, building: true, routerBssid: true } }
      }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get enrolled students for this course
    const enrollments = await db.query.courseEnrollments.findMany({
      where: eq(courseEnrollments.courseId, session.courseId),
      with: {
        student: {
          columns: { id: true, enrollmentNo: true, macAddress: true, macVerified: true, deviceHash: true },
          with: { user: { columns: { firstName: true, lastName: true } } }
        }
      }
    });

    // Get attendance records for this session
    const records = await db.query.attendanceRecords.findMany({
      columns: { studentId: true, pingCount: true, status: true, calculatedAt: true },
      where: eq(attendanceRecords.sessionId, sessionId)
    });

    // Get ping logs for this session
    const pings = await db.query.attendancePingLogs.findMany({
      columns: { studentId: true, deviceHash: true, bssid: true, signalStrength: true, pingTime: true },
      where: eq(attendancePingLogs.sessionId, sessionId),
      orderBy: [desc(attendancePingLogs.pingTime)]
    });

    // Build student attendance list
    const studentsList = (enrollments || []).map(e => {
      const s = e.student;
      const record = (records || []).find(r => r.studentId === e.studentId);
      const studentPings = (pings || []).filter(p => p.studentId === e.studentId);
      const lastPing = studentPings[0];

      return {
        student_id: e.studentId,
        name: `${s?.user?.firstName || ''} ${s?.user?.lastName || ''}`.trim(),
        enrollment_no: s?.enrollmentNo || '',
        mac_address: s?.macAddress || null,
        mac_verified: s?.macVerified || false,
        pings: record?.pingCount || studentPings.length,
        status: record?.status || (studentPings.length >= 3 ? 'present' : studentPings.length >= 1 ? 'partial' : 'absent'),
        last_seen: lastPing?.pingTime || null,
      };
    });

    const presentCount = studentsList.filter(s => s.status === 'present').length;
    const absentCount = studentsList.filter(s => s.status === 'absent').length;

    
    const formattedSession = {
      ...session,
      session_date: session.sessionDate,
      start_time: session.startTime,
      end_time: session.endTime,
      courses: session.course,
      faculty: {
        id: session.faculty?.id,
        users: { first_name: session.faculty?.user?.firstName, last_name: session.faculty?.user?.lastName }
      },
      venues: {
        id: session.venue?.id,
        name: session.venue?.name,
        building: session.venue?.building,
        router_bssid: session.venue?.routerBssid
      }
    };

    return NextResponse.json({
      session: formattedSession,
      students: studentsList,
      summary: {
        total: studentsList.length,
        present: presentCount,
        absent: absentCount,
        partial: studentsList.length - presentCount - absentCount,
      },
    });
  } catch (err) {
    console.error('Admin attendance snapshot error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
