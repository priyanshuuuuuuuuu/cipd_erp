import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
  const curr = new Date();
  const first = curr.getDate() - curr.getDay() + 1;
  const monday = new Date(curr.setDate(first)).toISOString().split('T')[0];
  
  console.log('Checking sessions from:', monday);

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, session_date, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
     console.error('Error fetching sessions:', error);
     return;
  }
  
  console.log(`Found ${sessions?.length || 0} sessions this week:`);
  sessions.forEach(s => console.log(` - ID: ${s.id}, Date: ${s.session_date}, Status: ${s.status}`));

  if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);
      const { data: records, error: recErr } = await supabase
        .from('attendance_records')
        .select('session_id, status')
        .in('session_id', sessionIds);
        
      console.log(`\nFound ${records?.length || 0} attendance records for these sessions.`);
      
      const dayMap = {};
      records.forEach(r => {
          if (!dayMap[r.session_id]) dayMap[r.session_id] = { total: 0, present: 0 };
          dayMap[r.session_id].total++;
          if (r.status === 'present') dayMap[r.session_id].present++;
      });
      
      console.log('\nBreakdown by session:');
      for (const [sId, stats] of Object.entries(dayMap)) {
          console.log(` - Session ${sId}: ${stats.present}/${stats.total} present (${Math.round(stats.present/stats.total*100)}%)`);
      }
  }
}

checkData().catch(console.error);
