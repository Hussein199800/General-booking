import { randomBytes } from 'node:crypto';

import { KeyRing, Pepper } from '@sba/crypto';
import { APPOINTMENT_TRANSITIONS, TICKET_TRANSITIONS, normalizeNationalId } from '@sba/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../../src/client.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { seed } from '../../src/seed/seed.js';

const url = process.env.DATABASE_MIGRATION_URL;
if (!url) {
  throw new Error('Integration tests need DATABASE_MIGRATION_URL (a migrated, empty database)');
}

let db: PrismaClient;
const keyRing = KeyRing.fromJson(
  JSON.stringify({ 'kek-test-01': randomBytes(32).toString('base64') }),
  'kek-test-01',
);
const pepper = new Pepper(randomBytes(32));
const demo = { password: 'integration-test-password', keyRing, pepper };

beforeAll(() => {
  db = createPrismaClient(url);
});

afterAll(async () => {
  await db.$disconnect();
});

const flatten = <S extends string>(map: Readonly<Partial<Record<S, readonly S[]>>>) =>
  Object.entries<readonly S[] | undefined>(map)
    .flatMap(([from, targets]) => (targets ?? []).map((to) => `${from}->${to}`))
    .sort();

describe('state machines', () => {
  it('ticket_status_transitions equals the service-layer copy', async () => {
    const rows = await db.ticketStatusTransition.findMany();
    for (const kind of ['AUDIENCE_REQUEST', 'GRIEVANCE'] as const) {
      const inDb = rows
        .filter((row) => row.kind === kind)
        .map((row) => `${row.fromStatus}->${row.toStatus}`)
        .sort();
      expect(inDb, kind).toEqual(flatten(TICKET_TRANSITIONS[kind]));
    }
  });

  it('appointment_status_transitions equals the service-layer copy', async () => {
    const rows = await db.appointmentStatusTransition.findMany();
    expect(rows.map((row) => `${row.fromStatus}->${row.toStatus}`).sort()).toEqual(
      flatten(APPOINTMENT_TRANSITIONS),
    );
  });
});

describe('runtime role privileges', () => {
  it('sba_app cannot delete legal records or rewrite audit history', async () => {
    const rows = await db.$queryRaw<{ table: string; privilege: string }[]>`
      SELECT table_name AS table, privilege_type AS privilege
      FROM information_schema.role_table_grants
      WHERE grantee = 'sba_app'
        AND ((table_name IN ('tickets', 'documents', 'appointments', 'users') AND privilege_type = 'DELETE')
          OR (table_name = 'audit_logs' AND privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE'))
          OR table_name IN ('audit_chain_head', '_prisma_migrations'))`;
    expect(rows).toEqual([]);
  });
});

describe('seed', () => {
  it('is all-or-nothing', async () => {
    await expect(
      db.$transaction(async (tx) => {
        await seed(tx, null);
        throw new Error('abort after seeding');
      }),
    ).rejects.toThrow('abort after seeding');
    expect(await db.organizationalUnit.count()).toBe(0);
  });

  it('seeds reference data, templates and demo users', async () => {
    const summary = await db.$transaction((tx) => seed(tx, demo), { timeout: 60_000 });
    expect(summary).toEqual({
      organizationalUnits: 17,
      externalEntities: 2,
      templatesCreated: 18,
      templatesSuperseded: 0,
      demoUsersCreated: 10,
    });
    expect(await db.organizationalUnit.count({ where: { unitType: 'REGIONAL_BRANCH' } })).toBe(14);
    const grandSyndics = await db.userRoleGrant.count({
      where: { role: 'GRAND_SYNDIC', revokedAt: null },
    });
    expect(grandSyndics).toBe(1);
  });

  it('stores lawyer national IDs only as HMAC and sealed ciphertext', async () => {
    const profile = await db.lawyerProfile.findUniqueOrThrow({
      where: { registrationNumber: 'DEMO-0001' },
    });
    const nationalId = normalizeNationalId('00000000001') ?? '';
    expect(pepper.matches(nationalId, Buffer.from(profile.nationalIdHmac))).toBe(true);
    expect(
      keyRing.open(profile.nationalIdKeyId, Buffer.from(profile.nationalIdEnc)).toString(),
    ).toBe(nationalId);
    expect(Buffer.from(profile.nationalIdEnc).includes(Buffer.from(nationalId))).toBe(false);
  });

  it('is idempotent', async () => {
    const summary = await db.$transaction((tx) => seed(tx, demo), { timeout: 60_000 });
    expect(summary).toEqual({
      organizationalUnits: 0,
      externalEntities: 0,
      templatesCreated: 0,
      templatesSuperseded: 0,
      demoUsersCreated: 0,
    });
  });

  it('versions changed template wording instead of editing it', async () => {
    const active = await db.notificationTemplate.findFirstOrThrow({
      where: { code: 'REQUEST_RECEIVED', channel: 'SMS', isActive: true },
    });
    // Simulate wording that was approved earlier and has since changed in ar.json.
    await db.notificationTemplate.update({
      where: { id: active.id },
      data: { body: 'old wording' },
    });

    const summary = await db.$transaction((tx) => seed(tx, null), { timeout: 60_000 });
    expect(summary.templatesSuperseded).toBe(1);

    const versions = await db.notificationTemplate.findMany({
      where: { code: 'REQUEST_RECEIVED', channel: 'SMS' },
      orderBy: { version: 'asc' },
    });
    expect(versions.map((v) => [v.version, v.isActive, v.body === 'old wording'])).toEqual([
      [1, false, true],
      [2, true, false],
    ]);
  });

  it('records every seed run in an intact audit chain', async () => {
    expect(await db.auditLog.count({ where: { action: 'system.seed' } })).toBe(3);
    const [result] = await db.$queryRaw<
      { broken: bigint | null }[]
    >`SELECT audit_verify_chain() AS broken`;
    expect(result?.broken).toBeNull();
  });
});
