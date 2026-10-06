import { NextResponse, type NextRequest } from 'next/server';

/**
 * Issues a fresh nonce per request and a strict Content-Security-Policy.
 * Next.js reads the nonce from the request's CSP header and applies it to its
 * own inline bootstrap scripts, so no 'unsafe-inline' script source is needed.
 */
export function proxy(request: NextRequest): NextResponse {
  // Same-origin API (decision I-2): the browser only ever talks to this origin,
  // so session cookies are first-party and CSP keeps `connect-src 'self'`.
  if (request.nextUrl.pathname.startsWith('/api/v1/')) {
    const target = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000',
    );
    return NextResponse.rewrite(target);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV !== 'production';

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self'${isDev ? " 'unsafe-inline'" : ` 'nonce-${nonce}'`}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
