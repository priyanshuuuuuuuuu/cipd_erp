/**
 * ist-date.js
 * -----------
 * Server-side date helpers that always operate in IST (Asia/Kolkata, UTC+05:30).
 *
 * Next.js API routes run in UTC on the server.  Calling `new Date()` gives a
 * UTC-based Date, so `.toISOString().split('T')[0]` returns the UTC calendar
 * date — which is one day *behind* IST between 00:00–05:29 IST.
 *
 * All helpers here add the IST offset (+5 h 30 min) before any date maths so
 * that "today", "this week", and "this month" always match the IST wall-clock.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30 in milliseconds

/**
 * Returns a Date whose internal UTC value has been shifted so that
 * getFullYear() / getMonth() / getDate() / getHours() / getMinutes()
 * all reflect the current IST wall-clock time.
 *
 * ⚠️  Do NOT pass this to toISOString() and expect a real timestamp —
 *     use it only for calendar arithmetic (year/month/date extraction).
 */
export function getISTNow() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/**
 * Returns today's date string in IST as "YYYY-MM-DD".
 */
export function getISTDateString() {
  return getISTNow().toISOString().split('T')[0];
}

/**
 * Returns { start, end } as "YYYY-MM-DD" strings for the current IST week
 * (Monday → Sunday).
 */
export function getISTWeekRange() {
  const now = getISTNow();
  const dayOfWeek = now.getUTCDay(); // 0 = Sun, 1 = Mon, …
  // Days since Monday (treat Sunday as day 7)
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysSinceMonday);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    start: monday.toISOString().split('T')[0],
    end:   sunday.toISOString().split('T')[0],
  };
}

/**
 * Returns the first day of the current IST month as "YYYY-MM-DD".
 */
export function getISTMonthStart() {
  const now = getISTNow();
  // Zero-pad month
  const yyyy = now.getUTCFullYear();
  const mm   = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

/**
 * Returns a "HH:MM:SS" string for the current IST wall-clock time.
 * Useful for comparing against stored `start_time` / `end_time` columns.
 */
export function getISTTimeString() {
  const now = getISTNow();
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
