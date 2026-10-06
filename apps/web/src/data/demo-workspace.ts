'use client';

import { GOVERNORATES, PRIORITY_TIERS, type PriorityTier, type RequestStatus } from '@sba/shared';

import { councilMembers, type DemoAppointment, type DemoTicket, type RoomCode } from '@/demo/data';
import {
  current,
  demoActions,
  isPendingTransfer,
  pendingTransfers,
  subscribe,
  type ActionResult,
  type DemoState,
} from '@/demo/store';
import { t } from '@/i18n';
import type { ApiResult } from '@/lib/api';
import { damascusIsoDate } from '@/lib/dates';

import type { Appt, Booking, Option, Ticket, TicketInfo } from './model';
import type { Lens, Workspace } from './workspace';

const ROOMS: readonly RoomCode[] = ['MAIN', 'COUNCIL'];
const OPEN: readonly RequestStatus[] = ['PENDING_REVIEW', 'AWAITING_DOCUMENTS'];
const RANK: Record<PriorityTier, number> = { CRITICAL: 0, INTERNAL: 1, STANDARD: 2 };

function ok<T>(value: T): ApiResult<T> {
  return { ok: true, value };
}

function fromAction(result: ActionResult): ApiResult<unknown> {
  if (result.ok) return ok(null);
  return result.reason === 'CONFLICT'
    ? { ok: false, code: 'SLOT_CONFLICT', message: t('errors.slotConflict'), status: 409 }
    : {
        ok: false,
        code: 'ILLEGAL_TRANSITION',
        message: t('errors.illegalTransition'),
        status: 409,
      };
}

function memberOption(id: string | null) {
  const member = councilMembers.find((x) => x.id === id);
  return member ? { id: member.id, name: member.name } : null;
}

function toAppt(s: DemoState, x: DemoAppointment, lens: Lens): Appt {
  const masked = lens.kind === 'SECRETARIAT' && x.origin === 'PRINCIPAL' && x.isPrivate;
  return {
    id: x.id,
    origin: x.origin,
    principalId: x.principal,
    status: x.status,
    referenceCode: x.referenceCode,
    startsAt: x.startsAt,
    endsAt: x.endsAt,
    name: masked ? null : x.name,
    masked,
    capacity: masked ? '' : x.capacity,
    organization: masked ? '' : x.organization,
    priority: x.priority,
    mode: x.mode,
    room: x.room ? { id: x.room, name: t(`secretariat.rooms.${x.room}`) } : null,
    locationNote: masked ? null : x.locationNote,
    meetingUrl: null,
    isPrivate: x.isPrivate,
    brief: masked ? '' : x.brief,
    transferredFromId: x.transferredFromId,
    transferredTo: memberOption(x.transferredTo),
    transferNote: x.transferNote,
    pendingTransfer: isPendingTransfer(s, x),
    arrivedAt: x.arrivedAt,
    startedAt: x.startedAt,
    endedAt: x.endedAt,
    attachments: masked ? [] : x.attachments,
  };
}

function toTicket(x: DemoTicket): Ticket {
  return {
    id: x.id,
    referenceCode: x.referenceCode,
    kind: x.kind,
    status: x.status,
    priority: x.priority,
    submittedAt: x.submittedAt,
    requesterName: x.requesterName,
    requesterType: x.requesterType,
    capacity: x.capacity,
    organization: x.organization,
    summary: x.purpose,
    preferredMeetingMode: x.preferredMode,
    fromPrincipal: x.fromPrincipal ?? false,
    attachmentsCount: x.attachments.length,
    attachments: x.attachments,
  };
}

function demoBooking(booking: Booking) {
  return {
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    mode: booking.meetingMode,
    room: booking.meetingMode === 'IN_PERSON' ? ((booking.roomId ?? 'MAIN') as RoomCode) : null,
  };
}

