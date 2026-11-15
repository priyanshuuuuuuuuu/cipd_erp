export const dynamic = 'force-dynamic';
import { withRole } from '@/lib/middleware';
import { sessionStudentsHandler } from '@/lib/attendance/session-students';

export const GET = withRole(sessionStudentsHandler, ['admin']);
