'use client';

import {
  canTransitionTicket,
  GOVERNORATES,
  PRIORITY_TIERS,
  type MeetingMode,
  type PriorityTier,
  type RequestStatus,
} from '@sba/shared';
import {
  CalendarCheck,
  CalendarClock,
  Clock3,
  FileQuestion,
  History,
  LayoutDashboard,
  Paperclip,
  Send,
  Shuffle,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type SubmitEvent } from 'react';

import { AppShell, type NavEntry } from '@/components/AppShell';
import { PRIORITY_ACCENT, PRIORITY_BORDER, PriorityBadge, StatusBadge } from '@/components/Badges';
import { PreviewBanner } from '@/components/PreviewBanner';
import { demoAgenda, demoTickets, type DemoTicket, type RoomCode } from '@/demo/data';
import { formatDate, formatNumber, formatRelative, t, type MessageKey } from '@/i18n';

type Filter = 'ALL' | PriorityTier;
type Step = 'detail' | 'approve' | 'delegate' | 'documents' | 'decline';

interface Slot {
  readonly startsAt: Date;
  readonly endsAt: Date;
}

const OPEN: readonly RequestStatus[] = ['PENDING_REVIEW', 'AWAITING_DOCUMENTS'];
const PRIORITY_RANK: Record<PriorityTier, number> = { CRITICAL: 0, INTERNAL: 1, STANDARD: 2 };
const DURATIONS = [15, 30, 45, 60] as const;
const STAT_LABEL = {
  CRITICAL: 'secretariat.stats.critical',
  INTERNAL: 'secretariat.stats.internal',
  STANDARD: 'secretariat.stats.standard',
} as const satisfies Record<PriorityTier, MessageKey>;

