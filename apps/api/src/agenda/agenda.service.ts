import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@sba/db';
import {
  canTransitionAppointment,
  canTransitionTicket,
  formatDateTime,
  t,
  type AgendaItem,
  type BookingInput,
  type MemberOption,
  type UserRole,
} from '@sba/shared';
import type { z } from 'zod';
import type { ownEntrySchema, trackSchema, transferSchema } from '@sba/shared';

import { AuditService } from '../audit/audit.service.js';
import { randomToken, tokenHash } from '../auth/tokens.js';
import { AppError } from '../common/app-error.js';
import type { Actor, RequestContext } from '../common/request-context.js';
import { APP_ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { damascusDay, sameDamascusDay, startOfDamascusDay } from '../domain/time.js';
import { MeetingProvider } from '../meetings/meeting-provider.js';
import { OutboxService } from '../notifications/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  contactOf,
  requireActor,
  ticketInclude,
  TicketsService,
  upsertAgendaDay,
} from '../tickets/tickets.service.js';

type Tx = Prisma.TransactionClient;
type Viewer = 'PRINCIPAL' | 'SECRETARIAT';

const appointmentInclude = {
  room: { select: { id: true, nameAr: true } },
  ticket: { include: ticketInclude },
  transferredToUser: { select: { id: true, fullName: true } },
  transferredTo: { select: { id: true } },
} as const satisfies Prisma.AppointmentInclude;

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

const SECRETARIAT_ROLES: readonly UserRole[] = ['SECRETARIAT_HEAD', 'SECRETARIAT_OFFICER'];
const RESCHEDULE_LINK_DAYS = 14;

function isSecretariat(actor: Actor): boolean {
  return actor.roles.some((role) => SECRETARIAT_ROLES.includes(role));
}

