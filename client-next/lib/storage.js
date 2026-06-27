import { supabaseAdmin } from './supabase';

/**
 * @param {string | null | undefined} url
 * @returns {boolean}
 */
export function isExternalUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

/**
 * Ensure a private storage bucket exists (creates if missing).
 * @param {string} bucket
 */
export async function ensureBucketExists(bucket) {
  const { data, error } = await supabaseAdmin.storage.getBucket(bucket);
  if (data && !error) return;

  const { error: createErr } = await supabaseAdmin.storage.createBucket(bucket, {
    public: false,
  });
  if (createErr && !createErr.message?.includes('already exists')) {
    throw new Error(`Storage bucket "${bucket}" unavailable: ${createErr.message}`);
  }
}

/**
 * @param {string} bucket
 * @param {string} path
 * @param {File | Blob} file
 * @param {string} [contentType]
 * @returns {Promise<string>}
 */
export async function uploadToStorage(bucket, path, file, contentType) {
  await ensureBucketExists(bucket);
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, {
      upsert: true,
      contentType: contentType || (file instanceof File ? file.type : undefined),
    });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

/**
 * @param {string} bucket
 * @param {string} path
 * @param {number} [expiresIn]
 * @returns {Promise<string>}
 */
export async function getSignedUrl(bucket, path, expiresIn = 3600) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}

/**
 * @param {string} bucket
 * @param {string} path
 */
export async function deleteFromStorage(bucket, path) {
  if (!path || isExternalUrl(path)) return;

  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
  if (error) {
    console.error('Storage delete error:', error.message);
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
