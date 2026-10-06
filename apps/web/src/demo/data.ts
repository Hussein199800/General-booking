import type {
  MeetingMode,
  PriorityTier,
  RequestStatus,
  RequesterType,
  TicketKind,
} from '@sba/shared';

import raw from './data.json';

/**
 * Demo data for the static preview (and, until Phase 4 wires the API, for the
 * dashboards in every build). Times are stored relative to "now" / "today" so
 * the preview always looks current.
 */
export type RoomCode = 'MAIN' | 'COUNCIL';

export interface DemoTicket {
  readonly id: string;
  readonly referenceCode: string;
  readonly kind: TicketKind;
  readonly status: RequestStatus;
  readonly priority: PriorityTier;
  readonly requesterType: RequesterType;
  readonly requesterName: string;
  readonly capacity: string;
  readonly organization: string;
  readonly purpose: string;
  readonly submittedAt: Date;
  readonly attachments: readonly string[];
  readonly preferredMode: MeetingMode | null;
}

export interface DemoAppointment {
  readonly id: string;
  readonly referenceCode: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly name: string;
  readonly capacity: string;
  readonly organization: string;
  readonly priority: PriorityTier;
  readonly mode: MeetingMode;
  readonly room: RoomCode | null;
  readonly attachments: readonly string[];
  readonly brief: string;
}

/** Syria observes UTC+3 all year (since 2022). */
const DAMASCUS_OFFSET_HOURS = 3;

/** The instant at hour:minute today, Damascus wall-clock time. */
export function damascusToday(hour: number, minute: number, now: Date = new Date()): Date {
  const local = new Date(now.getTime() + DAMASCUS_OFFSET_HOURS * 3_600_000);
  return new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      hour - DAMASCUS_OFFSET_HOURS,
      minute,
    ),
  );
}

export function demoTickets(now: Date = new Date()): DemoTicket[] {
  return raw.tickets.map(({ minutesAgo, ...ticket }) => ({
    ...(ticket as Omit<DemoTicket, 'submittedAt'>),
    submittedAt: new Date(now.getTime() - minutesAgo * 60_000),
  }));
}

export function demoAgenda(now: Date = new Date()): DemoAppointment[] {
  return raw.agenda.map(({ startHour, startMinute, durationMinutes, ...item }) => {
    const startsAt = damascusToday(startHour, startMinute, now);
    return {
      ...(item as Omit<DemoAppointment, 'startsAt' | 'endsAt'>),
      startsAt,
      endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000),
    };
  });
}
