'use client';

import type { MeetingMode } from '@sba/shared';
import { useState } from 'react';

import type { Booking, Option } from '@/data/model';
import { t } from '@/i18n';
import { fromDamascusInput } from '@/lib/dates';
import { formText } from '@/lib/form';

const DURATIONS = [15, 30, 45, 60, 90, 120] as const;

/** Reads the fields rendered by <BookingFields> (times are Damascus local). */
export function readBooking(form: FormData): Booking {
  const startsAt = fromDamascusInput(formText(form, 'date'), formText(form, 'time'));
  const meetingMode: MeetingMode = formText(form, 'mode') === 'REMOTE' ? 'REMOTE' : 'IN_PERSON';
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + Number(formText(form, 'duration')) * 60_000),
    meetingMode,
    ...(meetingMode === 'IN_PERSON' ? { roomId: formText(form, 'room') } : {}),
  };
}

/** Date, time, duration, meeting mode and room — the same everywhere a time is set. */
export function BookingFields({
  idPrefix,
  defaultDate,
  defaultTime = '10:00',
  defaultMinutes = 30,
  preferred,
  rooms,
}: {
  readonly idPrefix: string;
  readonly defaultDate: string;
  readonly defaultTime?: string;
  readonly defaultMinutes?: number;
  readonly preferred?: MeetingMode | null | undefined;
  readonly rooms: readonly Option[] | null;
}) {
  const noRooms = rooms !== null && rooms.length === 0;
  const [mode, setMode] = useState<MeetingMode>(noRooms ? 'REMOTE' : (preferred ?? 'IN_PERSON'));
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={id('date')} className="field-label">
            {t('secretariat.approve.date')}
          </label>
          <input
            id={id('date')}
            name="date"
            type="date"
            required
            defaultValue={defaultDate}
            className="input"
          />
        </div>
        <div>
          <label htmlFor={id('time')} className="field-label">
            {t('secretariat.approve.time')}
          </label>
          <input
            id={id('time')}
            name="time"
            type="time"
            required
            defaultValue={defaultTime}
            step={900}
            className="input"
          />
        </div>
        <div>
          <label htmlFor={id('duration')} className="field-label">
            {t('secretariat.approve.duration')}
          </label>
          <select
            id={id('duration')}
            name="duration"
            defaultValue={defaultMinutes}
            className="input"
          >
            {DURATIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {t('secretariat.approve.minutes', { count: minutes })}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset className="grid gap-3">
        <legend className="field-label">{t('secretariat.approve.mode')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['IN_PERSON', 'REMOTE'] as const).map((value) => (
            <label
              key={value}
              className={`btn border ${
                mode === value
                  ? 'border-navy-800 bg-navy-50 text-navy-800'
                  : 'border-line bg-surface text-ink-muted'
              } ${value === 'IN_PERSON' && noRooms ? 'opacity-50' : ''}`}
            >
              <input
                type="radio"
                name="mode"
                value={value}
                checked={mode === value}
                disabled={value === 'IN_PERSON' && noRooms}
                onChange={() => {
                  setMode(value);
                }}
                className="sr-only"
              />
              {t(`meetingMode.${value}`)}
            </label>
          ))}
        </div>
        {mode === 'IN_PERSON' ? (
          <div>
            <label htmlFor={id('room')} className="field-label">
              {t('secretariat.approve.room')}
            </label>
            <select id={id('room')} name="room" required className="input">
              {(rooms ?? []).map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="rounded-xl bg-navy-50 p-3 text-sm text-navy-800">
            {noRooms ? t('secretariat.approve.noRooms') : t('secretariat.approve.remoteNote')}
          </p>
        )}
      </fieldset>
    </>
  );
}

export function FormError({ message }: { readonly message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl bg-tier-critical-bg p-3 text-sm font-bold text-tier-critical"
    >
      {message}
    </p>
  );
}

export function FormFooter({
  onCancel,
  submit,
  busy = false,
  danger = false,
}: {
  readonly onCancel: () => void;
  readonly submit: string;
  readonly busy?: boolean;
  readonly danger?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        {t('secretariat.actions.cancel')}
      </button>
      <button
        type="submit"
        className={`btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? t('common.loading') : submit}
      </button>
    </div>
  );
}
