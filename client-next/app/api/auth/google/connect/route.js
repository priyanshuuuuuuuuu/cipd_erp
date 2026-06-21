import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { withAuth } from '@/lib/middleware';
import { createHmac } from 'crypto';

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
 * Signs the OAuth state payload with HMAC-SHA256 so the callback can
 * verify it hasn't been tampered with (prevents CSRF / account takeover).
 */
function buildSignedState(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = createHmac('sha256', process.env.JWT_SECRET)
                 .update(data)
                 .digest('hex');
  return `${data}.${sig}`;
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

  // Build a signed state — verified in the callback to prevent CSRF
  const state = buildSignedState({ userId: req.user.id, role: req.user.role });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',   // Always prompt — ensures we get a refresh_token
    scope:       SCOPES,
    state,
  });

  return NextResponse.json({ url: authUrl });
}

export const GET = withAuth(handler);
