export const dynamic = 'force-dynamic';
import { withRole } from '@/lib/middleware';
import { sessionsByDateHandler } from '@/lib/attendance/sessions-by-date';

// Same data as the admin attendance page, restricted to the caller's own sessions.
async function handler(req) {
  req.facultyScope = req.user.id;
  return sessionsByDateHandler(req);
}

export const GET = withRole(handler, ['faculty']);
