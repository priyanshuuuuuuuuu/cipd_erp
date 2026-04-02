import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { supabaseAdmin } from '@/lib/supabase';

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  );
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // User denied access
  if (error) {
    return NextResponse.redirect(
      new URL('/dashboard?gc_error=access_denied', process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard?gc_error=missing_params', process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  // Decode state to get ERP user_id
  let userId, role;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    userId = decoded.userId;
    role   = decoded.role || 'student';
  } catch {
    return NextResponse.redirect(
      new URL('/dashboard?gc_error=invalid_state', process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  if (!userId) {
    return NextResponse.redirect(
      new URL('/dashboard?gc_error=no_user', process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.warn('[GC Callback] No refresh_token returned. User may have already authorized.');
    }

    // Build the upsert payload — only include refresh_token if Google returned one
    const upsertData = {
      user_id:      userId,
      role,
      access_token: tokens.access_token,
      expiry_time:  tokens.expiry_date,
      updated_at:   new Date().toISOString(),
    };
    if (tokens.refresh_token) {
      upsertData.refresh_token = tokens.refresh_token;
    }

    // If no refresh_token and no existing row, we can't proceed safely
    if (!tokens.refresh_token) {
      // Check if existing row exists with a refresh_token
      const { data: existing } = await supabaseAdmin
        .from('google_tokens')
        .select('refresh_token')
        .eq('user_id', userId)
        .maybeSingle();

      if (!existing?.refresh_token) {
        // No existing refresh_token either — redirect to reconnect
        console.warn('[GC Callback] No refresh token available at all. User must re-authorize.');
        return NextResponse.redirect(
          new URL(
            role === 'admin'
              ? '/admin/settings?gc_error=no_refresh_token'
              : '/dashboard?gc_error=no_refresh_token',
            process.env.NEXT_PUBLIC_APP_URL
          )
        );
      }
    }

    // Upsert tokens into the google_tokens table
    const { error: dbError } = await supabaseAdmin
      .from('google_tokens')
      .upsert(upsertData, { onConflict: 'user_id', ignoreDuplicates: false });

    if (dbError) {
      console.error('[GC Callback] DB upsert error:', dbError);
      return NextResponse.redirect(
        new URL(
          role === 'admin'
            ? '/admin/settings?gc_error=db_error'
            : '/dashboard?gc_error=db_error',
          process.env.NEXT_PUBLIC_APP_URL
        )
      );
    }

    // Success — redirect based on role
    const redirectPath = role === 'admin' ? '/admin/settings?gc_connected=1' : '/dashboard?gc_connected=1';
    return NextResponse.redirect(
      new URL(redirectPath, process.env.NEXT_PUBLIC_APP_URL)
    );
  } catch (err) {
    console.error('[GC Callback] Token exchange error:', err);
    return NextResponse.redirect(
      new URL('/dashboard?gc_error=token_exchange', process.env.NEXT_PUBLIC_APP_URL)
    );
  }
}
