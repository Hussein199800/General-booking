'use client';

import {
  canTransitionTicket,
  PRIORITY_TIERS,
  type PriorityTier,
  type RequestStatus,
} from '@sba/shared';
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileQuestion,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';

import { AppShell } from '@/components/AppShell';
import { PRIORITY_ACCENT, PRIORITY_BORDER, PriorityBadge, StatusBadge } from '@/components/Badges';
import { BookingFields, FormError, FormFooter, readBooking } from '@/components/BookingFields';
import { PreviewBanner } from '@/components/PreviewBanner';
import { useNow } from '@/components/useNow';
import type { Option, Ticket } from '@/data/model';
import { useResource, useWorkspace, type Resource, type Workspace } from '@/data/workspace';
import { formatDate, formatNumber, formatRelative, t, type MessageKey } from '@/i18n';
import type { ApiResult } from '@/lib/api';
import { addDays, damascusIsoDate } from '@/lib/dates';
import { formText } from '@/lib/form';
import { useIdentity } from '@/lib/session';

import { secretariatNav } from './nav';

type Filter = 'ALL' | PriorityTier;
type Step = 'detail' | 'approve' | 'delegate' | 'documents' | 'decline';

const PAGE_SIZE = 20;
const STAT_LABEL = {
  CRITICAL: 'secretariat.stats.critical',
  INTERNAL: 'secretariat.stats.internal',
  STANDARD: 'secretariat.stats.standard',
} as const satisfies Record<PriorityTier, MessageKey>;

/** Shown after every successful action; the demo build says it was kept on this device only. */
export function doneMessage(ws: Workspace, message: string): string {
  return ws.demo ? `${message} ${t('preview.actionNotSaved')}` : message;
}