/** yyyy-mm-dd of the Damascus calendar day (UTC+3). */
function damascusIsoDate(instant: Date): string {
  return new Date(instant.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
}

function formValue(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function overlaps(a: Slot, b: Slot): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

const nav: NavEntry[] = [
  {
    href: '/secretariat',
    title: t('secretariat.nav.dashboard'),
    description: t('secretariat.nav.dashboardDesc'),
    icon: LayoutDashboard,
    current: true,
  },
  {
    href: '/syndic',
    title: t('secretariat.nav.agenda'),
    description: t('secretariat.nav.agendaDesc'),
    icon: CalendarClock,
  },
  {
    href: '/secretariat',
    title: t('secretariat.nav.routing'),
    description: t('secretariat.nav.routingDesc'),
    icon: Shuffle,
    disabled: true,
  },
  {
    href: '/secretariat',
    title: t('secretariat.nav.audit'),
    description: t('secretariat.nav.auditDesc'),
    icon: History,
    disabled: true,
  },
];

export function SecretariatDashboard() {
  // Demo data is time-relative, so it is created on the client after mount;
  // building it during static rendering would not match the visitor's clock.
  const [now, setNow] = useState<Date | null>(null);
  const [tickets, setTickets] = useState<DemoTicket[]>([]);
  const [booked, setBooked] = useState<Slot[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const current = new Date();
    setNow(current);
    setTickets(demoTickets(current));
    setBooked(demoAgenda(current));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 6000);
    return () => {
      clearTimeout(timer);
    };
  }, [toast]);

  const open = useMemo(
    () =>
      tickets
        .filter((ticket) => OPEN.includes(ticket.status))
        .sort(
          (a, b) =>
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
            a.submittedAt.getTime() - b.submittedAt.getTime(),
        ),
    [tickets],
  );
  const visible = filter === 'ALL' ? open : open.filter((ticket) => ticket.priority === filter);
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;

  const countBy = (priority: PriorityTier) => open.filter((x) => x.priority === priority).length;
  const awaiting = tickets.filter((x) => x.status === 'AWAITING_DOCUMENTS').length;
  const decided = tickets.filter((x) => !OPEN.includes(x.status)).length;

  function applyDecision(id: string, status: RequestStatus, message: string, slot?: Slot) {
    setTickets((previous) => previous.map((x) => (x.id === id ? { ...x, status } : x)));
    if (slot) setBooked((previous) => [...previous, slot]);
    setSelectedId(null);
    setToast(`${message} ${t('preview.actionNotSaved')}`);
  }

  return (
    <AppShell
      sectionName={t('secretariat.nav.dashboard')}
      nav={nav}
      userName={t('secretariat.user')}
      userRole={t('secretariat.role')}
      today={now ? formatDate(now) : ''}
    >
      <div className="mx-auto grid max-w-6xl gap-5">
        <PreviewBanner />

        <section className="hero grid gap-4 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
          <div className="relative">
            <h1 className="text-2xl font-bold sm:text-3xl">{t('secretariat.title')}</h1>
            <p className="mt-2 text-navy-100">{t('secretariat.subtitle')}</p>
          </div>
          <div className="relative rounded-2xl bg-white/10 px-6 py-4 text-center">
            <p className="text-sm text-gold-300">{t('secretariat.pendingTotal')}</p>
            <p className="text-4xl font-bold">{now ? formatNumber(open.length) : '—'}</p>
          </div>
        </section>

        <section
          className="grid grid-cols-2 gap-3 md:grid-cols-5"
          aria-label={t('secretariat.title')}
        >
          {PRIORITY_TIERS.map((priority) => (
            <div
              key={priority}
              className="stat-card"
              style={{ ['--stat-accent' as string]: PRIORITY_ACCENT[priority] }}
            >
              <p className="text-sm text-ink-muted">{t(STAT_LABEL[priority])}</p>
              <p className="text-3xl font-bold" style={{ color: PRIORITY_ACCENT[priority] }}>
                {now ? formatNumber(countBy(priority)) : '—'}
              </p>
            </div>
          ))}
          <div className="stat-card [--stat-accent:var(--color-gold-500)]">
            <p className="text-sm text-ink-muted">{t('secretariat.stats.awaitingDocuments')}</p>
            <p className="text-3xl font-bold text-gold-700">{now ? formatNumber(awaiting) : '—'}</p>
          </div>
          <div className="stat-card col-span-2 md:col-span-1">
            <p className="text-sm text-ink-muted">{t('secretariat.stats.decided')}</p>
            <p className="text-3xl font-bold text-navy-800">{now ? formatNumber(decided) : '—'}</p>
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

          {now && visible.length === 0 && (
            <p className="rounded-2xl bg-canvas p-6 text-center text-ink-muted">
              {t('secretariat.queue.empty')}
            </p>
          )}

          <ul className="grid gap-3">
            {now &&
              visible.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(ticket.id);
                    }}
                    className={`grid w-full gap-2 rounded-2xl border border-line border-s-4 bg-surface p-4 text-start transition hover:shadow-md ${PRIORITY_BORDER[ticket.priority]}`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={ticket.priority} />
                      <span className="badge bg-canvas text-ink-muted">
                        {t(`labels.ticketKind.${ticket.kind}`)}
                      </span>
                      <StatusBadge status={ticket.status} />
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
                    <span className="line-clamp-2 text-sm text-ink-muted">{ticket.purpose}</span>
                    <span className="flex flex-wrap items-center gap-4 text-xs text-ink-subtle">
                      <span className="flex items-center gap-1">
                        <Clock3 className="size-3.5" aria-hidden="true" />
                        {t('secretariat.queue.submitted', {
                          when: formatRelative(ticket.submittedAt, now),
                        })}
                      </span>
                      {ticket.attachments.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Paperclip className="size-3.5" aria-hidden="true" />
                          {t('secretariat.queue.attachments', { count: ticket.attachments.length })}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      </div>

      {selected && now && (
        <TicketDialog
          ticket={selected}
          now={now}
          booked={booked}
          onClose={() => {
            setSelectedId(null);
          }}
          onDecide={applyDecision}
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

interface TicketDialogProps {
  readonly ticket: DemoTicket;
  readonly now: Date;
  readonly booked: readonly Slot[];
  readonly onClose: () => void;
  readonly onDecide: (id: string, status: RequestStatus, message: string, slot?: Slot) => void;
}

function TicketDialog({ ticket, now, booked, onClose, onDecide }: TicketDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>('detail');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const can = (to: RequestStatus) => canTransitionTicket(ticket.kind, ticket.status, to);

  function submitApprove(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = formValue(form, 'date');
    const time = formValue(form, 'time');
    const minutes = Number(form.get('duration'));
    const startsAt = new Date(`${date}T${time}:00+03:00`);
    const slot = { startsAt, endsAt: new Date(startsAt.getTime() + minutes * 60_000) };
    // Mirrors the database EXCLUDE constraint on the Grand Syndic's time.
    if (booked.some((other) => overlaps(slot, other))) {
      setError(t('secretariat.approve.conflict'));
      return;
    }
    onDecide(ticket.id, 'APPROVED', t('secretariat.approve.success'), slot);
  }

  function submitSimple(
    event: SubmitEvent<HTMLFormElement>,
    status: RequestStatus,
    message: string,
  ) {
    event.preventDefault();
    onDecide(ticket.id, status, message);
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

  const footer = (submitLabel: string, danger = false) => (
    <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setError(null);
          setStep('detail');
        }}
      >
        {t('secretariat.actions.cancel')}
      </button>
      <button type="submit" className={`btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`}>
        {submitLabel}
      </button>
    </div>
  );

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
              <Field label={t('secretariat.detail.capacity')} value={ticket.capacity} />
              {ticket.organization && (
                <Field label={t('secretariat.detail.organization')} value={ticket.organization} />
              )}
              <Field
                label={t('secretariat.detail.requester')}
                value={t(`labels.requesterType.${ticket.requesterType}`)}
              />
              {ticket.preferredMode && (
                <Field
                  label={t('secretariat.detail.preferredMode')}
                  value={t(`meetingMode.${ticket.preferredMode}`)}
                />
              )}
              <Field
                label={t('secretariat.detail.submittedAt')}
                value={formatRelative(ticket.submittedAt, now)}
              />
              <div className="sm:col-span-2">
                <dt className="text-ink-subtle">{t('secretariat.detail.purpose')}</dt>
                <dd className="mt-1 rounded-xl bg-canvas p-3 leading-relaxed">{ticket.purpose}</dd>
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

        {step === 'approve' && (
          <form className="grid gap-4" onSubmit={submitApprove}>
            <h3 className="text-lg font-bold">{t('secretariat.approve.title')}</h3>
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
                  defaultValue={damascusIsoDate(now)}
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
                  defaultValue="10:00"
                  step={900}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="duration" className="field-label">
                  {t('secretariat.approve.duration')}
                </label>
                <select id="duration" name="duration" defaultValue={30} className="input">
                  {DURATIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {t('secretariat.approve.minutes', { count: minutes })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <ModeAndRoom preferred={ticket.preferredMode} />
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-tier-critical-bg p-3 text-sm font-bold text-tier-critical"
              >
                {error}
              </p>
            )}
            {footer(t('secretariat.actions.confirm'))}
          </form>
        )}

        {step === 'delegate' && (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              submitSimple(event, 'DELEGATED', t('secretariat.delegate.success'));
            }}
          >
            <h3 className="text-lg font-bold">{t('secretariat.delegate.title')}</h3>
            <div>
              <label htmlFor="target" className="field-label">
                {t('secretariat.delegate.target')}
              </label>
              <select id="target" name="target" required className="input" defaultValue="">
                <option value="" disabled />
                <optgroup label={t('secretariat.targetGroups.central')}>
                  <option value="CENTRAL_DISCIPLINARY_COMMITTEE">
                    {t('orgUnits.CENTRAL_DISCIPLINARY_COMMITTEE')}
                  </option>
                </optgroup>
                <optgroup label={t('secretariat.targetGroups.branches')}>
                  {GOVERNORATES.map((governorate) => (
                    <option key={governorate} value={`BRANCH_${governorate}`}>
                      {t('branch.councilName', { governorate: t(`governorates.${governorate}`) })}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t('secretariat.targetGroups.external')}>
                  <option value="MINISTRY_OF_JUSTICE">{t('entities.MINISTRY_OF_JUSTICE')}</option>
                  <option value="SUPREME_JUDICIAL_COUNCIL">
                    {t('entities.SUPREME_JUDICIAL_COUNCIL')}
                  </option>
                </optgroup>
              </select>
            </div>
            <div>
              <label htmlFor="instructions" className="field-label">
                {t('secretariat.delegate.instructions')}
              </label>
              <textarea id="instructions" name="instructions" rows={3} className="input" />
            </div>
            {footer(t('secretariat.actions.confirm'))}
          </form>
        )}

        {step === 'documents' && (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              submitSimple(event, 'AWAITING_DOCUMENTS', t('secretariat.documents.success'));
            }}
          >
            <h3 className="text-lg font-bold">{t('secretariat.documents.title')}</h3>
            <div>
              <label htmlFor="docs" className="field-label">
                {t('secretariat.documents.message')}
              </label>
              <textarea id="docs" name="docs" rows={3} required className="input" />
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
                defaultValue={damascusIsoDate(new Date(now.getTime() + 7 * 86_400_000))}
                className="input"
              />
            </div>
            {footer(t('secretariat.actions.confirm'))}
          </form>
        )}

        {step === 'decline' && (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              submitSimple(event, 'DECLINED', t('secretariat.decline.success'));
            }}
          >
            <h3 className="text-lg font-bold">{t('secretariat.decline.title')}</h3>
            <p className="rounded-xl bg-tier-critical-bg p-3 text-sm text-tier-critical">
              {t('secretariat.decline.warning')}
            </p>
            {footer(t('secretariat.actions.decline'), true)}
          </form>
        )}
      </div>
    </dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

function ModeAndRoom({ preferred }: { preferred: MeetingMode | null }) {
  const [mode, setMode] = useState<MeetingMode>(preferred ?? 'IN_PERSON');
  const rooms: RoomCode[] = ['MAIN', 'COUNCIL'];
  return (
    <fieldset className="grid gap-3">
      <legend className="field-label">{t('secretariat.approve.mode')}</legend>
      <div className="grid grid-cols-2 gap-2">
        {(['IN_PERSON', 'REMOTE'] as const).map((value) => (
          <label
            key={value}
            className={`btn border ${mode === value ? 'border-navy-800 bg-navy-50 text-navy-800' : 'border-line bg-surface text-ink-muted'}`}
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
      {mode === 'IN_PERSON' ? (
        <div>
          <label htmlFor="room" className="field-label">
            {t('secretariat.approve.room')}
          </label>
          <select id="room" name="room" className="input">
            {rooms.map((room) => (
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
    </fieldset>
  );
}
