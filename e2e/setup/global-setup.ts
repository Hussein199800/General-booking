import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

/**
 * Brings up the real stack for the browser tests:
 *   1. a throw-away database with the real migrations and reference seed;
 *   2. the built API connected as `sba_app` (DML only, as in production);
 *   3. the built web app (`next start`) forwarding /api/v1 to that API.
 *
 * Needs TEST_DATABASE_ADMIN_URL (owner/superuser connection to a maintenance
 * database) and prior builds: `pnpm build` (API, web and packages).
 */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const API_PORT = 4100;
const WEB_PORT = 3100;
const APP_PASSWORD = 'browser-e2e-app-password';

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

async function waitFor(url: string, child: ChildProcess, name: string): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${name} exited with ${String(child.exitCode)}`);
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${name} did not start: ${url}`);
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
  if (!adminUrl) throw new Error('Browser tests need TEST_DATABASE_ADMIN_URL');
  for (const built of ['apps/api/dist/main.js', 'apps/web/.next/BUILD_ID']) {
    if (!existsSync(join(ROOT, built))) throw new Error(`Build first (missing ${built})`);
  }

  const database = `sba_browser_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${database}`);
  const ownerUrl = withDatabase(adminUrl, database);
  const dbPackage = join(ROOT, 'packages/db');
  const ownerEnv = { ...process.env, DATABASE_MIGRATION_URL: ownerUrl };
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: dbPackage,
    env: ownerEnv,
    stdio: 'pipe',
  });
  execFileSync('node', ['dist/seed/main.js'], {
    cwd: dbPackage,
    env: { ...ownerEnv, SEED_DEMO_DATA: 'false' },
    stdio: 'pipe',
  });
  await admin.query(`ALTER ROLE sba_app LOGIN PASSWORD '${APP_PASSWORD}'`);

  const secrets = mkdtempSync(join(tmpdir(), 'sba-browser-'));
  const file = (name: string, content: string) => {
    const path = join(secrets, name);
    writeFileSync(path, content, { mode: 0o600 });
    return path;
  };
  const appUrl = new URL(ownerUrl);
  appUrl.username = 'sba_app';
  appUrl.password = APP_PASSWORD;
  const webUrl = `http://localhost:${String(WEB_PORT)}`;
  const apiEnv: Record<string, string> = {
    NODE_ENV: 'test',
    API_HOST: '127.0.0.1',
    API_PORT: String(API_PORT),
    CORS_ALLOWED_ORIGINS: webUrl,
    DATABASE_URL: appUrl.toString(),
    JWT_SIGNING_KEY_FILE: file('jwt', randomBytes(32).toString('base64')),
    MASTER_KEYS_FILE: file(
      'keys.json',
      JSON.stringify({ 'kek-e2e-01': randomBytes(32).toString('base64') }),
    ),
    MASTER_KEY_ACTIVE_ID: 'kek-e2e-01',
    PII_HMAC_PEPPER_FILE: file('pepper', randomBytes(32).toString('base64')),
    COOKIE_SECURE: 'false',
    TRUST_PROXY_HOPS: '1',
    PUBLIC_BASE_URL: webUrl,
    JITSI_PUBLIC_URL: 'https://meet.example.test',
    RATE_LIMIT_PER_MINUTE: '100000',
    AUTH_RATE_LIMIT_PER_MINUTE: '100000',
    PUBLIC_SUBMIT_RATE_LIMIT_PER_HOUR: '100000',
  };

  const children: ChildProcess[] = [];
  let stopping = false;
  const start = (name: string, cwd: string, args: string[], env: Record<string, string>) => {
    const child = spawn('node', args, { cwd, env: { ...process.env, ...env }, stdio: 'pipe' });
    let log = '';
    child.stdout.on('data', (chunk: Buffer) => (log += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (log += chunk.toString()));
    child.on('exit', (code) => {
      if (!stopping && code !== 0)
        process.stderr.write(`[${name}] exited ${String(code)}\n${log}\n`);
    });
    children.push(child);
    return child;
  };
  const api = start('api', join(ROOT, 'apps/api'), ['dist/main.js'], apiEnv);
  const web = start(
    'web',
    join(ROOT, 'apps/web'),
    ['node_modules/next/dist/bin/next', 'start', '--port', String(WEB_PORT)],
    { API_INTERNAL_URL: `http://127.0.0.1:${String(API_PORT)}` },
  );
  await waitFor(`http://127.0.0.1:${String(API_PORT)}/api/v1/health`, api, 'api');
  await waitFor(`${webUrl}/login`, web, 'web');

  // Read by the fixtures in the test workers.
  process.env.E2E_WEB_URL = webUrl;
  process.env.E2E_OWNER_URL = ownerUrl;
  process.env.E2E_MASTER_KEYS_FILE = apiEnv.MASTER_KEYS_FILE;
  process.env.E2E_PEPPER_FILE = apiEnv.PII_HMAC_PEPPER_FILE;

  return async () => {
    stopping = true;
    for (const child of children) child.kill('SIGTERM');
    await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await admin.end();
    rmSync(secrets, { recursive: true, force: true });
  };
}
