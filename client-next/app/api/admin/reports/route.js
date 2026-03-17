import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // Fetch recent completed sessions for the reports view
        const { data: sessions, error: sessErr } = await supabase
            .from('sessions')
            .select(`
                id,
                session_date,
                courses(name),
                faculty:faculty_id(users!inner(first_name, last_name))
            `)
            .eq('status', 'completed')
            .order('session_date', { ascending: false })
            .limit(10);
            
        if (sessErr) throw sessErr;

        // Map data to the format expected by the reports UI
        const recentReports = sessions.map((s, i) => {
            const facultyName = `Prof. ${s.faculty?.users?.first_name} ${s.faculty?.users?.last_name}`;
            const courseName = s.courses?.name || 'Unknown Course';
            const dateStr = new Date(s.session_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            
            // Generate some mock report metrics based on the session ID just to have visual data
            const avgScore = (85 + (s.id.charCodeAt(0) % 10)).toString() + '%';
            
            return {
                id: i + 1,
                name: `${facultyName} — ${courseName}`,
                type: i % 3 === 0 ? 'Faculty Evaluation' : i % 2 === 0 ? 'Course Feedback' : 'Attendance Summary',
                date: dateStr,
                size: `${(1.2 + (i * 0.3)).toFixed(1)} MB`,
                avgScore: avgScore,
                status: 'Available'
            };
        });

        // Add some mock high-level metrics for the cards
        const metrics = {
            totalReports: 142,
            generatedThisMonth: 18,
            avgRating: '4.6/5'
        };

        return new Response(JSON.stringify({ recentReports, metrics }), {
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
