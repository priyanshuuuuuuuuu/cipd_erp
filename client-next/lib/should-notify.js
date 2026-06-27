/** @typedef {'scheduleReminders'|'attendanceAlerts'|'assignmentDeadlines'|'feedbackRequests'|'gradeUpdates'|'systemAnnouncements'} NotificationPrefKey */

export const DEFAULT_NOTIFICATION_PREFS = {
  scheduleReminders: true,
  attendanceAlerts: true,
  assignmentDeadlines: true,
  feedbackRequests: true,
  gradeUpdates: false,
  systemAnnouncements: true,
};

/** @type {Record<string, NotificationPrefKey>} */
const TYPE_TO_PREF = {
  class_reminder: 'scheduleReminders',
  feedback_available: 'feedbackRequests',
  feedback_deadline_reminder: 'feedbackRequests',
  feedback_reminder: 'feedbackRequests',
  general: 'systemAnnouncements',
  schedule_change: 'systemAnnouncements',
  attendance_warning: 'attendanceAlerts',
  grade_update: 'gradeUpdates',
};

/**
 * @param {Record<string, unknown> | null | undefined} preferences
 * @param {string} type
 * @returns {boolean}
 */
export function shouldNotify(preferences, type) {
  const key = TYPE_TO_PREF[type] || 'systemAnnouncements';
  const stored = /** @type {Record<string, boolean>} */ (preferences?.notifications ?? {});
  const merged = { ...DEFAULT_NOTIFICATION_PREFS, ...stored };
  return merged[key] !== false;
}

/**
 * Batch-fetch user preferences for notification gating.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string[]} userIds
 * @returns {Promise<Map<string, Record<string, unknown>>>}
 */
export async function fetchPreferencesMap(supabaseAdmin, userIds) {
  const map = new Map();
  if (!userIds?.length) return map;

  const unique = [...new Set(userIds.filter(Boolean))];
  const { data } = await supabaseAdmin
    .from('users')
    .select('id, preferences')
    .in('id', unique);

  for (const row of data || []) {
    map.set(row.id, row.preferences || {});
  }
  return map;
}

/**
 * @param {Map<string, Record<string, unknown>>} prefMap
 * @param {string} userId
 * @param {string} type
 * @returns {boolean}
 */
export function shouldNotifyUser(prefMap, userId, type) {
  return shouldNotify(prefMap.get(userId) || {}, type);
}

/**
 * @param {Array<{ recipient_id?: string }>} notifications
 * @param {Map<string, Record<string, unknown>>} prefMap
 * @param {string} type
 * @returns {Array<{ recipient_id?: string }>}
 */
export function filterNotificationsByPrefs(notifications, prefMap, type) {
  return notifications.filter(
    (n) => n.recipient_id && shouldNotifyUser(prefMap, n.recipient_id, type)
  );
}
