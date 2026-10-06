import type { CookieOptions, Response } from 'express';

import type { Env } from '../config/env.js';

export const ACCESS_COOKIE = 'sba_access';
export const REFRESH_COOKIE = 'sba_refresh';
/** Readable by the page so it can echo it in X-CSRF-Token (double submit). */
export const CSRF_COOKIE = 'sba_csrf';
/** The refresh token is only ever sent to the auth endpoints. */
const REFRESH_PATH = '/api/v1/auth';

function base(env: Env): CookieOptions {
  return { secure: env.COOKIE_SECURE, sameSite: 'strict', path: '/' };
}

export function setSessionCookies(
  res: Response,
  env: Env,
  tokens: { access: string; refresh: string; csrf: string },
): void {
  res.cookie(ACCESS_COOKIE, tokens.access, {
    ...base(env),
    httpOnly: true,
    maxAge: env.ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refresh, {
    ...base(env),
    httpOnly: true,
    path: REFRESH_PATH,
    maxAge: env.SESSION_IDLE_TTL_SECONDS * 1000,
  });
  res.cookie(CSRF_COOKIE, tokens.csrf, {
    ...base(env),
    httpOnly: false,
    maxAge: env.SESSION_IDLE_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookies(res: Response, env: Env): void {
  res.clearCookie(ACCESS_COOKIE, base(env));
  res.clearCookie(REFRESH_COOKIE, { ...base(env), path: REFRESH_PATH });
  res.clearCookie(CSRF_COOKIE, base(env));
}
