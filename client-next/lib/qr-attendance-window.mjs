/** Determine the scan window from a PostgreSQL date and India-time class times. */
export function qrPhase(session, now = Date.now()) {
  if (!session || session.status === 'cancelled') return null;
  const date = session.session_date instanceof Date
    ? session.session_date.toISOString().slice(0, 10)
    : String(session.session_date).slice(0, 10);
  const start = Date.parse(`${date}T${session.start_time}+05:30`);
  const end = Date.parse(`${date}T${session.end_time}+05:30`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  if (now >= start && now < Math.min(start + 5 * 60000, end)) return 'start';
  if (now >= end && now < end + 15 * 60000) return 'end';
  return null;
}
