/**
 * Queue colour tiers on the Secretariat board:
 * CRITICAL (red) — Ministry of Justice, judicial authorities, state institutions.
 * INTERNAL (blue) — registered lawyers, union disputes, branch matters.
 * STANDARD (green) — public inquiries, media, general delegations.
 */
export const PRIORITY_TIERS = ['CRITICAL', 'INTERNAL', 'STANDARD'] as const;
export type PriorityTier = (typeof PRIORITY_TIERS)[number];

export const MEETING_MODES = ['IN_PERSON', 'REMOTE'] as const;
export type MeetingMode = (typeof MEETING_MODES)[number];

/** All timestamps are stored in UTC (timestamptz) and displayed in this zone. */
export const DISPLAY_TIME_ZONE = 'Asia/Damascus';

/** Locale used for all user-facing date and number formatting. */
export const DISPLAY_LOCALE = 'ar-SY';
