'use client';

import { CalendarClock, Hourglass } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';

import { PriorityBadge } from '@/components/Badges';
import { BookingFields, FormError, FormFooter, readBooking } from '@/components/BookingFields';
import { Modal } from '@/components/Modal';
import type { Appt, Booking, Option } from '@/data/model';
import { formatDateTime, t } from '@/i18n';
import type { ApiResult } from '@/lib/api';
import { addDays, damascusIsoDate } from '@/lib/dates';

import { displayName } from './view';

interface PendingTransfersProps {
  readonly items: readonly Appt[];
  readonly now: Date;
  /** The Secretariat sees which member each transfer went to; the member does not need to. */
  readonly showMember: boolean;
  readonly rooms: readonly Option[] | null;
  readonly onSchedule: (item: Appt, booking: Booking) => Promise<ApiResult<unknown>>;
  readonly onScheduled: (message: string) => void;
}

/** Transfers from the Grand Syndic still waiting for a new time (decision D21). */
export function PendingTransfers({
  items,
  now,
  showMember,
  rooms,
  onSchedule,
  onScheduled,
}: PendingTransfersProps) {
  const [open, setOpen] = useState<Appt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(null);
    setError(null);
  }

  async function submit(event: SubmitEvent<HTMLFormElement>, item: Appt) {
    event.preventDefault();
    setBusy(true);
    const result = await onSchedule(item, readBooking(new FormData(event.currentTarget)));
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
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
                  {showMember && item.transferredTo && (
                    <span className="badge bg-tier-internal-bg text-tier-internal">
                      {t('transfers.member')}: {item.transferredTo.name}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-bold">{displayName(item)}</p>
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
          title={t('transfers.scheduleTitle', { name: open.transferredTo?.name ?? '' })}
          onClose={close}
        >
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              void submit(event, open);
            }}
          >
            <p className="font-bold">{displayName(open)}</p>
            <BookingFields
              idPrefix="pt"
              defaultDate={addDays(damascusIsoDate(now), 1)}
              defaultTime="11:00"
              preferred={open.mode}
              rooms={rooms}
            />
            <FormError message={error} />
            <FormFooter onCancel={close} submit={t('secretariat.actions.confirm')} busy={busy} />
          </form>
        </Modal>
      )}
    </section>
  );
}
