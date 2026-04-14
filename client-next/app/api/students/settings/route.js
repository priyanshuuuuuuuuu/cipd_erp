export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

// Default preferences shape — used as fallback if user has none
const DEFAULT_PREFERENCES = {
  notifications: {
    scheduleReminders: true,
    attendanceAlerts: true,
    assignmentDeadlines: true,
    feedbackRequests: true,
    gradeUpdates: false,
    systemAnnouncements: true,
  },
  appearance: {
    theme: 'light',
    fontSize: 'medium',
  },
};

async function getHandler(req) {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('preferences')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Merge stored prefs with defaults so the frontend always gets a full shape
    const stored = user.preferences || {};
    const preferences = {
      notifications: { ...DEFAULT_PREFERENCES.notifications, ...(stored.notifications || {}) },
      appearance: { ...DEFAULT_PREFERENCES.appearance, ...(stored.appearance || {}) },
    };

    return NextResponse.json({ preferences });
  } catch (err) {
    console.error('GET settings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function patchHandler(req) {
  try {
    const body = await req.json();

    // Only allow updating known top-level preference keys
    const allowedKeys = ['notifications', 'appearance'];
    const updates = {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid preference keys provided. Allowed: notifications, appearance' },
        { status: 400 }
      );
    }

    // Fetch current prefs first so we do a deep merge (not a full replace)
    const { data: current } = await supabaseAdmin
      .from('users')
      .select('preferences')
      .eq('id', req.user.id)
      .single();

    const currentPrefs = current?.preferences || {};
    const merged = { ...currentPrefs };

    for (const key of Object.keys(updates)) {
      merged[key] = { ...(currentPrefs[key] || {}), ...updates[key] };
    }

    const { error: updateErr } = await supabaseAdmin
      .from('users')
      .update({ preferences: merged, updated_at: new Date().toISOString() })
      .eq('id', req.user.id);

    if (updateErr) throw updateErr;

    return NextResponse.json({
      message: 'Preferences updated',
      preferences: merged,
    });
  } catch (err) {
    console.error('PATCH settings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);
