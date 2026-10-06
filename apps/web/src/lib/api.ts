'use client';

import { t } from '@/i18n';

/**
 * Browser client for the API, reached through the same origin (`/api/v1`,
 * forwarded by src/proxy.ts). Sessions live in HttpOnly cookies the page cannot
 * read; the page only echoes the readable CSRF cookie (double submit) and sends
 * an Idempotency-Key with every mutation.
 */
export const API_BASE = '/api/v1';

export interface ApiFailure {
  readonly ok: false;
  /** Stable code from the API, or NETWORK when the server could not be reached. */
  readonly code: string;
  /** Arabic message for the user. */
  readonly message: string;
  readonly fields?: readonly string[];
  readonly status: number;
}

export type ApiResult<T> = { readonly ok: true; readonly value: T } | ApiFailure;

function csrfToken(): string {
  const match = /(?:^|;\s*)sba_csrf=([^;]+)/.exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time; concurrent 401s wait for the same rotation. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-CSRF-Token': csrfToken() },
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface RequestOptions {
  readonly body?: unknown;
  /** Defaults to a fresh key for unsafe methods; pass one to retry the same action. */
  readonly idempotencyKey?: string;
  /** Auth endpoints must not trigger a refresh loop. */
  readonly noRefresh?: boolean;
}

async function send(method: string, path: string, options: RequestOptions, key?: string) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    headers['X-CSRF-Token'] = csrfToken();
    if (key) headers['Idempotency-Key'] = key;
  }
  return fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

export async function apiRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const key = method === 'GET' ? undefined : (options.idempotencyKey ?? newIdempotencyKey());
  let res: Response;
  try {
    res = await send(method, path, options, key);
    if (res.status === 401 && !options.noRefresh && (await refreshSession())) {
      // Same key: if the first attempt did reach the server, the retry is a replay.
      res = await send(method, path, options, key);
    }
  } catch {
    return { ok: false, code: 'NETWORK', message: t('errors.network'), status: 0 };
  }

  if (res.status === 204) return { ok: true, value: undefined as T };
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Not JSON (e.g. a proxy error page).
  }
  if (res.ok) return { ok: true, value: body as T };

  const envelope = (body ?? {}) as { code?: unknown; message?: unknown; fields?: unknown };
  return {
    ok: false,
    status: res.status,
    code: typeof envelope.code === 'string' ? envelope.code : 'INTERNAL',
    message: typeof envelope.message === 'string' ? envelope.message : t('errors.generic'),
    ...(Array.isArray(envelope.fields) ? { fields: envelope.fields as string[] } : {}),
  };
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiRequest<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
    apiRequest<T>('POST', path, { ...options, body: body ?? {} }),
};

/** Query string from defined values only. */
export function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== '') search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : '';
}
