import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

const base = {
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://sba_app@localhost/sba',
  JWT_SIGNING_KEY_FILE: './infra/secrets/jwt-signing-key',
  MASTER_KEYS_FILE: '/abs/master-keys.json',
  MASTER_KEY_ACTIVE_ID: 'kek-dev-01',
  PII_HMAC_PEPPER_FILE: './infra/secrets/pii-hmac-pepper',
};

describe('loadEnv', () => {
  it('parses a comma-separated CORS allowlist and applies defaults', () => {
    const env = loadEnv({
      ...base,
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000, https://portal.example.sy',
    });
    expect(env.CORS_ALLOWED_ORIGINS).toEqual([
      'http://localhost:3000',
      'https://portal.example.sy',
    ]);
    expect(env.API_PORT).toBe(4000);
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(600);
  });

  it('rejects wildcard origins and an empty allowlist', () => {
    expect(() => loadEnv({ ...base, CORS_ALLOWED_ORIGINS: 'https://*.example.sy' })).toThrow(
      /Invalid environment/,
    );
    expect(() => loadEnv({ ...base, CORS_ALLOWED_ORIGINS: '' })).toThrow(/Invalid environment/);
  });

  it('resolves relative secret files from the repository root, keeps absolute ones', () => {
    const env = loadEnv(base);
    expect(env.JWT_SIGNING_KEY_FILE).toMatch(/\/infra\/secrets\/jwt-signing-key$/);
    expect(env.JWT_SIGNING_KEY_FILE).not.toContain('apps/api');
    expect(env.MASTER_KEYS_FILE).toBe('/abs/master-keys.json');
  });

  it('makes cookies Secure by default in production and refuses to disable them there', () => {
    expect(loadEnv({ ...base, NODE_ENV: 'production' }).COOKIE_SECURE).toBe(true);
    expect(loadEnv({ ...base, NODE_ENV: 'development' }).COOKIE_SECURE).toBe(false);
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', COOKIE_SECURE: 'false' })).toThrow(
      /Secure/,
    );
  });

  it('requires the database URL and key files', () => {
    expect(() => loadEnv({ CORS_ALLOWED_ORIGINS: 'http://localhost:3000' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
