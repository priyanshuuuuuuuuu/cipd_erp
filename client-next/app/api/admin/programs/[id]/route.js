export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { updateProgram } from '@/lib/program-service';
import { errorResponse } from '@/lib/sql-ident';

// PATCH /api/admin/programs/:id — rename a program. Body: { name }
async function patchHandler(req, { params }) {
  try {
    const body = await req.json();
    const program = await updateProgram(params.id, body);
    return NextResponse.json({ program });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Program update error');
  }
}

export const PATCH = withRole(patchHandler, ['admin']);
