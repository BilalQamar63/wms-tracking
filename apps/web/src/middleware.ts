import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/jwt';

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

/**
 * First line of defence: rejects requests without a valid signed token.
 * Handlers still verify the user against the database (see `requireUser`).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (isPublic) {
    if (session && pathname === '/login') {
      return NextResponse.redirect(new URL('/permits', req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
