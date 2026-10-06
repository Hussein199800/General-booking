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
} from 'lucide-react';
import Link from 'next/link';
import { useState, type SubmitEvent } from 'react';

import { DayList } from '@/components/agenda/DayList';
import { LiveBoard, nextAppointment } from '@/components/agenda/LiveBoard';
import { MonthCalendar } from '@/components/agenda/MonthCalendar';
import { memberName } from '@/components/agenda/view';
import { Modal } from '@/components/Modal';
import { PreviewBanner } from '@/components/PreviewBanner';
import { Seal } from '@/components/Seal';
import { useNow } from '@/components/useNow';
import { councilMembers, damascusIsoDate, type DemoAppointment } from '@/demo/data';
import { demoActions, pendingTransfers, useDemoState } from '@/demo/store';
import { formatDate, formatNumber, t } from '@/i18n';

type Tab = 'today' | 'calendar';
type Dialog =
  | { kind: 'add' }
  | { kind: 'ask' }
  | { kind: 'emergency' }
  | { kind: 'doc'; name: string }
  | { kind: 'transfer'; appointment: DemoAppointment };

const DURATIONS = [15, 30, 45, 60, 90, 120] as const;

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * The Grand Syndic's executive view. Live board and today's audiences first;
 * the full calendar one tap away; every tool he needs in one row.
 */
export function SyndicAgenda() {
  const state = useDemoState();
  const now = useNow();
  const [tab, setTab] = useState<Tab>('today');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const ready = state && now;
  const today = now ? damascusIsoDate(now) : '';
  const mine = (state?.appointments ?? [])
    .filter((x) => x.principal === 'SYNDIC')
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const todays = mine.filter((x) => damascusIsoDate(x.startsAt) === today);
  const scheduledToday = todays.filter((x) => x.status === 'SCHEDULED');
  const next = now ? nextAppointment(todays, now) : undefined;
  const pendingIds = new Set(state ? pendingTransfers(state).map((x) => x.id) : []);
  const selectedDay = selected ?? today;
  const dayEntries = mine.filter((x) => damascusIsoDate(x.startsAt) === selectedDay);

  function close() {
    setDialog(null);
    setError(null);
  }

  function done(message: string) {
    close();
    setNotice(`${message} ${t('preview.actionNotSaved')}`);
  }

  function submitEntry(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startsAt = new Date(`${text(form, 'date')}T${text(form, 'time')}:00+03:00`);
    const endsAt = new Date(startsAt.getTime() + Number(text(form, 'duration')) * 60_000);
    const result = demoActions.addPrincipalEntry({
      title: text(form, 'title'),
      startsAt,
      endsAt,
      locationNote: text(form, 'location'),
      isPrivate: form.get('private') === 'on',
    });
    if (result.ok) done(t('syndic.entryAdded'));
    else setError(t('syndic.conflict'));
  }

  function submitTransfer(event: SubmitEvent<HTMLFormElement>, appointment: DemoAppointment) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const memberId = text(form, 'member');
    const keepTime = text(form, 'when') !== 'NEW';
    const result = demoActions.transfer(appointment.id, memberId, text(form, 'note'), keepTime);
    if (!result.ok) {
      setError(t('syndic.memberBusy'));
      return;
    }
    const name = memberName(memberId);
    done(keepTime ? t('syndic.transferDone', { name }) : t('syndic.transferDonePending', { name }));
  }

  function submitAsk(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    demoActions.requestFromPrincipal({
      name: text(form, 'name'),
      purpose: text(form, 'purpose'),
      priority: text(form, 'priority') as PriorityTier,
      requesterType: text(form, 'type') as RequesterType,
    });
    done(t('syndic.askDone'));
  }

  function postpone() {
    if (!now) return;
    demoActions.postponeRestOfDay(today, now, damascusIsoDate);
    done(t('syndic.emergencyDone'));
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

  const transferAction = (item: DemoAppointment) =>
    item.origin === 'SECRETARIAT' && item.status === 'SCHEDULED' && !item.startedAt ? (
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
    ) : null;

  return (
    <main id="main" className="mx-auto grid max-w-6xl gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/" className="btn btn-secondary min-h-10 px-3 text-sm">
          <ArrowRight className="size-4" aria-hidden="true" />
          {t('nav.home')}
        </Link>
        <button
          type="button"
          className="btn btn-secondary min-h-10 px-3 text-sm"
          onClick={() => {
            demoActions.reset();
            setNotice(null);
          }}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          {t('preview.reset')}
        </button>
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

      <PreviewBanner />

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

      {ready && tab === 'today' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          <LiveBoard appointments={todays} now={now} viewer="SYNDIC" />
          <DayList
            appointments={todays}
            viewer="SYNDIC"
            highlightId={next?.id}
            onOpenDocument={(name) => {
              setDialog({ kind: 'doc', name });
            }}
            actions={transferAction}
            pendingTransferIds={pendingIds}
          />
        </div>
      )}

      {ready && tab === 'calendar' && (
        <div className="grid gap-5">
          <MonthCalendar
            month={month ?? `${today.slice(0, 7)}-01`}
            onMonthChange={setMonth}
            selected={selectedDay}
            onSelect={setSelected}
            today={today}
            appointments={mine}
            viewer="SYNDIC"
          />
          <div className="grid gap-3">
            <h2 className="text-lg font-bold">
              {formatDate(new Date(`${selectedDay}T12:00:00+03:00`))}
            </h2>
            <DayList
              appointments={dayEntries}
              viewer="SYNDIC"
              onOpenDocument={(name) => {
                setDialog({ kind: 'doc', name });
              }}
              actions={transferAction}
              pendingTransferIds={pendingIds}
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
            <Footer onCancel={close} submit={t('secretariat.actions.confirm')} />
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
            <p className="font-bold">{dialog.appointment.name}</p>
            <p className="rounded-xl bg-navy-50 p-3 text-sm text-navy-800">
              {t('syndic.transferHint')}
            </p>
            <div>
              <label htmlFor="member" className="field-label">
                {t('syndic.transferMember')}
              </label>
              <select id="member" name="member" required defaultValue="" className="input">
                <option value="" disabled />
                {councilMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} — {member.capacity}
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
            <Footer onCancel={close} submit={t('syndic.transfer')} />
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
              <input id="name" name="name" required className="input" />
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
              <textarea id="purpose" name="purpose" rows={3} required className="input" />
            </div>
            <Footer onCancel={close} submit={t('secretariat.actions.confirm')} />
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
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={close}>
              {t('secretariat.actions.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-danger-solid"
              disabled={remaining.length === 0}
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

function FormError({ message }: { message: string | null }) {
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

function Footer({ onCancel, submit }: { onCancel: () => void; submit: string }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        {t('secretariat.actions.cancel')}
      </button>
      <button type="submit" className="btn btn-primary">
        {submit}
      </button>
    </div>
  );
}
