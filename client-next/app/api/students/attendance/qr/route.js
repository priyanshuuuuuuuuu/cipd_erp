export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { connection } from '@/lib/db';
import { qid } from '@/lib/sql-ident';
import { qrPhase, qrSession } from '@/lib/qr-attendance';
import { QR_POINTS } from '@/lib/attendance-points';
import { verifyQrAttendanceToken } from '@/lib/qr-attendance-token.mjs';

async function handler(req) {
  try {
    const { token } = await req.json();
    if (!verifyQrAttendanceToken(process.env.JWT_SECRET, req.cohort, token)) return NextResponse.json({ error: 'This QR code expired or is invalid. Scan the current code.' }, { status: 400 });
    const session = await qrSession(req.cohort, token.sessionId);
    if (!session || qrPhase(session) !== token.phase) return NextResponse.json({ error: 'Attendance is not open for this class.' }, { status: 409 });
    const schema = qid(req.cohort);
    const result = await connection.begin(async (tx) => {
      const enrolled = await tx.unsafe(`SELECT 1 FROM ${schema}.course_enrollments WHERE student_id=$1 AND course_id=$2`, [req.user.id, session.course_id]);
      if (!enrolled.length) return 'not_enrolled';
      const inserted = await tx.unsafe(`INSERT INTO ${schema}.qr_attendance_scans (session_id,student_id,phase) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING phase`, [session.id, req.user.id, token.phase]);
      // Award QR points once per phase (new scan only); admin-set records keep their points.
      // Start QR replaces Wi-Fi points (set total = 5 + end QR); end QR is added on top.
      const award = inserted.length ? QR_POINTS[token.phase] || 0 : 0;
      const isNewStart = inserted.length > 0 && token.phase === 'start';
      const pointsExpr = isNewStart
        ? `$3 + CASE WHEN EXISTS (SELECT 1 FROM ${schema}.qr_attendance_scans s WHERE s.session_id=$1 AND s.student_id=$2 AND s.phase='end') THEN ${QR_POINTS.end} ELSE 0 END`
        : 'COALESCE(existing.points,0) + $3';
      const [record] = await tx.unsafe(`INSERT INTO ${schema}.attendance_records AS existing (session_id,student_id,status,points) VALUES ($1,$2,'present',$3) ON CONFLICT (session_id,student_id) DO UPDATE SET status = CASE WHEN existing.admin_override OR existing.penalty THEN existing.status ELSE 'present' END, points = CASE WHEN existing.admin_override OR existing.penalty THEN existing.points ELSE ${pointsExpr} END RETURNING status`, [session.id, req.user.id, award]);
      if (record.status !== 'present') return 'admin_override';
      return inserted.length ? 'ok' : 'duplicate';
    });
    if (result === 'not_enrolled') return NextResponse.json({ error: 'You are not enrolled in this class.' }, { status: 403 });
    if (result === 'duplicate') return NextResponse.json({ success: true, phase: token.phase, message: 'Attendance already marked present.' });
    if (result === 'admin_override') return NextResponse.json({ success: true, phase: token.phase, message: 'Scan recorded. An administrator has set your attendance status; please contact them with questions.' });
    return NextResponse.json({ success: true, phase: token.phase, message: 'Attendance marked present.' });
  } catch (error) {
    console.error('QR attendance error:', error);
    return NextResponse.json({ error: 'Could not record attendance. Please try again.' }, { status: 500 });
  }
}

export const POST = withRole(handler, ['student']);
