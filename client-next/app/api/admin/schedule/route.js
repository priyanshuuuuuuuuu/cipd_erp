export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { getISTDateString, getISTWeekRange } from '@/lib/ist-date';

async function handler(request) {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // 'all', 'today', 'week', 'confirmed', 'pending'

    try {
        let query = supabaseAdmin
            .from('sessions')
            .select(`
                id,
                title,
                session_date,
                start_time,
                end_time,
                status,
                course_id,
                faculty_id,
                venue_id,
                session_type_id,
                courses ( id, name ),
                faculty:faculty_id ( id, users!inner ( first_name, last_name ) ),
                venues ( id, name ),
                session_types ( id, name )
            `);

        // Filter processing
        const todayStr = getISTDateString(); // IST date (not UTC)

        if (filter === 'today') {
            query = query.eq('session_date', todayStr);
        } else if (filter === 'week') {
            const { start: monday, end: sunday } = getISTWeekRange();
            query = query
                .gte('session_date', monday)
                .lte('session_date', sunday);
        } else if (['confirmed', 'pending', 'cancelled'].includes(filter)) {
            const dbStatus = filter === 'confirmed' ? 'scheduled' : filter;
            query = query.eq('status', dbStatus);
        }

        const { data, error } = await query
            .order('session_date', { ascending: true })
            .order('start_time', { ascending: true });

        if (error) throw error;

        // Fetch skill_ids for all sessions in one batch query
        const sessionIds = (data || []).map(s => s.id);
        let skillsMap = {}; // { session_id: [skill_id, ...] }

        if (sessionIds.length > 0) {
            try {
                const { data: ssData } = await supabaseAdmin
                    .from('session_skills')
                    .select('session_id, skill_id')
                    .in('session_id', sessionIds);

                (ssData || []).forEach(row => {
                    if (!skillsMap[row.session_id]) skillsMap[row.session_id] = [];
                    skillsMap[row.session_id].push(row.skill_id);
                });
            } catch (_) {
                // table may not exist yet — skills just won't be populated
            }
        }
        // Fetch real enrollment counts in one batch query
        const courseIds = [...new Set((data || []).map(s => s.course_id).filter(Boolean))];
        let enrollmentMap = {};

        if (courseIds.length > 0) {
            const { data: enrollments } = await supabaseAdmin
                .from('course_enrollments')
                .select('course_id')
                .in('course_id', courseIds);

            (enrollments || []).forEach(e => {
                enrollmentMap[e.course_id] = (enrollmentMap[e.course_id] || 0) + 1;
            });
        }

        // Current time in IST (UTC+5:30) as a comparable "YYYY-MM-DDTHH:MM" string
        const nowUtcMs = Date.now();
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30
        const nowIstMs = nowUtcMs + IST_OFFSET_MS;
        const nowIst = new Date(nowIstMs); // treat as UTC internally but represents IST wall-clock
        const nowIstStr = nowIst.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"

        const sessions = (data || []).map(s => {
            let computedStatus = s.status === 'scheduled'
                ? 'Confirmed'
                : s.status.charAt(0).toUpperCase() + s.status.slice(1);

            if (s.status === 'scheduled' && s.session_date && s.start_time && s.end_time) {
                // Compare session start/end (stored in IST) against current IST wall-clock time
                const sessionStartStr = `${s.session_date}T${s.start_time.slice(0, 5)}`;
                const sessionEndStr   = `${s.session_date}T${s.end_time.slice(0, 5)}`;

                if (nowIstStr >= sessionEndStr) {
                    // Class has fully ended
                    computedStatus = 'Completed';
                } else if (nowIstStr >= sessionStartStr) {
                    // Class is currently ongoing
                    computedStatus = 'Ongoing';
                }
            }

            return {
                id: s.id,
                // Display values
                course: s.courses?.name || 'Unknown',
                sessionType: s.session_types?.name || null,
                faculty: s.faculty?.users
                    ? `Prof. ${s.faculty.users.first_name} ${s.faculty.users.last_name}`
                    : 'Unknown',
                venue: s.venues?.name || 'TBA',
                date: s.session_date,
                time: s.start_time?.slice(0, 5),
                endTime: s.end_time?.slice(0, 5),
                students: enrollmentMap[s.course_id] || 0,
                status: computedStatus,
                // Raw IDs / values for edit form pre-fill
                title: s.title || '',
                course_id: s.course_id || '',
                faculty_id: s.faculty_id || '',
                venue_id: s.venue_id || '',
                session_type_id: s.session_type_id || '',
                skill_ids: skillsMap[s.id] || [],
            };
        });

        return NextResponse.json({ sessions });

    } catch (error) {
        console.error('Schedule API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const GET = withRole(handler, ['admin']);
