import type {
  AgendaItem,
  MeetingMode,
  PriorityTier,
  RequestStatus,
  RequesterType,
  TicketDetail,
  TicketKind,
  TicketSummary,
} from '@sba/shared';

/**
 * What the screens work with: the API's JSON shapes (packages/shared dto.ts)
 * with instants as Date. The demo store is adapted to the same shapes, so a
 * screen cannot tell — and cannot behave differently — between the two.
 */
export interface Appt extends Omit<
  AgendaItem,
  'startsAt' | 'endsAt' | 'arrivedAt' | 'startedAt' | 'endedAt'
> {
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly arrivedAt: Date | null;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
  /** File names of attached documents (demo only until document storage, Phase 3). */
  readonly attachments: readonly string[];
}

export interface Ticket {
  readonly id: string;
  readonly referenceCode: string;
  readonly kind: TicketKind;
  readonly status: RequestStatus;
  readonly priority: PriorityTier;
  readonly submittedAt: Date;
  readonly requesterName: string;
  readonly requesterType: RequesterType;
  readonly capacity: string;
  readonly organization: string;
  readonly summary: string;
  readonly preferredMeetingMode: MeetingMode | null;
  readonly fromPrincipal: boolean;
  readonly attachmentsCount: number;
  /** File names (demo only until document storage, Phase 3). */
  readonly attachments: readonly string[];
}

export interface TicketInfo extends Ticket {
  readonly description: string;
  readonly contactPhone: string | null;
  readonly contactEmail: string | null;
  readonly grievance: TicketDetail['grievance'];
}

export interface Booking {
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly meetingMode: MeetingMode;
  readonly roomId?: string | undefined;
}

export interface Option {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface QueueFilter {
  readonly priority?: PriorityTier | undefined;
  readonly q?: string | undefined;
  readonly page: number;
  readonly pageSize: number;
}

export interface Counts {
  readonly open: Record<PriorityTier, number>;
  readonly awaitingDocuments: number;
  readonly decided: number;
}

const date = (value: string | null) => (value ? new Date(value) : null);

export function toAppt(item: AgendaItem): Appt {
  return {
    ...item,
    startsAt: new Date(item.startsAt),
    endsAt: new Date(item.endsAt),
    arrivedAt: date(item.arrivedAt),
    startedAt: date(item.startedAt),
    endedAt: date(item.endedAt),
    attachments: [],
  };
}

export function toTicket(item: TicketSummary): Ticket {
  return { ...item, submittedAt: new Date(item.submittedAt), attachments: [] };
}

export function toTicketInfo(item: TicketDetail): TicketInfo {
  return {
    ...toTicket(item),
    description: item.description,
    contactPhone: item.contactPhone,
    contactEmail: item.contactEmail,
    grievance: item.grievance,
  };
}

export function byStart(a: Appt, b: Appt): number {
  return a.startsAt.getTime() - b.startsAt.getTime();
}
