'use client';

import type { MeetingMode } from '@sba/shared';
import { CalendarClock, Hourglass } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';

import { PriorityBadge } from '@/components/Badges';
import { Modal } from '@/components/Modal';
import { damascusIsoDate, type DemoAppointment, type RoomCode } from '@/demo/data';
import { demoActions } from '@/demo/store';
import { formatDateTime, t } from '@/i18n';

import { memberName } from './view';

const DURATIONS = [15, 30, 45, 60] as const;
const ROOMS: RoomCode[] = ['MAIN', 'COUNCIL'];

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

interface PendingTransfersProps {
  readonly items: readonly DemoAppointment[];
  readonly now: Date;
  /** The Secretariat sees which member each transfer went to; the member does not need to. */
  readonly showMember: boolean;
  readonly onScheduled: (message: string) => void;
}

/** Transfers from the Grand Syndic still waiting for a new time (decision D21). */
export function PendingTransfers({ items, now, showMember, onScheduled }: PendingTransfersProps) {
  const [open, setOpen] = useState<DemoAppointment | null>(null);
  const [mode, setMode] = useState<MeetingMode>('IN_PERSON');
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(null);
    setError(null);
  }

  function submit(event: SubmitEvent<HTMLFormElement>, item: DemoAppointment) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startsAt = new Date(`${text(form, 'date')}T${text(form, 'time')}:00+03:00`);
    const result = demoActions.scheduleTransfer(item.id, {
      startsAt,
      endsAt: new Date(startsAt.getTime() + Number(text(form, 'duration')) * 60_000),
      mode,
      room: mode === 'IN_PERSON' ? (text(form, 'room') as RoomCode) : null,
    });
    if (!result.ok) {
      setError(t('transfers.conflict'));
      return;
    }
    close();
    onScheduled(t('transfers.done'));
  }

  return (
    <section className="card grid gap-3 p-4 sm:p-5" aria-labelledby="pending-transfers">
      <h2 id="pending-transfers" className="flex items-center gap-2 text-lg font-bold">
        <Hourglass className="size-5 text-gold-600" aria-hidden="true" />
        {t('transfers.heading')}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('transfers.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {item.priority && <PriorityBadge priority={item.priority} />}
                  {showMember && (
                    <span className="badge bg-tier-internal-bg text-tier-internal">
                      {t('transfers.member')}: {memberName(item.transferredTo)}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-bold">{item.name}</p>
                <p className="text-xs text-ink-subtle">
                  {t('transfers.from', { date: formatDateTime(item.startsAt) })}
                </p>
                {item.transferNote && (
                  <p className="mt-1 text-sm text-ink-muted">
                    {t('transfers.note')}: {item.transferNote}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn btn-primary min-h-10 text-sm"
                onClick={() => {
                  setMode(item.mode);
                  setOpen(item);
                }}
              >
                <CalendarClock className="size-4" aria-hidden="true" />
                {t('transfers.schedule')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <Modal
          title={t('transfers.scheduleTitle', { name: memberName(open.transferredTo) })}
          onClose={close}
        >
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              submit(event, open);
            }}
          >
            <p className="font-bold">{open.name}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="pt-date" className="field-label">
                  {t('secretariat.approve.date')}
                </label>
                <input
                  id="pt-date"
                  name="date"
                  type="date"
                  required
                  defaultValue={damascusIsoDate(new Date(now.getTime() + 86_400_000))}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="pt-time" className="field-label">
                  {t('secretariat.approve.time')}
                </label>
                <input
                  id="pt-time"
                  name="time"
                  type="time"
                  required
                  defaultValue="11:00"
                  step={900}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="pt-duration" className="field-label">
                  {t('secretariat.approve.duration')}
                </label>
                <select id="pt-duration" name="duration" defaultValue={30} className="input">
                  {DURATIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {t('secretariat.approve.minutes', { count: minutes })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <fieldset className="grid gap-2">
              <legend className="field-label">{t('secretariat.approve.mode')}</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['IN_PERSON', 'REMOTE'] as const).map((value) => (
                  <label
                    key={value}
                    className={`btn border ${
                      mode === value
                        ? 'border-navy-800 bg-navy-50 text-navy-800'
                        : 'border-line bg-surface text-ink-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => {
                        setMode(value);
                      }}
                      className="sr-only"
                    />
                    {t(`meetingMode.${value}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            {mode === 'IN_PERSON' ? (
              <div>
                <label htmlFor="pt-room" className="field-label">
                  {t('secretariat.approve.room')}
                </label>
                <select id="pt-room" name="room" className="input">
                  {ROOMS.map((room) => (
                    <option key={room} value={room}>
                      {t(`secretariat.rooms.${room}`)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="rounded-xl bg-navy-50 p-3 text-sm text-navy-800">
                {t('secretariat.approve.remoteNote')}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-tier-critical-bg p-3 text-sm font-bold text-tier-critical"
              >
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              <button type="button" className="btn btn-secondary" onClick={close}>
                {t('secretariat.actions.cancel')}
              </button>
              <button type="submit" className="btn btn-primary">
                {t('secretariat.actions.confirm')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
