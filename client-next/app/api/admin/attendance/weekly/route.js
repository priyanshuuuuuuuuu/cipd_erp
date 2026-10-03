export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions, attendanceRecords } from '@/drizzle/schema';
import { inArray } from 'drizzle-orm';
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
    const sessionsData = await db.query.sessions.findMany({
      columns: { id: true, sessionDate: true },
      where: inArray(sessions.sessionDate, dates)
    });

    const dayMap = {
      'Mon': { total: 0, present: 0 },
      'Tue': { total: 0, present: 0 },
      'Wed': { total: 0, present: 0 },
      'Thu': { total: 0, present: 0 },
      'Fri': { total: 0, present: 0 },
      'Sat': { total: 0, present: 0 },
    };

    let records = [];
    if (sessionsData && sessionsData.length > 0) {
      const sessionIds = sessionsData.map(s => s.id);
      
      records = await db.query.attendanceRecords.findMany({
        columns: { sessionId: true, status: true },
        where: inArray(attendanceRecords.sessionId, sessionIds)
      });
      
      sessionsData.forEach(s => {
        // Safe parsing: 2026-03-09 -> Mon
        const [year, month, day] = s.sessionDate.split('-');
        const dateObj = new Date(year, month - 1, day);
        const dayName = dayNames[dateObj.getDay()];
        
        if (dayMap[dayName]) {
          const sessionRecords = records.filter(r => r.sessionId === s.id);
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
    const safeSessions = sessionsData || [];
    const yNow = now.getFullYear();
    const mNow = String(now.getMonth() + 1).padStart(2, '0');
    const dNow = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yNow}-${mNow}-${dNow}`;
    const todaySessions = safeSessions.filter(s => s.sessionDate === todayStr);
    const todaySessionIds = todaySessions.map(s => s.id);
    const todayAbsent = records.filter(r => todaySessionIds.includes(r.sessionId) && r.status !== 'present').length;

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