export function SecretariatDashboard() {
  const ws = useWorkspace({ kind: 'SECRETARIAT' });
  const now = useNow();
  const identity = useIdentity({ name: t('secretariat.user'), role: t('secretariat.role') });
  const [filter, setFilter] = useState<Filter>('ALL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const priority = filter === 'ALL' ? undefined : filter;
  const queue = useResource(ws, () => ws.queue({ priority, q, page, pageSize: PAGE_SIZE }), [
    ws,
    priority,
    q,
    page,
  ]);
  const counts = useResource(ws, () => ws.counts(), [ws]);
  const rooms = useResource(ws, () => ws.rooms(), [ws]);
  const targets = useResource(ws, () => ws.routingTargets(), [ws]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 6000);
    return () => {
      clearTimeout(timer);
    };
  }, [toast]);

  function decided(message: string) {
    setSelected(null);
    setToast(doneMessage(ws, message));
    queue.reload();
    counts.reload();
  }

  const open = counts.data?.open;
  const totalOpen = open ? PRIORITY_TIERS.reduce((sum, tier) => sum + open[tier], 0) : null;
  const pages = queue.data ? Math.max(1, Math.ceil(queue.data.total / PAGE_SIZE)) : 1;
  const show = (value: number | null | undefined) =>
    value === null || value === undefined ? '—' : formatNumber(value);

  return (
    <AppShell
      sectionName={t('secretariat.nav.dashboard')}
      nav={secretariatNav('dashboard')}
      userName={identity.name}
      userRole={identity.role}
      today={now ? formatDate(now) : ''}
    >
      <div className="mx-auto grid max-w-6xl gap-5">
        {ws.demo && <PreviewBanner />}

        <section className="hero grid gap-4 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
          <div className="relative">
            <h1 className="text-2xl font-bold sm:text-3xl">{t('secretariat.title')}</h1>
            <p className="mt-2 text-navy-100">{t('secretariat.subtitle')}</p>
          </div>
          <div className="relative rounded-2xl bg-white/10 px-6 py-4 text-center">
            <p className="text-sm text-gold-300">{t('secretariat.pendingTotal')}</p>
            <p className="text-4xl font-bold">{show(totalOpen)}</p>
          </div>
        </section>

        <section
          className="grid grid-cols-2 gap-3 md:grid-cols-5"
          aria-label={t('secretariat.title')}
        >
          {PRIORITY_TIERS.map((tier) => (
            <div
              key={tier}
              className="stat-card"
              style={{ ['--stat-accent' as string]: PRIORITY_ACCENT[tier] }}
            >
              <p className="text-sm text-ink-muted">{t(STAT_LABEL[tier])}</p>
              <p className="text-3xl font-bold" style={{ color: PRIORITY_ACCENT[tier] }}>
                {show(counts.data?.open[tier])}
              </p>
            </div>
          ))}
          <div className="stat-card [--stat-accent:var(--color-gold-500)]">
            <p className="text-sm text-ink-muted">{t('secretariat.stats.awaitingDocuments')}</p>
            <p className="text-3xl font-bold text-gold-700">
              {show(counts.data?.awaitingDocuments)}
            </p>
          </div>
          <div className="stat-card col-span-2 md:col-span-1">
            <p className="text-sm text-ink-muted">{t('secretariat.stats.decided')}</p>
            <p className="text-3xl font-bold text-navy-800">{show(counts.data?.decided)}</p>
          </div>
        </section>

        <section className="card grid gap-4 p-4 sm:p-6" aria-labelledby="queue-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="queue-heading" className="text-xl font-bold">
              {t('secretariat.queue.heading')}
            </h2>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={t('secretariat.queue.heading')}
            >
              {(['ALL', ...PRIORITY_TIERS] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => {
                    setFilter(value);
                    setPage(1);
                  }}
                  className={`badge min-h-9 border px-4 text-sm ${
                    filter === value
                      ? 'border-navy-800 bg-navy-800 text-white'
                      : 'border-line bg-surface text-ink-muted'
                  }`}
                >
                  {value === 'ALL'
                    ? t('secretariat.queue.all')
                    : t(`labels.priorityShort.${value}`)}
                </button>
              ))}
            </div>
          </div>

          <form
            role="search"
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setQ(formText(new FormData(event.currentTarget), 'q'));
              setPage(1);
            }}
          >
            <label htmlFor="queue-search" className="sr-only">
              {t('secretariat.queue.search')}
            </label>
            <input
              id="queue-search"
              name="q"
              type="search"
              maxLength={100}
              placeholder={t('secretariat.queue.searchPlaceholder')}
              className="input flex-1"
            />
            <button type="submit" className="btn btn-secondary px-4">
              <Search className="size-5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t('secretariat.queue.search')}</span>
            </button>
          </form>

          <ResourceStatus resource={queue} onRetry={queue.reload} />

          {queue.data && queue.data.items.length === 0 && (
            <p className="rounded-2xl bg-canvas p-6 text-center text-ink-muted">
              {q ? t('secretariat.queue.noMatch') : t('secretariat.queue.empty')}
            </p>
          )}

          <ul className="grid gap-3" aria-busy={queue.state === 'loading'}>
            {now &&
              queue.data?.items.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(ticket);
                    }}
                    className={`grid w-full gap-2 rounded-2xl border border-line border-s-4 bg-surface p-4 text-start transition hover:shadow-md ${PRIORITY_BORDER[ticket.priority]}`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={ticket.priority} />
                      <span className="badge bg-canvas text-ink-muted">
                        {t(`labels.ticketKind.${ticket.kind}`)}
                      </span>
                      <StatusBadge status={ticket.status} />
                      {ticket.fromPrincipal && (
                        <span className="badge bg-gold-100 text-gold-700">
                          {t('secretariat.queue.fromPrincipal')}
                        </span>
                      )}
                      <span className="ms-auto font-mono text-xs text-ink-subtle" dir="ltr">
                        {ticket.referenceCode}
                      </span>
                    </span>
                    <span className="font-bold">
                      {ticket.requesterName}
                      <span className="font-normal text-ink-muted">
                        {' — '}
                        {ticket.organization || t(`labels.requesterType.${ticket.requesterType}`)}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-sm text-ink-muted">{ticket.summary}</span>
                    <span className="flex flex-wrap items-center gap-4 text-xs text-ink-subtle">
                      <span className="flex items-center gap-1">
                        <Clock3 className="size-3.5" aria-hidden="true" />
                        {t('secretariat.queue.submitted', {
                          when: formatRelative(ticket.submittedAt, now),
                        })}
                      </span>
                      {ticket.attachmentsCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Paperclip className="size-3.5" aria-hidden="true" />
                          {t('secretariat.queue.attachments', { count: ticket.attachmentsCount })}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
          </ul>

          {queue.data && pages > 1 && (
            <nav
              className="flex items-center justify-center gap-3"
              aria-label={t('secretariat.queue.pagination')}
            >
              <button
                type="button"
                className="btn btn-secondary min-h-10 px-3"
                disabled={page <= 1}
                onClick={() => {
                  setPage((n) => n - 1);
                }}
                aria-label={t('secretariat.queue.previous')}
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
              <span className="text-sm text-ink-muted">
                {t('secretariat.queue.pageOf', { page, pages })}
              </span>
              <button
                type="button"
                className="btn btn-secondary min-h-10 px-3"
                disabled={page >= pages}
                onClick={() => {
                  setPage((n) => n + 1);
                }}
                aria-label={t('secretariat.queue.next')}
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
            </nav>
          )}
        </section>
      </div>

      {selected && now && (
        <TicketDialog
          ws={ws}
          ticket={selected}
          now={now}
          rooms={rooms.data}
          targets={targets.data}
          onClose={() => {
            setSelected(null);
          }}
          onDone={decided}
        />
      )}

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex justify-center"
      >
        {toast && (
          <p className="pointer-events-auto max-w-xl rounded-2xl bg-navy-900 px-5 py-3 text-sm text-white shadow-xl">
            {toast}
          </p>
        )}
      </div>
    </AppShell>
  );
}

