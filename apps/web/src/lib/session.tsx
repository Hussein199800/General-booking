'use client';

import type { MeResponse, UserRole } from '@sba/shared';
import { LogOut, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { t } from '@/i18n';

import { api } from './api';
import { DEMO_MODE } from './runtime';

export type Me = Omit<MeResponse, 'roles'> & { readonly roles: readonly UserRole[] };

/** Where each role lands after signing in (first match wins). */
const HOME_BY_ROLE: readonly [UserRole, string][] = [
  ['GRAND_SYNDIC', '/syndic'],
  ['SECRETARIAT_HEAD', '/secretariat'],
  ['SECRETARIAT_OFFICER', '/secretariat'],
  ['COUNCIL_MEMBER', '/member'],
  ['BRANCH_OFFICER', '/units'],
  ['COMMITTEE_MEMBER', '/units'],
  ['LAWYER', '/lawyer'],
  ['SYSTEM_ADMIN', '/account'],
  ['AUDITOR', '/account'],
];

export function homeFor(me: Pick<Me, 'roles' | 'mfaVerified' | 'mfaEnabled'>): string {
  const staff = me.roles.some((role) => role !== 'LAWYER');
  if (staff && !me.mfaEnabled) return '/account/mfa';
  return HOME_BY_ROLE.find(([role]) => me.roles.includes(role))?.[1] ?? '/account';
}

const SessionContext = createContext<Me | null>(null);

/** The signed-in user, or null in the demo build (no sessions there). */
export function useOptionalMe(): Me | null {
  return useContext(SessionContext);
}

/** The signed-in user; only valid inside <RequireSession>. */
export function useMe(): Me {
  const me = useContext(SessionContext);
  if (!me) throw new Error('useMe() outside <RequireSession>');
  return me;
}

/** Ends the session on the server, then leaves for the sign-in page. */
export async function signOut(router: { replace: (href: string) => void }): Promise<void> {
  await api.post('/auth/logout', {}, { noRefresh: true });
  router.replace('/login');
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; me: Me }
  | { kind: 'forbidden'; me: Me }
  | { kind: 'error'; message: string };

/**
 * Client-side gate for the staff and lawyer screens. The server is the
 * authority (every API call is checked); this only avoids rendering a screen
 * the user cannot use and sends them to sign in when there is no session.
 */
export function RequireSession({
  roles,
  allowWithoutMfa = false,
  children,
}: {
  readonly roles?: readonly UserRole[];
  readonly allowWithoutMfa?: boolean;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const roleKey = roles?.join(',') ?? '';

  useEffect(() => {
    const wanted = roleKey ? (roleKey.split(',') as UserRole[]) : null;
    let cancelled = false;
    void api.get<Me>('/auth/me').then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        if (result.status === 401) {
          const next = window.location.pathname;
          router.replace(`/login?next=${encodeURIComponent(next)}`);
        } else setState({ kind: 'error', message: result.message });
        return;
      }
      const me = result.value;
      const staff = me.roles.some((role) => role !== 'LAWYER');
      if (staff && !me.mfaVerified && !allowWithoutMfa) {
        router.replace('/account/mfa');
        return;
      }
      const allowed = !wanted || me.roles.some((role) => wanted.includes(role));
      setState(allowed ? { kind: 'ready', me } : { kind: 'forbidden', me });
    });
    return () => {
      cancelled = true;
    };
  }, [router, roleKey, allowWithoutMfa]);

  if (state.kind === 'loading') return <Loading />;
  if (state.kind === 'error') return <FullPageMessage>{state.message}</FullPageMessage>;
  if (state.kind === 'forbidden') {
    return (
      <FullPageMessage>
        <ShieldAlert className="mx-auto size-10 text-tier-critical" aria-hidden="true" />
        <p>{t('errors.forbidden')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={homeFor(state.me)} className="btn btn-secondary">
            {t('nav.backHome')}
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => void signOut(router)}>
            <LogOut className="size-4" aria-hidden="true" />
            {t('nav.signOut')}
          </button>
        </div>
      </FullPageMessage>
    );
  }
  return <SessionContext value={state.me}>{children}</SessionContext>;
}

export function Loading({ label = t('common.loading') }: { readonly label?: string }) {
  return (
    <div role="status" aria-live="polite" className="grid min-h-[40vh] place-items-center p-8">
      <div className="flex items-center gap-3 text-ink-muted">
        <span className="size-5 animate-spin rounded-full border-2 border-navy-200 border-t-navy-800" />
        {label}
      </div>
    </div>
  );
}

function FullPageMessage({ children }: { readonly children: ReactNode }) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-6">
      <div className="card grid max-w-md gap-4 p-8 text-center">{children}</div>
    </main>
  );
}

/** Staff screens: a session with one of `roles` in real builds; open in the demo build. */
export function StaffGate({
  roles,
  children,
}: {
  readonly roles: readonly UserRole[];
  readonly children: ReactNode;
}) {
  if (DEMO_MODE) return children;
  return <RequireSession roles={roles}>{children}</RequireSession>;
}

/** Name and role label for the shell (fixed demo labels in the demo build). */
export function useIdentity(fallback: { name: string; role: string }) {
  const me = useOptionalMe();
  if (!me) return fallback;
  return {
    name: me.fullName,
    role: me.roles.map((role) => t(`labels.role.${role}`)).join(t('common.listSeparator')),
  };
}
