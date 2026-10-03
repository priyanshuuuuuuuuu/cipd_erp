import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { googleTokens } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { createHmac, timingSafeEqual } from 'crypto';

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  );
}

/**
 * Verifies and decodes the HMAC-signed OAuth state.
 * Returns the decoded payload, or null if the signature is invalid.
 */
function verifySignedState(state) {
  try {
    const dotIndex = state.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const data = state.slice(0, dotIndex);
    const sig  = state.slice(dotIndex + 1);

    const expectedSig = createHmac('sha256', process.env.JWT_SECRET)
                          .update(data)
                          .digest('hex');

    // Constant-time comparison prevents timing attacks
    const sigBuf      = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    return JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
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

  // Verify the signed state — rejects forged / tampered state parameters
  let userId, role;
  const decoded = verifySignedState(state);
  if (!decoded || !decoded.userId) {
    return NextResponse.redirect(
      new URL('/dashboard?gc_error=invalid_state', process.env.NEXT_PUBLIC_APP_URL)
    );
  }
  userId = decoded.userId;
  role   = decoded.role || 'student';

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.warn('[GC Callback] No refresh_token returned. User may have already authorized.');
    }

    // Build the upsert payload — only include refresh_token if Google returned one
    const upsertData = {
      userId,
      role,
      accessToken: tokens.access_token,
      expiryTime: tokens.expiry_date,
      updatedAt: new Date().toISOString(),
    };
    if (tokens.refresh_token) {
      upsertData.refreshToken = tokens.refresh_token;
    }

    // If no refresh_token and no existing row, we can't proceed safely
    if (!tokens.refresh_token) {
      // Check if existing row exists with a refresh_token
      const [existing] = await db
        .select({ refreshToken: googleTokens.refreshToken })
        .from(googleTokens)
        .where(eq(googleTokens.userId, userId))
        .limit(1);

      if (!existing?.refreshToken) {
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
    await db
      .insert(googleTokens)
      .values(upsertData)
      .onConflictDoUpdate({
        target: googleTokens.userId,
        set: upsertData,
      });

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

