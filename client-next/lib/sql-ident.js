/** Quote a (pre-validated) identifier for use in dynamic SQL. */
export function qid(id) {
  return '"' + String(id).replace(/"/g, '""') + '"';
}

export const RESERVED_SCHEMAS = new Set([
  'public', 'core', 'auth', 'storage', 'vault', 'realtime', 'extensions',
  'graphql', 'graphql_public', 'information_schema', 'pgbouncer',
]);

/** Error carrying an HTTP status, thrown by services and mapped to a response by routes. */
export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (extra) Object.assign(this, extra);
  }
}

/** Standard route catch: HttpError -> its status, anything else -> 500. */
export function errorResponse(NextResponse, err, label = 'Request failed') {
  if (err instanceof HttpError || err?.status) {
    return NextResponse.json({ error: err.message, ...(err.details ? { details: err.details } : {}) }, { status: err.status });
  }
  console.error(label + ':', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
