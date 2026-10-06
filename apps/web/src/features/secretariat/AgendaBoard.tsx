'use client';

import { CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { AppShell } from '@/components/AppShell';
import { DayList } from '@/components/agenda/DayList';
import { LiveBoard } from '@/components/agenda/LiveBoard';
import { PendingTransfers } from '@/components/agenda/PendingTransfers';
import { MonthCalendar } from '@/components/agenda/MonthCalendar';
import { PreviewBanner } from '@/components/PreviewBanner';
import { useNow } from '@/components/useNow';
import { damascusIsoDate } from '@/demo/data';
import { pendingTransfers, useDemoState } from '@/demo/store';
import { formatDate, t } from '@/i18n';

import { secretariatNav } from './nav';

/**
 * The Secretariat's view of the Grand Syndic's agenda: live tracking with
 * arrival / entry / exit controls, and the full calendar. The Grand Syndic's
 * private entries appear only as reserved time.
 */
export function AgendaBoard() {
  const state = useDemoState();
  const now = useNow();
  const [month, setMonth] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const today = now ? damascusIsoDate(now) : '';
  const mine = (state?.appointments ?? [])
    .filter((x) => x.principal === 'SYNDIC')
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const todays = mine.filter((x) => damascusIsoDate(x.startsAt) === today);
  const day = selected ?? today;

  return (
    <AppShell
      sectionName={t('secretariat.nav.agenda')}
      nav={secretariatNav('agenda')}
      userName={t('secretariat.user')}
      userRole={t('secretariat.role')}
      today={now ? formatDate(now) : ''}
    >
      <div className="mx-auto grid max-w-6xl gap-5">
        <PreviewBanner />

        <section className="hero grid gap-3 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
          <div className="relative">
            <h1 className="text-2xl font-bold sm:text-3xl">{t('secretariat.agenda.title')}</h1>
            <p className="mt-2 max-w-prose text-navy-100">{t('secretariat.agenda.subtitle')}</p>
          </div>
          <Link href="/syndic" className="btn relative bg-white/10 text-white hover:bg-white/20">
            <CalendarDays className="size-5" aria-hidden="true" />
            {t('secretariat.agenda.syndicView')}
          </Link>
        </section>

        {state && now && (
          <>
            {notice && (
              <p role="status" className="rounded-2xl bg-navy-900 p-4 text-sm text-white">
                {notice} {t('preview.actionNotSaved')}
              </p>
            )}
            <LiveBoard appointments={todays} now={now} viewer="SECRETARIAT" controls />
            <PendingTransfers
              items={pendingTransfers(state)}
              now={now}
              showMember
              onScheduled={setNotice}
            />
            <div className="grid gap-5">
              <MonthCalendar
                month={month ?? `${today.slice(0, 7)}-01`}
                onMonthChange={setMonth}
                selected={day}
                onSelect={setSelected}
                today={today}
                appointments={mine}
                viewer="SECRETARIAT"
              />
              <div className="grid gap-3">
                <h2 className="text-lg font-bold">
                  {formatDate(new Date(`${day}T12:00:00+03:00`))}
                </h2>
                <DayList
                  appointments={mine.filter((x) => damascusIsoDate(x.startsAt) === day)}
                  viewer="SECRETARIAT"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
