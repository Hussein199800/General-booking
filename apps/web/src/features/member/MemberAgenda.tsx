'use client';

import { ArrowRight, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DayList } from '@/components/agenda/DayList';
import { PendingTransfers } from '@/components/agenda/PendingTransfers';
import { PreviewBanner } from '@/components/PreviewBanner';
import { Seal } from '@/components/Seal';
import { useNow } from '@/components/useNow';
import { councilMembers } from '@/demo/data';
import { demoActions, pendingTransfers, useDemoState } from '@/demo/store';
import { formatDate, t } from '@/i18n';

/**
 * A Bar Council member's view: audiences the Grand Syndic transferred to them
 * that still need a time, and their upcoming appointments (decision D21).
 */
export function MemberAgenda() {
  const state = useDemoState();
  const now = useNow();
  const [memberId, setMemberId] = useState(councilMembers[0]?.id ?? '');
  const [notice, setNotice] = useState<string | null>(null);
  const member = councilMembers.find((x) => x.id === memberId);

  const upcoming =
    state && now
      ? state.appointments
          .filter((x) => x.principal === memberId && x.status === 'SCHEDULED' && x.endsAt > now)
          .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      : [];

  return (
    <main id="main" className="mx-auto grid max-w-4xl gap-4 p-4 sm:p-6">
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

      <section className="hero flex flex-wrap items-center gap-4 p-5 sm:p-7">
        <Seal id="member" className="relative size-16 shrink-0 text-gold-300" />
        <div className="relative min-w-0 flex-1">
          <p className="text-sm text-gold-300">
            {member ? `${member.name} — ${member.capacity}` : ''}
          </p>
          <h1 className="text-2xl font-bold">{t('member.title')}</h1>
          <p className="text-navy-100">{t('member.subtitle')}</p>
        </div>
        <div className="relative w-full sm:w-64">
          <label htmlFor="member-select" className="mb-1 block text-xs text-gold-100">
            {t('member.choose')}
          </label>
          <select
            id="member-select"
            value={memberId}
            onChange={(event) => {
              setMemberId(event.target.value);
            }}
            className="input bg-white"
          >
            {councilMembers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <PreviewBanner />

      {notice && (
        <p role="status" className="rounded-2xl bg-navy-900 p-4 text-sm text-white">
          {notice} {t('preview.actionNotSaved')}
        </p>
      )}

      {state && now && (
        <>
          <PendingTransfers
            items={pendingTransfers(state, memberId)}
            now={now}
            showMember={false}
            onScheduled={setNotice}
          />
          <section className="grid gap-3" aria-labelledby="upcoming">
            <h2 id="upcoming" className="text-lg font-bold">
              {t('member.upcoming')}
            </h2>
            {upcoming.length === 0 ? (
              <p className="card p-6 text-center text-ink-muted">{t('member.noUpcoming')}</p>
            ) : (
              <>
                <p className="text-sm text-ink-muted">{formatDate(now)}</p>
                <DayList appointments={upcoming} viewer="SYNDIC" />
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
