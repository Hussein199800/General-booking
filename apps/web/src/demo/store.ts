'use client';

import { canTransitionAppointment, canTransitionTicket, type RequestStatus } from '@sba/shared';
import { useSyncExternalStore } from 'react';

import {
  demoAgenda,
  demoTickets,
  type DemoAppointment,
  type DemoTicket,
  type PrincipalRef,
} from './data';

/**
 * Shared demo state for the preview screens, so that what the Grand Syndic
 * enters appears at the Secretariat and vice versa. It lives only in this
 * browser (localStorage) — nothing is sent anywhere — and the actions mirror
 * the rules the database enforces (state machines, no overlapping bookings).
 */
export interface DemoState {
  readonly tickets: DemoTicket[];
  readonly appointments: DemoAppointment[];
}

const STORAGE_KEY = 'sba-demo-v2';
const listeners = new Set<() => void>();
let state: DemoState | null = null;

function revive(_key: string, value: unknown): unknown {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : value;
}

function seed(): DemoState {
  const now = new Date();
  return { tickets: demoTickets(now), appointments: demoAgenda(now) };
}

function load(): DemoState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored, revive) as DemoState;
  } catch {
    // Storage unavailable (private mode) or corrupt: start fresh.
  }
  return seed();
}

function commit(next: DemoState): void {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Not persisted; the session still works in memory.
  }
  for (const listener of listeners) listener();
}

