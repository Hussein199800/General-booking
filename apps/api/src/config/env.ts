import { z } from 'zod';

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0),
);

/**
 * Only variables consumed by code that exists today are validated here.
 * Each later phase extends this schema with the variables it starts reading
 * (see .env.example for the full, phase-annotated list).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  /** Exact origins allowed to call the API with credentials. Wildcards are rejected. */
  CORS_ALLOWED_ORIGINS: csv.pipe(
    z
      .array(z.url().refine((origin) => !origin.includes('*'), 'Wildcard origins are not allowed'))
      .min(1),
  ),
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