function toItem(row: AppointmentRow, viewer: Viewer): AgendaItem {
  const audience = row.ticket?.audienceRequest;
  const masked = viewer === 'SECRETARIAT' && row.origin === 'PRINCIPAL' && row.isPrivate;
  return {
    id: row.id,
    origin: row.origin,
    principalId: row.principalUserId,
    status: row.status,
    referenceCode: row.ticket?.referenceCode ?? null,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    name: masked
      ? null
      : (row.title ?? audience?.requesterFullName ?? row.ticket?.submittedByUser?.fullName ?? ''),
    masked,
    capacity: masked ? '' : (audience?.officialCapacity ?? ''),
    organization: masked ? '' : (audience?.organizationName ?? ''),
    priority: row.ticket?.priority ?? null,
    mode: row.meetingMode,
    room: row.room ? { id: row.room.id, name: row.room.nameAr } : null,
    locationNote: masked ? null : row.locationNote,
    meetingUrl: masked ? null : row.meetingUrl,
    isPrivate: row.isPrivate,
    brief: masked ? '' : (audience?.purpose ?? row.ticket?.grievance?.subject ?? ''),
    transferredFromId: row.transferredFromId,
    transferredTo: row.transferredToUser
      ? { id: row.transferredToUser.id, name: row.transferredToUser.fullName }
      : null,
    transferNote: row.transferNote,
    pendingTransfer: row.status === 'TRANSFERRED' && row.transferredTo === null,
    arrivedAt: row.arrivedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly meetings: MeetingProvider,
    private readonly tickets: TicketsService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  // ----------------------------------------------------------------- reading

  /** Whose agenda the caller may read, and through which lens. */
  private async scope(
    actor: Actor,
    principalId?: string,
  ): Promise<{ principal: string; viewer: Viewer }> {
    if (actor.roles.includes('GRAND_SYNDIC')) {
      return { principal: actor.userId, viewer: 'PRINCIPAL' };
    }
    if (isSecretariat(actor)) {
      return {
        principal: principalId ?? (await this.tickets.grandSyndic()),
        viewer: 'SECRETARIAT',
      };
    }
    if (actor.roles.includes('COUNCIL_MEMBER')) {
      if (principalId && principalId !== actor.userId) throw new AppError('FORBIDDEN');
      return { principal: actor.userId, viewer: 'PRINCIPAL' };
    }
    throw new AppError('FORBIDDEN');
  }

  async list(
    ctx: RequestContext,
    from: Date,
    to: Date,
    principalId?: string,
  ): Promise<AgendaItem[]> {
    const actor = requireActor(ctx);
    const { principal, viewer } = await this.scope(actor, principalId);
    const rows = await this.prisma.client.appointment.findMany({
      where: { principalUserId: principal, startsAt: { lt: to }, endsAt: { gt: from } },
      include: appointmentInclude,
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((row) => toItem(row, viewer));
  }

  async pendingTransfers(ctx: RequestContext): Promise<AgendaItem[]> {
    const actor = requireActor(ctx);
    const where: Prisma.AppointmentWhereInput = { status: 'TRANSFERRED', transferredTo: null };
    if (!isSecretariat(actor)) {
      if (!actor.roles.includes('COUNCIL_MEMBER')) throw new AppError('FORBIDDEN');
      where.transferredToUserId = actor.userId;
    }
    const rows = await this.prisma.client.appointment.findMany({
      where,
      include: appointmentInclude,
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((row) => toItem(row, 'SECRETARIAT'));
  }

  async members(): Promise<MemberOption[]> {
    const grants = await this.prisma.client.userRoleGrant.findMany({
      where: { role: 'COUNCIL_MEMBER', revokedAt: null, user: { status: 'ACTIVE' } },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { user: { fullName: 'asc' } },
    });
    return grants.map((grant) => ({ id: grant.user.id, name: grant.user.fullName }));
  }

  // ------------------------------------------------- Grand Syndic's own entries

  async createOwnEntry(
    input: z.infer<typeof ownEntrySchema>,
    ctx: RequestContext,
  ): Promise<AgendaItem> {
    const actor = requireActor(ctx);
    if (!sameDamascusDay(input.startsAt, input.endsAt))
      throw new AppError('VALIDATION', {}, ['endsAt']);
    return this.prisma.client.$transaction(async (tx) => {
      const day = await upsertAgendaDay(tx, actor.userId, input.startsAt);
      const row = await tx.appointment.create({
        data: {
          origin: 'PRINCIPAL',
          title: input.title,
          isPrivate: input.isPrivate,
          locationNote: input.locationNote,
          meetingMode: input.meetingMode,
          agendaDayId: day.id,
          principalUserId: actor.userId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          scheduledByUserId: actor.userId,
        },
        include: appointmentInclude,
      });
      await this.audit.record(tx, ctx, {
        action: 'agenda.own_entry_create',
        entityType: 'appointment',
        entityId: row.id,
        // The title of a private entry stays out of the audit trail's readable fields.
        after: {
          startsAt: input.startsAt.toISOString(),
          endsAt: input.endsAt.toISOString(),
          isPrivate: input.isPrivate,
        },
      });
      return toItem(row, 'PRINCIPAL');
    });
  }

  async cancelOwnEntry(id: string, ctx: RequestContext): Promise<{ ok: true }> {
    const actor = requireActor(ctx);
    return this.prisma.client.$transaction(async (tx) => {
      const row = await tx.appointment.findUnique({ where: { id } });
      if (!row || row.principalUserId !== actor.userId || row.origin !== 'PRINCIPAL')
        throw new AppError('NOT_FOUND');
      if (!canTransitionAppointment(row.status, 'CANCELLED'))
        throw new AppError('ILLEGAL_TRANSITION');
      await tx.appointment.update({ where: { id }, data: { status: 'CANCELLED' } });
      await this.audit.record(tx, ctx, {
        action: 'agenda.own_entry_cancel',
        entityType: 'appointment',
        entityId: id,
        before: { status: row.status },
        after: { status: 'CANCELLED' },
      });
      return { ok: true as const };
    });
  }

  // ----------------------------------------------------------------- transfers

  async transfer(
    id: string,
    input: z.infer<typeof transferSchema>,
    ctx: RequestContext,
  ): Promise<AgendaItem> {
    const actor = requireActor(ctx);
    return this.prisma.client.$transaction(async (tx) => {
      const original = await tx.appointment.findUnique({
        where: { id },
        include: appointmentInclude,
      });
      if (!original || original.principalUserId !== actor.userId) throw new AppError('NOT_FOUND');
      if (original.origin !== 'SECRETARIAT' || original.startedAt)
        throw new AppError('ILLEGAL_TRANSITION');
      if (!canTransitionAppointment(original.status, 'TRANSFERRED'))
        throw new AppError('ILLEGAL_TRANSITION');
      const member = await this.requireMember(tx, input.memberId);

      const claimed = await tx.appointment.updateMany({
        where: { id, status: 'SCHEDULED' },
        data: {
          status: 'TRANSFERRED',
          transferredToUserId: member.id,
          transferNote: input.note ?? null,
        },
      });
      if (claimed.count !== 1) throw new AppError('ILLEGAL_TRANSITION');

      let continuationId: string | null = null;
      if (input.keepTime) {
        continuationId = await this.createContinuation(
          tx,
          original,
          member.id,
          actor.userId,
          {
            startsAt: original.startsAt,
            endsAt: original.endsAt,
            meetingMode: original.meetingMode,
            ...(original.roomId ? { roomId: original.roomId } : {}),
          },
          original.meetingUrl
            ? {
                provider: original.meetingProvider ?? 'jitsi',
                url: original.meetingUrl,
                externalId: original.meetingExternalId ?? '',
              }
            : null,
        );
      }
      await this.audit.record(tx, ctx, {
        action: 'agenda.transfer',
        entityType: 'appointment',
        entityId: id,
        before: { status: 'SCHEDULED' },
        after: { status: 'TRANSFERRED', memberId: member.id, keepTime: input.keepTime },
        ...(continuationId ? { metadata: { continuationId } } : {}),
      });
      if (original.ticket) {
        await this.outbox.enqueue(tx, {
          code: input.keepTime ? 'APPOINTMENT_TRANSFERRED' : 'APPOINTMENT_TRANSFERRED_NEW_TIME',
          recipient: contactOf(original.ticket),
          payload: {
            dateTime: formatDateTime(original.startsAt),
            memberName: member.fullName,
            memberCapacity: t('labels.role.COUNCIL_MEMBER'),
          },
          ticketId: original.ticket.id,
          appointmentId: id,
          dedupeKey: `transfer:${id}`,
        });
      }
      const updated = await tx.appointment.findUniqueOrThrow({
        where: { id },
        include: appointmentInclude,
      });
      return toItem(updated, 'PRINCIPAL');
    });
  }

  /** The receiving member, or the Secretariat, sets the new time of a pending transfer. */
  async scheduleTransfer(
    id: string,
    input: BookingInput,
    ctx: RequestContext,
  ): Promise<{ appointmentId: string }> {
    const actor = requireActor(ctx);
    if (!sameDamascusDay(input.startsAt, input.endsAt))
      throw new AppError('VALIDATION', {}, ['endsAt']);
    return this.prisma.client.$transaction(async (tx) => {
      const original = await tx.appointment.findUnique({
        where: { id },
        include: appointmentInclude,
      });
      if (!original || original.status !== 'TRANSFERRED' || !original.transferredToUserId)
        throw new AppError('NOT_FOUND');
      if (!isSecretariat(actor) && actor.userId !== original.transferredToUserId)
        throw new AppError('NOT_FOUND');
      if (original.transferredTo) throw new AppError('ILLEGAL_TRANSITION');

      const meeting = input.meetingMode === 'REMOTE' ? this.meetings.createMeeting() : null;
      const continuationId = await this.createContinuation(
        tx,
        original,
        original.transferredToUserId,
        actor.userId,
        input,
        meeting,
      );
      await this.audit.record(tx, ctx, {
        action: 'agenda.transfer_schedule',
        entityType: 'appointment',
        entityId: id,
        after: { continuationId, startsAt: input.startsAt.toISOString() },
      });
      if (original.ticket) {
        const room = input.roomId
          ? await tx.room.findUnique({ where: { id: input.roomId } })
          : null;
        await this.outbox.enqueue(tx, {
          code:
            input.meetingMode === 'REMOTE'
              ? 'APPOINTMENT_CONFIRMED_REMOTE'
              : 'APPOINTMENT_CONFIRMED_IN_PERSON',
          recipient: contactOf(original.ticket),
          payload: {
            referenceCode: original.ticket.referenceCode,
            dateTime: formatDateTime(input.startsAt),
            location: room?.nameAr ?? '',
            meetingUrl: meeting?.url ?? '',
          },
          ticketId: original.ticket.id,
          appointmentId: continuationId,
          dedupeKey: `confirm:${continuationId}`,
        });
      }
      return { appointmentId: continuationId };
    });
  }

  private async createContinuation(
    tx: Tx,
    original: AppointmentRow,
    memberId: string,
    scheduledBy: string,
    booking: BookingInput,
    meeting: { provider: string; url: string; externalId: string } | null,
  ): Promise<string> {
    if (booking.meetingMode === 'IN_PERSON') {
      const room = await tx.room.findUnique({ where: { id: booking.roomId ?? '' } });
      if (!room?.isActive) throw new AppError('VALIDATION', {}, ['roomId']);
    }
    const day = await upsertAgendaDay(tx, memberId, booking.startsAt);
    const continuation = await tx.appointment.create({
      data: {
        ticketId: original.ticketId,
        transferredFromId: original.id,
        transferNote: original.transferNote,
        agendaDayId: day.id,
        principalUserId: memberId,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        meetingMode: booking.meetingMode,
        roomId: booking.meetingMode === 'IN_PERSON' ? (booking.roomId ?? null) : null,
        meetingProvider: meeting?.provider ?? null,
        meetingUrl: meeting?.url ?? null,
        meetingExternalId: meeting?.externalId ?? null,
        scheduledByUserId: scheduledBy,
      },
    });
    return continuation.id;
  }

  private async requireMember(tx: Tx, userId: string) {
    const grant = await tx.userRoleGrant.findFirst({
      where: { userId, role: 'COUNCIL_MEMBER', revokedAt: null, user: { status: 'ACTIVE' } },
      include: { user: { select: { id: true, fullName: true } } },
    });
    if (!grant) throw new AppError('VALIDATION', {}, ['memberId']);
    return grant.user;
  }

  // ------------------------------------------------------------ live tracking

  async track(
    id: string,
    step: z.infer<typeof trackSchema>['step'],
    ctx: RequestContext,
  ): Promise<AgendaItem> {
    return this.prisma.client.$transaction(async (tx) => {
      const row = await tx.appointment.findUnique({ where: { id }, include: appointmentInclude });
      if (!row || row.origin !== 'SECRETARIAT') throw new AppError('NOT_FOUND');
      if (row.status !== 'SCHEDULED') throw new AppError('ILLEGAL_TRANSITION');
      const now = new Date();
      let data: Prisma.AppointmentUpdateInput;
      switch (step) {
        case 'ARRIVED':
          if (row.arrivedAt) throw new AppError('ILLEGAL_TRANSITION');
          data = { arrivedAt: now };
          break;
        case 'STARTED':
          if (row.startedAt) throw new AppError('ILLEGAL_TRANSITION');
          data = { startedAt: now, arrivedAt: row.arrivedAt ?? now };
          break;
        case 'ENDED':
          data = {
            startedAt: row.startedAt ?? now,
            arrivedAt: row.arrivedAt ?? row.startedAt ?? now,
            endedAt: now,
            status: 'COMPLETED',
          };
          break;
        case 'NO_SHOW':
          if (row.arrivedAt) throw new AppError('ILLEGAL_TRANSITION');
          data = { status: 'NO_SHOW' };
          break;
      }
      await tx.appointment.update({ where: { id }, data });
      // A held (or missed) audience closes its request.
      if (
        (step === 'ENDED' || step === 'NO_SHOW') &&
        row.ticket &&
        canTransitionTicket(row.ticket.kind, row.ticket.status, 'CLOSED')
      ) {
        await tx.ticket.update({
          where: { id: row.ticket.id },
          data: { status: 'CLOSED', version: { increment: 1 } },
        });
      }
      await this.audit.record(tx, ctx, {
        action: `agenda.track_${step.toLowerCase()}`,
        entityType: 'appointment',
        entityId: id,
        after: { step, at: now.toISOString() },
      });
      return toItem(
        await tx.appointment.findUniqueOrThrow({ where: { id }, include: appointmentInclude }),
        'SECRETARIAT',
      );
    });
  }

  // -------------------------------------------------------- emergency reschedule

  /**
   * Postpones the rest of today's audiences with the Grand Syndic in one
   * transaction: each becomes POSTPONED, its request returns to the queue, a
   * single-use reschedule link is issued and an apology is queued. The day is
   * suspended so nothing new is booked onto it.
   */
  async emergencyPostpone(from: Date | undefined, idempotencyKey: string, ctx: RequestContext) {
    const principal = await this.tickets.grandSyndic();
    const start = from ?? new Date();
    const dayStart = startOfDamascusDay(start);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    return this.prisma.client.$transaction(async (tx) => {
      const day = await upsertAgendaDay(tx, principal, start, { allowSuspended: true });
      const override = await tx.emergencyOverride.create({
        data: {
          agendaDayId: day.id,
          action: 'POSTPONE',
          effectiveFrom: start,
          initiatedByUserId: requireActor(ctx).userId,
          idempotencyKey,
          jobStatus: 'RUNNING',
        },
      });
      const affected = await tx.appointment.findMany({
        where: {
          principalUserId: principal,
          origin: 'SECRETARIAT',
          status: 'SCHEDULED',
          startedAt: null,
          startsAt: { gte: start, lt: dayEnd },
        },
        include: appointmentInclude,
      });
      for (const row of affected) {
        await tx.appointment.update({
          where: { id: row.id },
          data: { status: 'POSTPONED', emergencyOverrideId: override.id },
        });
        if (
          row.ticket &&
          canTransitionTicket(row.ticket.kind, row.ticket.status, 'PENDING_REVIEW')
        ) {
          await tx.ticket.update({
            where: { id: row.ticket.id },
            data: { status: 'PENDING_REVIEW', version: { increment: 1 } },
          });
        }
        const token = randomToken();
        if (row.ticket) {
          await tx.actionToken.create({
            data: {
              purpose: 'RESCHEDULE_RESPONSE',
              tokenHash: tokenHash(token),
              ticketId: row.ticket.id,
              appointmentId: row.id,
              expiresAt: new Date(Date.now() + RESCHEDULE_LINK_DAYS * 86_400_000),
            },
          });
          await this.outbox.enqueue(tx, {
            code: 'EMERGENCY_APOLOGY',
            recipient: contactOf(row.ticket),
            payload: {
              dateTime: formatDateTime(row.startsAt),
              rescheduleUrl: `${this.env.PUBLIC_BASE_URL}/reschedule/${token}`,
            },
            ticketId: row.ticket.id,
            appointmentId: row.id,
            emergencyOverrideId: override.id,
            dedupeKey: `apology:${row.id}`,
          });
        }
      }
      await tx.agendaDay.update({ where: { id: day.id }, data: { isSuspended: true } });
      await tx.emergencyOverride.update({
        where: { id: override.id },
        data: { jobStatus: 'COMPLETED', affectedCount: affected.length, completedAt: new Date() },
      });
      await this.audit.record(tx, ctx, {
        action: 'agenda.emergency_postpone',
        entityType: 'agenda_day',
        entityId: day.id,
        after: { day: damascusDay(start), from: start.toISOString(), affected: affected.length },
        metadata: { overrideId: override.id },
      });
      return { jobId: override.id, status: 'COMPLETED' as const, affected: affected.length };
    });
  }

  /** Public, single-use: the visitor confirms they want a new date (no slots shown). */
  async respondToReschedule(token: string, preference: string | undefined, ctx: RequestContext) {
    return this.prisma.client.$transaction(async (tx) => {
      const consumed = await tx.actionToken.updateMany({
        where: {
          tokenHash: tokenHash(token),
          purpose: 'RESCHEDULE_RESPONSE',
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date(), consumedIp: ctx.ip },
      });
      if (consumed.count !== 1) throw new AppError('LINK_INVALID');
      const record = await tx.actionToken.findUniqueOrThrow({
        where: { tokenHash: tokenHash(token) },
      });
      await this.audit.record(tx, ctx, {
        action: 'ticket.reschedule_response',
        entityType: 'ticket',
        entityId: record.ticketId,
        metadata: preference ? { preference } : {},
      });
      return { ok: true };
    });
  }
}
