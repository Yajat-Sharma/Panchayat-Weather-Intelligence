/** FastAPI-style errors for the route handlers: `{"detail": ...}` bodies with a status code. */

export class HttpError extends Error {
  constructor(readonly status: number, readonly detail: unknown) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
}

/** Bad input from the caller (Python's ValueError). */
export class ValueError extends Error {}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Runs a handler, turning HttpError (and anything unexpected) into a JSON error response. */
export async function handle(fn: () => unknown | Promise<unknown>): Promise<Response> {
  try {
    const out = await fn();
    return out instanceof Response ? out : Response.json(out);
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ detail: e.detail }, { status: e.status });
    console.error(e);
    return Response.json({ detail: errorMessage(e) }, { status: 500 });
  }
}

export { errorMessage };
