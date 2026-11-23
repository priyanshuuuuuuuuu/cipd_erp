import { connection } from '@/lib/db';
import { qid } from '@/lib/sql-ident';

export async function qrSession(schema, sessionId) {
  const [row] = await connection.unsafe(
    `SELECT id, course_id, title, session_date::text AS session_date, start_time, end_time, status FROM ${qid(schema)}.sessions WHERE id = $1`, [sessionId]);
  return row;
}

export { qrPhase } from './qr-attendance-window.mjs';
