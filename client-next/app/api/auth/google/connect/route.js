import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { withAuth } from '@/lib/middleware';

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  );
}

/**
 * GET /api/auth/google/connect
 *
 * Uses withAuth (Authorization: Bearer header via api helper).
 * Returns JSON { url } instead of redirecting directly, so the
 * client can do window.location.href = url from a button click.
 */
async function handler(req) {
  const oauth2Client = getOAuth2Client();

  // Encode user_id + role into state so callback knows who connected
  const state = Buffer.from(
    JSON.stringify({ userId: req.user.id, role: req.user.role })
  ).toString('base64');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',   // Always prompt — ensures we get a refresh_token
    scope:       SCOPES,
    state,
  });

  return NextResponse.json({ url: authUrl });
}

export const GET = withAuth(handler);
