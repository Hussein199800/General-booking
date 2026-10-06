'use client';

import type { MeetingMode, MyTicket } from '@sba/shared';
import { FilePlus2, ListChecks, LogOut, MessageSquarePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type SubmitEvent } from 'react';

import { StatusBadge } from '@/components/Badges';
import { FormError } from '@/components/BookingFields';
import { formatDate, formatDateTime, t } from '@/i18n';
import { api, newIdempotencyKey, type ApiResult } from '@/lib/api';
import { formText } from '@/lib/form';
import { signOut, useMe } from '@/lib/session';

type Tab = 'tickets' | 'grievance' | 'audience';

/** Tier 2: a registered lawyer's own requests and grievances — never anyone else's. */
export function LawyerPortal() {
  const me = useMe();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('tickets');
  const [tickets, setTickets] = useState<ApiResult<MyTicket[]> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    void api.get<MyTicket[]>('/lawyer/me/tickets').then(setTickets);
  }, []);
  useEffect(load, [load]);

  function submitted(reference: string) {
    setNotice(t('lawyer.submitted', { reference }));
    setTab('tickets');
    load();
  }

  return (
    <div className="grid gap-4">
      <section className="hero flex flex-wrap items-center gap-4 p-6">
        <div className="relative min-w-0 flex-1">
          <p className="text-sm text-gold-300">{t('lawyer.portal')}</p>
          <h1 className="text-2xl font-bold">{me.fullName}</h1>
        </div>
        <button
          type="button"
          className="btn relative bg-white/10 text-white hover:bg-white/20"
          onClick={() => void signOut(router)}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {t('nav.signOut')}
        </button>
      </section>

      {notice && (
        <p role="status" className="rounded-2xl bg-navy-900 p-4 text-sm text-white">
          {notice}
        </p>
      )}

      <div
        role="tablist"
        aria-label={t('lawyer.portal')}
        className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1 shadow-sm"
      >
        {(
          [
            ['tickets', t('lawyer.tabs.tickets'), ListChecks],
            ['grievance', t('lawyer.tabs.grievance'), FilePlus2],
            ['audience', t('lawyer.tabs.audience'), MessageSquarePlus],
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
            className={`btn min-h-11 px-2 text-sm ${tab === value ? 'btn-primary' : 'text-ink-muted'}`}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'tickets' && <TicketList result={tickets} onRetry={load} />}
      {tab === 'grievance' && <GrievanceForm onDone={submitted} />}
      {tab === 'audience' && <AudienceForm onDone={submitted} />}
    </div>
  );
}

function TicketList({
  result,
  onRetry,
}: {
  readonly result: ApiResult<MyTicket[]> | null;
  readonly onRetry: () => void;
}) {
  if (!result) return <p className="p-4 text-ink-muted">{t('common.loading')}</p>;
  if (!result.ok) {
    return (
      <div role="alert" className="card grid gap-3 p-4 text-tier-critical">
        {result.message}
        <button type="button" className="btn btn-secondary justify-self-start" onClick={onRetry}>
          {t('common.retry')}
        </button>
      </div>
    );
  }
  if (result.value.length === 0) {
    return <p className="card p-6 text-center text-ink-muted">{t('lawyer.noTickets')}</p>;
  }
  return (
    <ul className="grid gap-3">
      {result.value.map((ticket) => (
        <li key={ticket.id} className="card grid gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-canvas text-ink-muted">
              {t(`labels.ticketKind.${ticket.kind}`)}
            </span>
            <StatusBadge status={ticket.status} />
            <span dir="ltr" className="ms-auto font-mono text-xs text-ink-subtle">
              {ticket.referenceCode}
            </span>
          </div>
          <p className="font-bold">{ticket.summary}</p>
          <p className="text-xs text-ink-subtle">
            {t('lawyer.submittedOn', { date: formatDate(new Date(ticket.submittedAt)) })}
          </p>
          {ticket.appointment && (
            <p className="rounded-xl bg-navy-50 p-3 text-sm text-navy-800">
              {t('lawyer.appointment', {
                date: formatDateTime(new Date(ticket.appointment.startsAt)),
                mode: t(`meetingMode.${ticket.appointment.mode}`),
              })}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function useSubmit(path: string, onDone: (reference: string) => void) {
  const [key, setKey] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function send(body: object) {
    setBusy(true);
    setError(null);
    const result = await api.post<{ referenceCode: string }>(path, body, { idempotencyKey: key });
    setBusy(false);
    if (!result.ok) {
      setError(result.fields?.length ? t('request.checkFields') : result.message);
      return;
    }
    setKey(newIdempotencyKey());
    onDone(result.value.referenceCode);
  }
  return { error, busy, send };
}

function GrievanceForm({ onDone }: { readonly onDone: (reference: string) => void }) {
  const [type, setType] = useState<'AGAINST_LAWYER' | 'JUDICIAL_MATTER'>('AGAINST_LAWYER');
  const { error, busy, send } = useSubmit('/lawyer/grievances', onDone);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => formText(form, name) || undefined;
    const common = {
      subject: formText(form, 'subject'),
      description: formText(form, 'description'),
      incidentDate: optional('incidentDate'),
    };
    void send(
      type === 'AGAINST_LAWYER'
        ? {
            grievanceType: type,
            ...common,
            respondentRegistrationNumber: formText(form, 'respondent'),
          }
        : {
            grievanceType: type,
            ...common,
            courtName: formText(form, 'court'),
            caseNumber: optional('caseNumber'),
          },
    );
  }

  return (
    <form className="card grid gap-4 p-5" onSubmit={submit}>
      <fieldset className="grid gap-2">
        <legend className="field-label">{t('lawyer.grievanceType')}</legend>
        {(['AGAINST_LAWYER', 'JUDICIAL_MATTER'] as const).map((value) => (
          <label
            key={value}
            className="flex items-center gap-3 rounded-xl border border-line p-3 has-[:checked]:border-navy-700 has-[:checked]:bg-navy-50"
          >
            <input
              type="radio"
              name="grievanceType"
              value={value}
              checked={type === value}
              onChange={() => {
                setType(value);
              }}
              className="size-4 accent-navy-800"
            />
            {t(`lawyer.grievanceTypes.${value}`)}
          </label>
        ))}
      </fieldset>
      <Field id="subject" label={t('lawyer.subject')} min={5} max={200} />
      <div>
        <label htmlFor="description" className="field-label">
          {t('lawyer.description')}
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          required
          minLength={20}
          maxLength={5000}
          className="input"
        />
      </div>
      {type === 'AGAINST_LAWYER' ? (
        <Field id="respondent" label={t('lawyer.respondent')} min={1} max={32} ltr />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="court" label={t('lawyer.court')} min={2} max={160} />
          <Field id="caseNumber" label={t('lawyer.caseNumber')} max={64} optional ltr />
        </div>
      )}
      <div>
        <label htmlFor="incidentDate" className="field-label">
          {t('lawyer.incidentDate')}
        </label>
        <input id="incidentDate" name="incidentDate" type="date" className="input" />
      </div>
      <p className="rounded-xl bg-navy-50 p-3 text-sm text-navy-800">
        {t('lawyer.documentsLater')}
      </p>
      <FormError message={error} />
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? t('common.loading') : t('lawyer.submit')}
      </button>
    </form>
  );
}

function AudienceForm({ onDone }: { readonly onDone: (reference: string) => void }) {
  const { error, busy, send } = useSubmit('/lawyer/audience-requests', onDone);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const mode = formText(form, 'mode');
    void send({
      purpose: formText(form, 'purpose'),
      preferredMeetingMode: mode ? (mode as MeetingMode) : undefined,
      expectedAttendees: Number(formText(form, 'attendees') || '1'),
    });
  }

  return (
    <form className="card grid gap-4 p-5" onSubmit={submit}>
      <div>
        <label htmlFor="purpose" className="field-label">
          {t('request.purpose')}
        </label>
        <textarea
          id="purpose"
          name="purpose"
          rows={5}
          required
          minLength={10}
          maxLength={2000}
          className="input"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="mode" className="field-label">
            {t('request.mode')}
          </label>
          <select id="mode" name="mode" defaultValue="" className="input">
            <option value="">{t('request.modeAny')}</option>
            {(['IN_PERSON', 'REMOTE'] as const).map((value) => (
              <option key={value} value={value}>
                {t(`meetingMode.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="attendees" className="field-label">
            {t('request.attendees')}
          </label>
          <input
            id="attendees"
            name="attendees"
            type="number"
            min={1}
            max={50}
            defaultValue={1}
            className="input"
          />
        </div>
      </div>
      <p className="rounded-xl bg-navy-50 p-3 text-sm text-navy-800">{t('request.notice')}</p>
      <FormError message={error} />
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? t('common.loading') : t('request.submit')}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  min,
  max,
  optional = false,
  ltr = false,
}: {
  readonly id: string;
  readonly label: string;
  readonly min?: number;
  readonly max: number;
  readonly optional?: boolean;
  readonly ltr?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={id}
        required={!optional}
        minLength={min}
        maxLength={max}
        dir={ltr ? 'ltr' : undefined}
        className="input"
      />
    </div>
  );
}
