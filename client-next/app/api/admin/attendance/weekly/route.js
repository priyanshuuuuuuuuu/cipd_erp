export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    // Get current week date range
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const start = weekStart.toISOString().split('T')[0];
    const end = weekEnd.toISOString().split('T')[0];

    // Get all completed sessions for this week
    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select('id, session_date')
      .eq('status', 'completed')
      .gte('session_date', start)
      .lte('session_date', end);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ weekly: [], averageAttendance: 0, totalAbsent: 0 });
    }

    const sessionIds = sessions.map(s => s.id);

    // Get attendance records for these sessions
    const { data: records } = await supabaseAdmin
      .from('attendance_records')
      .select('session_id, status')
      .in('session_id', sessionIds);

    // Group by day
    const dayMap = {};
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    sessions.forEach(s => {
      const date = new Date(s.session_date);
      const dayName = dayNames[date.getDay()];
      if (!dayMap[dayName]) dayMap[dayName] = { total: 0, present: 0 };

      const sessionRecords = (records || []).filter(r => r.session_id === s.id);
      dayMap[dayName].total += sessionRecords.length;
      dayMap[dayName].present += sessionRecords.filter(r => r.status === 'present').length;
    });

    const weekly = Object.entries(dayMap).map(([day, stats]) => ({
      day,
      pct: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
    }));

    const totalPresent = Object.values(dayMap).reduce((a, d) => a + d.present, 0);
    const totalRecords = Object.values(dayMap).reduce((a, d) => a + d.total, 0);
    const avgPct = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 1000) / 10 : 0;

    // Count absent today
    const todaySessions = sessions.filter(s => s.session_date === now.toISOString().split('T')[0]);
    const todaySessionIds = todaySessions.map(s => s.id);
    const todayAbsent = (records || []).filter(r => todaySessionIds.includes(r.session_id) && r.status !== 'present').length;

    return NextResponse.json({
      weekly,
      averageAttendance: avgPct,
      totalAbsent: todayAbsent,
    });
  } catch (err) {
    console.error('Admin weekly attendance error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
