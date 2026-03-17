import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';
import { verifyPassword, hashPassword } from '@/lib/auth';

async function handler(req) {
  try {
    if (req.method === 'POST') {
      const { currentPassword, newPassword } = await req.json();

      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: 'Missing password fields' }, { status: 400 });
      }

      // 1. Get the admin's ID directly from the authenticated token context
      const userId = req.user.id;
      console.log('Password Reset: UserID from token =', userId);

      // 2. Fetch the user's current password hash from the custom users table
      const { data: user, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('password_hash, role')
        .eq('id', userId)
        .single();
        
      if (fetchError || !user) {
        console.error('Password Reset: User not found or fetch error:', fetchError);
        return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
      }

      console.log('Password Reset: Found user. Role =', user.role);

      // 3. Verify the current password
      const isValid = await verifyPassword(currentPassword, user.password_hash);
      console.log('Password Reset: isValid result =', isValid);
      
      if (!isValid) {
         return NextResponse.json({ error: 'Invalid current password' }, { status: 401 });
      }

      // 4. Hash the new password and update
      const newHash = await hashPassword(newPassword);

      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ password_hash: newHash, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({ success: true, message: 'Password updated successfully' });
    }

    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (err) {
    console.error('Password reset API error:', err);
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}

export const POST = withRole(handler, ['admin']);
