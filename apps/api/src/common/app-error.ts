import type { MessageKey } from '@sba/shared';

/**
 * Stable, English error codes returned to clients (with an Arabic message).
 * Clients branch on `code`, never on the message.
 */
export const ERROR_CODES = {
  VALIDATION: { status: 400, message: 'errors.validation' },
  UNAUTHENTICATED: { status: 401, message: 'errors.unauthenticated' },
  INVALID_CREDENTIALS: { status: 401, message: 'errors.invalidCredentials' },
  MFA_INVALID: { status: 401, message: 'errors.mfaInvalid' },
  FORBIDDEN: { status: 403, message: 'errors.forbidden' },
  MFA_REQUIRED: { status: 403, message: 'errors.mfaRequired' },
  ACCOUNT_DISABLED: { status: 403, message: 'errors.accountDisabled' },
  CSRF: { status: 403, message: 'errors.csrf' },
  NOT_FOUND: { status: 404, message: 'errors.notFound' },
  CONFLICT: { status: 409, message: 'errors.conflict' },
  SLOT_CONFLICT: { status: 409, message: 'errors.slotConflict' },
  ILLEGAL_TRANSITION: { status: 409, message: 'errors.illegalTransition' },
  IDEMPOTENCY_IN_PROGRESS: { status: 409, message: 'errors.idempotencyInProgress' },
  IDEMPOTENCY_KEY_REQUIRED: { status: 400, message: 'errors.idempotencyKeyRequired' },
  LINK_INVALID: { status: 410, message: 'errors.linkInvalid' },
  IDEMPOTENCY_KEY_REUSED: { status: 422, message: 'errors.idempotencyKeyReused' },
  ACCOUNT_LOCKED: { status: 423, message: 'errors.accountLocked' },
  RATE_LIMITED: { status: 429, message: 'errors.rateLimited' },
  INTERNAL: { status: 500, message: 'errors.generic' },
  MEETING_PROVIDER_UNAVAILABLE: { status: 503, message: 'errors.meetingProviderUnavailable' },
} as const satisfies Record<string, { status: number; message: MessageKey }>;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    /** Parameters for the Arabic message (e.g. minutes until unlock). */
    readonly params: Readonly<Record<string, string | number>> = {},
    /** Field paths that failed validation (never values). */
    readonly fields?: readonly string[],
  ) {
    super(code);
  }
}

/** SQLSTATE of a database error surfaced through Prisma 7's pg adapter, if any. */
export function sqlState(error: unknown): string | undefined {
  const meta = (error as { meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } } })
    .meta;
  const code = meta?.driverAdapterError?.cause?.originalCode;
  return typeof code === 'string' ? code : undefined;
}

/** Maps database-enforced rules to stable API codes (see docs/DATABASE.md). */
export function fromDatabaseError(error: unknown): AppError | undefined {
  switch (sqlState(error)) {
    case '23P01': // exclusion_violation — double booking
      return new AppError('SLOT_CONFLICT');
    case '23514': // check_violation — state machine / lifecycle triggers, CHECKs
      return new AppError('ILLEGAL_TRANSITION');
    case '23505': // unique_violation
      return new AppError('CONFLICT');
    case '23503': // foreign_key_violation
      return new AppError('NOT_FOUND');
    default:
      return undefined;
  }
}
