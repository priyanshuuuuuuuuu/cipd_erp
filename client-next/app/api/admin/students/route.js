export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSchemaClient, getCohortConfig } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { hashPassword } from '@/lib/auth';

/** Resolve and validate schema from request. Returns null if invalid. */
function resolveSchema(req) {
  const { searchParams } = new URL(req.url);
  const requested = searchParams.get('schema') || 'july';
  const { schemas } = getCohortConfig();
  return schemas.includes(requested) ? requested : null;
}

/** Same but reads schema from request body (for POST/PATCH/DELETE with JSON body) */
function resolveSchemaFromBody(body) {
  const requested = body.schema || 'july';
  const { schemas } = getCohortConfig();
  return schemas.includes(requested) ? requested : null;
}

// ─── GET /api/admin/students?schema=july ─────────────────────────────────
async function getHandler(req) {
  try {
    const schema = resolveSchema(req);
    if (!schema) return NextResponse.json({ error: 'Invalid schema' }, { status: 400 });
    const db = getSchemaClient(schema);

    const { data: students, error: stuErr } = await db
      .from('students')
      .select(`
        id,
        enrollment_no,
        program_name,
        mac_address,
        mac_verified,
        device_hash,
        created_at,
        users!inner (
          id,
          first_name,
          last_name,
          email,
          is_active,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (stuErr) throw stuErr;

    const studentIds = (students || []).map(s => s.id);
    const enrollmentMap = {};

    if (studentIds.length > 0) {
      const { data: enrollments } = await db
        .from('course_enrollments')
        .select(`
          student_id,
          course_id,
          enrolled_at,
          courses ( id, name, code )
        `)
        .in('student_id', studentIds);

      (enrollments || []).forEach(e => {
        if (!enrollmentMap[e.student_id]) enrollmentMap[e.student_id] = [];
        enrollmentMap[e.student_id].push({
          course_id: e.course_id,
          course_name: e.courses?.name || 'Unknown',
          course_code: e.courses?.code || '',
          enrolled_at: e.enrolled_at,
        });
      });
    }

    const result = (students || []).map(s => ({
      id: s.id,
      first_name: s.users?.first_name || '',
      last_name: s.users?.last_name || '',
      email: s.users?.email || '',
      is_active: s.users?.is_active ?? true,
      enrollment_no: s.enrollment_no || '',
      program_name: s.program_name || '',
      mac_address: s.mac_address || '',
      mac_verified: s.mac_verified ?? false,
      device_hash: s.device_hash || '',
      created_at: s.created_at,
      courses: enrollmentMap[s.id] || [],
    }));

    return NextResponse.json({ students: result, schema });
  } catch (err) {
    console.error('Students GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/admin/students — body: { ..., schema? } ───────────────────
async function postHandler(req) {
  try {
    const body = await req.json();
    const { first_name, last_name, email, enrollment_no, program_name } = body;
    const schema = resolveSchemaFromBody(body);
    if (!schema) return NextResponse.json({ error: 'Invalid schema' }, { status: 400 });
    const db = getSchemaClient(schema);

    if (!first_name || !last_name || !email) {
      return NextResponse.json({ error: 'First name, last name, and email are required.' }, { status: 400 });
    }

    const { data: existingUser } = await db.from('users').select('id').eq('email', email.toLowerCase().trim()).maybeSingle();
    if (existingUser) return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });

    if (enrollment_no?.trim()) {
      const { data: existingEnroll } = await db.from('students').select('id').eq('enrollment_no', enrollment_no.trim()).maybeSingle();
      if (existingEnroll) return NextResponse.json({ error: 'A student with this enrollment number already exists.' }, { status: 409 });
    }

    const password_hash = await hashPassword('12345678');

    const { data: newUser, error: userErr } = await db
      .from('users')
      .insert({ first_name: first_name.trim(), last_name: last_name.trim(), email: email.toLowerCase().trim(), password_hash, role: 'student', is_active: true })
      .select('id')
      .single();
    if (userErr) throw userErr;

    const { error: stuErr } = await db.from('students').insert({ id: newUser.id, enrollment_no: enrollment_no?.trim() || null, program_name: program_name?.trim() || null });
    if (stuErr) {
      await db.from('users').delete().eq('id', newUser.id);
      throw stuErr;
    }

    return NextResponse.json({ success: true, student: { id: newUser.id, first_name, last_name, email } }, { status: 201 });
  } catch (err) {
    console.error('Students POST error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/admin/students — body: { ..., schema? } ──────────────────
async function patchHandler(req) {
  try {
    const body = await req.json();
    const { student_id, first_name, last_name, email, enrollment_no, program_name, mac_verified, is_active, mac_address } = body;
    const schema = resolveSchemaFromBody(body);
    if (!schema) return NextResponse.json({ error: 'Invalid schema' }, { status: 400 });
    const db = getSchemaClient(schema);

    if (!student_id) return NextResponse.json({ error: 'student_id is required.' }, { status: 400 });

    if (mac_address !== undefined && mac_address !== '' && mac_address !== null) {
      if (!/^([A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2}$/.test(mac_address)) {
        return NextResponse.json({ error: 'Invalid MAC address format. Use XX:XX:XX:XX:XX:XX' }, { status: 400 });
      }
    }

    if (email !== undefined) {
      const { data: conflict } = await db.from('users').select('id').eq('email', email.toLowerCase().trim()).neq('id', student_id).maybeSingle();
      if (conflict) return NextResponse.json({ error: 'This email is already used by another user.' }, { status: 409 });
    }
    if (enrollment_no !== undefined && enrollment_no !== '') {
      const { data: conflict } = await db.from('students').select('id').eq('enrollment_no', enrollment_no.trim()).neq('id', student_id).maybeSingle();
      if (conflict) return NextResponse.json({ error: 'This enrollment number is already taken.' }, { status: 409 });
    }

    const userUpdates = {};
    if (first_name !== undefined) userUpdates.first_name = first_name.trim();
    if (last_name !== undefined) userUpdates.last_name = last_name.trim();
    if (email !== undefined) userUpdates.email = email.toLowerCase().trim();
    if (is_active !== undefined) userUpdates.is_active = Boolean(is_active);

    if (Object.keys(userUpdates).length > 0) {
      const { error: userErr } = await db.from('users').update(userUpdates).eq('id', student_id);
      if (userErr) throw userErr;
    }

    const stuUpdates = {};
    if (enrollment_no !== undefined) stuUpdates.enrollment_no = enrollment_no.trim() || null;
    if (program_name !== undefined) stuUpdates.program_name = program_name.trim() || null;
    if (mac_verified !== undefined) stuUpdates.mac_verified = Boolean(mac_verified);
    if (mac_address !== undefined) {
      if (mac_address === '' || mac_address === null) {
        stuUpdates.mac_address = null;
        stuUpdates.mac_verified = false;
      } else {
        stuUpdates.mac_address = mac_address.toUpperCase();
        stuUpdates.mac_verified = false;
      }
    }

    if (Object.keys(stuUpdates).length > 0) {
      const { error: stuErr } = await db.from('students').update(stuUpdates).eq('id', student_id);
      if (stuErr) throw stuErr;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Students PATCH error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/admin/students — body: { student_id, schema? } ──────────
// Manually deletes all child records first because the public schema does not
// have ON DELETE CASCADE on all FKs (unlike the july schema).
async function deleteHandler(req) {
  try {
    const body = await req.json();
    const { student_id, student_ids } = body;
    const ids = student_ids || (student_id ? [student_id] : []);
    const schema = resolveSchemaFromBody(body);
    if (!schema) return NextResponse.json({ error: 'Invalid schema' }, { status: 400 });
    const db = getSchemaClient(schema);

    if (ids.length === 0) return NextResponse.json({ error: 'student_id or student_ids is required.' }, { status: 400 });

    // 1. Delete attendance_records (references students.id)
    const { error: arErr } = await db.from('attendance_records').delete().in('student_id', ids);
    if (arErr) throw new Error(`attendance_records: ${arErr.message}`);

    // 2. Delete feedback_responses (references students.id)
    const { error: frErr } = await db.from('feedback_responses').delete().in('student_id', ids);
    if (frErr) throw new Error(`feedback_responses: ${frErr.message}`);

    // 3. Delete assignment_submissions (references students.id)
    const { error: asErr } = await db.from('assignment_submissions').delete().in('student_id', ids);
    if (asErr) throw new Error(`assignment_submissions: ${asErr.message}`);

    // 4. Delete course_enrollments (references students.id)
    const { error: ceErr } = await db.from('course_enrollments').delete().in('student_id', ids);
    if (ceErr) throw new Error(`course_enrollments: ${ceErr.message}`);

    // 5. Delete notifications (references users.id as recipient)
    const { error: notifErr } = await db.from('notifications').delete().in('recipient_id', ids);
    if (notifErr) throw new Error(`notifications: ${notifErr.message}`);

    // 6. Delete the students row (references users.id)
    const { error: stuErr } = await db.from('students').delete().in('id', ids);
    if (stuErr) throw new Error(`students: ${stuErr.message}`);

    // 7. Finally delete the users row
    const { error: userErr } = await db.from('users').delete().in('id', ids);
    if (userErr) throw new Error(`users: ${userErr.message}`);

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (err) {
    console.error('Students DELETE error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
export const POST = withRole(postHandler, ['admin']);
export const PATCH = withRole(patchHandler, ['admin']);
export const DELETE = withRole(deleteHandler, ['admin']);