/** Loading indicator, or an error with retry that never pretends stale data is fresh. */
export function ResourceStatus({
  resource,
  onRetry,
}: {
  readonly resource: Resource<unknown>;
  readonly onRetry: () => void;
}) {
  if (resource.state === 'loading' && resource.data === null) {
    return (
      <p role="status" className="flex items-center gap-2 p-4 text-ink-muted">
        <span className="size-4 animate-spin rounded-full border-2 border-navy-200 border-t-navy-800" />
        {t('common.loading')}
      </p>
    );
  }
  if (resource.state === 'error') {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-xl bg-tier-critical-bg p-3 text-sm text-tier-critical"
      >
        <span className="flex-1 font-bold">
          {resource.message}
          {resource.data !== null && ` ${t('common.staleData')}`}
        </span>
        <button type="button" className="btn btn-secondary min-h-9 px-3 text-sm" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {t('common.retry')}
        </button>
      </div>
    );
  }
  return null;
}

interface TicketDialogProps {
  readonly ws: Workspace;
  readonly ticket: Ticket;
  readonly now: Date;
  readonly rooms: readonly Option[] | null;
  readonly targets: { units: Option[]; entities: Option[] } | null;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}

function TicketDialog({ ws, ticket, now, rooms, targets, onClose, onDone }: TicketDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>('detail');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const detail = useResource(ws, () => ws.ticket(ticket.id), [ws, ticket.id]);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const can = (to: RequestStatus) => canTransitionTicket(ticket.kind, ticket.status, to);

  async function run(action: () => Promise<ApiResult<unknown>>, message: string) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.ok) onDone(message);
    else setError(result.message);
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    switch (step) {
      case 'approve':
        void run(() => ws.approve(ticket.id, readBooking(form)), t('secretariat.approve.success'));
        break;
      case 'delegate': {
        const [kind, code] = formText(form, 'target').split(':');
        void run(
          () =>
            ws.delegate(
              ticket.id,
              {
                targetType: kind === 'ENTITY' ? 'EXTERNAL_ENTITY' : 'ORGANIZATIONAL_UNIT',
                targetCode: code ?? '',
              },
              formText(form, 'instructions'),
            ),
          t('secretariat.delegate.success'),
        );
        break;
      }
      case 'documents':
        void run(
          () => ws.requestDocuments(ticket.id, formText(form, 'docs'), formText(form, 'due')),
          t('secretariat.documents.success'),
        );
        break;
      case 'decline':
        void run(() => ws.decline(ticket.id), t('secretariat.decline.success'));
        break;
      case 'detail':
        break;
    }
  }

  const actions = [
    can('APPROVED') && {
      step: 'approve' as const,
      label: t('secretariat.actions.approve'),
      icon: CalendarCheck,
      cls: 'btn-primary',
    },
    can('DELEGATED') && {
      step: 'delegate' as const,
      label: t('secretariat.actions.delegate'),
      icon: Send,
      cls: 'btn-secondary',
    },
    can('AWAITING_DOCUMENTS') && {
      step: 'documents' as const,
      label: t('secretariat.actions.requestDocuments'),
      icon: FileQuestion,
      cls: 'btn-secondary',
    },
    can('DECLINED') && {
      step: 'decline' as const,
      label: t('secretariat.actions.decline'),
      icon: XCircle,
      cls: 'btn-danger',
    },
  ].filter((action) => action !== false);

  const back = () => {
    setError(null);
    setStep('detail');
  };
  const info = detail.data;

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="ticket-title">
      <div className="grid gap-4 p-5 sm:p-6">
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>
            <h2 id="ticket-title" className="mt-2 text-xl font-bold">
              {ticket.requesterName}
            </h2>
            <p className="font-mono text-xs text-ink-subtle" dir="ltr">
              {ticket.referenceCode}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary min-h-10 px-3"
            onClick={() => ref.current?.close()}
            aria-label={t('secretariat.detail.close')}
          >
            <XCircle className="size-5" aria-hidden="true" />
          </button>
        </header>

        {step === 'detail' && (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Field
                label={t('secretariat.detail.kind')}
                value={t(`labels.ticketKind.${ticket.kind}`)}
              />
              {ticket.capacity && (
                <Field label={t('secretariat.detail.capacity')} value={ticket.capacity} />
              )}
              {ticket.organization && (
                <Field label={t('secretariat.detail.organization')} value={ticket.organization} />
              )}
              <Field
                label={t('secretariat.detail.requester')}
                value={t(`labels.requesterType.${ticket.requesterType}`)}
              />
              {ticket.preferredMeetingMode && (
                <Field
                  label={t('secretariat.detail.preferredMode')}
                  value={t(`meetingMode.${ticket.preferredMeetingMode}`)}
                />
              )}
              <Field
                label={t('secretariat.detail.submittedAt')}
                value={formatRelative(ticket.submittedAt, now)}
              />
              {info?.contactPhone && (
                <Field label={t('secretariat.detail.phone')} value={info.contactPhone} ltr />
              )}
              {info?.contactEmail && (
                <Field label={t('secretariat.detail.email')} value={info.contactEmail} ltr />
              )}
              {info?.grievance?.respondentRegistrationNumber && (
                <Field
                  label={t('secretariat.detail.respondent')}
                  value={info.grievance.respondentRegistrationNumber}
                />
              )}
              {info?.grievance?.courtName && (
                <Field label={t('secretariat.detail.court')} value={info.grievance.courtName} />
              )}
              <div className="sm:col-span-2">
                <dt className="text-ink-subtle">{t('secretariat.detail.purpose')}</dt>
                <dd className="mt-1 rounded-xl bg-canvas p-3 leading-relaxed whitespace-pre-line">
                  {info?.description ?? ticket.summary}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-ink-subtle">{t('secretariat.detail.attachments')}</dt>
                <dd className="mt-1 flex flex-wrap gap-2">
                  {ticket.attachments.length === 0
                    ? t('secretariat.detail.noAttachments')
                    : ticket.attachments.map((name) => (
                        <span key={name} className="badge border border-line bg-surface text-ink">
                          <Paperclip className="size-3.5" aria-hidden="true" />
                          {name}
                        </span>
                      ))}
                </dd>
              </div>
            </dl>
            <ResourceStatus resource={detail} onRetry={detail.reload} />

            <div className="grid gap-2 border-t border-line pt-4">
              <p className="text-sm font-bold">{t('secretariat.detail.actions')}</p>
              {actions.length === 0 ? (
                <p className="text-sm text-ink-muted">{t('secretariat.detail.noActions')}</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {actions.map((action) => (
                    <button
                      key={action.step}
                      type="button"
                      className={`btn ${action.cls}`}
                      onClick={() => {
                        setStep(action.step);
                      }}
                    >
                      <action.icon className="size-5" aria-hidden="true" />
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {step !== 'detail' && (
          <form className="grid gap-4" onSubmit={submit}>
            {step === 'approve' && (
              <>
                <h3 className="text-lg font-bold">{t('secretariat.approve.title')}</h3>
                <BookingFields
                  idPrefix="ap"
                  defaultDate={damascusIsoDate(now)}
                  preferred={ticket.preferredMeetingMode}
                  rooms={rooms}
                />
              </>
            )}

            {step === 'delegate' && (
              <>
                <h3 className="text-lg font-bold">{t('secretariat.delegate.title')}</h3>
                <div>
                  <label htmlFor="target" className="field-label">
                    {t('secretariat.delegate.target')}
                  </label>
                  <select id="target" name="target" required className="input" defaultValue="">
                    <option value="" disabled />
                    <optgroup label={t('secretariat.targetGroups.internal')}>
                      {targets?.units.map((unit) => (
                        <option key={unit.code} value={`UNIT:${unit.code}`}>
                          {unit.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={t('secretariat.targetGroups.external')}>
                      {targets?.entities.map((entity) => (
                        <option key={entity.code} value={`ENTITY:${entity.code}`}>
                          {entity.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label htmlFor="instructions" className="field-label">
                    {t('secretariat.delegate.instructions')}
                  </label>
                  <textarea
                    id="instructions"
                    name="instructions"
                    rows={3}
                    maxLength={1000}
                    className="input"
                  />
                </div>
              </>
            )}

            {step === 'documents' && (
              <>
                <h3 className="text-lg font-bold">{t('secretariat.documents.title')}</h3>
                <div>
                  <label htmlFor="docs" className="field-label">
                    {t('secretariat.documents.message')}
                  </label>
                  <textarea
                    id="docs"
                    name="docs"
                    rows={3}
                    required
                    minLength={5}
                    maxLength={1000}
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="due" className="field-label">
                    {t('secretariat.documents.due')}
                  </label>
                  <input
                    id="due"
                    name="due"
                    type="date"
                    required
                    min={addDays(damascusIsoDate(now), 1)}
                    defaultValue={addDays(damascusIsoDate(now), 7)}
                    className="input"
                  />
                </div>
              </>
            )}

            {step === 'decline' && (
              <>
                <h3 className="text-lg font-bold">{t('secretariat.decline.title')}</h3>
                <p className="rounded-xl bg-tier-critical-bg p-3 text-sm text-tier-critical">
                  {t('secretariat.decline.warning')}
                </p>
              </>
            )}

            <FormError message={error} />
            <FormFooter
              onCancel={back}
              busy={busy}
              danger={step === 'decline'}
              submit={
                step === 'decline'
                  ? t('secretariat.actions.decline')
                  : t('secretariat.actions.confirm')
              }
            />
          </form>
        )}
      </div>
    </dialog>
  );
}

function Field({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="font-bold" dir={ltr ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  );
}
