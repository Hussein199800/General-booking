import {
  APPOINTMENT_STATUSES,
  GOVERNORATES,
  MEETING_MODES,
  PRIORITY_TIERS,
  REQUEST_STATUSES,
  REQUESTER_TYPES,
  TICKET_KINDS,
  USER_ROLES,
} from '@sba/shared';
import { describe, expect, it } from 'vitest';

import {
  AppointmentStatus,
  Governorate,
  MeetingMode,
  PriorityTier,
  RequestStatus,
  RequesterType,
  TicketKind,
  UserRole,
} from '../../src/generated/prisma/enums.js';

// The database enums (via the generated client) and the constants the web app and
// API share must be identical, value for value and in order.
describe('database enums match @sba/shared', () => {
  it.each([
    ['governorate', Governorate, GOVERNORATES],
    ['priority_tier', PriorityTier, PRIORITY_TIERS],
    ['meeting_mode', MeetingMode, MEETING_MODES],
    ['user_role', UserRole, USER_ROLES],
    ['ticket_kind', TicketKind, TICKET_KINDS],
    ['request_status', RequestStatus, REQUEST_STATUSES],
    ['appointment_status', AppointmentStatus, APPOINTMENT_STATUSES],
    ['requester_type', RequesterType, REQUESTER_TYPES],
  ] as const)('%s', (_name, dbEnum, shared) => {
    expect(Object.values(dbEnum)).toEqual([...shared]);
  });
});
