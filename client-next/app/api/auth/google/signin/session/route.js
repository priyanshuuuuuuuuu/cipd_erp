import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const RESULT_COOKIE = 'cipd_google_signin_result';

export async function GET(request) {
  const token = request.cookies.get(RESULT_COOKIE)?.value;
  const user = token ? verifyToken(token) : null;
  const response = user
    ? NextResponse.json({ token, user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    } })
    : NextResponse.json({ error: 'Google sign-in session expired' }, { status: 401 });

  response.cookies.set(RESULT_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}