function current(): DemoState {
  state ??= load();
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      state = load();
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** `null` during static rendering and the first client render. */
export function useDemoState(): DemoState | null {
  return useSyncExternalStore(subscribe, current, () => null);
}

export type ActionResult = { ok: true } | { ok: false; reason: 'CONFLICT' | 'ILLEGAL_TRANSITION' };

function overlaps(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/** Mirrors the EXCLUDE constraint: only SCHEDULED entries occupy a principal's time. */
export function hasConflict(
  principal: PrincipalRef,
  slot: { startsAt: Date; endsAt: Date },
  ignoreId?: string,
): boolean {
  return current().appointments.some(
    (other) =>
      other.id !== ignoreId &&
      other.principal === principal &&
      other.status === 'SCHEDULED' &&
      overlaps(slot, other),
  );
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function blankAppointment(): Omit<DemoAppointment, 'id' | 'startsAt' | 'endsAt' | 'name'> {
  return {
    origin: 'SECRETARIAT',
    principal: 'SYNDIC',
    status: 'SCHEDULED',
    referenceCode: null,
    capacity: '',
    organization: '',
    priority: null,
    mode: 'IN_PERSON',
    room: null,
    locationNote: null,
    isPrivate: false,
    attachments: [],
    brief: '',
    transferredFromId: null,
    transferredTo: null,
    transferNote: null,
    arrivedAt: null,
    startedAt: null,
    endedAt: null,
  };
}

export const demoActions = {
  reset(): void {
    commit(seed());
  },

  /** Secretariat decision on a ticket; approval also books the Grand Syndic's time. */
  decide(
    ticketId: string,
    status: RequestStatus,
    booking?: {
      startsAt: Date;
      endsAt: Date;
      mode: DemoAppointment['mode'];
      room: DemoAppointment['room'];
    },
  ): ActionResult {
    const s = current();
    const ticket = s.tickets.find((x) => x.id === ticketId);
    if (!ticket || !canTransitionTicket(ticket.kind, ticket.status, status)) {
      return { ok: false, reason: 'ILLEGAL_TRANSITION' };
    }
    if (booking && hasConflict('SYNDIC', booking)) return { ok: false, reason: 'CONFLICT' };

    const appointments = booking
      ? [
          ...s.appointments,
          {
            ...blankAppointment(),
            id: newId('apt'),
            referenceCode: ticket.referenceCode,
            name: ticket.requesterName,
            capacity: ticket.capacity,
            organization: ticket.organization,
            priority: ticket.priority,
            attachments: ticket.attachments,
            brief: ticket.purpose,
            ...booking,
          },
        ]
      : s.appointments;
    commit({
      tickets: s.tickets.map((x) => (x.id === ticketId ? { ...x, status } : x)),
      appointments,
    });
    return { ok: true };
  },

  /** The Grand Syndic's own entry (decision D18): blocks his time, no request behind it. */
  addPrincipalEntry(entry: {
    title: string;
    startsAt: Date;
    endsAt: Date;
    locationNote: string;
    isPrivate: boolean;
  }): ActionResult {
    if (hasConflict('SYNDIC', entry)) return { ok: false, reason: 'CONFLICT' };
    const s = current();
    commit({
      ...s,
      appointments: [
        ...s.appointments,
        {
          ...blankAppointment(),
          ...entry,
          id: newId('own'),
          origin: 'PRINCIPAL',
          name: entry.title,
        },
      ],
    });
    return { ok: true };
  },

  /** Hand a scheduled audience to a council member, same time (decision D19). */
  transfer(appointmentId: string, memberId: string, note: string): ActionResult {
    const s = current();
    const original = s.appointments.find((x) => x.id === appointmentId);
    if (!original || original.origin !== 'SECRETARIAT')
      return { ok: false, reason: 'ILLEGAL_TRANSITION' };
    if (!canTransitionAppointment(original.status, 'TRANSFERRED')) {
      return { ok: false, reason: 'ILLEGAL_TRANSITION' };
    }
    if (hasConflict(memberId, original)) return { ok: false, reason: 'CONFLICT' };
    commit({
      ...s,
      appointments: [
        ...s.appointments.map((x) =>
          x.id === appointmentId
            ? {
                ...x,
                status: 'TRANSFERRED' as const,
                transferredTo: memberId,
                transferNote: note || null,
              }
            : x,
        ),
        {
          ...original,
          id: newId('trf'),
          principal: memberId,
          transferredFromId: original.id,
          transferNote: note || null,
        },
      ],
    });
    return { ok: true };
  },

  /** Live tracking by the Secretariat (decision D20). */
  track(appointmentId: string, step: 'ARRIVED' | 'STARTED' | 'ENDED' | 'NO_SHOW'): void {
    const s = current();
    const now = new Date();
    commit({
      ...s,
      appointments: s.appointments.map((x) => {
        if (x.id !== appointmentId || x.status !== 'SCHEDULED') return x;
        switch (step) {
          case 'ARRIVED':
            return { ...x, arrivedAt: now };
          case 'STARTED':
            return { ...x, arrivedAt: x.arrivedAt ?? now, startedAt: now };
          case 'ENDED':
            return {
              ...x,
              startedAt: x.startedAt ?? now,
              endedAt: now,
              status: 'COMPLETED' as const,
            };
          case 'NO_SHOW':
            return { ...x, status: 'NO_SHOW' as const };
        }
      }),
    });
  },

  /** Emergency reschedule: postpone the rest of today's audiences. Returns how many. */
  postponeRestOfDay(isoDate: string, from: Date, dayOf: (d: Date) => string): number {
    const s = current();
    let count = 0;
    const appointments = s.appointments.map((x) => {
      if (
        x.principal === 'SYNDIC' &&
        x.origin === 'SECRETARIAT' &&
        x.status === 'SCHEDULED' &&
        !x.startedAt &&
        x.startsAt >= from &&
        dayOf(x.startsAt) === isoDate
      ) {
        count += 1;
        return { ...x, status: 'POSTPONED' as const };
      }
      return x;
    });
    commit({ ...s, appointments });
    return count;
  },

  /** "Request from the Secretariat": the Grand Syndic asks for a meeting to be arranged. */
  requestFromPrincipal(request: {
    name: string;
    purpose: string;
    priority: DemoTicket['priority'];
    requesterType: DemoTicket['requesterType'];
  }): void {
    const s = current();
    commit({
      ...s,
      tickets: [
        {
          id: newId('tkt'),
          referenceCode: `REQ-${new Date().getFullYear().toString()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          kind: 'AUDIENCE_REQUEST',
          status: 'PENDING_REVIEW',
          priority: request.priority,
          requesterType: request.requesterType,
          requesterName: request.name,
          capacity: '',
          organization: '',
          purpose: request.purpose,
          submittedAt: new Date(),
          attachments: [],
          preferredMode: null,
          fromPrincipal: true,
        },
        ...s.tickets,
      ],
    });
  },
};
