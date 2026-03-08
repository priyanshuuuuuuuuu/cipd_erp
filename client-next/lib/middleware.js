import { NextResponse } from 'next/server';
import { getUserFromRequest } from './auth';

/**
 * Wraps a route handler to require authentication.
 * Attaches user payload to the handler's context.
 */
export function withAuth(handler) {
  return async (req, context) => {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    req.user = user;
    return handler(req, context);
  };
}

/**
 * Wraps a route handler to require authentication + specific role(s).
 */
export function withRole(handler, allowedRoles) {
  return withAuth(async (req, context) => {
    if (!allowedRoles.includes(req.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(req, context);
  });
}
