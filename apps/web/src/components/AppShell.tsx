'use client';

import { Menu, X, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { t } from '@/i18n';
import { DEMO_MODE } from '@/lib/runtime';

import { Seal } from './Seal';

export interface NavEntry {
  readonly href: string;
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly current?: boolean;
  readonly disabled?: boolean;
}

interface AppShellProps {
  readonly sectionName: string;
  readonly nav: readonly NavEntry[];
  readonly userName: string;
  readonly userRole: string;
  readonly today: string;
  readonly children: ReactNode;
}

/**
 * Layout of the staff interfaces, after the reference portal: sidebar on the
 * inline-start side on wide screens; a top bar with a slide-in menu on phones.
 */
export function AppShell({ sectionName, nav, userName, userRole, today, children }: AppShellProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="min-h-dvh lg:flex">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-navy-800"
          aria-label={t('nav.openMenu')}
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{t('app.shortName')}</p>
          <p className="truncate text-sm text-ink-muted">{sectionName}</p>
        </div>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-navy-950/50 lg:hidden"
          aria-hidden="true"
          onClick={() => {
            setOpen(false);
          }}
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 start-0 z-50 flex w-72 flex-col gap-5 overflow-y-auto border-e border-line bg-surface p-4 transition-transform duration-200 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <Seal id="sidebar" className="size-12 shrink-0 text-navy-800" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-ink-muted">{t('app.institutionName')}</p>
            <p className="font-bold leading-snug text-ink">{t('app.shortName')}</p>
          </div>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl text-ink-muted lg:hidden"
            aria-label={t('nav.closeMenu')}
            onClick={() => {
              setOpen(false);
            }}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <dl className="grid gap-2 rounded-2xl border border-line bg-navy-50 p-3 text-sm">
          <div>
            <dt className="text-ink-subtle">{t('preview.user')}</dt>
            <dd className="font-bold">{userName}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">{t('preview.role')}</dt>
            <dd className="font-bold">{userRole}</dd>
          </div>
          <div>
            <dt className="text-ink-subtle">{t('preview.date')}</dt>
            <dd className="font-bold">{today}</dd>
          </div>
        </dl>

        <nav className="grid gap-1">
          {nav.map((item) => (
            <Link
              key={item.href + item.title}
              href={item.href}
              className="nav-item"
              aria-current={item.current ? 'page' : undefined}
              aria-disabled={item.disabled ? true : undefined}
              tabIndex={item.disabled ? -1 : undefined}
              onClick={() => {
                setOpen(false);
              }}
            >
              <item.icon className="size-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-bold">{item.title}</span>
                <span className="block text-xs opacity-75">
                  {item.disabled ? t('nav.comingSoon') : item.description}
                </span>
              </span>
            </Link>
          ))}
        </nav>

        <Link
          href={DEMO_MODE ? '/' : '/account'}
          className="nav-item mt-auto text-sm text-ink-muted"
        >
          {DEMO_MODE ? t('nav.backHome') : t('account.title')}
        </Link>
      </aside>

      <main id="main" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
