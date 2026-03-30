export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    const now = new Date();
    // In JS, 0 is Sunday. If today is Sunday, we want the Monday 6 days ago.
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);

    // Generate strict YYYY-MM-DD strings for Mon-Sat
    const dates = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const expectedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${dayStr}`);
    }

    // Get all sessions for this week by explicit dates
    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select('id, session_date')
      .in('session_date', dates);

    const dayMap = {
      'Mon': { total: 0, present: 0 },
      'Tue': { total: 0, present: 0 },
      'Wed': { total: 0, present: 0 },
      'Thu': { total: 0, present: 0 },
      'Fri': { total: 0, present: 0 },
      'Sat': { total: 0, present: 0 },
    };

    let records = [];
    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);
      
      const { data, error } = await supabaseAdmin
        .from('attendance_records')
        .select('session_id, status')
        .in('session_id', sessionIds);
        
      if (error) {
        console.error("Supabase API Error:", error);
        return NextResponse.json({ error: "Supabase error", details: error }, { status: 500 });
      }
      
      records = data || [];

      sessions.forEach(s => {
        // Safe parsing: 2026-03-09 -> Mon
        const [year, month, day] = s.session_date.split('-');
        const dateObj = new Date(year, month - 1, day);
        const dayName = dayNames[dateObj.getDay()];
        
        if (dayMap[dayName]) {
          const sessionRecords = records.filter(r => r.session_id === s.id);
          dayMap[dayName].total += sessionRecords.length;
          dayMap[dayName].present += sessionRecords.filter(r => r.status === 'present').length;
        }
      });
    }

    // Convert to exactly Mon-Sat array format expected by UI
    const weekly = expectedDays.map(day => {
      const stats = dayMap[day];
      return {
        day,
        pct: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
      };
    });

    const totalPresent = Object.values(dayMap).reduce((a, d) => a + d.present, 0);
    const totalRecords = Object.values(dayMap).reduce((a, d) => a + d.total, 0);
    const avgPct = totalRecords > 0 ? (totalPresent / totalRecords * 100).toFixed(1) : 0;

    // Count absent today
    const safeSessions = sessions || [];
    const yNow = now.getFullYear();
    const mNow = String(now.getMonth() + 1).padStart(2, '0');
    const dNow = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yNow}-${mNow}-${dNow}`;
    const todaySessions = safeSessions.filter(s => s.session_date === todayStr);
    const todaySessionIds = todaySessions.map(s => s.id);
    const todayAbsent = records.filter(r => todaySessionIds.includes(r.session_id) && r.status !== 'present').length;

    return NextResponse.json({
      weekly,
      averageAttendance: avgPct,
      totalAbsent: todayAbsent,
    });
  } catch (err) {
    console.error('Admin weekly attendance error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message, stack: err.stack }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
