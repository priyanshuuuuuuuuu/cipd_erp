export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { hashPassword } from '@/lib/auth';

// ─── GET /api/admin/students ───────────────────────────────────────────────
// Returns all students with user data, enrollment count, and courses list.
async function getHandler(req) {
  try {
    // Fetch all students joined with users
    const { data: students, error: stuErr } = await supabaseAdmin
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

    // Fetch all course enrollments for these students
    const studentIds = (students || []).map(s => s.id);

    let enrollmentMap = {};
    if (studentIds.length > 0) {
      const { data: enrollments } = await supabaseAdmin
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

    return NextResponse.json({ students: result });
  } catch (err) {
    console.error('Students GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/admin/students ─────────────────────────────────────────────
// Creates a new student (user + students row). Default password: 12345678
async function postHandler(req) {
  try {
    const body = await req.json();
    const { first_name, last_name, email, enrollment_no, program_name } = body;

    if (!first_name || !last_name || !email) {
      return NextResponse.json({ error: 'First name, last name, and email are required.' }, { status: 400 });
    }

    // Check for duplicate email
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
    }

    // Check for duplicate enrollment_no if provided
    if (enrollment_no?.trim()) {
      const { data: existingEnroll } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('enrollment_no', enrollment_no.trim())
        .maybeSingle();

      if (existingEnroll) {
        return NextResponse.json({ error: 'A student with this enrollment number already exists.' }, { status: 409 });
      }
    }

    // Hash default password
    const password_hash = await hashPassword('12345678');

    // Insert into users
    const { data: newUser, error: userErr } = await supabaseAdmin
      .from('users')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.toLowerCase().trim(),
        password_hash,
        role: 'student',
        is_active: true,
      })
      .select('id')
      .single();

    if (userErr) throw userErr;

    // Insert into students
    const { error: stuErr } = await supabaseAdmin
      .from('students')
      .insert({
        id: newUser.id,
        enrollment_no: enrollment_no?.trim() || null,
        program_name: program_name?.trim() || null,
      });

    if (stuErr) {
      // Rollback user if student insert fails
      await supabaseAdmin.from('users').delete().eq('id', newUser.id);
      throw stuErr;
    }

    return NextResponse.json({
      success: true,
      student: { id: newUser.id, first_name, last_name, email },
    }, { status: 201 });
  } catch (err) {
    console.error('Students POST error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/admin/students ────────────────────────────────────────────
// Update student details.
// Body: { student_id, first_name?, last_name?, email?, enrollment_no?, program_name?, mac_verified?, is_active? }
async function patchHandler(req) {
  try {
    const body = await req.json();
    const { student_id, first_name, last_name, email, enrollment_no, program_name, mac_verified, is_active } = body;

    if (!student_id) {
      return NextResponse.json({ error: 'student_id is required.' }, { status: 400 });
    }

    // If email is being changed, check for conflicts
    if (email !== undefined) {
      const { data: conflict } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .neq('id', student_id)
        .maybeSingle();
      if (conflict) {
        return NextResponse.json({ error: 'This email is already used by another user.' }, { status: 409 });
      }
    }

    // If enrollment_no is being changed, check for conflicts
    if (enrollment_no !== undefined && enrollment_no !== '') {
      const { data: conflict } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('enrollment_no', enrollment_no.trim())
        .neq('id', student_id)
        .maybeSingle();
      if (conflict) {
        return NextResponse.json({ error: 'This enrollment number is already taken.' }, { status: 409 });
      }
    }

    // Update users table
    const userUpdates = {};
    if (first_name !== undefined) userUpdates.first_name = first_name.trim();
    if (last_name !== undefined) userUpdates.last_name = last_name.trim();
    if (email !== undefined) userUpdates.email = email.toLowerCase().trim();
    if (is_active !== undefined) userUpdates.is_active = Boolean(is_active);

    if (Object.keys(userUpdates).length > 0) {
      const { error: userErr } = await supabaseAdmin
        .from('users')
        .update(userUpdates)
        .eq('id', student_id);
      if (userErr) throw userErr;
    }

    // Update students table
    const stuUpdates = {};
    if (enrollment_no !== undefined) stuUpdates.enrollment_no = enrollment_no.trim() || null;
    if (program_name !== undefined) stuUpdates.program_name = program_name.trim() || null;
    if (mac_verified !== undefined) stuUpdates.mac_verified = Boolean(mac_verified);

    if (Object.keys(stuUpdates).length > 0) {
      const { error: stuErr } = await supabaseAdmin
        .from('students')
        .update(stuUpdates)
        .eq('id', student_id);
      if (stuErr) throw stuErr;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Students PATCH error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/admin/students ───────────────────────────────────────────
// Deletes a student. Cascade via users FK removes students row + all related records.
// Body: { student_id }
async function deleteHandler(req) {
  try {
    const body = await req.json();
    const { student_id } = body;

    if (!student_id) {
      return NextResponse.json({ error: 'student_id is required.' }, { status: 400 });
    }

    // Deleting the user cascades to students, attendance_records, etc.
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', student_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Students DELETE error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
export const POST = withRole(postHandler, ['admin']);
export const PATCH = withRole(patchHandler, ['admin']);
export const DELETE = withRole(deleteHandler, ['admin']);