/** The GitHub Pages preview: the same screens over the browser-only demo store. */
export function demoWorkspace(lens: Lens): Workspace {
  const principal = lens.kind === 'MEMBER' ? lens.memberId : 'SYNDIC';
  const resolve = <T>(value: T) => Promise.resolve(ok(value));

  return {
    demo: true,
    subscribe,

    queue(filter) {
      const needle = filter.q?.toLowerCase() ?? '';
      const open = current()
        .tickets.filter((x) => OPEN.includes(x.status))
        .filter((x) => !filter.priority || x.priority === filter.priority)
        .filter(
          (x) =>
            !needle ||
            [x.referenceCode, x.requesterName, x.organization, x.purpose].some((field) =>
              field.toLowerCase().includes(needle),
            ),
        )
        .sort(
          (a, b) =>
            RANK[a.priority] - RANK[b.priority] ||
            a.submittedAt.getTime() - b.submittedAt.getTime(),
        );
      const start = (filter.page - 1) * filter.pageSize;
      return resolve({
        items: open.slice(start, start + filter.pageSize).map(toTicket),
        total: open.length,
        page: filter.page,
        pageSize: filter.pageSize,
      });
    },

    counts() {
      const { tickets } = current();
      const openTickets = tickets.filter((x) => OPEN.includes(x.status));
      const open = Object.fromEntries(
        PRIORITY_TIERS.map((tier) => [tier, openTickets.filter((x) => x.priority === tier).length]),
      ) as Record<PriorityTier, number>;
      return resolve({
        open,
        awaitingDocuments: tickets.filter((x) => x.status === 'AWAITING_DOCUMENTS').length,
        decided: tickets.length - openTickets.length,
      });
    },

    ticket(id) {
      const found = current().tickets.find((x) => x.id === id);
      if (!found) {
        return Promise.resolve({
          ok: false,
          code: 'NOT_FOUND',
          message: t('errors.notFound'),
          status: 404,
        });
      }
      const info: TicketInfo = {
        ...toTicket(found),
        description: found.purpose,
        contactPhone: null,
        contactEmail: null,
        grievance: null,
      };
      return resolve(info);
    },

    agenda(from, to) {
      const s = current();
      return resolve(
        s.appointments
          .filter((x) => x.principal === principal && x.startsAt < to && x.endsAt > from)
          .map((x) => toAppt(s, x, lens)),
      );
    },

    pendingTransfers() {
      const s = current();
      return resolve(
        pendingTransfers(s, lens.kind === 'MEMBER' ? lens.memberId : undefined).map((x) =>
          toAppt(s, x, lens),
        ),
      );
    },

    members: () =>
      resolve(councilMembers.map((m): Option => ({ id: m.id, code: m.id, name: m.name }))),
    rooms: () =>
      resolve(
        ROOMS.map((code): Option => ({ id: code, code, name: t(`secretariat.rooms.${code}`) })),
      ),
    routingTargets: () =>
      resolve({
        units: [
          {
            id: 'CENTRAL_DISCIPLINARY_COMMITTEE',
            code: 'CENTRAL_DISCIPLINARY_COMMITTEE',
            name: t('orgUnits.CENTRAL_DISCIPLINARY_COMMITTEE'),
          },
          ...GOVERNORATES.map((g): Option => ({
            id: `BRANCH_${g}`,
            code: `BRANCH_${g}`,
            name: t('branch.councilName', { governorate: t(`governorates.${g}`) }),
          })),
        ],
        entities: (['MINISTRY_OF_JUSTICE', 'SUPREME_JUDICIAL_COUNCIL'] as const).map(
          (code): Option => ({ id: code, code, name: t(`entities.${code}`) }),
        ),
      }),

    approve: (id, booking) =>
      Promise.resolve(fromAction(demoActions.decide(id, 'APPROVED', demoBooking(booking)))),
    delegate: (id) => Promise.resolve(fromAction(demoActions.decide(id, 'DELEGATED'))),
    requestDocuments: (id) =>
      Promise.resolve(fromAction(demoActions.decide(id, 'AWAITING_DOCUMENTS'))),
    decline: (id) => Promise.resolve(fromAction(demoActions.decide(id, 'DECLINED'))),

    addEntry: (entry) => Promise.resolve(fromAction(demoActions.addPrincipalEntry(entry))),
    cancelEntry: (id) => Promise.resolve(fromAction(demoActions.cancelEntry(id))),
    transfer: (id, memberId, keepTime, note) =>
      Promise.resolve(fromAction(demoActions.transfer(id, memberId, note, keepTime))),
    scheduleTransfer: (id, booking) =>
      Promise.resolve(fromAction(demoActions.scheduleTransfer(id, demoBooking(booking)))),
    track(id, step) {
      demoActions.track(id, step);
      return resolve(null);
    },
    emergencyPostpone: (from) =>
      resolve({
        affected: demoActions.postponeRestOfDay(damascusIsoDate(from), from, damascusIsoDate),
      }),
    askSecretariat(request) {
      demoActions.requestFromPrincipal({
        name: request.name,
        purpose: request.purpose,
        priority: request.priority,
        requesterType: request.requesterType,
      });
      return resolve(null);
    },
    reset: () => {
      demoActions.reset();
    },
  };
}
