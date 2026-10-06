import type {
  AppointmentOrigin,
  AppointmentStatus,
  MeetingMode,
  PriorityTier,
  RequestStatus,
  RequesterType,
  TicketKind,
} from '@sba/shared';

import { addDays, damascusInstant, damascusIsoDate } from '@/lib/dates';

import raw from './data.json';

/**
 * Demo data for the static preview (and, until Phase 4 wires the API, for the
 * dashboards in every build). Times are relative to "now" so the preview, and
 * in particular the live board, always looks current.
 */
export type RoomCode = 'MAIN' | 'COUNCIL';

/** Whose agenda an entry is on: 'SYNDIC' for the Grand Syndic, else a council member id. */
export type PrincipalRef = string;

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
  /** Raised by the Grand Syndic from his screen ("request from the Secretariat"). */
  readonly fromPrincipal?: boolean;
}

export interface DemoAppointment {
  readonly id: string;
  readonly origin: AppointmentOrigin;
  readonly principal: PrincipalRef;
  readonly status: AppointmentStatus;
  readonly referenceCode: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  /** Visitor name for Secretariat bookings; the entry title for the principal's own. */
  readonly name: string;
  readonly capacity: string;
  readonly organization: string;
  readonly priority: PriorityTier | null;
  readonly mode: MeetingMode;
  readonly room: RoomCode | null;
  readonly locationNote: string | null;
  readonly isPrivate: boolean;
  readonly attachments: readonly string[];
  readonly brief: string;
  readonly transferredFromId: string | null;
  readonly transferredTo: string | null;
  readonly transferNote: string | null;
  readonly arrivedAt: Date | null;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
}

export interface CouncilMember {
  readonly id: string;
  readonly name: string;
  readonly capacity: string;
}

export { addDays, damascusInstant, damascusIsoDate } from '@/lib/dates';

const FIVE_MINUTES = 5 * 60_000;

export const councilMembers: readonly CouncilMember[] = raw.members;

export function demoTickets(now: Date): DemoTicket[] {
  return raw.tickets.map(({ minutesAgo, ...ticket }) => ({
    ...(ticket as Omit<DemoTicket, 'submittedAt'>),
    submittedAt: new Date(now.getTime() - minutesAgo * 60_000),
  }));
}

interface RawAgendaItem {
  id: string;
  origin: string;
  referenceCode?: string;
  minutesFromNow?: number;
  dayOffset?: number;
  hour?: number;
  minute?: number;
  durationMinutes: number;
  name?: string;
  title?: string;
  capacity?: string;
  organization?: string;
  priority?: string;
  mode: string;
  room?: string | null;
  locationNote?: string;
  isPrivate?: boolean;
  attachments?: string[];
  brief: string;
  arrived?: boolean;
  done?: boolean;
}

export function demoAgenda(now: Date): DemoAppointment[] {
  const today = damascusIsoDate(now);
  const rounded = Math.floor(now.getTime() / FIVE_MINUTES) * FIVE_MINUTES;

  return (raw.agenda as RawAgendaItem[]).map((item) => {
    const startsAt =
      item.minutesFromNow !== undefined
        ? new Date(rounded + item.minutesFromNow * 60_000)
        : damascusInstant(addDays(today, item.dayOffset ?? 0), item.hour ?? 9, item.minute ?? 0);
    const endsAt = new Date(startsAt.getTime() + item.durationMinutes * 60_000);

    // Seed the live board from where "now" falls relative to each meeting.
    const past = endsAt <= now || item.done === true;
    const ongoing = startsAt <= now && now < endsAt;
    const arrivedAt =
      past || ongoing || item.arrived === true ? new Date(startsAt.getTime() - 10 * 60_000) : null;
    const startedAt = past || ongoing ? new Date(startsAt.getTime() + 2 * 60_000) : null;
    const endedAt = past ? new Date(endsAt.getTime() - 3 * 60_000) : null;
    const isSecretariat = item.origin === 'SECRETARIAT';

    return {
      id: item.id,
      origin: item.origin as AppointmentOrigin,
      principal: 'SYNDIC',
      status: past && isSecretariat ? 'COMPLETED' : 'SCHEDULED',
      referenceCode: item.referenceCode ?? null,
      startsAt,
      endsAt,
      name: item.name ?? item.title ?? '',
      capacity: item.capacity ?? '',
      organization: item.organization ?? '',
      priority: (item.priority as PriorityTier | undefined) ?? null,
      mode: item.mode as MeetingMode,
      room: (item.room as RoomCode | null | undefined) ?? null,
      locationNote: item.locationNote ?? null,
      isPrivate: item.isPrivate ?? false,
      attachments: item.attachments ?? [],
      brief: item.brief,
      transferredFromId: null,
      transferredTo: null,
      transferNote: null,
      arrivedAt: isSecretariat ? arrivedAt : null,
      startedAt: isSecretariat ? startedAt : null,
      endedAt: isSecretariat ? endedAt : null,
    };
  });
}
