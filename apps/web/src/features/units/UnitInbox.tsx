'use client';

import type { TicketDetail, TicketSummary } from '@sba/shared';
import { CheckCheck, Inbox, LogOut, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type SubmitEvent } from 'react';

import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { FormError, FormFooter } from '@/components/BookingFields';
import { Modal } from '@/components/Modal';
import { formatDateTime, t } from '@/i18n';
import { api, type ApiResult } from '@/lib/api';
import { formText } from '@/lib/form';
import { signOut, useMe } from '@/lib/session';

interface InboxItem {
  readonly assignmentId: string;
  readonly status: 'ACTIVE' | 'ACKNOWLEDGED';
  readonly instructions: string | null;
  readonly assignedAt: string;
  readonly ticket: TicketSummary;
}

type Decision = { item: InboxItem; outcome: 'close' | 'return' };

/**
 * Branch councils and committees: only matters delegated to the user's own
 * unit (the API scopes by role grant). Each is closed here or returned to the
 * Secretariat with a note (decision Q2).
 */
export function UnitInbox() {
  const me = useMe();
  const router = useRouter();
  const [inbox, setInbox] = useState<ApiResult<InboxItem[]> | null>(null);
  const [open, setOpen] = useState<InboxItem | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void api.get<InboxItem[]>('/units/inbox').then(setInbox);
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    setDetail(null);
    if (!open) return;
    void api.get<TicketDetail>(`/units/assignments/${open.assignmentId}`).then((result) => {
      if (result.ok) setDetail(result.value);
    });
  }, [open]);

  async function act(path: string, body: object, message: string) {
    setBusy(true);
    setError(null);
    const result = await api.post(path, body);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    setNotice(message);
    setOpen(null);
    setDecision(null);
    load();
    return true;
  }

  function decide(event: SubmitEvent<HTMLFormElement>, current: Decision) {
    event.preventDefault();
    const note = formText(new FormData(event.currentTarget), 'note');
    void act(
      `/units/assignments/${current.item.assignmentId}/${current.outcome}`,
      note ? { note } : {},
      current.outcome === 'close' ? t('units.closed') : t('units.returned'),
    );
  }

  return (
    <div className="grid gap-4">
      <section className="hero flex flex-wrap items-center gap-4 p-6">
        <Inbox className="relative size-10 text-gold-300" aria-hidden="true" />
        <div className="relative min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{t('units.title')}</h1>
          <p className="text-navy-100">{me.fullName}</p>
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

      {!inbox && <p className="p-4 text-ink-muted">{t('common.loading')}</p>}
      {inbox && !inbox.ok && (
        <div role="alert" className="card grid gap-3 p-4 text-tier-critical">
          {inbox.message}
          <button type="button" className="btn btn-secondary justify-self-start" onClick={load}>
            {t('common.retry')}
          </button>
        </div>
      )}
      {inbox?.ok && inbox.value.length === 0 && (
        <p className="card p-6 text-center text-ink-muted">{t('units.empty')}</p>
      )}
      {inbox?.ok && (
        <ul className="grid gap-3">
          {inbox.value.map((item) => (
            <li key={item.assignmentId}>
              <button
                type="button"
                className="card grid w-full gap-2 p-4 text-start hover:shadow-md"
                onClick={() => {
                  setError(null);
                  setOpen(item);
                }}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={item.ticket.priority} />
                  <span className="badge bg-canvas text-ink-muted">
                    {t(`labels.ticketKind.${item.ticket.kind}`)}
                  </span>
                  <span className="badge bg-navy-50 text-navy-800">
                    {t(`units.status.${item.status}`)}
                  </span>
                  <span dir="ltr" className="ms-auto font-mono text-xs text-ink-subtle">
                    {item.ticket.referenceCode}
                  </span>
                </span>
                <span className="font-bold">{item.ticket.requesterName}</span>
                <span className="line-clamp-2 text-sm text-ink-muted">{item.ticket.summary}</span>
                <span className="text-xs text-ink-subtle">
                  {t('units.assignedAt', { date: formatDateTime(new Date(item.assignedAt)) })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !decision && (
        <Modal
          title={open.ticket.requesterName}
          onClose={() => {
            setOpen(null);
          }}
        >
          <div className="grid gap-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <PriorityBadge priority={open.ticket.priority} />
              <StatusBadge status={open.ticket.status} />
            </div>
            {open.instructions && (
              <p className="rounded-xl bg-gold-50 p-3 text-gold-700">
                {t('units.instructions')}: {open.instructions}
              </p>
            )}
            <p className="rounded-xl bg-canvas p-3 leading-relaxed whitespace-pre-line">
              {detail?.description ?? open.ticket.summary}
            </p>
            <FormError message={error} />
            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
              {open.status === 'ACTIVE' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      `/units/assignments/${open.assignmentId}/acknowledge`,
                      {},
                      t('units.acknowledged'),
                    )
                  }
                >
                  {t('units.acknowledge')}
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setDecision({ item: open, outcome: 'return' });
                }}
              >
                <Undo2 className="size-4" aria-hidden="true" />
                {t('units.return')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setDecision({ item: open, outcome: 'close' });
                }}
              >
                <CheckCheck className="size-4" aria-hidden="true" />
                {t('units.close')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {decision && (
        <Modal
          title={decision.outcome === 'close' ? t('units.close') : t('units.return')}
          onClose={() => {
            setDecision(null);
          }}
        >
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              decide(event, decision);
            }}
          >
            <div>
              <label htmlFor="note" className="field-label">
                {t('units.note')}
              </label>
              <textarea id="note" name="note" rows={3} maxLength={1000} className="input" />
            </div>
            <FormError message={error} />
            <FormFooter
              onCancel={() => {
                setDecision(null);
              }}
              busy={busy}
              submit={t('secretariat.actions.confirm')}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
