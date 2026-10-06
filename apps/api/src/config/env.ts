import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

/** Repository root (this file is at <root>/apps/api/{src,dist}/config/). */
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0),
);

/** Secret material is always read from files; relative paths resolve from the repo root. */
const secretFile = z
  .string()
  .min(1)
  .transform((path) => (isAbsolute(path) ? path : resolve(REPO_ROOT, path)));

const flag = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_HOST: z.string().default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    /** Exact origins allowed to call the API with credentials. Wildcards are rejected. */
    CORS_ALLOWED_ORIGINS: csv.pipe(
      z
        .array(
          z.url().refine((origin) => !origin.includes('*'), 'Wildcard origins are not allowed'),
        )
        .min(1),
    ),
    /** Runtime role connection (sba_app, DML only). */
    DATABASE_URL: z.string().min(1),
    JWT_SIGNING_KEY_FILE: secretFile,
    MASTER_KEYS_FILE: secretFile,
    MASTER_KEY_ACTIVE_ID: z.string().min(1),
    PII_HMAC_PEPPER_FILE: secretFile,
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
    /** A refresh token unused for this long expires (idle timeout). */
    SESSION_IDLE_TTL_SECONDS: z.coerce.number().int().min(300).default(43_200),
    /** Hard cap on a session's lifetime regardless of activity. */
    SESSION_ABSOLUTE_TTL_SECONDS: z.coerce.number().int().min(3600).default(604_800),
    LOGIN_MAX_FAILURES: z.coerce.number().int().min(3).max(20).default(5),
    LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    /** Cookies are Secure unless explicitly disabled (development over plain http only). */
    COOKIE_SECURE: flag,
    /** Per-IP request budget across the API. */
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(10).default(300),
    /** Per-IP budget for sign-in, MFA and password endpoints. */
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
    /** Per-IP budget for anonymous public submissions. */
    PUBLIC_SUBMIT_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).default(5),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    /** Base URL of the web app, used in links sent to people (e.g. reschedule links). */
    PUBLIC_BASE_URL: z.url().default('http://localhost:3000'),
    /** Self-hosted Jitsi base URL; remote meetings are refused while it is unset. */
    JITSI_PUBLIC_URL: z.url().optional(),
  })
  .transform((env) => ({
    ...env,
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
  }))
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'Cookies must be Secure in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Parses the process environment and fails fast with a readable error. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
