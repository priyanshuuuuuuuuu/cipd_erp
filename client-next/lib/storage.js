import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getRequestSchema } from './db';
import { DEFAULT_SCHEMA } from '../config';

/**
 * Local-disk file storage (replaces Supabase Storage).
 *
 *   physical path = STORAGE_DIR / <bucket> / <cohort schema> / <key>
 *
 * Files are only readable through /api/files/<bucket>/<key>?t=<token>, where the
 * token is a short-lived JWT bound to {bucket, key, schema}.
 */

export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || '/var/lib/cipd/uploads');
const FILE_TOKEN_TTL_SECONDS = 3600;
const BUCKET_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const SCHEMA_RE = /^[a-z][a-z0-9_]{2,40}$/;

/**
 * @param {string | null | undefined} url
 * @returns {boolean}
 */
export function isExternalUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function currentSchema() {
  return getRequestSchema() || DEFAULT_SCHEMA;
}

/**
 * Resolve and validate a physical path. Throws on anything that could escape STORAGE_DIR.
 * @returns {string}
 */
export function resolveStoragePath(bucket, key, schema = currentSchema()) {
  if (!BUCKET_RE.test(bucket || '')) throw new Error('Invalid storage bucket');
  if (!SCHEMA_RE.test(schema || '')) throw new Error('Invalid storage schema');
  if (typeof key !== 'string' || !key || key.startsWith('/') || key.startsWith('\\') || key.includes('\0')) {
    throw new Error('Invalid storage key');
  }
  const segments = key.split(/[\\/]+/);
  if (segments.some((s) => s === '..' || s === '.')) throw new Error('Invalid storage key');

  const base = path.join(STORAGE_DIR, bucket, schema);
  const full = path.resolve(base, key);
  if (full !== base && !full.startsWith(base + path.sep)) throw new Error('Invalid storage key');
  return full;
}

/**
 * Kept for call-site compatibility: ensures the bucket directory exists.
 * @param {string} bucket
 */
export async function ensureBucketExists(bucket) {
  await fs.mkdir(path.join(STORAGE_DIR, bucket, currentSchema()), { recursive: true });
}

/**
 * @param {string} bucket
 * @param {string} key
 * @param {File | Blob} file
 * @param {string} [contentType] unused: type is derived from the extension on download
 * @returns {Promise<string>} the key
 */
export async function uploadToStorage(bucket, key, file, contentType) { // eslint-disable-line no-unused-vars
  const full = resolveStoragePath(bucket, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  const tmp = `${full}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    await fs.writeFile(tmp, buffer);
    await fs.rename(tmp, full);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
  return key;
}

function fileSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

/**
 * Signed, expiring relative URL for a stored file in the current cohort.
 * @param {string} bucket
 * @param {string} key
 * @param {number} [expiresIn] seconds
 * @returns {Promise<string>}
 */
export async function getSignedUrl(bucket, key, expiresIn = FILE_TOKEN_TTL_SECONDS) {
  const schema = currentSchema();
  resolveStoragePath(bucket, key, schema); // validates
  const token = jwt.sign({ purpose: 'file', bucket, key, schema }, fileSecret(), { expiresIn });
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `/api/files/${encodeURIComponent(bucket)}/${encodedKey}?t=${encodeURIComponent(token)}`;
}

/**
 * Verify a file token. Returns the claims or null.
 * @param {string} token
 */
export function verifyFileToken(token) {
  try {
    const claims = jwt.verify(token, fileSecret());
    return claims?.purpose === 'file' ? claims : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} bucket
 * @param {string} key
 */
export async function deleteFromStorage(bucket, key) {
  if (!key || isExternalUrl(key)) return;
  try {
    await fs.rm(resolveStoragePath(bucket, key), { force: true });
  } catch (err) {
    console.error('Storage delete error:', err.message);
  }
}

/**
 * @param {string} bucket
 * @param {string | null | undefined} fileUrl
 * @returns {Promise<string | null>}
 */
export async function resolveFileUrl(bucket, fileUrl) {
  if (!fileUrl) return null;
  if (isExternalUrl(fileUrl)) return fileUrl;
  return getSignedUrl(bucket, fileUrl);
}
