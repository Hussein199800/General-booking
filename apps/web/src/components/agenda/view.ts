import type { PriorityTier } from '@sba/shared';

import type { Appt } from '@/data/model';
import { t } from '@/i18n';

export type LiveState =
  | 'OWN'
  | 'NOT_ARRIVED'
  | 'WAITING'
  | 'IN_OFFICE'
  | 'DONE'
  | 'NO_SHOW'
  | 'POSTPONED'
  | 'TRANSFERRED'
  | 'CANCELLED';

export function liveState(appointment: Appt): LiveState {
  if (appointment.origin === 'PRINCIPAL') return 'OWN';
  switch (appointment.status) {
    case 'COMPLETED':
      return 'DONE';
    case 'NO_SHOW':
      return 'NO_SHOW';
    case 'POSTPONED':
    case 'RESCHEDULED':
      return 'POSTPONED';
    case 'TRANSFERRED':
      return 'TRANSFERRED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'SCHEDULED':
      if (appointment.startedAt && !appointment.endedAt) return 'IN_OFFICE';
      if (appointment.arrivedAt) return 'WAITING';
      return 'NOT_ARRIVED';
  }
}

export const LIVE_STATE_STYLE: Record<LiveState, string> = {
  OWN: 'bg-navy-50 text-navy-800',
  NOT_ARRIVED: 'bg-canvas text-ink-muted',
  WAITING: 'bg-gold-100 text-gold-700',
  IN_OFFICE: 'bg-tier-standard-bg text-tier-standard',
  DONE: 'bg-navy-100 text-navy-800',
  NO_SHOW: 'bg-tier-critical-bg text-tier-critical',
  POSTPONED: 'bg-tier-critical-bg text-tier-critical',
  TRANSFERRED: 'bg-tier-internal-bg text-tier-internal',
  CANCELLED: 'bg-canvas text-ink-muted',
};

/** Private principal entries reach the Secretariat masked (the server withholds the name). */
export function displayName(appointment: Appt): string {
  return appointment.masked || appointment.name === null ? t('agenda.reserved') : appointment.name;
}

const ACCENT: Record<PriorityTier, string> = {
  CRITICAL: 'accent-critical',
  INTERNAL: 'accent-internal',
  STANDARD: 'accent-standard',
};

/**
 * Accent class (sets `--accent`, see globals.css): priority for audiences,
 * gold for the Grand Syndic's own entries. A class, not an inline style, so
 * server-rendered HTML stays within the Content-Security-Policy.
 */
export function accentOf(appointment: Appt): string {
  if (appointment.origin === 'PRINCIPAL') return 'accent-gold';
  return appointment.priority ? ACCENT[appointment.priority] : 'accent-navy';
}

export function locationText(appointment: Appt): string {
  if (appointment.locationNote) return appointment.locationNote;
  if (appointment.mode === 'REMOTE') return t('syndic.remote');
  return appointment.room ? t('syndic.inPerson', { room: appointment.room.name }) : '';
}
