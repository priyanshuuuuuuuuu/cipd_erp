export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { getISTMonthStart } from '@/lib/ist-date';

async function handler(request) {
    try {
        // 1. Fetch recent completed sessions with course + faculty info
        const { data: sessions, error: sessErr } = await supabaseAdmin
            .from('sessions')
            .select(`
                id,
                session_date,
                status,
                course_id,
                courses ( name ),
                faculty:faculty_id ( users!inner ( first_name, last_name ) )
            `)
            .eq('status', 'completed')
            .order('session_date', { ascending: false })
            .limit(10);

        if (sessErr) throw sessErr;

        // 2. Total completed sessions (all time)
        const { count: totalCompleted } = await supabaseAdmin
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed');

        // 3. Sessions completed this month (IST)
        const startOfMonth = getISTMonthStart();
        const { count: thisMonth } = await supabaseAdmin
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed')
            .gte('session_date', startOfMonth);

        // 4. Average feedback rating across all sessions
        const { data: ratings } = await supabaseAdmin
            .from('feedback_responses')
            .select('rating')
            .not('rating', 'is', null);

        const allRatings = (ratings || []).map(r => r.rating);
        const avgRating = allRatings.length > 0
            ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
            : '—';

        // 5. Build report rows from sessions
        const recentReports = (sessions || []).map((s, i) => {
            const facultyName = s.faculty?.users
                ? `Prof. ${s.faculty.users.first_name} ${s.faculty.users.last_name}`
                : 'Unknown';
            const courseName = s.courses?.name || 'Unknown Course';
            const dateStr = new Date(s.session_date).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
            const typeOptions = ['Attendance Summary', 'Course Feedback', 'Faculty Evaluation'];
            return {
                id: s.id,
                name: `${facultyName} — ${courseName}`,
                type: typeOptions[i % typeOptions.length],
                date: dateStr,
                status: 'Available',
            };
        });

        const metrics = {
            totalReports: totalCompleted || 0,
            generatedThisMonth: thisMonth || 0,
            avgRating: avgRating !== '—' ? `${avgRating}/5` : '—',
        };

        return NextResponse.json({ recentReports, metrics });

    } catch (error) {
        console.error('Reports API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const GET = withRole(handler, ['admin']);
