export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    // ── GET: list all pending MAC approval requests ──────────────────────────
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('students')
        .select(`
          id,
          enrollment_no,
          mac_address,
          mac_verified,
          users ( first_name, last_name, email )
        `)
        .not('mac_address', 'is', null)
        .eq('mac_verified', false)
        .order('enrollment_no', { ascending: true });

      if (error) throw error;

      const pending = (data || []).map((s) => ({
        id: s.id,
        enrollment_no: s.enrollment_no,
        mac_address: s.mac_address,
        mac_verified: s.mac_verified,
        name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim() || 'Unknown',
        email: s.users?.email || '',
      }));

      return NextResponse.json({ pending });
    }

    // ── PATCH: approve or reject a MAC address ────────────────────────────────
    if (req.method === 'PATCH') {
      const { studentId, action } = await req.json();

      if (!studentId || !['approve', 'reject'].includes(action)) {
        return NextResponse.json(
          { error: 'Invalid request. Provide studentId and action (approve|reject).' },
          { status: 400 }
        );
      }

      let updatePayload;
      if (action === 'approve') {
        // Mark the MAC as verified — student portal will immediately show "Verified & Active"
        updatePayload = { mac_verified: true };
      } else {
        // Reject: clear the MAC so the student must re-register
        updatePayload = { mac_address: null, mac_verified: false };
      }

      const { error } = await supabaseAdmin
        .from('students')
        .update(updatePayload)
        .eq('id', studentId);

      if (error) throw error;

      return NextResponse.json({ success: true, action });
    }

    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (err) {
    console.error('MAC approvals API error:', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}

export const GET   = withRole(handler, ['admin']);
export const PATCH = withRole(handler, ['admin']);
