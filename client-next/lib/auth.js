import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '[REMOVED-ROTATED]';
const TOKEN_EXPIRY = '7d';

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Extract user from request headers.
 * Supports: Authorization: Bearer <token> OR cookie: token=<token>
 */
export function getUserFromRequest(req) {
  // Try Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return verifyToken(token);
  }

  // Try cookie
  const cookie = req.headers.get('cookie');
  if (cookie) {
    const match = cookie.match(/token=([^;]+)/);
    if (match) {
      return verifyToken(match[1]);
    }
  }

  return null;
}
