import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from './errors';

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T): NextResponse {
  return ok(data, 201);
}

export function fail(status: number, code: string, message: string, details?: unknown): NextResponse {
  return NextResponse.json({ success: false, error: { code, message, details } }, { status });
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return fail(error.status, error.code, error.message, error.details);
  }

  if (error instanceof ZodError) {
    const first = error.issues[0];
    const message = first
      ? `${first.path.length ? `${first.path.join('.')}: ` : ''}${first.message}`
      : 'Validation failed';
    return fail(400, 'VALIDATION_ERROR', message, error.flatten().fieldErrors);
  }

  const mongoError = error as { code?: number; name?: string };
  if (mongoError?.code === 11000) {
    return fail(409, 'DUPLICATE', 'A record with the same unique value already exists');
  }
  if (mongoError?.name === 'CastError') {
    return fail(400, 'BAD_REQUEST', 'Invalid identifier');
  }

  console.error('[api] Unhandled error', error);
  return fail(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
}

type Handler<P> = (req: NextRequest, ctx: { params: P }) => Promise<Response>;

/** Wraps a route handler so thrown errors become consistent JSON responses. */
export function route<P = Record<string, never>>(handler: Handler<P>): Handler<P> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/** Converts URLSearchParams into a plain object for Zod parsing. */
export function searchParamsToObject(req: NextRequest): Record<string, string> {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}
