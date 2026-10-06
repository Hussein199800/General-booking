import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('parses a comma-separated CORS allowlist', () => {
    const env = loadEnv({
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000, https://portal.example.sy',
    });
    expect(env.CORS_ALLOWED_ORIGINS).toEqual([
      'http://localhost:3000',
      'https://portal.example.sy',
    ]);
    expect(env.API_PORT).toBe(4000);
  });

  it('rejects wildcard origins', () => {
    expect(() => loadEnv({ CORS_ALLOWED_ORIGINS: 'https://*.example.sy' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('requires at least one allowed origin', () => {
    expect(() => loadEnv({ CORS_ALLOWED_ORIGINS: '' })).toThrow(
      /Invalid environment configuration/,
    );
  });
});
