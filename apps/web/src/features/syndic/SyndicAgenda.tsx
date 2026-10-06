'use client';

import {
  PRIORITY_TIERS,
  REQUESTER_TYPES,
  type PriorityTier,
  type RequesterType,
} from '@sba/shared';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  FileText,
  ListChecks,
  MessageSquarePlus,
  RotateCcw,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type SubmitEvent } from 'react';

import { FormError, FormFooter } from '@/components/BookingFields';

import { DayList } from '@/components/agenda/DayList';
import { LiveBoard, nextAppointment } from '@/components/agenda/LiveBoard';
import { MonthCalendar } from '@/components/agenda/MonthCalendar';
import { displayName } from '@/components/agenda/view';
import { Modal } from '@/components/Modal';
import { PreviewBanner } from '@/components/PreviewBanner';
import { Seal } from '@/components/Seal';
import { useNow } from '@/components/useNow';
import { useAgendaMonth } from '@/data/agenda';
import type { Appt } from '@/data/model';
import { useResource, useWorkspace } from '@/data/workspace';
import { doneMessage, ResourceStatus } from '@/features/secretariat/SecretariatDashboard';
import { formatDate, formatNumber, t } from '@/i18n';
import type { ApiResult } from '@/lib/api';
import { damascusIsoDate, fromDamascusInput } from '@/lib/dates';
import { formText } from '@/lib/form';

type Tab = 'today' | 'calendar';
type Dialog =
  | { kind: 'add' }
  | { kind: 'ask' }
  | { kind: 'emergency' }
  | { kind: 'doc'; name: string }
  | { kind: 'transfer'; appointment: Appt };

const DURATIONS = [15, 30, 45, 60, 90, 120] as const;

/**
 * The Grand Syndic's executive view. Live board and today's audiences first;
 * the full calendar one tap away; every tool he needs in one row.
 */
