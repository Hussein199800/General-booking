'use client';

import type { AppointmentStatus } from '@sba/shared';
import { AlertTriangle, ArrowRight, FileText, MapPin, Paperclip, Video, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { PRIORITY_BORDER, PriorityBadge } from '@/components/Badges';
import { PreviewBanner } from '@/components/PreviewBanner';
import { Seal } from '@/components/Seal';
import { demoAgenda, type DemoAppointment } from '@/demo/data';
import { formatDate, formatTime, t } from '@/i18n';

interface AgendaItem extends DemoAppointment {
  readonly status: AppointmentStatus;
}

/**
 * The Grand Syndic's executive view: approved appointments only, readable at a
 * glance on a phone, documents previewed in place, one emergency control.
 */
export function SyndicAgenda() {
  const [now, setNow] = useState<Date | null>(null);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [doc, setDoc] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const current = new Date();
    setNow(current);
    setItems(demoAgenda(current).map((item) => ({ ...item, status: 'SCHEDULED' })));
  }, []);

  const remaining = now
    ? items.filter((item) => item.status === 'SCHEDULED' && item.endsAt > now)
    : [];
  const next = remaining[0];

  function postponeRest() {
    if (!now) return;
    setItems((previous) =>
      previous.map((item) =>
        item.status === 'SCHEDULED' && item.endsAt > now ? { ...item, status: 'POSTPONED' } : item,
      ),
    );
    setConfirming(false);
    setDone(true);
  }

  return (
    <main id="main" className="mx-auto grid max-w-2xl gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="btn btn-secondary min-h-10 px-3 text-sm">
          <ArrowRight className="size-4" aria-hidden="true" />
          {t('nav.home')}
        </Link>
        <span className="badge bg-gold-50 text-gold-700">{t('preview.badge')}</span>
      </div>

      <section className="hero flex items-center gap-4 p-6">
        <Seal id="syndic" className="relative size-16 shrink-0 text-gold-300" />
        <div className="relative min-w-0">
          <p className="text-sm text-gold-300">{t('entities.GRAND_SYNDIC')}</p>
          <h1 className="text-2xl font-bold">{t('syndic.title')}</h1>
          <p className="text-navy-100">{now ? formatDate(now) : ' '}</p>
          <p className="mt-1 text-sm text-gold-100">
            {now
              ? t('syndic.count', { count: items.filter((x) => x.status === 'SCHEDULED').length })
              : ' '}
          </p>
        </div>
      </section>

      <PreviewBanner />

      {done && (
        <p role="status" className="rounded-2xl bg-navy-900 p-4 text-sm text-white">
          {t('syndic.emergencyDone')} {t('preview.actionNotSaved')}
        </p>
      )}

      {now && items.length === 0 && (
        <p className="card p-6 text-center text-ink-muted">{t('syndic.empty')}</p>
      )}

      <ol className="grid gap-3">
        {items.map((item) => {
          const postponed = item.status === 'POSTPONED';
          const isNext = item.id === next?.id;
          return (
            <li
              key={item.id}
              className={`card border-s-4 p-4 ${PRIORITY_BORDER[item.priority]} ${postponed ? 'opacity-60' : ''} ${
                isNext ? 'ring-2 ring-gold-500' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-20 shrink-0 text-center whitespace-nowrap">
                  <p className="text-lg font-bold text-navy-800">{formatTime(item.startsAt)}</p>
                  <p className="text-xs text-ink-subtle">
                    {t('syndic.until', { time: formatTime(item.endsAt) })}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={item.priority} />
                    {isNext && (
                      <span className="badge bg-gold-100 text-gold-700">{t('syndic.next')}</span>
                    )}
                    {postponed && (
                      <span className="badge bg-tier-critical-bg text-tier-critical">
                        {t('labels.appointmentStatus.POSTPONED')}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 text-lg font-bold leading-snug">{item.name}</h2>
                  <p className="text-sm text-ink-muted">
                    {item.capacity}
                    {item.organization ? ` — ${item.organization}` : ''}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-navy-700">
                    {item.mode === 'IN_PERSON' ? (
                      <MapPin className="size-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Video className="size-4 shrink-0" aria-hidden="true" />
                    )}
                    {item.mode === 'IN_PERSON' && item.room
                      ? t('syndic.inPerson', { room: t(`secretariat.rooms.${item.room}`) })
                      : t('syndic.remote')}
                  </p>
                  <p className="mt-2 rounded-xl bg-canvas p-3 text-sm leading-relaxed">
                    <span className="block text-xs font-bold text-ink-subtle">
                      {t('syndic.brief')}
                    </span>
                    {item.brief}
                  </p>
                  {item.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.attachments.map((name) => (
                        <button
                          key={name}
                          type="button"
                          className="badge min-h-9 border border-line bg-surface px-3 text-ink"
                          onClick={() => {
                            setDoc(name);
                          }}
                        >
                          <Paperclip className="size-3.5" aria-hidden="true" />
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        className="btn btn-danger mt-2 w-full"
        onClick={() => {
          setConfirming(true);
        }}
      >
        <AlertTriangle className="size-5" aria-hidden="true" />
        {t('syndic.emergency')}
      </button>

      {doc && (
        <Modal
          title={t('syndic.docPreviewTitle')}
          onClose={() => {
            setDoc(null);
          }}
        >
          <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-line bg-canvas p-8 text-center">
            <FileText className="size-12 text-navy-700" aria-hidden="true" />
            <p className="font-bold">{doc}</p>
            <p className="text-sm text-ink-muted">{t('syndic.docPreviewUnavailable')}</p>
          </div>
        </Modal>
      )}

      {confirming && (
        <Modal
          title={t('syndic.emergencyTitle')}
          onClose={() => {
            setConfirming(false);
          }}
        >
          <p className="leading-relaxed">
            {remaining.length > 0
              ? t('syndic.emergencyBody', { count: remaining.length })
              : t('syndic.emergencyNone')}
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setConfirming(false);
              }}
            >
              {t('secretariat.actions.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-danger-solid"
              disabled={remaining.length === 0}
              onClick={postponeRest}
            >
              {t('syndic.emergencyConfirm')}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-label={title}>
      <div className="grid gap-4 p-5 sm:p-6">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            className="btn btn-secondary min-h-10 px-3"
            aria-label={t('secretariat.detail.close')}
            onClick={() => ref.current?.close()}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div>{children}</div>
      </div>
    </dialog>
  );
}
