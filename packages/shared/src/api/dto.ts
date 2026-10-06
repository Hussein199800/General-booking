import type { MeetingMode, PriorityTier } from '../domain/scheduling.js';
import type {
  AppointmentOrigin,
  AppointmentStatus,
  RequestStatus,
  RequesterType,
  TicketKind,
} from '../domain/workflow.js';

/** JSON shapes returned by the API (dates are ISO strings on the wire). */

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface TicketSummary {
  readonly id: string;
  readonly referenceCode: string;
  readonly kind: TicketKind;
  readonly status: RequestStatus;
  readonly priority: PriorityTier;
  readonly submittedAt: string;
  readonly statusChangedAt: string;
  readonly requesterName: string;
  readonly requesterType: RequesterType;
  readonly capacity: string;
  readonly organization: string;
  /** Request purpose, or grievance subject. */
  readonly summary: string;
  readonly preferredMeetingMode: MeetingMode | null;
  readonly fromPrincipal: boolean;
  readonly attachmentsCount: number;
}

export interface TicketDetail extends TicketSummary {
  readonly description: string;
  readonly contactPhone: string | null;
  readonly contactEmail: string | null;
  readonly grievance: {
    readonly type: 'AGAINST_LAWYER' | 'JUDICIAL_MATTER';
    readonly respondentRegistrationNumber: string | null;
    readonly courtName: string | null;
    readonly caseNumber: string | null;
    readonly incidentDate: string | null;
  } | null;
  readonly history: readonly { readonly at: string; readonly action: string }[];
}

/** What a lawyer sees about their own ticket (no internal notes). */
export interface MyTicket {
  readonly id: string;
  readonly referenceCode: string;
  readonly kind: TicketKind;
  readonly status: RequestStatus;
  readonly submittedAt: string;
  readonly summary: string;
  readonly appointment: {
    readonly startsAt: string;
    readonly endsAt: string;
    readonly mode: MeetingMode;
  } | null;
}

export interface AgendaItem {
  readonly id: string;
  readonly origin: AppointmentOrigin;
  readonly principalId: string;
  readonly status: AppointmentStatus;
  readonly referenceCode: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  /** null when masked (a private entry seen by the Secretariat). */
  readonly name: string | null;
  readonly masked: boolean;
  readonly capacity: string;
  readonly organization: string;
  readonly priority: PriorityTier | null;
  readonly mode: MeetingMode;
  readonly room: { readonly id: string; readonly name: string } | null;
  readonly locationNote: string | null;
  readonly meetingUrl: string | null;
  readonly isPrivate: boolean;
  readonly brief: string;
  readonly transferredFromId: string | null;
  readonly transferredTo: { readonly id: string; readonly name: string } | null;
  readonly transferNote: string | null;
  /** TRANSFERRED and still waiting for the member or the Secretariat to set a time. */
  readonly pendingTransfer: boolean;
  readonly arrivedAt: string | null;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
}

export interface ReferenceOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface MemberOption {
  readonly id: string;
  readonly name: string;
}