export function SyndicAgenda() {
  const ws = useWorkspace({ kind: 'SYNDIC' });
  const now = useNow();
  const [tab, setTab] = useState<Tab>('today');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const today = now ? damascusIsoDate(now) : '';
  const agenda = useAgendaMonth(ws, today, 30_000);
  const members = useResource(ws, () => ws.members(), [ws]);
  const todays = agenda.today;
  const ready = now !== null && agenda.items !== null;
  const scheduledToday = todays.filter((x) => x.status === 'SCHEDULED');
  const next = now ? nextAppointment(todays, now) : undefined;
  const selectedDay = selected ?? today;

  function close() {
    setDialog(null);
    setError(null);
  }

  /** Runs an action; on success closes the dialog, says so, and reloads the agenda. */
  async function run(action: () => Promise<ApiResult<unknown>>, message: () => string) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    close();
    setNotice(doneMessage(ws, message()));
    agenda.reload();
  }

  function submitEntry(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startsAt = fromDamascusInput(formText(form, 'date'), formText(form, 'time'));
    void run(
      () =>
        ws.addEntry({
          title: formText(form, 'title'),
          startsAt,
          endsAt: new Date(startsAt.getTime() + Number(formText(form, 'duration')) * 60_000),
          locationNote: formText(form, 'location'),
          isPrivate: form.get('private') === 'on',
        }),
      () => t('syndic.entryAdded'),
    );
  }

  function submitTransfer(event: SubmitEvent<HTMLFormElement>, appointment: Appt) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const memberId = formText(form, 'member');
    const keepTime = formText(form, 'when') !== 'NEW';
    const name = members.data?.find((m) => m.id === memberId)?.name ?? '';
    void run(
      () => ws.transfer(appointment.id, memberId, keepTime, formText(form, 'note')),
      () =>
        keepTime ? t('syndic.transferDone', { name }) : t('syndic.transferDonePending', { name }),
    );
  }

  function submitAsk(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      () =>
        ws.askSecretariat({
          name: formText(form, 'name'),
          phone: formText(form, 'phone'),
          purpose: formText(form, 'purpose'),
          priority: formText(form, 'priority') as PriorityTier,
          requesterType: formText(form, 'type') as RequesterType,
        }),
      () => t('syndic.askDone'),
    );
  }

  function postpone() {
    if (!now) return;
    void run(
      () => ws.emergencyPostpone(now),
      () => t('syndic.emergencyDone'),
    );
  }

  const remaining = now
    ? todays.filter(
        (x) =>
          x.origin === 'SECRETARIAT' &&
          x.status === 'SCHEDULED' &&
          !x.startedAt &&
          x.startsAt >= now,
      )
    : [];

  const entryActions = (item: Appt) => {
    if (item.status !== 'SCHEDULED') return null;
    if (item.origin === 'PRINCIPAL') {
      return (
        <button
          type="button"
          className="btn btn-secondary min-h-9 px-3 text-sm"
          onClick={() => {
            void run(
              () => ws.cancelEntry(item.id),
              () => t('syndic.entryCancelled'),
            );
          }}
        >
          <XCircle className="size-4" aria-hidden="true" />
          {t('syndic.cancelEntry')}
        </button>
      );
    }
    if (item.startedAt) return null;
    return (
      <button
        type="button"
        className="btn btn-secondary min-h-9 px-3 text-sm"
        onClick={() => {
          setDialog({ kind: 'transfer', appointment: item });
        }}
      >
        <UserRoundCheck className="size-4" aria-hidden="true" />
        {t('syndic.transfer')}
      </button>
    );
  };

  return (
    <main id="main" className="mx-auto grid max-w-6xl gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={ws.demo ? '/' : '/account'} className="btn btn-secondary min-h-10 px-3 text-sm">
          <ArrowRight className="size-4" aria-hidden="true" />
          {ws.demo ? t('nav.home') : t('account.title')}
        </Link>
        {ws.demo && (
          <button
            type="button"
            className="btn btn-secondary min-h-10 px-3 text-sm"
            onClick={() => {
              ws.reset();
              setNotice(null);
            }}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t('preview.reset')}
          </button>
        )}
      </div>

      <section className="hero grid gap-5 p-5 sm:p-7">
        <div className="relative flex items-center gap-4">
          <Seal id="syndic" className="size-16 shrink-0 text-gold-300 sm:size-20" />
          <div className="min-w-0">
            <p className="text-sm text-gold-300">{t('entities.GRAND_SYNDIC')}</p>
            <h1 className="text-2xl font-bold sm:text-3xl">{t('syndic.title')}</h1>
            <p className="text-navy-100">{now ? formatDate(now) : ' '}</p>
          </div>
          <div className="ms-auto hidden rounded-2xl bg-white/10 px-5 py-3 text-center sm:block">
            <p className="text-3xl font-bold">
              {ready ? formatNumber(scheduledToday.length) : '—'}
            </p>
            <p className="text-xs text-gold-100">{t('syndic.countLabel')}</p>
          </div>
        </div>
        <div className="relative grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            className="btn bg-gold-500 text-sm text-navy-950 hover:bg-gold-300 sm:text-base"
            onClick={() => {
              setDialog({ kind: 'add' });
            }}
          >
            <CalendarPlus className="size-5" aria-hidden="true" />
            {t('syndic.addEntry')}
          </button>
          <button
            type="button"
            className="btn bg-white/10 text-sm whitespace-nowrap text-white hover:bg-white/20 sm:text-base"
            onClick={() => {
              setDialog({ kind: 'ask' });
            }}
          >
            <MessageSquarePlus className="size-5" aria-hidden="true" />
            {t('syndic.askSecretariat')}
          </button>
        </div>
      </section>

      {ws.demo && <PreviewBanner />}

      {notice && (
        <p role="status" className="rounded-2xl bg-navy-900 p-4 text-sm text-white">
          {notice}
        </p>
      )}

      <div
        role="tablist"
        aria-label={t('syndic.title')}
        className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 shadow-sm"
      >
        {(
          [
            ['today', t('syndic.tabs.today'), ListChecks],
            ['calendar', t('syndic.tabs.calendar'), CalendarDays],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => {
              setTab(value);
            }}
            className={`btn ${tab === value ? 'btn-primary' : 'text-ink-muted'}`}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <ResourceStatus resource={agenda.resource} onRetry={agenda.reload} />

      {ready && tab === 'today' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          <LiveBoard appointments={todays} now={now} />
          <DayList
            appointments={todays}
            highlightId={next?.id}
            onOpenDocument={(name) => {
              setDialog({ kind: 'doc', name });
            }}
            actions={entryActions}
          />
        </div>
      )}

      {ready && tab === 'calendar' && (
        <div className="grid gap-5">
          <MonthCalendar
            month={agenda.month}
            onMonthChange={agenda.setMonth}
            selected={selectedDay}
            onSelect={setSelected}
            today={today}
            appointments={agenda.items ?? []}
          />
          <div className="grid gap-3">
            <h2 className="text-lg font-bold">
              {formatDate(new Date(`${selectedDay}T12:00:00+03:00`))}
            </h2>
            <DayList
              appointments={agenda.dayItems(selectedDay)}
              onOpenDocument={(name) => {
                setDialog({ kind: 'doc', name });
              }}
              actions={entryActions}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn btn-danger mt-2 w-full sm:w-auto sm:justify-self-start"
        onClick={() => {
          setDialog({ kind: 'emergency' });
        }}
      >
        <AlertTriangle className="size-5" aria-hidden="true" />
        {t('syndic.emergency')}
      </button>

      {dialog?.kind === 'add' && now && (
        <Modal title={t('syndic.addEntryTitle')} onClose={close}>
          <form className="grid gap-4" onSubmit={submitEntry}>
            <p className="rounded-xl bg-navy-50 p-3 text-sm text-navy-800">
              {t('syndic.entryHint')}
            </p>
            <div>
              <label htmlFor="title" className="field-label">
                {t('syndic.entryTitle')}
              </label>
              <input id="title" name="title" required className="input" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="date" className="field-label">
                  {t('secretariat.approve.date')}
                </label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  required
                  defaultValue={selected ?? today}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="time" className="field-label">
                  {t('secretariat.approve.time')}
                </label>
                <input
                  id="time"
                  name="time"
                  type="time"
                  required
                  defaultValue="13:00"
                  step={900}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="duration" className="field-label">
                  {t('secretariat.approve.duration')}
                </label>
                <select id="duration" name="duration" defaultValue={60} className="input">
                  {DURATIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {t('secretariat.approve.minutes', { count: minutes })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="location" className="field-label">
                {t('syndic.location')}
              </label>
              <input id="location" name="location" required className="input" />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm font-bold">
              <input
                type="checkbox"
                name="private"
                defaultChecked
                className="size-5 accent-navy-800"
              />
              {t('syndic.private')}
            </label>
            <FormError message={error} />
            <FormFooter onCancel={close} busy={busy} submit={t('secretariat.actions.confirm')} />
          </form>
        </Modal>
      )}

      {dialog?.kind === 'transfer' && (
        <Modal title={t('syndic.transferTitle')} onClose={close}>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              submitTransfer(event, dialog.appointment);
            }}
          >
            <p className="font-bold">{displayName(dialog.appointment)}</p>
            <p className="rounded-xl bg-navy-50 p-3 text-sm text-navy-800">
              {t('syndic.transferHint')}
            </p>
            <div>
              <label htmlFor="member" className="field-label">
                {t('syndic.transferMember')}
              </label>
              <select id="member" name="member" required defaultValue="" className="input">
                <option value="" disabled />
                {members.data?.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="grid gap-2">
              <legend className="field-label">{t('syndic.transferWhen')}</legend>
              {(
                [
                  ['SAME', t('syndic.transferKeep'), t('syndic.transferKeepHint')],
                  ['NEW', t('syndic.transferNewTime'), t('syndic.transferNewTimeHint')],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-navy-700 has-[:checked]:bg-navy-50"
                >
                  <input
                    type="radio"
                    name="when"
                    value={value}
                    defaultChecked={value === 'SAME'}
                    className="mt-1 size-4 accent-navy-800"
                  />
                  <span>
                    <span className="block font-bold">{label}</span>
                    <span className="block text-sm text-ink-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div>
              <label htmlFor="note" className="field-label">
                {t('syndic.transferNote')}
              </label>
              <textarea id="note" name="note" rows={2} className="input" />
            </div>
            <FormError message={error} />
            <FormFooter onCancel={close} busy={busy} submit={t('syndic.transfer')} />
          </form>
        </Modal>
      )}

      {dialog?.kind === 'ask' && (
        <Modal title={t('syndic.askTitle')} onClose={close}>
          <form className="grid gap-4" onSubmit={submitAsk}>
            <div>
              <label htmlFor="name" className="field-label">
                {t('syndic.askName')}
              </label>
              <input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={120}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="phone" className="field-label">
                {t('syndic.askPhone')}
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                dir="ltr"
                required
                pattern="\+[1-9][0-9]{7,14}"
                placeholder="+9639XXXXXXXX"
                className="input"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="type" className="field-label">
                  {t('syndic.askType')}
                </label>
                <select id="type" name="type" defaultValue="LAWYER" className="input">
                  {REQUESTER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`labels.requesterType.${type}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="priority" className="field-label">
                  {t('syndic.askPriority')}
                </label>
                <select id="priority" name="priority" defaultValue="INTERNAL" className="input">
                  {PRIORITY_TIERS.map((priority) => (
                    <option key={priority} value={priority}>
                      {t(`labels.priorityShort.${priority}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="purpose" className="field-label">
                {t('syndic.askPurpose')}
              </label>
              <textarea
                id="purpose"
                name="purpose"
                rows={3}
                required
                minLength={10}
                maxLength={2000}
                className="input"
              />
            </div>
            <FormError message={error} />
            <FormFooter onCancel={close} busy={busy} submit={t('secretariat.actions.confirm')} />
          </form>
        </Modal>
      )}

      {dialog?.kind === 'doc' && (
        <Modal title={t('syndic.docPreviewTitle')} onClose={close}>
          <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-line bg-canvas p-8 text-center">
            <FileText className="size-12 text-navy-700" aria-hidden="true" />
            <p className="font-bold">{dialog.name}</p>
            <p className="text-sm text-ink-muted">{t('syndic.docPreviewUnavailable')}</p>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'emergency' && (
        <Modal title={t('syndic.emergencyTitle')} onClose={close}>
          <p className="leading-relaxed">
            {remaining.length > 0
              ? t('syndic.emergencyBody', { count: remaining.length })
              : t('syndic.emergencyNone')}
          </p>
          <FormError message={error} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={close}>
              {t('secretariat.actions.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-danger-solid"
              disabled={remaining.length === 0 || busy}
              onClick={postpone}
            >
              {t('syndic.emergencyConfirm')}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
