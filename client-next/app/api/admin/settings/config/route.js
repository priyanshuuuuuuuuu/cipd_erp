import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('system_settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is multiple (or no) rows returned
        throw error;
      }
      return NextResponse.json(data || {});
    } 
    
    if (req.method === 'PUT') {
      const body = await req.json();
      
      const { scannerInterval, minSignal } = body;

      const updatePayload = {
        updated_at: new Date().toISOString()
      };
      if (scannerInterval !== undefined) {
        updatePayload.scanner_interval_minutes = scannerInterval;
        updatePayload.ping_interval = scannerInterval; // keep old column in sync
      }
      if (minSignal !== undefined) {
        updatePayload.min_signal = minSignal;
        updatePayload.presence_threshold = minSignal; // keep old column in sync
      }

      const { data, error } = await supabaseAdmin
        .from('system_settings')
        .update(updatePayload)
        .eq('id', 1)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (err) {
    console.error('Config API error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
export const PUT = withRole(handler, ['admin']);
