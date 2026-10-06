'use client';

import {
  PRIORITY_TIERS,
  type AgendaItem,
  type Page,
  type PriorityTier,
  type ReferenceOption,
  type TicketDetail,
  type TicketSummary,
} from '@sba/shared';

import { api, query, type ApiResult } from '@/lib/api';

import { toAppt, toTicket, toTicketInfo, type Booking, type Counts, type Option } from './model';
import type { Workspace } from './workspace';

function map<T, U>(result: ApiResult<T>, fn: (value: T) => U): ApiResult<U> {
  return result.ok ? { ok: true, value: fn(result.value) } : result;
}

function bookingBody(booking: Booking) {
  return {
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    meetingMode: booking.meetingMode,
    ...(booking.meetingMode === 'IN_PERSON' && booking.roomId ? { roomId: booking.roomId } : {}),
  };
}

interface Summary {
  readonly byStatus: Record<string, number>;
  readonly openByPriority: Partial<Record<PriorityTier, number>>;
}

const OPEN = new Set(['PENDING_REVIEW', 'AWAITING_DOCUMENTS']);

/** The real workspace: every read and action goes to the API with the session. */
export const apiWorkspace: Workspace = {
  demo: false,
  subscribe: () => () => undefined,

  async queue(filter) {
    const result = await api.get<Page<TicketSummary>>(
      `/secretariat/queue${query({
        priority: filter.priority,
        q: filter.q,
        page: filter.page,
        pageSize: filter.pageSize,
      })}`,
    );
    return map(result, (page) => ({ ...page, items: page.items.map(toTicket) }));
  },

  async counts() {
    const result = await api.get<Summary>('/reports/summary');
    return map(result, (summary): Counts => {
      const open = Object.fromEntries(
        PRIORITY_TIERS.map((tier) => [tier, summary.openByPriority[tier] ?? 0]),
      ) as Record<PriorityTier, number>;
      const decided = Object.entries(summary.byStatus)
        .filter(([status]) => !OPEN.has(status))
        .reduce((sum, [, count]) => sum + count, 0);
      return { open, awaitingDocuments: summary.byStatus.AWAITING_DOCUMENTS ?? 0, decided };
    });
  },

  async ticket(id) {
    return map(await api.get<TicketDetail>(`/secretariat/requests/${id}`), toTicketInfo);
  },

  async agenda(from, to) {
    const result = await api.get<AgendaItem[]>(
      `/agenda${query({ from: from.toISOString(), to: to.toISOString() })}`,
    );
    return map(result, (items) => items.map(toAppt));
  },

  async pendingTransfers() {
    return map(await api.get<AgendaItem[]>('/transfers/pending'), (items) => items.map(toAppt));
  },

  async members() {
    const result = await api.get<{ id: string; name: string }[]>('/reference/members');
    return map(result, (items): Option[] => items.map((m) => ({ ...m, code: m.id })));
  },

  rooms: () => api.get<ReferenceOption[]>('/reference/rooms'),
  routingTargets: () =>
    api.get<{ units: ReferenceOption[]; entities: ReferenceOption[] }>(
      '/reference/routing-targets',
    ),

  approve: (id, booking) => api.post(`/secretariat/requests/${id}/approve`, bookingBody(booking)),
  delegate: (id, target, instructions) =>
    api.post(`/secretariat/requests/${id}/delegate`, {
      ...target,
      ...(instructions ? { instructions } : {}),
    }),
  requestDocuments: (id, message, dueDate) =>
    api.post(`/secretariat/requests/${id}/request-documents`, { message, dueDate }),
  decline: (id) => api.post(`/secretariat/requests/${id}/decline`, {}),

  addEntry: (entry) =>
    api.post('/syndic/entries', {
      ...entry,
      startsAt: entry.startsAt.toISOString(),
      endsAt: entry.endsAt.toISOString(),
    }),
  cancelEntry: (id) => api.post(`/syndic/entries/${id}/cancel`),
  transfer: (id, memberId, keepTime, note) =>
    api.post(`/syndic/appointments/${id}/transfer`, {
      memberId,
      keepTime,
      ...(note ? { note } : {}),
    }),
  scheduleTransfer: (id, booking) => api.post(`/transfers/${id}/schedule`, bookingBody(booking)),
  track: (id, step) => api.post(`/agenda/appointments/${id}/track`, { step }),
  emergencyPostpone: (from) =>
    api.post<{ affected: number }>('/syndic/emergency-reschedule', { from: from.toISOString() }),
  askSecretariat: (request) =>
    api.post('/syndic/requests', {
      requesterFullName: request.name,
      requesterType: request.requesterType,
      contactPhone: request.phone,
      purpose: request.purpose,
      priority: request.priority,
    }),
  reset: () => undefined,
};
