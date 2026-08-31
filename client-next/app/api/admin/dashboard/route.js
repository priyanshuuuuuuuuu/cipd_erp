export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { getISTDateString } from '@/lib/ist-date';

async function handler(req) {
  try {
    // Use the admin_dashboard_summary view
    const { data: summary } = await supabaseAdmin
      .from('admin_dashboard_summary')
      .select('total_students, total_faculty, total_sessions')
      .single();

    // Get today's session count (IST date)
    const today = getISTDateString();
    const { count: todaySessions } = await supabaseAdmin
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('session_date', today)
      .neq('status', 'cancelled');

    // Get recent activity - ordered by creation time so latest actions appear first
    const { data: recentSessions } = await supabaseAdmin
      .from('sessions')
      .select(`
        id, title, session_date, start_time, end_time, status, created_at,
        courses ( name )
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      summary: summary || { total_students: 0, total_faculty: 0, total_sessions: 0 },
      today_sessions: todaySessions || 0,
      recent_sessions: recentSessions || [],
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
