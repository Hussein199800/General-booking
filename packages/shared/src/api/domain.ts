import { z } from 'zod';

import { GOVERNORATES } from '../domain/governorates.js';
import { MEETING_MODES, PRIORITY_TIERS } from '../domain/scheduling.js';
import { REQUEST_STATUSES, TICKET_KINDS, USER_ROLES } from '../domain/workflow.js';

const phone = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{7,14}$/);
const isoInstant = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const isoDate = z.iso.date();
const text = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Requester types allowed on the anonymous public form (lawyers sign in instead). */
export const PUBLIC_REQUESTER_TYPES = [
  'CITIZEN',
  'STATE_INSTITUTION',
  'JUDICIAL_AUTHORITY',
  'MEDIA',
  'DELEGATION',
] as const;

export const publicAudienceRequestSchema = z.object({
  requesterType: z.enum(PUBLIC_REQUESTER_TYPES),
  requesterFullName: text(2, 120),
  officialCapacity: text(2, 120),
  organizationName: text(2, 160).optional(),
  /** MINISTRY_OF_JUSTICE / SUPREME_JUDICIAL_COUNCIL when submitting on their behalf. */
  externalEntityCode: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]*$/)
    .optional(),
  contactPhone: phone,
  contactEmail: z.email().max(254).optional(),
  purpose: text(10, 2000),
  preferredMeetingMode: z.enum(MEETING_MODES).optional(),
  expectedAttendees: z.coerce.number().int().min(1).max(50).default(1),
});
export type PublicAudienceRequestInput = z.infer<typeof publicAudienceRequestSchema>;

export const lawyerAudienceRequestSchema = z.object({
  purpose: text(10, 2000),
  preferredMeetingMode: z.enum(MEETING_MODES).optional(),
  expectedAttendees: z.coerce.number().int().min(1).max(50).default(1),
});

export const grievanceSchema = z.discriminatedUnion('grievanceType', [
  z.object({
    grievanceType: z.literal('AGAINST_LAWYER'),
    subject: text(5, 200),
    description: text(20, 5000),
    respondentRegistrationNumber: text(1, 32),
    incidentDate: isoDate.optional(),
  }),
  z.object({
    grievanceType: z.literal('JUDICIAL_MATTER'),
    subject: text(5, 200),
    description: text(20, 5000),
    courtName: text(2, 160),
    caseNumber: text(1, 64).optional(),
    incidentDate: isoDate.optional(),
  }),
]);
export type GrievanceInput = z.infer<typeof grievanceSchema>;

export const queueQuerySchema = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  priority: z.enum(PRIORITY_TIERS).optional(),
  kind: z.enum(TICKET_KINDS).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['priority', 'oldest', 'newest']).default('priority'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type QueueQuery = z.infer<typeof queueQuerySchema>;

const slot = {
  startsAt: isoInstant,
  endsAt: isoInstant,
};

const bookingSchema = z
  .object({
    ...slot,
    meetingMode: z.enum(MEETING_MODES),
    roomId: z.uuid().optional(),
  })
  .refine((b) => b.endsAt > b.startsAt, { path: ['endsAt'] })
  .refine((b) => b.endsAt.getTime() - b.startsAt.getTime() <= 8 * 3_600_000, { path: ['endsAt'] })
  .refine((b) => b.meetingMode === 'REMOTE' || b.roomId !== undefined, { path: ['roomId'] });

export const approveSchema = bookingSchema;
export const scheduleTransferSchema = bookingSchema;
export type BookingInput = z.infer<typeof bookingSchema>;

export const delegateSchema = z.object({
  targetType: z.enum(['ORGANIZATIONAL_UNIT', 'EXTERNAL_ENTITY']),
  targetCode: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  instructions: text(1, 1000).optional(),
});

export const requestDocumentsSchema = z.object({
  message: text(5, 1000),
  dueDate: isoDate,
});

export const declineSchema = z.object({
  /** Internal note for the record; never sent to the requester (decision Q1). */
  internalNote: text(1, 1000).optional(),
});

export const prioritySchema = z.object({ priority: z.enum(PRIORITY_TIERS) });

export const agendaQuerySchema = z
  .object({
    from: isoInstant,
    to: isoInstant,
    /** Secretariat may look at a council member's agenda; default is the Grand Syndic's. */
    principalId: z.uuid().optional(),
  })
  .refine((q) => q.to > q.from && q.to.getTime() - q.from.getTime() <= 62 * 86_400_000, {
    path: ['to'],
  });

export const ownEntrySchema = z
  .object({
    ...slot,
    title: text(2, 160),
    locationNote: text(2, 160),
    isPrivate: z.boolean().default(true),
    meetingMode: z.enum(MEETING_MODES).default('IN_PERSON'),
  })
  .refine((b) => b.endsAt > b.startsAt, { path: ['endsAt'] });

export const transferSchema = z.object({
  memberId: z.uuid(),
  keepTime: z.boolean(),
  note: text(1, 500).optional(),
});

export const trackSchema = z.object({ step: z.enum(['ARRIVED', 'STARTED', 'ENDED', 'NO_SHOW']) });

export const emergencySchema = z.object({
  /** Postpone audiences starting at or after this instant (default: now). */
  from: isoInstant.optional(),
});

export const principalRequestSchema = z.object({
  requesterFullName: text(2, 120),
  requesterType: z.enum(PUBLIC_REQUESTER_TYPES).or(z.literal('LAWYER')),
  contactPhone: phone,
  purpose: text(10, 2000),
  priority: z.enum(PRIORITY_TIERS),
});

export const unitDecisionSchema = z.object({ note: text(1, 1000).optional() });

export const rescheduleResponseSchema = z.object({ preference: text(1, 500).optional() });

export const createStaffSchema = z.object({
  fullName: text(2, 120),
  email: z
    .email()
    .max(254)
    .transform((value) => value.trim().toLowerCase()),
  phone: phone.optional(),
  password: z.string().min(12).max(256),
  roles: z
    .array(
      z.object({
        role: z.enum(USER_ROLES).exclude(['LAWYER']),
        orgUnitCode: z.string().optional(),
      }),
    )
    .min(1),
});

export const createLawyerSchema = z.object({
  fullName: text(2, 120),
  phone,
  email: z.email().max(254).optional(),
  registrationNumber: text(1, 32),
  nationalId: text(11, 32),
  branchGovernorate: z.enum(GOVERNORATES),
  practiceStatus: z.enum(['PRACTISING', 'TRAINEE', 'SUSPENDED', 'NON_PRACTISING']),
  password: z.string().min(12).max(256),
});

export const grantRoleSchema = z.object({
  role: z.enum(USER_ROLES),
  orgUnitCode: z.string().optional(),
});

export const userStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']) });

export const auditQuerySchema = z.object({
  entityType: z.string().max(64).optional(),
  entityId: z.string().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
