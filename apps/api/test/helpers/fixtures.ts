import { randomBytes } from 'node:crypto';

import { KeyRing, Pepper } from '@sba/crypto';
import type { PrismaClient } from '@sba/db';
import type { UserRole } from '@sba/shared';
import { hash } from 'argon2';
import { Secret, TOTP } from 'otpauth';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';

export const PASSWORD = 'correct-horse-battery-staple';

function keyRing(): KeyRing {
  return KeyRing.fromFile(
    process.env.MASTER_KEYS_FILE ?? '',
    process.env.MASTER_KEY_ACTIVE_ID ?? '',
  );
}

let counter = 0;
const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

export interface StaffFixture {
  readonly id: string;
  readonly email: string;
  /** Present when MFA is enabled. */
  readonly totp?: TOTP;
}

/** Creates an ACTIVE staff user (as the owner), optionally with MFA already enabled. */
export async function createStaff(
  owner: PrismaClient,
  roles: readonly UserRole[],
  options: { mfa?: boolean; orgUnitCode?: string; status?: 'ACTIVE' | 'DISABLED' } = {},
): Promise<StaffFixture> {
  const email = `${unique('staff')}@sba.invalid`;
  const user = await owner.user.create({
    data: {
      email,
      fullName: email,
      passwordHash: await hash(PASSWORD, { type: 2 }),
      status: options.status ?? 'ACTIVE',
    },
  });
  const orgUnitId = options.orgUnitCode
    ? (await owner.organizationalUnit.findUniqueOrThrow({ where: { code: options.orgUnitCode } }))
        .id
    : null;
  for (const role of roles)
    await owner.userRoleGrant.create({ data: { userId: user.id, role, orgUnitId } });
  if (!options.mfa) return { id: user.id, email };

  const secret = new Secret({ size: 20 });
  const sealed = keyRing().seal(Buffer.from(secret.base32, 'utf8'), Buffer.from(user.id, 'utf8'));
  await owner.user.update({
    where: { id: user.id },
    data: {
      mfaTotpSecretEnc: Uint8Array.from(sealed.box),
      mfaKeyId: sealed.keyId,
      mfaEnabledAt: new Date(),
    },
  });
  return {
    id: user.id,
    email,
    totp: new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret }),
  };
}

export interface LawyerFixture {
  readonly id: string;
  readonly registrationNumber: string;
  readonly nationalId: string;
}

export async function createLawyer(owner: PrismaClient): Promise<LawyerFixture> {
  const registrationNumber = unique('REG-');
  const nationalId = String(10_000_000_000 + Math.floor(Math.random() * 89_999_999_999)).slice(
    0,
    11,
  );
  const pepper = Pepper.fromFile(process.env.PII_HMAC_PEPPER_FILE ?? '');
  const sealed = keyRing().seal(Buffer.from(nationalId, 'utf8'));
  const branch = await owner.organizationalUnit.findUniqueOrThrow({
    where: { code: 'BRANCH_DAMASCUS' },
  });
  const user = await owner.user.create({
    data: {
      fullName: registrationNumber,
      phoneE164: `+9639${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      passwordHash: await hash(PASSWORD, { type: 2 }),
      status: 'ACTIVE',
    },
  });
  await owner.userRoleGrant.create({ data: { userId: user.id, role: 'LAWYER' } });
  await owner.lawyerProfile.create({
    data: {
      userId: user.id,
      registrationNumber,
      nationalIdHmac: Uint8Array.from(pepper.hmac(nationalId)),
      nationalIdEnc: Uint8Array.from(sealed.box),
      nationalIdKeyId: sealed.keyId,
      branchId: branch.id,
      practiceStatus: 'PRACTISING',
    },
  });
  return { id: user.id, registrationNumber, nationalId };
}

/** A fresh code for the next 30-second step (avoids replay rejection between logins). */
export function nextCode(totp: TOTP, offsetSteps = 0): string {
  return totp.generate({ timestamp: Date.now() + offsetSteps * 30_000 });
}

export function idempotencyKey(): string {
  return randomBytes(18).toString('base64url');
}

/**
 * A browser-like client: keeps cookies, echoes the CSRF cookie in X-CSRF-Token
 * and sends an Idempotency-Key on mutations.
 */
export class Client {
  readonly agent: TestAgent;

  constructor(server: Parameters<typeof request.agent>[0]) {
    this.agent = request.agent(server);
  }

  csrf(): string {
    return (
      this.agent.jar.getCookie('sba_csrf', {
        domain: '127.0.0.1',
        path: '/',
        secure: false,
        script: true,
      })?.value ?? ''
    );
  }

  get(path: string) {
    return this.agent.get(`/api/v1${path}`);
  }

  post(
    path: string,
    body: object = {},
    options: { idempotencyKey?: string | false; csrf?: boolean } = {},
  ) {
    const req = this.agent.post(`/api/v1${path}`).send(body);
    if (options.csrf !== false) void req.set('X-CSRF-Token', this.csrf());
    if (options.idempotencyKey !== false)
      void req.set('Idempotency-Key', options.idempotencyKey ?? idempotencyKey());
    return req;
  }

  async loginStaff(staff: StaffFixture) {
    const body: Record<string, string> = { email: staff.email, password: PASSWORD };
    if (staff.totp) body.otp = nextCode(staff.totp);
    const res = await this.post('/auth/staff/login', body, { idempotencyKey: false, csrf: false });
    if (res.status !== 200)
      throw new Error(`login failed: ${String(res.status)} ${JSON.stringify(res.body)}`);
    return res;
  }

  async loginLawyer(lawyer: LawyerFixture) {
    const res = await this.post(
      '/auth/lawyer/login',
      {
        registrationNumber: lawyer.registrationNumber,
        nationalId: lawyer.nationalId,
        password: PASSWORD,
      },
      { idempotencyKey: false, csrf: false },
    );
    if (res.status !== 200)
      throw new Error(`lawyer login failed: ${String(res.status)} ${JSON.stringify(res.body)}`);
    return res;
  }
}
