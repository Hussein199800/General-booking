'use client';

import type { Page, PriorityTier, RequesterType } from '@sba/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiResult } from '@/lib/api';
import { DEMO_MODE } from '@/lib/runtime';

import { apiWorkspace } from './api-workspace';
import { demoWorkspace } from './demo-workspace';
import type { Appt, Booking, Counts, Option, QueueFilter, Ticket, TicketInfo } from './model';

export type TrackStep = 'ARRIVED' | 'STARTED' | 'ENDED' | 'NO_SHOW';

/** Whose lens a screen uses; only the demo needs it (the API decides from the session). */
export type Lens =
  | { readonly kind: 'SECRETARIAT' }
  | { readonly kind: 'SYNDIC' }
  | { readonly kind: 'MEMBER'; readonly memberId: string };

/**
 * Every read and action the staff screens perform. Two implementations: the
 * API (all real builds) and the browser-only demo store (GitHub Pages preview).
 */
export interface Workspace {
  readonly demo: boolean;
  /** Called after data changes elsewhere (demo: another tab; API: never). */
  subscribe(listener: () => void): () => void;

  queue(filter: QueueFilter): Promise<ApiResult<Page<Ticket>>>;
  counts(): Promise<ApiResult<Counts>>;
  ticket(id: string): Promise<ApiResult<TicketInfo>>;
  agenda(from: Date, to: Date): Promise<ApiResult<Appt[]>>;
  pendingTransfers(): Promise<ApiResult<Appt[]>>;
  members(): Promise<ApiResult<Option[]>>;
  rooms(): Promise<ApiResult<Option[]>>;
  routingTargets(): Promise<ApiResult<{ units: Option[]; entities: Option[] }>>;

  approve(ticketId: string, booking: Booking): Promise<ApiResult<unknown>>;
  delegate(
    ticketId: string,
    target: { targetType: 'ORGANIZATIONAL_UNIT' | 'EXTERNAL_ENTITY'; targetCode: string },
    instructions: string,
  ): Promise<ApiResult<unknown>>;
  requestDocuments(ticketId: string, message: string, dueDate: string): Promise<ApiResult<unknown>>;
  decline(ticketId: string): Promise<ApiResult<unknown>>;

  addEntry(entry: {
    title: string;
    startsAt: Date;
    endsAt: Date;
    locationNote: string;
    isPrivate: boolean;
  }): Promise<ApiResult<unknown>>;
  cancelEntry(id: string): Promise<ApiResult<unknown>>;
  transfer(
    appointmentId: string,
    memberId: string,
    keepTime: boolean,
    note: string,
  ): Promise<ApiResult<unknown>>;
  scheduleTransfer(appointmentId: string, booking: Booking): Promise<ApiResult<unknown>>;
  track(appointmentId: string, step: TrackStep): Promise<ApiResult<unknown>>;
  emergencyPostpone(from: Date): Promise<ApiResult<{ affected: number }>>;
  askSecretariat(request: {
    name: string;
    phone: string;
    purpose: string;
    priority: PriorityTier;
    requesterType: RequesterType | 'LAWYER';
  }): Promise<ApiResult<unknown>>;
  reset(): void;
}

export function useWorkspace(lens: Lens): Workspace {
  const key = lens.kind === 'MEMBER' ? `MEMBER:${lens.memberId}` : lens.kind;
  const ref = useRef<{ key: string; ws: Workspace } | null>(null);
  if (ref.current?.key !== key) {
    ref.current = { key, ws: DEMO_MODE ? demoWorkspace(lens) : apiWorkspace };
  }
  return ref.current.ws;
}

export type Resource<T> =
  | { readonly state: 'loading'; readonly data: T | null }
  | { readonly state: 'ready'; readonly data: T }
  | { readonly state: 'error'; readonly data: T | null; readonly message: string };

/**
 * Loads `load()` and reloads it on demand, on workspace changes, and every
 * `refreshMs` when given (live board). On a failed reload the last data stays
 * visible next to the error, never presented as fresh.
 */
export function useResource<T>(
  ws: Workspace,
  load: () => Promise<ApiResult<T>>,
  deps: readonly unknown[],
  refreshMs?: number,
): Resource<T> & { reload: () => void } {
  const [resource, setResource] = useState<Resource<T>>({ state: 'loading', data: null });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => {
    setTick((n) => n + 1);
  }, []);
  // `load` is re-created on every render; `deps` says when it actually changes.
  const stableLoad = useCallback(load, deps);

  useEffect(() => {
    let cancelled = false;
    void stableLoad().then((result) => {
      if (cancelled) return;
      setResource((previous) =>
        result.ok
          ? { state: 'ready', data: result.value }
          : { state: 'error', data: previous.data, message: result.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [stableLoad, tick]);

  useEffect(() => ws.subscribe(reload), [ws, reload]);

  useEffect(() => {
    if (!refreshMs) return;
    const timer = setInterval(reload, refreshMs);
    return () => {
      clearInterval(timer);
    };
  }, [refreshMs, reload]);

  return { ...resource, reload };
}
