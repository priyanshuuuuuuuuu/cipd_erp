export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/middleware';

async function handler(req) {
  try {
    const { mac_address } = await req.json();

    if (!mac_address || !/^([A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2}$/.test(mac_address)) {
      return NextResponse.json({ error: 'Invalid MAC address format. Use XX:XX:XX:XX:XX:XX' }, { status: 400 });
    }

    const [data] = await db
      .update(students)
      .set({
        macAddress: mac_address.toUpperCase(),
        macVerified: false,
      })
      .where(eq(students.id, req.user.id))
      .returning({
        mac_address: students.macAddress,
        mac_verified: students.macVerified,
      });

    if (!data) {
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
