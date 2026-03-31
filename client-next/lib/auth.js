import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';
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
 * Extract user from request Authorization: Bearer <token> header.
 * Cookie-based auth has been removed to prevent session collision when
 * multiple roles (student + admin) are open in the same browser.
 */
export function getUserFromRequest(req) {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return verifyToken(token);
  }
  return null;
}
