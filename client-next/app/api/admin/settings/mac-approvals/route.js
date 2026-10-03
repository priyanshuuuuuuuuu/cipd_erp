export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, users } from '@/drizzle/schema';
import { eq, and, isNotNull, asc } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    // ── GET: list all pending MAC approval requests ──────────────────────────
    if (req.method === 'GET') {
      const data = await db
        .select({
          id: students.id,
          enrollment_no: students.enrollmentNo,
          mac_address: students.macAddress,
          mac_verified: students.macVerified,
          first_name: users.firstName,
          last_name: users.lastName,
          email: users.email,
        })
        .from(students)
        .leftJoin(users, eq(students.id, users.id))
        .where(and(
          isNotNull(students.macAddress),
          eq(students.macVerified, false)
        ))
        .orderBy(asc(students.enrollmentNo));

      const pending = (data || []).map((s) => ({
        id: s.id,
        enrollment_no: s.enrollment_no,
        mac_address: s.mac_address,
        mac_verified: s.mac_verified,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown',
        email: s.email || '',
      }));

      return NextResponse.json({ pending });
    }

    // ── PATCH: approve or reject a MAC address ────────────────────────────────
    if (req.method === 'PATCH') {
      const { studentId, action } = await req.json();

      if (!studentId || !['approve', 'reject'].includes(action)) {
        return NextResponse.json(
          { error: 'Invalid request. Provide studentId and action (approve|reject).' },
          { status: 400 }
        );
      }

      let updatePayload;
      if (action === 'approve') {
        updatePayload = { macVerified: true };
      } else {
        updatePayload = { macAddress: null, macVerified: false };
      }

      const updated = await db
        .update(students)
        .set(updatePayload)
        .where(eq(students.id, studentId))
        .returning({
          id: students.id,
          mac_address: students.macAddress,
          mac_verified: students.macVerified,
        });

      if (!updated || updated.length === 0) {
        console.error(`MAC approval: no student row matched id=${studentId}`);
        return NextResponse.json(
          { error: `No student found with id ${studentId}` },
          { status: 404 }
        );
      }

      console.log(`MAC ${action} applied to student ${studentId}:`, updated[0]);

      return NextResponse.json({ success: true, action, student: updated[0] });
    }

    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (err) {
    console.error('MAC approvals API error:', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}

export const GET   = withRole(handler, ['admin']);
export const PATCH = withRole(handler, ['admin']);
