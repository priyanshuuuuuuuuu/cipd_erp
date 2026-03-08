import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { mac_address } = await req.json();

    if (!mac_address || !/^([A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2}$/.test(mac_address)) {
      return NextResponse.json({ error: 'Invalid MAC address format. Use XX:XX:XX:XX:XX:XX' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('students')
      .update({
        mac_address: mac_address.toUpperCase(),
        mac_verified: false,
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('MAC update error:', error);
      return NextResponse.json({ error: 'Failed to update MAC address' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'MAC address updated successfully',
      mac_address: data.mac_address,
      mac_verified: data.mac_verified,
    });
  } catch (err) {
    console.error('MAC update error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const PATCH = withAuth(handler);
