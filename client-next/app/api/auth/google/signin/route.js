import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

const SCOPES = ['openid', 'email', 'profile'];
const STATE_COOKIE = 'cipd_google_signin_state';

function getAppUrl(request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '');
}

function getOAuthClient(request) {
  const clientId = process.env.GOOGLE_SIGNIN_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_SIGNIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google sign-in is not configured');
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${getAppUrl(request)}/api/auth/google/signin/callback`,
  );
}

/**
 * Starts the student Google sign-in flow. This is intentionally separate from
 * /api/auth/google/connect, which is used only for Google Classroom access.
 */
export async function GET(request) {
  try {
    const state = randomBytes(32).toString('base64url');
    const oauthClient = getOAuthClient(request);
    const authorizeUrl = oauthClient.generateAuthUrl({
      access_type: 'online',
      include_granted_scopes: false,
      prompt: 'select_account',
      scope: SCOPES,
      state,
      // This guides Google's account chooser; the callback still enforces the
      // verified @iiitd.ac.in email address on the server.
      hd: 'iiitd.ac.in',
    });

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: getAppUrl(request).startsWith('https://'),
      path: '/',
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    console.error('[Google sign-in] Unable to start OAuth flow:', error.message);
    return NextResponse.redirect(new URL('/?google_signin=not_configured', getAppUrl(request)));
  }
}