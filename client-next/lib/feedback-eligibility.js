/** Attendance statuses that qualify a student for session feedback. */
export const ATTENDED_STATUSES = ['present', 'partial'];

/**
 * Returns true if the student was marked present or partial for the session.
 */
export async function isStudentEligibleForSessionFeedback(supabaseAdmin, studentId, sessionId) {
  const { data: record } = await supabaseAdmin
    .from('attendance_records')
    .select('status')
    .eq('session_id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle();

  return !!record && ATTENDED_STATUSES.includes(record.status);
}

/**
 * Session IDs where the student has present/partial attendance.
 */
export async function getEligibleSessionIdsForStudent(supabaseAdmin, studentId) {
  const { data: rows } = await supabaseAdmin
    .from('attendance_records')
    .select('session_id')
    .eq('student_id', studentId)
    .in('status', ATTENDED_STATUSES);

  return [...new Set((rows || []).map((r) => r.session_id))];
}

/**
 * Returns a map of session_id → count of students with present/partial attendance.
 */
export async function getAttendedCountBySession(supabaseAdmin, sessionIds = null) {
  let query = supabaseAdmin
    .from('attendance_records')
    .select('session_id')
    .in('status', ATTENDED_STATUSES);

  if (sessionIds && sessionIds.length > 0) {
    query = query.in('session_id', sessionIds);
  }

  const { data: rows } = await query;
  const counts = {};
  (rows || []).forEach((r) => {
    counts[r.session_id] = (counts[r.session_id] || 0) + 1;
  });
  return counts;
}
