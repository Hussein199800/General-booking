import type { KeyRing, Pepper } from '@sba/crypto';
import { normalizeNationalId, t, type UserRole } from '@sba/shared';
import { hash } from 'argon2';

import type { LawyerPracticeStatus } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { branchCode } from './reference-data.js';

/**
 * Demo accounts for local development only. Addresses use the reserved
 * `.invalid` TLD so nothing can ever be delivered to them, and the seed refuses
 * to create them when NODE_ENV=production.
 */
interface DemoStaff {
  readonly role: Exclude<UserRole, 'LAWYER'>;
  readonly scopeCode?: string;
}

interface DemoLawyer {
  readonly key: 'LAWYER' | 'LAWYER_TRAINEE';
  readonly registrationNumber: string;
  readonly nationalId: string;
  readonly practiceStatus: LawyerPracticeStatus;
}

const STAFF: readonly DemoStaff[] = [
  { role: 'SYSTEM_ADMIN' },
  { role: 'AUDITOR' },
  { role: 'GRAND_SYNDIC' },
  { role: 'SECRETARIAT_HEAD' },
  { role: 'SECRETARIAT_OFFICER' },
  { role: 'COUNCIL_MEMBER' },
  { role: 'BRANCH_OFFICER', scopeCode: branchCode('DAMASCUS') },
  { role: 'COMMITTEE_MEMBER', scopeCode: 'CENTRAL_DISCIPLINARY_COMMITTEE' },
];

const LAWYERS: readonly DemoLawyer[] = [
  {
    key: 'LAWYER',
    registrationNumber: 'DEMO-0001',
    nationalId: '00000000001',
    practiceStatus: 'PRACTISING',
  },
  {
    key: 'LAWYER_TRAINEE',
    registrationNumber: 'DEMO-0002',
    nationalId: '00000000002',
    practiceStatus: 'TRAINEE',
  },
];

export const DEMO_ROOM_CODE = 'DEMO_MEETING_ROOM';

export interface DemoSecrets {
  readonly password: string;
  readonly keyRing: KeyRing;
  readonly pepper: Pepper;
}

function demoEmail(key: string): string {
  return `demo.${key.toLowerCase().replace(/_/g, '-')}@sba.invalid`;
}

async function upsertUser(
  db: Prisma.TransactionClient,
  email: string,
  fullName: string,
  passwordHash: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };
  const user = await db.user.create({
    data: { email, fullName, passwordHash, status: 'ACTIVE' },
    select: { id: true },
  });
  return { id: user.id, created: true };
}

async function grantRole(
  db: Prisma.TransactionClient,
  userId: string,
  role: UserRole,
  orgUnitId: string | null,
): Promise<void> {
  const active = await db.userRoleGrant.findFirst({
    where: { userId, role, orgUnitId, revokedAt: null },
    select: { id: true },
  });
  if (!active) await db.userRoleGrant.create({ data: { userId, role, orgUnitId } });
}

export async function seedDemoData(
  db: Prisma.TransactionClient,
  secrets: DemoSecrets,
): Promise<number> {
  // One hash for all demo accounts: Argon2id is deliberately slow.
  const passwordHash = await hash(secrets.password, { type: 2 });
  let created = 0;

  const unitId = async (code: string): Promise<string> =>
    (await db.organizationalUnit.findUniqueOrThrow({ where: { code }, select: { id: true } })).id;

  for (const staff of STAFF) {
    const user = await upsertUser(
      db,
      demoEmail(staff.role),
      t(`demo.users.${staff.role}`),
      passwordHash,
    );
    if (user.created) created += 1;
    await grantRole(
      db,
      user.id,
      staff.role,
      staff.scopeCode ? await unitId(staff.scopeCode) : null,
    );
  }

  const damascus = await unitId(branchCode('DAMASCUS'));
  for (const lawyer of LAWYERS) {
    const user = await upsertUser(
      db,
      demoEmail(lawyer.key),
      t(`demo.users.${lawyer.key}`),
      passwordHash,
    );
    if (user.created) created += 1;
    await grantRole(db, user.id, 'LAWYER', null);

    const nationalId = normalizeNationalId(lawyer.nationalId);
    if (!nationalId) throw new Error(`Invalid demo national ID for ${lawyer.key}`);
    const sealed = secrets.keyRing.seal(Buffer.from(nationalId, 'utf8'));
    await db.lawyerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        registrationNumber: lawyer.registrationNumber,
        nationalIdHmac: Uint8Array.from(secrets.pepper.hmac(nationalId)),
        nationalIdEnc: Uint8Array.from(sealed.box),
        nationalIdKeyId: sealed.keyId,
        branchId: damascus,
        practiceStatus: lawyer.practiceStatus,
      },
    });
  }

  await db.room.upsert({
    where: { code: DEMO_ROOM_CODE },
    update: {},
    create: {
      code: DEMO_ROOM_CODE,
      nameAr: t('demo.roomName'),
      locationAr: t('demo.roomLocation'),
      capacity: 12,
      orgUnitId: await unitId('CENTRAL_SECRETARIAT'),
    },
  });

  return created;
}
