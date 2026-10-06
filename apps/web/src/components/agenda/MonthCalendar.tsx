'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { Appt } from '@/data/model';
import { addDays, damascusInstant, damascusIsoDate } from '@/lib/dates';
import { formatNumber, formatTime, t } from '@/i18n';

import { accentOf, displayName } from './view';

const MONTH_FORMAT = new Intl.DateTimeFormat('ar-SY', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const WEEKDAY_FORMAT = new Intl.DateTimeFormat('ar-SY', { weekday: 'long', timeZone: 'UTC' });
/** 2026-10-03 is a Saturday; the Syrian week starts on Saturday. */
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  WEEKDAY_FORMAT.format(new Date(Date.UTC(2026, 9, 3 + i))),
);

interface MonthCalendarProps {
  /** First day of the displayed month, yyyy-mm-01. */
  readonly month: string;
  readonly onMonthChange: (month: string) => void;
  readonly selected: string;
  readonly onSelect: (isoDate: string) => void;
  readonly today: string;
  readonly appointments: readonly Appt[];
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + delta, 1));
  return date.toISOString().slice(0, 10);
}

/** Large month view, as on the owner's reference screens: entries as chips per day. */
export function MonthCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  today,
  appointments,
}: MonthCalendarProps) {
  const [y, m] = month.split('-').map(Number);
  const firstDow = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1)).getUTCDay(); // 0 = Sunday
  const leading = (firstDow + 1) % 7; // Saturday-first
  const gridStart = addDays(month, -leading);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const trimmed = cells.slice(0, cells[35]?.slice(0, 7) === month.slice(0, 7) ? 42 : 35);

  const byDay = new Map<string, Appt[]>();
  for (const appointment of appointments) {
    if (appointment.status === 'TRANSFERRED' || appointment.status === 'CANCELLED') continue;
    const day = damascusIsoDate(appointment.startsAt);
    byDay.set(day, [...(byDay.get(day) ?? []), appointment]);
  }
  for (const list of byDay.values())
    list.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return (
    <section className="card grid gap-3 p-3 sm:p-5" aria-label={t('agenda.calendar')}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="btn btn-secondary min-h-10 px-3"
          aria-label={t('agenda.prevMonth')}
          onClick={() => {
            onMonthChange(shiftMonth(month, -1));
          }}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold sm:text-xl">
            {MONTH_FORMAT.format(damascusInstant(month, 12, 0))}
          </h2>
          <button
            type="button"
            className="text-xs font-bold text-navy-600 underline-offset-4 hover:underline"
            onClick={() => {
              onMonthChange(`${today.slice(0, 7)}-01`);
              onSelect(today);
            }}
          >
            {t('agenda.today')}
          </button>
        </div>
        <button
          type="button"
          className="btn btn-secondary min-h-10 px-3"
          aria-label={t('agenda.nextMonth')}
          onClick={() => {
            onMonthChange(shiftMonth(month, 1));
          }}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[0.7rem] font-bold text-ink-muted sm:text-sm">
        {WEEKDAYS.map((name) => (
          <div key={name} className="truncate py-1">
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {trimmed.map((day) => {
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          const entries = byDay.get(day) ?? [];
          const isSelected = day === selected;
          const isToday = day === today;
          return (
            <button
              key={day}
              type="button"
              onClick={() => {
                onSelect(day);
              }}
              aria-pressed={isSelected}
              aria-label={t('agenda.openDay', { date: formatNumber(Number(day.slice(8))) })}
              className={`flex min-h-16 flex-col items-stretch gap-1 rounded-xl border p-1 text-start transition sm:min-h-28 sm:p-2 ${
                isSelected
                  ? 'border-navy-700 bg-navy-50 ring-2 ring-navy-700'
                  : 'border-line bg-surface hover:border-navy-600'
              } ${inMonth ? '' : 'opacity-40'}`}
            >
              <span
                className={`grid size-7 place-items-center self-start rounded-full text-sm font-bold ${
                  isToday ? 'bg-navy-800 text-white' : 'text-ink'
                }`}
              >
                {formatNumber(Number(day.slice(8)))}
              </span>
              {/* Phones: dots. Larger screens: chips with time and name. */}
              <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden="true">
                {entries.slice(0, 4).map((entry) => (
                  <span
                    key={entry.id}
                    className="size-1.5 rounded-full"
                    style={{ background: accentOf(entry) }}
                  />
                ))}
              </span>
              <span className="hidden gap-1 sm:grid">
                {entries.slice(0, 3).map((entry) => (
                  <span
                    key={entry.id}
                    className="truncate rounded-md border-s-4 bg-canvas px-1.5 py-0.5 text-[0.7rem] leading-tight text-ink"
                    style={{ borderInlineStartColor: accentOf(entry) }}
                  >
                    {formatTime(entry.startsAt)} · {displayName(entry)}
                  </span>
                ))}
                {entries.length > 3 && (
                  <span className="text-[0.7rem] text-ink-muted">
                    {t('agenda.more', { count: entries.length - 3 })}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-ink-subtle">{t('agenda.dayHint')}</p>
    </section>
  );
}
