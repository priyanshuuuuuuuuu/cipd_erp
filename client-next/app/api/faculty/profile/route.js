export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { faculty } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^\d{6,20}$/;

// Faculty can view and edit only their own payout (bank) details. Rate, designation and department stay admin-only.
async function getHandler(req) {
  try {
    const [row] = await db.select({
      bank_account_number: faculty.bankAccountNumber, bank_account_holder: faculty.bankAccountHolder,
      bank_ifsc_code: faculty.bankIfscCode, bank_branch: faculty.bankBranch,
    }).from(faculty).where(eq(faculty.id, req.user.id)).limit(1);
    return NextResponse.json({ bank: row || {} });
  } catch (err) {
    console.error('Faculty profile get error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function patchHandler(req) {
  try {
    const b = await req.json();
    const set = {};
    if (b.bank_account_number !== undefined) {
      const v = String(b.bank_account_number || '').replace(/\s+/g, '');
      if (v && !ACCOUNT_RE.test(v)) return NextResponse.json({ error: 'Account number must be 6-20 digits' }, { status: 400 });
      set.bankAccountNumber = v || null;
    }
    if (b.bank_account_holder !== undefined) {
      const v = String(b.bank_account_holder || '').trim();
      if (v.length > 100) return NextResponse.json({ error: 'Account holder name is too long' }, { status: 400 });
      set.bankAccountHolder = v || null;
    }
    if (b.bank_ifsc_code !== undefined) {
      const v = String(b.bank_ifsc_code || '').trim().toUpperCase();
      if (v && !IFSC_RE.test(v)) return NextResponse.json({ error: 'Invalid IFSC code' }, { status: 400 });
      set.bankIfscCode = v || null;
    }
    if (b.bank_branch !== undefined) {
      const v = String(b.bank_branch || '').trim();
      if (v.length > 100) return NextResponse.json({ error: 'Branch name is too long' }, { status: 400 });
      set.bankBranch = v || null;
    }
    if (!Object.keys(set).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    await db.update(faculty).set(set).where(eq(faculty.id, req.user.id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Faculty profile update error:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['faculty']);
export const PATCH = withRole(patchHandler, ['faculty']);
