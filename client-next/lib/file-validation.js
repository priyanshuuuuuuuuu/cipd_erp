/** @typedef {{ ok: true, file: File } | { ok: false, error: string }} ValidationResult */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
]);

/**
 * @param {File | null | undefined}
 * @returns {ValidationResult}
 */
export function validateUploadFile(file) {
  if (!file || typeof file === 'string') {
    return { ok: false, error: 'No file provided' };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'File exceeds 10 MB limit' };
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false, error: 'File type not allowed. Use PDF, DOC, DOCX, PPT, PPTX, PNG, or JPEG.' };
  }

  return { ok: true, file };
}

/**
 * @param {string} filename
 * @returns {string}
 */
export function sanitizeFilename(filename) {
  return (filename || 'upload')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 200);
}

/**
 * @param {string} mimeType
 * @returns {string}
 */
export function mimeToFileType(mimeType) {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('word')) return 'doc';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'slides';
  if (mimeType.startsWith('image/')) return 'image';
  return 'file';
}
