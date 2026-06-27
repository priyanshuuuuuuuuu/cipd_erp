export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

const DEFAULT_RATE = 2000;

function sessionDurationHours(startTime, endTime) {
  const start = new Date(`1970-01-01T${startTime}Z`);
  const end = new Date(`1970-01-01T${endTime}Z`);
  return Math.abs((end - start) / (1000 * 60 * 60));
}

async function handler(req) {
  try {
    const facultyId = req.user.id;

    const [{ data: faculty, error: facErr }, { data: sessions, error: sessErr }] = await Promise.all([
      supabaseAdmin
        .from('faculty')
        .select('designation, honorarium_rate_per_hour, years_experience, department')
        .eq('id', facultyId)
        .single(),
      supabaseAdmin
        .from('sessions')
        .select(`
          id, title, session_date, start_time, end_time, status,
          courses ( name ),
          venues ( name )
        `)
        .eq('faculty_id', facultyId)
        .order('session_date', { ascending: false }),
    ]);

    if (facErr) {
      console.error('Faculty profile error:', facErr);
      return NextResponse.json({ error: 'Failed to fetch faculty profile' }, { status: 500 });
    }
    if (sessErr) {
      console.error('Faculty sessions error:', sessErr);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    const rate = faculty?.honorarium_rate_per_hour || DEFAULT_RATE;
    let totalHours = 0;
    let completedSessions = 0;

    const sessionDetails = (sessions || []).map((s) => {
      const durationHrs = sessionDurationHours(s.start_time, s.end_time);
      if (s.status === 'completed') {
        totalHours += durationHrs;
        completedSessions += 1;
      }

      const [y, m, d] = s.session_date.split('-');
      const dObj = new Date(Number(y), Number(m) - 1, Number(d));

      return {
        session_id: s.id,
        title: s.title || 'Untitled Session',
        course: s.courses?.name || 'Unknown',
        venue: s.venues?.name || 'Unknown',
        date: dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        date_raw: s.session_date,
        duration: `${durationHrs.toFixed(1)}h`,
        status: s.status,
      };
    });

    return NextResponse.json({
      profile: {
        designation: faculty?.designation || '',
        department: faculty?.department || '',
        years_experience: faculty?.years_experience ?? null,
        honorarium_rate_per_hour: rate,
      },
      totalHours: Math.round(totalHours * 10) / 10,
      completedSessions,
      totalSessionCount: (sessions || []).length,
      estimatedHonorarium: Math.round(totalHours * rate),
      sessions: sessionDetails,
    });
  } catch (err) {
    console.error('Faculty hours error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(handler, ['faculty']);
