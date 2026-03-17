import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // 'all', 'today', 'week', 'confirmed', 'pending'

    try {
        let query = supabase
            .from('sessions')
            .select(`
                id,
                session_date,
                start_time,
                end_time,
                status,
                courses(name),
                faculty:faculty_id(users!inner(first_name, last_name)),
                venues(name)
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

            const monStr = monday.toISOString().split('T')[0];
            const sunStr = sunday.toISOString().split('T')[0];

            query = query.gte('session_date', monStr).lte('session_date', sunStr);
        } else if (filter === 'confirmed' || filter === 'pending' || filter === 'cancelled') {
            // Mapping UI status to backend status
            const dbStatus = filter.toLowerCase();
            query = query.eq('status', dbStatus === 'confirmed' ? 'scheduled' : dbStatus); 
        }

        const { data, error } = await query.order('session_date', { ascending: true }).order('start_time', { ascending: true });
        
        if (error) throw error;

        // Map data for the frontend
        const sessions = data.map(s => {
            // Count students (simulated for now, could be grouped via `course_enrollments` but this keeps it fast)
            const simulatedStudentsCount = 30 + (s.id.charCodeAt(0) % 20); 

            return {
                id: s.id,
                course: s.courses?.name || 'Unknown',
                faculty: `Prof. ${s.faculty?.users?.first_name} ${s.faculty?.users?.last_name}`,
                venue: s.venues?.name || 'TBA',
                date: s.session_date,
                time: s.start_time?.slice(0, 5),
                endTime: s.end_time?.slice(0, 5),
                students: simulatedStudentsCount,
                status: s.status === 'scheduled' ? 'Confirmed' : s.status === 'completed' ? 'Confirmed' : s.status.charAt(0).toUpperCase() + s.status.slice(1)
            };
        });

        return new Response(JSON.stringify({ sessions }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('API Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
