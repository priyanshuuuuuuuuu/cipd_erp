import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('venues')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return NextResponse.json(data || []);
    } 
    
    if (req.method === 'POST') {
      const { bssid, venue } = await req.json();
      
      const { data, error } = await supabaseAdmin
        .from('venues')
        .insert([{ 
            router_bssid: bssid, 
            name: venue,
            building: 'Default',
            is_active: true
        }])
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (req.method === 'PATCH') {
      const { id, is_active, router_bssid, name } = await req.json();
      
      const updateData = {};
      if (is_active !== undefined) updateData.is_active = is_active;
      if (router_bssid !== undefined) updateData.router_bssid = router_bssid;
      if (name !== undefined) updateData.name = name;

      const { error } = await supabaseAdmin
        .from('venues')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url);
      const id = url.searchParams.get('id');
      
      if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

      const { error } = await supabaseAdmin
        .from('venues')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (err) {
    console.error('BSSID API error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}

export const GET = withRole(handler, ['admin']);
export const POST = withRole(handler, ['admin']);
export const PATCH = withRole(handler, ['admin']);
export const DELETE = withRole(handler, ['admin']);
