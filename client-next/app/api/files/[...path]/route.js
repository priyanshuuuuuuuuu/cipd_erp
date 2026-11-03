export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { resolveStoragePath, verifyFileToken } from '@/lib/storage';

const MIME = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/**
 * GET /api/files/<bucket>/<key...>?t=<signed token>
 * The only way stored files are read. The token binds bucket, key and cohort schema.
 */
export async function GET(req, { params }) {
  const segments = (params?.path || []).map((s) => decodeURIComponent(s));
  if (segments.length < 2) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const token = new URL(req.url).searchParams.get('t');
  const claims = token ? verifyFileToken(token) : null;
  if (!claims) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 });

  const [bucket, ...rest] = segments;
  const key = rest.join('/');
  if (claims.bucket !== bucket || claims.key !== key) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let full;
  try {
    full = resolveStoragePath(bucket, key, claims.schema);
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let stat;
  try {
    stat = await fsp.stat(full);
    if (!stat.isFile()) throw new Error('not a file');
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ext = path.extname(full).toLowerCase();
  const filename = path.basename(full).replace(/^\d+-/, '').replace(/"/g, '');
  return new Response(Readable.toWeb(fs.createReadStream(full)), {
    status: 200,
    headers: {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
