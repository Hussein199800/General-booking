import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@sba/db';
import {
  canTransitionTicket,
  defaultPriority,
  formatDateTime,
  type BookingInput,
  type GrievanceInput,
  type MyTicket,
  type Page,
  type PriorityTier,
  type PublicAudienceRequestInput,
  type QueueQuery,
  type RequestStatus,
  type TicketDetail,
  type TicketSummary,
} from '@sba/shared';
import type { z } from 'zod';
import type {
  delegateSchema,
  lawyerAudienceRequestSchema,
  principalRequestSchema,
  requestDocumentsSchema,
} from '@sba/shared';

import { AuditService } from '../audit/audit.service.js';
import { AppError, sqlState } from '../common/app-error.js';
import type { Actor, RequestContext } from '../common/request-context.js';
import { APP_ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { agendaDate, damascusDay, sameDamascusDay } from '../domain/time.js';
import { newReferenceCode } from '../domain/reference-code.js';
import { MeetingProvider } from '../meetings/meeting-provider.js';
import { OutboxService } from '../notifications/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

export const ticketInclude = {
  audienceRequest: true,
  grievance: true,
  submittedByUser: { select: { fullName: true, phoneE164: true, email: true } },
  _count: { select: { documents: { where: { deletedAt: null } } } },
} as const satisfies Prisma.TicketInclude;

export type TicketRow = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

const OPEN_STATUSES: RequestStatus[] = ['PENDING_REVIEW', 'AWAITING_DOCUMENTS'];
const PRIORITY_ORDER: Record<PriorityTier, number> = { CRITICAL: 0, INTERNAL: 1, STANDARD: 2 };

export function toSummary(row: TicketRow): TicketSummary {
  const audience = row.audienceRequest;
  const grievance = row.grievance;
  return {
    id: row.id,
    referenceCode: row.referenceCode,
    kind: row.kind,
    status: row.status,
    priority: row.priority,
    submittedAt: row.submittedAt.toISOString(),
    statusChangedAt: row.statusChangedAt.toISOString(),
    requesterName: audience?.requesterFullName ?? row.submittedByUser?.fullName ?? '',
    requesterType: audience?.requesterType ?? 'LAWYER',
    capacity: audience?.officialCapacity ?? '',
    organization: audience?.organizationName ?? '',
    summary: audience?.purpose ?? grievance?.subject ?? '',
    preferredMeetingMode: audience?.preferredMeetingMode ?? null,
    fromPrincipal: row.submissionChannel === 'STAFF_ENTRY',
    attachmentsCount: row._count.documents,
  };
}

/** Contact details for notifications about a ticket. */
export function contactOf(row: TicketRow) {
  return {
    phone: row.audienceRequest?.contactPhoneE164 ?? row.submittedByUser?.phoneE164 ?? null,
    email: row.audienceRequest?.contactEmail ?? row.submittedByUser?.email ?? null,
    userId: row.submittedByUserId,
  };
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly meetings: MeetingProvider,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  // ---------------------------------------------------------------- intake

  async createPublicRequest(input: PublicAudienceRequestInput, ctx: RequestContext) {
    return this.withReference('REQ', async (tx, referenceCode) => {
      const entity = input.externalEntityCode
        ? await tx.externalEntity.findUnique({ where: { code: input.externalEntityCode } })
        : null;
      if (input.externalEntityCode && !entity?.isActive)
        throw new AppError('VALIDATION', {}, ['externalEntityCode']);
      const priority = entity?.defaultPriority ?? defaultPriority(input.requesterType);

      const ticket = await tx.ticket.create({
        data: {
          referenceCode,
          kind: 'AUDIENCE_REQUEST',
          priority,
          submissionChannel: 'PUBLIC_PORTAL',
        },
      });
      await tx.audienceRequest.create({
        data: {
          ticketId: ticket.id,
          requesterType: input.requesterType,
          requesterFullName: input.requesterFullName,
          officialCapacity: input.officialCapacity,
          organizationName: input.organizationName ?? entity?.nameAr ?? null,
          externalEntityId: entity?.id ?? null,
          contactPhoneE164: input.contactPhone,
          contactEmail: input.contactEmail ?? null,
          purpose: input.purpose,
          preferredMeetingMode: input.preferredMeetingMode ?? null,
          expectedAttendees: input.expectedAttendees,
        },
      });
      await this.afterIntake(tx, ctx, ticket.id, referenceCode, {
        phone: input.contactPhone,
        email: input.contactEmail ?? null,
      });
      return { referenceCode };
    });
  }

  async createLawyerRequest(
    input: z.infer<typeof lawyerAudienceRequestSchema>,
    ctx: RequestContext,
  ) {
    const actor = requireActor(ctx);
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: actor.userId },
      include: { lawyerProfile: { include: { branch: true } } },
    });
    if (!user.phoneE164) throw new AppError('VALIDATION', {}, ['contactPhone']);
    return this.withReference('REQ', async (tx, referenceCode) => {
      const ticket = await tx.ticket.create({
        data: {
          referenceCode,
          kind: 'AUDIENCE_REQUEST',
          priority: defaultPriority('LAWYER'),
          submissionChannel: 'LAWYER_PORTAL',
          submittedByUserId: actor.userId,
        },
      });
      await tx.audienceRequest.create({
        data: {
          ticketId: ticket.id,
          requesterType: 'LAWYER',
          requesterFullName: user.fullName,
          officialCapacity: user.lawyerProfile?.branch.nameAr ?? '',
          contactPhoneE164: user.phoneE164 ?? '',
          contactEmail: user.email,
          purpose: input.purpose,
          preferredMeetingMode: input.preferredMeetingMode ?? null,
          expectedAttendees: input.expectedAttendees,
        },
      });
      await this.afterIntake(tx, ctx, ticket.id, referenceCode, {
        phone: user.phoneE164,
        email: user.email,
        userId: user.id,
      });
      return { referenceCode };
    });
  }

  async createGrievance(input: GrievanceInput, ctx: RequestContext) {
    const actor = requireActor(ctx);
    const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: actor.userId } });
    return this.withReference('GRV', async (tx, referenceCode) => {
      const ticket = await tx.ticket.create({
        data: {
          referenceCode,
          kind: 'GRIEVANCE',
          priority: 'INTERNAL',
          submissionChannel: 'LAWYER_PORTAL',
          submittedByUserId: actor.userId,
        },
      });
      const respondent =
        input.grievanceType === 'AGAINST_LAWYER'
          ? await tx.lawyerProfile.findUnique({
              where: { registrationNumber: input.respondentRegistrationNumber },
            })
          : null;
      await tx.grievance.create({
        data: {
          ticketId: ticket.id,
          grievanceType: input.grievanceType,
          subject: input.subject,
          description: input.description,
          respondentLawyerId: respondent?.userId ?? null,
          respondentRegistrationNumber:
            input.grievanceType === 'AGAINST_LAWYER' ? input.respondentRegistrationNumber : null,
          courtName: input.grievanceType === 'JUDICIAL_MATTER' ? input.courtName : null,
          caseNumber: input.grievanceType === 'JUDICIAL_MATTER' ? (input.caseNumber ?? null) : null,
          incidentDate: input.incidentDate ? new Date(`${input.incidentDate}T00:00:00Z`) : null,
        },
      });
      await this.afterIntake(tx, ctx, ticket.id, referenceCode, {
        phone: user.phoneE164,
        email: user.email,
        userId: user.id,
      });
      return { referenceCode };
    });
  }

  /** The Grand Syndic asks the Secretariat to arrange a meeting (enters the normal queue). */
  async createPrincipalRequest(input: z.infer<typeof principalRequestSchema>, ctx: RequestContext) {
    const actor = requireActor(ctx);
    return this.withReference('REQ', async (tx, referenceCode) => {
      const ticket = await tx.ticket.create({
        data: {
          referenceCode,
          kind: 'AUDIENCE_REQUEST',
          priority: input.priority,
          submissionChannel: 'STAFF_ENTRY',
          submittedByUserId: actor.userId,
        },
      });
      await tx.audienceRequest.create({
        data: {
          ticketId: ticket.id,
          requesterType: input.requesterType,
          requesterFullName: input.requesterFullName,
          officialCapacity: '',
          contactPhoneE164: input.contactPhone,
          purpose: input.purpose,
        },
      });
      await this.audit.record(tx, ctx, {
        action: 'ticket.create',
        entityType: 'ticket',
        entityId: ticket.id,
        after: { status: 'PENDING_REVIEW', referenceCode, channel: 'STAFF_ENTRY' },
      });
      return { referenceCode };
    });
  }

  // ----------------------------------------------------------------- reading

  async listMine(ctx: RequestContext): Promise<MyTicket[]> {
    const actor = requireActor(ctx);
    const rows = await this.prisma.client.ticket.findMany({
      where: { submittedByUserId: actor.userId },
      include: {
        ...ticketInclude,
        appointments: {
          where: { status: 'SCHEDULED' },
          select: { startsAt: true, endsAt: true, meetingMode: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => {
      const appointment = row.appointments[0];
      return {
        id: row.id,
        referenceCode: row.referenceCode,
        kind: row.kind,
        status: row.status,
        submittedAt: row.submittedAt.toISOString(),
        summary: toSummary(row).summary,
        appointment: appointment
          ? {
              startsAt: appointment.startsAt.toISOString(),
              endsAt: appointment.endsAt.toISOString(),
              mode: appointment.meetingMode,
            }
          : null,
      };
    });
  }

  async queue(query: QueueQuery): Promise<Page<TicketSummary>> {
    const where: Prisma.TicketWhereInput = {
      status: query.status ?? { in: OPEN_STATUSES },
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.q
        ? {
            OR: [
              { referenceCode: { contains: query.q, mode: 'insensitive' } },
              {
                audienceRequest: { requesterFullName: { contains: query.q, mode: 'insensitive' } },
              },
              { audienceRequest: { organizationName: { contains: query.q, mode: 'insensitive' } } },
              { audienceRequest: { purpose: { contains: query.q, mode: 'insensitive' } } },
              { grievance: { subject: { contains: query.q, mode: 'insensitive' } } },
              { submittedByUser: { fullName: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.TicketOrderByWithRelationInput[] =
      query.sort === 'newest' ? [{ submittedAt: 'desc' }] : [{ submittedAt: 'asc' }];
    const [total, rows] = await Promise.all([
      this.prisma.client.ticket.count({ where }),
      this.prisma.client.ticket.findMany({
        where,
        include: ticketInclude,
        orderBy:
          query.sort === 'priority' ? [{ priority: 'asc' }, { submittedAt: 'asc' }] : orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    // Enum order in PostgreSQL is CRITICAL < INTERNAL < STANDARD, so 'asc' already puts red first.
    const items = rows.map(toSummary);
    if (query.sort === 'priority')
      items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async detail(id: string): Promise<TicketDetail> {
    const row = await this.prisma.client.ticket.findUnique({
      where: { id },
      include: ticketInclude,
    });
    if (!row) throw new AppError('NOT_FOUND');
    const history = await this.prisma.client.auditLog.findMany({
      where: { entityType: 'ticket', entityId: id },
      orderBy: { id: 'asc' },
      select: { occurredAt: true, action: true },
    });
    const g = row.grievance;
    return {
      ...toSummary(row),
      description: row.audienceRequest?.purpose ?? g?.description ?? '',
      contactPhone: contactOf(row).phone,
      contactEmail: contactOf(row).email,
      grievance: g
        ? {
            type: g.grievanceType,
            respondentRegistrationNumber: g.respondentRegistrationNumber,
            courtName: g.courtName,
            caseNumber: g.caseNumber,
            incidentDate: g.incidentDate?.toISOString().slice(0, 10) ?? null,
          }
        : null,
      history: history.map((h) => ({ at: h.occurredAt.toISOString(), action: h.action })),
    };
  }

  // ---------------------------------------------------------- Secretariat

  async approve(id: string, input: BookingInput, ctx: RequestContext) {
    const actor = requireActor(ctx);
    if (!sameDamascusDay(input.startsAt, input.endsAt))
      throw new AppError('VALIDATION', {}, ['endsAt']);
    // Audiences are booked ahead; a start in the past is a typing error, not a booking.
    if (input.startsAt.getTime() <= Date.now()) throw new AppError('VALIDATION', {}, ['startsAt']);
    const principal = await this.grandSyndic();

    return this.prisma.client.$transaction(async (tx) => {
      const ticket = await this.loadForTransition(tx, id, 'APPROVED');
      const location = await this.location(tx, input);
      const day = await upsertAgendaDay(tx, principal, input.startsAt);
      const appointment = await tx.appointment.create({
        data: {
          ticketId: ticket.id,
          agendaDayId: day.id,
          principalUserId: principal,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          meetingMode: input.meetingMode,
          roomId: location.roomId,
          meetingProvider: location.meeting?.provider ?? null,
          meetingUrl: location.meeting?.url ?? null,
          meetingExternalId: location.meeting?.externalId ?? null,
          scheduledByUserId: actor.userId,
        },
      });
      if (ticket.submittedByUserId && ticket.submissionChannel === 'LAWYER_PORTAL') {
        // A registered lawyer cannot be booked into two overlapping meetings (attendee EXCLUDE).
        await tx.appointmentAttendee.create({
          data: {
            appointmentId: appointment.id,
            userId: ticket.submittedByUserId,
            attendeeRole: 'REQUESTER',
            fullName: ticket.submittedByUser?.fullName ?? '',
          },
        });
      }
      await this.transition(tx, ctx, ticket, 'APPROVED', 'ticket.approve', {
        appointmentId: appointment.id,
        startsAt: input.startsAt.toISOString(),
        endsAt: input.endsAt.toISOString(),
        meetingMode: input.meetingMode,
      });
      await this.outbox.enqueue(tx, {
        code:
          input.meetingMode === 'REMOTE'
            ? 'APPOINTMENT_CONFIRMED_REMOTE'
            : 'APPOINTMENT_CONFIRMED_IN_PERSON',
        recipient: contactOf(ticket),
        payload: {
          referenceCode: ticket.referenceCode,
          dateTime: formatDateTime(input.startsAt),
          location: location.roomName ?? '',
          meetingUrl: location.meeting?.url ?? '',
        },
        ticketId: ticket.id,
        appointmentId: appointment.id,
        dedupeKey: `confirm:${appointment.id}`,
      });
      return { appointmentId: appointment.id };
    });
  }

  async delegate(id: string, input: z.infer<typeof delegateSchema>, ctx: RequestContext) {
    const actor = requireActor(ctx);
    return this.prisma.client.$transaction(async (tx) => {
      const ticket = await this.loadForTransition(tx, id, 'DELEGATED');
      let targetOrgUnitId: string | null = null;
      let targetExternalEntityId: string | null = null;
      let targetName: string;
      if (input.targetType === 'ORGANIZATIONAL_UNIT') {
        const unit = await tx.organizationalUnit.findUnique({ where: { code: input.targetCode } });
        if (
          !unit?.isActive ||
          unit.unitType === 'CENTRAL_SECRETARIAT' ||
          unit.unitType === 'GRAND_SYNDIC_OFFICE'
        ) {
          throw new AppError('VALIDATION', {}, ['targetCode']);
        }
        targetOrgUnitId = unit.id;
        targetName = unit.nameAr;
      } else {
        const entity = await tx.externalEntity.findUnique({ where: { code: input.targetCode } });
        if (!entity?.isActive) throw new AppError('VALIDATION', {}, ['targetCode']);
        targetExternalEntityId = entity.id;
        targetName = entity.nameAr;
      }
      const assignment = await tx.routingAssignment.create({
        data: {
          ticketId: ticket.id,
          targetType: input.targetType,
          targetOrgUnitId,
          targetExternalEntityId,
          instructions: input.instructions ?? null,
          assignedByUserId: actor.userId,
        },
      });
      await this.transition(tx, ctx, ticket, 'DELEGATED', 'ticket.delegate', {
        assignmentId: assignment.id,
        target: input.targetCode,
      });
      await this.outbox.enqueue(tx, {
        code: 'REQUEST_DELEGATED',
        recipient: contactOf(ticket),
        payload: { referenceCode: ticket.referenceCode, unitName: targetName },
        ticketId: ticket.id,
        dedupeKey: `delegate:${assignment.id}`,
      });
      return { assignmentId: assignment.id };
    });
  }

  async requestDocuments(
    id: string,
    input: z.infer<typeof requestDocumentsSchema>,
    ctx: RequestContext,
  ) {
    const actor = requireActor(ctx);
    const due = new Date(`${input.dueDate}T20:59:59Z`); // end of the day in Damascus
    if (due <= new Date()) throw new AppError('VALIDATION', {}, ['dueDate']);
    return this.prisma.client.$transaction(async (tx) => {
      const ticket = await this.loadForTransition(tx, id, 'AWAITING_DOCUMENTS');
      const request = await tx.documentRequest.create({
        data: {
          ticketId: ticket.id,
          requestedByUserId: actor.userId,
          message: input.message,
          dueAt: due,
        },
      });
      await this.transition(tx, ctx, ticket, 'AWAITING_DOCUMENTS', 'ticket.request_documents', {
        documentRequestId: request.id,
      });
      await this.outbox.enqueue(tx, {
        code: 'DOCUMENTS_REQUESTED',
        recipient: contactOf(ticket),
        payload: {
          referenceCode: ticket.referenceCode,
          documentsMessage: input.message,
          dueDate: formatDateTime(due),
          // Secure upload links arrive with document storage (Phase 3).
          uploadUrl: `${this.env.PUBLIC_BASE_URL}/`,
        },
        ticketId: ticket.id,
        dedupeKey: `docs:${request.id}`,
      });
      return { documentRequestId: request.id };
    });
  }

  /** Documents received: the request returns to review and the open request is fulfilled. */
  async documentsReceived(id: string, ctx: RequestContext) {
    return this.prisma.client.$transaction(async (tx) => {
      const ticket = await this.loadForTransition(tx, id, 'PENDING_REVIEW');
      if (ticket.status !== 'AWAITING_DOCUMENTS') throw new AppError('ILLEGAL_TRANSITION');
      await tx.documentRequest.updateMany({
        where: { ticketId: ticket.id, status: 'OPEN' },
        data: { status: 'FULFILLED', fulfilledAt: new Date() },
      });
      await this.transition(tx, ctx, ticket, 'PENDING_REVIEW', 'ticket.documents_received', {});
      return { ok: true };
    });
  }

  async decline(id: string, internalNote: string | undefined, ctx: RequestContext) {
    return this.prisma.client.$transaction(async (tx) => {
      const ticket = await this.loadForTransition(tx, id, 'DECLINED');
      await this.transition(
        tx,
        ctx,
        ticket,
        'DECLINED',
        'ticket.decline',
        internalNote ? { internalNote } : {},
      );
      await this.outbox.enqueue(tx, {
        code: 'REQUEST_DECLINED',
        recipient: contactOf(ticket),
        payload: { referenceCode: ticket.referenceCode },
        ticketId: ticket.id,
        dedupeKey: `decline:${ticket.id}`,
      });
      return { ok: true };
    });
  }

  async setPriority(id: string, priority: PriorityTier, ctx: RequestContext) {
    return this.prisma.client.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id } });
      if (!ticket) throw new AppError('NOT_FOUND');
      await tx.ticket.update({ where: { id }, data: { priority, version: { increment: 1 } } });
      await this.audit.record(tx, ctx, {
        action: 'ticket.priority',
        entityType: 'ticket',
        entityId: id,
        before: { priority: ticket.priority },
        after: { priority },
      });
      return { ok: true };
    });
  }

  // ---------------------------------------------------------------- helpers

  /** The Grand Syndic's user id (exactly one active grant, enforced by the DB). */
  async grandSyndic(): Promise<string> {
    const grant = await this.prisma.client.userRoleGrant.findFirst({
      where: { role: 'GRAND_SYNDIC', revokedAt: null },
      select: { userId: true },
    });
    if (!grant) throw new AppError('CONFLICT');
    return grant.userId;
  }

  private async loadForTransition(tx: Tx, id: string, to: RequestStatus): Promise<TicketRow> {
    const ticket = await tx.ticket.findUnique({ where: { id }, include: ticketInclude });
    if (!ticket) throw new AppError('NOT_FOUND');
    if (!canTransitionTicket(ticket.kind, ticket.status, to))
      throw new AppError('ILLEGAL_TRANSITION');
    return ticket;
  }

  /** Compare-and-set on status: a concurrent decision on the same ticket loses. */
  private async transition(
    tx: Tx,
    ctx: RequestContext,
    ticket: TicketRow,
    to: RequestStatus,
    action: string,
    metadata: Record<string, string>,
  ): Promise<void> {
    const updated = await tx.ticket.updateMany({
      where: { id: ticket.id, status: ticket.status, version: ticket.version },
      data: { status: to, version: { increment: 1 }, assignedOfficerId: requireActor(ctx).userId },
    });
    if (updated.count !== 1) throw new AppError('ILLEGAL_TRANSITION');
    await this.audit.record(tx, ctx, {
      action,
      entityType: 'ticket',
      entityId: ticket.id,
      before: { status: ticket.status },
      after: { status: to },
      metadata,
    });
  }

  private async location(tx: Tx, input: BookingInput) {
    if (input.meetingMode === 'REMOTE')
      return { roomId: null, roomName: null, meeting: this.meetings.createMeeting() };
    const room = await tx.room.findUnique({ where: { id: input.roomId ?? '' } });
    if (!room?.isActive) throw new AppError('VALIDATION', {}, ['roomId']);
    return { roomId: room.id, roomName: room.nameAr, meeting: null };
  }

  private async afterIntake(
    tx: Tx,
    ctx: RequestContext,
    ticketId: string,
    referenceCode: string,
    recipient: { phone: string | null; email: string | null; userId?: string },
  ) {
    await this.audit.record(tx, ctx, {
      action: 'ticket.create',
      entityType: 'ticket',
      entityId: ticketId,
      after: { status: 'PENDING_REVIEW', referenceCode },
    });
    await this.outbox.enqueue(tx, {
      code: 'REQUEST_RECEIVED',
      recipient,
      payload: { referenceCode },
      ticketId,
      dedupeKey: `received:${ticketId}`,
    });
  }

  /** Runs `work` with a fresh reference code, retrying on the (unlikely) collision. */
  private async withReference<T>(
    prefix: 'REQ' | 'GRV',
    work: (tx: Tx, code: string) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.client.$transaction((tx) => work(tx, newReferenceCode(prefix)));
      } catch (error) {
        const collision =
          sqlState(error) === '23505' && (error as Error).message.includes('reference_code');
        if (!collision || attempt >= 3) throw error;
      }
    }
  }
}

/**
 * The agenda day an appointment hangs off. Refuses suspended days with a clear
 * code (the DB trigger refuses them too, but only with a generic check error).
 */
export async function upsertAgendaDay(
  tx: Tx,
  principalUserId: string,
  startsAt: Date,
  options: { allowSuspended?: boolean } = {},
) {
  // ON CONFLICT DO NOTHING: two concurrent bookings on a new day must not fail on
  // the day row — the EXCLUDE constraint on appointments decides between them.
  await tx.$executeRaw`
    INSERT INTO agenda_days (principal_user_id, agenda_date)
    VALUES (${principalUserId}::uuid, ${damascusDay(startsAt)}::date)
    ON CONFLICT (principal_user_id, agenda_date) DO NOTHING`;
  const day = await tx.agendaDay.findUniqueOrThrow({
    where: {
      principalUserId_agendaDate: { principalUserId, agendaDate: agendaDate(startsAt) },
    },
  });
  if (day.isSuspended && !options.allowSuspended) throw new AppError('DAY_SUSPENDED');
  return day;
}

export function requireActor(ctx: RequestContext): Actor {
  if (!ctx.actor) throw new AppError('UNAUTHENTICATED');
  return ctx.actor;
}
