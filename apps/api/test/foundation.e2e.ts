import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ErrorBody } from '../src/common/error.filter.js';
import { createTestApp, type TestApp } from './helpers/app.js';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});

afterAll(async () => {
  await t.close();
});

describe('foundation', () => {
  it('serves health with a request id and strict security headers', async () => {
    const res = await request(t.app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['content-security-policy']).toBe(
      "default-src 'none';frame-ancestors 'none';base-uri 'none'",
    );
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('answers unknown routes with the Arabic error envelope', async () => {
    const res = await request(t.app.getHttpServer()).get('/api/v1/does-not-exist');
    const body = res.body as ErrorBody;
    expect(res.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
    expect(body.message).toMatch(/\p{Script=Arabic}/u);
    expect(body.requestId).toBe(res.headers['x-request-id']);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|Error:/);
  });

  it('connects to the database as the least-privilege role', async () => {
    const [row] = await t.owner.$queryRaw<
      { ok: boolean }[]
    >`SELECT has_table_privilege('sba_app', 'tickets', 'DELETE') AS ok`;
    expect(row?.ok).toBe(false);
  });
});
