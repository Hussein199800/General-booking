'use client';

import { CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { AppShell } from '@/components/AppShell';
import { DayList } from '@/components/agenda/DayList';
import { LiveBoard } from '@/components/agenda/LiveBoard';
import { MonthCalendar } from '@/components/agenda/MonthCalendar';
import { PendingTransfers } from '@/components/agenda/PendingTransfers';
import { PreviewBanner } from '@/components/PreviewBanner';
import { useNow } from '@/components/useNow';
import { useAgendaMonth } from '@/data/agenda';
import { useResource, useWorkspace } from '@/data/workspace';
import { formatDate, t } from '@/i18n';
import { damascusIsoDate } from '@/lib/dates';
import { useIdentity } from '@/lib/session';

import { secretariatNav } from './nav';
import { doneMessage, ResourceStatus } from './SecretariatDashboard';

/** The live board refreshes on its own, so arrivals recorded elsewhere show up. */
const LIVE_REFRESH_MS = 30_000;

/**
 * The Secretariat's view of the Grand Syndic's agenda: live tracking with
 * arrival / entry / exit controls, and the full calendar. The Grand Syndic's
 * private entries reach this screen only as reserved time.
 */
export function AgendaBoard() {
  const ws = useWorkspace({ kind: 'SECRETARIAT' });
  const now = useNow();
  const identity = useIdentity({ name: t('secretariat.user'), role: t('secretariat.role') });
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const today = now ? damascusIsoDate(now) : '';
  const agenda = useAgendaMonth(ws, today, LIVE_REFRESH_MS);
  const pending = useResource(ws, () => ws.pendingTransfers(), [ws], LIVE_REFRESH_MS);
  const rooms = useResource(ws, () => ws.rooms(), [ws]);
  const day = selected ?? today;

  async function track(id: string, step: Parameters<typeof ws.track>[1]) {
    const result = await ws.track(id, step);
    if (!result.ok) setNotice(result.message);
    agenda.reload();
  }

  return (
    <AppShell
      sectionName={t('secretariat.nav.agenda')}
      nav={secretariatNav('agenda')}
      userName={identity.name}
      userRole={identity.role}
      today={now ? formatDate(now) : ''}
    >
      <div className="mx-auto grid max-w-6xl gap-5">
        {ws.demo && <PreviewBanner />}

        <section className="hero grid gap-3 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
          <div className="relative">
            <h1 className="text-2xl font-bold sm:text-3xl">{t('secretariat.agenda.title')}</h1>
            <p className="mt-2 max-w-prose text-navy-100">{t('secretariat.agenda.subtitle')}</p>
          </div>
          {ws.demo && (
            <Link href="/syndic" className="btn relative bg-white/10 text-white hover:bg-white/20">
              <CalendarDays className="size-5" aria-hidden="true" />
              {t('secretariat.agenda.syndicView')}
            </Link>
          )}
        </section>

        {notice && (
          <p role="status" className="rounded-2xl bg-navy-900 p-4 text-sm text-white">
            {notice}
          </p>
        )}
        <ResourceStatus resource={agenda.resource} onRetry={agenda.reload} />

        {now && agenda.items && (
          <>
            <LiveBoard
              appointments={agenda.dayItems(today)}
              now={now}
              onTrack={(id, step) => void track(id, step)}
            />
            <PendingTransfers
              items={pending.data ?? []}
              now={now}
              showMember
              rooms={rooms.data}
              onSchedule={(item, booking) => ws.scheduleTransfer(item.id, booking)}
              onScheduled={(message) => {
                setNotice(doneMessage(ws, message));
                pending.reload();
                agenda.reload();
              }}
            />
            <div className="grid gap-5">
              <MonthCalendar
                month={agenda.month}
                onMonthChange={agenda.setMonth}
                selected={day}
                onSelect={setSelected}
                today={today}
                appointments={agenda.items}
              />
              <div className="grid gap-3">
                <h2 className="text-lg font-bold">
                  {formatDate(new Date(`${day}T12:00:00+03:00`))}
                </h2>
                <DayList appointments={agenda.dayItems(day)} />
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
