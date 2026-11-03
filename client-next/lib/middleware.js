import { NextResponse } from 'next/server';
import { getUserFromRequest } from './auth';
import { runWithSchema } from './db';
import { resolveRequestContext, readOnlyViolation } from './cohorts';

/**
 * Wraps a route handler to require authentication.
 *
 * The cohort for the request is resolved from the account's memberships (never from the JWT), see
 * resolveRequestContext. Inside the handler:
 *   req.user.id         the person's id INSIDE this cohort (cohort-local users.id) - use it for cohort tables
 *   req.user.accountId  the global (canonical) account id - use it for account operations (password, identity)
 *   req.user.localId    alias of req.user.id
 *   req.user.role       the account's current role (not the possibly stale token claim)
 *   req.cohort          schema name; req.cohortInfo the full cohort row; req.membership the caller's membership
 *   req.account         the global account row (core.accounts)
 *
 * @param {Function} handler
 * @param {{ allowArchivedWrites?: boolean }} [options] set for account-level routes that must keep working on
 *        archived cohorts (password change, notification read-marks, cohort administration)
 */
export function withAuth(handler, options = {}) {
  return async (req, context) => {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let resolved;
    try {
      resolved = await resolveRequestContext(req, user);
    } catch (err) {
      if (err?.status) return NextResponse.json({ error: err.message }, { status: err.status });
      console.error('withAuth: cohort resolution failed:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const blocked = readOnlyViolation(req.method, resolved, options);
    if (blocked) {
      return NextResponse.json({ error: blocked }, { status: 409 });
    }

    req.user = {
      ...user,
      id: resolved.localId,
      localId: resolved.localId,
      accountId: resolved.accountId,
      role: resolved.role,
      email: resolved.ctx.account.email,
      schema: resolved.schema,
    };
    req.cohort = resolved.schema;
    req.cohortInfo = resolved.cohort;
    req.membership = resolved.membership;
    req.account = resolved.ctx.account; // global identity row (core.accounts)
    return runWithSchema(resolved.schema, () => handler(req, context));
  };
}

/**
 * Wraps a route handler to require authentication + specific role(s).
 */
export function withRole(handler, allowedRoles, options = {}) {
  return withAuth(async (req, context) => {
    if (!allowedRoles.includes(req.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(req, context);
  }, options);
}
