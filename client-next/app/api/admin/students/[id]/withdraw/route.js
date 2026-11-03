export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { withdrawStudent } from '@/lib/student-service';
import { errorResponse } from '@/lib/sql-ident';

// POST /api/admin/students/[id]/withdraw — membership becomes `withdrawn`; nothing is deleted.
async function handler(req, { params }) {
  try {
    await withdrawStudent(params.id, req.cohortInfo.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Student withdraw error');
  }
}

export const POST = withRole(handler, ['admin']);
