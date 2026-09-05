import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  );
}

/**
 * GET /api/classroom/assignments
 *
 * Fetches pending Google Classroom assignments for the logged-in student.
 *
 * Architecture:
 *  - The ADMIN has connected their Google Classroom account (priyanshupandeynov18@gmail.com).
 *  - We use the admin's stored token to list all courses + all assignments.
 *  - We return assignments to any authenticated student (no per-student GC login needed).
 *  - Students just see what the teacher/admin has published.
 *
 * If the admin has NOT connected yet, connected: false is returned.
 */
async function handler(req) {
  // --- 1. Find admin's Google token ---
  // Look up the token stored for the admin user
  const { data: adminTokenRow, error: tokenErr } = await supabaseAdmin
    .from('google_tokens')
    .select('user_id, access_token, refresh_token, expiry_time')
    .eq('role', 'admin')   // we'll store role alongside the token
    .limit(1)
    .maybeSingle();

  if (tokenErr || !adminTokenRow) {
    // Admin has not connected Google Classroom yet
    return NextResponse.json({ connected: false, assignments: [] }, { status: 200 });
  }

  // --- 2. Set up OAuth2 with admin's token ---
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token:  adminTokenRow.access_token,
    refresh_token: adminTokenRow.refresh_token,
    expiry_date:   adminTokenRow.expiry_time,
  });

  // Auto-save refreshed tokens
  oauth2Client.on('tokens', async (newTokens) => {
    const update = { updated_at: new Date().toISOString() };
    if (newTokens.access_token)  update.access_token  = newTokens.access_token;
    if (newTokens.expiry_date)   update.expiry_time   = newTokens.expiry_date;
    if (newTokens.refresh_token) update.refresh_token = newTokens.refresh_token;
    await supabaseAdmin
      .from('google_tokens')
      .update(update)
      .eq('user_id', adminTokenRow.user_id);
  });

  const classroom = google.classroom({ version: 'v1', auth: oauth2Client });

  try {
    // --- 3. List all active courses this teacher owns/teaches ---
    const coursesRes = await classroom.courses.list({
      teacherId: 'me',           // Courses where admin is the teacher
      courseStates: ['ACTIVE'],
      pageSize: 20,
    });

    const courses = coursesRes.data.courses || [];

    if (courses.length === 0) {
      return NextResponse.json({ connected: true, assignments: [] });
    }

    // --- 4. Fetch published assignments from all courses ---
    const allAssignments = [];

    await Promise.all(
      courses.map(async (course) => {
        try {
            const cwRes = await classroom.courses.courseWork.list({
            courseId:         course.id,
            courseWorkStates: ['PUBLISHED'],
            orderBy:          'dueDate asc',
            pageSize:         20,
          });

          const items = cwRes.data.courseWork || [];
          if (items.length === 0) return;

          // Fetch submissions for the logged-in student in this course
          const turnedInIds = new Set();
          try {
            const subRes = await classroom.courses.courseWork.studentSubmissions.list({
              courseId: course.id,
              courseWorkId: '-', // "-" means across all courseWork in the course
              userId: req.user.email, // Look up exactly this student's submissions
            });
            const submissions = subRes.data.studentSubmissions || [];
            submissions.forEach(sub => {
              // TURNED_IN = submitted, RETURNED = graded and sent back
              if (sub.state === 'TURNED_IN' || sub.state === 'RETURNED') {
                turnedInIds.add(sub.courseWorkId);
              }
            });
          } catch (subErr) {
            console.warn(`[GC] Could not fetch submissions for ${req.user.email}:`, subErr.message);
            // If student isn't in classroom or email doesn't match, we safely proceed without filtering
          }

          for (const cw of items) {
            if (cw.workType !== 'ASSIGNMENT') continue;

            // Goal 1: Skip if student already submitted it
            if (turnedInIds.has(cw.id)) continue;

            // Parse due date
            let dueDate = null;
            if (cw.dueDate) {
              const { year, month, day } = cw.dueDate;
              const hour   = cw.dueTime?.hours || 23;
              const minute = cw.dueTime?.minutes || 59;
              dueDate = new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString();
            }

            // Goal 2: Skip assignments where the deadline is crossed
            if (dueDate) {
              const dueMs = new Date(dueDate).getTime();
              if (Date.now() > dueMs) continue;
            }

            allAssignments.push({
              id:            cw.id,
              title:         cw.title,
              description:   cw.description || '',
              courseName:    course.name,
              courseId:      course.id,
              dueDate,
              alternateLink: cw.alternateLink,
              maxPoints:     cw.maxPoints || null,
              source:        'google_classroom',
            });
          }
        } catch (courseErr) {
          console.warn(`[GC] Error fetching course ${course.id}:`, courseErr.message);
        }
      })
    );

    // Sort by due date
    allAssignments.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

    return NextResponse.json({ connected: true, assignments: allAssignments });

  } catch (err) {
    console.error('[GC Assignments] Error:', err.message);

    // Token invalid — clear it so admin know to reconnect
    if (err.code === 401 || err.status === 401 || err.message?.includes('invalid_grant')) {
      await supabaseAdmin
        .from('google_tokens')
        .delete()
        .eq('user_id', adminTokenRow.user_id);

      return NextResponse.json({ connected: false, assignments: [], adminMustReconnect: true });
    }

    return NextResponse.json({ error: 'Failed to fetch Google Classroom data' }, { status: 500 });
  }
}

export const GET = withAuth(handler);
