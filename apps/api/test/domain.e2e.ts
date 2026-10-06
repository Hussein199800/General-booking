import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from './helpers/app.js';
import {
  Client,
  createGrandSyndic,
  createLawyer,
  createRoom,
  createStaff,
  damascus,
  idempotencyKey,
  type StaffFixture,
} from './helpers/fixtures.js';

let t: TestApp;
let server: Parameters<typeof request>[0];
let roomId: string;
let syndic: Client;
let syndicUser: StaffFixture;
let officer: Client;
let member: Client;
let memberUser: StaffFixture;

const PUBLIC_REQUEST = {
  requesterType: 'CITIZEN',
  requesterFullName: 'Test Visitor',
  officialCapacity: 'Citizen',
  contactPhone: '+963933000111',
  purpose: 'Requesting an audience about a professional matter.',
  preferredMeetingMode: 'IN_PERSON',
};

async function login(roles: Parameters<typeof createStaff>[1], orgUnitCode?: string) {
  const user = await createStaff(t.owner, roles, {
    mfa: true,
    ...(orgUnitCode ? { orgUnitCode } : {}),
  });
  const client = new Client(server);
  await client.loginStaff(user);
  return { user, client };
}

/** Submits a public request and returns its id and reference code. */
async function submitPublic(overrides: Record<string, unknown> = {}) {
  const res = await new Client(server).post(
    '/public/audience-requests',
    { ...PUBLIC_REQUEST, ...overrides },
    { csrf: false },
  );
  expect(res.status).toBe(201);
  const ticket = await t.owner.ticket.findUniqueOrThrow({
    where: { referenceCode: res.body.referenceCode as string },
  });
  return { id: ticket.id, referenceCode: ticket.referenceCode };
}

function inPerson(day: number, hour: number, minute = 0, minutes = 30) {
  const start = damascus(day, hour, minute);
  return {
    startsAt: start,
    endsAt: new Date(new Date(start).getTime() + minutes * 60_000).toISOString(),
    meetingMode: 'IN_PERSON',
    roomId,
  };
}

async function approve(ticketId: string, booking: object) {
  return officer.post(`/secretariat/requests/${ticketId}/approve`, booking);
}

async function ticketStatus(id: string) {
  return (await t.owner.ticket.findUniqueOrThrow({ where: { id } })).status;
}

beforeAll(async () => {
  t = await createTestApp();
  server = t.app.getHttpServer();
  roomId = await createRoom(t.owner);
  syndicUser = await createGrandSyndic(t.owner);
  syndic = new Client(server);
  await syndic.loginStaff(syndicUser);
  officer = (await login(['SECRETARIAT_OFFICER'])).client;
  ({ user: memberUser, client: member } = await login(['COUNCIL_MEMBER']));
});

afterAll(async () => {
  await t.close();
});

