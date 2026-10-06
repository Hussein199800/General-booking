'use client';

import { Activity, DoorOpen, Hourglass, TimerReset } from 'lucide-react';

import type { DemoAppointment } from '@/demo/data';
import { demoActions } from '@/demo/store';
import { formatTime, t } from '@/i18n';

import { LIVE_STATE_STYLE, accentOf, displayName, liveState, type Viewer } from './view';

interface LiveBoardProps {
  /** Today's entries on the Grand Syndic's agenda, in time order. */
  readonly appointments: readonly DemoAppointment[];
  readonly now: Date;
  readonly viewer: Viewer;
  /** The Secretariat records arrivals and exits; the Grand Syndic only watches. */
  readonly controls?: boolean;
}

export function nextAppointment(appointments: readonly DemoAppointment[], now: Date) {
  return appointments.find(
    (x) => x.origin === 'SECRETARIAT' && x.status === 'SCHEDULED' && !x.startedAt && x.endsAt > now,
  );
}

/** "Who is in, who is waiting, who is next" plus today's running order. */
export function LiveBoard({ appointments, now, viewer, controls = false }: LiveBoardProps) {
  const inOffice = appointments.filter((x) => liveState(x) === 'IN_OFFICE');
  const waiting = appointments.filter((x) => liveState(x) === 'WAITING');
  const next = nextAppointment(appointments, now);

  const summary = [
    {
      icon: DoorOpen,
      title: t('live.inOffice'),
      accent: 'var(--color-tier-standard)',
      body: inOffice[0] ? displayName(inOffice[0], viewer) : t('live.noneInOffice'),
      meta: inOffice[0]?.startedAt
        ? t('live.since', { time: formatTime(inOffice[0].startedAt) })
        : '',
    },
    {
      icon: Hourglass,
      title: t('live.waiting'),
      accent: 'var(--color-gold-500)',
      body: waiting.length
        ? waiting.map((x) => displayName(x, viewer)).join(' · ')
        : t('live.noneWaiting'),
      meta: '',
    },
    {
      icon: TimerReset,
      title: t('live.next'),
      accent: 'var(--color-navy-700)',
      body: next ? displayName(next, viewer) : t('live.noNext'),
      meta: next ? t('live.at', { time: formatTime(next.startsAt) }) : '',
    },
  ];

  return (
    <section className="grid gap-3" aria-labelledby="live-heading">
      <div className="flex items-center gap-2">
        <Activity className="size-5 text-tier-standard" aria-hidden="true" />
        <h2 id="live-heading" className="text-lg font-bold">
          {t('live.title')}
        </h2>
        <span className="relative ms-1 flex size-2.5" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-tier-standard opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-tier-standard" />
        </span>
        <span className="text-xs text-ink-subtle">{t('live.subtitle')}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {summary.map((card) => (
          <div
            key={card.title}
            className="stat-card"
            style={{ ['--stat-accent' as string]: card.accent }}
          >
            <p className="flex items-center gap-1.5 text-sm text-ink-muted">
              <card.icon className="size-4" aria-hidden="true" />
              {card.title}
            </p>
            <p className="mt-1 font-bold leading-snug">{card.body}</p>
            {card.meta && <p className="text-xs text-ink-subtle">{card.meta}</p>}
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <h3 className="border-b border-line px-4 py-3 text-sm font-bold">{t('live.table')}</h3>
        <ul className="divide-y divide-line">
          {appointments.map((item) => {
            const state = liveState(item);
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span
                  className="h-8 w-1 rounded-full"
                  style={{ background: accentOf(item) }}
                  aria-hidden="true"
                />
                <span className="w-16 shrink-0 whitespace-nowrap font-bold text-navy-800">
                  {formatTime(item.startsAt)}
                </span>
                <span className="min-w-0 flex-1 truncate">{displayName(item, viewer)}</span>
                <span className={`badge ${LIVE_STATE_STYLE[state]}`}>
                  {t(`live.states.${state}`)}
                </span>
                {controls && item.status === 'SCHEDULED' && item.origin === 'SECRETARIAT' && (
                  <span className="flex gap-1">
                    {!item.arrivedAt && <TrackButton id={item.id} step="ARRIVED" />}
                    {!item.startedAt && <TrackButton id={item.id} step="STARTED" />}
                    {item.startedAt && !item.endedAt && <TrackButton id={item.id} step="ENDED" />}
                    {!item.arrivedAt && <TrackButton id={item.id} step="NO_SHOW" danger />}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function TrackButton({
  id,
  step,
  danger = false,
}: {
  id: string;
  step: 'ARRIVED' | 'STARTED' | 'ENDED' | 'NO_SHOW';
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn min-h-8 px-3 text-xs ${danger ? 'btn-danger' : 'btn-secondary'}`}
      onClick={() => {
        demoActions.track(id, step);
      }}
    >
      {t(`live.actions.${step}`)}
    </button>
  );
}
