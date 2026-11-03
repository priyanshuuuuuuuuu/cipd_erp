export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { faculty, users, sessions, feedbackResponses } from '@/drizzle/schema';
import { eq, and, ne, isNotNull } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';
import { createFaculty } from '@/lib/faculty-service';
import { updateAccount, getAccountContext, getAccountByEmail } from '@/lib/accounts';
import { errorResponse } from '@/lib/sql-ident';

const DEFAULT_RATE = 2000;

async function handler(request) {
    try {
        // Fetch all faculty members with user details
        const facultyList = await db.query.faculty.findMany({
            with: {
                user: {
                    columns: { firstName: true, lastName: true, email: true, isActive: true, role: true }
                }
            }
        });

        // Fetch ALL sessions (all statuses) with course + venue info
        const sessionsData = await db.query.sessions.findMany({
            columns: { id: true, facultyId: true, startTime: true, endTime: true, sessionDate: true, status: true, title: true },
            with: {
                course: { columns: { name: true } },
                venue: { columns: { name: true } }
            }
        });

        // Fetch all feedback ratings grouped by session
        const feedbackRows = await db.query.feedbackResponses.findMany({
            columns: { sessionId: true, rating: true },
            where: isNotNull(feedbackResponses.rating)
        });

        // Build a map: session_id -> avg_rating
        const ratingMap = {};
        (feedbackRows || []).forEach(fb => {
            if (!ratingMap[fb.sessionId]) ratingMap[fb.sessionId] = [];
            ratingMap[fb.sessionId].push(fb.rating);
        });
        const avgRatingMap = {};
        for (const [sid, ratings] of Object.entries(ratingMap)) {
            avgRatingMap[sid] = (ratings.reduce((a, b) => a + b, 0) / ratings.length);
        }

        // Map data to calculate hours and honorarium
        const facultyData = (facultyList || []).map(fac => {
            const facSessions = (sessionsData || []).filter(s => s.facultyId === fac.id);
            const completedSessions = facSessions.filter(s => s.status === 'completed');
            let totalHours = 0;

            const detailedSessions = facSessions.map(s => {
                // Calculate duration in hours
                const start = new Date(`1970-01-01T${s.startTime}Z`);
                const end = new Date(`1970-01-01T${s.endTime}Z`);
                const durationHrs = Math.abs((end - start) / (1000 * 60 * 60));
                const durationMins = durationHrs * 60;

                if (s.status === 'completed') totalHours += durationHrs;

                // Format date safely (avoid timezone issues)
                const [y, m, d] = s.sessionDate.split('-');
                const dObj = new Date(Number(y), Number(m) - 1, Number(d));
                const dateStr = dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

                return {
                    session_id: s.id,
                    date: dateStr,
                    date_raw: s.sessionDate,
                    title: s.title || 'Untitled Session',
                    course: s.course?.name || 'Unknown',
                    venue: s.venue?.name || 'Unknown',
                    duration: `${durationHrs.toFixed(1)}h`,
                    duration_mins: durationMins,
                    status: s.status,
                    avg_rating: avgRatingMap[s.id] ? Math.round(avgRatingMap[s.id] * 10) / 10 : null,
                };
            }).sort((a, b) => b.date_raw.localeCompare(a.date_raw));

            const rate = fac.honorariumRatePerHour || DEFAULT_RATE;

            return {
                id: fac.id,
                firstName: fac.user?.firstName || '',
                lastName: fac.user?.lastName || '',
                email: fac.user?.email || '',
                name: `Prof. ${fac.user?.firstName} ${fac.user?.lastName}`,
                dept: fac.department || fac.designation || 'Faculty',
                designation: fac.designation || '',
                department: fac.department || '',
                yearsExperience: fac.yearsExperience ?? '',
                sessions: completedSessions.length,
                totalSessionCount: facSessions.length,
                hours: totalHours,
                rate,
                honorarium: Math.round(totalHours * rate),
                status: 'Pending',
                sessionDetails: detailedSessions,
                // Bank details
                bankAccountNumber: fac.bankAccountNumber || '',
                bankAccountHolder: fac.bankAccountHolder || '',
                bankIfscCode: fac.bankIfscCode || '',
                bankBranch: fac.bankBranch || '',
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

        const safeEmail = email.toLowerCase().trim();

        const { id: newUserId } = await createFaculty(request.cohortInfo, { firstName, lastName, email: safeEmail, designation, yearsExperience });

        return NextResponse.json({
            success: true,
            faculty: {
                id: newUserId,
                name: `Prof. ${firstName.trim()} ${lastName.trim()}`,
                email: safeEmail,
                designation: designation || null,
                yearsExperience: yearsExperience || null,
            },
        });
    } catch (error) {
        return errorResponse(NextResponse, error, 'Create Faculty API Error');
    }
}

export const POST = withRole(createFacultyHandler, ['admin']);

async function updateFacultyHandler(request) {
    try {
        const body = await request.json();
        const { facultyId, firstName, lastName, email, designation, yearsExperience, honorariumRate, department,
            bankAccountNumber, bankAccountHolder, bankIfscCode, bankBranch } = body;

        if (!facultyId) {
            return NextResponse.json({ error: 'facultyId is required.' }, { status: 400 });
        }

        // Verify that target user exists and has role 'faculty'
        const targetUser = await db.query.users.findFirst({
            columns: { id: true, role: true, email: true },
            where: eq(users.id, facultyId)
        });

        if (!targetUser || targetUser.role !== 'faculty') {
            return NextResponse.json({ error: 'Faculty user not found or does not have role faculty.' }, { status: 404 });
        }

        // Update users table (name & email fields)
        const userUpdates = {};
        if (firstName !== undefined) userUpdates.firstName = firstName.trim();
        if (lastName !== undefined) userUpdates.lastName = lastName.trim();

        if (email !== undefined) {
            const trimmedEmail = email.toLowerCase().trim();
            if (!trimmedEmail) {
                return NextResponse.json({ error: 'Email address cannot be empty.' }, { status: 400 });
            }
            if (trimmedEmail !== targetUser.email) {
                // Emails are unique per person across all cohorts (core.accounts)
                const existing = await getAccountByEmail(trimmedEmail);
                const mine = await getAccountContext(facultyId);
                if (existing && existing.id !== mine?.canonicalId) {
                    return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
                }
                userUpdates.email = trimmedEmail;
            }
        }

        // Prepare faculty table updates (profile fields)
        const facUpdates = {};
        if (designation !== undefined) facUpdates.designation = designation?.trim() || null;
        if (yearsExperience !== undefined) facUpdates.yearsExperience = yearsExperience !== '' ? parseInt(yearsExperience, 10) : null;
        if (honorariumRate !== undefined) facUpdates.honorariumRatePerHour = honorariumRate !== '' ? parseFloat(honorariumRate) : null;
        if (department !== undefined) facUpdates.department = department?.trim() || null;
        
        // Bank detail fields
        if (bankAccountNumber !== undefined) facUpdates.bankAccountNumber = bankAccountNumber?.trim() || null;
        if (bankAccountHolder !== undefined) facUpdates.bankAccountHolder = bankAccountHolder?.trim() || null;
        if (bankIfscCode !== undefined) facUpdates.bankIfscCode = bankIfscCode?.trim()?.toUpperCase() || null;
        if (bankBranch !== undefined) facUpdates.bankBranch = bankBranch?.trim() || null;

        // Name/email belong to the person: update the global account (mirrored to running cohorts)
        if (Object.keys(userUpdates).length > 0) {
            const ctx = await getAccountContext(facultyId);
            await updateAccount(ctx.canonicalId, {
                ...(userUpdates.firstName !== undefined ? { first_name: userUpdates.firstName } : {}),
                ...(userUpdates.lastName !== undefined ? { last_name: userUpdates.lastName } : {}),
                ...(userUpdates.email !== undefined ? { email: userUpdates.email } : {}),
            });
        }

        await db.transaction(async (tx) => {
            if (Object.keys(facUpdates).length > 0) {
                await tx.update(faculty)
                    .set(facUpdates)
                    .where(eq(faculty.id, facultyId));
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update Faculty API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const PATCH = withRole(updateFacultyHandler, ['admin']);
