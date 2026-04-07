export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

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
        const todayStr = new Date().toISOString().split('T')[0];

        if (filter === 'today') {
            query = query.eq('session_date', todayStr);
        } else if (filter === 'week') {
            const today = new Date();
            const dayOfWeek = today.getDay() || 7; // Sunday = 7
            const monday = new Date(today);
            monday.setDate(today.getDate() - dayOfWeek + 1);
            const sunday = new Date(today);
            sunday.setDate(monday.getDate() + 6);
            query = query
                .gte('session_date', monday.toISOString().split('T')[0])
                .lte('session_date', sunday.toISOString().split('T')[0]);
        } else if (['confirmed', 'pending', 'cancelled'].includes(filter)) {
            const dbStatus = filter === 'confirmed' ? 'scheduled' : filter;
            query = query.eq('status', dbStatus);
        }

        const { data, error } = await query
            .order('session_date', { ascending: true })
            .order('start_time', { ascending: true });

        if (error) throw error;

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

        const sessions = (data || []).map(s => ({
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
            status: s.status === 'scheduled'
                ? 'Confirmed'
                : s.status.charAt(0).toUpperCase() + s.status.slice(1),
            // Raw IDs / values for edit form pre-fill
            title: s.title || '',
            course_id: s.course_id || '',
            faculty_id: s.faculty_id || '',
            venue_id: s.venue_id || '',
            session_type_id: s.session_type_id || '',
        }));

        return NextResponse.json({ sessions });

    } catch (error) {
        console.error('Schedule API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const GET = withRole(handler, ['admin']);
