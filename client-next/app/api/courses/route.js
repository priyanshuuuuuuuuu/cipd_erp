export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    if (req.user.role === 'admin') {
      // Admin sees all courses
      const { data: courses, error } = await supabaseAdmin
        .from('courses')
        .select('id, name, description, created_at, code')
        .order('name', { ascending: true });

      if (error) throw error;
      return NextResponse.json({ courses: courses || [] });
    }

    // Student sees enrolled courses
    const { data: enrollments } = await supabaseAdmin
      .from('course_enrollments')
      .select(`
        enrolled_at,
        courses ( id, name, description, created_at, code )
      `)
      .eq('student_id', req.user.id);

    const baseCourses = (enrollments || []).map(e => e.courses);

    // Fetch related data for each course to build the rich UI
    const courses = await Promise.all(baseCourses.map(async (course) => {
      // 1. Get assignments count
      const { count: asnCount } = await supabaseAdmin
        .from('assignments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', course.id);

      // 2. Get sessions for faculty, venue, schedule, and count
      const { data: sessions } = await supabaseAdmin
        .from('sessions')
        .select(`
          id, start_time, end_time, session_date,
          venues ( name ),
          faculty ( users ( first_name, last_name ) )
        `)
        .eq('course_id', course.id);

      const sessionList = sessions || [];
      const sessionsCount = sessionList.length;

      // Calculate materials by getting all session IDs
      let materialsCount = 0;
      if (sessionsCount > 0) {
        const sessionIds = sessionList.map(s => s.id);
        const { count: matCount } = await supabaseAdmin
          .from('session_materials')
          .select('*', { count: 'exact', head: true })
          .in('session_id', sessionIds);
        materialsCount = matCount || 0;
      }

      // Extract primary faculty & venue (just pick the first session's details)
      let facultyName = null;
      let venueName = null;
      let schedule = null;
      
      // Use real course code from DB; fall back to initials only if still null (pre-migration)
      const mockCode = course.code || (course.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 5) + '101');

      if (sessionList.length > 0) {
        const first = sessionList[0];
        if (first.faculty?.users) {
           facultyName = `Prof. ${first.faculty.users.first_name} ${first.faculty.users.last_name}`;
        }
        if (first.venues?.name) {
           venueName = first.venues.name;
        }
        
        // Build a mock schedule string based on start_time
        const st = first.start_time ? first.start_time.substring(0, 5) : '09:00';
        schedule = `Mon, Wed · ${st} AM`; 
      }

      return {
        ...course,
        code: mockCode, // real DB code if set, otherwise generated fallback
        faculty_name: facultyName || 'Unknown Faculty',
        venue: venueName || 'TBA',
        schedule: schedule || 'TBA',
        sessions_count: sessionsCount,
        materials_count: materialsCount,
        assignments_count: asnCount || 0,
      };
    }));

    return NextResponse.json({ courses });
  } catch (err) {
    console.error('Courses error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
