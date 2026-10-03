export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { venues } from '@/drizzle/schema';
import { eq, asc } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

async function handler(req) {
  try {
    if (req.method === 'GET') {
      const rows = await db
        .select({
          id: venues.id,
          name: venues.name,
          building: venues.building,
          router_bssid: venues.routerBssid,
          created_at: venues.createdAt,
          is_active: venues.isActive,
        })
        .from(venues)
        .orderBy(asc(venues.createdAt));

      return NextResponse.json(rows || []);
    } 
    
    if (req.method === 'POST') {
      const { bssid, venue } = await req.json();
      
      const [data] = await db
        .insert(venues)
        .values({ 
          routerBssid: bssid, 
          name: venue,
          building: 'Default',
          isActive: true,
        })
        .returning({
          id: venues.id,
          name: venues.name,
          building: venues.building,
          router_bssid: venues.routerBssid,
          created_at: venues.createdAt,
          is_active: venues.isActive,
        });

      return NextResponse.json({ success: true, data });
    }

    if (req.method === 'PATCH') {
      const { id, is_active, router_bssid, name } = await req.json();
      
      const updateData = {};
      if (is_active !== undefined) updateData.isActive = is_active;
      if (router_bssid !== undefined) updateData.routerBssid = router_bssid;
      if (name !== undefined) updateData.name = name;

      await db
        .update(venues)
        .set(updateData)
        .where(eq(venues.id, id));

      return NextResponse.json({ success: true });
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url);
      const id = url.searchParams.get('id');
      
      if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

      await db
        .delete(venues)
        .where(eq(venues.id, id));

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
