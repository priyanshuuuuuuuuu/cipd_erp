export const dynamic = 'force-dynamic';
import { withRole } from '@/lib/middleware';
import { sessionsByDateHandler } from '@/lib/attendance/sessions-by-date';

export const GET = withRole(sessionsByDateHandler, ['admin']);
