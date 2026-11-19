export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { connection } from '@/lib/db';
import { withRole } from '@/lib/middleware';
import { HttpError, errorResponse } from '@/lib/sql-ident';

const KINDS = ['faculty_designation', 'faculty_department'];
const MAX_OPTIONS = 100;
const MAX_LEN = 120;

function parseKind(value) {
  if (!KINDS.includes(value)) throw new HttpError(400, 'Unknown option list.');
  return value;
}

async function listKind(sql, kind) {
  const rows = await sql`SELECT value FROM core.dropdown_options WHERE kind = ${kind} ORDER BY sort_order, id`;
  return rows.map(r => r.value);
}

// GET ?kind=faculty_designation  ->  { options: [...] }
async function getHandler(req) {
  try {
    const kind = parseKind(new URL(req.url).searchParams.get('kind'));
    return NextResponse.json({ options: await listKind(connection, kind) });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Dropdown options GET error');
  }
}

// PUT { kind, options: [...] }  ->  replaces the whole list (shared by all admins)
async function putHandler(req) {
  try {
    const body = await req.json();
    const kind = parseKind(body?.kind);
    if (!Array.isArray(body.options)) throw new HttpError(400, 'options must be an array.');
    if (body.options.length > MAX_OPTIONS) throw new HttpError(400, `At most ${MAX_OPTIONS} options are allowed.`);

    const seen = new Set();
    const options = [];
    for (const raw of body.options) {
      const v = String(raw ?? '').trim();
      if (!v) continue;
      if (v.length > MAX_LEN) throw new HttpError(400, `Options cannot exceed ${MAX_LEN} characters.`);
      if (seen.has(v.toLowerCase())) continue;
      seen.add(v.toLowerCase());
      options.push(v);
    }

    const saved = await connection.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${'dropdown_options:' + kind}))`;
      if (options.length === 0) {
        await tx`DELETE FROM core.dropdown_options WHERE kind = ${kind}`;
      } else {
        await tx`DELETE FROM core.dropdown_options WHERE kind = ${kind} AND lower(value) <> ALL(${options.map(o => o.toLowerCase())})`;
      }
      for (let i = 0; i < options.length; i++) {
        await tx`
          INSERT INTO core.dropdown_options (kind, value, sort_order) VALUES (${kind}, ${options[i]}, ${i + 1})
          ON CONFLICT (kind, lower(value)) DO UPDATE SET value = EXCLUDED.value, sort_order = EXCLUDED.sort_order`;
      }
      return listKind(tx, kind);
    });
    return NextResponse.json({ options: saved });
  } catch (err) {
    return errorResponse(NextResponse, err, 'Dropdown options PUT error');
  }
}

export const GET = withRole(getHandler, ['admin'], { allowArchivedWrites: true });
export const PUT = withRole(putHandler, ['admin'], { allowArchivedWrites: true });
