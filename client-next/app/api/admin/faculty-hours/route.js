export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { hashPassword } from '@/lib/auth';

async function handler(request) {
    try {
        // Fetch all faculty members with user details
        const { data: facultyList, error: facErr } = await supabaseAdmin
            .from('faculty')
            .select(`
                id,
                designation,
                honorarium_rate_per_hour,
                years_experience,
                department,
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
                firstName: fac.users?.first_name || '',
                lastName: fac.users?.last_name || '',
                name: `Prof. ${fac.users?.first_name} ${fac.users?.last_name}`,
                // Use designation as dept label until a real `department` column exists
                dept: fac.department || fac.designation || 'Faculty',
                designation: fac.designation || '',
                department: fac.department || '',
                yearsExperience: fac.years_experience ?? '',
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

async function createFacultyHandler(request) {
    try {
        const body = await request.json();
        const { firstName, lastName, email, yearsExperience, designation } = body;

        // Basic validation
        if (!firstName || !lastName || !email) {
            return NextResponse.json({ error: 'First name, last name, and email are required.' }, { status: 400 });
        }

        // Check if email already exists
        const { data: existing } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase().trim())
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
        }

        // Hash default password
        const password_hash = await hashPassword('cipd@123');

        // Insert into users table
        const { data: newUser, error: userErr } = await supabaseAdmin
            .from('users')
            .insert({
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                email: email.toLowerCase().trim(),
                password_hash,
                role: 'faculty',
                is_active: true,
            })
            .select('id')
            .single();

        if (userErr) throw userErr;

        // Insert into faculty table
        const { error: facErr } = await supabaseAdmin
            .from('faculty')
            .insert({
                id: newUser.id,
                designation: designation?.trim() || null,
                years_experience: yearsExperience ? parseInt(yearsExperience, 10) : null,
            });

        if (facErr) {
            // Rollback user insertion if faculty insert fails
            await supabaseAdmin.from('users').delete().eq('id', newUser.id);
            throw facErr;
        }

        return NextResponse.json({
            success: true,
            faculty: {
                id: newUser.id,
                name: `Prof. ${firstName.trim()} ${lastName.trim()}`,
                email: email.toLowerCase().trim(),
                designation: designation || null,
                yearsExperience: yearsExperience || null,
            },
        });
    } catch (error) {
        console.error('Create Faculty API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const POST = withRole(createFacultyHandler, ['admin']);

async function updateFacultyHandler(request) {
    try {
        const body = await request.json();
        const { facultyId, firstName, lastName, designation, yearsExperience, honorariumRate, department } = body;

        if (!facultyId) {
            return NextResponse.json({ error: 'facultyId is required.' }, { status: 400 });
        }

        // Update users table (name fields)
        const userUpdates = {};
        if (firstName !== undefined) userUpdates.first_name = firstName.trim();
        if (lastName !== undefined) userUpdates.last_name = lastName.trim();

        if (Object.keys(userUpdates).length > 0) {
            const { error: userErr } = await supabaseAdmin
                .from('users')
                .update(userUpdates)
                .eq('id', facultyId);
            if (userErr) throw userErr;
        }

        // Update faculty table (profile fields)
        const facUpdates = {};
        if (designation !== undefined) facUpdates.designation = designation?.trim() || null;
        if (yearsExperience !== undefined) facUpdates.years_experience = yearsExperience !== '' ? parseInt(yearsExperience, 10) : null;
        if (honorariumRate !== undefined) facUpdates.honorarium_rate_per_hour = honorariumRate !== '' ? parseFloat(honorariumRate) : null;
        if (department !== undefined) facUpdates.department = department?.trim() || null;

        if (Object.keys(facUpdates).length > 0) {
            const { error: facErr } = await supabaseAdmin
                .from('faculty')
                .update(facUpdates)
                .eq('id', facultyId);
            if (facErr) throw facErr;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update Faculty API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const PATCH = withRole(updateFacultyHandler, ['admin']);
