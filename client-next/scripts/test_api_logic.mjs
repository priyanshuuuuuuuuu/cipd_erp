import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testWeeklyAPI() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
    }
    console.log('Searching for explicit dates:', dates);

    // Get all sessions for this week by explicit dates
    const { data: allSessions } = await supabaseAdmin.from('sessions').select('id, session_date').limit(10);
    console.log('Raw output from Supabase without filters:', allSessions);

    const { data: sessions, error } = await supabaseAdmin
      .from('sessions')
      .select('id, session_date')
      .in('session_date', dates);

    if (!sessions || sessions.length === 0) {
      console.log('No sessions found.');
      return;
    }

    const sessionIds = sessions.map(s => s.id);

    const { data: records } = await supabaseAdmin
      .from('attendance_records')
      .select('session_id, status')
      .in('session_id', sessionIds);

    const dayMap = {
      'Mon': { total: 0, present: 0 },
      'Tue': { total: 0, present: 0 },
      'Wed': { total: 0, present: 0 },
      'Thu': { total: 0, present: 0 },
      'Fri': { total: 0, present: 0 },
      'Sat': { total: 0, present: 0 },
    };
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    sessions.forEach(s => {
      const [year, month, day] = s.session_date.split('-');
      const date = new Date(year, month - 1, day);
      const dayName = dayNames[date.getDay()];
      
      console.log(`Session ${s.id} on ${s.session_date} falls on ${dayName}`);
      
      if (dayMap[dayName]) {
        const sessionRecords = (records || []).filter(r => r.session_id === s.id);
        dayMap[dayName].total += sessionRecords.length;
        dayMap[dayName].present += sessionRecords.filter(r => r.status === 'present').length;
      }
    });

    const weekly = Object.entries(dayMap).map(([day, stats]) => ({
      day,
      pct: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
    }));

    console.log('\nFinal API JSON Output:', JSON.stringify(weekly, null, 2));
}

testWeeklyAPI().catch(console.error);
