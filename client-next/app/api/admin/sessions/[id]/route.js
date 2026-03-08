import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req, { params }) {
  try {
    const { id } = params;
    const { status } = await req.json();

    if (!status || !['scheduled', 'completed', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Valid status required: scheduled, completed, cancelled' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('sessions')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update session error:', error);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // If completed, trigger attendance calculation
    if (status === 'completed') {
      const { error: calcError } = await supabaseAdmin.rpc('calculate_attendance', { p_session: id });
      if (calcError) console.error('Attendance calculation error:', calcError);
    }

    return NextResponse.json({ session: data });
  } catch (err) {
    console.error('Update session error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const PATCH = withRole(handler, ['admin']);
