import type { PriorityTier } from './scheduling.js';

export const USER_ROLES = [
  'SYSTEM_ADMIN',
  'AUDITOR',
  'GRAND_SYNDIC',
  'SECRETARIAT_HEAD',
  'SECRETARIAT_OFFICER',
  'COUNCIL_MEMBER',
  'BRANCH_OFFICER',
  'COMMITTEE_MEMBER',
  'LAWYER',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles that must complete TOTP before any privileged action (security requirement 2). */
export const MFA_REQUIRED_ROLES: ReadonlySet<UserRole> = new Set(
  USER_ROLES.filter((role) => role !== 'LAWYER'),
);

export const TICKET_KINDS = ['AUDIENCE_REQUEST', 'GRIEVANCE'] as const;
export type TicketKind = (typeof TICKET_KINDS)[number];

export const REQUEST_STATUSES = [
  'PENDING_REVIEW',
  'AWAITING_DOCUMENTS',
  'DELEGATED',
  'APPROVED',
  'DECLINED',
  'WITHDRAWN',
  'CLOSED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED',
  'POSTPONED',
  'RESCHEDULED',
  'NO_SHOW',
  'TRANSFERRED',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Who put an entry on an agenda (decision D18). */
export const APPOINTMENT_ORIGINS = ['SECRETARIAT', 'PRINCIPAL'] as const;
export type AppointmentOrigin = (typeof APPOINTMENT_ORIGINS)[number];

export const REQUESTER_TYPES = [
  'CITIZEN',
  'LAWYER',
  'STATE_INSTITUTION',
  'JUDICIAL_AUTHORITY',
  'MEDIA',
  'DELEGATION',
] as const;
export type RequesterType = (typeof REQUESTER_TYPES)[number];

type TransitionMap<S extends string> = Readonly<Partial<Record<S, readonly S[]>>>;

/**
 * Allowed ticket status transitions. The database holds an identical copy
 * (ticket_status_transitions) enforced by trigger; an integration test fails
 * if the two ever differ. Every ticket starts in PENDING_REVIEW.
 */
export const TICKET_TRANSITIONS: Readonly<Record<TicketKind, TransitionMap<RequestStatus>>> = {
  AUDIENCE_REQUEST: {
    PENDING_REVIEW: ['APPROVED', 'DELEGATED', 'AWAITING_DOCUMENTS', 'DECLINED', 'WITHDRAWN'],
    AWAITING_DOCUMENTS: ['PENDING_REVIEW', 'WITHDRAWN'],
    DELEGATED: ['PENDING_REVIEW', 'CLOSED'],
    APPROVED: ['PENDING_REVIEW', 'CLOSED'],
  },
  // Grievances are routed to the competent body, never scheduled with the Grand Syndic.
  GRIEVANCE: {
    PENDING_REVIEW: ['DELEGATED', 'AWAITING_DOCUMENTS', 'DECLINED', 'WITHDRAWN'],
    AWAITING_DOCUMENTS: ['PENDING_REVIEW', 'WITHDRAWN'],
    DELEGATED: ['PENDING_REVIEW', 'CLOSED'],
  },
};

export const INITIAL_TICKET_STATUS: RequestStatus = 'PENDING_REVIEW';

export const APPOINTMENT_TRANSITIONS: TransitionMap<AppointmentStatus> = {
  // TRANSFERRED: the Grand Syndic hands the audience to a council member (decision D19).
  SCHEDULED: ['COMPLETED', 'CANCELLED', 'POSTPONED', 'RESCHEDULED', 'NO_SHOW', 'TRANSFERRED'],
  POSTPONED: ['RESCHEDULED', 'CANCELLED'],
};

export function canTransitionTicket(
  kind: TicketKind,
  from: RequestStatus,
  to: RequestStatus,
): boolean {
  return TICKET_TRANSITIONS[kind][from]?.includes(to) ?? false;
}

export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return APPOINTMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Default colour tier from who is asking (decision D15). An external entity's own
 * default_priority takes precedence; the Secretariat may change it afterwards.
 */
export function defaultPriority(requesterType: RequesterType): PriorityTier {
  switch (requesterType) {
    case 'STATE_INSTITUTION':
    case 'JUDICIAL_AUTHORITY':
      return 'CRITICAL';
    case 'LAWYER':
      return 'INTERNAL';
    case 'CITIZEN':
    case 'MEDIA':
    case 'DELEGATION':
      return 'STANDARD';
  }
}
