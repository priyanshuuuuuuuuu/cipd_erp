import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { signToken } from '@/lib/auth';

const STATE_COOKIE = 'cipd_google_signin_state';
const RESULT_COOKIE = 'cipd_google_signin_result';

function getAppUrl(request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '');
}

function redirectToLogin(request, outcome) {
  const response = NextResponse.redirect(new URL(`/?google_signin=${outcome}`, getAppUrl(request)));
  response.cookies.set(STATE_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}

function hasMatchingState(expected, received) {
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length
    && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function getOAuthClient(request) {
  const clientId = process.env.GOOGLE_SIGNIN_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_SIGNIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google sign-in is not configured');

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${getAppUrl(request)}/api/auth/google/signin/callback`,
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const providerError = searchParams.get('error');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (providerError) return redirectToLogin(request, 'cancelled');
  if (!code || !hasMatchingState(request.cookies.get(STATE_COOKIE)?.value, state)) {
    return redirectToLogin(request, 'invalid_request');
  }

  try {
    const oauthClient = getOAuthClient(request);
    const { tokens } = await oauthClient.getToken(code);
    if (!tokens.id_token) return redirectToLogin(request, 'invalid_account');

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_SIGNIN_CLIENT_ID,
    });
    const profile = ticket.getPayload();
    const email = profile?.email?.trim().toLowerCase();

    if (!profile?.email_verified || !email?.endsWith('@iiitd.ac.in')) {
      return redirectToLogin(request, 'iiitd_only');
    }

    // Google identity alone is not an ERP account. A matching active student
    // record is required, so no account is created implicitly by this route.
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, first_name, last_name, is_active')
      .eq('email', email)
      .eq('role', 'student')
      .maybeSingle();

    if (error) throw error;
    if (!user || !user.is_active) return redirectToLogin(request, 'not_eligible');

    const authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
    };
    const token = signToken(authUser);
    const response = NextResponse.redirect(new URL('/?google_signin=success', getAppUrl(request)));

    // The regular auth token is never placed in a URL. The short-lived,
    // httpOnly hand-off cookie is read once by the login page and cleared.
    response.cookies.set(RESULT_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: getAppUrl(request).startsWith('https://'),
      path: '/',
      maxAge: 60,
    });
    response.cookies.set(STATE_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    console.error('[Google sign-in] Callback failed:', error.message);
    return redirectToLogin(request, 'failed');
  }
}