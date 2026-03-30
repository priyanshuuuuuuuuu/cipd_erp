export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(request) {
    try {
        // Fetch all faculty members with user details
        const { data: facultyList, error: facErr } = await supabaseAdmin
            .from('faculty')
            .select(`
                id,
                designation,
                honorarium_rate_per_hour,
                users!inner ( first_name, last_name, is_active )
            `);

        if (facErr) throw facErr;

        // Fetch completed sessions with course + venue info
        const { data: sessions, error: sessErr } = await supabaseAdmin
            .from('sessions')
            .select(`
                id,
                faculty_id,
                start_time,
                end_time,
                session_date,
                status,
                courses ( name ),
                venues ( name )
            `)
            .eq('status', 'completed');

        if (sessErr) throw sessErr;

        // Map data to calculate hours and honorarium
        const facultyData = (facultyList || []).map(fac => {
            const facSessions = (sessions || []).filter(s => s.faculty_id === fac.id);
            let totalHours = 0;

            const detailedSessions = facSessions.map(s => {
                // Calculate duration in hours
                const start = new Date(`1970-01-01T${s.start_time}Z`);
                const end = new Date(`1970-01-01T${s.end_time}Z`);
                const durationHrs = (end - start) / (1000 * 60 * 60);
                totalHours += durationHrs;

                // Format date for display (safe parsing to avoid timezone issues)
                const [y, m, d] = s.session_date.split('-');
                const dObj = new Date(Number(y), Number(m) - 1, Number(d));
                const dateStr = dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

                return {
                    date: dateStr,
                    course: s.courses?.name || 'Unknown',
                    duration: `${durationHrs.toFixed(1)}h`,
                    venue: s.venues?.name || 'Unknown',
                };
            }).sort((a, b) => new Date(b.date) - new Date(a.date));

            return {
                id: fac.id,
                name: `Prof. ${fac.users?.first_name} ${fac.users?.last_name}`,
                // Use designation as dept label until a real `department` column exists
                dept: fac.designation || 'Faculty',
                sessions: facSessions.length,
                hours: totalHours,
                rate: fac.honorarium_rate_per_hour || 1500,
                status: 'Pending',
                sessionDetails: detailedSessions,
            };
        });

        return NextResponse.json({ facultyData });

    } catch (error) {
        console.error('Faculty Hours API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const GET = withRole(handler, ['admin']);
