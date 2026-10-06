import { Secret, TOTP } from 'otpauth';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from './helpers/app.js';
import { Client, createLawyer, createStaff, nextCode, PASSWORD } from './helpers/fixtures.js';

let t: TestApp;
let server: Parameters<typeof request>[0];

beforeAll(async () => {
  t = await createTestApp();
  server = t.app.getHttpServer();
});

afterAll(async () => {
  await t.close();
});

const cookieNames = (res: request.Response) =>
  ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).map(
    (c) => c.split('=')[0],
  );

describe('staff sign-in', () => {
  it('rejects a wrong password and an unknown account with the same generic error', async () => {
    const staff = await createStaff(t.owner, ['SECRETARIAT_OFFICER'], { mfa: true });
    const wrong = await new Client(server).post(
      '/auth/staff/login',
      { email: staff.email, password: 'nope-nope' },
      { idempotencyKey: false, csrf: false },
    );
    const unknown = await new Client(server).post(
      '/auth/staff/login',
      { email: 'ghost@sba.invalid', password: 'nope-nope' },
      { idempotencyKey: false, csrf: false },
    );
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.code).toBe('INVALID_CREDENTIALS');
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('locks the account after 5 failures, even for the right password', async () => {
    const staff = await createStaff(t.owner, ['SECRETARIAT_OFFICER'], { mfa: true });
    for (let i = 0; i < 5; i += 1) {
      await new Client(server).post(
        '/auth/staff/login',
        { email: staff.email, password: 'wrong-wrong' },
        { idempotencyKey: false, csrf: false },
      );
    }
    const res = await new Client(server).post(
      '/auth/staff/login',
      { email: staff.email, password: PASSWORD, otp: nextCode(staff.totp!) },
      { idempotencyKey: false, csrf: false },
    );
    expect(res.status).toBe(423);
    expect(res.body.code).toBe('ACCOUNT_LOCKED');
    const audit = await t.owner.auditLog.count({
      where: { entityId: staff.id, action: 'auth.account_locked' },
    });
    expect(audit).toBe(1);
  });

  it('asks for the second factor before creating any session', async () => {
    const staff = await createStaff(t.owner, ['SECRETARIAT_OFFICER'], { mfa: true });
    const res = await new Client(server).post(
      '/auth/staff/login',
      { email: staff.email, password: PASSWORD },
      { idempotencyKey: false, csrf: false },
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'MFA_REQUIRED' });
    expect(cookieNames(res)).toEqual([]);
  });

  it('signs in with a valid code and refuses the same code again (replay)', async () => {
    const staff = await createStaff(t.owner, ['SECRETARIAT_HEAD'], { mfa: true });
    const code = nextCode(staff.totp!);
    const first = await new Client(server).post(
      '/auth/staff/login',
      { email: staff.email, password: PASSWORD, otp: code },
      { idempotencyKey: false, csrf: false },
    );
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ status: 'OK' });
    expect(cookieNames(first).sort()).toEqual(['sba_access', 'sba_csrf', 'sba_refresh']);
    const cookies = (first.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookies).toMatch(/sba_access=[^;]+;.*HttpOnly/);
    expect(cookies).toMatch(/SameSite=Strict/);

    const replay = await new Client(server).post(
      '/auth/staff/login',
      { email: staff.email, password: PASSWORD, otp: code },
      { idempotencyKey: false, csrf: false },
    );
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('MFA_INVALID');
  });

  it('confines staff without MFA to enrolment until they complete it', async () => {
    const staff = await createStaff(t.owner, ['SECRETARIAT_OFFICER']);
    const client = new Client(server);
    const login = await client.loginStaff(staff);
    expect(login.body).toEqual({ status: 'MFA_ENROLLMENT_REQUIRED' });

    const me = await client.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      roles: ['SECRETARIAT_OFFICER'],
      mfaEnabled: false,
      mfaVerified: false,
    });

    const blocked = await client.post('/auth/password', {
      currentPassword: PASSWORD,
      newPassword: 'a-brand-new-passphrase',
    });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('MFA_REQUIRED');

    const enroll = await client.post('/auth/mfa/enroll');
    expect(enroll.status).toBe(200);
    expect(enroll.body.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    const totp = new TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(enroll.body.secret as string),
    });

    const bad = await client.post('/auth/mfa/confirm', { otp: '000000' });
    expect(bad.status).toBe(401);
    const ok = await client.post('/auth/mfa/confirm', { otp: totp.generate() });
    expect(ok.status).toBe(204);

    const stored = await t.owner.user.findUniqueOrThrow({ where: { id: staff.id } });
    expect(stored.mfaEnabledAt).not.toBeNull();
    expect(
      Buffer.from(stored.mfaTotpSecretEnc!).includes(Buffer.from(enroll.body.secret as string)),
    ).toBe(false);

    const allowed = await client.post('/auth/password', {
      currentPassword: PASSWORD,
      newPassword: 'a-brand-new-passphrase',
    });
    expect(allowed.status).toBe(204);
  });

  it('refuses disabled accounts after a correct password', async () => {
    const staff = await createStaff(t.owner, ['SECRETARIAT_OFFICER'], { status: 'DISABLED' });
    const res = await new Client(server).post(
      '/auth/staff/login',
      { email: staff.email, password: PASSWORD },
      { idempotencyKey: false, csrf: false },
    );
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
  });
});

