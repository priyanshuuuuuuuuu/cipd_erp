export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');

    let query = supabaseAdmin
      .from('leave_requests')
      .select(`
        id, leave_date, session_id, reason, status, admin_notes, created_at, reviewed_at,
        students (
          id, enrollment_no,
          users ( first_name, last_name, email )
        ),
        sessions ( id, title, start_time, end_time, courses ( name ) ),
        reviewer:reviewed_by ( first_name, last_name )
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query = query.eq('status', status);
    }
    if (date) {
      query = query.eq('leave_date', date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Admin leave requests fetch error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 });
    }

    const pending = (data || []).filter((r) => r.status === 'pending').length;
    const approved = (data || []).filter((r) => r.status === 'approved').length;

    return NextResponse.json({
      requests: data || [],
      stats: { pending, approved, total: (data || []).length },
    });
  } catch (err) {
    console.error('Admin leave requests GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
