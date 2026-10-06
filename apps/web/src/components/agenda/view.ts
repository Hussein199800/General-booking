import type { PriorityTier } from '@sba/shared';

import { councilMembers, type DemoAppointment } from '@/demo/data';
import { t } from '@/i18n';

export type Viewer = 'SYNDIC' | 'SECRETARIAT';

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

export function liveState(appointment: DemoAppointment): LiveState {
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

/** Private principal entries are masked for the Secretariat. */
export function displayName(appointment: DemoAppointment, viewer: Viewer): string {
  if (appointment.origin === 'PRINCIPAL' && appointment.isPrivate && viewer === 'SECRETARIAT') {
    return t('agenda.reserved');
  }
  return appointment.name;
}

export function memberName(id: string | null): string {
  return councilMembers.find((member) => member.id === id)?.name ?? '';
}

const ACCENT: Record<PriorityTier, string> = {
  CRITICAL: 'var(--color-tier-critical)',
  INTERNAL: 'var(--color-tier-internal)',
  STANDARD: 'var(--color-tier-standard)',
};

/** Left-edge colour: priority for audiences, gold for the Grand Syndic's own entries. */
export function accentOf(appointment: DemoAppointment): string {
  if (appointment.origin === 'PRINCIPAL') return 'var(--color-gold-500)';
  return appointment.priority ? ACCENT[appointment.priority] : 'var(--color-navy-700)';
}

export function locationText(appointment: DemoAppointment): string {
  if (appointment.locationNote) return appointment.locationNote;
  if (appointment.mode === 'REMOTE') return t('syndic.remote');
  return appointment.room
    ? t('syndic.inPerson', { room: t(`secretariat.rooms.${appointment.room}`) })
    : '';
}
