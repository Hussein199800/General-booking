import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import type { TestProject } from 'vitest/node';

/**
 * Creates a throw-away database, applies the real migrations as the owner,
 * seeds reference data, and hands the tests a least-privilege `sba_app`
 * connection — the same split as production.
 *
 * Requires TEST_DATABASE_ADMIN_URL: a superuser/owner connection to an existing
 * maintenance database (e.g. .../postgres).
 */
const DB_PACKAGE = fileURLToPath(new URL('../../../../packages/db/', import.meta.url));
const APP_PASSWORD = 'e2e-app-password';

declare module 'vitest' {
  export interface ProvidedContext {
    e2eEnv: Record<string, string>;
  }
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
  if (!adminUrl) throw new Error('E2E tests need TEST_DATABASE_ADMIN_URL');

  const database = `sba_e2e_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${database}`);

  const ownerUrl = withDatabase(adminUrl, database);
  const migrationEnv = { ...process.env, DATABASE_MIGRATION_URL: ownerUrl };
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: DB_PACKAGE,
    env: migrationEnv,
    stdio: 'pipe',
  });
  execFileSync('node', ['dist/seed/main.js'], {
    cwd: DB_PACKAGE,
    env: { ...migrationEnv, SEED_DEMO_DATA: 'false' },
    stdio: 'pipe',
  });
  await admin.query(`ALTER ROLE sba_app LOGIN PASSWORD '${APP_PASSWORD}'`);

  const secrets = mkdtempSync(join(tmpdir(), 'sba-e2e-'));
  const file = (name: string, content: string) => {
    const path = join(secrets, name);
    writeFileSync(path, content, { mode: 0o600 });
    return path;
  };
  const appUrl = new URL(ownerUrl);
  appUrl.username = 'sba_app';
  appUrl.password = APP_PASSWORD;

  project.provide('e2eEnv', {
    NODE_ENV: 'test',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    DATABASE_URL: appUrl.toString(),
    DATABASE_MIGRATION_URL: ownerUrl,
    JWT_SIGNING_KEY_FILE: file('jwt', randomBytes(32).toString('base64')),
    MASTER_KEYS_FILE: file(
      'keys.json',
      JSON.stringify({ 'kek-e2e-01': randomBytes(32).toString('base64') }),
    ),
    MASTER_KEY_ACTIVE_ID: 'kek-e2e-01',
    PII_HMAC_PEPPER_FILE: file('pepper', randomBytes(32).toString('base64')),
    COOKIE_SECURE: 'false',
    PUBLIC_BASE_URL: 'http://localhost:3000',
    JITSI_PUBLIC_URL: 'https://meet.example.test',
  });

  return async () => {
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.end();
    rmSync(secrets, { recursive: true, force: true });
  };
}
