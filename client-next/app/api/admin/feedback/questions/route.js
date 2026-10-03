export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { feedbackQuestions } from '@/drizzle/schema';
import { eq, asc } from 'drizzle-orm';
import { withRole } from '@/lib/middleware';

async function getHandler(req) {
  try {
    const questions = await db.query.feedbackQuestions.findMany({
      columns: { id: true, question: true, category: true, type: true, active: true, createdAt: true },
      orderBy: [asc(feedbackQuestions.createdAt)]
    });

    const mapped = questions.map(q => ({
      ...q,
      created_at: q.createdAt
    }));

    return NextResponse.json({ questions: mapped });
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

    const [data] = await db.insert(feedbackQuestions)
      .values({
        question,
        category: category || null,
        type,
        active: active !== false,
      })
      .returning();

    return NextResponse.json({ question: { ...data, created_at: data.createdAt } }, { status: 201 });
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

    const [data] = await db.update(feedbackQuestions)
      .set(updates)
      .where(eq(feedbackQuestions.id, id))
      .returning();

    return NextResponse.json({ question: { ...data, created_at: data.createdAt } });
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

    await db.delete(feedbackQuestions).where(eq(feedbackQuestions.id, id));

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