describe('intake', () => {
  it('accepts a public request as PENDING_REVIEW with a reference and a queued acknowledgement', async () => {
    const { id, referenceCode } = await submitPublic();
    expect(referenceCode).toMatch(/^REQ-\d{4}-[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(await ticketStatus(id)).toBe('PENDING_REVIEW');
    const queued = await t.owner.notification.findMany({ where: { ticketId: id } });
    expect(queued.map((n) => n.status)).toEqual(['QUEUED']);
    expect(queued[0]?.renderedBody).toContain(referenceCode);
  });

  it('rejects invalid input with field paths and no echoed values', async () => {
    const res = await new Client(server).post(
      '/public/audience-requests',
      { ...PUBLIC_REQUEST, contactPhone: '0933', purpose: 'short' },
      { csrf: false },
    );
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
    expect([...(res.body.fields as string[])].sort()).toEqual(['contactPhone', 'purpose']);
    expect(JSON.stringify(res.body)).not.toContain('0933');
  });

  it('refuses lawyers on the public form and keeps a lawyer’s tickets private', async () => {
    const [a, b] = [await createLawyer(t.owner), await createLawyer(t.owner)];
    const lawyerA = new Client(server);
    await lawyerA.loginLawyer(a);
    const lawyerB = new Client(server);
    await lawyerB.loginLawyer(b);

    const grievance = await lawyerA.post('/lawyer/grievances', {
      grievanceType: 'JUDICIAL_MATTER',
      subject: 'Delay in hearing',
      description: 'The hearing has been postponed repeatedly without notice.',
      courtName: 'Court of First Instance',
    });
    expect(grievance.status).toBe(201);
    expect(grievance.body.referenceCode).toMatch(/^GRV-/);
    const ticket = await t.owner.ticket.findUniqueOrThrow({
      where: { referenceCode: grievance.body.referenceCode as string },
    });

    const mineA = await lawyerA.get('/lawyer/me/tickets');
    expect(mineA.body.map((x: { id: string }) => x.id)).toEqual([ticket.id]);
    const mineB = await lawyerB.get('/lawyer/me/tickets');
    expect(mineB.body).toEqual([]);

    // Staff endpoints are closed to lawyers whatever the id.
    expect((await lawyerB.get(`/secretariat/requests/${ticket.id}`)).status).toBe(403);
    expect((await lawyerB.get('/secretariat/queue')).status).toBe(403);
    expect((await lawyerB.get(`/agenda?from=${damascus(2, 0)}&to=${damascus(3, 0)}`)).status).toBe(
      403,
    );

    const asLawyer = await new Client(server).post(
      '/public/audience-requests',
      { ...PUBLIC_REQUEST, requesterType: 'LAWYER' },
      { csrf: false },
    );
    expect(asLawyer.status).toBe(400);
  });
});

describe('Secretariat queue', () => {
  it('searches, filters and paginates', async () => {
    const marker = `Marker${Date.now().toString(36)}`;
    for (let i = 0; i < 3; i += 1) await submitPublic({ requesterFullName: `${marker} ${i}` });

    const page1 = await officer.get(`/secretariat/queue?q=${marker}&pageSize=2&sort=oldest`);
    expect(page1.status).toBe(200);
    expect(page1.body.total).toBe(3);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.items[0].requesterName).toBe(`${marker} 0`);
    const page2 = await officer.get(`/secretariat/queue?q=${marker}&pageSize=2&page=2&sort=oldest`);
    expect(page2.body.items.map((x: { requesterName: string }) => x.requesterName)).toEqual([
      `${marker} 2`,
    ]);

    const none = await officer.get(`/secretariat/queue?q=${marker}&status=DECLINED`);
    expect(none.body.total).toBe(0);
    expect((await officer.get('/secretariat/queue?pageSize=1000')).status).toBe(400);
  });

  it('requests documents, takes them back into review, and declines', async () => {
    const { id } = await submitPublic();
    const due = damascus(10, 12).slice(0, 10);
    const docs = await officer.post(`/secretariat/requests/${id}/request-documents`, {
      message: 'Please provide your ID card.',
      dueDate: due,
    });
    expect(docs.status).toBe(201);
    expect(await ticketStatus(id)).toBe('AWAITING_DOCUMENTS');

    expect((await officer.post(`/secretariat/requests/${id}/documents-received`)).status).toBe(200);
    expect(await ticketStatus(id)).toBe('PENDING_REVIEW');

    expect((await officer.post(`/secretariat/requests/${id}/decline`, {})).status).toBe(200);
    expect(await ticketStatus(id)).toBe('DECLINED');
    const again = await officer.post(`/secretariat/requests/${id}/decline`, {});
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ILLEGAL_TRANSITION');

    const detail = await officer.get(`/secretariat/requests/${id}`);
    expect(detail.body.history.map((h: { action: string }) => h.action)).toEqual([
      'ticket.create',
      'ticket.request_documents',
      'ticket.documents_received',
      'ticket.decline',
    ]);
  });

  it('replays a repeated mutation and rejects a reused key with a different body', async () => {
    const { id } = await submitPublic();
    const key = idempotencyKey();
    const first = await officer.post(
      `/secretariat/requests/${id}/priority`,
      { priority: 'CRITICAL' },
      { idempotencyKey: key },
    );
    const replay = await officer.post(
      `/secretariat/requests/${id}/priority`,
      { priority: 'CRITICAL' },
      { idempotencyKey: key },
    );
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotent-replay']).toBe('true');
    const changes = await t.owner.auditLog.count({
      where: { entityId: id, action: 'ticket.priority' },
    });
    expect(changes).toBe(1);

    const reused = await officer.post(
      `/secretariat/requests/${id}/priority`,
      { priority: 'STANDARD' },
      { idempotencyKey: key },
    );
    expect(reused.status).toBe(422);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

    const missing = await officer.post(
      `/secretariat/requests/${id}/priority`,
      { priority: 'STANDARD' },
      { idempotencyKey: false },
    );
    expect(missing.status).toBe(400);
  });

  it('loses access on the very next request after a role is revoked', async () => {
    const { user, client } = await login(['SECRETARIAT_OFFICER']);
    expect((await client.get('/secretariat/queue')).status).toBe(200);
    await t.owner.userRoleGrant.updateMany({
      where: { userId: user.id },
      data: { revokedAt: new Date() },
    });
    expect((await client.get('/secretariat/queue')).status).toBe(403);
  });
});

describe('appointments', () => {
  it('runs the whole path: approve → agenda → transfer (same time) → track → closed', async () => {
    const { id, referenceCode } = await submitPublic();
    const booking = inPerson(3, 10);
    const approved = await approve(id, booking);
    expect(approved.status).toBe(201);
    expect(await ticketStatus(id)).toBe('APPROVED');
    const confirmations = await t.owner.notification.count({
      where: { ticketId: id, template: { code: 'APPOINTMENT_CONFIRMED_IN_PERSON' } },
    });
    expect(confirmations).toBe(1);

    const range = `from=${damascus(3, 0)}&to=${damascus(4, 0)}`;
    const agenda = await syndic.get(`/agenda?${range}`);
    const item = agenda.body.find(
      (x: { referenceCode: string }) => x.referenceCode === referenceCode,
    );
    expect(item).toMatchObject({ status: 'SCHEDULED', startsAt: booking.startsAt, masked: false });

    const transfer = await syndic.post(`/syndic/appointments/${item.id as string}/transfer`, {
      memberId: memberUser.id,
      keepTime: true,
      note: 'Please receive on my behalf.',
    });
    expect(transfer.status).toBe(200);
    expect(transfer.body).toMatchObject({
      status: 'TRANSFERRED',
      transferredTo: { id: memberUser.id },
      pendingTransfer: false,
    });

    const memberAgenda = await member.get(`/agenda?${range}`);
    const continuation = memberAgenda.body.find(
      (x: { referenceCode: string }) => x.referenceCode === referenceCode,
    );
    expect(continuation).toMatchObject({
      status: 'SCHEDULED',
      startsAt: booking.startsAt,
      transferredFromId: item.id,
    });
    // A member cannot read the Grand Syndic's agenda.
    const peek = await member.get(`/agenda?${range}&principalId=${syndicUser.id}`);
    expect(peek.status).toBe(403);

    for (const step of ['ARRIVED', 'STARTED', 'ENDED']) {
      const res = await officer.post(`/agenda/appointments/${continuation.id as string}/track`, {
        step,
      });
      expect(res.status).toBe(200);
    }
    expect(await ticketStatus(id)).toBe('CLOSED');
    const done = await t.owner.appointment.findUniqueOrThrow({ where: { id: continuation.id } });
    expect(done.status).toBe('COMPLETED');
    expect(done.arrivedAt).not.toBeNull();
    expect(done.endedAt).not.toBeNull();
  });

  it('transfers for a new time, scheduled once by the receiving member', async () => {
    const { id } = await submitPublic();
    const approved = await approve(id, inPerson(4, 11));
    const appointmentId = approved.body.appointmentId as string;

    const transfer = await syndic.post(`/syndic/appointments/${appointmentId}/transfer`, {
      memberId: memberUser.id,
      keepTime: false,
    });
    expect(transfer.body.pendingTransfer).toBe(true);

    const pending = await member.get('/transfers/pending');
    expect(pending.body.map((x: { id: string }) => x.id)).toContain(appointmentId);
    const secretariatView = await officer.get('/transfers/pending');
    expect(secretariatView.body.map((x: { id: string }) => x.id)).toContain(appointmentId);

    const remote = {
      startsAt: damascus(5, 9),
      endsAt: damascus(5, 9, 30),
      meetingMode: 'REMOTE',
    };
    const scheduled = await member.post(`/transfers/${appointmentId}/schedule`, remote);
    expect(scheduled.status).toBe(201);
    const continuation = await t.owner.appointment.findUniqueOrThrow({
      where: { id: scheduled.body.appointmentId as string },
    });
    expect(continuation.principalUserId).toBe(memberUser.id);
    expect(continuation.meetingUrl).toMatch(/^https:\/\/meet\.example\.test\/sba-/);

    const twice = await member.post(`/transfers/${appointmentId}/schedule`, remote);
    expect(twice.status).toBe(409);
    expect(
      (await member.get('/transfers/pending')).body.map((x: { id: string }) => x.id),
    ).not.toContain(appointmentId);
  });

  it('lets only the receiving member (or the Secretariat) schedule a transfer', async () => {
    const { id } = await submitPublic();
    const approved = await approve(id, inPerson(4, 13));
    const appointmentId = approved.body.appointmentId as string;
    await syndic.post(`/syndic/appointments/${appointmentId}/transfer`, {
      memberId: memberUser.id,
      keepTime: false,
    });
    const other = (await login(['COUNCIL_MEMBER'])).client;
    const res = await other.post(`/transfers/${appointmentId}/schedule`, {
      startsAt: damascus(6, 9),
      endsAt: damascus(6, 9, 30),
      meetingMode: 'REMOTE',
    });
    expect(res.status).toBe(404);
    expect((await other.get('/transfers/pending')).body).toEqual([]);
  });

  it('masks the Grand Syndic’s private entries for the Secretariat and blocks booking over them', async () => {
    const entry = await syndic.post('/syndic/entries', {
      startsAt: damascus(6, 12),
      endsAt: damascus(6, 13),
      title: 'Private consultation',
      locationNote: 'Office',
      isPrivate: true,
    });
    expect(entry.status).toBe(201);

    const range = `from=${damascus(6, 0)}&to=${damascus(7, 0)}`;
    const forOfficer = (await officer.get(`/agenda?${range}`)).body.find(
      (x: { id: string }) => x.id === entry.body.id,
    );
    expect(forOfficer).toMatchObject({ masked: true, name: null, locationNote: null });
    expect(JSON.stringify(forOfficer)).not.toContain('Private consultation');
    const forSyndic = (await syndic.get(`/agenda?${range}`)).body.find(
      (x: { id: string }) => x.id === entry.body.id,
    );
    expect(forSyndic).toMatchObject({ masked: false, name: 'Private consultation' });

    const { id } = await submitPublic();
    const clash = await approve(id, inPerson(6, 12, 30));
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe('SLOT_CONFLICT');
    expect(await ticketStatus(id)).toBe('PENDING_REVIEW');

    // Cancelling the entry frees the time.
    expect((await syndic.post(`/syndic/entries/${entry.body.id as string}/cancel`)).status).toBe(
      200,
    );
    expect((await approve(id, inPerson(6, 12, 30))).status).toBe(201);
  });

  it('lets exactly one of two concurrent approvals for the same slot succeed', async () => {
    const [a, b] = [await submitPublic(), await submitPublic()];
    const booking = inPerson(7, 10);
    const results = await Promise.all([approve(a.id, booking), approve(b.id, booking)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)?.body.code).toBe('SLOT_CONFLICT');
    const statuses = [await ticketStatus(a.id), await ticketStatus(b.id)].sort();
    expect(statuses).toEqual(['APPROVED', 'PENDING_REVIEW']);
  });

  it('refuses an appointment that spans two days or a room that does not exist', async () => {
    const { id } = await submitPublic();
    const crossing = await approve(id, {
      startsAt: damascus(8, 23, 30),
      endsAt: damascus(9, 0, 30),
      meetingMode: 'REMOTE',
    });
    expect(crossing.status).toBe(400);
    const noRoom = await approve(id, { ...inPerson(8, 10), roomId: crypto.randomUUID() });
    expect(noRoom.status).toBe(400);
    expect(noRoom.body.fields).toEqual(['roomId']);
  });

  it('postpones the rest of the day in an emergency with single-use reschedule links', async () => {
    const a = await submitPublic();
    const b = await submitPublic();
    await approve(a.id, inPerson(9, 10));
    await approve(b.id, inPerson(9, 11));

    const head = (await login(['SECRETARIAT_HEAD'])).client;
    const res = await head.post('/syndic/emergency-reschedule', { from: damascus(9, 0) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'COMPLETED', affected: 2 });
    expect(await ticketStatus(a.id)).toBe('PENDING_REVIEW');
    expect(await ticketStatus(b.id)).toBe('PENDING_REVIEW');

    const apology = await t.owner.notification.findFirstOrThrow({
      where: { ticketId: a.id, template: { code: 'EMERGENCY_APOLOGY' } },
    });
    const url = (apology.payload as { rescheduleUrl: string }).rescheduleUrl;
    const token = url.split('/reschedule/')[1]!;
    // Only the hash is stored.
    expect(await t.owner.actionToken.count({ where: { ticketId: a.id } })).toBe(1);

    const anon = new Client(server);
    const first = await anon.post(`/public/reschedule/${token}`, {}, { csrf: false });
    expect(first.status).toBe(200);
    expect(JSON.stringify(first.body)).not.toMatch(/startsAt|slot|available/i);
    const second = await anon.post(`/public/reschedule/${token}`, {}, { csrf: false });
    expect(second.status).toBe(410);
    expect(second.body.code).toBe('LINK_INVALID');

    // The day is suspended: nothing new can be booked on it.
    const blocked = await approve(a.id, inPerson(9, 15));
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('DAY_SUSPENDED');
  });
});

describe('delegation to units', () => {
  it('shows a delegated matter only to its own branch, which can close or return it', async () => {
    const damascusOfficer = (await login(['BRANCH_OFFICER'], 'BRANCH_DAMASCUS')).client;
    const aleppoOfficer = (await login(['BRANCH_OFFICER'], 'BRANCH_ALEPPO')).client;

    const closeMe = await submitPublic();
    const returnMe = await submitPublic();
    for (const ticket of [closeMe, returnMe]) {
      const res = await officer.post(`/secretariat/requests/${ticket.id}/delegate`, {
        targetType: 'ORGANIZATIONAL_UNIT',
        targetCode: 'BRANCH_DAMASCUS',
        instructions: 'For your handling.',
      });
      expect(res.status).toBe(201);
      expect(await ticketStatus(ticket.id)).toBe('DELEGATED');
    }

    const inbox = await damascusOfficer.get('/units/inbox');
    const byTicket = new Map(
      inbox.body.map((x: { ticket: { id: string }; assignmentId: string }) => [
        x.ticket.id,
        x.assignmentId,
      ]),
    );
    const closeAssignment = byTicket.get(closeMe.id) as string;
    const returnAssignment = byTicket.get(returnMe.id) as string;
    expect(closeAssignment).toBeDefined();
    expect(returnAssignment).toBeDefined();

    expect((await aleppoOfficer.get('/units/inbox')).body).toEqual([]);
    expect((await aleppoOfficer.get(`/units/assignments/${closeAssignment}`)).status).toBe(404);
    expect(
      (await aleppoOfficer.post(`/units/assignments/${closeAssignment}/close`, {})).status,
    ).toBe(404);

    expect(
      (await damascusOfficer.post(`/units/assignments/${closeAssignment}/acknowledge`)).status,
    ).toBe(200);
    expect(
      (await damascusOfficer.post(`/units/assignments/${closeAssignment}/close`, { note: 'Done' }))
        .status,
    ).toBe(200);
    expect(await ticketStatus(closeMe.id)).toBe('CLOSED');

    expect(
      (await damascusOfficer.post(`/units/assignments/${returnAssignment}/return`, {})).status,
    ).toBe(200);
    expect(await ticketStatus(returnMe.id)).toBe('PENDING_REVIEW');
  });

  it('refuses delegation to the Secretariat itself or an unknown unit', async () => {
    const { id } = await submitPublic();
    for (const targetCode of ['CENTRAL_SECRETARIAT', 'NO_SUCH_UNIT']) {
      const res = await officer.post(`/secretariat/requests/${id}/delegate`, {
        targetType: 'ORGANIZATIONAL_UNIT',
        targetCode,
      });
      expect(res.status).toBe(400);
    }
    expect(await ticketStatus(id)).toBe('PENDING_REVIEW');
  });
});

describe('administration and oversight', () => {
  it('lets a system administrator create staff, who must then enrol MFA', async () => {
    const admin = (await login(['SYSTEM_ADMIN'])).client;
    const email = `new${Date.now().toString(36)}@sba.invalid`;
    const created = await admin.post('/admin/users', {
      fullName: 'New Officer',
      email,
      password: 'a-long-initial-passphrase',
      roles: [{ role: 'SECRETARIAT_OFFICER' }],
    });
    expect(created.status).toBe(201);
    const login2 = await new Client(server).post(
      '/auth/staff/login',
      { email, password: 'a-long-initial-passphrase' },
      { idempotencyKey: false, csrf: false },
    );
    expect(login2.body).toEqual({ status: 'MFA_ENROLLMENT_REQUIRED' });

    expect((await officer.get('/admin/users')).status).toBe(403);
    const list = await admin.get('/admin/users');
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|mfaTotpSecret/);
  });

  it('keeps an intact audit chain that only auditors can read', async () => {
    const auditor = (await login(['AUDITOR'])).client;
    const verify = await auditor.get('/audit/verify');
    expect(verify.body).toEqual({ intact: true, firstBrokenId: null });
    const page = await auditor.get('/audit?pageSize=5');
    expect(page.body.items).toHaveLength(5);
    expect((await officer.get('/audit/verify')).status).toBe(403);

    const head = (await login(['SECRETARIAT_HEAD'])).client;
    const summary = await head.get('/reports/summary');
    expect(summary.status).toBe(200);
    expect(summary.body.byStatus.PENDING_REVIEW).toBeGreaterThan(0);
  });
});
