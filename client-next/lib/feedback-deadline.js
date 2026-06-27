const IST_OFFSET = '+05:30';
const DEFAULT_DEADLINE_HOURS = 24;

/**
 * Computes feedback deadline for a session.
 * Default: 24h after session end (IST). Override via sessions.feedback_deadline.
 *
 * @param {{ session_date: string, end_time?: string|null, feedback_deadline?: string|null }} session
 * @returns {Date}
 */
export function getFeedbackDeadline(session) {
  if (session.feedback_deadline) {
    return new Date(session.feedback_deadline);
  }
  const endTime = session.end_time || '23:59:00';
  const deadline = new Date(`${session.session_date}T${endTime}${IST_OFFSET}`);
  deadline.setHours(deadline.getHours() + DEFAULT_DEADLINE_HOURS);
  return deadline;
}

/**
 * @param {{ session_date: string, end_time?: string|null, feedback_deadline?: string|null }} session
 * @param {Date} [now]
 */
export function isFeedbackExpired(session, now = new Date()) {
  return now > getFeedbackDeadline(session);
}

/**
 * @param {{ session_date: string, end_time?: string|null, feedback_deadline?: string|null }} session
 * @param {Date} [now]
 */
export function getFeedbackHoursLeft(session, now = new Date()) {
  const deadline = getFeedbackDeadline(session);
  return Math.max(0, Math.round(((deadline - now) / 3600000) * 10) / 10);
}
