'use client';

import { useState } from 'react';

import { addDays, damascusInstant, damascusIsoDate } from '@/lib/dates';

import { byStart, type Appt } from './model';
import { useResource, type Resource, type Workspace } from './workspace';

/** The 6-week grid shown for a month (Saturday-first), as Damascus dates. */
export function monthGrid(month: string): { first: string; days: number } {
  const [y, m] = month.split('-').map(Number);
  const firstDow = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1)).getUTCDay();
  return { first: addDays(month, -((firstDow + 1) % 7)), days: 42 };
}

/**
 * Agenda data for the month calendar plus today's live view. Today is loaded
 * separately (and refreshed) so the live board stays current whichever month
 * is on screen.
 */
export function useAgendaMonth(ws: Workspace, today: string, refreshMs?: number) {
  const [chosen, setMonth] = useState<string | null>(null);
  const month = chosen ?? (today ? `${today.slice(0, 7)}-01` : '');
  const grid = month ? monthGrid(month) : null;

  const monthRes = useResource(
    ws,
    () =>
      grid
        ? ws.agenda(
            damascusInstant(grid.first, 0, 0),
            damascusInstant(addDays(grid.first, grid.days), 0, 0),
          )
        : Promise.resolve({ ok: true as const, value: [] }),
    [ws, grid?.first],
  );
  const todayRes = useResource(
    ws,
    () =>
      today
        ? ws.agenda(damascusInstant(today, 0, 0), damascusInstant(addDays(today, 1), 0, 0))
        : Promise.resolve({ ok: true as const, value: [] }),
    [ws, today],
    refreshMs,
  );

  const items = monthRes.data ? [...monthRes.data].sort(byStart) : null;
  const todays = todayRes.data ? [...todayRes.data].sort(byStart) : [];

  return {
    month,
    setMonth,
    items,
    today: todays,
    resource: (monthRes.state === 'error' ? monthRes : todayRes) as Resource<unknown>,
    dayItems: (day: string): Appt[] =>
      day === today ? todays : (items ?? []).filter((x) => damascusIsoDate(x.startsAt) === day),
    reload: () => {
      monthRes.reload();
      todayRes.reload();
    },
  };
}
