'use client';

import { ArrowRight, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DayList } from '@/components/agenda/DayList';
import { PendingTransfers } from '@/components/agenda/PendingTransfers';
import { PreviewBanner } from '@/components/PreviewBanner';
import { Seal } from '@/components/Seal';
import { useNow } from '@/components/useNow';
import { byStart } from '@/data/model';
import { useResource, useWorkspace } from '@/data/workspace';
import { councilMembers } from '@/demo/data';
import { doneMessage, ResourceStatus } from '@/features/secretariat/SecretariatDashboard';
import { formatDate, t } from '@/i18n';
import { useOptionalMe } from '@/lib/session';

/** How far ahead the member's list looks. */
const HORIZON_DAYS = 60;

/**
 * A Bar Council member's view: audiences the Grand Syndic transferred to them
 * that still need a time, and their upcoming appointments (decision D21).
 * In the demo build a member is chosen from a list; otherwise it is the
 * signed-in member.
 */
export function MemberAgenda() {
  const me = useOptionalMe();
  const now = useNow();
  const [demoMemberId, setDemoMemberId] = useState(councilMembers[0]?.id ?? '');
  const memberId = me?.id ?? demoMemberId;
  const ws = useWorkspace({ kind: 'MEMBER', memberId });
  const [notice, setNotice] = useState<string | null>(null);
  const demoMember = councilMembers.find((x) => x.id === demoMemberId);

  const from = now ? new Date(now.getTime() - 86_400_000) : null;
  const upcoming = useResource(
    ws,
    () =>
      from
        ? ws.agenda(from, new Date(from.getTime() + HORIZON_DAYS * 86_400_000))
        : Promise.resolve({ ok: true as const, value: [] }),
    [ws, from?.toDateString()],
  );
  const pending = useResource(ws, () => ws.pendingTransfers(), [ws]);
  const rooms = useResource(ws, () => ws.rooms(), [ws]);
  const items = (upcoming.data ?? [])
    .filter((x) => x.status === 'SCHEDULED' && now !== null && x.endsAt > now)
    .sort(byStart);

  return (
    <main id="main" className="mx-auto grid max-w-4xl gap-4 p-4 sm:p-6">
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

      <section className="hero flex flex-wrap items-center gap-4 p-5 sm:p-7">
        <Seal id="member" className="relative size-16 shrink-0 text-gold-300" />
        <div className="relative min-w-0 flex-1">
          <p className="text-sm text-gold-300">
            {me ? me.fullName : demoMember ? `${demoMember.name} — ${demoMember.capacity}` : ''}
          </p>
          <h1 className="text-2xl font-bold">{t('member.title')}</h1>
          <p className="text-navy-100">{t('member.subtitle')}</p>
        </div>
        {!me && (
          <div className="relative w-full sm:w-64">
            <label htmlFor="member-select" className="mb-1 block text-xs text-gold-100">
              {t('member.choose')}
            </label>
            <select
              id="member-select"
              value={demoMemberId}
              onChange={(event) => {
                setDemoMemberId(event.target.value);
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
        )}
      </section>

      {ws.demo && <PreviewBanner />}

      {notice && (
        <p role="status" className="rounded-2xl bg-navy-900 p-4 text-sm text-white">
          {notice}
        </p>
      )}
      <ResourceStatus resource={pending} onRetry={pending.reload} />

      {now && (
        <>
          <PendingTransfers
            items={pending.data ?? []}
            now={now}
            showMember={false}
            rooms={rooms.data}
            onSchedule={(item, booking) => ws.scheduleTransfer(item.id, booking)}
            onScheduled={(message) => {
              setNotice(doneMessage(ws, message));
              pending.reload();
              upcoming.reload();
            }}
          />
          <section className="grid gap-3" aria-labelledby="upcoming">
            <h2 id="upcoming" className="text-lg font-bold">
              {t('member.upcoming')}
            </h2>
            <ResourceStatus resource={upcoming} onRetry={upcoming.reload} />
            {upcoming.data &&
              (items.length === 0 ? (
                <p className="card p-6 text-center text-ink-muted">{t('member.noUpcoming')}</p>
              ) : (
                <>
                  <p className="text-sm text-ink-muted">{formatDate(now)}</p>
                  <DayList appointments={items} />
                </>
              ))}
          </section>
        </>
      )}
    </main>
  );
}
