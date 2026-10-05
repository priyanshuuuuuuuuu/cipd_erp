import { NextResponse } from 'next/server';
import { getUserFromRequest } from './auth';
import { runWithSchema } from './db';
import { resolveRequestSchema } from './cohorts';

/**
 * Wraps a route handler to require authentication.
 * Attaches user payload to the handler's context and runs the handler
 * inside the cohort schema selected for this request (see resolveRequestSchema),
 * so the shared `db` export targets the right cohort.
 */
export function withAuth(handler) {
  return async (req, context) => {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const schema = await resolveRequestSchema(req, user);
    // Routes that read req.user.schema (from the JWT) must follow the selected cohort.
    req.user = { ...user, schema };
    req.cohort = schema;
    return runWithSchema(schema, () => handler(req, context));
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
