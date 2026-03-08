import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withRole } from '@/lib/middleware';

async function getHandler(req) {
  try {
    const { data: questions, error } = await supabaseAdmin
      .from('feedback_questions')
      .select('id, question, category, type, active, created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ questions: questions || [] });
  } catch (err) {
    console.error('Feedback questions error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function postHandler(req) {
  try {
    const { question, category, type, active } = await req.json();

    if (!question || !type) {
      return NextResponse.json({ error: 'question and type are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('feedback_questions')
      .insert({
        question,
        category: category || null,
        type,
        active: active !== false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ question: data }, { status: 201 });
  } catch (err) {
    console.error('Create question error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function patchHandler(req) {
  try {
    const { id, question, category, type, active } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'question id is required' }, { status: 400 });
    }

    const updates = {};
    if (question !== undefined) updates.question = question;
    if (category !== undefined) updates.category = category;
    if (type !== undefined) updates.type = type;
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabaseAdmin
      .from('feedback_questions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ question: data });
  } catch (err) {
    console.error('Update question error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function deleteHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'question id is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('feedback_questions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Question deleted' });
  } catch (err) {
    console.error('Delete question error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withRole(getHandler, ['admin']);
export const POST = withRole(postHandler, ['admin']);
export const PATCH = withRole(patchHandler, ['admin']);
export const DELETE = withRole(deleteHandler, ['admin']);
