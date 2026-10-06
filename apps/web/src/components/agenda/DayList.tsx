'use client';

import { Lock, MapPin, Paperclip, Video } from 'lucide-react';
import type { ReactNode } from 'react';

import { PriorityBadge } from '@/components/Badges';
import type { DemoAppointment } from '@/demo/data';
import { formatTime, t } from '@/i18n';

import {
  LIVE_STATE_STYLE,
  accentOf,
  displayName,
  liveState,
  locationText,
  memberName,
  type Viewer,
} from './view';

interface DayListProps {
  readonly appointments: readonly DemoAppointment[];
  readonly viewer: Viewer;
  readonly highlightId?: string | undefined;
  readonly onOpenDocument?: (name: string) => void;
  readonly actions?: (appointment: DemoAppointment) => ReactNode;
  /** TRANSFERRED audiences whose new time has not been set yet (D21). */
  readonly pendingTransferIds?: ReadonlySet<string>;
}

/** One day's entries in time order, with live state and optional per-entry actions. */
export function DayList({
  appointments,
  viewer,
  highlightId,
  onOpenDocument,
  actions,
  pendingTransferIds,
}: DayListProps) {
  if (appointments.length === 0) {
    return <p className="card p-6 text-center text-ink-muted">{t('agenda.noEntries')}</p>;
  }
  return (
    <ol className="grid gap-3">
      {appointments.map((item) => {
        const state = liveState(item);
        const masked = viewer === 'SECRETARIAT' && item.origin === 'PRINCIPAL' && item.isPrivate;
        const inactive = ['POSTPONED', 'TRANSFERRED', 'CANCELLED', 'NO_SHOW'].includes(state);
        return (
          <li
            key={item.id}
            className={`card border-s-4 p-4 ${inactive ? 'opacity-70' : ''} ${
              item.id === highlightId ? 'ring-2 ring-gold-500' : ''
            }`}
            style={{ borderInlineStartColor: accentOf(item) }}
          >
            <div className="flex items-start gap-4">
              <div className="w-20 shrink-0 whitespace-nowrap text-center">
                <p className="text-lg font-bold text-navy-800">{formatTime(item.startsAt)}</p>
                <p className="text-xs text-ink-subtle">
                  {t('syndic.until', { time: formatTime(item.endsAt) })}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {item.priority && <PriorityBadge priority={item.priority} />}
                  {item.origin === 'PRINCIPAL' && (
                    <span className="badge bg-gold-100 text-gold-700">
                      {item.isPrivate && <Lock className="size-3" aria-hidden="true" />}
                      {item.isPrivate ? t('agenda.private') : t('agenda.ownEntry')}
                    </span>
                  )}
                  <span className={`badge ${LIVE_STATE_STYLE[state]}`}>
                    {t(`live.states.${state}`)}
                  </span>
                  {item.id === highlightId && (
                    <span className="badge bg-gold-100 text-gold-700">{t('syndic.next')}</span>
                  )}
                </div>
                <h3 className="mt-1 text-lg font-bold leading-snug">{displayName(item, viewer)}</h3>
                {!masked && (item.capacity || item.organization) && (
                  <p className="text-sm text-ink-muted">
                    {[item.capacity, item.organization].filter(Boolean).join(' — ')}
                  </p>
                )}
                {item.status === 'TRANSFERRED' && (
                  <p className="mt-1 text-sm font-bold text-tier-internal">
                    {t('agenda.transferredTo', { name: memberName(item.transferredTo) })}
                    {pendingTransferIds?.has(item.id) && (
                      <span className="ms-2 badge bg-gold-100 text-gold-700">
                        {t('agenda.awaitingTime')}
                      </span>
                    )}
                  </p>
                )}
                {!masked && locationText(item) && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-navy-700">
                    {item.mode === 'REMOTE' ? (
                      <Video className="size-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <MapPin className="size-4 shrink-0" aria-hidden="true" />
                    )}
                    {locationText(item)}
                  </p>
                )}
                {!masked && item.brief && (
                  <p className="mt-2 rounded-xl bg-canvas p-3 text-sm leading-relaxed">
                    <span className="block text-xs font-bold text-ink-subtle">
                      {t('syndic.brief')}
                    </span>
                    {item.brief}
                  </p>
                )}
                {!masked && item.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.attachments.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className="badge min-h-9 border border-line bg-surface px-3 text-ink"
                        onClick={() => onOpenDocument?.(name)}
                      >
                        <Paperclip className="size-3.5" aria-hidden="true" />
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                {actions && <div className="mt-3 flex flex-wrap gap-2">{actions(item)}</div>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