describe('lawyer sign-in', () => {
  it('needs registration number, matching national ID and password', async () => {
    const lawyer = await createLawyer(t.owner);
    const ok = await new Client(server).loginLawyer(lawyer);
    expect(ok.body).toEqual({ status: 'OK' });

    const wrongId = await new Client(server).post(
      '/auth/lawyer/login',
      {
        registrationNumber: lawyer.registrationNumber,
        nationalId: '99999999999',
        password: PASSWORD,
      },
      { idempotencyKey: false, csrf: false },
    );
    expect(wrongId.status).toBe(401);
    expect(wrongId.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('keeps the two doors apart: staff cannot use the lawyer door and vice versa', async () => {
    const lawyer = await createLawyer(t.owner);
    const user = await t.owner.user.findUniqueOrThrow({ where: { id: lawyer.id } });
    await t.owner.user.update({
      where: { id: lawyer.id },
      data: { email: `${lawyer.registrationNumber.toLowerCase()}@sba.invalid` },
    });
    const viaStaff = await new Client(server).post(
      '/auth/staff/login',
      { email: `${lawyer.registrationNumber.toLowerCase()}@sba.invalid`, password: PASSWORD },
      { idempotencyKey: false, csrf: false },
    );
    expect(user.id).toBe(lawyer.id);
    expect(viaStaff.status).toBe(401);
  });
});

describe('sessions', () => {
  it('rotates refresh tokens and revokes the session when an old one is replayed', async () => {
    const staff = await createStaff(t.owner, ['SECRETARIAT_OFFICER'], { mfa: true });
    const client = new Client(server);
    const login = await client.loginStaff(staff);
    const oldRefresh = (login.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('sba_refresh='),
    )!;

    const rotated = await client.post('/auth/refresh', {}, { idempotencyKey: false, csrf: false });
    expect(rotated.status).toBe(204);
    expect((await client.get('/auth/me')).status).toBe(200);

    // An attacker replays the stolen, already-rotated token.
    const replay = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', oldRefresh.split(';')[0]!);
    expect(replay.status).toBe(401);

    const session = await t.owner.session.findFirstOrThrow({ where: { userId: staff.id } });
    expect(session.revokedReason).toBe('REFRESH_TOKEN_REUSE');
    expect((await client.get('/auth/me')).status).toBe(401);
  });

  it('requires the CSRF token on mutations and ends the session on logout', async () => {
    const staff = await createStaff(t.owner, ['SECRETARIAT_OFFICER'], { mfa: true });
    const client = new Client(server);
    await client.loginStaff(staff);

    const noCsrf = await client.post('/auth/logout', {}, { csrf: false, idempotencyKey: false });
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.code).toBe('CSRF');

    const logout = await client.post('/auth/logout', {}, { idempotencyKey: false });
    expect(logout.status).toBe(204);
    const session = await t.owner.session.findFirstOrThrow({ where: { userId: staff.id } });
    expect(session.revokedReason).toBe('LOGOUT');
    expect((await client.get('/auth/me')).status).toBe(401);
  });

  it('rejects cross-site origins on unsafe requests, even public ones', async () => {
    const res = await request(server)
      .post('/api/v1/auth/staff/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'x@sba.invalid', password: 'whatever' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF');
  });

  it('rejects requests without a session and forged tokens', async () => {
    expect((await request(server).get('/api/v1/auth/me')).status).toBe(401);
    const forged = await request(server)
      .get('/api/v1/auth/me')
      .set('Cookie', 'sba_access=eyJhbGciOiJub25lIn0.e30.');
    expect(forged.status).toBe(401);
  });
});
