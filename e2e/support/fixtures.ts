import { createHash, randomBytes, randomInt } from 'node:crypto';

import { expect, type Page } from '@playwright/test';
import { KeyRing, Pepper } from '@sba/crypto';
import { createPrismaClient, type PrismaClient } from '@sba/db';
import { t, type UserRole } from '@sba/shared';
import { hash } from 'argon2';
import { Secret, TOTP } from 'otpauth';

export const PASSWORD = 'correct-horse-battery-staple';

let client: PrismaClient | null = null;
/** Owner connection for arranging fixtures (the app itself runs as sba_app). */
export function owner(): PrismaClient {
  client ??= createPrismaClient(process.env.E2E_OWNER_URL ?? '');
  return client;
}

const keyRing = () => KeyRing.fromFile(process.env.E2E_MASTER_KEYS_FILE ?? '', 'kek-e2e-01');
const unique = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${randomInt(1e6).toString(36)}`;

export interface Staff {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly totp: TOTP;
}

/** An ACTIVE staff member with MFA already enabled. */
export async function createStaff(
  roles: readonly UserRole[],
  options: { orgUnitCode?: string; fullName?: string } = {},
): Promise<Staff> {
  const db = owner();
  if (roles.includes('GRAND_SYNDIC')) {
    // Exactly one active Grand Syndic is allowed by the database.
    await db.userRoleGrant.updateMany({
      where: { role: 'GRAND_SYNDIC', revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  const email = `${unique('staff')}@sba.invalid`;
  const fullName = options.fullName ?? unique('Staff ');
  const user = await db.user.create({
    data: { email, fullName, passwordHash: await hash(PASSWORD, { type: 2 }), status: 'ACTIVE' },
  });
  const orgUnitId = options.orgUnitCode
    ? (await db.organizationalUnit.findUniqueOrThrow({ where: { code: options.orgUnitCode } })).id
    : null;
  for (const role of roles)
    await db.userRoleGrant.create({ data: { userId: user.id, role, orgUnitId } });
  const secret = new Secret({ size: 20 });
  const sealed = keyRing().seal(Buffer.from(secret.base32, 'utf8'), Buffer.from(user.id, 'utf8'));
  await db.user.update({
    where: { id: user.id },
    data: {
      mfaTotpSecretEnc: Uint8Array.from(sealed.box),
      mfaKeyId: sealed.keyId,
      mfaEnabledAt: new Date(),
    },
  });
  return { id: user.id, email, fullName, totp: new TOTP({ secret }) };
}

export interface Lawyer {
  readonly id: string;
  readonly registrationNumber: string;
  readonly nationalId: string;
  readonly fullName: string;
}

export async function createLawyer(): Promise<Lawyer> {
  const db = owner();
  const registrationNumber = unique('REG-');
  const nationalId = String(randomInt(10_000_000_000, 99_999_999_999));
  const fullName = unique('Lawyer ');
  const sealed = keyRing().seal(Buffer.from(nationalId, 'utf8'));
  const pepper = Pepper.fromFile(process.env.E2E_PEPPER_FILE ?? '');
  const branch = await db.organizationalUnit.findUniqueOrThrow({
    where: { code: 'BRANCH_DAMASCUS' },
  });
  const user = await db.user.create({
    data: {
      fullName,
      phoneE164: `+9639${String(randomInt(1e8)).padStart(8, '0')}`,
      passwordHash: await hash(PASSWORD, { type: 2 }),
      status: 'ACTIVE',
    },
  });
  await db.userRoleGrant.create({ data: { userId: user.id, role: 'LAWYER' } });
  await db.lawyerProfile.create({
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
  return { id: user.id, registrationNumber, nationalId, fullName };
}

export async function ensureRoom(): Promise<void> {
  const db = owner();
  if (await db.room.findFirst({ where: { isActive: true } })) return;
  await db.room.create({ data: { code: 'E2E_HALL', nameAr: 'E2E hall', capacity: 10 } });
}

/** Staff sign-in through the real form: password, then the TOTP step. */
export async function signInStaff(page: Page, staff: Staff): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(staff.email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: t('login.submit') }).click();
  await page.locator('#otp').fill(staff.totp.generate());
  await page.getByRole('button', { name: t('login.verify') }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function signInLawyer(page: Page, lawyer: Lawyer): Promise<void> {
  await page.goto('/login');
  await page.getByRole('tab', { name: t('login.lawyerDoor') }).click();
  await page.locator('#registrationNumber').fill(lawyer.registrationNumber);
  await page.locator('#nationalId').fill(lawyer.nationalId);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: t('login.submit') }).click();
  await expect(page).toHaveURL(/\/lawyer$/);
}

/** yyyy-mm-dd of the Damascus day `days` from today. */
export function damascusDate(days: number): string {
  return new Date(Date.now() + 3 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * A pending reschedule link as an emergency postponement leaves it: a
 * postponed appointment and a single-use token whose SHA-256 alone is stored.
 */
export async function createRescheduleLink(ticketId: string): Promise<string> {
  const db = owner();
  const syndic = await createStaff(['GRAND_SYNDIC']);
  const day = damascusDate(5);
  const agendaDay = await db.agendaDay.create({
    data: { principalUserId: syndic.id, agendaDate: new Date(`${day}T00:00:00Z`) },
  });
  const appointment = await db.appointment.create({
    data: {
      ticketId,
      agendaDayId: agendaDay.id,
      principalUserId: syndic.id,
      startsAt: new Date(`${day}T10:00:00+03:00`),
      endsAt: new Date(`${day}T10:30:00+03:00`),
      meetingMode: 'REMOTE',
      meetingProvider: 'jitsi',
      meetingUrl: 'https://meet.example.test/sba-e2e',
      meetingExternalId: 'sba-e2e',
      scheduledByUserId: syndic.id,
    },
  });
  const token = randomBytes(32).toString('base64url');
  await db.actionToken.create({
    data: {
      purpose: 'RESCHEDULE_RESPONSE',
      tokenHash: Uint8Array.from(createHash('sha256').update(token).digest()),
      ticketId,
      appointmentId: appointment.id,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  return token;
}
