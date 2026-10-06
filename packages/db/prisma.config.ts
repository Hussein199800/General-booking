import { existsSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

// Prisma 7 does not read .env itself. Variables already set in the environment win.
const rootEnv = new URL('../../.env', import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

/**
 * Migrations run with the schema-owner connection (DATABASE_MIGRATION_URL).
 * The application itself connects as the least-privilege role (DATABASE_URL).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --env-file-if-exists=../../.env dist/seed/main.js',
  },
  datasource: {
    url: process.env.DATABASE_MIGRATION_URL ?? '',
  },
});
