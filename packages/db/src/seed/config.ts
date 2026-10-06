import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

/** Repository root (this file is at <root>/packages/db/{src,dist}/seed/). */
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** Relative secret-file paths in .env are relative to the repository root, like .env itself. */
const secretFile = z
  .string()
  .min(1)
  .transform((path) => (isAbsolute(path) ? path : resolve(REPO_ROOT, path)))
  .optional();

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const seedEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_MIGRATION_URL: z.string().min(1),
    /** Demo users and a demo room. Never allowed in production. */
    SEED_DEMO_DATA: flag,
    SEED_DEMO_PASSWORD: z.string().optional(),
    MASTER_KEYS_FILE: secretFile,
    MASTER_KEY_ACTIVE_ID: z.string().optional(),
    PII_HMAC_PEPPER_FILE: secretFile,
  })
  .superRefine((env, ctx) => {
    if (!env.SEED_DEMO_DATA) return;
    if (env.NODE_ENV === 'production') {
      ctx.addIssue({
        code: 'custom',
        message: 'SEED_DEMO_DATA must never be enabled in production',
      });
    }
    if ((env.SEED_DEMO_PASSWORD ?? '').length < 12) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEED_DEMO_PASSWORD'],
        message: 'Demo data needs SEED_DEMO_PASSWORD of at least 12 characters',
      });
    }
    for (const key of [
      'MASTER_KEYS_FILE',
      'MASTER_KEY_ACTIVE_ID',
      'PII_HMAC_PEPPER_FILE',
    ] as const) {
      if (!env[key]) {
        ctx.addIssue({ code: 'custom', path: [key], message: `Demo lawyers need ${key}` });
      }
    }
  });

export type SeedEnv = z.infer<typeof seedEnvSchema>;

export function loadSeedEnv(source: NodeJS.ProcessEnv = process.env): SeedEnv {
  const result = seedEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid seed configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
